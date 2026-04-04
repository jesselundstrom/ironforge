import { FATIGUE_CONFIG as DEFAULT_FATIGUE_CONFIG } from './config';
import {
  getDisplayName as getExerciseDisplayName,
  getExerciseMeta,
  resolveExerciseId,
} from './exercise-library';
import {
  getDefaultCoachingProfile,
  getDefaultTrainingPreferences,
  normalizeCoachingProfile,
  normalizeTrainingPreferences,
} from './normalizers';
import type {
  FatigueResult,
  PlanningDecision,
  Profile,
  SportSchedule,
  WorkoutRecord,
} from './types';
import {
  getActiveProgram,
  getActiveProgramId,
  getActiveProgramState,
  getEffectiveProgramFrequency,
  getProgramById,
  getProgramCapabilities as getRegistryProgramCapabilities,
  getProgramDifficultyMeta as getRegistryProgramDifficultyMeta,
  getRegisteredPrograms,
} from '../core/program-registry.js';
import {
  clampPlanningValue,
  cloneJson,
  getCanonicalProgramId,
  getDayNames,
  getDefaultTrainingGoalLabel,
  getPlanningWindow,
  getStoredProfileRecord,
  getStoredScheduleRecord,
  getStoredWorkouts,
  getWeekStart,
  toPlanList,
  trPlan,
  type CoachingInsights,
  type ComputeFatigueInput,
  type InitialPlanRecommendation,
  type MutableRecord,
  type PlanningContextInput,
  type ProgramCapabilities,
  type ProgramDifficultyMeta,
  type TrainingDecision,
  type WeekPlanPreview,
} from './planning-utils';
import {
  computeFatigue,
  getFatigueConfig,
  getMuscleLoadConfig,
  getRecentDisplayMuscleLoads,
} from './planning-fatigue';
import {
  buildOnboardingRecommendation,
  getInitialPlanRecommendation,
  getProgramCapabilities,
  getProgramDifficultyMeta,
} from './planning-recommendations';

function isSportWorkout(workout: WorkoutRecord | Record<string, unknown>) {
  return workout?.type === 'sport' || workout?.type === 'hockey';
}

function getCompletedWorkSets(
  exercise: Record<string, unknown> | null | undefined
) {
  return Array.isArray(exercise?.sets)
    ? exercise.sets.filter((set) => set?.done === true && !set.isWarmup)
    : [];
}

function getWorkoutAgeDays(workout: WorkoutRecord, now: number) {
  const ts = new Date(workout?.date).getTime();
  if (!Number.isFinite(ts)) return null;
  return (now - ts) / 86400000;
}

function getFatigueDecayWeight(ageDays: number | null, halfLifeDays: number) {
  if (ageDays === null || ageDays < 0) return 0;
  const halfLife = Math.max(0.1, Number(halfLifeDays) || 1);
  return Math.pow(0.5, ageDays / halfLife);
}

function getLiftWorkoutFatigueImpulse(
  workout: WorkoutRecord,
  config: typeof DEFAULT_FATIGUE_CONFIG
) {
  const liftConfig = config?.lift || DEFAULT_FATIGUE_CONFIG.lift;
  let completedSets = 0;
  let totalReps = 0;
  let weightCount = 0;
  let totalWeight = 0;

  (Array.isArray(workout?.exercises) ? workout.exercises : []).forEach(
    (exercise) => {
      getCompletedWorkSets(exercise).forEach((set) => {
        completedSets += 1;
        const reps = parseFloat(String(set?.reps ?? ''));
        if (Number.isFinite(reps) && reps > 0) totalReps += reps;
        const weight = parseFloat(String(set?.weight ?? ''));
        if (Number.isFinite(weight) && weight >= 0) {
          totalWeight += weight;
          weightCount += 1;
        }
      });
    }
  );

  if (!completedSets) return { muscular: 0, cns: 0 };

  const avgReps = totalReps > 0 ? totalReps / completedSets : 5;
  const repFactor = clampPlanningValue(
    1 + (avgReps - 5) * (liftConfig.repFactorPerRepFromFive || 0.05),
    liftConfig.repFactorMin || 0.9,
    liftConfig.repFactorMax || 1.25
  );
  const avgWeightKg = weightCount ? totalWeight / weightCount : 0;
  const loadFactor =
    1 +
    clampPlanningValue(
      avgWeightKg / (liftConfig.loadFactorDivisor || 200),
      0,
      liftConfig.loadFactorMaxBonus || 0.35
    );
  const effort = clampPlanningValue(
    (parseFloat(String(workout?.rpe ?? '7')) || 7) - 6,
    0,
    4
  );

  return {
    muscular: Math.min(
      liftConfig.sessionCap || 70,
      (liftConfig.muscularBase || 8) +
        completedSets *
          (liftConfig.muscularSetWeight || 1.9) *
          repFactor *
          loadFactor +
        effort * (liftConfig.muscularRpeWeight || 4)
    ),
    cns: Math.min(
      liftConfig.sessionCap || 70,
      (liftConfig.cnsBase || 10) +
        completedSets * (liftConfig.cnsSetWeight || 1.05) * loadFactor +
        effort * (liftConfig.cnsRpeWeight || 7)
    ),
  };
}

function getSportFatigueConfig(
  workout: WorkoutRecord,
  scheduleLike: SportSchedule | Record<string, unknown> | null | undefined,
  config: typeof DEFAULT_FATIGUE_CONFIG
) {
  const intensity =
    workout?.type === 'hockey'
      ? 'hard'
      : String(scheduleLike?.sportIntensity || 'hard');
  const sportConfig = config?.sport as unknown as Record<
    string,
    { muscular: number; cns: number }
  >;
  return sportConfig?.[intensity] || sportConfig?.hard || { muscular: 17, cns: 14 };
}

function getSportWorkoutFatigueImpulse(
  workout: WorkoutRecord,
  scheduleLike: SportSchedule | Record<string, unknown> | null | undefined,
  config: typeof DEFAULT_FATIGUE_CONFIG
) {
  const sportConfig = config?.sport || DEFAULT_FATIGUE_CONFIG.sport;
  const base = getSportFatigueConfig(workout, scheduleLike, config);
  const durationHours = Math.max(
    0,
    (parseFloat(String(workout?.duration ?? '0')) || 0) / 3600
  );
  const durationFactor = clampPlanningValue(
    durationHours || 1,
    sportConfig.durationMin || 0.75,
    sportConfig.durationMax || 1.5
  );
  const effortFactor = clampPlanningValue(
    (sportConfig.effortBase || 0.85) +
      Math.max(0, (parseFloat(String(workout?.rpe ?? '7')) || 7) - 6) *
        (sportConfig.effortPerRpeAboveSix || 0.12),
    sportConfig.effortBase || 0.85,
    sportConfig.effortMax || 1.33
  );
  const cnsMultiplier =
    workout?.subtype === 'extra'
      ? sportConfig.extraSubtypeCnsMultiplier || 1.15
      : 1;

  return {
    muscular: (base.muscular || 0) * durationFactor * effortFactor,
    cns: (base.cns || 0) * durationFactor * effortFactor * cnsMultiplier,
  };
}

