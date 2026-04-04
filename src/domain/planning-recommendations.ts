import { resolveExerciseId } from './exercise-library';
import {
  getDefaultCoachingProfile,
  getDefaultTrainingPreferences,
  normalizeCoachingProfile,
  normalizeTrainingPreferences,
} from './normalizers';
import {
  getProgramCapabilities as getRegistryProgramCapabilities,
  getProgramDifficultyMeta as getRegistryProgramDifficultyMeta,
  getRegisteredPrograms,
} from '../core/program-registry.js';
import {
  cloneJson,
  getDefaultTrainingGoalLabel,
  getPlanningWindow,
  getStoredProfileRecord,
  getStoredScheduleRecord,
  type InitialPlanRecommendation,
  type MutableRecord,
  type ProgramCapabilities,
  type ProgramDifficultyMeta,
  trPlan,
} from './planning-utils';

function buildInitialWeekTemplate(
  programId: string,
  frequency: number,
  sessionMinutes: number
) {
  const rows: Array<Record<string, unknown>> = [];
  for (let index = 0; index < frequency; index += 1) {
    const dayLabel = trPlan('plan.week.day_label', 'Day {day}', { day: index + 1 });
    rows.push({
      dayLabel,
      type: programId === 'stronglifts5x5' && index % 2 !== 0 ? 'Workout B' : 'Session',
      durationHint: trPlan('onboarding.duration_value', '{count} min', {
        count: sessionMinutes,
      }),
    });
  }
  return rows;
}

export function getInitialPlanRecommendation(input?: Record<string, unknown>) {
  const next = input || {};
  const profileLike =
    cloneJson((next.profile as MutableRecord | null) || getStoredProfileRecord()) || {};
  const scheduleLike =
    cloneJson((next.schedule as MutableRecord | null) || getStoredScheduleRecord()) || {};
  const preferences = normalizeTrainingPreferences(profileLike);
  const coaching = normalizeCoachingProfile(profileLike);
  const programs = getRegisteredPrograms();
  const ranked = (programs.length
    ? programs
    : ['casualfullbody', 'forge', 'stronglifts5x5', 'wendler531', 'hypertrophysplit'].map(
        (id) => ({ id, name: id })
      )
  )
    .map((program) => ({
      program,
      score:
        (getRegistryProgramCapabilities(program.id)?.recommendationScore?.(
          Number(preferences.trainingDaysPerWeek) || 3,
          preferences
        ) || 0) +
        (program.id === 'casualfullbody' && coaching.experienceLevel === 'beginner' ? 5 : 0) +
        (program.id === 'forge' && preferences.goal === 'strength' ? 4 : 0) +
        (program.id === 'hypertrophysplit' && preferences.goal === 'hypertrophy' ? 4 : 0) +
        (program.id === 'wendler531' && coaching.experienceLevel === 'advanced' ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score || String(a.program.name).localeCompare(String(b.program.name)));
  const chosen = ranked[0]?.program || programs[0] || { id: 'forge', name: 'forge' };
  const programId = String(chosen.id || 'forge');
  const runtimeWindow = getPlanningWindow();
  const goalLabel =
    runtimeWindow?.getTrainingGoalLabel?.(preferences.goal) ||
    getDefaultTrainingGoalLabel(preferences.goal);
  return {
    programId,
    why: [
      trPlan('onboarding.why.goal_match', 'Matches your main goal: {goal}.', {
        goal: goalLabel,
      }),
    ],
    fitReasons: [
      trPlan('onboarding.fit.frequency', '{count} sessions / week', {
        count: Number(preferences.trainingDaysPerWeek) || 3,
      }),
      coaching.guidanceMode === 'guided'
        ? trPlan('onboarding.fit.guided', 'Guided')
        : trPlan('onboarding.fit.self_directed', 'Flexible'),
    ],
    weekTemplate: buildInitialWeekTemplate(
      programId,
      Number(preferences.trainingDaysPerWeek) || 3,
      Number(preferences.sessionMinutes) || 60
    ),
    firstSessionOption: '1',
    initialAdjustments: [],
  } as InitialPlanRecommendation;
}

function parseOnboardingExerciseIds(text: unknown) {
  return String(text || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((name) => resolveExerciseId(name) || name)
    .filter(Boolean);
}

export function buildOnboardingRecommendation(draft?: Record<string, unknown>) {
  const profile = getStoredProfileRecord();
  const schedule = getStoredScheduleRecord();
  const nextDraft = draft || {};
  const nextProfile = cloneJson(profile) || {};

  nextProfile.preferences = normalizeTrainingPreferences({
    ...nextProfile,
    preferences: {
      ...(((nextProfile.preferences as MutableRecord) ||
        getDefaultTrainingPreferences()) as MutableRecord),
      goal: nextDraft.goal,
      trainingDaysPerWeek:
        parseInt(String(nextDraft.trainingDaysPerWeek), 10) || 3,
      sessionMinutes: parseInt(String(nextDraft.sessionMinutes), 10) || 60,
      equipmentAccess: nextDraft.equipmentAccess,
    },
  });

  nextProfile.coaching = normalizeCoachingProfile({
    ...nextProfile,
    coaching: {
      ...(((nextProfile.coaching as MutableRecord) ||
        getDefaultCoachingProfile()) as MutableRecord),
      experienceLevel: nextDraft.experienceLevel,
      guidanceMode: nextDraft.guidanceMode,
      sportProfile: {
        name: String(nextDraft.sportName || '').trim(),
        inSeason: nextDraft.inSeason === true,
        sessionsPerWeek:
          parseInt(String(nextDraft.sportSessionsPerWeek), 10) || 0,
      },
      limitations: {
        jointFlags: [...((nextDraft.jointFlags as string[]) || [])],
        avoidMovementTags: [...((nextDraft.avoidMovementTags as string[]) || [])],
        avoidExerciseIds: parseOnboardingExerciseIds(nextDraft.avoidExercisesText),
      },
      exercisePreferences: {
        preferredExerciseIds: [],
        excludedExerciseIds: parseOnboardingExerciseIds(
          nextDraft.avoidExercisesText
        ),
      },
      onboardingCompleted: false,
    },
  });

  return getInitialPlanRecommendation({
    profile: nextProfile,
    schedule: {
      ...schedule,
      sportName:
        String(nextDraft.sportName || schedule.sportName || '').trim() ||
        String(schedule.sportName || ''),
    },
  });
}

export function getProgramCapabilities(programId?: string | null) {
  return { ...(getRegistryProgramCapabilities(programId) || {}) } as ProgramCapabilities;
}

export function getProgramDifficultyMeta(programId?: string | null) {
  return (
    cloneJson(getRegistryProgramDifficultyMeta(programId) || null) || {
      key: 'intermediate',
      labelKey: 'program.difficulty.intermediate',
      fallback: 'Intermediate',
    }
  ) as ProgramDifficultyMeta;
}
