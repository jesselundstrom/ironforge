import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { ActiveWorkout, WorkoutStartSnapshot } from '../domain/types';
import {
  normalizeActiveWorkout,
  normalizeWorkoutStartSnapshot,
} from '../domain/workout-helpers';
import {
  appendWorkoutSet,
  applySetUpdateMutation,
  removeWorkoutExercise,
  toggleWorkoutSetCompletion,
} from '../app/services/workout-runtime';
import type {
  WorkoutRestTimerResult,
  WorkoutRuntimeApi,
} from '../app/services/workout-runtime';
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
  startWorkout: () => Promise<unknown> | unknown;
  resumeActiveWorkoutUI: (options?: Record<string, unknown>) => unknown;
  updateRestDuration: (nextValue?: string | number | null) => void;
  syncRestTimer: () => void;
  startRestTimer: () => void;
  skipRest: () => void;
  setRestBarActiveState: (active: boolean) => void;
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
  | 'syncRestTimer'
  | 'startRestTimer'
  | 'skipRest'
  | 'setRestBarActiveState'
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
  profile?: Record<string, unknown> | null;
  I18N?: {
    t?: (
      key: string,
      params?: Record<string, unknown> | null,
      fallback?: string
    ) => string;
  };
  getWorkoutStartSnapshot?: (
    input?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  getCachedWorkoutStartSnapshot?: () => Record<string, unknown> | null;
  clearWorkoutStartSnapshot?: () => void;
  startWorkout?: () => Promise<unknown> | unknown;
  resumeActiveWorkoutUI?: (options?: Record<string, unknown>) => unknown;
  updateRestDuration?: (nextValue?: string | number | null) => void;
  syncRestTimer?: () => void;
  startRestTimer?: () => void;
  skipRest?: () => void;
  setRestBarActiveState?: (active: boolean) => void;
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
  showCustomModal?: (title: string, bodyHtml: string) => void;
  closeCustomModal?: () => void;
  showToast?: (
    message: string,
    color?: string,
    undoAction?: (() => void) | null
  ) => void;
  getActiveWorkoutSession?: () => Record<string, unknown> | null;
  ensureExerciseUiKey?: (exercise: Record<string, unknown>) => string | null;
  getExerciseByUiKey?: (uiKey: string) => Record<string, unknown> | null;
  isExerciseComplete?: (exercise: Record<string, unknown>) => boolean;
  setExerciseCardCollapsed?: (
    exercise: Record<string, unknown>,
    collapsed: boolean
  ) => void;
  rebuildActiveWorkoutRewardState?: () => Record<string, unknown> | null;
  detectSetPr?: (
    exercise: Record<string, unknown>,
    set: Record<string, unknown>,
    setIndex: number
  ) => Record<string, unknown> | null;
  clearSetPr?: (
    exercise: Record<string, unknown>,
    set: Record<string, unknown>,
    setIndex: number
  ) => void;
  queueLogActiveFocusTarget?: (inputId: string) => void;
  queueLogActiveSetSignal?: (
    exerciseUiKey: string,
    setIndex: number,
    prEvent?: Record<string, unknown> | null
  ) => void;
  queueLogActiveCollapseSignal?: (exerciseUiKey: string) => void;
  notifyLogActiveIsland?: () => void;
  isLogActiveIslandActive?: () => boolean;
  updateExerciseCard?: (uiKey: string) => Element | null;
  renderActiveWorkoutPlanPanel?: () => void;
  insertExerciseCard?: (
    exerciseIndex: number,
    exercise: Record<string, unknown>
  ) => void;
  removeExerciseCard?: (uiKey: string) => void;
  getSetInputId?: (
    exerciseUiKey: string,
    setIndex: number,
    field: string
  ) => string;
  displayExerciseName?: (input: unknown) => string;
  formatWorkoutWeight?: (value: unknown) => string;
  i18nText?: (
    key: string,
    fallback: string,
    params?: Record<string, unknown>
  ) => string;
  __IRONFORGE_WORKOUT_RUNTIME__?: WorkoutRuntimeApi;
  __IRONFORGE_LEGACY_RUNTIME_ACCESS__?: {
    read?: (name: string) => unknown;
    write?: (name: string, value: unknown) => void;
  };
};

