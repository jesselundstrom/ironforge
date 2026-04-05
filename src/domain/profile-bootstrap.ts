import {
  cleanupLegacyProfileFields,
  normalizeBodyMetrics,
  normalizeCoachingProfile,
  normalizeProfileProgramStateMap,
  normalizeScheduleState,
  normalizeTrainingPreferences,
} from './normalizers';
import { typedProgramRegistry } from '../programs/index';

type MutableRecord = Record<string, unknown>;

type BootstrapInput = {
  profile?: MutableRecord | null;
  schedule?: MutableRecord | null;
  workouts?: Array<Record<string, unknown>> | null;
  locale?: string;
  normalizeWorkouts?: boolean;
  applyProgramCatchUp?: boolean;
};

type BootstrapChangedFlags = {
  profile: boolean;
  schedule: boolean;
  workouts: boolean;
};

export type ProfileBootstrapResult = {
  profile: MutableRecord;
  schedule: MutableRecord;
  workouts: Array<Record<string, unknown>>;
  changed: BootstrapChangedFlags;
};

type ProgramDefinition = (typeof typedProgramRegistry)[keyof typeof typedProgramRegistry];

const PROGRAM_ID_ALIASES: Record<string, string> = {
  w531: 'wendler531',
};

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
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

function sanitizeWorkoutIdValue(value: unknown) {
  const normalized = sanitizeWorkoutTextValue(value, 120).replace(
    /[^a-zA-Z0-9:_-]/g,
    '_'
  );
  return normalized || 'workout';
}

function sanitizeWorkoutMetaValue(value: unknown) {
  if (value === undefined || value === null) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return sanitizeWorkoutTextValue(value, 120);
}

function normalizeEvent(event: unknown) {
  if (!event) return null;
  if (typeof event === 'string') {
    const text = String(event || '').trim();
    return text ? { code: 'legacy_text', text, params: {} } : null;
  }
  if (typeof event !== 'object') return null;
  const next = event as MutableRecord;
  const code = String(next.code || '').trim();
  if (!code) return null;
  if (code === 'legacy_text') {
    const text = String(next.text || '').trim();
    return text ? { code, text, params: {} } : null;
  }
  const params =
    next.params && typeof next.params === 'object'
      ? (cloneJson(next.params) as MutableRecord) || {}
      : {};
  return { code, params };
}

function normalizeEvents(list: unknown) {
  const seen = new Set<string>();
  const next: Array<Record<string, unknown>> = [];
  const items = Array.isArray(list) ? list : list ? [list] : [];
  items.forEach((item) => {
    const normalized = normalizeEvent(item);
    if (!normalized) return;
    const key =
      normalized.code === 'legacy_text'
        ? `legacy:${normalized.text}`
        : `${normalized.code}:${JSON.stringify(normalized.params || {})}`;
    if (seen.has(key)) return;
    seen.add(key);
    next.push(normalized);
  });
  return next;
}

