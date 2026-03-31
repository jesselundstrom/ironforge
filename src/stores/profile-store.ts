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
  setProfile: (profile: Record<string, unknown> | null) => Profile | null;
  setSchedule: (schedule: Record<string, unknown> | null) => SportSchedule | null;
  updateProfile: (patch: Record<string, unknown>) => Profile | null;
  updateSchedule: (patch: Record<string, unknown>) => SportSchedule | null;
};

type ProfileWindow = Window & {
  profile?: Record<string, unknown> | null;
  schedule?: Record<string, unknown> | null;
  syncSettingsBridge?: () => void;
  getCanonicalProgramId?: (programId?: string | null) => string | null;
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

function writeBackToLegacy(
  profile: Profile | null,
  schedule: SportSchedule | null
) {
  const runtimeWindow = getProfileWindow();
  if (!runtimeWindow) return;
  runtimeWindow.profile = cloneJson(profile);
  runtimeWindow.schedule = cloneJson(schedule);
  dataStore.getState().syncFromLegacy();
  runtimeWindow.syncSettingsBridge?.();
}

export const profileStore: StoreApi<ProfileStoreState> =
  createStore<ProfileStoreState>((set) => ({
    profile: normalizeProfileForStore(dataStore.getState().profile),
    schedule: normalizeScheduleForStore(dataStore.getState().schedule),
    syncFromDataStore: () => syncStoreFromDataStore(),
    setProfile: (profile) => {
      const nextProfile = normalizeProfileForStore(profile);
      const currentSchedule =
        profileStoreRef?.getState().schedule ||
        normalizeScheduleForStore(dataStore.getState().schedule);
      set((state) => ({
        ...state,
        profile: nextProfile,
      }));
      writeBackToLegacy(nextProfile, currentSchedule);
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
      writeBackToLegacy(currentProfile, nextSchedule);
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
      writeBackToLegacy(nextProfile, currentSchedule);
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
      writeBackToLegacy(currentProfile, nextSchedule);
      return nextSchedule;
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
}

export function disposeLegacyProfileStoreBridge() {
  unsubscribeDataStore?.();
  unsubscribeDataStore = null;
  bridgeInstalled = false;
}

export function getProfileStateSnapshot() {
  return profileStore.getState().syncFromDataStore();
}