function resolvePlanExerciseId(exercise: unknown) {
  if (!exercise) return '';
  if (typeof exercise === 'object' && exercise && 'exerciseId' in exercise) {
    return String((exercise as { exerciseId?: unknown }).exerciseId || '');
  }
  return String(
    resolveExerciseId(
      typeof exercise === 'object' && exercise && 'name' in exercise
        ? (exercise as { name?: unknown }).name
        : exercise
    ) || ''
  );
}

function getPlanExerciseMeta(exercise: unknown) {
  return (
    getExerciseMeta(
      resolvePlanExerciseId(exercise) ||
        (typeof exercise === 'object' && exercise && 'name' in exercise
          ? (exercise as { name?: unknown }).name
          : exercise)
    ) || null
  );
}

function getPlanExerciseMovementTags(exercise: unknown) {
  const meta = getPlanExerciseMeta(exercise);
  return toPlanList(meta?.movementTags)
    .map((tag) => String(tag).trim())
    .filter(Boolean);
}

function getWorkoutProgramId(workout: WorkoutRecord | Record<string, unknown>) {
  if (!workout) return '';
  if (workout.program) return getCanonicalProgramId(workout.program);
  if (!workout.type || workout.type === 'sport' || workout.type === 'hockey') {
    return '';
  }
  return getCanonicalProgramId(workout.type);
}

function getProgramWorkoutHistory(
  programId: unknown,
  workoutList: WorkoutRecord[],
  limit?: number
) {
  const canonicalId = getCanonicalProgramId(programId);
  return (workoutList || [])
    .filter((workout) => getWorkoutProgramId(workout) === canonicalId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit || 8);
}

function getCompletedSetRatio(workout: WorkoutRecord) {
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  let total = 0;
  let done = 0;
  exercises.forEach((exercise) => {
    const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
    total += sets.length;
    done += sets.filter((set) => set.done !== false).length;
  });
  if (!total) return 1;
  return done / total;
}

function getPlanningAdherenceSignals(programId: unknown, workoutList: WorkoutRecord[]) {
  const recent = getProgramWorkoutHistory(programId, workoutList, 6);
  let consecutivePoorSessions = 0;
  recent.forEach((workout, idx) => {
    if (idx !== consecutivePoorSessions) return;
    if (getCompletedSetRatio(workout) < 0.7) consecutivePoorSessions += 1;
  });
  const averageCompletion = recent.length
    ? recent.reduce((sum, workout) => sum + getCompletedSetRatio(workout), 0) /
      recent.length
    : 1;
  return {
    recentCount: recent.length,
    consecutivePoorSessions,
    averageCompletion: Math.round(averageCompletion * 100) / 100,
  };
}

function getPlanningProgressSignals(activeProgramState: Record<string, unknown> | null) {
  const stalledLifts =
    activeProgramState &&
    typeof activeProgramState.stalledLifts === 'object' &&
    activeProgramState.stalledLifts
      ? (activeProgramState.stalledLifts as Record<string, unknown>)
      : {};
  const stalledCount = Object.keys(stalledLifts).filter(
    (key) => stalledLifts[key]
  ).length;
  return {
    stalledCount,
    hasStalls: stalledCount > 0,
    activeWeek: parseInt(String(activeProgramState?.week || ''), 10) || 1,
  };
}

function normalizePlanToken(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function pushUniquePlanValue(list: string[], value: string) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function topPlanIdsByCount(
  counts: Record<string, number>,
  minimumCount?: number
) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .filter(([, count]) => count >= (minimumCount || 1))
    .slice(0, 3)
    .map(([id]) => id);
}

function getWorkoutSwapExerciseIds(workout: WorkoutRecord) {
  const swapped: string[] = [];
  const programId = getWorkoutProgramId(workout);
  const beforeState = (workout?.programStateBefore || {}) as MutableRecord;
  (workout?.exercises || []).forEach((exercise) => {
    const currentId = resolvePlanExerciseId(exercise);
    if (!currentId) return;
    let plannedName = '';
    if (programId === 'forge') {
      if (exercise.isAccessory) plannedName = String(beforeState?.backExercise || '');
      else if ((exercise.auxSlotIdx || -1) >= 0) {
        plannedName = String(
          (((beforeState?.lifts as MutableRecord)?.aux as MutableRecord[]) || [])[
            exercise.auxSlotIdx || 0
          ]?.name || ''
        );
      }
    } else if (programId === 'wendler531' && (exercise.auxSlotIdx || -1) >= 0) {
      const liftIdx = Math.floor((exercise.auxSlotIdx || 0) / 2);
      const slotIdx = (exercise.auxSlotIdx || 0) % 2;
      plannedName = String(
        (((beforeState?.triumvirate as string[][]) || [])[liftIdx] || [])[slotIdx] || ''
      );
    }
    if (
      plannedName &&
      normalizePlanToken(plannedName) !== normalizePlanToken(exercise.name)
    ) {
      pushUniquePlanValue(swapped, currentId);
    }
  });
  return swapped;
}

function getPlanningBehaviorSignals(programId: unknown, workoutList: WorkoutRecord[]) {
  const recent = getProgramWorkoutHistory(programId, workoutList, 12);
  const skippedAccessoryCounts: Record<string, number> = {};
  const swapCounts: Record<string, number> = {};
  let shortenCount = 0;
  let lightenCount = 0;
  let sportCollisionCount = 0;
  recent.forEach((workout) => {
    if ((workout?.planningDecision?.restrictionFlags || []).includes('avoid_heavy_legs')) {
      sportCollisionCount += 1;
    }
    (((workout?.runnerState as MutableRecord | undefined)?.adjustments as Array<
      Record<string, unknown>
    >) || []).forEach((item) => {
      if (item?.type === 'shorten') shortenCount += 1;
      if (item?.type === 'lighten') lightenCount += 1;
    });
    (workout?.exercises || []).forEach((exercise) => {
      const sets = (exercise?.sets || []).filter((set) => !set?.isWarmup);
      if (!sets.length) return;
      const doneCount = sets.filter((set) => set.done !== false).length;
      const doneRatio = doneCount / sets.length;
      const exerciseId = resolvePlanExerciseId(exercise);
      if (exercise.isAccessory && doneRatio < 0.5 && exerciseId) {
        skippedAccessoryCounts[exerciseId] =
          (skippedAccessoryCounts[exerciseId] || 0) + 1;
      }
    });
    getWorkoutSwapExerciseIds(workout).forEach((exerciseId) => {
      swapCounts[exerciseId] = (swapCounts[exerciseId] || 0) + 1;
    });
  });
  return {
    avoidedExerciseIds: [],
    skippedAccessoryExerciseIds: topPlanIdsByCount(skippedAccessoryCounts, 2),
    preferredSwapExerciseIds: topPlanIdsByCount(swapCounts, 2),
    shortenCount,
    lightenCount,
    sportCollisionCount,
  };
}

