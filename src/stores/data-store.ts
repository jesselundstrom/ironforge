import type { Session } from '@supabase/supabase-js';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import {
  normalizeProfileState,
  normalizeScheduleState,
} from '../domain/normalizers';
import { normalizeActiveWorkout } from '../domain/workout-helpers';
import type {
  ActiveWorkout,
  Profile,
  SportSchedule,
  SyncStatus,
  WorkoutRecord,
} from '../domain/types';
import { i18nStore } from './i18n-store';

type LoadDataOptions = {
  allowCloudSync?: boolean;
  userId?: string;
};

type DataStoreState = {
  currentUser: Record<string, unknown> | null;
  workouts: WorkoutRecord[];
  schedule: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  activeWorkout: ActiveWorkout | null;
  restDuration: number;
  restEndsAt: number;
  restSecondsLeft: number;
  restTotal: number;
  cloudSyncEnabled: boolean;
  syncStatus: SyncStatus;
  activeWorkoutDraft: Record<string, unknown> | null;
  refreshSnapshot: () => DataStoreSnapshot;
  loadData: (options?: LoadDataOptions) => Promise<void>;
  saveWorkouts: () => Promise<void>;
  saveScheduleData: () => Promise<void>;
  saveProfileData: (options?: { programIds?: string[] }) => Promise<void>;
  replaceWorkouts: (workouts: WorkoutRecord[]) => Promise<void>;
  deleteWorkoutById: (workoutId: string | number) => Promise<void>;
  setCurrentUser: (user: Record<string, unknown> | null) => void;
  setProfileState: (profile: Record<string, unknown> | null) => Promise<void>;
  setScheduleState: (schedule: Record<string, unknown> | null) => Promise<void>;
  updateProfileState: (patch: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  updateScheduleState: (
    patch: Record<string, unknown>
  ) => Promise<Record<string, unknown> | null>;
  updateProgramState: (
    programId: string,
    programState: Record<string, unknown>
  ) => Promise<void>;
  setActiveWorkoutState: (
    activeWorkout: ActiveWorkout | null,
    options?: {
      restDuration?: number;
      restTotal?: number;
      restEndsAt?: number;
      restSecondsLeft?: number;
    }
  ) => void;
  clearLocalDataCache: () => void;
  getLocalCacheKey: (baseKey: string, userId?: string) => string;
  getActiveWorkoutDraftCache: () => Record<string, unknown> | null;
  logout: () => Promise<unknown>;
};

type DataStoreSnapshot = Omit<
  DataStoreState,
  | 'refreshSnapshot'
  | 'loadData'
  | 'saveWorkouts'
  | 'saveScheduleData'
  | 'saveProfileData'
  | 'replaceWorkouts'
  | 'deleteWorkoutById'
  | 'setCurrentUser'
  | 'setProfileState'
  | 'setScheduleState'
  | 'updateProfileState'
  | 'updateScheduleState'
  | 'updateProgramState'
  | 'setActiveWorkoutState'
  | 'clearLocalDataCache'
  | 'getLocalCacheKey'
  | 'getActiveWorkoutDraftCache'
  | 'logout'
>;

type RuntimeWindow = Window & {
  __IRONFORGE_TEST_USER_ID__?: string;
  __IRONFORGE_GET_SUPABASE_CLIENT__?: () => SupabaseClientLike;
  __IRONFORGE_AUTH_RUNTIME__?: {
    logout?: () => Promise<unknown>;
  };
};

type SupabaseClientLike = {
  from: (table: string) => any;
};

const LOCAL_KEYS = {
  workouts: 'if2_workouts',
  schedule: 'if2_schedule',
  profile: 'if2_profile',
  activeWorkout: 'if2_active_workout',
  cacheReset: 'if2_cache_reset_v1',
} as const;
const PROFILE_CORE_DOC_KEY = 'profile_core';
const SCHEDULE_DOC_KEY = 'schedule';
const PROGRAM_DOC_PREFIX = 'program:';

let dataStoreRef: StoreApi<DataStoreState> | null = null;
let restTimerInterval: number | null = null;

function getRuntimeWindow() {
  if (typeof window === 'undefined') return null;
  return window as RuntimeWindow;
}

function getSupabaseClient() {
  return (
    (getRuntimeWindow()?.__IRONFORGE_GET_SUPABASE_CLIENT__?.() as
      | SupabaseClientLike
      | null
      | undefined) || null
  );
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function readJson<T>(key: string) {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function removeKey(key: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

function createDefaultProfile() {
  return normalizeProfileState({
    language: i18nStore.getState().language,
  }) as Profile;
}

function createDefaultSchedule() {
  return normalizeScheduleState(
    {
      sportName: '',
      sportDays: [],
      sportIntensity: 'hard',
      sportLegsHeavy: true,
    },
    { locale: i18nStore.getState().language }
  ) as SportSchedule;
}

function getScopedUserId(explicitUserId?: string) {
  const runtimeWindow = getRuntimeWindow();
  return (
    String(explicitUserId || '').trim() ||
    String(dataStoreRef?.getState().currentUser?.id || '').trim() ||
    String(runtimeWindow?.__IRONFORGE_TEST_USER_ID__ || '').trim()
  );
}

function getLocalCacheKey(baseKey: string, userId?: string) {
  const scopedUserId = getScopedUserId(userId);
  return scopedUserId ? `${baseKey}::${scopedUserId}` : baseKey;
}

function clearLegacyCachesOnce() {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(LOCAL_KEYS.cacheReset) === '1') return;
  const staleKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('ic_')) staleKeys.push(key);
  }
  staleKeys.forEach((key) => removeKey(key));
  localStorage.setItem(LOCAL_KEYS.cacheReset, '1');
}

function normalizeWorkoutRecord(input: unknown): WorkoutRecord | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  const base = normalizeActiveWorkout(record);
  if (!base) return null;
  return {
    ...cloneJson(record),
    ...base,
    duration: Number.isFinite(Number(record.duration)) ? Number(record.duration) : 0,
    rpe: Number.isFinite(Number(record.rpe)) ? Number(record.rpe) : null,
  } as WorkoutRecord;
}

