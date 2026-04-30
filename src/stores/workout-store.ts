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
  applyQuickWorkoutAdjustment: (mode: string, detailLevel?: string) => void;
  undoQuickWorkoutAdjustment: () => void;
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
  | 'applyQuickWorkoutAdjustment'
  | 'undoQuickWorkoutAdjustment'
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
  applyQuickWorkoutAdjustment?: (mode: string, detailLevel?: string) => void;
  undoQuickWorkoutAdjustment?: () => void;
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
  applyWorkoutTeardownPlan?: (
    teardownPlan?: Record<string, unknown> | null,
    options?: Record<string, unknown>
  ) => void;
  getActiveProgram?: () => Record<string, unknown> | null;
  setProgramState?: (
    programId: string,
    state: Record<string, unknown>
  ) => void;
  saveProfileData?: (
    input?: Record<string, unknown>
  ) => Promise<unknown> | unknown;
  upsertWorkoutRecord?: (
    workout: Record<string, unknown>
  ) => Promise<unknown> | unknown;
  saveWorkouts?: () => Promise<unknown> | unknown;
  buildExerciseIndex?: () => void;
  showRPEPicker?: (
    exerciseName: string,
    setNumber: number,
    callback: (value: number | null) => void
  ) => void;
  showSessionSummary?: (
    summaryData: Record<string, unknown>
  ) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  setNutritionSessionContext?: (
    value?: Record<string, unknown> | null
  ) => void;
  getRuntimeBridge?: () => Record<string, unknown> | null;
  showPage?: (page: string) => void;
  logWarn?: (scope: string, error: unknown) => void;
  getWeekStart?: (date?: Date | string | number | null) => Date;
  stripWarmupSetsFromExercises?: (
    exercises: Array<Record<string, unknown>>
  ) => Array<Record<string, unknown>>;
  inferDurationSignal?: (workout?: Record<string, unknown> | null) => string;
  persistActiveWorkoutDraft?: (...args: unknown[]) => unknown;
  clearActiveWorkoutDraft?: (...args: unknown[]) => unknown;
  syncWorkoutSessionBridge?: (...args: unknown[]) => unknown;
  showCustomModal?: (title: string, bodyHtml: string) => void;
  showShortenAdjustmentOptions?: () => void;
  showConfirm?: (
    title: string,
    message: string,
    onConfirm: () => void
  ) => void;
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
  renderExercises?: () => void;
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
  getRegisteredExercise?: (input: unknown) => Record<string, unknown> | null;
  resolveRegisteredExerciseId?: (input: unknown) => string | null;
  registerCustomExercise?: (
    definition: Record<string, unknown>
  ) => Record<string, unknown> | null;
  getSuggested?: (exercise: Record<string, unknown>) => number | string | null;
  getActiveProgramState?: () => Record<string, unknown> | null;
  buildTrainingCommentaryState?: (
    input?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  presentTrainingCommentary?: (
    state?: Record<string, unknown> | null,
    surface?: string
  ) => Record<string, unknown> | null;
  createTrainingCommentaryEvent?: (
    code: string,
    params?: Record<string, unknown>
  ) => Record<string, unknown> | null;
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
  'selectExerciseCatalogExercise',
] as const;

type DelegatedWorkoutActionName = (typeof DELEGATED_WORKOUT_ACTIONS)[number];
type LegacyWorkoutAction = (...args: unknown[]) => unknown;

let bridgeInstalled = false;
let workoutStoreRef: StoreApi<LegacyWorkoutStoreState> | null = null;
let unsubscribeDataStore: (() => void) | null = null;
let unsubscribeRuntimeStore: (() => void) | null = null;
let removeRestVisibilityListener: (() => void) | null = null;
let removeRestPageShowListener: (() => void) | null = null;
let finishWorkoutInProgress = false;
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

