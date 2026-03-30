import { normalizeWorkoutStartSnapshot } from '../../domain/workout-helpers';

type MutableRecord = Record<string, unknown>;

type WorkoutToastPlan = {
  text: string;
  color: string;
  delay?: number;
};

type PostWorkoutSummaryResult = {
  feedback?: string;
  notes?: string;
  goToNutrition?: boolean;
};

type PostWorkoutOutcomeInput = {
  savedWorkout?: MutableRecord | null;
  summaryResult?: PostWorkoutSummaryResult | null;
  summaryData?: MutableRecord | null;
};

type PostWorkoutOutcomeResult = {
  shouldSaveWorkouts: boolean;
  tmAdjustmentToast: string;
  goToNutrition: boolean;
  nutritionContext: MutableRecord | null;
  durationSignal?: string | null;
};

type WorkoutStartPresentationInput = {
  activeWorkout?: MutableRecord | null;
  isBonus?: boolean;
  title?: string;
  programLabel?: string;
  programName?: string;
  sessionDescription?: string;
  effectiveDecision?: MutableRecord | null;
  planningContext?: MutableRecord | null;
  startSnapshot?: MutableRecord | null;
  schedule?: MutableRecord | null;
  legLifts?: Array<unknown>;
  isSportDay?: boolean;
  hadSportRecently?: boolean;
  isDeload?: boolean;
};

type WorkoutStartPresentationResult = {
  title: string;
  descriptionText: string;
  descriptionVisible: boolean;
  immediateToast: WorkoutToastPlan;
  queuedToasts: WorkoutToastPlan[];
};

type WorkoutTeardownPlanInput = {
  mode?: 'finish' | 'cancel' | string;
};

type WorkoutTeardownPlanResult = {
  showNotStarted: boolean;
  hideActive: boolean;
  resetNotStartedView: boolean;
  notifyLogActive: boolean;
  updateDashboard: boolean;
  discardToast: string;
};

