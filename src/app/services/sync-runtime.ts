import { PROFILE_DOCUMENT_KEYS } from '../../domain/config';
import {
  buildStateFromProfileDocuments,
  getAllProfileDocumentKeys,
  programIdFromDocKey,
  resolveProfileSaveDocKeys,
  toProfileDocumentRows,
  uniqueDocKeys,
  type BuildStateFromProfileDocumentsInput,
  type ProfileDocumentRow,
} from './profile-documents';

type MutableRecord = Record<string, unknown>;

type RealtimeChannelLike = {
  on: (
    event: string,
    filter: Record<string, unknown>,
    callback: () => void
  ) => RealtimeChannelLike;
  subscribe: () => unknown;
};

type SupabaseResultLike = {
  data?: unknown;
  error?: unknown;
};

type SupabaseFilterLike = {
  eq?: (column: string, value: unknown) => SupabaseFilterLike;
  order?: (column: string, options?: Record<string, unknown>) => Promise<unknown>;
};

type SupabaseTableLike = {
  select?: (columns: string) => SupabaseFilterLike;
};

type SupabaseClientLike = {
  from?: (table: string) => SupabaseTableLike;
  rpc?: (fn: string, args?: Record<string, unknown>) => Promise<unknown>;
  channel?: (name: string) => RealtimeChannelLike;
  removeChannel?: (channel: unknown) => void;
};

type SyncRuntimeState = {
  currentUser: MutableRecord | null;
  workouts: Array<Record<string, unknown>>;
  schedule: MutableRecord | null;
  profile: MutableRecord | null;
  activeWorkout: MutableRecord | null;
  cloudSyncEnabled: boolean;
};

type SyncCloudPullResult = {
  usedCloud: boolean;
  usedDocs: boolean;
  requiresBootstrapFinalize: boolean;
};

type SyncProfileDocumentPullResult = {
  usedDocs: boolean;
  supported: boolean;
};

type SyncProfileDocumentWriteResult = {
  ok: boolean;
  appliedDocKeys: string[];
  staleDocKeys: string[];
  rows: Array<Record<string, unknown>>;
};

