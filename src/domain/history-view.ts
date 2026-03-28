import type { Profile, WorkoutRecord } from './types';

export type HistoryTab = 'log' | 'stats';
export type HistoryStatsRangeId = '8w' | '16w' | 'all';

export type HistoryHeatmapCell = {
  key: string;
  isToday: boolean;
  isFuture: boolean;
  lift: boolean;
  sport: boolean;
};

export type HistoryHeatmapView = {
  isOpen: boolean;
  weeks: number;
  cells: HistoryHeatmapCell[];
  weekNums: number[];
  dayLabels: string[];
  stats: {
    weekStreak: number;
    perWeek: string;
    totalVolume: number;
  };
  sportName: string;
  labels: {
    title: string;
    noStreak: string;
    streakUnit: string;
    streakLabel: string;
    liftsPerWeek: string;
    totalVolumeLabel: string;
    lift: string;
  };
};

export type HistoryExerciseSummary = {
  name: string;
  maxKg: number;
  setCount: number;
  topReps: number;
  amrapReps: number | null;
};

export type HistoryWorkoutCard = {
  id: string | number;
  isSport: boolean;
  title: string;
  date?: string;
  duration: number;
  iconLabel?: string;
  liftIcon?: string;
  sub?: string;
  isPR?: boolean;
  isBonus?: boolean;
  recovery: number | null;
  recoveryStyle: {
    color: string;
    bg: string;
    border: string;
  } | null;
  tonnage?: number;
  exerciseCount?: number;
  rpe?: number | null;
  exercises: HistoryExerciseSummary[];
  sessionNotes: string | null;
  tmAdjustments: Array<{
    lift: string;
    direction: 'up' | 'down';
    newTM: number;
  }> | null;
  deleteTitle: string;
  programBadge: string;
};

export type HistoryWorkoutGroup = {
  key: string;
  groupLabel: string;
  count: number;
  cards: HistoryWorkoutCard[];
};

export type HistoryLogView =
  | {
      empty: true;
      labels: {
        kicker: string;
        title: string;
        sub: string;
        cta: string;
        currentPhase: string;
      };
      phase: {
        name: string;
        desc: string | null;
      } | null;
    }
  | {
      empty: false;
      groups: HistoryWorkoutGroup[];
    };

export type HistoryChartPoint = {
  date: Date;
  weight: number;
  label: string;
};

export type HistoryStatsLiftSeries = {
  key: string;
  label: string;
  color: string;
  pts: HistoryChartPoint[];
};

export type HistoryStatsView = {
  range: {
    selected: HistoryStatsRangeId;
    options: Array<{
      id: HistoryStatsRangeId;
      label: string;
    }>;
  };
  numbers: Array<{
    label: string;
    value: string | number;
    color: string;
  }>;
  volume: {
    title: string;
    weeks: Array<{
      vol: number;
      label: string;
      isCurrent: boolean;
    }>;
    visible: boolean;
  };
  strength: {
    title: string;
    lifts: HistoryStatsLiftSeries[];
    nWeeks: number;
    visible: boolean;
  };
  e1rm: {
    title: string;
    lifts: HistoryStatsLiftSeries[];
    nWeeks: number;
    visible: boolean;
  };
  tmHistory: {
    title: string;
    lifts: HistoryStatsLiftSeries[];
    nWeeks: number;
    visible: boolean;
  };
  milestones: {
    title: string;
    items: Array<{
      liftKey: string;
      milestone: string;
      date: string;
      weight: string;
    }>;
    visible: boolean;
  };
};

export type HistoryViewModel = {
  tab: HistoryTab;
  labels: {
    log: string;
    stats: string;
    sessions: string;
    session: string;
    delete: string;
    prBadge: string;
    bonusBadge: string;
    volume: string;
    exercises: string;
    notes: string;
    statsEmptyTitle: string;
    statsEmptySub: string;
    milestoneDate: string;
  };
  heatmap: HistoryHeatmapView;
  log: HistoryLogView;
  stats: HistoryStatsView;
};

type SportScheduleLike = {
  sportName?: string;
  sportDays?: number[];
};

export type BuildHistoryViewInput = {
  workouts: WorkoutRecord[];
  profile: Profile | null;
  schedule: SportScheduleLike | null;
  activeProgram: Record<string, unknown> | null;
  activeProgramState: Record<string, unknown> | null;
  tab: HistoryTab;
  statsRange: HistoryStatsRangeId;
  heatmapOpen: boolean;
  t: (
    key: string,
    params?: Record<string, unknown> | null,
    fallback?: string
  ) => string;
  language?: string;
};

const HISTORY_STATS_RANGES: Record<HistoryStatsRangeId, number | null> = {
  '8w': 8,
  '16w': 16,
  all: null,
};