function normalizeWorkoutCommentaryValue(workout: Record<string, unknown>) {
  const planningDecision =
    workout.planningDecision && typeof workout.planningDecision === 'object'
      ? (workout.planningDecision as MutableRecord)
      : {};
  const source =
    workout.commentary && typeof workout.commentary === 'object'
      ? (workout.commentary as MutableRecord)
      : null;
  const legacyReasons = Array.isArray(workout.adaptationReasons)
    ? workout.adaptationReasons
    : [];
  const restrictionFlags = Array.isArray(planningDecision.restrictionFlags)
    ? planningDecision.restrictionFlags
    : [];
  const reasonCodes = Array.isArray(planningDecision.reasonCodes)
    ? planningDecision.reasonCodes
    : [];
  const action = String(planningDecision.action || '').trim();
  const shouldMaterializeCommentary =
    !!source ||
    legacyReasons.length > 0 ||
    restrictionFlags.length > 0 ||
    reasonCodes.length > 0 ||
    !!action;

  if (!shouldMaterializeCommentary) {
    return {
      commentary: null,
      changed: 'adaptationReasons' in workout,
    };
  }

  const decisionCode = String(
    source?.decisionCode ||
      (action === 'rest'
        ? 'rest'
        : action === 'deload'
          ? 'deload'
          : action === 'train_light'
            ? 'train_light'
            : action === 'shorten'
              ? 'shorten'
              : restrictionFlags.includes('avoid_heavy_legs')
                ? 'sport_aware'
                : 'train')
  );

  const commentary = {
    version: 1,
    decisionCode,
    reasonCodes: [
      ...new Set(
        [
          ...(Array.isArray(source?.reasonCodes) ? source.reasonCodes : []),
          ...reasonCodes,
        ].filter(Boolean)
      ),
    ],
    restrictionFlags: [
      ...new Set(
        [
          ...(Array.isArray(source?.restrictionFlags)
            ? source.restrictionFlags
            : []),
          ...restrictionFlags,
        ].filter(Boolean)
      ),
    ],
    adaptationEvents: normalizeEvents(
      source?.adaptationEvents || (legacyReasons.length ? legacyReasons : [])
    ),
    equipmentHint: normalizeEvent(source?.equipmentHint),
    runnerEvents: normalizeEvents(source?.runnerEvents || []),
  };
  return {
    commentary,
    changed:
      JSON.stringify(commentary) !== JSON.stringify(source || null) ||
      'adaptationReasons' in workout,
  };
}

function sanitizeWorkoutSetRecord(set: Record<string, unknown>) {
  if ('weight' in set) set.weight = sanitizeWorkoutTextValue(set.weight, 24);
  if ('reps' in set) set.reps = sanitizeWorkoutTextValue(set.reps, 24);
  if ('done' in set) set.done = set.done === true;
  if ('isWarmup' in set) set.isWarmup = set.isWarmup === true;
  if ('isAmrap' in set) set.isAmrap = set.isAmrap === true;
  if ('isPr' in set) set.isPr = set.isPr === true;
  if ('isLastHeavySet' in set) set.isLastHeavySet = set.isLastHeavySet === true;
  if ('rirTarget' in set && set.rirTarget !== undefined && set.rirTarget !== null) {
    const rirTarget = parseFloat(String(set.rirTarget));
    set.rirTarget = Number.isFinite(rirTarget) ? rirTarget : null;
  }
  return set;
}

function sanitizeWorkoutExerciseRecord(exercise: Record<string, unknown>) {
  if ('name' in exercise) {
    exercise.name = sanitizeWorkoutTextValue(exercise.name, 160);
  }
  if ('exerciseId' in exercise && exercise.exerciseId !== undefined && exercise.exerciseId !== null) {
    exercise.exerciseId = sanitizeWorkoutTextValue(exercise.exerciseId, 120);
  }
  if ('notes' in exercise) {
    exercise.notes = sanitizeWorkoutTextValue(exercise.notes, 500);
  }
  if ('isAux' in exercise) exercise.isAux = exercise.isAux === true;
  if ('isAccessory' in exercise) {
    exercise.isAccessory = exercise.isAccessory === true;
  }
  if (Array.isArray(exercise.sets)) {
    exercise.sets = exercise.sets.map((set) =>
      sanitizeWorkoutSetRecord({ ...(set as MutableRecord) })
    );
  } else {
    exercise.sets = [];
  }
  return exercise;
}

function canonicalizeProgramId(programId: unknown) {
  const raw = String(programId || '').trim();
  if (!raw) return raw;
  if (typedProgramRegistry[raw as keyof typeof typedProgramRegistry]) return raw;
  return PROGRAM_ID_ALIASES[raw] || raw;
}

function getProgramDefinitions(): ProgramDefinition[] {
  return Object.values(typedProgramRegistry);
}