type SyncRuntimeDeps = {
  readState: () => SyncRuntimeState;
  writeState: (partial: Partial<SyncRuntimeState>) => void;
  setCloudSyncEnabled: (value: boolean) => void;
  setRestDuration: (value: number) => void;
  loadLocalData: (options?: Record<string, unknown>) => boolean;
  pullWorkoutsFromTable: (
    fallbackWorkouts?: Array<Record<string, unknown>>
  ) => Promise<{
    usedTable: boolean;
    didBackfill: boolean;
    workouts?: Array<Record<string, unknown>>;
  }>;
  bootstrapProfileRuntimeState: (input?: Record<string, unknown>) => {
    profile: MutableRecord;
    schedule: MutableRecord;
    workouts: Array<Record<string, unknown>>;
    changed: {
      profile: boolean;
      schedule: boolean;
      workouts: boolean;
    };
  };
  setLanguage?: (language?: string) => string;
  getDefaultLanguage?: () => string;
  restoreActiveWorkoutDraft?: (
    draft?: Record<string, unknown> | null,
    options?: Record<string, unknown>
  ) => boolean;
  getActiveWorkoutDraftCache: () => Record<string, unknown> | null;
  clearActiveWorkoutDraft: () => void;
  saveWorkouts: () => Promise<void>;
  upsertWorkoutRecords: (
    items?: Array<Record<string, unknown>>,
    options?: Record<string, unknown>
  ) => Promise<void>;
  buildExerciseIndex: () => void;
  applyTranslations?: () => void;
  renderSyncStatus: () => void;
  updateDashboard: () => void;
  maybeOpenOnboarding?: () => void;
  isCloudSyncEnabled: () => boolean;
  isBrowserOffline: () => boolean;
  setSyncStatus: (state: string) => void;
  getProfileDocumentsSupported: () => boolean | null;
  setProfileDocumentsSupported: (value: boolean | null) => void;
  persistLocalProfileCache: () => void;
  persistLocalScheduleCache: () => void;
  persistLocalWorkoutsCache: () => void;
  refreshSyncedUI: (options?: Record<string, unknown>) => void;
  markDocKeysDirty: (docKeys: string[]) => void;
  clearDocKeysDirty: (docKeys: string[]) => void;
  getDirtyDocKeys: () => string[];
  getPendingBackfillDocKeys: () => string[];
  markPendingBackfillDocKeys: (docKeys: string[]) => void;
  clearPendingBackfillDocKeys: (docKeys?: string[]) => void;
  getPendingWorkoutUpsertIds?: () => string[];
  getPendingWorkoutDeleteIds?: () => string[];
  replayPendingWorkoutSync?: (options?: Record<string, unknown>) => Promise<boolean>;
  recordCloudSyncSuccess?: () => void;
  runCloudSyncHealthCheck?: (
    options?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  updateServerDocStamp: (docKey: string, updatedAt?: string | null) => void;
  isDocKeyDirty: (docKey: string) => boolean;
  runSupabaseWrite: (
    operationPromise: Promise<unknown>,
    context: string,
    options?: Record<string, unknown>
  ) => Promise<{ ok: boolean; error?: unknown; data?: unknown }>;
  logWarn?: (context: string, error: unknown) => void;
  supabaseClient?: SupabaseClientLike | null;
};

type SyncRuntimeApi = {
  resolveProfileSaveDocKeys: (
    options?: Record<string, unknown>,
    deps?: SyncRuntimeDeps
  ) => string[];
  buildStateFromProfileDocuments: (
    input?: BuildStateFromProfileDocumentsInput,
    deps?: SyncRuntimeDeps
  ) => ReturnType<typeof buildStateFromProfileDocuments>;
  saveScheduleData: (
    options?: Record<string, unknown>,
    deps?: SyncRuntimeDeps
  ) => Promise<void>;
  saveProfileData: (
    options?: Record<string, unknown>,
    deps?: SyncRuntimeDeps
  ) => Promise<void>;
  upsertProfileDocuments: (
    docKeys?: string[],
    profileLike?: MutableRecord | null,
    scheduleLike?: MutableRecord | null,
    options?: Record<string, unknown>,
    deps?: SyncRuntimeDeps
  ) => Promise<SyncProfileDocumentWriteResult>;
  pullProfileDocuments: (
    options?: Record<string, unknown>,
    deps?: SyncRuntimeDeps
  ) => Promise<SyncProfileDocumentPullResult>;
  loadData: (options?: Record<string, unknown>, deps?: SyncRuntimeDeps) => Promise<void>;
  pushToCloud: (options?: Record<string, unknown>, deps?: SyncRuntimeDeps) => Promise<boolean>;
  flushPendingCloudSync: (deps?: SyncRuntimeDeps) => Promise<boolean>;
  pullFromCloud: (
    options?: Record<string, unknown>,
    deps?: SyncRuntimeDeps
  ) => Promise<SyncCloudPullResult>;
  resolveStaleProfileDocumentRejects: (
    staleDocKeys?: string[],
    deps?: SyncRuntimeDeps
  ) => Promise<boolean>;
  teardownRealtimeSync: (deps?: SyncRuntimeDeps) => void;
  applyRealtimeSync: (
    reason?: string,
    deps?: SyncRuntimeDeps
  ) => Promise<void>;
  scheduleRealtimeSync: (reason?: string, deps?: SyncRuntimeDeps) => void;
  setupRealtimeSync: (deps?: SyncRuntimeDeps) => void;
};

type SyncRuntimeWindow = Window & {
  __IRONFORGE_SYNC_RUNTIME__?: SyncRuntimeApi;
};

let syncRealtimeChannel: unknown = null;
let realtimeSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isApplyingRemoteSync = false;

function getRuntimeWindow(): SyncRuntimeWindow | null {
  if (typeof window === 'undefined') return null;
  return window as SyncRuntimeWindow;
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function getState(deps?: SyncRuntimeDeps) {
  return deps?.readState() || {
    currentUser: null,
    workouts: [],
    schedule: null,
    profile: null,
    activeWorkout: null,
    cloudSyncEnabled: true,
  };
}

function ensureProfileSyncMeta(profileLike?: MutableRecord | null) {
  const target = profileLike && typeof profileLike === 'object' ? profileLike : {};
  if (!target.syncMeta || typeof target.syncMeta !== 'object') {
    target.syncMeta = {};
  }
  return target.syncMeta as MutableRecord;
}

function ensureProgramSyncMeta(profileLike?: MutableRecord | null) {
  const syncMeta = ensureProfileSyncMeta(profileLike);
  if (!syncMeta.programUpdatedAt || typeof syncMeta.programUpdatedAt !== 'object') {
    syncMeta.programUpdatedAt = {};
  }
  return syncMeta.programUpdatedAt as MutableRecord;
}

function touchSectionSync(profileLike: MutableRecord, syncKey: string) {
  ensureProfileSyncMeta(profileLike)[syncKey] = new Date().toISOString();
}

function touchProgramSync(profileLike: MutableRecord, programId: string) {
  if (!programId) return;
  ensureProgramSyncMeta(profileLike)[programId] = new Date().toISOString();
}

function getSupabaseResultError(result: unknown) {
  return result && typeof result === 'object' && 'error' in result
    ? ((result as SupabaseResultLike).error ?? null)
    : null;
}

function getBootstrapBackfillDocKeys(input: {
  previousProfile?: MutableRecord | null;
  previousSchedule?: MutableRecord | null;
  nextProfile?: MutableRecord | null;
  nextSchedule?: MutableRecord | null;
  profileChanged?: boolean;
  scheduleChanged?: boolean;
}) {
  const docKeys: string[] = [];
  if (input.profileChanged) {
    docKeys.push(
      ...getAllProfileDocumentKeys(input.nextProfile).filter(
        (docKey) => docKey !== PROFILE_DOCUMENT_KEYS.schedule
      )
    );
  }
  if (
    input.scheduleChanged ||
    JSON.stringify(input.previousSchedule || null) !==
      JSON.stringify(input.nextSchedule || null)
  ) {
    docKeys.push(PROFILE_DOCUMENT_KEYS.schedule);
  }
  return uniqueDocKeys(docKeys);
}

async function queueBootstrapBackfill(
  docKeys: string[],
  deps?: SyncRuntimeDeps
) {
  if (!deps || !docKeys.length) return;
  const scheduleDocRequested = docKeys.includes(PROFILE_DOCUMENT_KEYS.schedule);
  const profileDocKeys = docKeys.filter(
    (docKey) => docKey !== PROFILE_DOCUMENT_KEYS.schedule
  );
  const programIds = profileDocKeys
    .map((docKey) => programIdFromDocKey(docKey))
    .filter(Boolean) as string[];

  if (scheduleDocRequested) {
    await saveScheduleDataInternal({ touchSync: true, push: false }, deps);
  }
  if (profileDocKeys.length) {
    await saveProfileDataInternal(
      {
        docKeys: profileDocKeys,
        programIds,
        touchSync: true,
        push: false,
      },
      deps
    );
  }
  deps.markPendingBackfillDocKeys(docKeys);
}

function buildStateFromProfileDocumentsInternal(
  input?: BuildStateFromProfileDocumentsInput,
  deps?: SyncRuntimeDeps
) {
  const state = getState(deps);
  return buildStateFromProfileDocuments({
    ...input,
    currentSchedule: state.schedule,
    isDocKeyDirty: deps?.isDocKeyDirty,
    bootstrapProfileRuntimeState:
      input?.bootstrapProfileRuntimeState || deps?.bootstrapProfileRuntimeState || (() => ({
        profile: {},
        schedule: {},
        workouts: [],
      })),
  });
}

async function upsertProfileDocumentsInternal(
  docKeys?: string[],
  profileLike?: MutableRecord | null,
  scheduleLike?: MutableRecord | null,
  options?: Record<string, unknown>,
  deps?: SyncRuntimeDeps
): Promise<SyncProfileDocumentWriteResult> {
  const state = getState(deps);
  if (!deps || !state.currentUser || !deps.isCloudSyncEnabled()) {
    return { ok: false, appliedDocKeys: [], staleDocKeys: [], rows: [] };
  }
  const supabase = deps.supabaseClient;
  if (typeof supabase?.rpc !== 'function') {
    deps.setProfileDocumentsSupported(false);
    return { ok: false, appliedDocKeys: [], staleDocKeys: [], rows: [] };
  }

  const rows = toProfileDocumentRows({
    docKeys,
    profileLike,
    scheduleLike,
    defaultLanguage: deps.getDefaultLanguage?.(),
  });
  if (!rows.length) {
    return { ok: true, appliedDocKeys: [], staleDocKeys: [], rows: [] };
  }

  const result = await deps.runSupabaseWrite(
    supabase.rpc('upsert_profile_documents_if_newer', {
      _docs: rows,
    }),
    'Failed to upsert profile documents',
    options
  );
  deps.setProfileDocumentsSupported(result.ok);
  if (!result.ok) {
    return { ok: false, appliedDocKeys: [], staleDocKeys: [], rows: [] };
  }

  const returnedRows = Array.isArray(result.data)
    ? (result.data as Array<Record<string, unknown>>)
    : [];
  const rowsByKey = new Map(
    returnedRows.map((row) => [String(row?.doc_key || ''), row])
  );
  const appliedDocKeys: string[] = [];
  const staleDocKeys: string[] = [];

  rows.forEach((row) => {
    const serverRow = rowsByKey.get(String(row.doc_key || ''));
    if (serverRow) {
      deps.updateServerDocStamp(
        String(serverRow.doc_key || ''),
        String(serverRow.updated_at || '') || null
      );
    }
    if (!serverRow || serverRow.applied === false) {
      staleDocKeys.push(row.doc_key);
      return;
    }
    appliedDocKeys.push(row.doc_key);
  });

  deps.clearDocKeysDirty(appliedDocKeys);
  deps.clearPendingBackfillDocKeys(appliedDocKeys);
  return {
    ok: true,
    appliedDocKeys,
    staleDocKeys,
    rows: returnedRows,
  };
}

async function pullProfileDocumentsInternal(
  options?: Record<string, unknown>,
  deps?: SyncRuntimeDeps
): Promise<SyncProfileDocumentPullResult> {
  const state = getState(deps);
  if (!deps || !state.currentUser || !deps.isCloudSyncEnabled()) {
    return { usedDocs: false, supported: false };
  }
  const supabase = deps.supabaseClient;
  if (typeof supabase?.from !== 'function') {
    deps.setProfileDocumentsSupported(false);
    return { usedDocs: false, supported: false };
  }

  try {
    const table = supabase.from('profile_documents');
    const result = (await (table
      .select?.('doc_key,payload,client_updated_at,updated_at')
      .eq?.('user_id', state.currentUser.id))) as SupabaseResultLike;
    const error = getSupabaseResultError(result);
    if (error) {
      if (deps.getProfileDocumentsSupported() !== false) {
        deps.logWarn?.('Failed to pull profile documents', error);
      }
      deps.setProfileDocumentsSupported(false);
      return { usedDocs: false, supported: false };
    }

    deps.setProfileDocumentsSupported(true);
    const rows = Array.isArray(result.data)
      ? (result.data as ProfileDocumentRow[])
      : [];
    if (!rows.length) {
      return { usedDocs: false, supported: true };
    }

    const next = buildStateFromProfileDocumentsInternal(
      {
        rows,
        fallbackProfile: (options?.legacyProfile as MutableRecord | null) || state.profile,
        fallbackSchedule:
          (options?.legacySchedule as MutableRecord | null) || state.schedule,
        workoutItems: state.workouts,
      },
      deps
    );
    deps.writeState({
      profile: cloneJson(next.profile),
      schedule: cloneJson(next.schedule),
    });

    rows.forEach((row) => {
      deps.updateServerDocStamp(
        String(row?.doc_key || ''),
        String(row?.updated_at || '') || null
      );
    });

    const desiredDocKeys = getAllProfileDocumentKeys(next.profile);
    const missingDocKeys = desiredDocKeys.filter(
      (docKey) => !next.rowsByKey.has(docKey)
    );
    if (missingDocKeys.length) {
      await upsertProfileDocumentsInternal(
        missingDocKeys,
        next.profile,
        next.schedule,
        { notifyUser: false },
        deps
      );
    }

    return { usedDocs: true, supported: true };
  } catch (error) {
    if (deps.getProfileDocumentsSupported() !== false) {
      deps.logWarn?.('Failed to pull profile documents', error);
    }
    deps.setProfileDocumentsSupported(false);
    return { usedDocs: false, supported: false };
  }
}

async function saveScheduleDataInternal(
  options?: Record<string, unknown>,
  deps?: SyncRuntimeDeps
) {
  if (!deps) return;
  const state = getState(deps);
  const opts = options || {};
  const nextProfile = cloneJson(state.profile || {}) || {};
  if (opts.touchSync !== false) {
    touchSectionSync(nextProfile, 'scheduleUpdatedAt');
  }
  deps.writeState({ profile: nextProfile });
  deps.markDocKeysDirty([PROFILE_DOCUMENT_KEYS.schedule]);
  deps.persistLocalScheduleCache();
  deps.persistLocalProfileCache();
  if (opts.push !== false && deps.isCloudSyncEnabled()) {
    await pushToCloudInternal({ docKeys: [PROFILE_DOCUMENT_KEYS.schedule] }, deps);
  }
}

async function saveProfileDataInternal(
  options?: Record<string, unknown>,
  deps?: SyncRuntimeDeps
) {
  if (!deps) return;
  const state = getState(deps);
  const opts = options || {};
  const nextProfile = cloneJson(state.profile || {}) || {};
  const docKeys = resolveProfileSaveDocKeys(
    nextProfile,
    opts as Record<string, unknown>
  );
  if (opts.touchSync !== false) {
    if (Array.isArray(opts.programIds) && opts.programIds.length) {
      opts.programIds.forEach((programId) =>
        touchProgramSync(nextProfile, String(programId || ''))
      );
      touchSectionSync(nextProfile, 'profileUpdatedAt');
    } else {
      touchSectionSync(nextProfile, 'profileUpdatedAt');
    }
  }
  deps.writeState({ profile: nextProfile });
  deps.markDocKeysDirty(docKeys);
  deps.persistLocalProfileCache();
  if (opts.push !== false && deps.isCloudSyncEnabled()) {
    await pushToCloudInternal({ docKeys }, deps);
  }
}

async function pullFromCloudInternal(
  _options?: Record<string, unknown>,
  deps?: SyncRuntimeDeps
): Promise<SyncCloudPullResult> {
  if (!deps) {
    return {
      usedCloud: false,
      usedDocs: false,
      requiresBootstrapFinalize: false,
    };
  }
  const state = getState(deps);
  if (!state.currentUser || !deps.isCloudSyncEnabled()) {
    return {
      usedCloud: false,
      usedDocs: false,
      requiresBootstrapFinalize: false,
    };
  }

  deps.setSyncStatus('syncing');
  const docsResult = await pullProfileDocumentsInternal(undefined, deps);
  if (docsResult.usedDocs) {
    deps.recordCloudSyncSuccess?.();
    deps.setSyncStatus('synced');
    return {
      usedCloud: true,
      usedDocs: true,
      requiresBootstrapFinalize: false,
    };
  }

  deps.setSyncStatus(
    deps.isBrowserOffline()
      ? 'offline'
      : docsResult.supported === false
        ? 'error'
        : 'synced'
  );
  if (docsResult.supported !== false && !deps.isBrowserOffline()) {
    deps.recordCloudSyncSuccess?.();
  }
  return {
    usedCloud: false,
    usedDocs: false,
    requiresBootstrapFinalize: false,
  };
}

async function resolveStaleProfileDocumentRejectsInternal(
  staleDocKeys?: string[],
  deps?: SyncRuntimeDeps
) {
  if (!deps) return false;
  const nextStaleDocKeys = uniqueDocKeys(staleDocKeys || []);
  const state = getState(deps);
  if (
    !nextStaleDocKeys.length ||
    !state.currentUser ||
    !deps.isCloudSyncEnabled() ||
    isApplyingRemoteSync
  ) {
    return false;
  }

  deps.clearDocKeysDirty(nextStaleDocKeys);
  const beforeProfile = JSON.stringify(state.profile || {});
  const beforeSchedule = JSON.stringify(state.schedule || {});
  const pullResult = await pullFromCloudInternal(undefined, deps);
  const nextState = getState(deps);
  const changed =
    beforeProfile !== JSON.stringify(nextState.profile || {}) ||
    beforeSchedule !== JSON.stringify(nextState.schedule || {});
  if (pullResult.usedCloud && changed) {
    deps.persistLocalProfileCache();
    deps.persistLocalScheduleCache();
    deps.refreshSyncedUI({ toast: false });
  }
  return pullResult.usedCloud === true;
}

async function pushToCloudInternal(
  options?: Record<string, unknown>,
  deps?: SyncRuntimeDeps
) {
  if (!deps) return false;
  const state = getState(deps);
  if (!state.currentUser || !deps.isCloudSyncEnabled() || isApplyingRemoteSync) {
    return false;
  }
  if (deps.isBrowserOffline()) {
    deps.setSyncStatus('offline');
    return false;
  }

  const opts = options || {};
  const requestedDocKeys =
    (Array.isArray(opts.docKeys) ? (opts.docKeys as string[]) : null) ||
    getAllProfileDocumentKeys(state.profile);
  const docKeys = uniqueDocKeys([
    ...requestedDocKeys,
    ...(deps.getPendingBackfillDocKeys?.() || []),
  ]);
  deps.setSyncStatus('syncing');
  const writeResult = await upsertProfileDocumentsInternal(
    docKeys,
    state.profile,
    state.schedule,
    { notifyUser: false },
    deps
  );
  if (!writeResult.ok) {
    deps.setSyncStatus('error');
    return false;
  }

  let resolvedStaleRejects = true;
  if (writeResult.staleDocKeys.length) {
    resolvedStaleRejects = await resolveStaleProfileDocumentRejectsInternal(
      writeResult.staleDocKeys,
      deps
    );
  }
  deps.setSyncStatus(resolvedStaleRejects ? 'synced' : 'error');
  return true;
}

async function flushPendingCloudSyncInternal(deps?: SyncRuntimeDeps) {
  if (!deps) return false;
  const state = getState(deps);
  if (!state.currentUser || !deps.isCloudSyncEnabled() || isApplyingRemoteSync) {
    return false;
  }
  if (deps.isBrowserOffline()) {
    deps.setSyncStatus('offline');
    return false;
  }
  const dirtyDocKeys = deps.getDirtyDocKeys();
  const docKeys = uniqueDocKeys([
    ...dirtyDocKeys,
    ...(deps.getPendingBackfillDocKeys?.() || []),
  ]);
  let ok = true;
  if (docKeys.length) {
    ok = (await pushToCloudInternal({ docKeys }, deps)) && ok;
  }
  const pendingWorkoutCount =
    (deps.getPendingWorkoutUpsertIds?.() || []).length +
    (deps.getPendingWorkoutDeleteIds?.() || []).length;
  if (pendingWorkoutCount && typeof deps.replayPendingWorkoutSync === 'function') {
    ok = (await deps.replayPendingWorkoutSync({ notifyUser: false })) && ok;
  }
  if (ok) deps.recordCloudSyncSuccess?.();
  return ok;
}

async function loadDataInternal(
  options?: Record<string, unknown>,
  deps?: SyncRuntimeDeps
) {
  if (!deps) return;
  const opts = options || {};
  const allowCloudSync = opts.allowCloudSync !== false;
  deps.setCloudSyncEnabled(allowCloudSync);

  const stateBeforeLoad = getState(deps);
  deps.loadLocalData({
    userId:
      (typeof opts.userId === 'string' ? opts.userId : '') ||
      String(stateBeforeLoad.currentUser?.id || '').trim(),
    allowLegacyFallback: true,
  });

  const cloudResult = allowCloudSync
    ? await pullFromCloudInternal(undefined, deps)
    : { usedCloud: false, usedDocs: false, requiresBootstrapFinalize: false };
  const stateAfterCloud = getState(deps);
  const tableResult = allowCloudSync
    ? await deps.pullWorkoutsFromTable(stateAfterCloud.workouts)
    : { usedTable: false, didBackfill: false };
  const gotCloud = cloudResult.usedCloud === true;
  const gotWorkoutTable =
    tableResult.usedTable === true || tableResult.didBackfill === true;
  if (gotWorkoutTable && Array.isArray(tableResult.workouts)) {
    deps.writeState({ workouts: cloneJson(tableResult.workouts) });
  }
  if (gotCloud || gotWorkoutTable) {
    deps.persistLocalWorkoutsCache();
    deps.persistLocalScheduleCache();
    deps.persistLocalProfileCache();
  }

  const preBootstrapState = getState(deps);
  const bootstrapResult = deps.bootstrapProfileRuntimeState({
    profile: preBootstrapState.profile,
    schedule: preBootstrapState.schedule,
    workouts: preBootstrapState.workouts,
  });
  const nextProfile = cloneJson(bootstrapResult.profile);
  if (typeof deps.setLanguage === 'function') {
    nextProfile.language = deps.setLanguage(String(nextProfile.language || ''));
  }
  deps.writeState({
    profile: nextProfile,
    schedule: cloneJson(bootstrapResult.schedule),
    workouts: cloneJson(bootstrapResult.workouts),
  });
  const bootstrapBackfillDocKeys = getBootstrapBackfillDocKeys({
    previousProfile: preBootstrapState.profile,
    previousSchedule: preBootstrapState.schedule,
    nextProfile,
    nextSchedule: bootstrapResult.schedule,
    profileChanged: bootstrapResult.changed.profile,
    scheduleChanged: bootstrapResult.changed.schedule,
  });

  const postBootstrapState = getState(deps);
  if (
    !postBootstrapState.activeWorkout &&
    typeof deps.restoreActiveWorkoutDraft === 'function'
  ) {
    const restored = deps.restoreActiveWorkoutDraft(
      deps.getActiveWorkoutDraftCache(),
      { toast: false }
    );
    if (!restored) deps.clearActiveWorkoutDraft();
  }

  if (bootstrapResult.changed.workouts) {
    await deps.saveWorkouts();
    const nextState = getState(deps);
    if (nextState.currentUser && deps.isCloudSyncEnabled()) {
      await deps.upsertWorkoutRecords(nextState.workouts);
    }
  }
  if (bootstrapBackfillDocKeys.length) {
    await queueBootstrapBackfill(bootstrapBackfillDocKeys, deps);
    if (
      getState(deps).currentUser &&
      deps.isCloudSyncEnabled() &&
      !deps.isBrowserOffline()
    ) {
      await flushPendingCloudSyncInternal(deps);
    }
  } else {
    if (bootstrapResult.changed.schedule) {
      await saveScheduleDataInternal({ touchSync: true, push: false }, deps);
    }
    if (bootstrapResult.changed.profile) {
      await saveProfileDataInternal({ touchSync: true, push: false }, deps);
    }
  }

  if (
    getState(deps).currentUser &&
    deps.isCloudSyncEnabled() &&
    !deps.isBrowserOffline()
  ) {
    await flushPendingCloudSyncInternal(deps);
  }

  const finalState = getState(deps);
  deps.setRestDuration(Number(finalState.profile?.defaultRest || 120));
  deps.buildExerciseIndex();
  deps.applyTranslations?.();
  deps.renderSyncStatus();
  deps.updateDashboard();
  deps.maybeOpenOnboarding?.();
}

async function applyRealtimeSyncInternal(
  reason?: string,
  deps?: SyncRuntimeDeps
) {
  if (!deps) return;
  const state = getState(deps);
  if (!state.currentUser || !deps.isCloudSyncEnabled() || isApplyingRemoteSync) {
    return;
  }
  if (deps.isBrowserOffline()) {
    deps.setSyncStatus('offline');
    return;
  }

  isApplyingRemoteSync = true;
  try {
    const beforeState = getState(deps);
    const beforeProfile = JSON.stringify(beforeState.profile || {});
    const beforeSchedule = JSON.stringify(beforeState.schedule || {});
    const beforeWorkouts = JSON.stringify(beforeState.workouts || []);

    await pullFromCloudInternal(undefined, deps);
    const pullState = getState(deps);
    const tableResult = await deps.pullWorkoutsFromTable(pullState.workouts);
    if (
      (tableResult.usedTable === true || tableResult.didBackfill === true) &&
      Array.isArray(tableResult.workouts)
    ) {
      deps.writeState({ workouts: cloneJson(tableResult.workouts) });
    }

    const nextState = getState(deps);
    const changed =
      beforeProfile !== JSON.stringify(nextState.profile || {}) ||
      beforeSchedule !== JSON.stringify(nextState.schedule || {}) ||
      beforeWorkouts !== JSON.stringify(nextState.workouts || []);
    if (changed) {
      deps.persistLocalProfileCache();
      deps.persistLocalScheduleCache();
      deps.persistLocalWorkoutsCache();
      deps.refreshSyncedUI({ toast: reason !== 'auth-load' });
    }
  } finally {
    isApplyingRemoteSync = false;
  }
}

function teardownRealtimeSyncInternal(deps?: SyncRuntimeDeps) {
  if (realtimeSyncTimer) {
    clearTimeout(realtimeSyncTimer);
    realtimeSyncTimer = null;
  }
  if (syncRealtimeChannel && deps?.supabaseClient?.removeChannel) {
    deps.supabaseClient.removeChannel(syncRealtimeChannel);
  }
  syncRealtimeChannel = null;
}

function scheduleRealtimeSyncInternal(reason?: string, deps?: SyncRuntimeDeps) {
  if (!deps) return;
  const state = getState(deps);
  if (!state.currentUser || !deps.isCloudSyncEnabled()) return;
  if (deps.isBrowserOffline()) return;
  if (realtimeSyncTimer) clearTimeout(realtimeSyncTimer);
  realtimeSyncTimer = setTimeout(() => {
    void applyRealtimeSyncInternal(reason, deps);
  }, 150);
}

function setupRealtimeSyncInternal(deps?: SyncRuntimeDeps) {
  teardownRealtimeSyncInternal(deps);
  if (!deps) return;
  const state = getState(deps);
  if (
    !state.currentUser ||
    !deps.isCloudSyncEnabled() ||
    deps.isBrowserOffline() ||
    typeof deps.supabaseClient?.channel !== 'function'
  ) {
    return;
  }

  syncRealtimeChannel = deps.supabaseClient
    .channel(`ironforge-sync-${String(state.currentUser.id || '')}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'workouts',
        filter: `user_id=eq.${String(state.currentUser.id || '')}`,
      },
      () => scheduleRealtimeSyncInternal('workouts', deps)
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profile_documents',
        filter: `user_id=eq.${String(state.currentUser.id || '')}`,
      },
      () => scheduleRealtimeSyncInternal('profile-documents', deps)
    )
    .subscribe();
}

export function installSyncRuntimeBridge() {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  if (runtimeWindow.__IRONFORGE_SYNC_RUNTIME__) {
    return runtimeWindow.__IRONFORGE_SYNC_RUNTIME__;
  }

  const api: SyncRuntimeApi = {
    resolveProfileSaveDocKeys: (options, deps) =>
      resolveProfileSaveDocKeys(getState(deps).profile, options || {}),
    buildStateFromProfileDocuments: (input, deps) =>
      buildStateFromProfileDocumentsInternal(input, deps),
    saveScheduleData: (options, deps) => saveScheduleDataInternal(options, deps),
    saveProfileData: (options, deps) => saveProfileDataInternal(options, deps),
    upsertProfileDocuments: (docKeys, profileLike, scheduleLike, options, deps) =>
      upsertProfileDocumentsInternal(docKeys, profileLike, scheduleLike, options, deps),
    pullProfileDocuments: (options, deps) =>
      pullProfileDocumentsInternal(options, deps),
    loadData: (options, deps) => loadDataInternal(options, deps),
    pushToCloud: (options, deps) => pushToCloudInternal(options, deps),
    flushPendingCloudSync: (deps) => flushPendingCloudSyncInternal(deps),
    pullFromCloud: (options, deps) => pullFromCloudInternal(options, deps),
    resolveStaleProfileDocumentRejects: (staleDocKeys, deps) =>
      resolveStaleProfileDocumentRejectsInternal(staleDocKeys, deps),
    teardownRealtimeSync: (deps) => teardownRealtimeSyncInternal(deps),
    applyRealtimeSync: (reason, deps) => applyRealtimeSyncInternal(reason, deps),
    scheduleRealtimeSync: (reason, deps) =>
      scheduleRealtimeSyncInternal(reason, deps),
    setupRealtimeSync: (deps) => setupRealtimeSyncInternal(deps),
  };

  runtimeWindow.__IRONFORGE_SYNC_RUNTIME__ =
    api as unknown as NonNullable<SyncRuntimeWindow['__IRONFORGE_SYNC_RUNTIME__']>;
  return api;
}