const HISTORY_MAIN_LIFTS = [
  {
    key: 'squat',
    labelKey: 'history.stats.lift.squat',
    fallback: 'Squat',
    color: 'var(--orange)',
  },
  {
    key: 'bench',
    labelKey: 'history.stats.lift.bench',
    fallback: 'Bench',
    color: 'var(--blue)',
  },
  {
    key: 'deadlift',
    labelKey: 'history.stats.lift.deadlift',
    fallback: 'Deadlift',
    color: 'var(--gold)',
  },
  {
    key: 'ohp',
    labelKey: 'history.stats.lift.ohp',
    fallback: 'OH Press',
    color: 'var(--purple)',
  },
] as const;

const HISTORY_EXACT_LIFT_NAME_MAP = {
  squat: new Set(['squat', 'back squat', 'barbell back squat']),
  bench: new Set(['bench press', 'bench']),
  deadlift: new Set(['deadlift']),
  ohp: new Set(['ohp', 'overhead press', 'overhead press (ohp)']),
};

const MS_PER_DAY = 86_400_000;

type HistoryWindow = Window & {
  getExerciseDisplayName?: (input: unknown, locale?: string) => string;
  resolveExerciseSelection?: (
    input: unknown
  ) => { name?: string | null } | null;
  parseLoggedRepCount?: (value: unknown) => number;
  isSportWorkout?: (workout: unknown) => boolean;
  getWeekStart?: (date: Date) => Date;
};

function getHistoryWindow(): HistoryWindow | null {
  if (typeof window === 'undefined') return null;
  return window as HistoryWindow;
}

function normalizeWorkouts(workouts: WorkoutRecord[] | null | undefined) {
  return Array.isArray(workouts) ? workouts : [];
}

function getLocale(language?: string) {
  return String(language || '').toLowerCase().startsWith('fi')
    ? 'fi-FI'
    : 'en-GB';
}

function getWeekStartDate(date: Date) {
  const runtimeWindow = getHistoryWindow();
  if (typeof runtimeWindow?.getWeekStart === 'function') {
    return runtimeWindow.getWeekStart(new Date(date));
  }
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value;
}

function isSportWorkout(workout: WorkoutRecord) {
  const runtimeWindow = getHistoryWindow();
  if (typeof runtimeWindow?.isSportWorkout === 'function') {
    return runtimeWindow.isSportWorkout(workout) === true;
  }
  return workout?.type === 'sport' || workout?.type === 'hockey';
}

function getScheduleSportName(
  schedule: SportScheduleLike | null,
  t: BuildHistoryViewInput['t']
) {
  return String(schedule?.sportName || t('common.sport', null, 'Sport'));
}

function displayExerciseName(name: string, locale?: string) {
  const runtimeWindow = getHistoryWindow();
  if (typeof runtimeWindow?.getExerciseDisplayName === 'function') {
    return runtimeWindow.getExerciseDisplayName(name, locale);
  }
  return String(name || '');
}

function canonicalExerciseName(name: string) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const runtimeWindow = getHistoryWindow();
  if (typeof runtimeWindow?.resolveExerciseSelection === 'function') {
    const resolved = runtimeWindow.resolveExerciseSelection(raw);
    return String(resolved?.name || raw)
      .trim()
      .toLowerCase();
  }
  return raw.toLowerCase();
}

function parseLoggedRepCount(value: unknown) {
  const runtimeWindow = getHistoryWindow();
  if (typeof runtimeWindow?.parseLoggedRepCount === 'function') {
    return runtimeWindow.parseLoggedRepCount(value);
  }
  return parseInt(String(value || ''), 10);
}

function normalizeLiftKey(name: string) {
  const value = canonicalExerciseName(name);
  if (!value) return '';
  if (HISTORY_EXACT_LIFT_NAME_MAP.bench.has(value)) return 'bench';
  if (HISTORY_EXACT_LIFT_NAME_MAP.deadlift.has(value)) return 'deadlift';
  if (HISTORY_EXACT_LIFT_NAME_MAP.ohp.has(value)) return 'ohp';
  if (HISTORY_EXACT_LIFT_NAME_MAP.squat.has(value)) return 'squat';
  return '';
}

function getStatsCutoff(range: HistoryStatsRangeId) {
  const weeks = HISTORY_STATS_RANGES[range];
  if (weeks == null) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - weeks * 7);
  return cutoff;
}

function filterStatsWorkoutDate(dateLike: string, cutoff: Date | null) {
  const value = new Date(dateLike);
  value.setHours(0, 0, 0, 0);
  if (!Number.isFinite(value.getTime())) return null;
  if (cutoff && value < cutoff) return null;
  return value;
}