function getSessionFeedbackSignals(programId: unknown, workoutList: WorkoutRecord[]) {
  const recent = getProgramWorkoutHistory(programId, workoutList, 5);
  const lastThree = recent.slice(0, 3);
  const tooHardCount = lastThree.filter((w) => w.sessionFeedback === 'too_hard').length;
  const tooEasyCount = lastThree.filter((w) => w.sessionFeedback === 'too_easy').length;
  const goodCount = lastThree.filter((w) => w.sessionFeedback === 'good').length;
  const tooLongCount = recent
    .slice(0, 4)
    .filter((w) => w.durationSignal === 'too_long').length;
  const tooHardBias = tooHardCount >= 2 && lastThree[0]?.sessionFeedback !== 'good';
  const tooEasyBias = tooEasyCount >= 2;
  const durationFriction = tooLongCount >= 2;
  return {
    tooHardBias,
    tooEasyBias,
    durationFriction,
    tooHardCount,
    tooEasyCount,
    goodCount,
    tooLongCount,
  };
}

function getAutomaticSportPreferenceContext(
  scheduleLike: SportSchedule | Record<string, unknown> | null | undefined,
  workouts: WorkoutRecord[]
) {
  const sportDays = Array.isArray(scheduleLike?.sportDays)
    ? scheduleLike.sportDays
    : [];
  const legsHeavy = scheduleLike?.sportLegsHeavy !== false;
  const intensity = String(scheduleLike?.sportIntensity || 'hard').toLowerCase();
  const recentHours = ({ easy: 18, moderate: 24, hard: 30 } as Record<string, number>)[
    intensity
  ] || 30;
  const sportName =
    String(scheduleLike?.sportName || trPlan('common.sport', 'Sport')).trim() ||
    trPlan('common.sport', 'Sport');
  const todayDow = new Date().getDay();
  const isSportDay = sportDays.includes(todayDow);
  const hadSportRecently =
    Array.isArray(workouts) &&
    workouts.some(
      (workout) =>
        isSportWorkout(workout) &&
        (Date.now() - new Date(workout.date).getTime()) / 3600000 <= recentHours
    );
  return {
    preferUpper: legsHeavy && (isSportDay || hadSportRecently),
    isSportDay,
    hadSportRecently,
    sportName,
    sportLoadLevel: 'none',
    legsStress: 'none',
    manualLegsStress: 'none',
    hasManualLegsStress: false,
  };
}

function mergeSportPreferenceContext(
  autoContext: Record<string, unknown> | null | undefined,
  manualContext: Record<string, unknown> | null | undefined
) {
  const base =
    autoContext || getAutomaticSportPreferenceContext({}, [] as WorkoutRecord[]);
  const manualSportLoadLevel = String(manualContext?.sportLoadLevel || 'none');
  const manualLegsStress = String(manualContext?.legsStress || 'none');
  const hasManualLegsStress = manualLegsStress !== 'none';
  return {
    ...base,
    ...(manualContext || {}),
    sportName: String(manualContext?.sportName || base.sportName || ''),
    sportLoadLevel: manualSportLoadLevel,
    legsStress: manualLegsStress,
    manualLegsStress,
    hasManualLegsStress,
    preferUpper: base.preferUpper === true || hasManualLegsStress,
  };
}

function getPlanSportLoad(
  scheduleLike: SportSchedule | Record<string, unknown> | null | undefined,
  workoutList: WorkoutRecord[],
  manualContext?: Record<string, unknown> | null
) {
  const auto = getAutomaticSportPreferenceContext(scheduleLike, workoutList);
  const merged = mergeSportPreferenceContext(
    auto,
    manualContext || null
  ) as MutableRecord;
  const now = Date.now();
  const recent24 = (workoutList || []).filter(
    (workout) =>
      isSportWorkout(workout) &&
      now - new Date(workout.date).getTime() <= 24 * 3600000
  ).length;
  const recent48 = (workoutList || []).filter(
    (workout) =>
      isSportWorkout(workout) &&
      now - new Date(workout.date).getTime() <= 48 * 3600000
  ).length;
  const recent72 = (workoutList || []).filter(
    (workout) =>
      isSportWorkout(workout) &&
      now - new Date(workout.date).getTime() <= 72 * 3600000
  ).length;
  return {
    signal: String(merged.legsStress || 'none'),
    level: String(merged.sportLoadLevel || 'none'),
    preferUpper: merged.preferUpper === true,
    isSportDay: merged.isSportDay === true,
    hadSportRecently: merged.hadSportRecently === true,
    sportName:
      String(merged.sportName || scheduleLike?.sportName || '') ||
      trPlan('common.sport', 'Sport'),
    recent24h: recent24,
    recent48h: recent48,
    recent72h: recent72,
  };
}

function getPlanningRestrictionFlags(context: Record<string, unknown>) {
  const flags: string[] = [];
  const equipment = context.equipmentAccess;
  if (equipment === 'minimal' || equipment === 'home_gym') {
    flags.push('minimal_equipment');
  }
  const sportLoad = (context.sportLoad || {}) as Record<string, unknown>;
  const signal = String(sportLoad.signal || 'none');
  if (
    sportLoad.preferUpper === true ||
    signal === 'today' ||
    signal === 'yesterday' ||
    signal === 'tomorrow' ||
    signal === 'both'
  ) {
    flags.push('avoid_heavy_legs');
  }
  const joints = new Set(
    toPlanList((context.limitations as MutableRecord | undefined)?.jointFlags)
  );
  if (joints.has('shoulder')) flags.push('avoid_overhead');
  if (joints.has('low_back')) flags.push('avoid_heavy_spinal_loading');
  if (joints.has('knee')) flags.push('avoid_knee_dominant_volume');
  return [...new Set(flags)];
}

function getPlanningProgramState(
  program: Record<string, unknown> | null | undefined,
  rawState: Record<string, unknown> | null | undefined
) {
  const cloned = cloneJson(rawState) || {};
  if (typeof program?.migrateState === 'function') {
    try {
      return program.migrateState(cloned) || cloned;
    } catch {}
  }
  if (
    (!cloned || typeof cloned !== 'object' || !Object.keys(cloned).length) &&
    typeof program?.getInitialState === 'function'
  ) {
    try {
      return cloneJson(program.getInitialState()) || cloned;
    } catch {}
  }
  return cloned;
}

function getRecommendedSessionOptionForDecision(context: Record<string, unknown>) {
  const program = context.activeProgram as
    | (MutableRecord & {
        getSessionOptions?: (
          state?: Record<string, unknown>,
          workouts?: WorkoutRecord[],
          schedule?: Record<string, unknown> | null
        ) => Array<Record<string, unknown>>;
      })
    | null;
  if (!program || typeof program.getSessionOptions !== 'function') return '';
  try {
    const rawOptions =
      program.getSessionOptions(
        (context.activeProgramState as Record<string, unknown>) || {},
        (context.workouts as WorkoutRecord[]) || [],
        ((context.schedule as Record<string, unknown>) || {}) as Record<
          string,
          unknown
        >
      ) || [];
    const recommended =
      rawOptions.find((option) => option.isRecommended && !option.done) ||
      rawOptions.find((option) => !option.done) ||
      rawOptions[0];
    return String(recommended?.value || '');
  } catch {
    return '';
  }
}