const WRAPPED_MARK = '__ironforgeWorkoutStoreWrapped';
const DELEGATOR_MARK = '__ironforgeWorkoutStoreDelegator';
const DELEGATED_WORKOUT_ACTIONS = [
  'startWorkout',
  'resumeActiveWorkoutUI',
  'addExerciseByName',
  'selectExerciseCatalogExercise',
  'finishWorkout',
  'cancelWorkout',
] as const;

type DelegatedWorkoutActionName = (typeof DELEGATED_WORKOUT_ACTIONS)[number];
type LegacyWorkoutAction = (...args: unknown[]) => unknown;

let bridgeInstalled = false;
let workoutStoreRef: StoreApi<LegacyWorkoutStoreState> | null = null;
let unsubscribeDataStore: (() => void) | null = null;
let unsubscribeRuntimeStore: (() => void) | null = null;
let removeRestVisibilityListener: (() => void) | null = null;
let removeRestPageShowListener: (() => void) | null = null;
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

function getWorkoutRuntime() {
  return getLegacyWindow()?.__IRONFORGE_WORKOUT_RUNTIME__ || null;
}

function readLegacyRuntimeValue<T>(name: string) {
  return getLegacyWindow()?.__IRONFORGE_LEGACY_RUNTIME_ACCESS__?.read?.(
    name
  ) as T | undefined;
}

function writeLegacyRuntimeValue(name: string, value: unknown) {
  getLegacyWindow()?.__IRONFORGE_LEGACY_RUNTIME_ACCESS__?.write?.(name, value);
}

function getCapturedLegacyAction(
  name: DelegatedWorkoutActionName
): LegacyWorkoutAction | null {
  const runtimeWindow = getLegacyWindow();
  const target = runtimeWindow?.[name];
  if (typeof target !== 'function') return null;
  if (
    !(target as unknown as Record<string, unknown>)[DELEGATOR_MARK] &&
    legacyWorkoutActions[name] !== target
  ) {
    legacyWorkoutActions[name] = target as LegacyWorkoutAction;
  }
  return legacyWorkoutActions[name] || captureLegacyAction(name) || null;
}

function captureLegacyAction(
  name: DelegatedWorkoutActionName
): LegacyWorkoutAction | null {
  const runtimeWindow = getLegacyWindow();
  const target = runtimeWindow?.[name];
  if (typeof target !== 'function') return null;
  if ((target as unknown as Record<string, unknown>)[DELEGATOR_MARK]) {
    return legacyWorkoutActions[name] || null;
  }
  legacyWorkoutActions[name] = target as LegacyWorkoutAction;
  return legacyWorkoutActions[name] || null;
}

function translateLegacyText(key: string, fallback: string) {
  try {
    return getLegacyWindow()?.I18N?.t?.(key, null, fallback) || fallback;
  } catch (_error) {
    return fallback;
  }
}

function showWorkoutStartFailure(error?: unknown) {
  if (error) {
    console.warn('[workout-store] startWorkout failed', error);
  }
  getLegacyWindow()?.showToast?.(
    translateLegacyText(
      'workout.start_error',
      'Workout could not be started. Please reload and try again.'
    ),
    'var(--orange)'
  );
}

function readSessionNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readProfileDefaultRest() {
  return readSessionNumber(
    getLegacyWindow()?.profile?.defaultRest,
    readSessionNumber(
      (dataStore.getState().profile as Record<string, unknown> | null)
        ?.defaultRest,
      120
    )
  );
}

function readRestRuntimeSnapshot() {
  const runtimeSession = readRuntimeWorkoutSession();
  return {
    restDuration: readSessionNumber(
      runtimeSession.restDuration,
      readSessionNumber(readLegacyRuntimeValue('restDuration'))
    ),
    restTotal: readSessionNumber(
      runtimeSession.restTotal,
      readSessionNumber(readLegacyRuntimeValue('restTotal'))
    ),
    restEndsAt: readSessionNumber(
      runtimeSession.restEndsAt,
      readSessionNumber(readLegacyRuntimeValue('restEndsAt'))
    ),
    restSecondsLeft: readSessionNumber(
      runtimeSession.restSecondsLeft,
      readSessionNumber(readLegacyRuntimeValue('restSecondsLeft'))
    ),
    restBarActive:
      runtimeSession.restBarActive === true ||
      readLegacyRuntimeValue('restBarActive') === true,
  };
}