function normalizeWorkoutRecord(workoutLike: Record<string, unknown>) {
  const workout = cloneJson(workoutLike) as MutableRecord;
  let changed = false;

  const sanitizeStringField = (field: string, maxLength: number) => {
    if (!(field in workout)) return;
    const nextValue = sanitizeWorkoutTextValue(workout[field], maxLength);
    if (workout[field] !== nextValue) {
      workout[field] = nextValue;
      changed = true;
    }
  };

  sanitizeStringField('type', 48);
  sanitizeStringField('subtype', 48);
  sanitizeStringField('program', 48);
  sanitizeStringField('name', 160);
  sanitizeStringField('programLabel', 160);
  sanitizeStringField('sessionDescription', 280);
  sanitizeStringField('sessionNotes', 1000);

  if ('id' in workout) {
    const nextId = sanitizeWorkoutIdValue(workout.id);
    if (String(workout.id) !== nextId) {
      workout.id = nextId;
      changed = true;
    }
  }
  if ('date' in workout) {
    const nextDate = sanitizeWorkoutTextValue(workout.date, 64);
    if (workout.date !== nextDate) {
      workout.date = nextDate;
      changed = true;
    }
  }
  if (Array.isArray(workout.exercises)) {
    const beforeExercises = JSON.stringify(workout.exercises);
    workout.exercises = workout.exercises.map((exercise) =>
      sanitizeWorkoutExerciseRecord({ ...(exercise as MutableRecord) })
    );
    if (JSON.stringify(workout.exercises) !== beforeExercises) changed = true;
  } else if (workout.exercises !== undefined) {
    workout.exercises = [];
    changed = true;
  }
  if (workout.programMeta && typeof workout.programMeta === 'object') {
    const beforeMeta = JSON.stringify(workout.programMeta);
    Object.keys(workout.programMeta as MutableRecord).forEach((key) => {
      (workout.programMeta as MutableRecord)[key] = sanitizeWorkoutMetaValue(
        (workout.programMeta as MutableRecord)[key]
      );
    });
    if (JSON.stringify(workout.programMeta) !== beforeMeta) changed = true;
  }
  if (
    !workout.program &&
    workout.type &&
    workout.type !== 'hockey' &&
    workout.type !== 'sport'
  ) {
    workout.program = workout.type;
    changed = true;
  }
  if (
    (workout.forgeWeek !== undefined && workout.forgeWeek !== null) ||
    workout.programMeta
  ) {
    const beforeMeta = JSON.stringify(workout.programMeta || {});
    const meta = { ...((workout.programMeta as MutableRecord) || {}) };
    if (
      meta.week === undefined &&
      workout.forgeWeek !== undefined &&
      workout.forgeWeek !== null
    ) {
      meta.week = workout.forgeWeek;
    }
    workout.programMeta = meta;
    if (JSON.stringify(meta) !== beforeMeta) changed = true;
  }
  if (
    (workout.programDayNum === undefined || workout.programDayNum === null) &&
    workout.forgeDayNum !== undefined &&
    workout.forgeDayNum !== null
  ) {
    workout.programDayNum = workout.forgeDayNum;
    changed = true;
  }

  const canonicalProgram = canonicalizeProgramId(workout.program);
  if (canonicalProgram && canonicalProgram !== workout.program) {
    workout.program = canonicalProgram;
    changed = true;
  }
  if (workout.type && workout.type !== 'hockey' && workout.type !== 'sport') {
    const canonicalType = canonicalizeProgramId(workout.type);
    if (canonicalType && canonicalType !== workout.type) {
      workout.type = canonicalType;
      changed = true;
    }
  }

  const commentaryResult = normalizeWorkoutCommentaryValue(workout);
  if (commentaryResult.commentary) {
    workout.commentary = commentaryResult.commentary;
    if (commentaryResult.changed) changed = true;
  } else if ('commentary' in workout) {
    delete workout.commentary;
    changed = true;
  } else if (commentaryResult.changed) {
    changed = true;
  }

  if ('forgeWeek' in workout) {
    delete workout.forgeWeek;
    changed = true;
  }
  if ('forgeDayNum' in workout) {
    delete workout.forgeDayNum;
    changed = true;
  }
  if ('adaptationReasons' in workout) {
    delete workout.adaptationReasons;
    changed = true;
  }

  return { workout, changed };
}