function formatStatsDate(dateLike: string | Date, locale: string) {
  const value = new Date(dateLike);
  if (!Number.isFinite(value.getTime())) return '';
  return value.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function getLiftIcon(name: string, t: BuildHistoryViewInput['t']) {
  if (!name) return t('history.legend.lift', null, 'Lift');
  if (name.includes('Squat')) return 'SQ';
  if (name.includes('Bench')) return 'BP';
  if (name.includes('Deadlift')) return 'DL';
  if (name.includes('Press') || name.includes('OHP')) return 'PR';
  if (name.includes('Row')) return 'RW';
  return t('history.legend.lift', null, 'Lift');
}

function normalizeSessionNotes(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return null;
  const cleaned = text
    .replace(
      /Kirjaa j\u00e4ljell\u00e4 olevat toistot viimeisest\u00e4 sarjasta\.?/gi,
      ''
    )
    .replace(/Note reps left in tank on (the )?last set\.?/gi, '')
    .replace(/^[\s.,;:!?\-]+|[\s.,;:!?\-]+$/g, '')
    .trim();
  return cleaned || null;
}

function buildExerciseSummary(
  exercise: Record<string, any>,
  locale: string
): HistoryExerciseSummary | null {
  const workSets = (exercise.sets || []).filter(
    (set: Record<string, any>) => set.done && !set.isWarmup
  );
  const allDoneSets = (exercise.sets || []).filter(
    (set: Record<string, any>) => set.done
  );
  const doneSets = workSets.length > 0 ? workSets : allDoneSets;
  if (!doneSets.length) return null;

  const maxKg = Math.max(
    ...doneSets.map((set: Record<string, any>) => parseFloat(set.weight) || 0)
  );
  const heaviestSets = doneSets.filter(
    (set: Record<string, any>) => (parseFloat(set.weight) || 0) === maxKg
  );
  const repCounts = new Map<number, number>();

  heaviestSets.forEach((set: Record<string, any>) => {
    const reps = parseLoggedRepCount(set.reps);
    if (!Number.isFinite(reps) || reps <= 0) return;
    repCounts.set(reps, (repCounts.get(reps) || 0) + 1);
  });

  let topReps = 0;
  let setCount = 0;
  repCounts.forEach((count, reps) => {
    if (count > setCount || (count === setCount && reps > topReps)) {
      setCount = count;
      topReps = reps;
    }
  });

  const lastHeavy = (exercise.sets || []).find(
    (set: Record<string, any>) => set.isLastHeavySet && set.done
  );
  const lastHeavyReps = parseLoggedRepCount(lastHeavy?.reps);

  return {
    name: displayExerciseName(exercise.name, locale),
    maxKg,
    setCount,
    topReps,
    amrapReps:
      Number.isFinite(lastHeavyReps) && lastHeavyReps > 0 ? lastHeavyReps : null,
  };
}

function computePrs(workouts: WorkoutRecord[]) {
  const sorted = workouts
    .slice()
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const best: Record<string, number> = {};
  const prs = new Set<string | number>();

  sorted.forEach((workout) => {
    let hasPr =
      (parseInt(String((workout as Record<string, unknown>)?.prCount || ''), 10) ||
        0) > 0 ||
      (workout.exercises || []).some((exercise) =>
        (exercise.sets || []).some((set) => set?.isPr === true)
      );

    (workout.exercises || []).forEach((exercise) => {
      (exercise.sets || []).forEach((set) => {
        if (!set.isLastHeavySet && !set.isAmrap) return;
        if (!set.done) return;
        const reps = parseInt(String(set.reps || ''), 10);
        if (!Number.isFinite(reps) || reps <= 0) return;
        const key = `${exercise.name}_${parseFloat(String(set.weight || 0)) || 0}`;
        if (key in best && reps > best[key]) hasPr = true;
      });
    });

    if (hasPr) prs.add(workout.id);

    (workout.exercises || []).forEach((exercise) => {
      (exercise.sets || []).forEach((set) => {
        if (!set.isLastHeavySet && !set.isAmrap) return;
        if (!set.done) return;
        const reps = parseInt(String(set.reps || ''), 10);
        if (!Number.isFinite(reps) || reps <= 0) return;
        const key = `${exercise.name}_${parseFloat(String(set.weight || 0)) || 0}`;
        if (!(key in best) || reps > best[key]) best[key] = reps;
      });
    });
  });

  return prs;
}

function computeRecovery(workouts: WorkoutRecord[]) {
  const sorted = workouts
    .filter((workout) => workout.type !== 'hockey')
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const map: Record<string, number> = {};
  let previous: WorkoutRecord | null = null;

  sorted.forEach((workout) => {
    if (!previous) {
      map[String(workout.id)] = 85;
    } else {
      const gapDays =
        (+new Date(workout.date) - +new Date(previous.date)) / MS_PER_DAY;
      const prevRpe = previous.rpe || 7;
      const raw = Math.round(40 + (gapDays - 1) * 25 - (prevRpe - 7) * 4);
      map[String(workout.id)] = Math.max(20, Math.min(95, raw));
    }
    previous = workout;
  });

  return map;
}

function groupWorkouts(workouts: WorkoutRecord[], locale: string) {
  const groups = new Map<
    string,
    {
      key: string;
      groupLabel: string;
      workouts: WorkoutRecord[];
    }
  >();
  const sorted = workouts
    .slice()
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  sorted.forEach((workout) => {
    const date = new Date(workout.date);
    const weekStart = getWeekStartDate(date);
    const key = weekStart.toISOString().slice(0, 10);

    if (!groups.has(key)) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startStr = weekStart.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
      });
      const endStr = weekEnd.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
      });
      groups.set(key, {
        key,
        groupLabel: `${startStr} - ${endStr}`,
        workouts: [],
      });
    }

    groups.get(key)?.workouts.push(workout);
  });

  return [...groups.values()];
}