function getWorkoutRestHostDeps() {
  return {
    setInterval: (callback: () => void, delay?: number) =>
      window.setInterval(callback, delay),
    clearInterval: (handle: unknown) =>
      window.clearInterval(handle as number | undefined),
    setTimeout: (callback: () => void, delay?: number) =>
      window.setTimeout(callback, delay),
    clearTimeout: (handle: unknown) =>
      window.clearTimeout(handle as number | undefined),
  };
}

function syncLegacyWorkoutSessionBridge() {
  getLegacyWindow()?.syncWorkoutSessionBridge?.();
}

function persistActiveWorkoutDraftIfNeeded() {
  if (!readLegacyWorkoutSnapshot().activeWorkout) return;
  getLegacyWindow()?.persistActiveWorkoutDraft?.();
}

function persistCurrentWorkoutDraft() {
  getLegacyWindow()?.persistActiveWorkoutDraft?.();
}

function getActiveWorkoutSession() {
  return (
    getLegacyWindow()?.getActiveWorkoutSession?.() ||
    (readLegacyRuntimeValue<Record<string, unknown> | null>('activeWorkout') ??
      null)
  );
}

function getWorkoutExercise(
  workout: Record<string, unknown> | null,
  exerciseIndex: number
) {
  const exercises = Array.isArray(workout?.exercises)
    ? (workout.exercises as Array<Record<string, unknown>>)
    : [];
  return exercises[exerciseIndex] || null;
}

function getWorkoutSet(
  exercise: Record<string, unknown> | null,
  setIndex: number
) {
  const sets = Array.isArray(exercise?.sets)
    ? (exercise.sets as Array<Record<string, unknown>>)
    : [];
  return sets[setIndex] || null;
}

function ensureLegacyExerciseUiKey(exercise: Record<string, unknown>) {
  const runtimeWindow = getLegacyWindow();
  return (
    runtimeWindow?.ensureExerciseUiKey?.(exercise) ||
    String(exercise.uiKey || '')
  );
}

function isReactLogActive() {
  return getLegacyWindow()?.isLogActiveIslandActive?.() === true;
}

function refreshActiveWorkoutViews(exerciseUiKey?: string | null) {
  const runtimeWindow = getLegacyWindow();
  if (exerciseUiKey) {
    runtimeWindow?.updateExerciseCard?.(exerciseUiKey);
  }
  runtimeWindow?.renderActiveWorkoutPlanPanel?.();
  if (isReactLogActive()) {
    runtimeWindow?.notifyLogActiveIsland?.();
  }
  syncLegacyWorkoutSessionBridge();
  syncStoreFromLegacy();
}

function translateWorkoutText(
  key: string,
  fallback: string,
  params?: Record<string, unknown>
) {
  const runtimeWindow = getLegacyWindow();
  try {
    return (
      runtimeWindow?.i18nText?.(key, fallback, params) ||
      runtimeWindow?.I18N?.t?.(key, params || null, fallback) ||
      fallback
    );
  } catch (_error) {
    return fallback;
  }
}

function formatWorkoutWeightForToast(value: unknown) {
  return getLegacyWindow()?.formatWorkoutWeight?.(value) || String(value || 0);
}