function normalizeWorkoutRecords(items?: Array<Record<string, unknown>> | null) {
  let changed = false;
  const workouts = (items || []).map((workoutLike) => {
    const workout = cloneJson(workoutLike || {}) as MutableRecord;
    if (workout.type === 'ats') {
      workout.type = 'forge';
      workout.program = 'forge';
      if (workout.atsWeek) {
        workout.programMeta = {
          ...((workout.programMeta as MutableRecord) || {}),
          week: workout.atsWeek,
        };
      }
      if (workout.atsDayNum && workout.programDayNum === undefined) {
        workout.programDayNum = workout.atsDayNum;
      }
      if ('atsWeek' in workout) delete workout.atsWeek;
      if ('atsDayNum' in workout) delete workout.atsDayNum;
      changed = true;
    }
    const normalized = normalizeWorkoutRecord(workout);
    if (normalized.changed) changed = true;
    return normalized.workout;
  });
  return { workouts, changed };
}

function normalizeImportedRestDuration(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 120;
  return Math.max(0, Math.min(3600, Math.round(parsed)));
}

function normalizeImportedLanguage(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'fi'
    ? 'fi'
    : 'en';
}

function ensureLegacyForgeProfileMigration(profile: MutableRecord) {
  if (profile.atsLifts && !profile.forgeLifts) {
    profile.forgeLifts = profile.atsLifts;
    profile.forgeWeek = profile.atsWeek || 1;
    profile.forgeRounding = profile.atsRounding || 2.5;
    profile.forgeDaysPerWeek = profile.atsDaysPerWeek || 3;
    profile.forgeDayNum = profile.atsDayNum || 1;
    profile.forgeBackExercise = profile.atsBackExercise || 'Barbell Rows';
    profile.forgeBackWeight = profile.atsBackWeight || 0;
    profile.forgeMode = profile.atsMode || 'sets';
    profile.forgeWeekStartDate =
      profile.atsWeekStartDate || new Date().toISOString();
  }
  if (profile.forgeLifts && !profile.programs) {
    profile.programs = {
      forge: {
        week: profile.forgeWeek || 1,
        dayNum: profile.forgeDayNum || 1,
        daysPerWeek: profile.forgeDaysPerWeek || 3,
        mode: profile.forgeMode || 'sets',
        rounding: profile.forgeRounding || 2.5,
        weekStartDate: profile.forgeWeekStartDate || new Date().toISOString(),
        backExercise: profile.forgeBackExercise || 'Barbell Rows',
        backWeight: profile.forgeBackWeight || 0,
        lifts: cloneJson(profile.forgeLifts),
      },
    };
    profile.activeProgram = 'forge';
  }
}