export function buildPlanningContext(input?: PlanningContextInput) {
  const next = input || {};
  const profileLike = cloneJson(
    (next.profile as MutableRecord | null) || getStoredProfileRecord()
  );
  const scheduleLike = cloneJson(
    (next.schedule as MutableRecord | null) || getStoredScheduleRecord()
  );
  const workoutList = Array.isArray(next.workouts)
    ? cloneJson(next.workouts)
    : getStoredWorkouts();
  const activeProgram =
    (next.activeProgram as MutableRecord | null) ||
    (getActiveProgram() as MutableRecord | null) ||
    (getProgramById(profileLike.activeProgram || 'forge') as MutableRecord | null) ||
    null;
  const rawActiveProgramState =
    (next.activeProgramState as Record<string, unknown> | null) ||
    (getActiveProgramState() as Record<string, unknown> | null) ||
    null;
  const activeProgramState = getPlanningProgramState(activeProgram, rawActiveProgramState);
  const fatigue =
    cloneJson(next.fatigue) ||
    computeFatigue({ workouts: workoutList, schedule: scheduleLike });
  const preferences = normalizeTrainingPreferences(profileLike);
  const coaching = normalizeCoachingProfile(profileLike);
  const activeProgramId = getCanonicalProgramId(
    activeProgram?.id || profileLike.activeProgram || getActiveProgramId() || 'forge'
  );
  const effectiveFrequency = getEffectiveProgramFrequency(activeProgramId, profileLike);
  const sportLoad = getPlanSportLoad(scheduleLike, workoutList, next.sportContext || null);
  const adherence = getPlanningAdherenceSignals(activeProgramId, workoutList);
  const progression = getPlanningProgressSignals(activeProgramState);
  const derivedBehaviorSignals = getPlanningBehaviorSignals(activeProgramId, workoutList);
  const feedbackSignals = getSessionFeedbackSignals(activeProgramId, workoutList);
  const profileBehaviorSignals = (coaching.behaviorSignals || {}) as MutableRecord;
  const behaviorSignals = {
    avoidedExerciseIds: [
      ...new Set([
        ...toPlanList(profileBehaviorSignals.avoidedExerciseIds),
        ...toPlanList(derivedBehaviorSignals.avoidedExerciseIds),
      ]),
    ],
    skippedAccessoryExerciseIds: [
      ...new Set([
        ...toPlanList(profileBehaviorSignals.skippedAccessoryExerciseIds),
        ...toPlanList(derivedBehaviorSignals.skippedAccessoryExerciseIds),
      ]),
    ],
    preferredSwapExerciseIds: [
      ...new Set([
        ...toPlanList(profileBehaviorSignals.preferredSwapExerciseIds),
        ...toPlanList(derivedBehaviorSignals.preferredSwapExerciseIds),
      ]),
    ],
    shortenCount: Math.max(
      parseInt(String(profileBehaviorSignals.shortenCount), 10) || 0,
      derivedBehaviorSignals.shortenCount || 0
    ),
    lightenCount: Math.max(
      parseInt(String(profileBehaviorSignals.lightenCount), 10) || 0,
      derivedBehaviorSignals.lightenCount || 0
    ),
    sportCollisionCount: Math.max(
      parseInt(String(profileBehaviorSignals.sportCollisionCount), 10) || 0,
      derivedBehaviorSignals.sportCollisionCount || 0
    ),
  };
  const weekStart = getWeekStart(new Date());
  const sessionsDoneThisWeek = workoutList.filter((workout) => {
    const ts = new Date(workout.date).getTime();
    if (!Number.isFinite(ts) || ts < weekStart.getTime()) return false;
    return getWorkoutProgramId(workout) === activeProgramId;
  }).length;
  const recentMuscleLookback = Math.max(
    1,
    parseInt(String(getMuscleLoadConfig()?.lookbackDays), 10) || 7
  );
  const recentMuscleLoad = getRecentDisplayMuscleLoads(recentMuscleLookback);
  const context: Record<string, unknown> = {
    profile: profileLike,
    schedule: scheduleLike,
    workouts: workoutList,
    activeProgram,
    activeProgramId,
    activeProgramState,
    preferences,
    coaching,
    goal: preferences.goal,
    effectiveFrequency,
    timeBudgetMinutes: parseInt(String(preferences.sessionMinutes), 10) || 60,
    equipmentAccess: preferences.equipmentAccess || 'full_gym',
    fatigue,
    recoveryScore: clampPlanningValue(
      100 - (parseInt(String(fatigue?.overall), 10) || 0),
      0,
      100
    ),
    sportLoad,
    recentMuscleLoad,
    experienceLevel: coaching.experienceLevel || 'returning',
    guidanceMode: coaching.guidanceMode || 'balanced',
    limitations: coaching.limitations || {},
    exercisePreferences: coaching.exercisePreferences || {},
    behaviorSignals,
    preferredExerciseIds: toPlanList(coaching.exercisePreferences?.preferredExerciseIds),
    excludedExerciseIds: [
      ...new Set([
        ...toPlanList(coaching.exercisePreferences?.excludedExerciseIds),
        ...toPlanList(coaching.limitations?.avoidExerciseIds),
      ]),
    ],
    deprioritizedExerciseIds: [
      ...new Set([
        ...toPlanList(behaviorSignals.avoidedExerciseIds),
        ...toPlanList(behaviorSignals.skippedAccessoryExerciseIds),
      ]),
    ],
    adherence,
    progression,
    feedbackSignals,
    sessionsDoneThisWeek,
    sessionsRemaining: Math.max(0, effectiveFrequency - sessionsDoneThisWeek),
    recommendedSessionOption: '',
    programConstraints: {},
  };
  context.programConstraints =
    typeof activeProgram?.getProgramConstraints === 'function'
      ? activeProgram.getProgramConstraints(activeProgramState, context) || {}
      : {};
  context.restrictionFlags = getPlanningRestrictionFlags(context);
  context.recommendedSessionOption = getRecommendedSessionOptionForDecision(context);
  return context;
}