function normalizeWorkoutRecords(items: unknown) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeWorkoutRecord(item))
    .filter((item): item is WorkoutRecord => !!item)
    .sort(
      (left, right) =>
        new Date(String(left.date || '')).getTime() -
        new Date(String(right.date || '')).getTime()
    );
}

function profileDocKey(programId: string) {
  return `${PROGRAM_DOC_PREFIX}${programId}`;
}

function profileDocPayload(
  docKey: string,
  profileLike: Record<string, unknown> | null,
  scheduleLike: Record<string, unknown> | null
) {
  if (docKey === PROFILE_CORE_DOC_KEY) {
    return normalizeProfileState(cloneJson(profileLike || createDefaultProfile()));
  }
  if (docKey === SCHEDULE_DOC_KEY) {
    return normalizeScheduleState(cloneJson(scheduleLike || createDefaultSchedule()), {
      locale: i18nStore.getState().language,
    });
  }
  const programId = docKey.startsWith(PROGRAM_DOC_PREFIX)
    ? docKey.slice(PROGRAM_DOC_PREFIX.length)
    : '';
  const programs =
    profileLike?.programs && typeof profileLike.programs === 'object'
      ? (profileLike.programs as Record<string, unknown>)
      : {};
  return cloneJson((programs[programId] as Record<string, unknown> | undefined) || {});
}

function syncSnapshot() {
  const state = dataStoreRef?.getState();
  return {
    currentUser: cloneJson(state?.currentUser || null),
    workouts: cloneJson(state?.workouts || []),
    schedule: cloneJson(state?.schedule || createDefaultSchedule()),
    profile: cloneJson(state?.profile || createDefaultProfile()),
    activeWorkout: cloneJson(state?.activeWorkout || null),
    restDuration: Number(state?.restDuration || 120),
    restEndsAt: Number(state?.restEndsAt || 0),
    restSecondsLeft: Number(state?.restSecondsLeft || 0),
    restTotal: Number(state?.restTotal || 0),
    cloudSyncEnabled: state?.cloudSyncEnabled !== false,
    syncStatus: cloneJson(state?.syncStatus || { state: 'idle', updatedAt: null }),
    activeWorkoutDraft: cloneJson(state?.activeWorkoutDraft || null),
  } as DataStoreSnapshot;
}