function getRecoveryStyle(pct: number | null) {
  if (pct == null) return null;
  if (pct >= 70) {
    return {
      color: 'var(--green)',
      bg: 'rgba(52,211,153,0.12)',
      border: 'rgba(52,211,153,0.3)',
    };
  }
  if (pct >= 45) {
    return {
      color: 'var(--orange)',
      bg: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.3)',
    };
  }
  return {
    color: 'var(--accent)',
    bg: 'rgba(230,57,70,0.12)',
    border: 'rgba(230,57,70,0.3)',
  };
}

function getDeleteTitle(
  workout: WorkoutRecord,
  schedule: SportScheduleLike | null,
  t: BuildHistoryViewInput['t']
) {
  if (!isSportWorkout(workout)) {
    return t('history.delete_workout', null, 'Delete Workout');
  }
  const sportLabel =
    workout.type === 'hockey'
      ? 'Hockey'
      : getScheduleSportName(schedule, t);
  return t(
    'history.delete_sport',
    { sport: sportLabel },
    'Delete {sport} Session'
  );
}

function programBadge(
  workout: WorkoutRecord,
  schedule: SportScheduleLike | null,
  t: BuildHistoryViewInput['t']
) {
  if (isSportWorkout(workout)) {
    return workout.type === 'hockey'
      ? 'Hockey'
      : getScheduleSportName(schedule, t);
  }
  const badges: Record<string, string> = {
    forge: 'Forge',
    wendler531: '5/3/1',
    stronglifts5x5: 'SL 5x5',
    casualfullbody: t('program.casualfullbody.shortName', null, 'Casual'),
    hypertrophysplit: t('program.hypertrophysplit.shortName', null, 'Hyper'),
  };
  const programId = String(workout.program || workout.type || '').trim();
  return badges[programId] || String(workout.programLabel || '');
}

function buildStructuredCard(
  workout: WorkoutRecord,
  isPr: boolean,
  recovery: number | null,
  schedule: SportScheduleLike | null,
  t: BuildHistoryViewInput['t'],
  locale: string
): HistoryWorkoutCard {
  const date = new Date(workout.date);
  const dateStr = date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const duration = Math.floor((workout.duration || 0) / 60);
  const isExtra = workout.subtype === 'extra';

  if (isSportWorkout(workout)) {
    const sportLabel =
      workout.type === 'hockey'
        ? 'Hockey'
        : getScheduleSportName(schedule, t);
    const title = isExtra
      ? t(
          'history.extra_sport_session',
          { sport: sportLabel },
          'Extra {sport} Session'
        )
      : t('history.sport_session', { sport: sportLabel }, '{sport} Session');
    return {
      id: workout.id,
      isSport: true,
      title,
      date: dateStr,
      duration,
      iconLabel: t('history.sport', null, 'Sport'),
      recovery: null,
      recoveryStyle: null,
      exercises: [],
      sessionNotes: null,
      tmAdjustments: null,
      deleteTitle: getDeleteTitle(workout, schedule, t),
      programBadge: programBadge(workout, schedule, t),
    };
  }

  const mainLifts = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'OHP'];
  const mainExercise = (workout.exercises || []).find((exercise) =>
    mainLifts.some((label) => exercise.name.includes(label))
  );
  const liftIcon = getLiftIcon(
    mainExercise?.name || workout.exercises?.[0]?.name || '',
    t
  );

  const meta = (workout.programMeta || {}) as Record<string, any>;
  let title = '';
  if (workout.program === 'forge' && meta.week) {
    title = t(
      'history.card.week_day',
      { week: meta.week, day: workout.programDayNum || 1 },
      'Week {week} · Day {day}'
    );
  } else {
    const rawLabel = String(workout.programLabel || '');
    title =
      rawLabel.replace(/^[\u{1F300}-\u{1FFFF}\u2600-\u27FF]\s*/u, '').trim() ||
      date.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });
  }

  let tonnage = 0;
  (workout.exercises || []).forEach((exercise) => {
    (exercise.sets || [])
      .filter((set) => set.done)
      .forEach((set) => {
        tonnage +=
          (parseFloat(String(set.weight || 0)) || 0) *
          (parseInt(String(set.reps || 0), 10) || 0);
      });
  });

  const completedExercises = (workout.exercises || []).filter((exercise) =>
    (exercise.sets || []).some((set) => set.done)
  );
  const exercises = completedExercises
    .map((exercise) => buildExerciseSummary(exercise as Record<string, any>, locale))
    .filter((value): value is HistoryExerciseSummary => !!value);

  return {
    id: workout.id,
    isSport: false,
    liftIcon,
    title,
    sub: dateStr,
    isPR: isPr,
    isBonus: (workout as Record<string, any>).isBonus === true,
    recovery,
    recoveryStyle: getRecoveryStyle(recovery),
    duration,
    tonnage,
    exerciseCount: completedExercises.length,
    rpe: workout.rpe || null,
    exercises,
    sessionNotes: normalizeSessionNotes((workout as Record<string, any>).sessionNotes),
    tmAdjustments:
      Array.isArray((workout as Record<string, any>).tmAdjustments) &&
      (workout as Record<string, any>).tmAdjustments.length
        ? ((workout as Record<string, any>).tmAdjustments as Array<{
            lift: string;
            direction: 'up' | 'down';
            newTM: number;
          }>)
        : null,
    deleteTitle: getDeleteTitle(workout, schedule, t),
    programBadge: programBadge(workout, schedule, t),
  };
}

