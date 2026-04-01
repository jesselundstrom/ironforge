import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { ActiveWorkout, WorkoutStartSnapshot } from '../domain/types';
import {
  normalizeActiveWorkout,
  normalizeWorkoutStartSnapshot,
} from '../domain/workout-helpers';
import { dataStore } from './data-store';
import { useRuntimeStore } from '../app/store/runtime-store';
import { navigateToPage } from '../app/services/navigation-actions';

type LegacyWorkoutStoreState = {
  activeWorkout: ActiveWorkout | null;
  startSnapshot: WorkoutStartSnapshot | null;
  hasActiveWorkout: boolean;
  restDuration: number;
  restEndsAt: number;
  restSecondsLeft: number;
  syncFromLegacy: () => LegacyWorkoutSnapshot;
  getStartSnapshot: (input?: Record<string, unknown>) => WorkoutStartSnapshot | null;
  getCachedStartSnapshot: () => WorkoutStartSnapshot | null;
  clearStartSnapshot: () => void;
  startWorkout: () => void;
  resumeActiveWorkoutUI: (options?: Record<string, unknown>) => unknown;
  updateRestDuration: (nextValue?: string | number | null) => void;
  startRestTimer: () => void;
  skipRest: () => void;
  addExerciseByName: (name: string) => void;
  selectExerciseCatalogExercise: (exerciseId: string) => void;
  showSetRIRPrompt: (exerciseIndex: number, setIndex: number) => void;
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
  removeExercise: (exerciseIndex: number) => void;
  finishWorkout: () => Promise<unknown> | unknown;
  cancelWorkout: () => void;
};

type LegacyWorkoutSnapshot = Omit<
  LegacyWorkoutStoreState,
  | 'syncFromLegacy'
  | 'getStartSnapshot'
  | 'getCachedStartSnapshot'
  | 'clearStartSnapshot'
  | 'startWorkout'
  | 'resumeActiveWorkoutUI'
  | 'updateRestDuration'
  | 'startRestTimer'
  | 'skipRest'
  | 'addExerciseByName'
  | 'selectExerciseCatalogExercise'
  | 'showSetRIRPrompt'
  | 'applySetRIR'
  | 'toggleSet'
  | 'updateSet'
  | 'addSet'
  | 'removeExercise'
  | 'finishWorkout'
  | 'cancelWorkout'
>;