export function getTodayTrainingDecision(context?: Record<string, unknown> | null) {
  const next = context || buildPlanningContext({});
  const reasonCodes: string[] = [];
  let action = 'train';
  if ((Number(next.sessionsRemaining) || 0) <= 0) {
    action = 'rest';
    reasonCodes.push('week_complete');
  } else if (
    (Number(next.recoveryScore) || 0) <= 30 ||
    (((next.adherence as MutableRecord)?.consecutivePoorSessions as number) >= 3 &&
      (next.progression as MutableRecord)?.hasStalls)
  ) {
    action =
      ((next.activeProgram as MutableRecord & {
        getBlockInfo?: (state?: Record<string, unknown>) => Record<string, unknown> | null;
      })?.getBlockInfo?.(
        (next.activeProgramState as Record<string, unknown>) || {}
      )?.isDeload as boolean) === true
        ? 'train_light'
        : 'deload';
    reasonCodes.push('low_recovery');
  } else if (
    (Number(next.recoveryScore) || 0) <= 45 ||
    (((next.adherence as MutableRecord)?.consecutivePoorSessions as number) >= 2)
  ) {
    action = 'train_light';
    reasonCodes.push('conservative_recovery');
  } else if ((Number(next.timeBudgetMinutes) || 0) <= 35) {
    action = 'shorten';
    reasonCodes.push('tight_time_budget');
  }
  if ((next.sportLoad as MutableRecord)?.preferUpper) reasonCodes.push('sport_load');
  if (
    next.equipmentAccess === 'minimal' ||
    next.equipmentAccess === 'home_gym'
  ) {
    reasonCodes.push('equipment_constraint');
  }
  if ((next.progression as MutableRecord)?.hasStalls) {
    reasonCodes.push('progression_stall');
  }
  if (
    next.guidanceMode === 'guided' &&
    next.experienceLevel === 'beginner'
  ) {
    reasonCodes.push('guided_beginner');
  }
  const feedbackSignals = (next.feedbackSignals || {}) as MutableRecord;
  if (feedbackSignals.tooHardBias) {
    if (action === 'train') {
      action = 'train_light';
      reasonCodes.push('session_feedback_hard');
    } else if (action === 'train_light' || action === 'shorten') {
      reasonCodes.push('session_feedback_hard');
    }
  }
  if (feedbackSignals.durationFriction && action === 'train') {
    action = 'shorten';
    reasonCodes.push('duration_friction');
  }
  if (
    feedbackSignals.tooEasyBias &&
    action === 'train_light' &&
    !reasonCodes.includes('low_recovery') &&
    (Number(next.recoveryScore) || 0) > 45
  ) {
    action = 'train';
    reasonCodes.push('session_feedback_easy');
  }
  const autoregulationLevel =
    action === 'deload'
      ? 'deload'
      : action === 'train_light'
        ? 'conservative'
        : 'normal';
  return {
    action,
    reasonCodes: [...new Set(reasonCodes)],
    recommendedProgramId: next.activeProgramId,
    recommendedSessionOption: String(next.recommendedSessionOption || ''),
    timeBudgetMinutes: Number(next.timeBudgetMinutes) || 60,
    restrictionFlags: [
      ...new Set(toPlanList((next.restrictionFlags as string[]) || [])),
    ],
    autoregulationLevel,
  } as TrainingDecision;
}

