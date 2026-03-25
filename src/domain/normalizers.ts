import type {
  BodyMetrics,
  CoachingProfile,
  Profile,
  SportSchedule,
  TrainingPreferences,
} from './types';

type MutableRecord = Record<string, unknown>;

function arrayifyProfileValue<T>(value: T | T[] | null | undefined | ''): T[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function resolveDefaultLocale(explicitLocale?: string) {
  const raw = String(explicitLocale || '').trim().toLowerCase();
  if (raw === 'fi' || raw.startsWith('fi-')) return 'fi';
  return 'en';
}

function getDefaultSportName(locale?: string) {
  return resolveDefaultLocale(locale) === 'fi' ? 'Kestävyys' : 'Cardio';
}

function isLegacyDefaultSportName(name: unknown) {
  const raw = String(name || '')
    .trim()
    .toLowerCase();
  return (
    raw === 'hockey' ||
    raw === 'jääkiekko' ||
    raw === 'cardio' ||
    raw === 'sport' ||
    raw === 'urheilu' ||
    raw === 'kestävyys'
  );
}

function sanitizeWorkoutTextValue(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return '';
  const limit = Math.max(0, parseInt(String(maxLength), 10) || 0);
  const cleaned = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim();
  return limit > 0 ? cleaned.slice(0, limit) : cleaned;
}

function normalizeBodyMetricNumber(
  value: unknown,
  min: number,
  max: number,
  options?: { integer?: boolean }
) {
  const opts = options || {};
  if (value === undefined || value === null || value === '') return null;
  const cleaned = String(value)
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  if (!/[0-9]/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  const clamped = Math.max(min, Math.min(max, parsed));
  return opts.integer === true ? Math.round(clamped) : clamped;
}

function fallbackCanonicalProgramId(programId: unknown) {
  const raw = String(programId || '').trim();
  if (!raw) return raw;
  if (raw === 'w531') return 'wendler531';
  return raw;
}

export function getDefaultTrainingPreferences(): TrainingPreferences {
  return {
    goal: 'strength',
    trainingDaysPerWeek: 3,
    sessionMinutes: 60,
    equipmentAccess: 'full_gym',
    sportReadinessCheckEnabled: false,
    warmupSetsEnabled: false,
    notes: '',
  };
}

export function normalizeTrainingPreferences(profileLike?: MutableRecord | null) {
  if (!profileLike || typeof profileLike !== 'object') {
    return getDefaultTrainingPreferences();
  }
  const defaults = getDefaultTrainingPreferences();
  const next = {
    ...defaults,
    ...((profileLike.preferences as MutableRecord | undefined) || {}),
  };
  const allowedGoals = new Set([
    'strength',
    'hypertrophy',
    'general_fitness',
    'sport_support',
  ]);
  const allowedEquipment = new Set([
    'full_gym',
    'basic_gym',
    'home_gym',
    'minimal',
  ]);
  const allowedTrainingDays = new Set([2, 3, 4, 5, 6]);
  const allowedMinutes = new Set([30, 45, 60, 75, 90]);

  if (!allowedGoals.has(String(next.goal || ''))) next.goal = defaults.goal;
  if (!allowedEquipment.has(String(next.equipmentAccess || ''))) {
    next.equipmentAccess = defaults.equipmentAccess;
  }

  const trainingDays = parseInt(String(next.trainingDaysPerWeek), 10);
  next.trainingDaysPerWeek = allowedTrainingDays.has(trainingDays)
    ? (trainingDays as TrainingPreferences['trainingDaysPerWeek'])
    : defaults.trainingDaysPerWeek;

  const minutes = parseInt(String(next.sessionMinutes), 10);
  next.sessionMinutes = allowedMinutes.has(minutes)
    ? (minutes as TrainingPreferences['sessionMinutes'])
    : defaults.sessionMinutes;

  next.sportReadinessCheckEnabled = next.sportReadinessCheckEnabled === true;
  next.warmupSetsEnabled = next.warmupSetsEnabled === true;

  if (next.detailedView === true || next.detailedView === false) {
    next.detailedView = next.detailedView;
  } else {
    delete next.detailedView;
  }

  next.notes = String(next.notes || '')
    .trim()
    .slice(0, 500);

  profileLike.preferences = next;
  return next;
}

export function getDefaultBodyMetrics(): BodyMetrics {
  return {
    sex: null,
    activityLevel: null,
    weight: null,
    height: null,
    age: null,
    targetWeight: null,
    bodyGoal: null,
  };
}

export function normalizeBodyMetrics(profileLike?: MutableRecord | null) {
  if (!profileLike || typeof profileLike !== 'object') {
    return getDefaultBodyMetrics();
  }

  const defaults = getDefaultBodyMetrics();
  const incoming =
    profileLike.bodyMetrics && typeof profileLike.bodyMetrics === 'object'
      ? (profileLike.bodyMetrics as MutableRecord)
      : {};
  const next = { ...defaults, ...incoming };

  const allowedSex = new Set(['male', 'female']);
  const allowedActivityLevels = new Set([
    'sedentary',
    'light',
    'moderate',
    'very_active',
  ]);
  const allowedGoals = new Set([
    'lose_fat',
    'gain_muscle',
    'recomp',
    'maintain',
  ]);

  next.sex = allowedSex.has(String(next.sex || '')) ? String(next.sex) : null;
  next.activityLevel = allowedActivityLevels.has(String(next.activityLevel || ''))
    ? String(next.activityLevel)
    : null;
  next.weight = normalizeBodyMetricNumber(next.weight, 30, 300);
  next.height = normalizeBodyMetricNumber(next.height, 100, 250);
  next.age = normalizeBodyMetricNumber(next.age, 10, 100, { integer: true });
  next.targetWeight = normalizeBodyMetricNumber(next.targetWeight, 30, 300);
  next.bodyGoal = allowedGoals.has(String(next.bodyGoal || ''))
    ? String(next.bodyGoal)
    : null;

  profileLike.bodyMetrics = next;
  return next;
}

export function getDefaultCoachingProfile(): CoachingProfile {
  return {
    experienceLevel: 'returning',
    guidanceMode: 'balanced',
    sportProfile: {
      name: '',
      inSeason: false,
      sessionsPerWeek: 0,
    },
    limitations: {
      jointFlags: [],
      avoidMovementTags: [],
      avoidExerciseIds: [],
    },
    exercisePreferences: {
      preferredExerciseIds: [],
      excludedExerciseIds: [],
    },
    behaviorSignals: {
      avoidedExerciseIds: [],
      skippedAccessoryExerciseIds: [],
      preferredSwapExerciseIds: [],
    },
    onboardingCompleted: false,
    onboardingSeen: false,
  };
}

export function normalizeCoachingProfile(profileLike?: MutableRecord | null) {
  if (!profileLike || typeof profileLike !== 'object') {
    return getDefaultCoachingProfile();
  }

  const defaults = getDefaultCoachingProfile();
  const incoming =
    profileLike.coaching && typeof profileLike.coaching === 'object'
      ? (profileLike.coaching as MutableRecord)
      : {};
  const next = {
    ...defaults,
    ...incoming,
    sportProfile: {
      ...defaults.sportProfile,
      ...(((incoming.sportProfile as MutableRecord) || {}) as MutableRecord),
    },
    limitations: {
      ...defaults.limitations,
      ...(((incoming.limitations as MutableRecord) || {}) as MutableRecord),
    },
    exercisePreferences: {
      ...defaults.exercisePreferences,
      ...(((incoming.exercisePreferences as MutableRecord) || {}) as MutableRecord),
    },
    behaviorSignals: {
      ...defaults.behaviorSignals,
      ...(((incoming.behaviorSignals as MutableRecord) || {}) as MutableRecord),
    },
  };

  const allowedExperience = new Set([
    'beginner',
    'returning',
    'intermediate',
    'advanced',
  ]);
  const allowedGuidance = new Set(['guided', 'balanced', 'self_directed']);

  if (!allowedExperience.has(String(next.experienceLevel || ''))) {
    next.experienceLevel = defaults.experienceLevel;
  }
  if (!allowedGuidance.has(String(next.guidanceMode || ''))) {
    next.guidanceMode = defaults.guidanceMode;
  }

  next.sportProfile.name = String(next.sportProfile.name || '')
    .trim()
    .slice(0, 60);
  next.sportProfile.inSeason = next.sportProfile.inSeason === true;

  const sportSessions = parseInt(String(next.sportProfile.sessionsPerWeek), 10);
  next.sportProfile.sessionsPerWeek = Number.isFinite(sportSessions)
    ? Math.max(0, Math.min(7, sportSessions))
    : 0;

  next.limitations.jointFlags = [
    ...new Set(
      arrayifyProfileValue(next.limitations.jointFlags)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.limitations.avoidMovementTags = [
    ...new Set(
      arrayifyProfileValue(next.limitations.avoidMovementTags)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.limitations.avoidExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.limitations.avoidExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.exercisePreferences.preferredExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.exercisePreferences.preferredExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.exercisePreferences.excludedExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.exercisePreferences.excludedExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.behaviorSignals.avoidedExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.behaviorSignals.avoidedExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.behaviorSignals.skippedAccessoryExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.behaviorSignals.skippedAccessoryExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.behaviorSignals.preferredSwapExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.behaviorSignals.preferredSwapExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.onboardingCompleted = next.onboardingCompleted === true;
  next.onboardingSeen =
    next.onboardingSeen === true ||
    (incoming.onboardingDismissed as unknown) === true;
  if ('onboardingDismissed' in next) delete next.onboardingDismissed;

  profileLike.coaching = next;
  return next;
}

export function normalizeProfileProgramStateMap(
  profileLike?: MutableRecord | null,
  canonicalizeProgramId?: (programId: unknown) => string
) {
  if (!profileLike || typeof profileLike !== 'object') return profileLike;
  if (!profileLike.programs || typeof profileLike.programs !== 'object') {
    return profileLike;
  }

  const normalized: Record<string, unknown> = {};
  const resolveProgramId = canonicalizeProgramId || fallbackCanonicalProgramId;

  Object.entries(profileLike.programs as Record<string, unknown>).forEach(
    ([programId, state]) => {
      const canonicalId = resolveProgramId(programId);
      const isCanonicalKey = canonicalId === programId;
      if (normalized[canonicalId] === undefined) {
        normalized[canonicalId] = state;
        return;
      }
      if (
        normalized[canonicalId] &&
        typeof normalized[canonicalId] === 'object' &&
        state &&
        typeof state === 'object'
      ) {
        normalized[canonicalId] = isCanonicalKey
          ? {
              ...(normalized[canonicalId] as Record<string, unknown>),
              ...(state as Record<string, unknown>),
            }
          : {
              ...(state as Record<string, unknown>),
              ...(normalized[canonicalId] as Record<string, unknown>),
            };
        return;
      }
      if (isCanonicalKey) normalized[canonicalId] = state;
    }
  );

  profileLike.programs = normalized;
  return profileLike;
}

export function normalizeScheduleState(
  scheduleLike?: MutableRecord | null,
  options?: { locale?: string }
) {
  if (!scheduleLike || typeof scheduleLike !== 'object') return scheduleLike;

  if (isLegacyDefaultSportName(scheduleLike.sportName)) {
    scheduleLike.sportName = getDefaultSportName(options?.locale);
  }

  scheduleLike.sportName =
    sanitizeWorkoutTextValue(scheduleLike.sportName || '', 60) || '';
  scheduleLike.sportDays = Array.isArray(scheduleLike.sportDays)
    ? [
        ...new Set(
          scheduleLike.sportDays
            .map((day) => parseInt(String(day), 10))
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        ),
      ]
    : [];

  if (
    !['easy', 'moderate', 'hard'].includes(
      String(scheduleLike.sportIntensity || '')
    )
  ) {
    scheduleLike.sportIntensity = 'hard';
  }

  scheduleLike.sportLegsHeavy = scheduleLike.sportLegsHeavy !== false;
  return scheduleLike;
}

export function cleanupLegacyProfileFields(profileLike?: MutableRecord | null) {
  if (!profileLike || typeof profileLike !== 'object') return profileLike;
  const legacyKeys = [
    'atsLifts',
    'atsWeek',
    'atsRounding',
    'atsDaysPerWeek',
    'atsDayNum',
    'atsBackExercise',
    'atsBackWeight',
    'atsMode',
    'atsWeekStartDate',
    'forgeLifts',
    'forgeWeek',
    'forgeRounding',
    'forgeDaysPerWeek',
    'forgeDayNum',
    'forgeBackExercise',
    'forgeBackWeight',
    'forgeMode',
    'forgeWeekStartDate',
  ];

  legacyKeys.forEach((key) => {
    if (key in profileLike) delete profileLike[key];
  });

  return profileLike;
}

export function normalizeProfileState(profileLike?: MutableRecord | null) {
  if (!profileLike || typeof profileLike !== 'object') return profileLike;
  cleanupLegacyProfileFields(profileLike);
  normalizeBodyMetrics(profileLike);
  normalizeTrainingPreferences(profileLike);
  normalizeCoachingProfile(profileLike);
  normalizeProfileProgramStateMap(profileLike);

  if (!profileLike.activeProgram) profileLike.activeProgram = 'forge';
  return profileLike as Profile;
}

export function normalizeProfileAndSchedule(options?: {
  profile?: MutableRecord | null;
  schedule?: MutableRecord | null;
  locale?: string;
}) {
  const profile = normalizeProfileState(options?.profile || null) as
    | Profile
    | null;
  const schedule = normalizeScheduleState(options?.schedule || null, {
    locale: options?.locale,
  }) as SportSchedule | null;
  return { profile, schedule };
}