function showWorkoutFinishFailure(error?: unknown) {
  const runtimeWindow = getLegacyWindow();
  if (error) {
    (runtimeWindow?.logWarn || console.warn)?.('finishWorkout', error);
  }
  runtimeWindow?.showToast?.(
    translateLegacyText(
      'workout.finish_error',
      'Session could not be finalized. Please try again.'
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

function resolveExerciseSelection(input: unknown) {
  const runtimeWindow = getLegacyWindow();
  const raw =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>).name ||
        (input as Record<string, unknown>).exerciseId ||
        ''
      : input;
  const resolved =
    runtimeWindow?.getRegisteredExercise?.(input) ||
    runtimeWindow?.getRegisteredExercise?.(
      runtimeWindow?.resolveRegisteredExerciseId?.(raw) || raw
    ) ||
    null;
  return {
    exerciseId:
      String(resolved?.id || runtimeWindow?.resolveRegisteredExerciseId?.(raw) || '')
        .trim() || null,
    name: String(resolved?.name || raw || '').trim(),
  };
}

function addExerciseByNameFromStore(name: string) {
  const runtimeWindow = getLegacyWindow();
  const workout = getActiveWorkoutSession();
  const exercises = Array.isArray(workout?.exercises)
    ? (workout.exercises as Array<Record<string, unknown>>)
    : null;
  if (!workout || !exercises) return;
  const resolved = resolveExerciseSelection(name);
  const exerciseId = resolved.exerciseId;
  const canonicalName = resolved.name;
  if (!canonicalName) return;
  const suggested =
    runtimeWindow?.getSuggested?.({ name: canonicalName, exerciseId }) || '';
  const exercise: Record<string, unknown> = {
    id: Date.now() + Math.random(),
    exerciseId,
    name: canonicalName,
    note: '',
    sets: [
      { weight: suggested, reps: 5, done: false, rpe: null },
      { weight: suggested, reps: 5, done: false, rpe: null },
      { weight: suggested, reps: 5, done: false, rpe: null },
    ],
  };
  ensureLegacyExerciseUiKey(exercise);
  exercises.push(exercise);
  persistCurrentWorkoutDraft();
  runtimeWindow?.insertExerciseCard?.(exercises.length - 1, exercise);
  refreshActiveWorkoutViews(ensureLegacyExerciseUiKey(exercise));
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getWorkoutExerciseSets(exercise: Record<string, unknown> | null) {
  return Array.isArray(exercise?.sets)
    ? (exercise.sets as Array<Record<string, unknown>>)
    : [];
}

function getCompletedWorkSetCount(exercise: Record<string, unknown>) {
  return getWorkoutExerciseSets(exercise).filter(
    (set) => set.done === true && set.isWarmup !== true
  ).length;
}

function getRemainingWorkSetCount(exercise: Record<string, unknown>) {
  return getWorkoutExerciseSets(exercise).filter(
    (set) => set.done !== true && set.isWarmup !== true
  ).length;
}

function trimExerciseRemainingSets(
  exercise: Record<string, unknown>,
  keepUndoneCount: number
) {
  const sets = getWorkoutExerciseSets(exercise);
  if (!sets.length) return false;
  const nextSets: Array<Record<string, unknown>> = [];
  let keptUndone = 0;
  let changed = false;
  sets.forEach((set) => {
    if (set.done === true || set.isWarmup === true) {
      nextSets.push(set);
      return;
    }
    if (keptUndone < keepUndoneCount) {
      nextSets.push(set);
      keptUndone += 1;
      return;
    }
    changed = true;
  });
  if (changed) exercise.sets = nextSets;
  return changed;
}

function parseLoggedRepCount(raw: unknown) {
  const reps = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(reps) && reps >= 0 ? reps : null;
}

function getCurrentWorkoutRounding() {
  const state = getLegacyWindow()?.getActiveProgramState?.() || null;
  const rounding = parseFloat(String(state?.rounding ?? ''));
  return Number.isFinite(rounding) && rounding > 0 ? rounding : 2.5;
}

function reduceRemainingSetTarget(set: Record<string, unknown>) {
  if (!set || set.done === true || set.isWarmup === true) return false;
  const numericReps = parseLoggedRepCount(set.reps);
  let changed = false;
  if (Number.isFinite(numericReps) && Number(numericReps) > 3) {
    set.reps = Math.max(3, Number(numericReps) - 1);
    changed = true;
  }
  const numericWeight = parseFloat(String(set.weight ?? ''));
  if (Number.isFinite(numericWeight) && numericWeight > 0) {
    const rounding = getCurrentWorkoutRounding();
    set.weight = Math.max(
      0,
      Math.round((numericWeight * 0.95) / rounding) * rounding
    );
    changed = true;
  }
  return changed;
}

function dropTrailingUnstartedExercise(exercises: Array<Record<string, unknown>>) {
  if (exercises.length <= 1) return false;
  for (let index = exercises.length - 1; index >= 0; index -= 1) {
    const sets = getWorkoutExerciseSets(exercises[index]);
    const hasDoneWork = sets.some(
      (set) => set.done === true && set.isWarmup !== true
    );
    const hasUndoneWork = sets.some(
      (set) => set.done !== true && set.isWarmup !== true
    );
    if (hasDoneWork || !hasUndoneWork) continue;
    exercises.splice(index, 1);
    return true;
  }
  return false;
}

function cleanupAdjustedWorkoutExercises(
  exercises: Array<Record<string, unknown>>
) {
  return exercises.filter((exercise) => {
    const sets = getWorkoutExerciseSets(exercise);
    if (!sets.length) return false;
    const hasUndoneWork = sets.some(
      (set) => set.done !== true && set.isWarmup !== true
    );
    const hasCompletedWork = sets.some(
      (set) => set.done === true && set.isWarmup !== true
    );
    const hasWarmupsOnly = sets.every((set) => set.isWarmup === true);
    if (hasWarmupsOnly) return false;
    return hasUndoneWork || hasCompletedWork;
  });
}

function getExerciseMinimumWorkSetTarget(
  exercise: Record<string, unknown>,
  mode: string
) {
  if (mode === 'lighten') {
    if (exercise.isAccessory === true) return 1;
    if (exercise.isAux === true) return 1;
    return 2;
  }
  return 0;
}

function trimOneExtraRemainingSet(
  exercise: Record<string, unknown>,
  mode: string
) {
  const minimumTotal = getExerciseMinimumWorkSetTarget(exercise, mode);
  const completed = getCompletedWorkSetCount(exercise);
  const remaining = getRemainingWorkSetCount(exercise);
  if (remaining <= 0) return false;
  const minimumRemaining = Math.max(0, minimumTotal - completed);
  if (remaining <= minimumRemaining) return false;
  return trimExerciseRemainingSets(exercise, remaining - 1);
}

function getRunnerAdjustmentLabel(mode: string) {
  return translateWorkoutText(
    mode === 'shorten'
      ? 'workout.runner.shorten'
      : mode === 'lighten'
        ? 'workout.runner.lighten'
        : 'workout.runner.adjusted',
    mode === 'shorten'
      ? 'Shortened session'
      : mode === 'lighten'
        ? 'Lightened session'
        : 'Adjusted session'
  );
}

function getQuickAdjustmentPreview(mode: string) {
  if (mode === 'shorten') {
    return {
      title: translateWorkoutText(
        'workout.runner.shorten_confirm_title',
        'Shorten this session?'
      ),
      body: translateWorkoutText(
        'workout.runner.shorten_confirm_body',
        'Choose how aggressively to trim the remaining work based on how much time you need to save.'
      ),
    };
  }
  return {
    title: translateWorkoutText(
      'workout.runner.light_confirm_title',
      'Go lighter this session?'
    ),
    body: translateWorkoutText(
      'workout.runner.light_confirm_body',
      'This keeps the session structure mostly intact, but lowers the remaining load and trims a little volume when useful. Use this when recovery feels off.'
    ),
  };
}

function ensureWorkoutCommentaryRecord(workout: Record<string, unknown>) {
  const existing = workout.commentary;
  if (existing && typeof existing === 'object') {
    const commentary = existing as Record<string, unknown>;
    commentary.version = 1;
    commentary.adaptationEvents = Array.isArray(commentary.adaptationEvents)
      ? commentary.adaptationEvents
      : [];
    commentary.runnerEvents = Array.isArray(commentary.runnerEvents)
      ? commentary.runnerEvents
      : [];
    return commentary;
  }
  const state = getLegacyWindow()?.buildTrainingCommentaryState?.({ workout });
  workout.commentary = {
    version: 1,
    decisionCode: state?.decisionCode || 'train',
    reasonCodes: Array.isArray(state?.reasonCodes) ? [...state.reasonCodes] : [],
    restrictionFlags: Array.isArray(state?.restrictionFlags)
      ? [...state.restrictionFlags]
      : [],
    adaptationEvents: [],
    equipmentHint: state?.equipmentHint || null,
    runnerEvents: [],
  };
  return workout.commentary as Record<string, unknown>;
}

function createWorkoutCommentaryEvent(
  code: string,
  params?: Record<string, unknown>
) {
  return (
    getLegacyWindow()?.createTrainingCommentaryEvent?.(code, params) || {
      code,
      params: params ? cloneJsonValue(params) : {},
    }
  );
}

function appendWorkoutRunnerEvent(workout: Record<string, unknown>, code: string) {
  const commentary = ensureWorkoutCommentaryRecord(workout);
  commentary.runnerEvents = Array.isArray(commentary.runnerEvents)
    ? [...commentary.runnerEvents, createWorkoutCommentaryEvent(code)]
    : [createWorkoutCommentaryEvent(code)];
}

function appendWorkoutAdaptationEvent(
  workout: Record<string, unknown>,
  code: string
) {
  const commentary = ensureWorkoutCommentaryRecord(workout);
  commentary.adaptationEvents = Array.isArray(commentary.adaptationEvents)
    ? [...commentary.adaptationEvents, createWorkoutCommentaryEvent(code)]
    : [createWorkoutCommentaryEvent(code)];
}

function getWorkoutCommentaryState(workout: Record<string, unknown>) {
  return (
    getLegacyWindow()?.buildTrainingCommentaryState?.({ workout }) || {
      workout,
      runnerEvents: [],
    }
  );
}

function getRunnerToastText(workout: Record<string, unknown>, mode: string) {
  const runnerToast =
    getLegacyWindow()?.presentTrainingCommentary?.(
      getWorkoutCommentaryState(workout),
      'runner_toast'
    ) || null;
  return (
    String(runnerToast?.text || '') ||
    translateWorkoutText(
      mode === 'shorten'
        ? 'workout.runner.shorten_toast'
        : 'workout.runner.light_toast',
      mode === 'shorten'
        ? 'Session shortened to the essential work'
        : 'Remaining work lightened'
    )
  );
}

function showNoQuickAdjustmentChangeToast(workout: Record<string, unknown>) {
  const currentState = getWorkoutCommentaryState(workout);
  const emptyToast =
    getLegacyWindow()?.presentTrainingCommentary?.(
      {
        ...currentState,
        runnerEvents: [{ code: 'runner_no_change', params: {} }],
      },
      'runner_toast'
    ) || null;
  getLegacyWindow()?.showToast?.(
    String(emptyToast?.text || '') ||
      translateWorkoutText(
        'workout.runner.no_change',
        'No remaining work needed adjustment'
      ),
    'var(--muted)'
  );
}

function refreshQuickWorkoutAdjustmentViews() {
  const runtimeWindow = getLegacyWindow();
  if (isReactLogActive()) runtimeWindow?.notifyLogActiveIsland?.();
  else runtimeWindow?.renderExercises?.();
  syncLegacyWorkoutSessionBridge();
  syncStoreFromLegacy();
}

function executeQuickWorkoutAdjustmentFromStore(
  mode: string,
  detailLevel?: string
) {
  const workout = getActiveWorkoutSession();
  const exercises = Array.isArray(workout?.exercises)
    ? (workout.exercises as Array<Record<string, unknown>>)
    : null;
  if (!workout || !exercises?.length) return;
  ensureWorkoutCommentaryRecord(workout);
  const runnerState =
    workout.runnerState && typeof workout.runnerState === 'object'
      ? (workout.runnerState as Record<string, unknown>)
      : {};
  const previousSnapshot = {
    exercises: cloneJsonValue(exercises),
    mode:
      String(runnerState.mode || '') ||
      String((workout.planningDecision as Record<string, unknown> | undefined)?.action || '') ||
      'train',
    adjustments: Array.isArray(runnerState.adjustments)
      ? cloneJsonValue(runnerState.adjustments)
      : [],
    commentary: workout.commentary ? cloneJsonValue(workout.commentary) : null,
  };
  const nextExercises = cloneJsonValue(exercises);
  let changed = false;
  if (mode === 'shorten') {
    const level = detailLevel || 'medium';
    if (level === 'light') {
      nextExercises.forEach((exercise) => {
        if (exercise.isAccessory === true && trimExerciseRemainingSets(exercise, 0)) {
          changed = true;
        }
      });
    } else {
      nextExercises.forEach((exercise) => {
        if (exercise.isAccessory === true) {
          if (trimExerciseRemainingSets(exercise, 0)) changed = true;
          return;
        }
        if (
          trimExerciseRemainingSets(
            exercise,
            Math.max(0, 2 - getCompletedWorkSetCount(exercise))
          )
        ) {
          changed = true;
        }
      });
      if (level === 'hard' && dropTrailingUnstartedExercise(nextExercises)) {
        changed = true;
      }
    }
  } else if (mode === 'lighten') {
    nextExercises.forEach((exercise) => {
      if (trimOneExtraRemainingSet(exercise, 'lighten')) changed = true;
      getWorkoutExerciseSets(exercise).forEach((set) => {
        if (reduceRemainingSetTarget(set)) changed = true;
      });
    });
  }
  if (!changed) {
    showNoQuickAdjustmentChangeToast(workout);
    syncStoreFromLegacy();
    return;
  }
  workout.exercises = cleanupAdjustedWorkoutExercises(nextExercises);
  const nextRunnerState =
    workout.runnerState && typeof workout.runnerState === 'object'
      ? (workout.runnerState as Record<string, unknown>)
      : {};
  workout.runnerState = nextRunnerState;
  nextRunnerState.mode = mode === 'lighten' ? 'lighten' : 'shorten';
  nextRunnerState.undoSnapshot = previousSnapshot;
  nextRunnerState.adjustments = Array.isArray(nextRunnerState.adjustments)
    ? nextRunnerState.adjustments
    : [];
  (nextRunnerState.adjustments as Array<Record<string, unknown>>).push({
    type: mode,
    at: new Date().toISOString(),
    detailLevel: detailLevel || undefined,
    label: getRunnerAdjustmentLabel(mode),
  });
  const eventCode = mode === 'shorten' ? 'runner_shorten' : 'runner_lighten';
  appendWorkoutAdaptationEvent(workout, eventCode);
  appendWorkoutRunnerEvent(workout, eventCode);
  getLegacyWindow()?.showToast?.(getRunnerToastText(workout, mode), 'var(--blue)');
  persistCurrentWorkoutDraft();
  refreshQuickWorkoutAdjustmentViews();
}

function applyQuickWorkoutAdjustmentFromStore(
  mode: string,
  detailLevel?: string
) {
  const normalizedMode = mode === 'shorten' ? 'shorten' : 'lighten';
  if (normalizedMode === 'shorten' && !detailLevel) {
    getLegacyWindow()?.showShortenAdjustmentOptions?.();
    return;
  }
  if (normalizedMode === 'lighten' && !detailLevel) {
    const preview = getQuickAdjustmentPreview(normalizedMode);
    getLegacyWindow()?.showConfirm?.(preview.title, preview.body, () => {
      executeQuickWorkoutAdjustmentFromStore(normalizedMode);
    });
    return;
  }
  executeQuickWorkoutAdjustmentFromStore(normalizedMode, detailLevel);
}

function undoQuickWorkoutAdjustmentFromStore() {
  const workout = getActiveWorkoutSession();
  const runnerState =
    workout?.runnerState && typeof workout.runnerState === 'object'
      ? (workout.runnerState as Record<string, unknown>)
      : null;
  const snapshot =
    runnerState?.undoSnapshot && typeof runnerState.undoSnapshot === 'object'
      ? (runnerState.undoSnapshot as Record<string, unknown>)
      : null;
  if (!workout || !runnerState || !snapshot) return;
  workout.exercises = cloneJsonValue(snapshot.exercises || []);
  if (snapshot.commentary) {
    workout.commentary = cloneJsonValue(snapshot.commentary);
  }
  runnerState.mode =
    String(snapshot.mode || '') ||
    String((workout.planningDecision as Record<string, unknown> | undefined)?.action || '') ||
    'train';
  runnerState.adjustments = Array.isArray(snapshot.adjustments)
    ? cloneJsonValue(snapshot.adjustments)
    : [];
  delete runnerState.undoSnapshot;
  appendWorkoutRunnerEvent(workout, 'runner_undo');
  persistCurrentWorkoutDraft();
  refreshQuickWorkoutAdjustmentViews();
  const undoToast =
    getLegacyWindow()?.presentTrainingCommentary?.(
      getWorkoutCommentaryState(workout),
      'runner_toast'
    ) || null;
  getLegacyWindow()?.showToast?.(
    String(undoToast?.text || '') ||
      translateWorkoutText('workout.runner.undo_toast', 'Last adjustment undone'),
    'var(--blue)'
  );
}

function cancelWorkoutFromStore() {
  const runtime = getWorkoutRuntime();
  const runtimeWindow = getLegacyWindow();
  const cancelTeardownPlan =
    runtime?.buildWorkoutTeardownPlan?.(
      {
        mode: 'cancel',
      },
      {
        t: translateWorkoutText,
      }
    ) || null;
  runtimeWindow?.applyWorkoutTeardownPlan?.(cancelTeardownPlan, {
    showDiscardToast: true,
  });
  syncStoreFromLegacy();
}

function getWorkoutElapsedSeconds(workout: Record<string, unknown>) {
  const startTime = Number(workout.startTime || 0);
  if (!startTime) return 0;
  return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
}

function getWorkoutPrCount(workout: Record<string, unknown>) {
  const rewardState =
    workout.rewardState && typeof workout.rewardState === 'object'
      ? (workout.rewardState as Record<string, unknown>)
      : null;
  return Array.isArray(rewardState?.detectedPrs)
    ? rewardState.detectedPrs.length
    : 0;
}

function cloneTrainingDecision(decision: unknown) {
  return decision && typeof decision === 'object'
    ? cloneJsonValue(decision as Record<string, unknown>)
    : null;
}

function stripWarmupSetsFromExercises(
  exercises: Array<Record<string, unknown>>
) {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: getWorkoutExerciseSets(exercise).filter(
      (set) => set.isWarmup !== true
    ),
  }));
}

