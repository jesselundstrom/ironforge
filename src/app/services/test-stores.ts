import { IS_E2E_TEST_ENV } from '../utils/env';
import { dataStore } from '../../stores/data-store';
import { i18nStore } from '../../stores/i18n-store';
import { programStore } from '../../stores/program-store';
import { profileStore } from '../../stores/profile-store';
import { workoutStore } from '../../stores/workout-store';
import {
  normalizeBodyMetrics,
  normalizeTrainingPreferences,
} from '../../domain/normalizers';
import { useRuntimeStore } from '../store/runtime-store';
import { navigateToPage } from './navigation-actions';
import { callLegacyWindowFunction } from './legacy-call';
import {
  showRPEPicker,
  showSessionSummary,
  showSportReadinessCheck,
} from './workout-ui-actions';

type TestStoreBridge = {
  data: {
    getState: () => ReturnType<typeof dataStore.getState>;
    getActiveWorkoutDraftCache: () => ReturnType<
      ReturnType<typeof dataStore.getState>['getActiveWorkoutDraftCache']
    >;
  };
  workout: {
    getState: () => ReturnType<typeof workoutStore.getState>;
    startWorkout: () => void;
    resumeActiveWorkoutUI: (options?: Record<string, unknown>) => unknown;
    updateRestDuration: (
      nextValue?: string | number | null
    ) => void;
    addExerciseByName: (name: string) => void;
    applySetRIR: (
      exerciseIndex: number,
      setIndex: number,
      rirValue: string | number
    ) => void;
    toggleSet: (exerciseIndex: number, setIndex: number) => void;
    updateSet: (
      exerciseIndex: number,
      setIndex: number,
      field: string,
      value: string | number
    ) => void;
    addSet: (exerciseIndex: number) => void;
    finishWorkout: () => Promise<unknown> | unknown;
    cancelWorkout: () => void;
  };
  runtime: {
    getState: () => ReturnType<typeof useRuntimeStore.getState>;
  };
  program: {
    getState: () => ReturnType<typeof programStore.getState>;
  };
  profile: {
    getState: () => ReturnType<typeof profileStore.getState>;
    updateProfile: (patch: Record<string, unknown>) => ReturnType<
      ReturnType<typeof profileStore.getState>['updateProfile']
    >;
    setActiveProgram: (programId: string | null) => string | null;
    setProgramState: (
      programId: string,
      state: Record<string, unknown> | null
    ) => Record<string, unknown> | null;
  };
};

type E2EHarness = {
  app: {
    loadData: (
      options?: Parameters<ReturnType<typeof dataStore.getState>['loadData']>[0]
    ) => Promise<void>;
    navigateToPage: (page: string) => void;
    setCurrentUser: (user: Record<string, unknown> | null) => void;
    setLegacyRuntimeState: (partial: Record<string, unknown>) => void;
    getLegacyRuntimeState: () => Record<string, unknown> | null;
    getSeedSnapshot: () => {
      workouts: Array<Record<string, unknown>>;
      profile: Record<string, unknown> | null;
      schedule: Record<string, unknown> | null;
    };
    seedData: (snapshot: {
      workouts?: Array<Record<string, unknown>>;
      profile?: Record<string, unknown> | null;
      schedule?: Record<string, unknown> | null;
    }) => Promise<void>;
  };
  settings: {
    openTab: (tab: string) => void;
    openProgramTab: (
      programId?: string,
      programState?: Record<string, unknown> | null
    ) => void;
    openBodyTab: (bodyMetrics?: Record<string, unknown> | null) => Promise<void>;
    openPreferencesTab: (options?: {
      preferences?: Record<string, unknown> | null;
      defaultRest?: number | string | null;
    }) => Promise<void>;
  };
  program: {
    getState: () => ReturnType<typeof programStore.getState>;
    getById: (programId: string) => Record<string, unknown> | null;
    getInitialState: (programId: string) => Record<string, unknown> | null;
  };
  i18n: {
    setLanguage: (
      locale: string,
      options?: { persist?: boolean; notify?: boolean }
    ) => string;
  };
  profile: {
    update: (patch: Record<string, unknown>) => Record<string, unknown> | null;
    setActiveProgram: (programId: string | null) => string | null;
    setProgramState: (
      programId: string,
      state: Record<string, unknown> | null
    ) => Record<string, unknown> | null;
    setSportReadinessCheckEnabled: (enabled: boolean) => void;
  };
  workout: {
    showRPEPicker: (
      exerciseName: string,
      setNumber: number,
      callback: (value: number | null) => void
    ) => unknown;
    showSportReadinessCheck: (
      callback: (context: Record<string, unknown> | null) => void
    ) => unknown;
    showSessionSummary: (summaryData: Record<string, unknown>) => unknown;
  };
};

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function openSettingsTab(tab: string) {
  const trigger = document.querySelectorAll('.nav-btn')[3] || null;
  callLegacyWindowFunction('initSettings');
  callLegacyWindowFunction('showPage', 'settings', trigger);
  callLegacyWindowFunction('showSettingsTab', tab, trigger);
  callLegacyWindowFunction('syncSettingsBridge');
}

