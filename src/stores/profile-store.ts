import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { Profile, SportSchedule } from '../domain/types';
import {
  normalizeProfileState,
  normalizeScheduleState,
} from '../domain/normalizers';
import { dataStore } from './data-store';

type ProfileStoreState = {
  profile: Profile | null;
  schedule: SportSchedule | null;
  syncFromDataStore: () => { profile: Profile | null; schedule: SportSchedule | null };
  hydrateProfileRuntime: (input: {
    profile: Record<string, unknown> | null;
    schedule: Record<string, unknown> | null;
  }) => { profile: Profile | null; schedule: SportSchedule | null };
  setProfile: (profile: Record<string, unknown> | null) => Profile | null;
  setSchedule: (schedule: Record<string, unknown> | null) => SportSchedule | null;
  updateProfile: (patch: Record<string, unknown>) => Profile | null;
  updateSchedule: (patch: Record<string, unknown>) => SportSchedule | null;
  setActiveProgram: (programId: string | null) => string | null;
  setProgramState: (
    programId: string,
    state: Record<string, unknown> | null
  ) => Record<string, unknown> | null;
  updateProgramState: (
    programId: string,
    patchOrUpdater:
      | Record<string, unknown>
      | ((
          current: Record<string, unknown>
        ) => Record<string, unknown> | null)
  ) => Record<string, unknown> | null;
};

type ProfileWindow = Window & {
  profile?: Record<string, unknown> | null;
  schedule?: Record<string, unknown> | null;
  syncSettingsBridge?: () => void;
  getCanonicalProgramId?: (programId?: string | null) => string | null;
  __IRONFORGE_LEGACY_RUNTIME_ACCESS__?: {
    write?: (name: string, value: unknown) => void;
  };
  __IRONFORGE_PROFILE_STORE__?: {
    getState?: () => { profile: Profile | null; schedule: SportSchedule | null };
    hydrateProfileRuntime?: (input: {
      profile: Record<string, unknown> | null;
      schedule: Record<string, unknown> | null;
    }) => { profile: Profile | null; schedule: SportSchedule | null };
    setProfile?: (profile: Record<string, unknown> | null) => Profile | null;
    setSchedule?: (schedule: Record<string, unknown> | null) => SportSchedule | null;
    updateProfile?: (patch: Record<string, unknown>) => Profile | null;
    updateSchedule?: (patch: Record<string, unknown>) => SportSchedule | null;
    setActiveProgram?: (programId: string | null) => string | null;
    setProgramState?: (
      programId: string,
      state: Record<string, unknown> | null
    ) => Record<string, unknown> | null;
    updateProgramState?: (
      programId: string,
      patchOrUpdater:
        | Record<string, unknown>
        | ((
            current: Record<string, unknown>
          ) => Record<string, unknown> | null)
    ) => Record<string, unknown> | null;
  };
};

let bridgeInstalled = false;
let unsubscribeDataStore: (() => void) | null = null;
let profileStoreRef: StoreApi<ProfileStoreState> | null = null;

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function getProfileWindow(): ProfileWindow | null {
  if (typeof window === 'undefined') return null;
  return window as unknown as ProfileWindow;
}

function resolveLocaleFromWindow() {
  if (typeof window === 'undefined') return 'en';
  return window.I18N?.getLanguage?.() || 'en';
}

function normalizeProfileForStore(profileLike: Record<string, unknown> | null) {
  const nextProfile = cloneJson(profileLike || null);
  if (!nextProfile || typeof nextProfile !== 'object') return null;
  const runtimeWindow = getProfileWindow();
  return normalizeProfileState({
    ...nextProfile,
    activeProgram:
      runtimeWindow?.getCanonicalProgramId?.(nextProfile.activeProgram as
        | string
        | null
        | undefined) || nextProfile.activeProgram,
  }) as Profile;
}

function normalizeScheduleForStore(scheduleLike: Record<string, unknown> | null) {
  const nextSchedule = cloneJson(scheduleLike || null);
  if (!nextSchedule || typeof nextSchedule !== 'object') return null;
  return normalizeScheduleState(nextSchedule, {
    locale: resolveLocaleFromWindow(),
  }) as SportSchedule;
}

function syncStoreFromDataStore() {
  const dataState = dataStore.getState();
  const snapshot = {
    profile: normalizeProfileForStore(dataState.profile),
    schedule: normalizeScheduleForStore(dataState.schedule),
  };
  profileStoreRef?.setState((state) => ({
    ...state,
    ...snapshot,
  }));
  return snapshot;
}