type LegacyWorkoutWindow = Window & {
  activeWorkout?: Record<string, unknown> | null;
  getLiveWorkoutSessionSnapshot?: () => {
    activeWorkout?: Record<string, unknown> | null;
    restDuration?: number;
    restEndsAt?: number;
    restSecondsLeft?: number;
  } | null;
  getWorkoutStartSnapshot?: (
    input?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  getCachedWorkoutStartSnapshot?: () => Record<string, unknown> | null;
  clearWorkoutStartSnapshot?: () => void;
  startWorkout?: () => void;
  resumeActiveWorkoutUI?: (options?: Record<string, unknown>) => unknown;
  updateRestDuration?: (nextValue?: string | number | null) => void;
  startRestTimer?: () => void;
  skipRest?: () => void;
  addExerciseByName?: (name: string) => void;
  selectExerciseCatalogExercise?: (exerciseId: string) => void;
  showSetRIRPrompt?: (exerciseIndex: number, setIndex: number) => void;
  applySetRIR?: (
    exerciseIndex: number,
    setIndex: number,
    rirValue: string | number
  ) => void;
  toggleSet?: (exerciseIndex: number, setIndex: number) => void;
  updateSet?: (
    exerciseIndex: number,
    setIndex: number,
    field: string,
    value: string | number
  ) => void;
  addSet?: (exerciseIndex: number) => void;
  removeEx?: (exerciseIndex: number) => void;
  finishWorkout?: () => Promise<unknown> | unknown;
  cancelWorkout?: () => void;
  persistActiveWorkoutDraft?: (...args: unknown[]) => unknown;
  clearActiveWorkoutDraft?: (...args: unknown[]) => unknown;
  syncWorkoutSessionBridge?: (...args: unknown[]) => unknown;
  closeCustomModal?: () => void;
  showToast?: (
    message: string,
    color?: string,
    undoAction?: (() => void) | null
  ) => void;
  restDuration?: number;
  restEndsAt?: number;
  restSecondsLeft?: number;
};

const WRAPPED_MARK = '__ironforgeWorkoutStoreWrapped';
const DELEGATOR_MARK = '__ironforgeWorkoutStoreDelegator';
const DELEGATED_WORKOUT_ACTIONS = [
  'startWorkout',
  'resumeActiveWorkoutUI',
  'updateRestDuration',
  'startRestTimer',
  'skipRest',
  'addExerciseByName',
  'selectExerciseCatalogExercise',
  'showSetRIRPrompt',
  'applySetRIR',
  'toggleSet',
  'updateSet',
  'addSet',
  'removeEx',
  'finishWorkout',
  'cancelWorkout',
] as const;

type DelegatedWorkoutActionName = (typeof DELEGATED_WORKOUT_ACTIONS)[number];
type LegacyWorkoutAction = (...args: unknown[]) => unknown;

let bridgeInstalled = false;
let workoutStoreRef: StoreApi<LegacyWorkoutStoreState> | null = null;
let unsubscribeDataStore: (() => void) | null = null;
let unsubscribeRuntimeStore: (() => void) | null = null;
const legacyWorkoutActions: Partial<
  Record<DelegatedWorkoutActionName, LegacyWorkoutAction>
> = {};

function getLegacyWindow(): LegacyWorkoutWindow | null {
  if (typeof window === 'undefined') return null;
  return window as LegacyWorkoutWindow;
}

function readRuntimeWorkoutSession() {
  return useRuntimeStore.getState().workoutSession.session;
}

function getCapturedLegacyAction(
  name: DelegatedWorkoutActionName
): LegacyWorkoutAction | null {
  return legacyWorkoutActions[name] || captureLegacyAction(name) || null;
}

function captureLegacyAction(
  name: DelegatedWorkoutActionName
): LegacyWorkoutAction | null {
  const runtimeWindow = getLegacyWindow();
  const target = runtimeWindow?.[name];
  if (typeof target !== "function") return null;
  if ((target as unknown as Record<string, unknown>)[DELEGATOR_MARK]) {
    return getCapturedLegacyAction(name);
  }
  legacyWorkoutActions[name] = target as LegacyWorkoutAction;
  return legacyWorkoutActions[name] || null;
}

function readSessionNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return !!value && typeof (value as Promise<unknown>).then === 'function';
}

function hasOwnProperty(
  value: unknown,
  key: string
): value is Record<string, unknown> {
  return !!value && Object.prototype.hasOwnProperty.call(value, key);
}

function readLegacyWorkoutSnapshot(): LegacyWorkoutSnapshot {
  const runtimeWindow = getLegacyWindow();
  const runtimeSession = readRuntimeWorkoutSession();
  const liveSession = runtimeWindow?.getLiveWorkoutSessionSnapshot?.() || null;
  const activeWorkout = hasOwnProperty(liveSession, 'activeWorkout')
    ? normalizeActiveWorkout(liveSession.activeWorkout ?? null)
    : normalizeActiveWorkout(runtimeSession.activeWorkout) ||
      normalizeActiveWorkout(runtimeWindow?.activeWorkout) ||
      normalizeActiveWorkout(dataStore.getState().activeWorkout);
  const startSnapshot = normalizeWorkoutStartSnapshot(
    runtimeWindow?.getCachedWorkoutStartSnapshot?.() || null
  );
  return {
    activeWorkout,
    startSnapshot,
    hasActiveWorkout: !!activeWorkout,
    restDuration: readSessionNumber(
      liveSession?.restDuration ?? runtimeSession.restDuration,
      Number(runtimeWindow?.restDuration || 0)
    ),
    restEndsAt: readSessionNumber(
      liveSession?.restEndsAt ?? runtimeSession.restEndsAt,
      Number(runtimeWindow?.restEndsAt || 0)
    ),
    restSecondsLeft: readSessionNumber(
      liveSession?.restSecondsLeft ?? runtimeSession.restSecondsLeft,
      Number(runtimeWindow?.restSecondsLeft || 0)
    ),
  };
}

function syncStoreFromLegacy() {
  const snapshot = readLegacyWorkoutSnapshot();
  workoutStoreRef?.setState((state) => ({
    ...state,
    ...snapshot,
  }));
  return snapshot;
}