function getWeekPlanDateKey(date: Date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeWeekPlanLabel(label: unknown) {
  return String(label || '')
    .replace(/^[\u{1F300}-\u{1FFFF}\u2600-\u27FF]\s*/u, '')
    .replace(/^\u2705\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWeekPlanSessionLabel(
  program: Record<string, unknown> | null | undefined,
  state: Record<string, unknown> | null | undefined,
  optionValue: unknown,
  context?: Record<string, unknown>,
  optionLabel?: string
) {
  let label = '';
  if (typeof program?.getSessionLabel === 'function') {
    try {
      label =
        String(program.getSessionLabel(optionValue, state || {}, context || {}) || '');
    } catch {}
  }
  if (!label) label = optionLabel || '';
  return normalizeWeekPlanLabel(label);
}

function getWeekPlanWorkoutLabel(
  workout: WorkoutRecord | null,
  program: Record<string, unknown> | null | undefined,
  fallbackState: Record<string, unknown> | null | undefined
) {
  if (!workout) return '';
  if (typeof program?.getSessionLabel === 'function' && workout.programDayNum != null) {
    try {
      const stateForLabel =
        cloneJson(
          (workout.programStateBefore as Record<string, unknown> | null) ||
            fallbackState ||
            {}
        ) || {};
      const label = program.getSessionLabel(
        workout.programDayNum,
        stateForLabel,
        { preview: true }
      );
      if (label) return normalizeWeekPlanLabel(label);
    } catch {}
  }
  return normalizeWeekPlanLabel(
    workout.programLabel || workout.sessionDescription || workout.name || ''
  );
}

function pickDistributedWeekPlanIndices(candidateIndices: number[], count: number) {
  const safeIndices = (candidateIndices || []).filter(Number.isFinite);
  const target = Math.max(0, parseInt(String(count), 10) || 0);
  if (!safeIndices.length || !target) return [];
  if (target >= safeIndices.length) return safeIndices.slice();
  if (target === 1) return [safeIndices[Math.floor((safeIndices.length - 1) / 2)]];
  const picked: number[] = [];
  for (let step = 0; step < target; step += 1) {
    const rawIndex = Math.round((step * (safeIndices.length - 1)) / (target - 1));
    const candidate = safeIndices[rawIndex];
    if (!picked.includes(candidate)) picked.push(candidate);
  }
  safeIndices.forEach((index) => {
    if (picked.length >= target) return;
    if (!picked.includes(index)) picked.push(index);
  });
  return picked.sort((a, b) => a - b);
}

export function getWeekPlanPreview(
  planningContext?: Record<string, unknown> | null,
  workoutList?: WorkoutRecord[],
  scheduleLike?: SportSchedule | Record<string, unknown> | null,
  programLike?: Record<string, unknown> | null,
  programState?: Record<string, unknown> | null
) {
  const context =
    planningContext ||
    buildPlanningContext({
      workouts: workoutList,
      schedule: scheduleLike,
      activeProgram: programLike || undefined,
      activeProgramState: programState || undefined,
    });
  const program =
    programLike ||
    ((context?.activeProgram as Record<string, unknown> | null) ||
      (getActiveProgram() as Record<string, unknown> | null));
  const state = getPlanningProgramState(
    program,
    programState ||
      ((context?.activeProgramState as Record<string, unknown> | null) ||
        (getActiveProgramState() as Record<string, unknown> | null))
  );
  const scheduleData =
    (scheduleLike as MutableRecord | null) ||
    ((context?.schedule as MutableRecord | null) || getStoredScheduleRecord());
  const workoutsForPreview = Array.isArray(workoutList)
    ? workoutList
    : ((context?.workouts as WorkoutRecord[]) || getStoredWorkouts());
  if (!program) {
    return { visible: false, days: [], title: '', labels: {} };
  }

  const today = new Date();
  const weekStart = getWeekStart(today);
  const todayIndex = (today.getDay() + 6) % 7;
  const activeProgramId = getCanonicalProgramId(
    program.id || context?.activeProgramId || ''
  );
  const targetSessions = Math.max(
    0,
    parseInt(String(context?.effectiveFrequency), 10) ||
      parseInt(String(context?.sessionsDoneThisWeek), 10) ||
      0
  );
  const weekDays = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    const dayDow = date.getDay();
    const dateKey = getWeekPlanDateKey(date);
    const logged = workoutsForPreview.filter(
      (workout) => getWeekPlanDateKey(new Date(workout?.date)) === dateKey
    );
    const loggedLift =
      logged.find((workout) => {
        if (!workout || isSportWorkout(workout)) return false;
        return getWorkoutProgramId(workout) === activeProgramId;
      }) || null;
    const loggedSport = logged.some((workout) => isSportWorkout(workout));
    return {
      date,
      dateKey,
      index: offset,
      dow: dayDow,
      isToday: offset === todayIndex,
      isPast: offset < todayIndex,
      isSportDay:
        Array.isArray(scheduleData?.sportDays) &&
        scheduleData.sportDays.includes(dayDow),
      loggedLift,
      loggedSport,
    };
  });

  const nonSportIndices = weekDays
    .filter((day) => !day.isSportDay)
    .map((day) => day.index);
  const plannedWeekIndices = pickDistributedWeekPlanIndices(
    nonSportIndices,
    targetSessions
  );
  const optionEntries: Array<Record<string, unknown>> =
    typeof program.getSessionOptions === 'function'
      ? program.getSessionOptions(state, workoutsForPreview, scheduleData) || []
      : [];
  const allPlanLabels = optionEntries.map((option: Record<string, unknown>) =>
    getWeekPlanSessionLabel(
      program,
      state,
      option.value,
      { preview: true },
      String(option.label || '')
    )
  );
  while (allPlanLabels.length < plannedWeekIndices.length) {
    const count = allPlanLabels.length + 1;
    allPlanLabels.push(
      trPlan('plan.week.day_label', 'Day {day}', { day: count })
    );
  }
  const plannedLabelMap = new Map<number, string>();
  plannedWeekIndices.forEach((dayIndex, labelIndex) => {
    plannedLabelMap.set(dayIndex, allPlanLabels[labelIndex] || '');
  });

  const pendingLabels = optionEntries
    .filter((option: Record<string, unknown>) => !option.done)
    .map((option: Record<string, unknown>) =>
      getWeekPlanSessionLabel(
        program,
        state,
        option.value,
        { preview: true },
        String(option.label || '')
      )
    );

  const todayHasLift = !!weekDays[todayIndex]?.loggedLift;
  const todayDecision = getTodayTrainingDecision(context);
  const todayNeedsSession =
    !todayHasLift &&
    (parseInt(String(context?.sessionsRemaining), 10) || 0) > 0 &&
    pendingLabels.length > 0 &&
    todayDecision.action !== 'rest';
  let pendingCursor = todayNeedsSession ? 1 : 0;
  const futureCandidateIndices = weekDays
    .filter((day) => day.index > todayIndex && !day.isSportDay)
    .map((day) => day.index);
  const futurePlannedCount = Math.max(
    0,
    (parseInt(String(context?.sessionsRemaining), 10) || 0) -
      (todayNeedsSession ? 1 : 0)
  );
  const futurePlannedIndices = pickDistributedWeekPlanIndices(
    futureCandidateIndices,
    futurePlannedCount
  );
  const futurePlannedSet = new Set(futurePlannedIndices);

  const labels = {
    title: trPlan('dashboard.week_plan.title', 'Week Preview'),
    train: trPlan('dashboard.week_plan.train', 'Train'),
    sport: trPlan('dashboard.week_plan.sport', 'Sport'),
    rest: trPlan('dashboard.week_plan.rest', 'Rest'),
    missed: trPlan('dashboard.week_plan.missed', 'Missed'),
    done: trPlan('dashboard.week_plan.done', 'Done'),
  };
  const dayNames = getDayNames();

  const days = weekDays.map((day) => {
    const dayName = dayNames[day.dow] || String(day.dow);
    const base = {
      dayIndex: day.index,
      dayName,
      dayNumber: day.date.getDate(),
      slot: 'rest',
      sessionLabel: '',
      isToday: day.isToday,
      isPast: day.isPast,
    };

    if (day.loggedLift) {
      return {
        ...base,
        slot: 'done',
        sessionLabel: getWeekPlanWorkoutLabel(day.loggedLift, program, state) || labels.done,
      };
    }

    if (day.isPast) {
      if (plannedLabelMap.has(day.index)) {
        return {
          ...base,
          slot: 'missed',
          sessionLabel: plannedLabelMap.get(day.index) || labels.missed,
        };
      }
      if (day.loggedSport) return { ...base, slot: 'sport', sessionLabel: labels.sport };
      return { ...base, slot: 'rest', sessionLabel: labels.rest };
    }

    if (day.isToday) {
      if (todayNeedsSession) {
        return {
          ...base,
          slot: 'train',
          sessionLabel:
            pendingLabels[0] || plannedLabelMap.get(day.index) || labels.train,
        };
      }
      if (day.loggedSport || (todayDecision.action === 'rest' && day.isSportDay)) {
        return { ...base, slot: 'sport', sessionLabel: labels.sport };
      }
      return { ...base, slot: 'rest', sessionLabel: labels.rest };
    }

    if (futurePlannedSet.has(day.index)) {
      const label =
        pendingLabels[pendingCursor] ||
        plannedLabelMap.get(day.index) ||
        labels.train;
      pendingCursor += 1;
      return {
        ...base,
        slot: 'train',
        sessionLabel: label,
      };
    }

    if (day.isSportDay) return { ...base, slot: 'sport', sessionLabel: labels.sport };
    return { ...base, slot: 'rest', sessionLabel: labels.rest };
  });

  return {
    visible: true,
    title: labels.title,
    labels,
    days,
  };
}

export function buildTrainingCommentaryState(input?: Record<string, unknown>) {
  const next = input || {};
  const workout = (next.workout || {}) as Record<string, unknown>;
  const decision =
    ((next.decision as Record<string, unknown>) ||
      (workout.planningDecision as Record<string, unknown>) ||
      {}) as Record<string, unknown>;
  const context =
    ((next.context as Record<string, unknown>) ||
      (workout.planningContext as Record<string, unknown>) ||
      {}) as Record<string, unknown>;
  const decisionCode =
    decision.action === 'rest'
      ? 'rest'
      : decision.action === 'deload'
        ? 'deload'
        : decision.action === 'train_light'
          ? 'train_light'
          : decision.action === 'shorten'
            ? 'shorten'
            : toPlanList(decision.restrictionFlags).includes('avoid_heavy_legs')
              ? 'sport_aware'
              : 'train';
  const reasonCodes = [...new Set(toPlanList(decision.reasonCodes))] as string[];
  const restrictionFlags = [
    ...new Set(toPlanList(decision.restrictionFlags)),
  ] as string[];
  return {
    version: 1,
    decisionCode,
    tone:
      decisionCode === 'rest'
        ? 'positive'
        : decisionCode === 'deload'
          ? 'warning'
          : decisionCode === 'train_light' || decisionCode === 'sport_aware'
            ? 'info'
            : 'neutral',
    reasonCodes,
    restrictionFlags,
    adaptationEvents: [],
    equipmentHint: null,
    runnerEvents: [],
    decision,
    context,
    workout,
    derived: {
      sessionsRemaining: Number(context?.sessionsRemaining) || 0,
      sportName: String(
        (context?.sportLoad as MutableRecord)?.sportName || trPlan('common.sport', 'Sport')
      ),
      runnerMode: String(
        ((workout?.runnerState as MutableRecord | undefined)?.mode as string) ||
          decision?.action ||
          'train'
      ),
    },
  };
}

function getTrainingCommentaryReasonLabel(code: string) {
  const keyMap: Record<string, [string, string]> = {
    low_recovery: ['training.reason.low_recovery.label', 'Low recovery'],
    conservative_recovery: [
      'training.reason.conservative_recovery.label',
      'Recovery caution',
    ],
    tight_time_budget: ['training.reason.tight_time_budget.label', '35 min cap'],
    sport_load: ['training.reason.sport_load.label', 'Sport load'],
    equipment_constraint: ['training.reason.equipment_constraint.label', 'Equipment'],
    progression_stall: ['training.reason.progression_stall.label', 'Progress stall'],
    guided_beginner: ['training.reason.guided_beginner.label', 'Guided path'],
    week_complete: ['training.reason.week_complete.label', 'Week complete'],
    session_feedback_hard: [
      'training.reason.session_feedback_hard.label',
      'Felt hard',
    ],
    session_feedback_easy: [
      'training.reason.session_feedback_easy.label',
      'Felt easy',
    ],
    duration_friction: ['training.reason.duration_friction.label', 'Running long'],
  };
  const pair = keyMap[code];
  return pair ? trPlan(pair[0], pair[1]) : '';
}

export function presentTrainingCommentary(
  state?: Record<string, unknown>,
  surface?: string
) {
  const next =
    state && (state as MutableRecord).decisionCode
      ? (state as Record<string, unknown>)
      : buildTrainingCommentaryState(state);
  const code = String(next.decisionCode || 'train');
  const params = {
    count: Number((next.derived as MutableRecord)?.sessionsRemaining) || 0,
    sport: String((next.derived as MutableRecord)?.sportName || trPlan('common.sport', 'Sport')),
  };
  const fallbacks: Record<string, Record<string, string>> = {
    rest: {
      title: 'Week complete!',
      dashboard_summary: 'All planned sessions are already done this week. Rest and recover.',
      dashboard_focus_support: 'All planned sessions are already done this week. Rest and recover.',
      dashboard_coach: 'All planned sessions are already done this week. Rest and recover.',
      workout_summary: 'This week is already covered. Keep today for recovery.',
      workout_start_toast: 'Week complete!',
      program_warning: 'The planned work for this week is already complete. Recovery is the better call today.',
    },
    deload: {
      title: 'Deload recommendation',
      dashboard_summary: 'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      dashboard_focus_support: 'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      dashboard_coach: 'Recovery is lagging, so keep today light and treat it like a deload. {count} sessions remain this week.',
      workout_summary: 'Recovery is low, so keep today lighter than normal and reduce grinding.',
      workout_start_toast: 'Deload recommendation',
      program_warning: 'Recovery is low enough that a lighter option is the safer call today.',
    },
    train_light: {
      title: 'Conservative training day',
      dashboard_summary: 'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      dashboard_focus_support: 'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      dashboard_coach: 'You can still train, but keep the effort conservative and avoid unnecessary grinding. {count} sessions remain this week.',
      workout_summary: 'Train today, but keep the effort conservative and let the session breathe.',
      workout_start_toast: 'Conservative training day',
      program_warning: 'You can still train, but keep the physiological cost conservative today.',
    },
    shorten: {
      title: 'Short session plan',
      dashboard_summary: 'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      dashboard_focus_support: 'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      dashboard_coach: 'Use your main work first and trim accessories to stay inside your time cap. {count} sessions remain this week.',
      workout_summary: 'Main work first. Accessories will be trimmed to fit your time cap.',
      workout_start_toast: 'Short session plan',
      program_warning: 'Stay on the high-value work first and let accessories flex if time gets tight.',
    },
    sport_aware: {
      title: 'Sport-aware session',
      dashboard_summary: 'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      dashboard_focus_support: 'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      dashboard_coach: 'Sport load is high around today, so bias the session away from heavy leg work when possible. {count} sessions remain this week.',
      workout_summary: '{sport} load is high around today, so heavier leg work may be trimmed.',
      workout_start_toast: 'Sport-aware session',
      program_warning: 'Sport load is high enough that heavy lower-body work should stay under control today.',
    },
    train: {
      title: 'Training day',
      dashboard_summary: 'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      dashboard_focus_support: 'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      dashboard_coach: 'Recovery looks good enough to train normally today. {count} sessions remain this week.',
      workout_summary: 'Your plan can run normally today.',
      workout_start_toast: 'Training day',
      program_warning: 'Training can run normally today.',
    },
  };
  const getCopy = (area: string) =>
    trPlan(`training.commentary.${code}.${area}`, fallbacks[code]?.[area] || fallbacks.train[area], params);
  const title = trPlan(
    `training.commentary.${code}.title`,
    fallbacks[code]?.title || fallbacks.train.title,
    params
  );
  if (surface === 'dashboard_summary') {
    return {
      title,
      body: getCopy('dashboard_summary'),
      tone: next.tone,
      reasons: [...toPlanList(next.reasonCodes)],
      reasonLabels: toPlanList(next.reasonCodes)
        .map((reason) => getTrainingCommentaryReasonLabel(String(reason)))
        .filter(Boolean),
    };
  }
  if (surface === 'dashboard_focus_support') return { text: getCopy('dashboard_focus_support') };
  if (surface === 'dashboard_coach') return { title, body: getCopy('dashboard_coach'), tone: next.tone };
  if (surface === 'workout_summary') {
    return {
      kicker: trPlan('training.commentary.workout.kicker', "Today's decision"),
      title,
      copy: getCopy('workout_summary'),
      tone: next.tone,
      reasons: [...toPlanList(next.reasonCodes)],
      reasonLabels: toPlanList(next.reasonCodes)
        .map((reason) => getTrainingCommentaryReasonLabel(String(reason)))
        .filter(Boolean),
    };
  }
  if (surface === 'workout_start_toast') return { text: getCopy('workout_start_toast'), tone: next.tone };
  if (surface === 'program_warning') return { title, copy: getCopy('program_warning'), tone: next.tone };
  return null;
}

function getPlanDayCounts(
  workoutList: WorkoutRecord[],
  programId: string,
  daysLookback: number
) {
  const counts: Record<string, number> = {};
  const cutoff =
    Date.now() - Math.max(1, parseInt(String(daysLookback), 10) || 60) * 86400000;
  (workoutList || []).forEach((workout) => {
    const ts = new Date(workout?.date).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) return;
    if (getWorkoutProgramId(workout) !== programId) return;
    const day = new Date(ts).getDay();
    counts[day] = (counts[day] || 0) + 1;
  });
  return counts;
}