function buildStructuredHeatmap(
  workouts: WorkoutRecord[],
  schedule: SportScheduleLike | null,
  heatmapOpen: boolean,
  t: BuildHistoryViewInput['t'],
  locale: string
): HistoryHeatmapView {
  const weeks = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStartDate(today);
  const gridStart = new Date(weekStart);
  gridStart.setDate(weekStart.getDate() - (weeks - 1) * 7);

  const dayMap: Record<string, { lift: boolean; sport: boolean }> = {};
  workouts.forEach((workout) => {
    const date = new Date(workout.date);
    date.setHours(0, 0, 0, 0);
    const key = date.toISOString().slice(0, 10);
    if (!dayMap[key]) dayMap[key] = { lift: false, sport: false };
    if (isSportWorkout(workout)) dayMap[key].sport = true;
    else dayMap[key].lift = true;
  });

  const cells: HistoryHeatmapCell[] = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    cells.push({
      key,
      isToday: date.getTime() === today.getTime(),
      isFuture: date > today,
      lift: !!dayMap[key]?.lift,
      sport: !!dayMap[key]?.sport,
    });
  }

  let weekStreak = 0;
  for (let i = 0; i < weeks; i += 1) {
    const rangeStart = new Date(weekStart);
    rangeStart.setDate(weekStart.getDate() - i * 7);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + 6);
    const hasLift = workouts.some((workout) => {
      if (isSportWorkout(workout)) return false;
      const workoutDate = new Date(workout.date);
      workoutDate.setHours(0, 0, 0, 0);
      return workoutDate >= rangeStart && workoutDate <= rangeEnd;
    });
    if (hasLift) weekStreak += 1;
    else if (i !== 0) break;
  }

  const cut28 = new Date(today);
  cut28.setDate(today.getDate() - 27);
  const last28 = workouts.filter(
    (workout) => !isSportWorkout(workout) && new Date(workout.date) >= cut28
  ).length;

  let totalVolume = 0;
  workouts.forEach((workout) => {
    if (isSportWorkout(workout)) return;
    const workoutDate = new Date(workout.date);
    workoutDate.setHours(0, 0, 0, 0);
    if (workoutDate < gridStart || workoutDate > today) return;
    (workout.exercises || []).forEach((exercise) => {
      (exercise.sets || [])
        .filter((set) => set.done)
        .forEach((set) => {
          totalVolume +=
            (parseFloat(String(set.weight || 0)) || 0) *
            (parseInt(String(set.reps || 0), 10) || 0);
        });
    });
  });

  const weekNums: number[] = [];
  for (let i = 0; i < weeks; i += 1) {
    const monday = new Date(gridStart);
    monday.setDate(gridStart.getDate() + i * 7);
    const temp = new Date(monday.getTime());
    temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
    const weekOne = new Date(temp.getFullYear(), 0, 4);
    weekNums.push(
      1 +
        Math.round(
          ((temp.getTime() - weekOne.getTime()) / 86400000 -
            3 +
            ((weekOne.getDay() + 6) % 7)) /
            7
        )
    );
  }

  return {
    isOpen: heatmapOpen,
    weeks,
    cells,
    weekNums,
    dayLabels:
      locale === 'fi-FI'
        ? ['M', 'T', 'K', 'T', 'P', 'L', 'S']
        : ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    stats: {
      weekStreak,
      perWeek: (last28 / 4).toFixed(1),
      totalVolume,
    },
    sportName: getScheduleSportName(schedule, t),
    labels: {
      title: t('history.activity_title', { weeks }, 'ACTIVITY · {weeks} WK'),
      noStreak: t('history.no_streak', null, 'No streak yet'),
      streakUnit: t('history.streak_unit', null, 'wk'),
      streakLabel: t('history.streak_label', null, 'streak'),
      liftsPerWeek: t('history.lifts_per_week', null, 'lifts/wk'),
      totalVolumeLabel: t('history.total_volume_label', null, 'total volume'),
      lift: t('history.legend.lift', null, 'Lift'),
    },
  };
}