function persistLocalSnapshot(userId?: string) {
  const scopedUserId = getScopedUserId(userId);
  if (!scopedUserId) return;
  const snapshot = syncSnapshot();
  writeJson(getLocalCacheKey(LOCAL_KEYS.workouts, scopedUserId), snapshot.workouts);
  writeJson(getLocalCacheKey(LOCAL_KEYS.profile, scopedUserId), snapshot.profile);
  writeJson(getLocalCacheKey(LOCAL_KEYS.schedule, scopedUserId), snapshot.schedule);
  if (snapshot.activeWorkoutDraft) {
    writeJson(
      getLocalCacheKey(LOCAL_KEYS.activeWorkout, scopedUserId),
      snapshot.activeWorkoutDraft
    );
  } else {
    removeKey(getLocalCacheKey(LOCAL_KEYS.activeWorkout, scopedUserId));
  }
}

function setSyncStatus(state: SyncStatus['state']) {
  dataStoreRef?.setState((current) => ({
    ...current,
    syncStatus: { state, updatedAt: new Date().toISOString() },
  }));
}

function restartRestTimer() {
  if (restTimerInterval !== null && typeof window !== 'undefined') {
    window.clearInterval(restTimerInterval);
  }
  restTimerInterval = null;
  const current = dataStoreRef?.getState();
  if (!current || current.restEndsAt <= Date.now()) return;
  if (typeof window === 'undefined') return;
  restTimerInterval = window.setInterval(() => {
    const nextState = dataStoreRef?.getState();
    if (!nextState) return;
    const secondsLeft = Math.max(
      0,
      Math.ceil((nextState.restEndsAt - Date.now()) / 1000)
    );
    dataStoreRef?.setState((state) => ({
      ...state,
      restSecondsLeft: secondsLeft,
      activeWorkoutDraft: state.activeWorkoutDraft
        ? { ...state.activeWorkoutDraft, restSecondsLeft: secondsLeft }
        : null,
    }));
    if (secondsLeft <= 0 && restTimerInterval !== null) {
      window.clearInterval(restTimerInterval);
      restTimerInterval = null;
    }
  }, 1000);
}

async function pullProfileDocs(userId: string) {
  const client = getSupabaseClient();
  if (!client) return { profile: null, schedule: null };
  const { data, error } = await client
    .from('profile_documents')
    .select('doc_key,payload')
    .eq('user_id', userId);
  if (error || !Array.isArray(data) || !data.length) {
    return { profile: null, schedule: null };
  }
  const profile = normalizeProfileState({}) as Record<string, unknown>;
  let hasProfile = false;
  let schedule: Record<string, unknown> | null = null;
  data.forEach((row) => {
    const docKey = String(row?.doc_key || '');
    if (docKey === PROFILE_CORE_DOC_KEY && row.payload && typeof row.payload === 'object') {
      Object.assign(profile, cloneJson(row.payload));
      hasProfile = true;
      return;
    }
    if (docKey === SCHEDULE_DOC_KEY && row.payload && typeof row.payload === 'object') {
      schedule = cloneJson(row.payload);
      return;
    }
    if (docKey.startsWith(PROGRAM_DOC_PREFIX) && row.payload && typeof row.payload === 'object') {
      if (!profile.programs || typeof profile.programs !== 'object') {
        profile.programs = {};
      }
      (profile.programs as Record<string, unknown>)[
        docKey.slice(PROGRAM_DOC_PREFIX.length)
      ] = cloneJson(row.payload);
      hasProfile = true;
    }
  });
  return {
    profile: hasProfile ? (normalizeProfileState(profile) as Record<string, unknown>) : null,
    schedule: schedule
      ? (normalizeScheduleState(schedule, {
          locale: i18nStore.getState().language,
        }) as Record<string, unknown>)
      : null,
  };
}

async function pullLegacyProfile(userId: string) {
  const client = getSupabaseClient();
  if (!client) return { profile: null, schedule: null };
  const { data, error } = await client
    .from('profiles')
    .select('data')
    .eq('id', userId)
    .single();
  if (error || !data?.data) return { profile: null, schedule: null };
  return {
    profile:
      data.data.profile && typeof data.data.profile === 'object'
        ? (normalizeProfileState(cloneJson(data.data.profile)) as Record<string, unknown>)
        : null,
    schedule:
      data.data.schedule && typeof data.data.schedule === 'object'
        ? (normalizeScheduleState(cloneJson(data.data.schedule), {
            locale: i18nStore.getState().language,
          }) as Record<string, unknown>)
        : null,
  };
}

