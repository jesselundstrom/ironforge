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
  refreshSnapshot: () => { profile: Profile | null; schedule: SportSchedule | null };
  setProfile: (profile: Record<string, unknown> | null) => Promise<Profile | null>;
  setSchedule: (
    schedule: Record<string, unknown> | null
  ) => Promise<SportSchedule | null>;
  updateProfile: (patch: Record<string, unknown>) => Promise<Profile | null>;
  updateSchedule: (patch: Record<string, unknown>) => Promise<SportSchedule | null>;
};

let profileStoreRef: StoreApi<ProfileStoreState> | null = null;
let unsubscribeDataStore: (() => void) | null = null;

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeProfileForStore(profileLike: Record<string, unknown> | null) {
  if (!profileLike || typeof profileLike !== 'object') return null;
  return normalizeProfileState(cloneJson(profileLike)) as Profile;
}

function normalizeScheduleForStore(scheduleLike: Record<string, unknown> | null) {
  if (!scheduleLike || typeof scheduleLike !== 'object') return null;
  return normalizeScheduleState(cloneJson(scheduleLike), {
    locale: 'en',
  }) as SportSchedule;
}

function syncStoreFromDataStore() {
  const snapshot = {
    profile: normalizeProfileForStore(
      dataStore.getState().profile as Record<string, unknown> | null
    ),
    schedule: normalizeScheduleForStore(
      dataStore.getState().schedule as Record<string, unknown> | null
    ),
  };
  profileStoreRef?.setState((state) => ({
    ...state,
    ...snapshot,
  }));
  return snapshot;
}

export const profileStore: StoreApi<ProfileStoreState> =
  createStore<ProfileStoreState>((set) => ({
    profile: normalizeProfileForStore(dataStore.getState().profile),
    schedule: normalizeScheduleForStore(dataStore.getState().schedule),
    refreshSnapshot: () => syncStoreFromDataStore(),
    setProfile: async (profile) => {
      await dataStore.getState().setProfileState(profile);
      const next = normalizeProfileForStore(dataStore.getState().profile);
      set((state) => ({
        ...state,
        profile: next,
      }));
      return next;
    },
    setSchedule: async (schedule) => {
      await dataStore.getState().setScheduleState(schedule);
      const next = normalizeScheduleForStore(dataStore.getState().schedule);
      set((state) => ({
        ...state,
        schedule: next,
      }));
      return next;
    },
    updateProfile: async (patch) => {
      const next = await dataStore.getState().updateProfileState(patch);
      const normalized = normalizeProfileForStore(next);
      set((state) => ({
        ...state,
        profile: normalized,
      }));
      return normalized;
    },
    updateSchedule: async (patch) => {
      const next = await dataStore.getState().updateScheduleState(patch);
      const normalized = normalizeScheduleForStore(next);
      set((state) => ({
        ...state,
        schedule: normalized,
      }));
      return normalized;
    },
  }));

profileStoreRef = profileStore;

export function installProfileStore() {
  syncStoreFromDataStore();
  unsubscribeDataStore?.();
  unsubscribeDataStore = dataStore.subscribe(() => {
    syncStoreFromDataStore();
  });
}

export function getProfileStateSnapshot() {
  return profileStore.getState().refreshSnapshot();
}