function hydrateProfileRuntimeState(input: {
  profile: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
}) {
  const snapshot = {
    profile: normalizeProfileForStore(input.profile),
    schedule: normalizeScheduleForStore(input.schedule),
  };
  profileStoreRef?.setState((state) => ({
    ...state,
    ...snapshot,
  }));
  publishToLegacy(snapshot.profile, snapshot.schedule);
  return snapshot;
}

function syncProfileDataStore(
  profile: Profile | null,
  schedule: SportSchedule | null
) {
  dataStore.setState((state) => ({
    ...state,
    profile: cloneJson(profile),
    schedule: cloneJson(schedule),
  }));
}

function publishToLegacy(
  profile: Profile | null,
  schedule: SportSchedule | null
) {
  const runtimeWindow = getProfileWindow();
  if (!runtimeWindow) return;
  const writeLegacyRuntimeValue =
    typeof runtimeWindow.__IRONFORGE_LEGACY_RUNTIME_ACCESS__?.write === 'function'
      ? runtimeWindow.__IRONFORGE_LEGACY_RUNTIME_ACCESS__.write
      : null;
  if (writeLegacyRuntimeValue) {
    writeLegacyRuntimeValue('profile', cloneJson(profile));
    writeLegacyRuntimeValue('schedule', cloneJson(schedule));
  }
  runtimeWindow.profile = cloneJson(profile);
  runtimeWindow.schedule = cloneJson(schedule);
  syncProfileDataStore(profile, schedule);
  runtimeWindow.syncSettingsBridge?.();
}

export const profileStore: StoreApi<ProfileStoreState> =
  createStore<ProfileStoreState>((set) => ({
    profile: normalizeProfileForStore(dataStore.getState().profile),
    schedule: normalizeScheduleForStore(dataStore.getState().schedule),
    syncFromDataStore: () => syncStoreFromDataStore(),
    hydrateProfileRuntime: (input) => hydrateProfileRuntimeState(input),
    setProfile: (profile) => {
      const nextProfile = normalizeProfileForStore(profile);
      const currentSchedule =
        profileStoreRef?.getState().schedule ||
        normalizeScheduleForStore(dataStore.getState().schedule);
      set((state) => ({
        ...state,
        profile: nextProfile,
      }));
      publishToLegacy(nextProfile, currentSchedule);
      return nextProfile;
    },
    setSchedule: (schedule) => {
      const nextSchedule = normalizeScheduleForStore(schedule);
      const currentProfile =
        profileStoreRef?.getState().profile ||
        normalizeProfileForStore(dataStore.getState().profile);
      set((state) => ({
        ...state,
        schedule: nextSchedule,
      }));
      publishToLegacy(currentProfile, nextSchedule);
      return nextSchedule;
    },
    updateProfile: (patch) => {
      const current = cloneJson(
        profileStoreRef?.getState().profile || dataStore.getState().profile || {}
      ) as Record<string, unknown>;
      const nextProfile = normalizeProfileForStore({
        ...current,
        ...patch,
      });
      const currentSchedule =
        profileStoreRef?.getState().schedule ||
        normalizeScheduleForStore(dataStore.getState().schedule);
      set((state) => ({
        ...state,
        profile: nextProfile,
      }));
      publishToLegacy(nextProfile, currentSchedule);
      return nextProfile;
    },
    updateSchedule: (patch) => {
      const current = cloneJson(
        profileStoreRef?.getState().schedule || dataStore.getState().schedule || {}
      ) as Record<string, unknown>;
      const nextSchedule = normalizeScheduleForStore({
        ...current,
        ...patch,
      });
      const currentProfile =
        profileStoreRef?.getState().profile ||
        normalizeProfileForStore(dataStore.getState().profile);
      set((state) => ({
        ...state,
        schedule: nextSchedule,
      }));
      publishToLegacy(currentProfile, nextSchedule);
      return nextSchedule;
    },
    setActiveProgram: (programId) => {
      const nextProgramId =
        getProfileWindow()?.getCanonicalProgramId?.(programId) ||
        String(programId || '').trim() ||
        null;
      const nextProfile = normalizeProfileForStore({
        ...((profileStoreRef?.getState().profile ||
          dataStore.getState().profile ||
          {}) as Record<string, unknown>),
        activeProgram: nextProgramId,
      });
      const currentSchedule =
        profileStoreRef?.getState().schedule ||
        normalizeScheduleForStore(dataStore.getState().schedule);
      set((state) => ({
        ...state,
        profile: nextProfile,
      }));
      publishToLegacy(nextProfile, currentSchedule);
      return nextProgramId;
    },
    setProgramState: (programId, state) => {
      const canonicalId =
        getProfileWindow()?.getCanonicalProgramId?.(programId) ||
        String(programId || '').trim() ||
        null;
      if (!canonicalId) return null;
      const currentProfile =
        cloneJson(
          profileStoreRef?.getState().profile || dataStore.getState().profile || {}
        ) || {};
      const currentPrograms =
        currentProfile.programs && typeof currentProfile.programs === 'object'
          ? (currentProfile.programs as Record<string, unknown>)
          : {};
      const nextPrograms = {
        ...currentPrograms,
      };
      nextPrograms[canonicalId] = cloneJson(state);
      const nextProfile = normalizeProfileForStore({
        ...currentProfile,
        programs: nextPrograms,
      });
      const currentSchedule =
        profileStoreRef?.getState().schedule ||
        normalizeScheduleForStore(dataStore.getState().schedule);
      const nextState =
        nextProfile?.programs && typeof nextProfile.programs === 'object'
          ? ((nextProfile.programs as Record<string, unknown>)[
              canonicalId
            ] as Record<string, unknown> | null) || null
          : null;
      set((storeState) => ({
        ...storeState,
        profile: nextProfile,
      }));
      publishToLegacy(nextProfile, currentSchedule);
      return cloneJson(nextState);
    },
    updateProgramState: (programId, patchOrUpdater) => {
      const canonicalId =
        getProfileWindow()?.getCanonicalProgramId?.(programId) ||
        String(programId || '').trim() ||
        null;
      if (!canonicalId) return null;
      const currentProfile =
        cloneJson(
          profileStoreRef?.getState().profile || dataStore.getState().profile || {}
        ) || {};
      const currentPrograms =
        currentProfile.programs && typeof currentProfile.programs === 'object'
          ? (currentProfile.programs as Record<string, unknown>)
          : {};
      const currentState = cloneJson(
        (currentPrograms[canonicalId] as Record<string, unknown> | null) || {}
      ) as Record<string, unknown>;
      const nextProgramState =
        typeof patchOrUpdater === 'function'
          ? patchOrUpdater(currentState)
          : {
              ...currentState,
              ...cloneJson(patchOrUpdater || {}),
            };
      return profileStoreRef
        ?.getState()
        .setProgramState(canonicalId, nextProgramState || null) as
        | Record<string, unknown>
        | null;
    },
  }));