function getProgramProgressSummary(context: Record<string, unknown>) {
  const state = (context?.activeProgramState || {}) as MutableRecord;
  const recent = getProgramWorkoutHistory(
    context?.activeProgramId,
    (context?.workouts as WorkoutRecord[]) || [],
    10
  );
  if (context?.activeProgramId === 'forge') {
    const earliest = ((recent[recent.length - 1]?.programStateBefore as MutableRecord)?.lifts as MutableRecord)?.main || [];
    if (!Array.isArray(earliest) || !earliest.length) {
      return trPlan(
        'plan.insight.forge_stable',
        'Forge training maxes are stable right now - keep execution crisp.',
        {}
      );
    }
    const current = (((state?.lifts as MutableRecord)?.main as MutableRecord[]) || []);
    let upCount = 0;
    let bestDelta = 0;
    current.forEach((lift, idx) => {
      const oldTm = parseFloat(String((earliest[idx] as MutableRecord)?.tm || '')) || 0;
      const newTm = parseFloat(String(lift?.tm || '')) || 0;
      const delta = Math.round((newTm - oldTm) * 10) / 10;
      if (delta > 0) {
        upCount += 1;
        if (delta > bestDelta) bestDelta = delta;
      }
    });
    if (upCount > 0) {
      return trPlan(
        'plan.insight.forge_progress',
        '{count} main lift TMs are up over your recent block, led by +{delta}kg.',
        { count: upCount, delta: bestDelta }
      );
    }
    return trPlan(
      'plan.insight.forge_stable',
      'Forge training maxes are stable right now - keep execution crisp.',
      {}
    );
  }
  if (context?.activeProgramId === 'wendler531') {
    const stalledCount = Object.keys((state?.stalledLifts as MutableRecord) || {}).filter(
      (key) => ((state?.stalledLifts as MutableRecord) || {})[key]
    ).length;
    if (stalledCount > 0) {
      return trPlan(
        'plan.insight.w531_stalled',
        'Cycle {cycle}, week {week}. {count} lift needs a lighter runway.',
        { cycle: state.cycle || 1, week: state.week || 1, count: stalledCount }
      );
    }
    return trPlan(
      'plan.insight.w531_cycle',
      'Cycle {cycle}, week {week} is moving without stall flags.',
      { cycle: state.cycle || 1, week: state.week || 1 }
    );
  }
  if ((context?.progression as MutableRecord)?.hasStalls) {
    return trPlan(
      'plan.insight.stalls',
      'Progression has at least one stall signal right now.'
    );
  }
  return trPlan(
    'plan.insight.stable',
    'Progression looks stable - stay with the current path.'
  );
}