function getWeekStartFallback(date?: Date | string | number | null) {
  const nextDate = new Date(date || new Date());
  nextDate.setDate(nextDate.getDate() - ((nextDate.getDay() + 6) % 7));
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function requestSessionRpe() {
  const runtimeWindow = getLegacyWindow();
  return new Promise<number>((resolve) => {
    if (typeof runtimeWindow?.showRPEPicker !== 'function') {
      resolve(7);
      return;
    }
    runtimeWindow.showRPEPicker(
      translateWorkoutText('common.session', 'Session'),
      -1,
      (value) => resolve(Number(value) || 7)
    );
  });
}

async function finishWorkoutFromStore() {
  const runtime = getWorkoutRuntime();
  const runtimeWindow = getLegacyWindow();
  const workout = getActiveWorkoutSession();
  if (finishWorkoutInProgress) return undefined;
  if (!runtime || !workout || !Array.isArray(workout.exercises)) {
    showWorkoutFinishFailure();
    return false;
  }
  const exercises = workout.exercises as Array<Record<string, unknown>>;
  if (!exercises.length) {
    runtimeWindow?.showToast?.(
      translateWorkoutText('workout.add_at_least_one', 'Add at least one exercise!'),
      'var(--orange)'
    );
    return false;
  }

  finishWorkoutInProgress = true;
  try {
    workout.exercises = runtime.sanitizeWorkoutExercisesForSave({
      exercises,
      withResolvedExerciseId: (exercise: unknown) => {
        if (!exercise || typeof exercise !== 'object') return exercise;
        const nextExercise = exercise as Record<string, unknown>;
        const exerciseId =
          nextExercise.exerciseId ||
          runtimeWindow?.resolveRegisteredExerciseId?.(nextExercise.name) ||
          null;
        return {
          ...nextExercise,
          exerciseId,
        };
      },
    });

    const sessionRPE = await requestSessionRpe();
    const activeWorkout = getActiveWorkoutSession();
    if (!activeWorkout || !Array.isArray(activeWorkout.exercises)) {
      throw new Error('Active workout disappeared during finish flow.');
    }

    const prog = runtimeWindow?.getActiveProgram?.();
    if (!prog) {
      showWorkoutFinishFailure();
      return false;
    }
    const programId = String(prog.id || '');
    const programName =
      runtimeWindow?.I18N?.t?.(
        `program.${programId}.name`,
        null,
        String(prog.name || 'Training')
      ) || String(prog.name || 'Training');
    const state = runtimeWindow?.getActiveProgramState?.() || {};
    activeWorkout.finishWorkoutId = activeWorkout.finishWorkoutId || Date.now();
    const workoutId = activeWorkout.finishWorkoutId;
    const workoutDate = new Date().toISOString();
    ensureWorkoutCommentaryRecord(activeWorkout);
    const legacyWorkouts =
      readLegacyRuntimeValue<Array<Record<string, unknown>>>('workouts') || [];
    const workouts = Array.isArray(legacyWorkouts) ? legacyWorkouts : [];
    const finishPlan = runtime.buildWorkoutFinishPlan(
      {
        prog,
        workoutId,
        workoutDate,
        activeWorkout,
        state,
        workouts,
        programName,
        prCount: getWorkoutPrCount(activeWorkout),
        duration: getWorkoutElapsedSeconds(activeWorkout),
        sessionRPE,
      },
      {
        cloneTrainingDecision,
        stripWarmupSetsFromExercises:
          runtimeWindow?.stripWarmupSetsFromExercises ||
          stripWarmupSetsFromExercises,
        getWeekStart: runtimeWindow?.getWeekStart || getWeekStartFallback,
        parseLoggedRepCount,
        t: translateWorkoutText,
      }
    );
    if (!finishPlan) {
      showWorkoutFinishFailure();
      return false;
    }
    const saveWorkoutsWithLegacySync = async () => {
      writeLegacyRuntimeValue('workouts', workouts);
      await Promise.resolve(runtimeWindow?.saveWorkouts?.());
    };
    await runtime.commitWorkoutFinishPersistence(
      {
        prog,
        finishPlan,
        workouts,
      },
      {
        logWarn: runtimeWindow?.logWarn || console.warn,
        showToast: runtimeWindow?.showToast,
        setTimer: (callback: () => void, delay?: number) =>
          window.setTimeout(callback, delay),
        t: translateWorkoutText,
        setProgramState: runtimeWindow?.setProgramState,
        saveProfileData: runtimeWindow?.saveProfileData,
        upsertWorkoutRecord: runtimeWindow?.upsertWorkoutRecord,
        saveWorkouts: saveWorkoutsWithLegacySync,
        buildExerciseIndex: () => {
          writeLegacyRuntimeValue('workouts', workouts);
          runtimeWindow?.buildExerciseIndex?.();
        },
      }
    );
    writeLegacyRuntimeValue('workouts', workouts);
    runtimeWindow?.applyWorkoutTeardownPlan?.(finishPlan.finishTeardownPlan, {
      renderTimer: true,
    });
    const summaryResult = await Promise.resolve(
      runtimeWindow?.showSessionSummary?.(finishPlan.summaryData || {}) || null
    );
    const postWorkoutOutcome = runtime.buildPostWorkoutOutcome(
      {
        savedWorkout: finishPlan.savedWorkout,
        summaryResult,
        summaryData: finishPlan.summaryData || {},
      },
      {
        inferDurationSignal:
          runtimeWindow?.inferDurationSignal ||
          ((value?: Record<string, unknown> | null) =>
            String(value?.durationSignal || '')),
        t: translateWorkoutText,
        formatWorkoutWeight: formatWorkoutWeightForToast,
      }
    );
    await runtime.applyPostWorkoutOutcomeEffects(
      {
        postWorkoutOutcome,
        summaryData: finishPlan.summaryData || {},
      },
      {
        saveWorkouts: saveWorkoutsWithLegacySync,
        showToast: runtimeWindow?.showToast,
        setTimer: (callback: () => void, delay?: number) =>
          window.setTimeout(callback, delay),
        setNutritionSessionContext: runtimeWindow?.setNutritionSessionContext,
        getRuntimeBridge: runtimeWindow?.getRuntimeBridge,
        showPage: runtimeWindow?.showPage,
      }
    );
    syncStoreFromLegacy();
    return true;
  } catch (error) {
    showWorkoutFinishFailure(error);
    return false;
  } finally {
    finishWorkoutInProgress = false;
  }
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
      addExerciseByNameFromStore(name);
    },
    applyQuickWorkoutAdjustment: (mode, detailLevel) => {
      applyQuickWorkoutAdjustmentFromStore(mode, detailLevel);
    },
    undoQuickWorkoutAdjustment: () => {
      undoQuickWorkoutAdjustmentFromStore();
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
      return finishWorkoutFromStore();
    },
    cancelWorkout: () => {
      cancelWorkoutFromStore();
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
  installStoreDelegator('applyQuickWorkoutAdjustment', (mode, detailLevel) =>
    workoutStore
      .getState()
      .applyQuickWorkoutAdjustment(String(mode ?? ''), String(detailLevel ?? ''))
  );
  installStoreDelegator('undoQuickWorkoutAdjustment', () =>
    workoutStore.getState().undoQuickWorkoutAdjustment()
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
