import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { LOCAL_CACHE_KEYS } from '../domain/config';
import type { SyncStatus } from '../domain/types';

type LegacyLoadDataOptions = {
  allowCloudSync?: boolean;
  userId?: string;
  allowLegacyFallback?: boolean;
};

type LegacyDataStoreState = {
  currentUser: Record<string, unknown> | null;
  workouts: Array<Record<string, unknown>>;
  schedule: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  activeWorkout: Record<string, unknown> | null;
  restDuration: number;
  restEndsAt: number;
  restSecondsLeft: number;
  cloudSyncEnabled: boolean;
  syncStatus: SyncStatus;
  activeWorkoutDraft: Record<string, unknown> | null;
  syncFromLegacy: () => LegacyDataSnapshot;
  loadData: (options?: LegacyLoadDataOptions) => Promise<void>;
  clearLocalDataCache: (options?: Record<string, unknown>) => void;
  getLocalCacheKey: (baseKey: string, userId?: string) => string;
  getActiveWorkoutDraftCache: () => Record<string, unknown> | null;
  loginWithEmail: () => Promise<unknown>;
  signUpWithEmail: () => Promise<unknown>;
  logout: () => Promise<unknown>;
};

type LegacyDataSnapshot = Omit<
  LegacyDataStoreState,
  | 'syncFromLegacy'
  | 'loadData'
  | 'clearLocalDataCache'
  | 'getLocalCacheKey'
  | 'getActiveWorkoutDraftCache'
  | 'loginWithEmail'
  | 'signUpWithEmail'
  | 'logout'
>;

type LegacyDataWindow = Window & {
  __IRONFORGE_AUTH_RUNTIME__?: {
    loginWithEmail?: () => Promise<unknown> | unknown;
    signUpWithEmail?: () => Promise<unknown> | unknown;
    logout?: () => Promise<unknown> | unknown;
  };
  currentUser?: Record<string, unknown> | null;
  workouts?: Array<Record<string, unknown>>;
  schedule?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  activeWorkout?: Record<string, unknown> | null;
  restDuration?: number;
  restEndsAt?: number;
  restSecondsLeft?: number;
  __IRONFORGE_TEST_USER_ID__?: string;
  loadData?: (options?: LegacyLoadDataOptions) => Promise<void> | void;
  clearLocalDataCache?: (options?: Record<string, unknown>) => void;
  getLocalCacheKey?: (baseKey: string, userId?: string) => string;
  getActiveWorkoutDraftCache?: () => Record<string, unknown> | null;
  loginWithEmail?: () => Promise<unknown> | unknown;
  signUpWithEmail?: () => Promise<unknown> | unknown;
  logout?: () => Promise<unknown> | unknown;
  saveWorkouts?: (...args: unknown[]) => Promise<unknown> | unknown;
  saveScheduleData?: (...args: unknown[]) => Promise<unknown> | unknown;
  saveProfileData?: (...args: unknown[]) => Promise<unknown> | unknown;
  clearActiveWorkoutDraft?: (...args: unknown[]) => unknown;
  persistActiveWorkoutDraft?: (...args: unknown[]) => unknown;
  __IRONFORGE_GET_LEGACY_RUNTIME_STATE__?: () => {
    currentUser?: Record<string, unknown> | null;
    workouts?: Array<Record<string, unknown>>;
    schedule?: Record<string, unknown> | null;
    profile?: Record<string, unknown> | null;
    activeWorkout?: Record<string, unknown> | null;
  };
};

const WRAPPED_MARK = '__ironforgeDataStoreWrapped';
let bridgeInstalled = false;
let dataStoreRef: StoreApi<LegacyDataStoreState> | null = null;