function wrapLegacyMethod(name: keyof LegacyWorkoutWindow) {
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

function installStoreDelegator(
  name: keyof LegacyWorkoutWindow,
  delegate: (...args: unknown[]) => unknown
) {
  const runtimeWindow = getLegacyWindow();
  if (!runtimeWindow) return;
  const existing = runtimeWindow[name];
  if (
    typeof existing === 'function' &&
    (existing as Record<string, unknown>)[DELEGATOR_MARK]
  ) {
    return;
  }
  const delegated = function (...args: unknown[]) {
    return delegate(...args);
  };
  (delegated as unknown as Record<string, unknown>)[DELEGATOR_MARK] = true;
  (runtimeWindow as unknown as Record<string, unknown>)[String(name)] =
    delegated;
}

export const workoutStore: StoreApi<LegacyWorkoutStoreState> =
  createStore<LegacyWorkoutStoreState>(() => ({
    ...readLegacyWorkoutSnapshot(),
    syncFromLegacy: () => syncStoreFromLegacy(),
    getStartSnapshot: (input) => {
      const snapshot = normalizeWorkoutStartSnapshot(
        getLegacyWindow()?.getWorkoutStartSnapshot?.(input) || null
      );
      syncStoreFromLegacy();
      return snapshot;
    },
    getCachedStartSnapshot: () => {
      const snapshot = normalizeWorkoutStartSnapshot(
        getLegacyWindow()?.getCachedWorkoutStartSnapshot?.() || null
      );
      syncStoreFromLegacy();
      return snapshot;
    },
    clearStartSnapshot: () => {
      getLegacyWindow()?.clearWorkoutStartSnapshot?.();
      syncStoreFromLegacy();
    },
    startWorkout: () => {
      getCapturedLegacyAction('startWorkout')?.();
      // If the legacy layer set up an active workout, run resumeActiveWorkoutUI to
      // guarantee the React bridge views (logStartView, logActiveView) are updated.
      // beginWorkoutStart may skip its own notify calls if isLogActiveIslandActive()
      // returns false at the time it runs, or if an exception occurs before line 3638.
      if (getLegacyWindow()?.activeWorkout) {
        getCapturedLegacyAction('resumeActiveWorkoutUI')?.({ toast: false });
      }
      syncStoreFromLegacy();
      navigateToPage('log');
    },
    resumeActiveWorkoutUI: (options) => {
      const result = getCapturedLegacyAction('resumeActiveWorkoutUI')?.(options);
      syncStoreFromLegacy();
      return result;
    },
    updateRestDuration: (nextValue) => {
      getCapturedLegacyAction('updateRestDuration')?.(nextValue);
      syncStoreFromLegacy();
    },
    startRestTimer: () => {
      getCapturedLegacyAction('startRestTimer')?.();
      syncStoreFromLegacy();
    },
    skipRest: () => {
      getCapturedLegacyAction('skipRest')?.();
      syncStoreFromLegacy();
    },
    addExerciseByName: (name) => {
      getCapturedLegacyAction('addExerciseByName')?.(name);
      syncStoreFromLegacy();
    },
    selectExerciseCatalogExercise: (exerciseId) => {
      getCapturedLegacyAction('selectExerciseCatalogExercise')?.(exerciseId);
      syncStoreFromLegacy();
    },
    showSetRIRPrompt: (exerciseIndex, setIndex) => {
      getCapturedLegacyAction('showSetRIRPrompt')?.(exerciseIndex, setIndex);
      syncStoreFromLegacy();
    },
    applySetRIR: (exerciseIndex, setIndex, rirValue) => {
      getCapturedLegacyAction('applySetRIR')?.(exerciseIndex, setIndex, rirValue);
      syncStoreFromLegacy();
    },
    toggleSet: (exerciseIndex, setIndex) => {
      getCapturedLegacyAction('toggleSet')?.(exerciseIndex, setIndex);
      syncStoreFromLegacy();
    },
    updateSet: (exerciseIndex, setIndex, field, value) => {
      getCapturedLegacyAction('updateSet')?.(
        exerciseIndex,
        setIndex,
        field,
        value
      );
      syncStoreFromLegacy();
    },
    addSet: (exerciseIndex) => {
      getCapturedLegacyAction('addSet')?.(exerciseIndex);
      syncStoreFromLegacy();
    },
    removeExercise: (exerciseIndex) => {
      getCapturedLegacyAction('removeEx')?.(exerciseIndex);
      syncStoreFromLegacy();
    },
    finishWorkout: () => {
      const result = getCapturedLegacyAction('finishWorkout')?.();
      if (isPromiseLike(result)) {
        return result.finally(() => {
          syncStoreFromLegacy();
        });
      }
      syncStoreFromLegacy();
      return result;
    },
    cancelWorkout: () => {
      getCapturedLegacyAction('cancelWorkout')?.();
      syncStoreFromLegacy();
    },
  }));

workoutStoreRef = workoutStore;

export function installLegacyWorkoutStoreBridge() {
  if (bridgeInstalled || typeof window === 'undefined') return;
  bridgeInstalled = true;

  syncStoreFromLegacy();
  DELEGATED_WORKOUT_ACTIONS.forEach((name) => {
    captureLegacyAction(name);
  });
  unsubscribeDataStore = dataStore.subscribe(() => {
    syncStoreFromLegacy();
  });
  unsubscribeRuntimeStore = useRuntimeStore.subscribe((state, previousState) => {
    if (state.workoutSession.session !== previousState.workoutSession.session) {
      syncStoreFromLegacy();
    }
  });

  [
    'persistActiveWorkoutDraft',
    'clearActiveWorkoutDraft',
    'clearWorkoutStartSnapshot',
  ].forEach((name) => wrapLegacyMethod(name as keyof LegacyWorkoutWindow));

  installStoreDelegator('startWorkout', () =>
    workoutStore.getState().startWorkout()
  );
  installStoreDelegator('resumeActiveWorkoutUI', (options) =>
    workoutStore
      .getState()
      .resumeActiveWorkoutUI(options as Record<string, unknown> | undefined)
  );
  installStoreDelegator('updateRestDuration', (nextValue) =>
    workoutStore
      .getState()
      .updateRestDuration(nextValue as string | number | null | undefined)
  );
  installStoreDelegator('startRestTimer', () =>
    workoutStore.getState().startRestTimer()
  );
  installStoreDelegator('skipRest', () => workoutStore.getState().skipRest());
  installStoreDelegator('addExerciseByName', (name) =>
    workoutStore.getState().addExerciseByName(String(name ?? ''))
  );
  installStoreDelegator('selectExerciseCatalogExercise', (exerciseId) =>
    workoutStore.getState().selectExerciseCatalogExercise(String(exerciseId ?? ''))
  );
  installStoreDelegator('showSetRIRPrompt', (exerciseIndex, setIndex) =>
    workoutStore
      .getState()
      .showSetRIRPrompt(Number(exerciseIndex), Number(setIndex))
  );
  installStoreDelegator('applySetRIR', (exerciseIndex, setIndex, rirValue) =>
    workoutStore
      .getState()
      .applySetRIR(Number(exerciseIndex), Number(setIndex), rirValue as string | number)
  );
  installStoreDelegator('toggleSet', (exerciseIndex, setIndex) =>
    workoutStore.getState().toggleSet(Number(exerciseIndex), Number(setIndex))
  );
  installStoreDelegator('updateSet', (exerciseIndex, setIndex, field, value) =>
    workoutStore
      .getState()
      .updateSet(Number(exerciseIndex), Number(setIndex), String(field), value as string | number)
  );
  installStoreDelegator('addSet', (exerciseIndex) =>
    workoutStore.getState().addSet(Number(exerciseIndex))
  );
  installStoreDelegator('removeEx', (exerciseIndex) =>
    workoutStore.getState().removeExercise(Number(exerciseIndex))
  );
  installStoreDelegator('finishWorkout', () =>
    workoutStore.getState().finishWorkout()
  );
  installStoreDelegator('cancelWorkout', () =>
    workoutStore.getState().cancelWorkout()
  );

  window.addEventListener('visibilitychange', syncStoreFromLegacy);
  window.addEventListener('focus', syncStoreFromLegacy);
}

export function disposeLegacyWorkoutStoreBridge() {
  unsubscribeDataStore?.();
  unsubscribeDataStore = null;
  unsubscribeRuntimeStore?.();
  unsubscribeRuntimeStore = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('visibilitychange', syncStoreFromLegacy);
    window.removeEventListener('focus', syncStoreFromLegacy);
  }
  bridgeInstalled = false;
}

export function getWorkoutStoreSnapshot() {
  return workoutStore.getState().syncFromLegacy();
}