function displayWorkoutExerciseName(value: unknown) {
  return getLegacyWindow()?.displayExerciseName?.(value) || String(value || '');
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showPrToast(prEvent: Record<string, unknown>) {
  getLegacyWindow()?.showToast?.(
    translateWorkoutText(
      'workout.pr_toast',
      'New PR! {name} {weight}kg x {reps}',
      {
        name: prEvent.exerciseName,
        weight: formatWorkoutWeightForToast(prEvent.weight),
        reps: prEvent.reps,
      }
    ),
    'var(--yellow)'
  );
}

function getLastWorkSetIndex(exercise: Record<string, unknown>) {
  const sets = Array.isArray(exercise?.sets)
    ? (exercise.sets as Array<Record<string, unknown>>)
    : [];
  for (let index = sets.length - 1; index >= 0; index -= 1) {
    if (sets[index]?.isWarmup !== true) return index;
  }
  return -1;
}

function shouldPromptForSetRIR(
  workout: Record<string, unknown> | null | undefined,
  exercise: Record<string, unknown> | null | undefined,
  setIndex: number
) {
  if ((workout?.programMode || 'sets') !== 'rir') return false;
  if (!exercise || exercise.isAccessory === true) return false;
  return setIndex === getLastWorkSetIndex(exercise);
}

function showSetRIRPromptFromStore(exerciseIndex: number, setIndex: number) {
  const runtimeWindow = getLegacyWindow();
  const workout = getActiveWorkoutSession();
  const exercise = getWorkoutExercise(workout, exerciseIndex);
  const set = getWorkoutSet(exercise, setIndex);
  if (!workout || !exercise || !set) return;
  const currentValue =
    set.rir !== undefined && set.rir !== null && set.rir !== ''
      ? String(set.rir)
      : '';
  const options = ['0', '1', '2', '3', '4', '5+'];
  const buttons = options
    .map((value) => {
      const normalizedValue = value === '5+' ? '5' : value;
      const isActive = currentValue === normalizedValue;
      return `<button class="btn btn-secondary${isActive ? ' active' : ''}" type="button" data-custom-modal-action="apply-set-rir" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}" data-rir-value="${escapeHtml(normalizedValue)}">${escapeHtml(value)}</button>`;
    })
    .join('');

  runtimeWindow?.showCustomModal?.(
    escapeHtml(translateWorkoutText('workout.rir_prompt_title', 'Last set check-in')),
    `<div style="font-size:13px;line-height:1.5;color:var(--muted);margin-bottom:12px">${escapeHtml(
      translateWorkoutText(
        'workout.rir_prompt_body',
        'How many reps did you still have left after the last work set of {exercise}?',
        { exercise: displayWorkoutExerciseName(exercise.name) }
      )
    )}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${buttons}</div>
    <button class="btn btn-secondary" style="margin-top:12px;width:100%" type="button" data-custom-modal-action="skip-set-rir">${escapeHtml(
      translateWorkoutText('workout.rir_prompt_skip', 'Skip for now')
    )}</button>`
  );
  syncStoreFromLegacy();
}

function applySetRIRFromStore(
  exerciseIndex: number,
  setIndex: number,
  rirValue: string | number
) {
  const exercise = getWorkoutExercise(getActiveWorkoutSession(), exerciseIndex);
  const set = getWorkoutSet(exercise, setIndex);
  if (!set) return;
  set.rir = String(rirValue ?? '').trim();
  persistCurrentWorkoutDraft();
  syncLegacyWorkoutSessionBridge();
  getLegacyWindow()?.closeCustomModal?.();
  getLegacyWindow()?.showToast?.(
    translateWorkoutText('workout.rir_saved', 'RIR saved'),
    'var(--blue)'
  );
  syncStoreFromLegacy();
}

function scheduleCompletedExerciseCollapse(
  exerciseUiKey: string,
  prEvent: Record<string, unknown> | null
) {
  const runtimeWindow = getLegacyWindow();
  window.setTimeout(
    () => {
      const currentExercise = runtimeWindow?.getExerciseByUiKey?.(exerciseUiKey);
      if (!currentExercise || !runtimeWindow?.isExerciseComplete?.(currentExercise)) {
        return;
      }
      runtimeWindow.setExerciseCardCollapsed?.(currentExercise, true);
      runtimeWindow.queueLogActiveCollapseSignal?.(exerciseUiKey);
      runtimeWindow.notifyLogActiveIsland?.();
      syncStoreFromLegacy();
    },
    prEvent ? 950 : 500
  );
}

function scheduleSetRirPrompt(
  exercise: Record<string, unknown>,
  exerciseIndex: number,
  setIndex: number,
  prEvent: Record<string, unknown> | null
) {
  const runtimeWindow = getLegacyWindow();
  const workout = getActiveWorkoutSession();
  if (shouldPromptForSetRIR(workout, exercise, setIndex) !== true) {
    return;
  }
  const isComplete = runtimeWindow?.isExerciseComplete?.(exercise) === true;
  const rirDelay = isComplete ? (prEvent ? 1250 : 900) : prEvent ? 900 : 550;
  window.setTimeout(() => {
    workoutStore.getState().showSetRIRPrompt(exerciseIndex, setIndex);
  }, rirDelay);
}

function updateActiveWorkoutSet(
  exerciseIndex: number,
  setIndex: number,
  field: string,
  value: string | number
) {
  const workout = getActiveWorkoutSession();
  const exercise = getWorkoutExercise(workout, exerciseIndex);
  const set = getWorkoutSet(exercise, setIndex);
  if (!workout || !exercise || !set) return;
  const mutation = applySetUpdateMutation({
    exercise,
    setIndex,
    field,
    rawValue: value,
  });
  if (!mutation) return;
  if (mutation.shouldRefreshDoneSet === true) {
    set.isPr = false;
    getLegacyWindow()?.rebuildActiveWorkoutRewardState?.();
    getLegacyWindow()?.detectSetPr?.(exercise, set, setIndex);
  }
  persistCurrentWorkoutDraft();
  const exerciseUiKey = ensureLegacyExerciseUiKey(exercise);
  if (isReactLogActive()) {
    refreshActiveWorkoutViews();
    return;
  }
  if (field === 'weight' && set.isWarmup !== true) {
    const propagatedSetIndexes = Array.isArray(mutation.propagatedSetIndexes)
      ? mutation.propagatedSetIndexes
      : [];
    propagatedSetIndexes.forEach((nextIndex) => {
      const inputId = getLegacyWindow()?.getSetInputId?.(
        exerciseUiKey,
        nextIndex,
        'weight'
      );
      const weightInput = inputId ? document.getElementById(inputId) : null;
      if (weightInput instanceof HTMLInputElement) {
        weightInput.value = String(mutation.sanitizedValue ?? '');
      }
    });
  }
  if (mutation.shouldRefreshDoneSet === true) {
    refreshActiveWorkoutViews(exerciseUiKey);
    return;
  }
  syncStoreFromLegacy();
}

function toggleActiveWorkoutSet(exerciseIndex: number, setIndex: number) {
  const runtimeWindow = getLegacyWindow();
  const workout = getActiveWorkoutSession();
  const exercise = getWorkoutExercise(workout, exerciseIndex);
  const set = getWorkoutSet(exercise, setIndex);
  if (!workout || !exercise || !set) return;
  const exerciseUiKey = ensureLegacyExerciseUiKey(exercise);
  const toggleResult = toggleWorkoutSetCompletion({ exercise, setIndex });
  if (!toggleResult) return;
  const isNowDone = toggleResult.isNowDone === true;
  if (isNowDone) {
    const prEvent =
      runtimeWindow?.detectSetPr?.(exercise, set, setIndex) || null;
    if (isReactLogActive()) {
      runtimeWindow?.queueLogActiveSetSignal?.(exerciseUiKey, setIndex, prEvent);
      if (prEvent) showPrToast(prEvent);
      if (runtimeWindow?.isExerciseComplete?.(exercise)) {
        scheduleCompletedExerciseCollapse(exerciseUiKey, prEvent);
      }
      runtimeWindow?.notifyLogActiveIsland?.();
    } else {
      runtimeWindow?.updateExerciseCard?.(exerciseUiKey);
      if (runtimeWindow?.isExerciseComplete?.(exercise)) {
        runtimeWindow.setExerciseCardCollapsed?.(exercise, true);
      }
    }
    workoutStore.getState().startRestTimer();
    scheduleSetRirPrompt(exercise, exerciseIndex, setIndex, prEvent);
  } else {
    runtimeWindow?.clearSetPr?.(exercise, set, setIndex);
    runtimeWindow?.setExerciseCardCollapsed?.(exercise, false);
    persistCurrentWorkoutDraft();
    refreshActiveWorkoutViews(exerciseUiKey);
    return;
  }
  persistCurrentWorkoutDraft();
  refreshActiveWorkoutViews(exerciseUiKey);
}

function addActiveWorkoutSet(exerciseIndex: number) {
  const runtimeWindow = getLegacyWindow();
  const workout = getActiveWorkoutSession();
  const exercise = getWorkoutExercise(workout, exerciseIndex);
  if (!workout || !exercise) return;
  const exerciseUiKey = ensureLegacyExerciseUiKey(exercise);
  runtimeWindow?.setExerciseCardCollapsed?.(exercise, false);
  const appendResult = appendWorkoutSet({ exercise });
  if (!appendResult) return;
  persistCurrentWorkoutDraft();
  const newSetIndex =
    appendResult.newSetIndex ??
    (Array.isArray(exercise.sets) ? exercise.sets.length - 1 : 0);
  const newInputId =
    runtimeWindow?.getSetInputId?.(exerciseUiKey, newSetIndex, 'weight') || '';
  if (isReactLogActive() && newInputId) {
    runtimeWindow?.queueLogActiveFocusTarget?.(newInputId);
  }
  refreshActiveWorkoutViews(exerciseUiKey);
  if (!isReactLogActive() && newInputId) {
    const weightInput = document.getElementById(newInputId);
    if (weightInput instanceof HTMLInputElement) weightInput.focus();
  }
}

function removeActiveWorkoutExercise(exerciseIndex: number) {
  const runtimeWindow = getLegacyWindow();
  const workout = getActiveWorkoutSession();
  const exercises = Array.isArray(workout?.exercises)
    ? (workout.exercises as Array<Record<string, unknown>>)
    : [];
  const removal = removeWorkoutExercise({ exercises, exerciseIndex });
  if (!workout || !removal) return;
  const removed = removal.removed;
  const removedUiKey =
    removed && typeof removed === 'object' ? String(removed.uiKey || '') : '';
  if (removedUiKey) runtimeWindow?.removeExerciseCard?.(removedUiKey);
  persistCurrentWorkoutDraft();
  refreshActiveWorkoutViews();
  if (removed) {
    runtimeWindow?.showToast?.(
      translateWorkoutText('workout.exercise_removed', '{name} removed', {
        name: displayWorkoutExerciseName(removed.name),
      }),
      'var(--muted)',
      () => {
        ensureLegacyExerciseUiKey(removed);
        const currentWorkout = getActiveWorkoutSession();
        const currentExercises = Array.isArray(currentWorkout?.exercises)
          ? (currentWorkout.exercises as Array<Record<string, unknown>>)
          : null;
        if (!currentExercises) return;
        currentExercises.splice(exerciseIndex, 0, removed);
        persistCurrentWorkoutDraft();
        runtimeWindow?.insertExerciseCard?.(exerciseIndex, removed);
        refreshActiveWorkoutViews();
      }
    );
  }
}

function playWorkoutRestBeep() {
  try {
    const ContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!ContextCtor) return;
    const ctx = new ContextCtor();
    [0, 150, 300].forEach((delayMs) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delayMs / 1000);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + delayMs / 1000 + 0.2
      );
      oscillator.start(ctx.currentTime + delayMs / 1000);
      oscillator.stop(ctx.currentTime + delayMs / 1000 + 0.25);
    });
  } catch (_error) {
    // Ignore audio failures so timer completion never breaks the session flow.
  }
}