async function pullWorkouts(userId: string, fallbackWorkouts: WorkoutRecord[]) {
  const client = getSupabaseClient();
  if (!client) return fallbackWorkouts;
  const { data, error } = await client
    .from('workouts')
    .select('payload,deleted_at,performed_at')
    .eq('user_id', userId)
    .order('performed_at', { ascending: true });
  if (error || !Array.isArray(data)) return fallbackWorkouts;
  const workouts = normalizeWorkoutRecords(
    data
      .filter((row) => !row.deleted_at && row.payload && typeof row.payload === 'object')
      .map((row) => row.payload)
  );
  return workouts.length ? workouts : fallbackWorkouts;
}

async function pushProfileDocuments(userId: string, docKeys: string[]) {
  const client = getSupabaseClient();
  if (!client) return false;
  const state = syncSnapshot();
  const rows = docKeys.map((docKey) => ({
    user_id: userId,
    doc_key: docKey,
    payload: profileDocPayload(docKey, state.profile, state.schedule),
    client_updated_at: new Date().toISOString(),
  }));
  const docsResult = await client
    .from('profile_documents')
    .upsert(rows, { onConflict: 'user_id,doc_key' });
  const blobResult = await client.from('profiles').upsert({
    id: userId,
    data: {
      profile: profileDocPayload(PROFILE_CORE_DOC_KEY, state.profile, state.schedule),
      schedule: profileDocPayload(SCHEDULE_DOC_KEY, state.profile, state.schedule),
    },
    updated_at: new Date().toISOString(),
  });
  return !docsResult.error || !blobResult.error;
}