type WorkoutRuntimeApi = {
  getWorkoutStartSnapshotSignature: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => string;
  buildWorkoutStartSnapshot: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  buildSessionSummaryStats: (
    summaryData?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Array<Record<string, unknown>>;
  buildSavedWorkoutRecord: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  buildSessionSummaryData: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  buildBonusActiveWorkout: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  buildPlannedActiveWorkout: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  sanitizeSetValue: (field: unknown, raw: unknown) => string | number;
  applySetUpdateMutation: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  toggleWorkoutSetCompletion: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  appendWorkoutSet: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  removeWorkoutExercise: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  sanitizeWorkoutExercisesForSave: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Array<Record<string, unknown>>;
  buildProgramTmAdjustments: (
    stateBefore?: Record<string, unknown> | null,
    stateAfter?: Record<string, unknown> | null
  ) => Array<Record<string, unknown>>;
  buildWorkoutProgressionResult: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  buildCoachNote: (
    input?: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => string;
  buildTmAdjustmentToast: (
    adjustments?: Array<Record<string, unknown>> | null,
    deps?: Record<string, unknown>
  ) => string;
  buildPostWorkoutOutcome: (
    input?: PostWorkoutOutcomeInput,
    deps?: Record<string, unknown>
  ) => PostWorkoutOutcomeResult;
  buildWorkoutStartPresentation: (
    input?: WorkoutStartPresentationInput,
    deps?: Record<string, unknown>
  ) => WorkoutStartPresentationResult;
  buildWorkoutTeardownPlan: (
    input?: WorkoutTeardownPlanInput,
    deps?: Record<string, unknown>
  ) => WorkoutTeardownPlanResult;
};

type WorkoutRuntimeWindow = Window & {
  __IRONFORGE_WORKOUT_RUNTIME__?: WorkoutRuntimeApi;
};

function getRuntimeWindow(): WorkoutRuntimeWindow | null {
  if (typeof window === 'undefined') return null;
  return window as WorkoutRuntimeWindow;
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function readNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readFunction<T extends (...args: any[]) => any>(
  deps: Record<string, unknown> | undefined,
  key: string
) {
  const target = deps?.[key];
  return typeof target === 'function' ? (target as T) : null;
}

function sanitizeSetValue(field: unknown, raw: unknown) {
  if (field === 'weight') {
    const n = parseFloat(String(raw ?? ''));
    return Number.isNaN(n)
      ? ''
      : Math.max(0, Math.min(999, Math.round(n * 10) / 10));
  }
  if (field === 'reps') {
    const n = parseInt(String(raw ?? ''), 10);
    return Number.isNaN(n) ? '' : Math.max(0, Math.min(999, n));
  }
  if (field === 'rir') return typeof raw === 'string' || typeof raw === 'number' ? raw : '';
  return typeof raw === 'string' || typeof raw === 'number' ? raw : '';
}

function applySetUpdateMutation(input?: Record<string, unknown>) {
  const next = input || {};
  const exercise =
    next.exercise && typeof next.exercise === 'object'
      ? (next.exercise as MutableRecord)
      : null;
  const setIndex = parseInt(String(next.setIndex ?? -1), 10);
  const field = String(next.field || '');
  if (!exercise || !Array.isArray(exercise.sets)) return null;
  if (setIndex < 0 || setIndex >= exercise.sets.length) return null;
  const set =
    exercise.sets[setIndex] && typeof exercise.sets[setIndex] === 'object'
      ? (exercise.sets[setIndex] as MutableRecord)
      : null;
  if (!set) return null;

  const sanitizedValue = sanitizeSetValue(field, next.rawValue);
  const shouldRefreshDoneSet =
    set.done === true &&
    set.isWarmup !== true &&
    (field === 'weight' || field === 'reps');
  set[field] = sanitizedValue;

  const propagatedSetIndexes: number[] = [];
  if (field === 'weight' && set.isWarmup !== true) {
    for (let nextIndex = setIndex + 1; nextIndex < exercise.sets.length; nextIndex++) {
      const nextSet =
        exercise.sets[nextIndex] && typeof exercise.sets[nextIndex] === 'object'
          ? (exercise.sets[nextIndex] as MutableRecord)
          : null;
      if (!nextSet || nextSet.done === true || nextSet.isWarmup === true) continue;
      nextSet.weight = sanitizedValue;
      propagatedSetIndexes.push(nextIndex);
    }
  }

  return {
    exercise,
    set,
    sanitizedValue,
    shouldRefreshDoneSet,
    propagatedSetIndexes,
  };
}

function toggleWorkoutSetCompletion(input?: Record<string, unknown>) {
  const next = input || {};
  const exercise =
    next.exercise && typeof next.exercise === 'object'
      ? (next.exercise as MutableRecord)
      : null;
  const setIndex = parseInt(String(next.setIndex ?? -1), 10);
  if (!exercise || !Array.isArray(exercise.sets)) return null;
  if (setIndex < 0 || setIndex >= exercise.sets.length) return null;
  const set =
    exercise.sets[setIndex] && typeof exercise.sets[setIndex] === 'object'
      ? (exercise.sets[setIndex] as MutableRecord)
      : null;
  if (!set) return null;

  const isNowDone = set.done !== true;
  set.done = isNowDone;
  if (!isNowDone) {
    set.rir = undefined;
  }

  return {
    exercise,
    set,
    isNowDone,
  };
}

function appendWorkoutSet(input?: Record<string, unknown>) {
  const next = input || {};
  const exercise =
    next.exercise && typeof next.exercise === 'object'
      ? (next.exercise as MutableRecord)
      : null;
  if (!exercise) return null;
  if (!Array.isArray(exercise.sets)) {
    exercise.sets = [];
  }
  const sets = exercise.sets as Array<Record<string, unknown>>;
  const lastSet =
    sets.length > 0 && sets[sets.length - 1] && typeof sets[sets.length - 1] === 'object'
      ? (sets[sets.length - 1] as MutableRecord)
      : null;
  sets.push({
    weight: lastSet?.weight || '',
    reps: lastSet?.reps || 5,
    done: false,
    rpe: null,
  });

  return {
    exercise,
    newSetIndex: sets.length - 1,
  };
}

function removeWorkoutExercise(input?: Record<string, unknown>) {
  const next = input || {};
  const exercises = Array.isArray(next.exercises)
    ? (next.exercises as Array<Record<string, unknown>>)
    : null;
  const exerciseIndex = parseInt(String(next.exerciseIndex ?? -1), 10);
  if (!exercises || exerciseIndex < 0 || exerciseIndex >= exercises.length) {
    return null;
  }

  const removed = exercises.splice(exerciseIndex, 1)[0] || null;
  return {
    exercises,
    removed,
  };
}

function sanitizeWorkoutExercisesForSave(input?: Record<string, unknown>) {
  const next = input || {};
  const rawExercises = Array.isArray(next.exercises)
    ? (next.exercises as Array<Record<string, unknown>>)
    : [];
  const resolveExerciseId =
    typeof next.withResolvedExerciseId === 'function'
      ? (next.withResolvedExerciseId as (
          exercise: Record<string, unknown>
        ) => Record<string, unknown>)
      : null;

  return rawExercises.map((exercise) => {
    const resolved = resolveExerciseId?.(exercise) || exercise;
    const nextExercise =
      resolved && typeof resolved === 'object'
        ? (resolved as MutableRecord)
        : ({} as MutableRecord);
    const sets = Array.isArray(nextExercise.sets) ? nextExercise.sets : [];
    nextExercise.sets = sets.map((setLike) => {
      const set =
        setLike && typeof setLike === 'object'
          ? ({ ...(setLike as MutableRecord) } as MutableRecord)
          : ({} as MutableRecord);
      set.weight = sanitizeSetValue('weight', set.weight);
      if (set.reps !== 'AMRAP') {
        set.reps = sanitizeSetValue('reps', set.reps);
      }
      return set;
    });
    return nextExercise as Record<string, unknown>;
  });
}

function buildProgramTmAdjustments(
  stateBefore?: Record<string, unknown> | null,
  stateAfter?: Record<string, unknown> | null
) {
  const adjustments: Array<Record<string, unknown>> = [];
  if (!stateBefore || !stateAfter) return adjustments;
  const beforeLifts =
    stateBefore.lifts && typeof stateBefore.lifts === 'object'
      ? (stateBefore.lifts as MutableRecord)
      : null;
  const afterLifts =
    stateAfter.lifts && typeof stateAfter.lifts === 'object'
      ? (stateAfter.lifts as MutableRecord)
      : null;
  const beforeMain = Array.isArray(beforeLifts?.main)
    ? (beforeLifts.main as Array<MutableRecord>)
    : [];
  const afterMain = Array.isArray(afterLifts?.main)
    ? (afterLifts.main as Array<MutableRecord>)
    : [];
  beforeMain.forEach((lift, index) => {
    const after = afterMain[index];
    if (!after || lift.name !== after.name) return;
    const delta = readNumber(after.tm) - readNumber(lift.tm);
    if (delta === 0) return;
    adjustments.push({
      lift: lift.name,
      oldTM: lift.tm,
      newTM: after.tm,
      delta,
      direction: delta > 0 ? 'up' : 'down',
    });
  });

  const beforeAux = Array.isArray(beforeLifts?.aux)
    ? (beforeLifts.aux as Array<MutableRecord>)
    : [];
  const afterAux = Array.isArray(afterLifts?.aux)
    ? (afterLifts.aux as Array<MutableRecord>)
    : [];
  beforeAux.forEach((lift, index) => {
    const after = afterAux[index];
    if (!after || lift.name !== after.name) return;
    const delta = readNumber(after.tm) - readNumber(lift.tm);
    if (delta === 0) return;
    adjustments.push({
      lift: lift.name,
      oldTM: lift.tm,
      newTM: after.tm,
      delta,
      direction: delta > 0 ? 'up' : 'down',
    });
  });

  if (beforeLifts && !Array.isArray(beforeLifts.main)) {
    Object.keys(beforeLifts).forEach((key) => {
      const before = beforeLifts[key];
      const after = afterLifts?.[key];
      if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {
        return;
      }
      const beforeRecord = before as MutableRecord;
      const afterRecord = after as MutableRecord;
      const beforeValue =
        beforeRecord.tm !== undefined ? beforeRecord.tm : beforeRecord.weight;
      const afterValue =
        afterRecord.tm !== undefined ? afterRecord.tm : afterRecord.weight;
      if (beforeValue === undefined || afterValue === undefined) return;
      const delta = readNumber(afterValue) - readNumber(beforeValue);
      if (delta === 0) return;
      adjustments.push({
        lift: key.charAt(0).toUpperCase() + key.slice(1),
        oldTM: beforeValue,
        newTM: afterValue,
        delta,
        direction: delta > 0 ? 'up' : 'down',
      });
    });
  }

  return adjustments;
}

function buildWorkoutProgressionResult(
  input?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = input || {};
  const prog =
    next.prog && typeof next.prog === 'object'
      ? (next.prog as MutableRecord)
      : null;
  const activeWorkout =
    next.activeWorkout && typeof next.activeWorkout === 'object'
      ? (next.activeWorkout as MutableRecord)
      : null;
  const state =
    next.state && typeof next.state === 'object'
      ? (next.state as MutableRecord)
      : null;
  const progressionSourceState =
    next.progressionSourceState && typeof next.progressionSourceState === 'object'
      ? (next.progressionSourceState as MutableRecord)
      : null;
  const workouts = Array.isArray(next.workouts)
    ? (next.workouts as Array<Record<string, unknown>>)
    : [];
  const stripWarmupSetsFromExercises = readFunction<
    (exercises: Array<Record<string, unknown>>) => Array<Record<string, unknown>>
  >(deps, 'stripWarmupSetsFromExercises');
  const getWeekStart = readFunction<(date: Date) => Date>(deps, 'getWeekStart');

  if (!prog || !activeWorkout || !state || !progressionSourceState) {
    return {
      advancedState: state || {},
      newState: state || {},
      programStateAfter: state ? cloneJson(state) : {},
      tmAdjustments: [],
      programHookFailed: false,
    };
  }

  if (activeWorkout.isBonus === true) {
    return {
      advancedState: state,
      newState: state,
      programStateAfter: cloneJson(state),
      tmAdjustments: [],
      programHookFailed: false,
    };
  }

  try {
    const sourceExercises = Array.isArray(activeWorkout.exercises)
      ? (activeWorkout.exercises as Array<Record<string, unknown>>)
      : [];
    const exercisesForProgression =
      stripWarmupSetsFromExercises?.(sourceExercises) ||
      sourceExercises.map((exercise) => ({
        ...exercise,
        sets: Array.isArray(exercise.sets)
          ? exercise.sets.filter((set) => set?.isWarmup !== true)
          : [],
      }));
    const newState =
      typeof prog.adjustAfterSession === 'function'
        ? (prog.adjustAfterSession(
            exercisesForProgression,
            progressionSourceState,
            activeWorkout.programOption
          ) as Record<string, unknown>)
        : progressionSourceState;
    const tmAdjustments = buildProgramTmAdjustments(
      progressionSourceState,
      newState
    );
    const sow = getWeekStart?.(new Date()) || new Date();
    const sessionsThisWeek = workouts.filter((workout) => {
      const programId = String(workout.program || workout.type || '');
      return (
        programId === String(prog.id || '') &&
        new Date(String(workout.date || '')) >= sow &&
        workout.isBonus !== true
      );
    }).length;
    const advancedState =
      typeof prog.advanceState === 'function'
        ? (prog.advanceState(
            newState,
            sessionsThisWeek
          ) as Record<string, unknown>)
        : newState;

    return {
      advancedState,
      newState,
      programStateAfter: cloneJson(advancedState),
      tmAdjustments,
      programHookFailed: false,
    };
  } catch (error) {
    return {
      advancedState: state,
      newState: state,
      programStateAfter: cloneJson(state),
      tmAdjustments: [],
      programHookFailed: true,
      error,
    };
  }
}

function formatWorkoutWeightValue(value: unknown) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  if (!Number.isFinite(rounded)) return '0';
  return String(rounded).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function buildTmAdjustmentCoachSummary(
  adjustments?: Array<Record<string, unknown>> | null,
  deps?: Record<string, unknown>
) {
  const t = readFunction<
    (key: string, fallback: string, params?: Record<string, unknown>) => string
  >(deps, 't');
  const formatWeight = readFunction<(value: unknown) => string>(
    deps,
    'formatWorkoutWeight'
  );
  const items = Array.isArray(adjustments) ? adjustments.slice(0, 2) : [];
  if (!items.length) return '';
  return items
    .map((adj) =>
      t?.(
        adj.direction === 'up'
          ? 'workout.coach_note.tm_adjustment_up'
          : 'workout.coach_note.tm_adjustment_down',
        adj.direction === 'up'
          ? '{lift} TM ↑ {tm} kg (+{delta})'
          : '{lift} TM ↓ {tm} kg (-{delta})',
        {
          lift: adj.lift,
          tm: formatWeight?.(adj.newTM) || formatWorkoutWeightValue(adj.newTM),
          delta:
            formatWeight?.(Math.abs(readNumber(adj.delta))) ||
            formatWorkoutWeightValue(Math.abs(readNumber(adj.delta))),
        }
      ) || ''
    )
    .join(' · ');
}

function buildCoachNote(
  input?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = input || {};
  const t = readFunction<
    (key: string, fallback: string, params?: Record<string, unknown>) => string
  >(deps, 't');
  let note = '';

  const summaryData =
    next.summaryData && typeof next.summaryData === 'object'
      ? (next.summaryData as MutableRecord)
      : {};
  const stateBeforeSession =
    next.stateBeforeSession && typeof next.stateBeforeSession === 'object'
      ? (next.stateBeforeSession as MutableRecord)
      : null;
  const advancedState =
    next.advancedState && typeof next.advancedState === 'object'
      ? (next.advancedState as MutableRecord)
      : null;
  const workout =
    next.workout && typeof next.workout === 'object'
      ? (next.workout as MutableRecord)
      : null;

  const rewardState =
    workout?.rewardState && typeof workout.rewardState === 'object'
      ? (workout.rewardState as MutableRecord)
      : null;
  const prs = Array.isArray(rewardState?.detectedPrs)
    ? (rewardState.detectedPrs as Array<Record<string, unknown>>)
    : [];
  if (prs.length > 0) {
    const names = [...new Set(prs.map((pr) => String(pr.exerciseName || '')))]
      .filter(Boolean)
      .slice(0, 2);
    const label = names.join(' & ');
    note =
      prs.length === 1
        ? t?.(
            'workout.coach_note.pr_single',
            'New PR on {exercise}! Keep going.',
            { exercise: label }
          ) || ''
        : t?.(
            'workout.coach_note.pr_multi',
            'New PRs on {exercises}! Great session.',
            { exercises: label }
          ) || '';
  }

  if (
    !note &&
    advancedState?.week !== undefined &&
    stateBeforeSession?.week !== undefined &&
    advancedState.week !== stateBeforeSession.week
  ) {
    note =
      t?.(
        'workout.coach_note.week_advance',
        'Week {week} starts now. Build on it.',
        { week: advancedState.week }
      ) || '';
  }

  if (
    !note &&
    advancedState?.cycle !== undefined &&
    stateBeforeSession?.cycle !== undefined &&
    advancedState.cycle !== stateBeforeSession.cycle
  ) {
    note =
      t?.(
        'workout.coach_note.cycle_advance',
        'Cycle {cycle} starts — new progression block.',
        { cycle: advancedState.cycle }
      ) || '';
  }

  const completionRate =
    readNumber(summaryData.totalSets, 0) > 0
      ? readNumber(summaryData.completedSets, 0) / readNumber(summaryData.totalSets, 0)
      : 1;
  const rpe = readNumber(summaryData.rpe, 0);

  if (!note && rpe >= 9 && completionRate < 0.9) {
    note =
      t?.(
        'workout.coach_note.tough_session',
        'Tough session — rest well and come back strong.'
      ) || '';
  }

  if (!note && completionRate < 0.7) {
    note =
      t?.(
        'workout.coach_note.partial_session',
        'Partial session logged. Any training counts — consistency wins.'
      ) || '';
  }

  if (!note) {
    note =
      t?.('workout.coach_note.clean', 'All sets done. Solid work.') ||
      'All sets done. Solid work.';
  }

  const tmSummary = buildTmAdjustmentCoachSummary(
    Array.isArray(summaryData.tmAdjustments)
      ? (summaryData.tmAdjustments as Array<Record<string, unknown>>)
      : [],
    deps
  );
  return tmSummary ? `${note} ${tmSummary}` : note;
}

function buildTmAdjustmentToast(
  adjustments?: Array<Record<string, unknown>> | null,
  deps?: Record<string, unknown>
) {
  const t = readFunction<
    (key: string, fallback: string, params?: Record<string, unknown>) => string
  >(deps, 't');
  const formatWeight = readFunction<(value: unknown) => string>(
    deps,
    'formatWorkoutWeight'
  );
  const items = Array.isArray(adjustments) ? adjustments : [];
  if (!items.length) return '';
  if (items.length === 1) {
    const adj = items[0];
    return (
      t?.(
        'workout.tm_updated_single',
        '{lift} TM updated: {old} → {next} kg',
        {
          lift: adj.lift,
          old: formatWeight?.(adj.oldTM) || formatWorkoutWeightValue(adj.oldTM),
          next: formatWeight?.(adj.newTM) || formatWorkoutWeightValue(adj.newTM),
        }
      ) || ''
    );
  }
  const changes = items
    .map(
      (adj) =>
        `${adj.lift} ${adj.direction === 'up' ? '\u2191' : '\u2193'} ${
          formatWeight?.(adj.newTM) || formatWorkoutWeightValue(adj.newTM)
        } kg`
    )
    .join(', ');
  return (
    t?.('workout.tm_updated_multi', 'TMs updated: {changes}', {
      changes,
    }) || ''
  );
}

function buildPostWorkoutOutcome(
  input?: PostWorkoutOutcomeInput,
  deps?: Record<string, unknown>
) : PostWorkoutOutcomeResult {
  const next = input || {};
  const savedWorkout =
    next.savedWorkout && typeof next.savedWorkout === 'object'
      ? (next.savedWorkout as MutableRecord)
      : null;
  const summaryResult =
    next.summaryResult && typeof next.summaryResult === 'object'
      ? (next.summaryResult as MutableRecord)
      : null;
  const summaryData =
    next.summaryData && typeof next.summaryData === 'object'
      ? (next.summaryData as MutableRecord)
      : null;
  const inferDurationSignal = readFunction<
    (workout: Record<string, unknown>) => string | null | undefined
  >(deps, 'inferDurationSignal');

  if (!savedWorkout) {
    return {
      shouldSaveWorkouts: false,
      tmAdjustmentToast: '',
      goToNutrition: false,
      nutritionContext: summaryData || null,
    };
  }

  if (summaryResult?.feedback) {
    savedWorkout.sessionFeedback = summaryResult.feedback;
  }
  if (summaryResult?.notes) {
    savedWorkout.sessionNotes = summaryResult.notes;
  }

  const durationSignal = inferDurationSignal?.(savedWorkout) || null;
  if (durationSignal) {
    savedWorkout.durationSignal = durationSignal;
  }

  const tmAdjustmentToast = buildTmAdjustmentToast(
    Array.isArray(savedWorkout.tmAdjustments)
      ? (savedWorkout.tmAdjustments as Array<Record<string, unknown>>)
      : [],
    deps
  );

  return {
    shouldSaveWorkouts:
      !!summaryResult?.feedback ||
      !!summaryResult?.notes ||
      !!savedWorkout.durationSignal,
    tmAdjustmentToast,
    goToNutrition: summaryResult?.goToNutrition === true,
    nutritionContext: summaryData || null,
    durationSignal,
  };
}

function buildWorkoutStartPresentation(
  input?: WorkoutStartPresentationInput,
  deps?: Record<string, unknown>
) : WorkoutStartPresentationResult {
  const next = input || {};
  const t = readFunction<
    (key: string, fallback: string, params?: Record<string, unknown>) => string
  >(deps, 't');
  const getWorkoutCommentaryState = readFunction<
    (workoutLike: Record<string, unknown>) => Record<string, unknown> | null
  >(deps, 'getWorkoutCommentaryState');
  const presentTrainingCommentary = readFunction<
    (
      commentaryState: Record<string, unknown>,
      surface: string
    ) => Record<string, unknown> | null
  >(deps, 'presentTrainingCommentary');
  const getWorkoutDecisionSummary = readFunction<
    (
      effectiveDecision?: Record<string, unknown> | null,
      planningContext?: Record<string, unknown> | null
    ) => Record<string, unknown> | null
  >(deps, 'getWorkoutDecisionSummary');
  const getTrainingToastColor = readFunction<
    (value?: Record<string, unknown> | null) => string
  >(deps, 'getTrainingToastColor');

  const activeWorkout =
    next.activeWorkout && typeof next.activeWorkout === 'object'
      ? (next.activeWorkout as MutableRecord)
      : null;
  const isBonus = next.isBonus === true;
  const title = String(next.title || next.programLabel || '');
  const sessionDescription = String(next.sessionDescription || '');
  const effectiveDecision =
    next.effectiveDecision && typeof next.effectiveDecision === 'object'
      ? (next.effectiveDecision as MutableRecord)
      : null;
  const planningContext =
    next.planningContext && typeof next.planningContext === 'object'
      ? (next.planningContext as MutableRecord)
      : null;
  const startSnapshot =
    next.startSnapshot && typeof next.startSnapshot === 'object'
      ? (next.startSnapshot as MutableRecord)
      : null;
  const schedule =
    next.schedule && typeof next.schedule === 'object'
      ? (next.schedule as MutableRecord)
      : null;
  const legLifts = Array.isArray(next.legLifts)
    ? (next.legLifts as Array<unknown>)
    : [];

  if (isBonus) {
    return {
      title,
      descriptionText: sessionDescription,
      descriptionVisible: !!sessionDescription,
      immediateToast: {
        text:
          t?.('workout.bonus.toast_started', 'Bonus workout started!') ||
          'Bonus workout started!',
        color: 'var(--purple)',
      },
      queuedToasts: [],
    };
  }

  const isDeload = next.isDeload === true;
  const programName = String(next.programName || title || 'Training');
  const commentaryState = activeWorkout
    ? getWorkoutCommentaryState?.(activeWorkout)
    : null;
  const decisionSummary = getWorkoutDecisionSummary?.(
    effectiveDecision,
    planningContext
  );
  const startToast =
    commentaryState && presentTrainingCommentary
      ? presentTrainingCommentary(commentaryState, 'workout_start_toast')
      : null;
  const decisionToastColor = getTrainingToastColor?.(
    startToast || commentaryState || null
  );
  const avoidHeavyLegs =
    Array.isArray(effectiveDecision?.restrictionFlags) &&
    effectiveDecision.restrictionFlags.includes('avoid_heavy_legs');
  const changeToastColor = avoidHeavyLegs
    ? 'var(--orange)'
    : decisionToastColor || 'var(--purple)';
  const queuedToasts: WorkoutToastPlan[] = [];
  const decisionToastNeeded =
    !!effectiveDecision &&
    (effectiveDecision.action !== 'train' || avoidHeavyLegs);
  if (decisionToastNeeded && decisionSummary?.title) {
    queuedToasts.push({
      text: String(startToast?.text || decisionSummary.title || ''),
      color: decisionToastColor || 'var(--purple)',
      delay: 700,
    });
  }

  const sessionChanges = Array.isArray(startSnapshot?.changes)
    ? (startSnapshot.changes as Array<unknown>)
    : [];
  if (sessionChanges.length && sessionChanges[0]) {
    queuedToasts.push({
      text: String(sessionChanges[0]),
      color: changeToastColor,
      delay: decisionToastNeeded ? 1800 : 900,
    });
  }

  const equipmentHint = String(startSnapshot?.equipmentHint || '');
  if (equipmentHint) {
    const baseDelay = sessionChanges.length ? 2600 : 900;
    const decisionDelay = decisionToastNeeded ? 900 : 0;
    queuedToasts.push({
      text: equipmentHint,
      color: 'var(--blue)',
      delay: baseDelay + decisionDelay,
    });
  }

  const isSportDay = next.isSportDay === true;
  const hadSportRecently = next.hadSportRecently === true;
  const sportLegsHeavy = schedule?.sportLegsHeavy !== false;
  const sportName = String(schedule?.sportName || 'Sport');
  const activeExerciseNames = Array.isArray(activeWorkout?.exercises)
    ? (activeWorkout?.exercises as Array<Record<string, unknown>>).map((exercise) =>
        String(exercise.name || '').toLowerCase()
      )
    : [];
  const hasLegs = legLifts.some((lift) =>
    activeExerciseNames.includes(String(lift || '').toLowerCase())
  );
  if ((isSportDay || hadSportRecently) && !isDeload && sportLegsHeavy && hasLegs) {
    queuedToasts.push({
      text:
        t?.(
          'workout.sport_legs_warning',
          '{sport} legs - consider fewer sets or swapping day order',
          { sport: sportName }
        ) || `${sportName} legs - consider fewer sets or swapping day order`,
      color: 'var(--orange)',
      delay: 1500,
    });
  }

  return {
    title,
    descriptionText: sessionDescription
      ? `${t?.('session.description', 'Session focus') || 'Session focus'}: ${sessionDescription}`
      : '',
    descriptionVisible: !!sessionDescription,
    immediateToast: {
      text: isDeload
        ? t?.('workout.deload_light', 'Deload - keep it light') ||
          'Deload - keep it light'
        : programName,
      color: isDeload ? 'var(--blue)' : 'var(--purple)',
    },
    queuedToasts,
  };
}

function buildWorkoutTeardownPlan(
  input?: WorkoutTeardownPlanInput,
  deps?: Record<string, unknown>
) : WorkoutTeardownPlanResult {
  const next = input || {};
  const t = readFunction<
    (key: string, fallback: string, params?: Record<string, unknown>) => string
  >(deps, 't');
  const mode = String(next.mode || 'cancel');
  return {
    showNotStarted: true,
    hideActive: true,
    resetNotStartedView: true,
    notifyLogActive: true,
    updateDashboard: mode === 'finish',
    discardToast:
      mode === 'cancel'
        ? t?.('workout.session_discarded', 'Workout discarded.') ||
          'Workout discarded.'
        : '',
  };
}

function getWorkoutStartSnapshotSignature(
  input?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = input || {};
  const normalizeTrainingPreferences = readFunction<
    (profileLike?: Record<string, unknown> | null) => Record<string, unknown>
  >(deps, 'normalizeTrainingPreferences');
  const getProfile = readFunction<() => Record<string, unknown> | null>(
    deps,
    'getProfile'
  );
  const getActiveProgram = readFunction<() => Record<string, unknown> | null>(
    deps,
    'getActiveProgram'
  );
  const getActiveProgramState = readFunction<
    () => Record<string, unknown> | null
  >(deps, 'getActiveProgramState');
  const normalizeEnergyLevel = readFunction<(value?: unknown) => string>(
    deps,
    'normalizeEnergyLevel'
  );

  const prefs = normalizeTrainingPreferences?.(
    (next.profile as MutableRecord | null) || getProfile?.() || null
  ) || {
    warmupSetsEnabled: false,
    goal: '',
    sessionMinutes: 0,
    sportReadinessCheckEnabled: false,
  };
  const sportContext =
    next.sportContext && typeof next.sportContext === 'object'
      ? {
          sportLoadLevel:
            String((next.sportContext as MutableRecord).sportLoadLevel || 'none'),
          legsStress:
            String((next.sportContext as MutableRecord).legsStress || 'none'),
          sportName: String((next.sportContext as MutableRecord).sportName || ''),
        }
      : null;

  return JSON.stringify({
    programId: String(
      (next.prog as MutableRecord | undefined)?.id ||
        getActiveProgram?.()?.id ||
        ''
    ),
    selectedOption: String(next.selectedOption || ''),
    state: cloneJson(
      (next.state as MutableRecord | null) || getActiveProgramState?.() || {}
    ),
    sportContext,
    selectedSessionMode:
      (next.decisionBundle as MutableRecord | undefined)?.selectedSessionMode ||
      next.pendingSessionMode ||
      'auto',
    effectiveSessionMode:
      (next.decisionBundle as MutableRecord | undefined)?.effectiveSessionMode ||
      'normal',
    energyLevel:
      (next.decisionBundle as MutableRecord | undefined)?.energyLevel ||
      normalizeEnergyLevel?.(next.pendingEnergyLevel) ||
      'normal',
    preferences: {
      warmupSetsEnabled: !!prefs.warmupSetsEnabled,
      goal: String(prefs.goal || ''),
      sessionMinutes: readNumber(prefs.sessionMinutes, 0),
      sportReadinessCheckEnabled: !!prefs.sportReadinessCheckEnabled,
    },
  });
}

function buildWorkoutStartSnapshot(
  input?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = input || {};
  const getActiveProgram = readFunction<() => Record<string, unknown> | null>(
    deps,
    'getActiveProgram'
  );
  const getActiveProgramState = readFunction<
    () => Record<string, unknown> | null
  >(deps, 'getActiveProgramState');
  const getWorkoutStartDecisionBundle = readFunction<
    (value?: Record<string, unknown>) => Record<string, unknown> | null
  >(deps, 'getWorkoutStartDecisionBundle');
  const getProgramSessionBuildContext = readFunction<
    (value?: Record<string, unknown>) => Record<string, unknown> | null
  >(deps, 'getProgramSessionBuildContext');
  const getProgramSessionStateForBuild = readFunction<
    (
      prog: Record<string, unknown>,
      state: Record<string, unknown> | null,
      buildContext: Record<string, unknown> | null
    ) => Record<string, unknown> | null
  >(deps, 'getProgramSessionStateForBuild');
  const cloneWorkoutExercises = readFunction<
    (value?: unknown) => Array<Record<string, unknown>>
  >(deps, 'cloneWorkoutExercises');
  const withResolvedExerciseId = readFunction<
    (value?: Record<string, unknown>) => Record<string, unknown>
  >(deps, 'withResolvedExerciseId');
  const applyTrainingPreferencesToExercises = readFunction<
    (
      exercises: Array<Record<string, unknown>>,
      sportContext?: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => Record<string, unknown>
  >(deps, 'applyTrainingPreferencesToExercises');
  const normalizeTrainingPreferences = readFunction<
    (profileLike?: Record<string, unknown> | null) => Record<string, unknown>
  >(deps, 'normalizeTrainingPreferences');
  const injectWarmupSets = readFunction<
    (exercises: Array<Record<string, unknown>>) => void
  >(deps, 'injectWarmupSets');
  const getProfile = readFunction<() => Record<string, unknown> | null>(
    deps,
    'getProfile'
  );

  const prog =
    (next.prog as MutableRecord | null) || getActiveProgram?.() || null;
  if (!prog || typeof prog.buildSession !== 'function') {
    return normalizeWorkoutStartSnapshot({ exercises: [] });
  }

  const state =
    (next.state as MutableRecord | null) || getActiveProgramState?.() || null;
  const decisionBundle =
    (next.decisionBundle as MutableRecord | null) ||
    getWorkoutStartDecisionBundle?.({
      prog,
      state,
      sportContext: next.sportContext,
    }) ||
    null;
  const planningContext =
    (next.planningContext as MutableRecord | null) ||
    (decisionBundle?.planningContext as MutableRecord | null) ||
    null;
  const trainingDecision =
    (next.trainingDecision as MutableRecord | null) ||
    (decisionBundle?.trainingDecision as MutableRecord | null) ||
    null;
  const effectiveDecision =
    (decisionBundle?.effectiveDecision as MutableRecord | null) ||
    trainingDecision;
  let selectedOption = String(next.selectedOption || '');
  if (
    !selectedOption &&
    typeof trainingDecision?.recommendedSessionOption === 'string'
  ) {
    selectedOption = trainingDecision.recommendedSessionOption;
  }

  const buildContext =
    getProgramSessionBuildContext?.({
      sessionModeBundle: decisionBundle,
    }) || null;
  const buildState =
    getProgramSessionStateForBuild?.(prog, state, buildContext) || state || {};
  const rawExercises =
    (prog.buildSession as (
      option: string,
      state: Record<string, unknown>,
      context: Record<string, unknown> | null
    ) => Array<Record<string, unknown>>)(selectedOption, buildState, buildContext) || [];
  const builtExercises = cloneWorkoutExercises?.(
    rawExercises.map((exercise) => withResolvedExerciseId?.(exercise) || exercise)
  ) || [];
  const sessionPrefs =
    applyTrainingPreferencesToExercises?.(builtExercises, next.sportContext as
      | Record<string, unknown>
      | undefined,
    {
      planningContext,
      decision: effectiveDecision,
      effectiveSessionMode: decisionBundle?.effectiveSessionMode,
    }) || {};
  const exercises =
    cloneWorkoutExercises?.(
      (sessionPrefs.exercises as Array<Record<string, unknown>> | undefined) ||
        builtExercises
    ) || [];
  const prefs =
    normalizeTrainingPreferences?.(
      (next.profile as MutableRecord | null) || getProfile?.() || null
    ) || {};
  if (prefs.warmupSetsEnabled) {
    injectWarmupSets?.(exercises);
  }

  const blockInfo =
    typeof prog.getBlockInfo === 'function'
      ? prog.getBlockInfo(buildState)
      : { isDeload: false };
  const sessionDescription =
    typeof prog.getSessionDescription === 'function'
      ? String(prog.getSessionDescription(selectedOption, buildState, buildContext) || '')
      : String(blockInfo?.modeDesc || blockInfo?.name || '');

  return normalizeWorkoutStartSnapshot({
    signature: getWorkoutStartSnapshotSignature(next, deps),
    programId: String(prog.id || ''),
    selectedOption,
    buildContext,
    buildState: cloneJson(buildState),
    exercises,
    sessionDescription,
    programLabel:
      typeof prog.getSessionLabel === 'function'
        ? prog.getSessionLabel(selectedOption, buildState, buildContext)
        : '',
    effectiveDecision,
    trainingDecision,
    changes: Array.isArray(sessionPrefs.changes)
      ? sessionPrefs.changes.slice()
      : [],
    equipmentHint: String(sessionPrefs.equipmentHint || ''),
    commentary:
      sessionPrefs.commentary &&
      typeof sessionPrefs.commentary === 'object'
        ? sessionPrefs.commentary
        : undefined,
  });
}

function buildSessionSummaryStats(
  summaryData?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = summaryData || {};
  const t = readFunction<
    (key: string, fallback: string, params?: Record<string, unknown>) => string
  >(deps, 't');
  const formatDuration = readFunction<(value: number) => string>(
    deps,
    'formatDuration'
  );
  const formatTonnage = readFunction<(value: number) => string>(
    deps,
    'formatTonnage'
  );

  return [
    {
      key: 'duration',
      accent: '',
      label: t?.('workout.summary_duration', 'Duration') || 'Duration',
      value: Math.max(0, Math.round(readNumber(next.duration, 0)) || 0),
      formatter: (value: number) => formatDuration?.(value) || String(value),
    },
    {
      key: 'sets',
      accent: 'green',
      label: t?.('workout.summary_sets', 'Sets Done') || 'Sets Done',
      value: Math.max(0, parseInt(String(next.completedSets || 0), 10) || 0),
      formatter: (value: number) =>
        `${Math.round(value)}/${Math.max(0, parseInt(String(next.totalSets || 0), 10) || 0)}`,
    },
    {
      key: 'volume',
      accent: 'gold',
      label: t?.('workout.summary_volume', 'Volume') || 'Volume',
      value: Math.max(0, parseFloat(String(next.tonnage || 0)) || 0),
      formatter: (value: number) => formatTonnage?.(value) || String(value),
    },
    {
      key: 'rpe',
      accent: 'purple',
      label: t?.('workout.summary_rpe', 'RPE') || 'RPE',
      value: Math.max(0, parseFloat(String(next.rpe || 0)) || 0),
      formatter: (value: number) =>
        value > 0 ? String(Math.round(value * 10) / 10) : '--',
    },
    {
      key: 'prs',
      accent: 'gold',
      label: t?.('workout.summary_prs', 'PRs') || 'PRs',
      value: Math.max(0, parseInt(String(next.prCount || 0), 10) || 0),
      formatter: (value: number) => String(Math.round(value)),
    },
  ];
}

function buildSessionCompletionMetrics(
  input?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = input || {};
  const parseLoggedRepCount = readFunction<(value: unknown) => number>(
    deps,
    'parseLoggedRepCount'
  );
  const exercises = Array.isArray(next.exercises)
    ? (next.exercises as Array<Record<string, unknown>>)
    : [];

  let completedSets = 0;
  let tonnage = 0;
  exercises.forEach((exercise) => {
    const sets = Array.isArray(exercise?.sets)
      ? (exercise.sets as Array<Record<string, unknown>>)
      : [];
    sets.forEach((set) => {
      if (set.done !== true || set.isWarmup === true) return;
      completedSets += 1;
      tonnage +=
        (parseFloat(String(set.weight || 0)) || 0) *
        (parseLoggedRepCount?.(set.reps) || 0);
    });
  });

  return {
    completedSets,
    tonnage,
    totalSets: Math.max(
      0,
      parseInt(String(next.totalSets ?? 0), 10) ||
        exercises.reduce((sum, exercise) => {
          const sets = Array.isArray(exercise?.sets) ? exercise.sets.length : 0;
          return sum + sets;
        }, 0)
    ),
  };
}

function buildSavedWorkoutRecord(
  input?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = input || {};
  const cloneTrainingDecision = readFunction<
    (value?: Record<string, unknown> | null) => Record<string, unknown> | null
  >(deps, 'cloneTrainingDecision');
  const activeWorkout =
    next.activeWorkout && typeof next.activeWorkout === 'object'
      ? (next.activeWorkout as MutableRecord)
      : {};
  const runnerState =
    activeWorkout.runnerState && typeof activeWorkout.runnerState === 'object'
      ? (activeWorkout.runnerState as MutableRecord)
      : null;

  return {
    id: next.workoutId,
    date: next.workoutDate,
    program: String(next.programId || activeWorkout.program || ''),
    type: String(next.programId || activeWorkout.type || ''),
    programOption: activeWorkout.programOption,
    programDayNum: activeWorkout.programDayNum,
    programLabel: String(activeWorkout.programLabel || ''),
    sportContext: activeWorkout.sportContext || undefined,
    programMeta: cloneJson(next.programMeta),
    sessionDescription: String(activeWorkout.sessionDescription || ''),
    commentary: activeWorkout.commentary
      ? cloneJson(activeWorkout.commentary)
      : undefined,
    planningDecision: activeWorkout.planningDecision || undefined,
    runnerState: runnerState
      ? {
          mode: runnerState.mode,
          adjustments: Array.isArray(runnerState.adjustments)
            ? runnerState.adjustments.slice()
            : [],
          initialDecision: runnerState.initialDecision
            ? cloneTrainingDecision?.(
                runnerState.initialDecision as Record<string, unknown>
              ) || cloneJson(runnerState.initialDecision)
            : undefined,
          selectedSessionMode: runnerState.selectedSessionMode || undefined,
          effectiveSessionMode: runnerState.effectiveSessionMode || undefined,
          sportAwareLowerBody: runnerState.sportAwareLowerBody === true,
        }
      : undefined,
    isBonus: activeWorkout.isBonus === true,
    prCount: Math.max(0, parseInt(String(next.prCount || 0), 10) || 0),
    programStateBefore: cloneJson(next.stateBeforeSession),
    programStateUsedForBuild: cloneJson(next.progressionSourceState),
    duration: Math.max(0, parseInt(String(next.duration || 0), 10) || 0),
    exercises: cloneJson(next.exercises),
    rpe: readNumber(next.sessionRPE, 0),
    sets: Math.max(0, parseInt(String(next.totalSets || 0), 10) || 0),
  };
}

function buildSessionSummaryData(
  input?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = input || {};
  const metrics = buildSessionCompletionMetrics(next, deps);
  const buildCoachNote = readFunction<
    (
      summaryMeta: Record<string, unknown>,
      stateBefore: Record<string, unknown> | null,
      stateAfter: Record<string, unknown> | null,
      activeWorkout: Record<string, unknown> | null
    ) => string
  >(deps, 'buildCoachNote');

  return {
    duration: Math.max(0, parseInt(String(next.duration || 0), 10) || 0),
    exerciseCount: Array.isArray(next.exercises) ? next.exercises.length : 0,
    completedSets: metrics.completedSets,
    totalSets: metrics.totalSets,
    tonnage: metrics.tonnage,
    rpe: readNumber(next.sessionRPE, 0),
    prCount: Math.max(0, parseInt(String(next.prCount || 0), 10) || 0),
    isBonus: next.isBonus === true,
    programLabel: String(next.programLabel || ''),
    coachNote:
      buildCoachNote?.(
        {
          completedSets: metrics.completedSets,
          totalSets: metrics.totalSets,
          rpe: readNumber(next.sessionRPE, 0),
          prCount: Math.max(0, parseInt(String(next.prCount || 0), 10) || 0),
          tmAdjustments: Array.isArray(next.tmAdjustments)
            ? next.tmAdjustments
            : [],
        },
        (next.stateBeforeSession as Record<string, unknown> | null) || null,
        (next.advancedState as Record<string, unknown> | null) || null,
        (next.activeWorkout as Record<string, unknown> | null) || null
      ) || '',
  };
}

function buildBonusActiveWorkout(
  input?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = input || {};
  const buildWorkoutRewardState = readFunction<
    () => Record<string, unknown>
  >(deps, 'buildWorkoutRewardState');
  const ensureWorkoutExerciseUiKeys = readFunction<
    (exercises: Array<Record<string, unknown>>) => Array<Record<string, unknown>>
  >(deps, 'ensureWorkoutExerciseUiKeys');

  return {
    program: String(next.programId || ''),
    type: String(next.programId || ''),
    isBonus: true,
    programOption: 'bonus',
    programDayNum: 0,
    programLabel: String(next.programLabel || ''),
    sportContext: next.sportContext || undefined,
    runnerState: {
      mode: 'train',
      adjustments: [],
      selectedSessionMode: 'normal',
      effectiveSessionMode: 'normal',
    },
    sessionDescription: String(next.sessionDescription || ''),
    rewardState: buildWorkoutRewardState?.() || {},
    exercises:
      ensureWorkoutExerciseUiKeys?.(
        Array.isArray(next.exercises)
          ? (next.exercises as Array<Record<string, unknown>>)
          : []
      ) || [],
    startTime: readNumber(next.startTime, Date.now()),
  };
}

function buildPlannedActiveWorkout(
  input?: Record<string, unknown>,
  deps?: Record<string, unknown>
) {
  const next = input || {};
  const buildWorkoutRewardState = readFunction<
    () => Record<string, unknown>
  >(deps, 'buildWorkoutRewardState');
  const ensureWorkoutExerciseUiKeys = readFunction<
    (exercises: Array<Record<string, unknown>>) => Array<Record<string, unknown>>
  >(deps, 'ensureWorkoutExerciseUiKeys');

  return {
    program: String(next.programId || ''),
    type: String(next.programId || ''),
    programOption: String(next.selectedOption || ''),
    programDayNum: parseInt(String(next.selectedOption || ''), 10) || 1,
    programMode:
      next.programMode === null || next.programMode === undefined
        ? undefined
        : next.programMode,
    programLabel: String(next.programLabel || ''),
    sportContext: next.sportContext || undefined,
    planningDecision: next.trainingDecision || undefined,
    planningContext: next.planningContext || undefined,
    commentary: next.commentary || undefined,
    runnerState: {
      mode:
        (next.effectiveDecision as MutableRecord | undefined)?.action ||
        (next.trainingDecision as MutableRecord | undefined)?.action ||
        'train',
      adjustments: [],
      initialDecision: next.trainingDecision || undefined,
      selectedSessionMode: next.selectedSessionMode || 'auto',
      effectiveSessionMode: next.effectiveSessionMode || 'normal',
      sportAwareLowerBody: next.sportAwareLowerBody === true,
    },
    sessionDescription: String(next.sessionDescription || ''),
    sessionSnapshot:
      next.sessionSnapshot && typeof next.sessionSnapshot === 'object'
        ? normalizeWorkoutStartSnapshot(next.sessionSnapshot)
        : undefined,
    rewardState: buildWorkoutRewardState?.() || {},
    exercises:
      ensureWorkoutExerciseUiKeys?.(
        Array.isArray(next.exercises)
          ? (next.exercises as Array<Record<string, unknown>>)
          : []
      ) || [],
    startTime: readNumber(next.startTime, Date.now()),
  };
}

export function installWorkoutRuntimeBridge() {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  if (runtimeWindow.__IRONFORGE_WORKOUT_RUNTIME__) {
    return runtimeWindow.__IRONFORGE_WORKOUT_RUNTIME__;
  }

  const api: WorkoutRuntimeApi = {
    getWorkoutStartSnapshotSignature,
    buildWorkoutStartSnapshot,
    buildSessionSummaryStats,
    buildSavedWorkoutRecord,
    buildSessionSummaryData,
    buildBonusActiveWorkout,
    buildPlannedActiveWorkout,
    sanitizeSetValue,
    applySetUpdateMutation,
    toggleWorkoutSetCompletion,
    appendWorkoutSet,
    removeWorkoutExercise,
    sanitizeWorkoutExercisesForSave,
    buildProgramTmAdjustments,
    buildWorkoutProgressionResult,
    buildCoachNote,
    buildTmAdjustmentToast,
    buildPostWorkoutOutcome,
    buildWorkoutStartPresentation,
    buildWorkoutTeardownPlan,
  };

  runtimeWindow.__IRONFORGE_WORKOUT_RUNTIME__ = api;
  return api;
}