function getLegacyWindow(): LegacyDataWindow | null {
  if (typeof window === 'undefined') return null;
  return window as unknown as LegacyDataWindow;
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function getScopedUserId(explicitUserId?: string) {
  const runtimeWindow = getLegacyWindow();
  const raw =
    explicitUserId ||
    String(runtimeWindow?.currentUser?.id || '').trim() ||
    String(runtimeWindow?.__IRONFORGE_TEST_USER_ID__ || '').trim();
  return String(raw || '').trim();
}

function getFallbackLocalCacheKey(baseKey: string, userId?: string) {
  const scopedUserId = getScopedUserId(userId);
  return scopedUserId ? `${baseKey}::${scopedUserId}` : baseKey;
}

function hasWindowProperty(
  target: Record<string, unknown> | null | undefined,
  key: string
) {
  return !!target && Object.prototype.hasOwnProperty.call(target, key);
}

function readLocalCacheJson<T>(key: string): T | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function readPersistedScopedSnapshot(userId?: string) {
  const runtimeWindow = getLegacyWindow();
  const getCacheKey = (baseKey: string) =>
    runtimeWindow?.getLocalCacheKey?.(baseKey, userId) ||
    getFallbackLocalCacheKey(baseKey, userId);

  return {
    workouts:
      readLocalCacheJson<Array<Record<string, unknown>>>(
        getCacheKey(LOCAL_CACHE_KEYS.workouts)
      ) || [],
    profile:
      readLocalCacheJson<Record<string, unknown> | null>(
        getCacheKey(LOCAL_CACHE_KEYS.profile)
      ) || null,
    schedule:
      readLocalCacheJson<Record<string, unknown> | null>(
        getCacheKey(LOCAL_CACHE_KEYS.schedule)
      ) || null,
  };
}

function readLegacySyncStatus(): SyncStatus {
  if (typeof document !== 'undefined') {
    const statusEl = document.getElementById('sync-status');
    const className = String(statusEl?.className || '');
    if (className.includes('syncing')) {
      return { state: 'syncing', updatedAt: new Date().toISOString() };
    }
    if (className.includes('error')) {
      return { state: 'error', updatedAt: new Date().toISOString() };
    }
    if (className.includes('offline')) {
      return { state: 'offline', updatedAt: new Date().toISOString() };
    }
    if (className.includes('synced')) {
      return { state: 'synced', updatedAt: new Date().toISOString() };
    }
  }
  return {
    state:
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'offline'
        : 'idle',
    updatedAt: null,
  };
}

function readLegacySnapshot(
  cloudSyncEnabled = true,
  explicitUserId?: string
): LegacyDataSnapshot {
  const runtimeWindow = getLegacyWindow();
  const runtimeSnapshot = runtimeWindow?.__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || {};
  const persisted = readPersistedScopedSnapshot(explicitUserId);
  return {
    currentUser: cloneJson(
      runtimeSnapshot.currentUser !== undefined
        ? (runtimeSnapshot.currentUser as Record<string, unknown> | null)
        : hasWindowProperty(
              runtimeWindow as unknown as Record<string, unknown> | null,
              'currentUser'
            )
          ? runtimeWindow?.currentUser || null
          : null
    ),
    workouts: cloneJson(
      Array.isArray(runtimeSnapshot.workouts)
        ? runtimeSnapshot.workouts
        : Array.isArray(runtimeWindow?.workouts)
          ? runtimeWindow.workouts
          : persisted.workouts
    ),
    schedule: cloneJson(
      runtimeSnapshot.schedule !== undefined
        ? (runtimeSnapshot.schedule as Record<string, unknown> | null)
        : hasWindowProperty(
              runtimeWindow as unknown as Record<string, unknown> | null,
              'schedule'
            )
          ? runtimeWindow?.schedule || null
          : persisted.schedule
    ),
    profile: cloneJson(
      runtimeSnapshot.profile !== undefined
        ? (runtimeSnapshot.profile as Record<string, unknown> | null)
        : hasWindowProperty(
              runtimeWindow as unknown as Record<string, unknown> | null,
              'profile'
            )
          ? runtimeWindow?.profile || null
          : persisted.profile
    ),
    activeWorkout: cloneJson(
      runtimeSnapshot.activeWorkout !== undefined
        ? (runtimeSnapshot.activeWorkout as Record<string, unknown> | null)
        : runtimeWindow?.activeWorkout || null
    ),
    restDuration: Number(runtimeWindow?.restDuration || 0),
    restEndsAt: Number(runtimeWindow?.restEndsAt || 0),
    restSecondsLeft: Number(runtimeWindow?.restSecondsLeft || 0),
    cloudSyncEnabled,
    syncStatus: readLegacySyncStatus(),
    activeWorkoutDraft: cloneJson(
      runtimeWindow?.getActiveWorkoutDraftCache?.() || null
    ),
  };
}

function syncStoreFromLegacy(explicitUserId?: string) {
  const cloudSyncEnabled = dataStoreRef?.getState().cloudSyncEnabled ?? true;
  const snapshot = readLegacySnapshot(cloudSyncEnabled, explicitUserId);
  dataStoreRef?.setState((state: LegacyDataStoreState) => ({
    ...state,
    ...snapshot,
  }));
  return snapshot;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return !!value && typeof (value as Promise<unknown>).then === 'function';
}

function wrapLegacyMethod(name: keyof LegacyDataWindow) {
  const runtimeWindow = getLegacyWindow();
  const target = runtimeWindow?.[name];
  if (typeof target !== 'function') return;
  if ((target as Record<string, unknown>)[WRAPPED_MARK]) return;

  const wrapped = function (this: unknown, ...args: unknown[]) {
    const result = target.apply(this, args);
    if (isPromiseLike(result)) {
      return result.finally(() => {
        syncStoreFromLegacy();
      });
    }
    syncStoreFromLegacy();
    return result;
  };

  (wrapped as unknown as Record<string, unknown>)[WRAPPED_MARK] = true;
  (runtimeWindow as unknown as Record<string, unknown>)[String(name)] = wrapped;
}

export const dataStore: StoreApi<LegacyDataStoreState> =
  createStore<LegacyDataStoreState>((set) => ({
  ...readLegacySnapshot(true),
  syncFromLegacy: () => syncStoreFromLegacy(),
  loadData: async (options) => {
    const runtimeWindow = getLegacyWindow();
    const allowCloudSync = options?.allowCloudSync !== false;
    set((state: LegacyDataStoreState) => ({
      ...state,
      cloudSyncEnabled: allowCloudSync,
    }));
    await runtimeWindow?.loadData?.(options);
    syncStoreFromLegacy(options?.userId);
  },
  clearLocalDataCache: (options) => {
    getLegacyWindow()?.clearLocalDataCache?.(options);
    syncStoreFromLegacy();
  },
  getLocalCacheKey: (baseKey, userId) => {
    const runtimeWindow = getLegacyWindow();
    return (
      runtimeWindow?.getLocalCacheKey?.(baseKey, userId) ||
      getFallbackLocalCacheKey(baseKey, userId)
    );
  },
  getActiveWorkoutDraftCache: () => {
    return cloneJson(getLegacyWindow()?.getActiveWorkoutDraftCache?.() || null);
  },
  loginWithEmail: async () => {
    const runtimeWindow = getLegacyWindow();
    const result = await (
      runtimeWindow?.__IRONFORGE_AUTH_RUNTIME__?.loginWithEmail ||
      runtimeWindow?.loginWithEmail
    )?.();
    syncStoreFromLegacy();
    return result;
  },
  signUpWithEmail: async () => {
    const runtimeWindow = getLegacyWindow();
    const result = await (
      runtimeWindow?.__IRONFORGE_AUTH_RUNTIME__?.signUpWithEmail ||
      runtimeWindow?.signUpWithEmail
    )?.();
    syncStoreFromLegacy();
    return result;
  },
  logout: async () => {
    const runtimeWindow = getLegacyWindow();
    const result = await (
      runtimeWindow?.__IRONFORGE_AUTH_RUNTIME__?.logout ||
      runtimeWindow?.logout
    )?.();
    syncStoreFromLegacy();
    return result;
  },
}));

dataStoreRef = dataStore;

export function installLegacyDataStoreBridge() {
  if (bridgeInstalled || typeof window === 'undefined') return;
  bridgeInstalled = true;

  syncStoreFromLegacy();
  [
    'loadData',
    'clearLocalDataCache',
    'saveWorkouts',
    'saveScheduleData',
    'saveProfileData',
    'clearActiveWorkoutDraft',
    'persistActiveWorkoutDraft',
    'loginWithEmail',
    'signUpWithEmail',
    'logout',
  ].forEach((name) => wrapLegacyMethod(name as keyof LegacyDataWindow));

  window.addEventListener('online', () => {
    syncStoreFromLegacy();
  });
  window.addEventListener('offline', () => {
    syncStoreFromLegacy();
  });
  window.addEventListener('visibilitychange', () => {
    syncStoreFromLegacy();
  });
}

export function getDataStateSnapshot() {
  return dataStore.getState().syncFromLegacy();
}