async function pushWorkouts(userId: string) {
  const client = getSupabaseClient();
  if (!client) return;
  const rows = syncSnapshot().workouts.map((workout) => ({
    user_id: userId,
    client_workout_id: String(workout.id || ''),
    program_id: String(workout.program || workout.type || '').trim() || null,
    type: String(workout.type || 'training'),
    subtype: workout.subtype || null,
    performed_at: workout.date,
    payload: workout,
    deleted_at: null,
  }));
  if (rows.length) {
    await client.from('workouts').upsert(rows, {
      onConflict: 'user_id,client_workout_id',
    });
  }
  const { data } = await client
    .from('workouts')
    .select('client_workout_id,deleted_at')
    .eq('user_id', userId);
  const knownIds = new Set(rows.map((row) => String(row.client_workout_id)));
  const staleIds = (Array.isArray(data) ? data : [])
    .filter((row) => !row.deleted_at && !knownIds.has(String(row.client_workout_id)))
    .map((row) => String(row.client_workout_id));
  if (staleIds.length) {
    await client
      .from('workouts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('client_workout_id', staleIds);
  }
}

export const dataStore: StoreApi<DataStoreState> = createStore<DataStoreState>(
  (set, get) => ({
    currentUser: null,
    workouts: [],
    schedule: createDefaultSchedule(),
    profile: createDefaultProfile(),
    activeWorkout: null,
    restDuration: 120,
    restEndsAt: 0,
    restSecondsLeft: 0,
    restTotal: 0,
    cloudSyncEnabled: true,
    syncStatus: { state: 'idle', updatedAt: null },
    activeWorkoutDraft: null,
    refreshSnapshot: () => syncSnapshot(),
    loadData: async (options) => {
      clearLegacyCachesOnce();
      const userId = getScopedUserId(options?.userId);
      const localProfile =
        readJson<Record<string, unknown>>(getLocalCacheKey(LOCAL_KEYS.profile, userId)) ||
        createDefaultProfile();
      const localSchedule =
        readJson<Record<string, unknown>>(getLocalCacheKey(LOCAL_KEYS.schedule, userId)) ||
        createDefaultSchedule();
      const localWorkouts = normalizeWorkoutRecords(
        readJson(getLocalCacheKey(LOCAL_KEYS.workouts, userId)) || []
      );
      const localDraft =
        readJson<Record<string, unknown>>(getLocalCacheKey(LOCAL_KEYS.activeWorkout, userId)) ||
        null;

      let profile = normalizeProfileState(cloneJson(localProfile)) as Record<string, unknown>;
      let schedule = normalizeScheduleState(cloneJson(localSchedule), {
        locale: i18nStore.getState().language,
      }) as Record<string, unknown>;
      let workouts = localWorkouts;

      set((state) => ({
        ...state,
        cloudSyncEnabled: options?.allowCloudSync !== false,
      }));

      if (options?.allowCloudSync !== false && userId) {
        setSyncStatus('syncing');
        const docs = await pullProfileDocs(userId);
        const blob = docs.profile || docs.schedule ? { profile: null, schedule: null } : await pullLegacyProfile(userId);
        if (docs.profile || blob.profile) {
          profile = (docs.profile || blob.profile) as Record<string, unknown>;
        }
        if (docs.schedule || blob.schedule) {
          schedule = (docs.schedule || blob.schedule) as Record<string, unknown>;
        }
        workouts = await pullWorkouts(userId, workouts);
        setSyncStatus('synced');
      }

      const activeWorkout = normalizeActiveWorkout(localDraft?.activeWorkout || null);
      const restDuration = Number(localDraft?.restDuration || profile.defaultRest || 120);
      const restEndsAt = Number(localDraft?.restEndsAt || 0);
      const restSecondsLeft = Number(localDraft?.restSecondsLeft || 0);
      const restTotal = Number(localDraft?.restTotal || 0);

      set((state) => ({
        ...state,
        workouts,
        profile,
        schedule,
        activeWorkout,
        activeWorkoutDraft: activeWorkout ? cloneJson(localDraft) : null,
        restDuration,
        restEndsAt,
        restSecondsLeft,
        restTotal,
      }));
      persistLocalSnapshot(userId);
      restartRestTimer();
    },
    saveWorkouts: async () => {
      const userId = getScopedUserId();
      persistLocalSnapshot(userId);
      if (!get().cloudSyncEnabled || !userId) return;
      setSyncStatus('syncing');
      await pushWorkouts(userId);
      setSyncStatus('synced');
    },
    saveScheduleData: async () => {
      const userId = getScopedUserId();
      persistLocalSnapshot(userId);
      if (!get().cloudSyncEnabled || !userId) return;
      setSyncStatus('syncing');
      await pushProfileDocuments(userId, [SCHEDULE_DOC_KEY]);
      setSyncStatus('synced');
    },
    saveProfileData: async (options) => {
      const userId = getScopedUserId();
      persistLocalSnapshot(userId);
      if (!get().cloudSyncEnabled || !userId) return;
      setSyncStatus('syncing');
      await pushProfileDocuments(userId, [
        PROFILE_CORE_DOC_KEY,
        ...((options?.programIds || []).map((programId) => profileDocKey(programId))),
      ]);
      setSyncStatus('synced');
    },
    replaceWorkouts: async (workouts) => {
      set((state) => ({
        ...state,
        workouts: normalizeWorkoutRecords(workouts),
      }));
      await get().saveWorkouts();
    },
    deleteWorkoutById: async (workoutId) => {
      const normalizedId = String(workoutId || '');
      set((state) => ({
        ...state,
        workouts: state.workouts.filter(
          (workout) => String(workout.id || '') !== normalizedId
        ),
      }));
      await get().saveWorkouts();
    },
    setCurrentUser: (user) => {
      set((state) => ({
        ...state,
        currentUser: cloneJson(user),
      }));
    },
    setProfileState: async (profile) => {
      set((state) => ({
        ...state,
        profile: normalizeProfileState(cloneJson(profile || createDefaultProfile())) as Record<
          string,
          unknown
        >,
      }));
      await get().saveProfileData();
    },
    setScheduleState: async (schedule) => {
      set((state) => ({
        ...state,
        schedule: normalizeScheduleState(cloneJson(schedule || createDefaultSchedule()), {
          locale: i18nStore.getState().language,
        }) as Record<string, unknown>,
      }));
      await get().saveScheduleData();
    },
    updateProfileState: async (patch) => {
      const next = normalizeProfileState({
        ...(cloneJson(get().profile || createDefaultProfile()) as Record<string, unknown>),
        ...(patch || {}),
      }) as Record<string, unknown>;
      set((state) => ({
        ...state,
        profile: next,
      }));
      await get().saveProfileData();
      return next;
    },
    updateScheduleState: async (patch) => {
      const next = normalizeScheduleState(
        {
          ...(cloneJson(get().schedule || createDefaultSchedule()) as Record<string, unknown>),
          ...(patch || {}),
        },
        { locale: i18nStore.getState().language }
      ) as Record<string, unknown>;
      set((state) => ({
        ...state,
        schedule: next,
      }));
      await get().saveScheduleData();
      return next;
    },
    updateProgramState: async (programId, programState) => {
      const current =
        (cloneJson(get().profile || createDefaultProfile()) as Record<string, unknown>) || {};
      const programs =
        current.programs && typeof current.programs === 'object'
          ? (current.programs as Record<string, unknown>)
          : {};
      current.programs = {
        ...programs,
        [programId]: cloneJson(programState),
      };
      set((state) => ({
        ...state,
        profile: normalizeProfileState(current) as Record<string, unknown>,
      }));
      await get().saveProfileData({ programIds: [programId] });
    },
    setActiveWorkoutState: (activeWorkout, options) => {
      const nextDraft = activeWorkout
        ? {
            activeWorkout: cloneJson(activeWorkout),
            restDuration: Number(options?.restDuration ?? get().restDuration ?? 120),
            restEndsAt: Number(options?.restEndsAt || 0),
            restSecondsLeft: Number(options?.restSecondsLeft || 0),
            restTotal: Number(options?.restTotal || 0),
          }
        : null;
      set((state) => ({
        ...state,
        activeWorkout: activeWorkout ? cloneJson(activeWorkout) : null,
        activeWorkoutDraft: nextDraft,
        restDuration: Number(options?.restDuration ?? state.restDuration ?? 120),
        restEndsAt: Number(options?.restEndsAt || 0),
        restSecondsLeft: Number(options?.restSecondsLeft || 0),
        restTotal: Number(options?.restTotal || 0),
      }));
      persistLocalSnapshot();
      restartRestTimer();
    },
    clearLocalDataCache: () => {
      const userId = getScopedUserId();
      removeKey(getLocalCacheKey(LOCAL_KEYS.workouts, userId));
      removeKey(getLocalCacheKey(LOCAL_KEYS.profile, userId));
      removeKey(getLocalCacheKey(LOCAL_KEYS.schedule, userId));
      removeKey(getLocalCacheKey(LOCAL_KEYS.activeWorkout, userId));
    },
    getLocalCacheKey,
    getActiveWorkoutDraftCache: () => cloneJson(get().activeWorkoutDraft),
    logout: async () => {
      return await getRuntimeWindow()?.__IRONFORGE_AUTH_RUNTIME__?.logout?.();
    },
  })
);

dataStoreRef = dataStore;

export function installDataStore() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => setSyncStatus('idle'));
  window.addEventListener('offline', () => setSyncStatus('offline'));
}

export async function applyAuthSessionToDataStore(session: Session | null) {
  const user = (session?.user as unknown as Record<string, unknown> | null) || null;
  dataStore.getState().setCurrentUser(user);
  if (user?.id) {
    await dataStore.getState().loadData({
      allowCloudSync: true,
      userId: String(user.id),
    });
    return;
  }
  if (restTimerInterval !== null && typeof window !== 'undefined') {
    window.clearInterval(restTimerInterval);
    restTimerInterval = null;
  }
  dataStore.setState((state) => ({
    ...state,
    currentUser: null,
    workouts: [],
    profile: createDefaultProfile(),
    schedule: createDefaultSchedule(),
    activeWorkout: null,
    activeWorkoutDraft: null,
    restEndsAt: 0,
    restSecondsLeft: 0,
    restTotal: 0,
    syncStatus: { state: 'idle', updatedAt: new Date().toISOString() },
  }));
}

export function reportAuthSessionError(error: unknown) {
  console.error('[Ironforge] auth session error', error);
}

export function getDataStateSnapshot() {
  return dataStore.getState().refreshSnapshot();
}