function writeRestTimerState(nextState: WorkoutRestTimerResult) {
  writeLegacyRuntimeValue('restDuration', nextState.restDuration);
  writeLegacyRuntimeValue('restTotal', nextState.restTotal);
  writeLegacyRuntimeValue('restEndsAt', nextState.restEndsAt);
  writeLegacyRuntimeValue('restSecondsLeft', nextState.restSecondsLeft);
  writeLegacyRuntimeValue('restBarActive', nextState.restBarActive === true);
}

function updateLegacyRestDurationControl(nextValue: number) {
  const restSelect = document.getElementById('rest-duration') as
    | HTMLSelectElement
    | null;
  if (restSelect) {
    restSelect.value = String(nextValue);
  }
}

function syncRestTimerFromStore() {
  const runtime = getWorkoutRuntime();
  if (!runtime) return;
  const current = readRestRuntimeSnapshot();
  const restLifecyclePlan = runtime.buildWorkoutRestLifecyclePlan(
    {
      mode: 'sync',
      ...current,
      profileDefaultRest: readProfileDefaultRest(),
      now: Date.now(),
    },
    {}
  );
  if (
    !restLifecyclePlan?.timerState?.restEndsAt &&
    !restLifecyclePlan?.shouldComplete
  ) {
    return;
  }
  if (restLifecyclePlan.shouldComplete) {
    completeRestTimerFromStore();
    return;
  }
  writeRestTimerState(restLifecyclePlan.timerState);
  syncLegacyWorkoutSessionBridge();
  syncStoreFromLegacy();
}