profileStoreRef = profileStore;

export function installLegacyProfileStoreBridge() {
  if (bridgeInstalled) return;
  bridgeInstalled = true;
  syncStoreFromDataStore();
  unsubscribeDataStore = dataStore.subscribe(() => {
    syncStoreFromDataStore();
  });
  const runtimeWindow = getProfileWindow();
  if (runtimeWindow) {
    runtimeWindow.__IRONFORGE_PROFILE_STORE__ = {
      getState: () => ({
        profile: cloneJson(profileStore.getState().profile),
        schedule: cloneJson(profileStore.getState().schedule),
      }),
      hydrateProfileRuntime: (input) =>
        profileStore.getState().hydrateProfileRuntime(input),
      setProfile: (profile) => profileStore.getState().setProfile(profile),
      setSchedule: (schedule) => profileStore.getState().setSchedule(schedule),
      updateProfile: (patch) => profileStore.getState().updateProfile(patch),
      updateSchedule: (patch) => profileStore.getState().updateSchedule(patch),
      setActiveProgram: (programId) =>
        profileStore.getState().setActiveProgram(programId),
      setProgramState: (programId, state) =>
        profileStore.getState().setProgramState(programId, state),
      updateProgramState: (programId, patchOrUpdater) =>
        profileStore.getState().updateProgramState(programId, patchOrUpdater),
    };
  }
}

export function disposeLegacyProfileStoreBridge() {
  unsubscribeDataStore?.();
  unsubscribeDataStore = null;
  const runtimeWindow = getProfileWindow();
  if (runtimeWindow) {
    delete runtimeWindow.__IRONFORGE_PROFILE_STORE__;
  }
  bridgeInstalled = false;
}

export function getProfileStateSnapshot() {
  return profileStore.getState().syncFromDataStore();
}
