import { IS_E2E_TEST_ENV } from '../utils/env';
import { dataStore } from '../../stores/data-store';
import { i18nStore } from '../../stores/i18n-store';
import { programStore } from '../../stores/program-store';
import { profileStore } from '../../stores/profile-store';
import { workoutStore } from '../../stores/workout-store';
import type { WorkoutRecord } from '../../domain/types';
import {
  buildPlanningContext,
  getTodayTrainingDecision,
} from '../../domain/planning';
import {
  normalizeBodyMetrics,
  normalizeTrainingPreferences,
} from '../../domain/normalizers';
import { useRuntimeStore } from '../store/runtime-store';
import { navigateToPage } from './navigation-actions';

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function inferDurationSignal(durationSeconds: unknown) {
  const seconds = Number(durationSeconds || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds >= 75 * 60 ? 'too_long' : 'on_target';
}

export function installTestStoresBridge() {
  if (typeof window === 'undefined' || !IS_E2E_TEST_ENV) return;
  const testWindow = window as Window & {
    __IRONFORGE_STORES__?: Record<string, unknown>;
    __IRONFORGE_E2E__?: Record<string, unknown>;
    __IRONFORGE_SET_AUTH_STATE__?: (partial: {
      phase?: 'booting' | 'signed_out' | 'signed_in';
      isLoggedIn?: boolean;
      pendingAction?: 'sign_in' | 'sign_up' | 'sign_out' | null;
      message?: string;
      messageTone?: '' | 'info' | 'error';
    }) => void;
    __IRONFORGE_SET_AUTH_LOGGED_IN__?: (isLoggedIn: boolean) => void;
    __IRONFORGE_APP_SHELL_READY__?: boolean;
    loadData?: (options?: { allowCloudSync?: boolean; userId?: string }) => Promise<void>;
    currentUser?: Record<string, unknown> | null;
    workouts?: Array<Record<string, unknown>>;
    profile?: Record<string, unknown> | null;
    schedule?: Record<string, unknown> | null;
    getActivePageName?: () => string;
  };
  if (testWindow.__IRONFORGE_STORES__) return;

  const syncWindowState = () => {
    const data = dataStore.getState();
    testWindow.currentUser = cloneJson(data.currentUser || null);
    testWindow.workouts = cloneJson((data.workouts || []) as Array<Record<string, unknown>>);
    testWindow.profile = cloneJson(data.profile || null);
    testWindow.schedule = cloneJson(data.schedule || null);
  };

  testWindow.__IRONFORGE_SET_AUTH_STATE__ = (partial) =>
    useRuntimeStore.getState().setAuthState(partial);
  testWindow.__IRONFORGE_SET_AUTH_LOGGED_IN__ = (isLoggedIn) =>
    useRuntimeStore.getState().setAuthLoggedIn(isLoggedIn);
  testWindow.loadData = (options) => dataStore.getState().loadData(options);
  testWindow.getActivePageName = () =>
    useRuntimeStore.getState().navigation.activePage;
  testWindow.__IRONFORGE_APP_SHELL_READY__ = true;
  syncWindowState();
  dataStore.subscribe(() => {
    syncWindowState();
  });

  testWindow.__IRONFORGE_STORES__ = {
    data: {
      getState: () => dataStore.getState(),
      getActiveWorkoutDraftCache: () =>
        dataStore.getState().getActiveWorkoutDraftCache(),
    },
    workout: {
      getState: () => workoutStore.getState(),
      startWorkout: (selectedOption?: string) =>
        workoutStore.getState().startWorkout(selectedOption),
      resumeActiveWorkoutUI: () => workoutStore.getState().resumeActiveWorkoutUI(),
      updateRestDuration: (nextValue?: string | number | null) =>
        workoutStore.getState().updateRestDuration(nextValue),
      addExerciseByName: (name: string) =>
        workoutStore.getState().addExerciseByName(name),
      applySetRIR: (
        exerciseIndex: number,
        setIndex: number,
        rirValue: string | number
      ) => workoutStore.getState().applySetRIR(exerciseIndex, setIndex, rirValue),
      toggleSet: (exerciseIndex: number, setIndex: number) =>
        workoutStore.getState().toggleSet(exerciseIndex, setIndex),
      updateSet: (
        exerciseIndex: number,
        setIndex: number,
        field: string,
        value: string | number
      ) => workoutStore.getState().updateSet(exerciseIndex, setIndex, field, value),
      addSet: (exerciseIndex: number) => workoutStore.getState().addSet(exerciseIndex),
      finishWorkout: () => workoutStore.getState().finishWorkout(),
      cancelWorkout: () => workoutStore.getState().cancelWorkout(),
    },
    runtime: {
      getState: () => useRuntimeStore.getState(),
    },
  };

  testWindow.__IRONFORGE_E2E__ = {
    app: {
      loadData: (options?: { allowCloudSync?: boolean; userId?: string }) =>
        Promise.resolve(dataStore.getState().loadData(options)),
      navigateToPage: (page: string) => {
        if (
          page === 'dashboard' ||
          page === 'log' ||
          page === 'history' ||
          page === 'settings'
        ) {
          navigateToPage(page);
        }
      },
      setCurrentUser: (user: Record<string, unknown> | null) => {
        dataStore.getState().setCurrentUser(cloneJson(user || null));
        useRuntimeStore.getState().setAuthLoggedIn(!!user);
        syncWindowState();
      },
      getSeedSnapshot: () => {
        const currentData = dataStore.getState();
        return {
          workouts: cloneJson(currentData.workouts || []),
          profile: cloneJson(currentData.profile || null),
          schedule: cloneJson(currentData.schedule || null),
        };
      },
      seedData: async (snapshot?: {
        workouts?: Array<Record<string, unknown>>;
        profile?: Record<string, unknown> | null;
        schedule?: Record<string, unknown> | null;
      }) => {
        const next = snapshot || {};
        const userId =
          String(dataStore.getState().currentUser?.id || window.__IRONFORGE_TEST_USER_ID__ || '').trim() ||
          'e2e-user';
        const getKey = (baseKey: string) =>
          dataStore.getState().getLocalCacheKey(baseKey, userId);
        const writeJson = (key: string, value: unknown) => {
          if (value === undefined) {
            localStorage.removeItem(key);
            return;
          }
          localStorage.setItem(key, JSON.stringify(value));
        };

        if (next.workouts) {
          writeJson(getKey('if2_workouts'), next.workouts);
        }
        if (next.profile) {
          writeJson(getKey('if2_profile'), next.profile);
        }
        if (next.schedule) {
          writeJson(getKey('if2_schedule'), next.schedule);
        }

        await dataStore.getState().loadData({
          allowCloudSync: false,
          userId,
        });
        syncWindowState();
      },
    },
    settings: {
      openTab: (tab: string) => {
        if (
          tab === 'schedule' ||
          tab === 'preferences' ||
          tab === 'program' ||
          tab === 'account' ||
          tab === 'body'
        ) {
          navigateToPage('settings');
          useRuntimeStore.getState().setActiveSettingsTab(tab);
        }
      },
      openProgramTab: async (
        programId = 'forge',
        programState?: Record<string, unknown> | null
      ) => {
        const currentProfile =
          (profileStore.getState().profile || {}) as Record<string, unknown>;
        const currentPrograms =
          currentProfile.programs && typeof currentProfile.programs === 'object'
            ? (currentProfile.programs as Record<string, unknown>)
            : {};
        await profileStore.getState().updateProfile({
          activeProgram: programId,
          programs: {
            ...currentPrograms,
            [programId]:
              cloneJson(programState) ||
              cloneJson(programStore.getState().getProgramInitialState(programId)) ||
              {},
          },
        });
        navigateToPage('settings');
        useRuntimeStore.getState().setActiveSettingsTab('program');
      },
      openBodyTab: async (bodyMetrics?: Record<string, unknown> | null) => {
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
        await profileStore.getState().setProfile(nextProfile);
        navigateToPage('settings');
        useRuntimeStore.getState().setActiveSettingsTab('body');
      },
      openPreferencesTab: async (options?: {
        preferences?: Record<string, unknown> | null;
        defaultRest?: number | string | null;
      }) => {
        const currentProfile =
          (cloneJson(dataStore.getState().profile) as Record<string, unknown> | null) || {};
        const currentPreferences =
          currentProfile.preferences && typeof currentProfile.preferences === 'object'
            ? (currentProfile.preferences as Record<string, unknown>)
            : {};
        const nextProfile: Record<string, unknown> = {
          ...currentProfile,
          preferences: normalizeTrainingPreferences({
            ...currentProfile,
            preferences: {
              ...currentPreferences,
              ...((cloneJson(options?.preferences) as Record<string, unknown> | null) || {}),
            },
          }),
        };
        if (options?.defaultRest !== undefined) {
          nextProfile.defaultRest = options.defaultRest;
        }
        await profileStore.getState().setProfile(nextProfile);
        navigateToPage('settings');
        useRuntimeStore.getState().setActiveSettingsTab('preferences');
      },
    },
    program: {
      getById: (programId: string) =>
        (programStore.getState().getProgramById(programId) as Record<string, unknown> | null) ||
        null,
      getInitialState: (programId: string) =>
        cloneJson(programStore.getState().getProgramInitialState(programId)) || null,
    },
    planning: {
      getTodayDecision: () => {
        const context = buildPlanningContext({
          workouts: dataStore.getState().workouts as WorkoutRecord[],
          profile: (dataStore.getState().profile as Record<string, unknown> | null) || null,
          schedule:
            (dataStore.getState().schedule as Record<string, unknown> | null) || null,
          activeProgram:
            (programStore.getState().activeProgram as Record<string, unknown> | null) ||
            null,
          activeProgramState: programStore.getState().activeProgramState,
        });
        return cloneJson(getTodayTrainingDecision(context));
      },
    },
    i18n: {
      setLanguage: (locale: string, options?: { persist?: boolean; notify?: boolean }) =>
        i18nStore.getState().setLanguage(locale, options),
    },
    profile: {
      update: (patch: Record<string, unknown>) => profileStore.getState().updateProfile(patch),
      setSportReadinessCheckEnabled: (enabled: boolean) =>
        profileStore.getState().updateProfile({
          preferences: {
            ...(profileStore.getState().profile?.preferences || {}),
            sportReadinessCheckEnabled: enabled === true,
          },
        }),
    },
    workout: {
      completeSession: async (options?: {
        feedback?: string | null;
        notes?: string | null;
        durationSignal?: string | null;
        inferDurationSignal?: boolean;
      }) => {
        const finishedWorkout = await workoutStore.getState().finishWorkout();
        if (!finishedWorkout) return null;

        const nextWorkout = cloneJson(finishedWorkout) as Record<string, unknown>;
        if (typeof options?.feedback === 'string') {
          nextWorkout.sessionFeedback = options.feedback;
        }
        if (typeof options?.notes === 'string') {
          nextWorkout.sessionNotes = options.notes;
        }

        const durationSignal =
          options?.durationSignal !== undefined
            ? options.durationSignal
            : options?.inferDurationSignal
              ? inferDurationSignal(nextWorkout.duration)
              : undefined;

        if (durationSignal !== undefined) {
          nextWorkout.durationSignal = durationSignal;
        }

        const workouts = cloneJson(dataStore.getState().workouts || []);
        const nextWorkouts = workouts.map((workout) =>
          String(workout?.id || '') === String(nextWorkout.id || '')
            ? nextWorkout
            : workout
        );

        await dataStore.getState().replaceWorkouts(
          nextWorkouts as WorkoutRecord[]
        );
        syncWindowState();
        return nextWorkout;
      },
    },
  };
}