export function getCoachingInsights(input?: Record<string, unknown>) {
  const next = input || {};
  const context =
    (next.context as Record<string, unknown>) || buildPlanningContext(next);
  const decision =
    (next.decision as Record<string, unknown>) || getTodayTrainingDecision(context);
  const recentProgramWorkouts = ((context.workouts as WorkoutRecord[]) || []).filter(
    (workout) => {
      const ts = new Date(workout?.date).getTime();
      if (!Number.isFinite(ts) || ts < Date.now() - 30 * 86400000) return false;
      return getWorkoutProgramId(workout) === context.activeProgramId;
    }
  );
  const expectedSessions = Math.max(
    1,
    Math.round(((Number(context.effectiveFrequency) || 3) * 30) / 7)
  );
  const adherenceRate30 = clampPlanningValue(
    Math.round((recentProgramWorkouts.length / expectedSessions) * 100),
    0,
    140
  );
  const dayCounts = getPlanDayCounts(
    (context.workouts as WorkoutRecord[]) || [],
    String(context.activeProgramId || ''),
    60
  );
  const bestDayIndexes = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .slice(0, 2)
    .map(([day]) => parseInt(day, 10))
    .filter(Number.isFinite);
  const skippedNames = toPlanList(
    (context.behaviorSignals as MutableRecord)?.skippedAccessoryExerciseIds
  )
    .map((id) => getExerciseDisplayName(id))
    .filter(Boolean)
    .slice(0, 2);
  const frictionItems: string[] = [];
  if (skippedNames.length) {
    frictionItems.push(
      trPlan(
        'plan.insight.skipped_accessories',
        'Accessories most often dropped: {names}.',
        { names: skippedNames.join(', ') }
      )
    );
  }
  const feedbackSignals =
    (context.feedbackSignals as MutableRecord) ||
    getSessionFeedbackSignals(context.activeProgramId, (context.workouts as WorkoutRecord[]) || []);
  let recommendationType = 'continue';
  if (decision.action === 'deload') recommendationType = 'deload';
  else if (
    decision.action === 'train_light' ||
    (((context.behaviorSignals as MutableRecord)?.lightenCount as number) || 0) >= 2
  ) {
    recommendationType = 'lighten';
  } else if (
    decision.action === 'shorten' ||
    (((context.behaviorSignals as MutableRecord)?.shortenCount as number) || 0) >= 2
  ) {
    recommendationType = 'shorten';
  }
  if (recommendationType === 'continue' && feedbackSignals.tooHardBias) {
    recommendationType = 'lighten';
  }
  if (recommendationType === 'continue' && feedbackSignals.durationFriction) {
    recommendationType = 'shorten';
  }
  const recommendationMap: Record<string, Record<string, string>> = {
    continue: {
      label: trPlan('plan.recommend.continue', 'Stay the course'),
      body: trPlan(
        'plan.recommend.continue_body',
        'Your current setup looks sustainable - keep stacking consistent sessions.'
      ),
    },
    shorten: {
      label: trPlan('plan.recommend.shorten', 'Shorten this week'),
      body: trPlan(
        'plan.recommend.shorten_body',
        'Time friction is showing up, so bias this week toward shorter but complete sessions.'
      ),
    },
    lighten: {
      label: trPlan('plan.recommend.lighten', 'Run a lighter week'),
      body: trPlan(
        'plan.recommend.lighten_body',
        'Recovery signals are climbing, so keep the structure but lower the physiological cost.'
      ),
    },
    deload: {
      label: trPlan('plan.recommend.deload', 'Take the deload'),
      body: trPlan(
        'plan.recommend.deload_body',
        'Fatigue and stall signals justify a lighter runway before pushing again.'
      ),
    },
  };
  return {
    adherenceRate30,
    sessions90: recentProgramWorkouts.length,
    adherenceSummary: trPlan(
      'plan.insight.adherence_30',
      '30-day adherence: {done}/{expected} planned sessions ({rate}%).',
      { done: recentProgramWorkouts.length, expected: expectedSessions, rate: adherenceRate30 }
    ),
    bestDayIndexes,
    bestDaysSummary: bestDayIndexes.length
      ? trPlan('plan.insight.best_days', 'You train most consistently on days {days}.', {
          days: bestDayIndexes.join(', '),
        })
      : '',
    progressionSummary: getProgramProgressSummary(context),
    frictionItems,
    frictionCount: frictionItems.length,
    recommendation: {
      type: recommendationType,
      ...(recommendationMap[recommendationType] || recommendationMap.continue),
    },
  } as CoachingInsights;
}

export {
  buildOnboardingRecommendation,
  computeFatigue,
  getFatigueConfig,
  getInitialPlanRecommendation,
  getMuscleLoadConfig,
  getProgramCapabilities,
  getProgramDifficultyMeta,
  getRecentDisplayMuscleLoads,
};