function completeRestTimerFromStore() {
  const runtime = getWorkoutRuntime();
  if (!runtime) return;
  runtime.clearWorkoutRestIntervalHost(getWorkoutRestHostDeps());
  runtime.clearWorkoutRestHideHost(getWorkoutRestHostDeps());
  const current = readRestRuntimeSnapshot();
  const restLifecyclePlan = runtime.buildWorkoutRestLifecyclePlan(
    {
      mode: 'complete',
      ...current,
      profileDefaultRest: readProfileDefaultRest(),
      now: Date.now(),
    },
    {}
  );
  if (!restLifecyclePlan) return;
  writeRestTimerState(restLifecyclePlan.timerState);
  if (restLifecyclePlan.shouldPlayBeep) {
    playWorkoutRestBeep();
  }
  persistActiveWorkoutDraftIfNeeded();
  runtime.scheduleWorkoutRestHideHost(
    () => {
      writeLegacyRuntimeValue('restBarActive', false);
      syncLegacyWorkoutSessionBridge();
      syncStoreFromLegacy();
    },
    Number(restLifecyclePlan.hideDelayMs || 3000),
    getWorkoutRestHostDeps()
  );
  syncLegacyWorkoutSessionBridge();
  syncStoreFromLegacy();
}

function skipRestTimerFromStore() {
  const runtime = getWorkoutRuntime();
  if (!runtime) return;
  runtime.clearWorkoutRestIntervalHost(getWorkoutRestHostDeps());
  runtime.clearWorkoutRestHideHost(getWorkoutRestHostDeps());
  const current = readRestRuntimeSnapshot();
  const restLifecyclePlan = runtime.buildWorkoutRestLifecyclePlan(
    {
      mode: 'skip',
      ...current,
      profileDefaultRest: readProfileDefaultRest(),
      now: Date.now(),
    },
    {}
  );
  if (!restLifecyclePlan) return;
  writeRestTimerState(restLifecyclePlan.timerState);
  persistActiveWorkoutDraftIfNeeded();
  syncLegacyWorkoutSessionBridge();
  syncStoreFromLegacy();
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
  const activeWorkout =
    normalizeActiveWorkout(runtimeSession.activeWorkout) ||
    normalizeActiveWorkout(runtimeWindow?.activeWorkout) ||
    normalizeActiveWorkout(dataStore.getState().activeWorkout);
  const startSnapshot = normalizeWorkoutStartSnapshot(
    runtimeWindow?.getCachedWorkoutStartSnapshot?.() || null
  );
  return {
    activeWorkout,
    startSnapshot,
    hasActiveWorkout: !!activeWorkout,
    restDuration: readSessionNumber(runtimeSession.restDuration),
    restEndsAt: readSessionNumber(runtimeSession.restEndsAt),
    restSecondsLeft: readSessionNumber(runtimeSession.restSecondsLeft),
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
      const startAction = getCapturedLegacyAction('startWorkout');
      if (!startAction) {
        syncStoreFromLegacy();
        showWorkoutStartFailure();
        return undefined;
      }
      const finalizeStart = () => {
        const snapshot = syncStoreFromLegacy();
        if (!snapshot.activeWorkout) return false;
        // If the legacy layer set up an active workout, run resumeActiveWorkoutUI to
        // guarantee the React bridge views (logStartView, logActiveView) are updated.
        // beginWorkoutStart may skip its own notify calls if isLogActiveIslandActive()
        // returns false at the time it runs, or if an exception occurs before line 3638.
        getCapturedLegacyAction('resumeActiveWorkoutUI')?.({ toast: false });
        syncStoreFromLegacy();
        navigateToPage('log');
        return true;
      };
      try {
        const result = startAction();
        if (isPromiseLike(result)) {
          return result
            .then(finalizeStart)
            .catch((error) => {
              syncStoreFromLegacy();
              showWorkoutStartFailure(error);
              return false;
            });
        }
        return finalizeStart();
      } catch (error) {
        syncStoreFromLegacy();
        showWorkoutStartFailure(error);
        return false;
      }
    },
    resumeActiveWorkoutUI: (options) => {
      const result = getCapturedLegacyAction('resumeActiveWorkoutUI')?.(options);
      syncStoreFromLegacy();
      return result;
    },
    updateRestDuration: (nextValue) => {
      const runtime = getWorkoutRuntime();
      if (!runtime) return;
      const resolvedDuration = runtime.resolveWorkoutRestDuration({
        restDuration:
          nextValue !== undefined && nextValue !== null
            ? nextValue
            : readRestRuntimeSnapshot().restDuration || readProfileDefaultRest(),
        profileDefaultRest: readProfileDefaultRest(),
      });
      writeLegacyRuntimeValue('restDuration', resolvedDuration);
      updateLegacyRestDurationControl(resolvedDuration);
      persistActiveWorkoutDraftIfNeeded();
      syncLegacyWorkoutSessionBridge();
      syncStoreFromLegacy();
    },
    syncRestTimer: () => {
      syncRestTimerFromStore();
    },
    startRestTimer: () => {
      const runtime = getWorkoutRuntime();
      if (!runtime) return;
      const current = readRestRuntimeSnapshot();
      const nextState = runtime.startWorkoutRestTimer({
        restDuration: current.restDuration,
        profileDefaultRest: readProfileDefaultRest(),
        now: Date.now(),
      });
      if (nextState.shouldSkip) {
        skipRestTimerFromStore();
        return;
      }
      runtime.clearWorkoutRestIntervalHost(getWorkoutRestHostDeps());
      runtime.clearWorkoutRestHideHost(getWorkoutRestHostDeps());
      writeRestTimerState(nextState);
      syncRestTimerFromStore();
      persistActiveWorkoutDraftIfNeeded();
      runtime.scheduleWorkoutRestIntervalHost(
        syncRestTimerFromStore,
        getWorkoutRestHostDeps()
      );
      syncLegacyWorkoutSessionBridge();
      syncStoreFromLegacy();
    },
    skipRest: () => {
      skipRestTimerFromStore();
    },
    setRestBarActiveState: (active) => {
      writeLegacyRuntimeValue('restBarActive', active === true);
      syncLegacyWorkoutSessionBridge();
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
      showSetRIRPromptFromStore(exerciseIndex, setIndex);
    },
    applySetRIR: (exerciseIndex, setIndex, rirValue) => {
      applySetRIRFromStore(exerciseIndex, setIndex, rirValue);
    },
    toggleSet: (exerciseIndex, setIndex) => {
      toggleActiveWorkoutSet(exerciseIndex, setIndex);
    },
    updateSet: (exerciseIndex, setIndex, field, value) => {
      updateActiveWorkoutSet(exerciseIndex, setIndex, field, value);
    },
    addSet: (exerciseIndex) => {
      addActiveWorkoutSet(exerciseIndex);
    },
    removeExercise: (exerciseIndex) => {
      removeActiveWorkoutExercise(exerciseIndex);
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
  installStoreDelegator('syncRestTimer', () =>
    workoutStore.getState().syncRestTimer()
  );
  const syncRestTimerOnVisible = () => {
    if (!document.hidden) {
      workoutStore.getState().syncRestTimer();
    }
  };
  const syncRestTimerOnPageShow = () => {
    workoutStore.getState().syncRestTimer();
  };
  document.addEventListener('visibilitychange', syncRestTimerOnVisible);
  window.addEventListener('pageshow', syncRestTimerOnPageShow);
  removeRestVisibilityListener = () => {
    document.removeEventListener('visibilitychange', syncRestTimerOnVisible);
  };
  removeRestPageShowListener = () => {
    window.removeEventListener('pageshow', syncRestTimerOnPageShow);
  };
  installStoreDelegator('startRestTimer', () =>
    workoutStore.getState().startRestTimer()
  );
  installStoreDelegator('skipRest', () => workoutStore.getState().skipRest());
  installStoreDelegator('setRestBarActiveState', (active) =>
    workoutStore.getState().setRestBarActiveState(active === true)
  );
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

}

export function disposeLegacyWorkoutStoreBridge() {
  unsubscribeDataStore?.();
  unsubscribeDataStore = null;
  unsubscribeRuntimeStore?.();
  unsubscribeRuntimeStore = null;
  removeRestVisibilityListener?.();
  removeRestVisibilityListener = null;
  removeRestPageShowListener?.();
  removeRestPageShowListener = null;
  bridgeInstalled = false;
}

export function getWorkoutStoreSnapshot() {
  return workoutStore.getState().syncFromLegacy();
}