function buildStructuredLog(
  workouts: WorkoutRecord[],
  activeProgram: Record<string, any> | null,
  activeProgramState: Record<string, any> | null,
  schedule: SportScheduleLike | null,
  t: BuildHistoryViewInput['t'],
  locale: string
): HistoryLogView {
  if (!workouts.length) {
    const blockInfo =
      activeProgram && typeof activeProgram.getBlockInfo === 'function'
        ? activeProgram.getBlockInfo(activeProgramState)
        : null;
    return {
      empty: true,
      labels: {
        kicker: t('history.activity_title', null, 'Activity'),
        title: t('history.empty_title', null, 'No sessions yet'),
        sub: t(
          'history.empty_sub',
          null,
          'Complete your first workout to start building your training history.'
        ),
        cta: t('history.start_today', null, "Start Today's Workout"),
        currentPhase: t('history.current_phase', null, 'Current Phase'),
      },
      phase:
        blockInfo && (blockInfo.name || blockInfo.modeDesc || blockInfo.weekLabel)
          ? {
              name:
                blockInfo.name ||
                blockInfo.weekLabel ||
                `Week ${activeProgramState?.week ?? ''}`.trim(),
              desc: blockInfo.modeDesc || null,
            }
          : null,
    };
  }

  const prSet = computePrs(workouts);
  const recoveryMap = computeRecovery(workouts);
  const groups = groupWorkouts(workouts, locale);

  return {
    empty: false,
    groups: groups.map((group) => ({
      key: group.key,
      groupLabel: group.groupLabel,
      count: group.workouts.length,
      cards: group.workouts.map((workout) =>
        buildStructuredCard(
          workout,
          prSet.has(workout.id),
          recoveryMap[String(workout.id)] ?? null,
          schedule,
          t,
          locale
        )
      ),
    })),
  };
}

function statsWeeklyVolume(
  workouts: WorkoutRecord[],
  count: number,
  t: BuildHistoryViewInput['t']
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentWeekStart = getWeekStartDate(today);

  return Array.from({ length: count }, (_, index) => {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - (count - 1 - index) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    let vol = 0;
    workouts.forEach((workout) => {
      if (isSportWorkout(workout)) return;
      const workoutDate = new Date(workout.date);
      workoutDate.setHours(0, 0, 0, 0);
      if (workoutDate < weekStart || workoutDate > weekEnd) return;
      (workout.exercises || []).forEach((exercise) => {
        (exercise.sets || [])
          .filter((set) => set.done)
          .forEach((set) => {
            vol +=
              (parseFloat(String(set.weight || 0)) || 0) *
              (parseInt(String(set.reps || 0), 10) || 0);
          });
      });
    });

    const temp = new Date(weekStart.getTime());
    temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
    const yearStart = new Date(temp.getFullYear(), 0, 4);
    const weekNumber =
      1 +
      Math.round(
        ((temp.getTime() - yearStart.getTime()) / 86400000 -
          3 +
          ((yearStart.getDay() + 6) % 7)) /
          7
      );

    return {
      vol,
      label: `${t('history.stats.week_prefix', null, 'W')}${weekNumber}`,
      isCurrent: index === count - 1,
    };
  });
}

function statsLiftProgress(
  workouts: WorkoutRecord[],
  matcher: (name: string) => boolean,
  range: HistoryStatsRangeId,
  locale: string
) {
  const cutoff = getStatsCutoff(range);
  const points: HistoryChartPoint[] = [];
  workouts
    .filter((workout) => !isSportWorkout(workout))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .forEach((workout) => {
      const workoutDate = filterStatsWorkoutDate(workout.date, cutoff);
      if (!workoutDate) return;
      const exercise = (workout.exercises || []).find((entry) => matcher(entry.name));
      if (!exercise) return;
      const weights = (exercise.sets || [])
        .filter((set) => set.done)
        .map((set) => parseFloat(String(set.weight || 0)) || 0)
        .filter((value) => value > 0);
      if (!weights.length) return;
      points.push({
        date: workoutDate,
        weight: Math.max(...weights),
        label: formatStatsDate(workoutDate, locale),
      });
    });
  return points;
}