function syncHarnessStores(
  testWindow: Window & {
  __IRONFORGE_APP_RUNTIME__?: {
    syncSettingsBridge?: () => void;
  };
  syncWorkoutSessionBridge?: () => void;
},
  options?: { syncDataFromLegacy?: boolean }
) {
  if (options?.syncDataFromLegacy !== false) {
    dataStore.getState().syncFromLegacy();
  }
  profileStore.getState().syncFromDataStore();
  programStore.getState().syncFromLegacy();
  workoutStore.getState().syncFromLegacy();
  testWindow.__IRONFORGE_APP_RUNTIME__?.syncSettingsBridge?.();
  testWindow.syncWorkoutSessionBridge?.();
}

export function installTestStoresBridge() {
  if (typeof window === 'undefined' || !IS_E2E_TEST_ENV) return;
  const testWindow = window as Window & {
    __IRONFORGE_STORES__?: TestStoreBridge;
    __IRONFORGE_E2E__?: E2EHarness;
    __IRONFORGE_SET_LEGACY_RUNTIME_STATE__?: (
      partial: Record<string, unknown>
    ) => void;
  };
  if (testWindow.__IRONFORGE_STORES__) return;

  testWindow.__IRONFORGE_STORES__ = {
    data: {
      getState: () => dataStore.getState(),
      getActiveWorkoutDraftCache: () =>
        dataStore.getState().getActiveWorkoutDraftCache(),
    },
    workout: {
      getState: () => workoutStore.getState(),
      startWorkout: () => workoutStore.getState().startWorkout(),
      resumeActiveWorkoutUI: (options) =>
        workoutStore.getState().resumeActiveWorkoutUI(options),
      updateRestDuration: (nextValue) =>
        workoutStore.getState().updateRestDuration(nextValue),
      addExerciseByName: (name) =>
        workoutStore.getState().addExerciseByName(name),
      applySetRIR: (exerciseIndex, setIndex, rirValue) =>
        workoutStore.getState().applySetRIR(exerciseIndex, setIndex, rirValue),
      toggleSet: (exerciseIndex, setIndex) =>
        workoutStore.getState().toggleSet(exerciseIndex, setIndex),
      updateSet: (exerciseIndex, setIndex, field, value) =>
        workoutStore.getState().updateSet(exerciseIndex, setIndex, field, value),
      addSet: (exerciseIndex) => workoutStore.getState().addSet(exerciseIndex),
      finishWorkout: () => workoutStore.getState().finishWorkout(),
      cancelWorkout: () => workoutStore.getState().cancelWorkout(),
    },
    runtime: {
      getState: () => useRuntimeStore.getState(),
    },
    program: {
      getState: () => programStore.getState(),
    },
    profile: {
      getState: () => profileStore.getState(),
      updateProfile: (patch) => profileStore.getState().updateProfile(patch),
      setActiveProgram: (programId) =>
        profileStore.getState().setActiveProgram(programId),
      setProgramState: (programId, state) =>
        profileStore.getState().setProgramState(programId, state),
    },
  };

  testWindow.__IRONFORGE_E2E__ = {
    app: {
      loadData: (options) => Promise.resolve(dataStore.getState().loadData(options)),
      navigateToPage: (page) => {
        if (
          page === 'dashboard' ||
          page === 'log' ||
          page === 'history' ||
          page === 'settings' ||
          page === 'nutrition'
        ) {
          navigateToPage(page);
          callLegacyWindowFunction('runPageActivationSideEffects', page);
        }
      },
      setCurrentUser: (user) => {
        testWindow.__IRONFORGE_SET_LEGACY_RUNTIME_STATE__?.({
          currentUser: cloneJson(user || null),
        });
        syncHarnessStores(testWindow);
      },
      setLegacyRuntimeState: (partial) => {
        testWindow.__IRONFORGE_SET_LEGACY_RUNTIME_STATE__?.(cloneJson(partial || {}));
        syncHarnessStores(testWindow);
      },
      getLegacyRuntimeState: () =>
        cloneJson(window.__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || null),
      getSeedSnapshot: () => {
        const currentData = dataStore.getState();
        return {
          workouts: cloneJson(currentData.workouts || []),
          profile: cloneJson(currentData.profile || null),
          schedule: cloneJson(currentData.schedule || null),
        };
      },
      seedData: async (snapshot) => {
        const next = snapshot || {};
        const userId =
          String(window.currentUser?.id || window.__IRONFORGE_TEST_USER_ID__ || '').trim() ||
          'e2e-user';
        const currentData = dataStore.getState();
        const nextWorkouts = Array.isArray(next.workouts)
          ? next.workouts
          : cloneJson(currentData.workouts || []);
        const nextProfile =
          next.profile && typeof next.profile === 'object'
            ? next.profile
            : cloneJson(currentData.profile || {});
        const nextSchedule =
          next.schedule && typeof next.schedule === 'object'
            ? next.schedule
            : cloneJson(currentData.schedule || {});
        const getKey = (baseKey: string) => dataStore.getState().getLocalCacheKey(baseKey, userId);
        const writeJson = (key: string, value: unknown) => {
          if (value === undefined) {
            localStorage.removeItem(key);
            return;
          }
          localStorage.setItem(key, JSON.stringify(value));
        };

        writeJson(getKey('ic_workouts'), nextWorkouts);
        writeJson(getKey('ic_profile'), nextProfile);
        writeJson(getKey('ic_schedule'), nextSchedule);

        await dataStore.getState().loadData({
          allowCloudSync: false,
          allowLegacyFallback: false,
          userId,
        });
        syncHarnessStores(testWindow, { syncDataFromLegacy: false });
      },
    },
    settings: {
      openTab: (tab) => {
        if (
          tab === 'schedule' ||
          tab === 'preferences' ||
          tab === 'program' ||
          tab === 'account' ||
          tab === 'body'
        ) {
          openSettingsTab(tab);
        }
      },
      openProgramTab: (programId = 'forge', programState) => {
        const currentProfile =
          (profileStore.getState().profile || {}) as Record<string, unknown>;
        const currentPrograms =
          currentProfile.programs && typeof currentProfile.programs === 'object'
            ? (currentProfile.programs as Record<string, unknown>)
            : {};
        const seededState =
          cloneJson(programState) ||
          cloneJson(programStore.getState().getProgramInitialState(programId)) ||
          {};
        const nextProfile = {
          ...currentProfile,
          activeProgram: programId,
          programs: {
            ...currentPrograms,
            [programId]: seededState,
          },
        };
        testWindow.__IRONFORGE_SET_LEGACY_RUNTIME_STATE__?.({
          profile: cloneJson(nextProfile),
        });
        syncHarnessStores(testWindow);
        openSettingsTab('program');
      },
      openBodyTab: async (bodyMetrics) => {
        const currentProfile =
          (cloneJson(dataStore.getState().profile) as Record<string, unknown> | null) || {};
        const currentBodyMetrics =
          currentProfile.bodyMetrics && typeof currentProfile.bodyMetrics === 'object'
            ? (currentProfile.bodyMetrics as Record<string, unknown>)
            : {};
        const nextProfile = {
          ...currentProfile,
          bodyMetrics: {
            ...currentBodyMetrics,
            ...(cloneJson(bodyMetrics) || {}),
          },
        };
        normalizeBodyMetrics(nextProfile);
        testWindow.__IRONFORGE_SET_LEGACY_RUNTIME_STATE__?.({
          profile: cloneJson(nextProfile),
        });
        syncHarnessStores(testWindow);
        openSettingsTab('body');
      },
      openPreferencesTab: async (options) => {
        const currentProfile =
          (cloneJson(dataStore.getState().profile) as Record<string, unknown> | null) || {};
        const currentPreferences =
          currentProfile.preferences && typeof currentProfile.preferences === 'object'
            ? (currentProfile.preferences as Record<string, unknown>)
            : {};
        const nextPreferences = normalizeTrainingPreferences({
          ...currentProfile,
          preferences: {
            ...currentPreferences,
            ...((cloneJson(options?.preferences) as Record<string, unknown> | null) || {}),
          },
        });
        const nextProfile: Record<string, unknown> = {
          ...currentProfile,
          preferences: nextPreferences,
        };
        if (options?.defaultRest !== undefined) {
          nextProfile.defaultRest = options.defaultRest;
        }
        testWindow.__IRONFORGE_SET_LEGACY_RUNTIME_STATE__?.({
          profile: cloneJson(nextProfile),
        });
        syncHarnessStores(testWindow);
        openSettingsTab('preferences');
      },
    },
    program: {
      getState: () => cloneJson(programStore.getState()),
      getById: (programId) =>
        (programStore.getState().getProgramById(programId) as Record<string, unknown> | null) ||
        null,
      getInitialState: (programId) =>
        cloneJson(programStore.getState().getProgramInitialState(programId)) || null,
    },
    i18n: {
      setLanguage: (locale, options) => i18nStore.getState().setLanguage(locale, options),
    },
    profile: {
      update: (patch) => profileStore.getState().updateProfile(patch),
      setActiveProgram: (programId) =>
        profileStore.getState().setActiveProgram(programId),
      setProgramState: (programId, state) =>
        profileStore.getState().setProgramState(programId, state),
      setSportReadinessCheckEnabled: (enabled) => {
        openSettingsTab('preferences');
        const checkbox = document.getElementById('training-sport-check');
        if (checkbox instanceof HTMLInputElement) {
          checkbox.checked = enabled === true;
        }
        callLegacyWindowFunction('saveTrainingPreferences');
      },
    },
    workout: {
      showRPEPicker: (exerciseName, setNumber, callback) =>
        showRPEPicker(exerciseName, setNumber, callback),
      showSportReadinessCheck: (callback) => showSportReadinessCheck(callback),
      showSessionSummary: (summaryData) => showSessionSummary(summaryData),
    },
  };
}