function ensureCanonicalProfileState(
  profile: MutableRecord,
  locale?: string,
  options?: { applyProgramCatchUp?: boolean }
) {
  ensureLegacyForgeProfileMigration(profile);
  cleanupLegacyProfileFields(profile);
  normalizeBodyMetrics(profile);
  normalizeTrainingPreferences(profile);
  normalizeCoachingProfile(profile);
  normalizeProfileProgramStateMap(profile, canonicalizeProgramId);

  if (!profile.activeProgram) profile.activeProgram = 'forge';
  profile.activeProgram = canonicalizeProgramId(profile.activeProgram) || 'forge';
  profile.language = normalizeImportedLanguage(profile.language || locale || 'en');

  if (!profile.programs || typeof profile.programs !== 'object') {
    profile.programs = {};
  }

  getProgramDefinitions().forEach((program) => {
    const programs = profile.programs as Record<string, unknown>;
    const programId = String(program.id || '').trim();
    if (!programId) return;
    if (programs[programId] === undefined) {
      programs[programId] =
        cloneJson(
          typeof program.getInitialState === 'function'
            ? program.getInitialState()
            : {}
        ) || {};
    }
  });

  getProgramDefinitions().forEach((program) => {
    const programs = profile.programs as Record<string, unknown>;
    const programId = String(program.id || '').trim();
    if (!programId) return;
    const currentState =
      programs[programId] && typeof programs[programId] === 'object'
        ? (cloneJson(programs[programId]) as Record<string, unknown>)
        : cloneJson(
            typeof program.getInitialState === 'function'
              ? program.getInitialState()
              : {}
          ) || {};
    programs[programId] =
      typeof program.migrateState === 'function'
        ? (cloneJson(program.migrateState(currentState)) as Record<string, unknown>)
        : currentState;
  });

  const programs = profile.programs as Record<string, unknown>;
  const activeProgramId = canonicalizeProgramId(profile.activeProgram) || 'forge';
  const activeDefinition = typedProgramRegistry[
    activeProgramId as keyof typeof typedProgramRegistry
  ];

  if (activeDefinition && programs[activeProgramId] === undefined) {
    programs[activeProgramId] =
      cloneJson(
        typeof activeDefinition.getInitialState === 'function'
          ? activeDefinition.getInitialState()
          : {}
      ) || {};
  }

  if (!activeDefinition) {
    const fallbackProgramId =
      Object.keys(programs).find((programId) =>
        typedProgramRegistry[programId as keyof typeof typedProgramRegistry]
      ) || 'forge';
    profile.activeProgram = fallbackProgramId;
  }

  const finalActiveProgramId =
    canonicalizeProgramId(profile.activeProgram) || 'forge';
  const finalActiveDefinition =
    typedProgramRegistry[finalActiveProgramId as keyof typeof typedProgramRegistry];
  if (
    options?.applyProgramCatchUp !== false &&
    finalActiveDefinition &&
    typeof finalActiveDefinition.dateCatchUp === 'function' &&
    programs[finalActiveProgramId] &&
    typeof programs[finalActiveProgramId] === 'object'
  ) {
    programs[finalActiveProgramId] = cloneJson(
      finalActiveDefinition.dateCatchUp(
        cloneJson(programs[finalActiveProgramId]) as Record<string, unknown>
      )
    ) || { ...(programs[finalActiveProgramId] as MutableRecord) };
  }

  profile.defaultRest = normalizeImportedRestDuration(profile.defaultRest);
  cleanupLegacyProfileFields(profile);
}

export function bootstrapProfileRuntime(
  input?: BootstrapInput | null
): ProfileBootstrapResult {
  const sourceProfile = cloneJson((input?.profile as MutableRecord | null) || {}) || {};
  const sourceSchedule =
    cloneJson((input?.schedule as MutableRecord | null) || {}) || {};
  const sourceWorkouts =
    cloneJson((input?.workouts as Array<Record<string, unknown>> | null) || []) || [];
  const profileBefore = JSON.stringify(sourceProfile || {});
  const scheduleBefore = JSON.stringify(sourceSchedule || {});
  const workoutsBefore = JSON.stringify(sourceWorkouts || []);

  const nextProfile = sourceProfile;
  const nextSchedule = sourceSchedule;
  const normalizeWorkoutsEnabled = input?.normalizeWorkouts !== false;

  if (nextSchedule.hockeyDays && !nextSchedule.sportDays) {
    nextSchedule.sportDays = cloneJson(nextSchedule.hockeyDays);
    delete nextSchedule.hockeyDays;
  }
  normalizeScheduleState(nextSchedule, { locale: input?.locale });
  ensureCanonicalProfileState(nextProfile, input?.locale, {
    applyProgramCatchUp: input?.applyProgramCatchUp !== false,
  });

  const normalizedWorkouts = normalizeWorkoutsEnabled
    ? normalizeWorkoutRecords(sourceWorkouts)
    : {
        workouts: sourceWorkouts,
        changed: false,
      };

  return {
    profile: nextProfile,
    schedule: nextSchedule,
    workouts: normalizedWorkouts.workouts,
    changed: {
      profile: JSON.stringify(nextProfile || {}) !== profileBefore,
      schedule: JSON.stringify(nextSchedule || {}) !== scheduleBefore,
      workouts:
        normalizedWorkouts.changed ||
        JSON.stringify(normalizedWorkouts.workouts || []) !== workoutsBefore,
    },
  };
}