function statsLiftE1rm(
  workouts: WorkoutRecord[],
  liftKey: string,
  range: HistoryStatsRangeId,
  locale: string
) {
  const cutoff = getStatsCutoff(range);
  const points: HistoryChartPoint[] = [];
  workouts
    .filter((workout) => !isSportWorkout(workout))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .forEach((workout) => {
      const workoutDate = filterStatsWorkoutDate(workout.date, cutoff);
      if (!workoutDate) return;
      const matches = (workout.exercises || []).filter(
        (exercise) => normalizeLiftKey(exercise.name) === liftKey
      );
      if (!matches.length) return;
      let best = 0;
      matches.forEach((exercise) => {
        (exercise.sets || [])
          .filter((set) => set.done)
          .forEach((set) => {
            const weight = parseFloat(String(set.weight || 0)) || 0;
            const reps = parseInt(String(set.reps || 0), 10) || 0;
            if (weight <= 0 || reps <= 0) return;
            const e1rm = weight * (1 + reps / 30);
            if (e1rm > best) best = e1rm;
          });
      });
      if (best <= 0) return;
      points.push({
        date: workoutDate,
        weight: Math.round(best * 10) / 10,
        label: formatStatsDate(workoutDate, locale),
      });
    });
  return points;
}

function statsTrainingMaxHistory(
  workouts: WorkoutRecord[],
  range: HistoryStatsRangeId,
  locale: string
) {
  const cutoff = getStatsCutoff(range);
  const historyMap: Record<string, HistoryChartPoint[]> = {
    squat: [],
    bench: [],
    deadlift: [],
    ohp: [],
  };

  workouts
    .filter((workout) => !isSportWorkout(workout))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .forEach((workout) => {
      const workoutDate = filterStatsWorkoutDate(workout.date, cutoff);
      if (!workoutDate) return;
      const mainLifts = (workout.programStateBefore as any)?.lifts?.main;
      if (!Array.isArray(mainLifts)) return;
      mainLifts.forEach((lift: Record<string, any>) => {
        const resolvedLiftKey = normalizeLiftKey(String(lift?.name || ''));
        const tm = parseFloat(String(lift?.tm || 0)) || 0;
        if (!resolvedLiftKey || tm <= 0 || !historyMap[resolvedLiftKey]) return;
        historyMap[resolvedLiftKey].push({
          date: workoutDate,
          weight: Math.round(tm * 10) / 10,
          label: formatStatsDate(workoutDate, locale),
        });
      });
    });

  return historyMap;
}

function statsMilestones(
  workouts: WorkoutRecord[],
  profile: Profile | null,
  locale: string,
  t: BuildHistoryViewInput['t']
) {
  const bodyWeight = parseFloat(String(profile?.bodyMetrics?.weight || 0)) || 0;
  if (bodyWeight <= 0) return [];
  const thresholds = [
    {
      liftKey: 'bench',
      ratio: 1,
      labelKey: 'history.milestone.bench_bw',
      fallback: 'Bodyweight Bench',
    },
    {
      liftKey: 'squat',
      ratio: 1.5,
      labelKey: 'history.milestone.squat_1_5x',
      fallback: '1.5x BW Squat',
    },
    {
      liftKey: 'deadlift',
      ratio: 2,
      labelKey: 'history.milestone.deadlift_2x',
      fallback: '2x BW Deadlift',
    },
  ];

  return thresholds
    .map((item) => {
      const target = bodyWeight * item.ratio;
      const points = statsLiftE1rm(workouts, item.liftKey, 'all', locale);
      const hit = points.find((point) => point.weight >= target);
      if (!hit) return null;
      return {
        liftKey: item.liftKey,
        milestone: t(item.labelKey, null, item.fallback),
        date: hit.label || formatStatsDate(hit.date, locale),
        weight: `${Math.round(hit.weight * 10) / 10} kg`,
      };
    })
    .filter((value): value is NonNullable<typeof value> => !!value);
}

function buildStructuredStats(
  workouts: WorkoutRecord[],
  profile: Profile | null,
  range: HistoryStatsRangeId,
  t: BuildHistoryViewInput['t'],
  locale: string
): HistoryStatsView {
  const liftWorkouts = workouts.filter((workout) => !isSportWorkout(workout));
  const sportWorkouts = workouts.filter((workout) => isSportWorkout(workout));
  const currentMonth = new Date().getMonth();

  let setsThisMonth = 0;
  liftWorkouts
    .filter((workout) => new Date(workout.date).getMonth() === currentMonth)
    .forEach((workout) => {
      (workout.exercises || []).forEach((exercise) => {
        setsThisMonth += (exercise.sets || []).filter((set) => set.done).length;
      });
    });

  const allRpe = workouts
    .filter((workout) => workout.rpe)
    .map((workout) => workout.rpe as number);
  const avgRpe = allRpe.length
    ? (allRpe.reduce((sum, value) => sum + value, 0) / allRpe.length).toFixed(1)
    : null;

  const weeks = statsWeeklyVolume(workouts, 10, t);
  const rangeWeeks = HISTORY_STATS_RANGES[range] ?? 16;
  const strengthLifts = HISTORY_MAIN_LIFTS.map((lift) => ({
    key: lift.key,
    label: t(lift.labelKey, null, lift.fallback),
    color: lift.color,
    pts: statsLiftProgress(
      workouts,
      (name) => normalizeLiftKey(name) === lift.key,
      range,
      locale
    ),
  }));
  const e1rmLifts = HISTORY_MAIN_LIFTS.map((lift) => ({
    key: lift.key,
    label: t(lift.labelKey, null, lift.fallback),
    color: lift.color,
    pts: statsLiftE1rm(workouts, lift.key, range, locale),
  }));
  const tmSeries = statsTrainingMaxHistory(workouts, range, locale);
  const tmLifts = HISTORY_MAIN_LIFTS.map((lift) => ({
    key: lift.key,
    label: t(lift.labelKey, null, lift.fallback),
    color: lift.color,
    pts: tmSeries[lift.key] || [],
  }));
  const milestones = statsMilestones(workouts, profile, locale, t);

  return {
    range: {
      selected: range,
      options: [
        { id: '8w', label: t('history.stats.range.8w', null, '8W') },
        { id: '16w', label: t('history.stats.range.16w', null, '16W') },
        { id: 'all', label: t('history.stats.range.all', null, 'All') },
      ],
    },
    numbers: [
      {
        label: t('history.total_sessions', null, 'Total Sessions'),
        value: liftWorkouts.length,
        color: 'var(--gold)',
      },
      {
        label: t('history.sport_sessions', null, 'Sport Sessions'),
        value: sportWorkouts.length,
        color: 'var(--blue)',
      },
      {
        label: t('history.sets_this_month', null, 'Sets This Month'),
        value: setsThisMonth,
        color: 'var(--accent)',
      },
      {
        label: t('history.avg_rpe', null, 'Avg RPE'),
        value: avgRpe || '—',
        color: 'var(--purple)',
      },
    ],
    volume: {
      title: t('history.stats.volume', null, 'Weekly Volume'),
      weeks,
      visible: weeks.some((week) => week.vol > 0),
    },
    strength: {
      title: t('history.stats.strength', null, 'Strength Progress'),
      lifts: strengthLifts,
      nWeeks: rangeWeeks || 16,
      visible: strengthLifts.some((lift) => lift.pts.length >= 1),
    },
    e1rm: {
      title: t('history.stats.e1rm', null, 'Estimated 1RM'),
      lifts: e1rmLifts,
      nWeeks: rangeWeeks || 16,
      visible: e1rmLifts.some((lift) => lift.pts.length >= 1),
    },
    tmHistory: {
      title: t('history.stats.tm_history', null, 'Training Max Trend'),
      lifts: tmLifts,
      nWeeks: rangeWeeks || 16,
      visible: tmLifts.some((lift) => lift.pts.length >= 1),
    },
    milestones: {
      title: t('history.stats.milestones', null, 'Milestones'),
      items: milestones,
      visible: milestones.length > 0,
    },
  };
}

export function buildHistoryViewModel(
  input: BuildHistoryViewInput
): HistoryViewModel {
  const workouts = normalizeWorkouts(input.workouts);
  const locale = getLocale(input.language);

  return {
    tab: input.tab,
    labels: {
      log: input.t('history.tab.log', null, 'Workout Log'),
      stats: input.t('history.tab.stats', null, 'Stats'),
      sessions: input.t('dashboard.sessions_left', null, 'sessions'),
      session: input.t('dashboard.session_left', { count: 1 }, 'session'),
      delete: input.t('common.delete', null, 'Delete'),
      prBadge: input.t('history.pr_badge', null, 'NEW PR'),
      bonusBadge: input.t('history.bonus_badge', null, 'Bonus'),
      volume: input.t('history.card.volume', null, 'Volume'),
      exercises: input.t('history.card.exercises', null, 'Exercises'),
      notes: input.t('history.card.notes', null, 'Notes'),
      statsEmptyTitle: input.t('history.stats_empty_title', null, 'No stats yet'),
      statsEmptySub: input.t(
        'history.stats_empty_sub',
        null,
        'Complete a few workouts to see your training trends.'
      ),
      milestoneDate: input.t('history.milestone.date', null, 'Unlocked {date}'),
    },
    heatmap: buildStructuredHeatmap(
      workouts,
      input.schedule,
      input.heatmapOpen,
      input.t,
      locale
    ),
    log: buildStructuredLog(
      workouts,
      input.activeProgram,
      input.activeProgramState,
      input.schedule,
      input.t,
      locale
    ),
    stats: buildStructuredStats(
      workouts,
      input.profile,
      input.statsRange,
      input.t,
      locale
    ),
  };
}
