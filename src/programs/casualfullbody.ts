import type { ProgramPlugin, ProgramSessionBuildContext } from '../domain/program-plugin';
import { getDisplayName } from '../domain/exercise-library';
import type {
  SessionOption,
  SportSchedule,
  WorkoutExercise,
  WorkoutRecord,
} from '../domain/types';
import { readLegacyWindowValue } from '../app/services/legacy-call';

type CasualFullBodyState = {
  sessionCount: number;
  currentStreak: number;
  lastSessionWeekKey: string | null;
  lastExercisesUsed: string[];
  daysPerWeek: number;
};

type CasualSlot = {
  id: string;
  name: string;
  pool: string[];
};

const SLOTS: CasualSlot[] = [
  {
    id: 'quad',
    name: 'Quad-Dominant (Legs)',
    pool: [
      'Barbell Back Squat',
      'Dumbbell Goblet Squat',
      'Machine Leg Press',
      'Dumbbell Lunges',
    ],
  },
  {
    id: 'hpress',
    name: 'Horizontal Press',
    pool: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Machine Chest Press'],
  },
  {
    id: 'pull',
    name: 'Pull (Back / Biceps)',
    pool: ['Lat Pull-down', 'Dumbbell Rows', 'Machine Rows'],
  },
  {
    id: 'hinge',
    name: 'Hinge / Hamstrings',
    pool: [
      'Barbell Romanian Deadlift',
      'Dumbbell Romanian Deadlift',
      'Dumbbell Glute Bridges',
    ],
  },
];

const ACCESSORY_POOL = [
  'Dumbbell Bicep Curls',
  'Dumbbell Lateral Raises',
  'Overhead Dumbbell Press',
  'Ab Crunches',
];

const LEG_LIFTS = [
  'barbell back squat',
  'dumbbell goblet squat',
  'machine leg press',
  'dumbbell lunges',
  'barbell romanian deadlift',
  'dumbbell romanian deadlift',
  'dumbbell glute bridges',
];

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trCFB(key: string, fallback: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return fallback;
  return window.I18N?.t?.(key, params, fallback) || fallback;
}

function getTrainingDaysPerWeek(programId: string, fallback: number) {
  const getter = readLegacyWindowValue<
    (programId?: string | null, profileLike?: Record<string, unknown> | null) => number
  >('getProgramTrainingDaysPerWeek');
  return Number(getter?.(programId)) || fallback;
}

function getTrainingDaysPerWeekLabel(value: number) {
  const getter = readLegacyWindowValue<(value: number) => string>(
    'getTrainingDaysPerWeekLabel'
  );
  return getter?.(value) || `${value} sessions / week`;
}

function getDefaultSportName() {
  return trCFB('common.sport', 'Sport');
}

function createInitialState(): CasualFullBodyState {
  return {
    sessionCount: 0,
    currentStreak: 0,
    lastSessionWeekKey: null,
    lastExercisesUsed: [],
    daysPerWeek: getTrainingDaysPerWeek('casualfullbody', 3),
  };
}

function migrateState(rawState: Record<string, unknown> | null | undefined) {
  const state = (rawState || {}) as Partial<CasualFullBodyState>;
  return {
    sessionCount: Number.isFinite(Number(state.sessionCount))
      ? Number(state.sessionCount)
      : 0,
    currentStreak: Number.isFinite(Number(state.currentStreak))
      ? Number(state.currentStreak)
      : 0,
    lastSessionWeekKey: state.lastSessionWeekKey
      ? String(state.lastSessionWeekKey)
      : null,
    lastExercisesUsed: Array.isArray(state.lastExercisesUsed)
      ? state.lastExercisesUsed.map((name) => String(name || ''))
      : [],
    daysPerWeek: getTrainingDaysPerWeek('casualfullbody', 3),
  };
}

function isoWeekKey(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + 3 - ((value.getDay() + 6) % 7));
  const yearStart = new Date(value.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((value.getTime() - yearStart.getTime()) / 86400000 -
        3 +
        ((yearStart.getDay() + 6) % 7)) /
        7
    );
  return `${value.getFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

function parseWeekKey(key: string | null) {
  if (!key) return null;
  const [year, week] = key.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return null;
  return { year, week };
}

function getISOWeekStartDate(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const weekStart = new Date(week1Monday);
  weekStart.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart;
}

function isNextWeek(previousKey: string | null, nextKey: string | null) {
  const previous = parseWeekKey(previousKey);
  const next = parseWeekKey(nextKey);
  if (!previous || !next) return false;
  const diffMs =
    getISOWeekStartDate(next.year, next.week).getTime() -
    getISOWeekStartDate(previous.year, previous.week).getTime();
  return diffMs === 7 * 24 * 60 * 60 * 1000;
}

function pickOne(pool: string[], lastUsed: string[]) {
  const fresh = pool.filter((exercise) => !lastUsed.includes(exercise));
  const candidates = fresh.length ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pickTwo(pool: string[], lastUsed: string[]) {
  const fresh = pool.filter((exercise) => !lastUsed.includes(exercise));
  const primary = fresh.length >= 2 ? fresh : [...pool];
  const shuffled = primary.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const first = shuffled[0];
  const second = pickOne(
    pool.filter((exercise) => exercise !== first),
    lastUsed
  );
  return [first, second];
}

function getDaysPerWeek() {
  return getTrainingDaysPerWeek('casualfullbody', 3);
}

function buildSessionLabel(count: number, streak: number) {
  const streakBadge =
    streak > 1
      ? ` · ${trCFB('program.cfb.week_streak_short', '{count}-wk streak', {
          count: streak,
        })}`
      : '';
  return (
    trCFB('program.cfb.session_label', 'Gym Basics · Session {count}', { count }) +
    streakBadge
  );
}

export const casualFullBodyProgram: ProgramPlugin<CasualFullBodyState> = {
  id: 'casualfullbody',
  name: 'Gym Basics',
  description:
    'Easy gym program with rotating full-body sessions. No maxes or planning needed.',
  icon: 'Target',
  legLifts: LEG_LIFTS,
  getInitialState: () => createInitialState(),
  migrateState: (state) => migrateState(state),
  getSessionOptions: (rawState): SessionOption[] => {
    const state = migrateState(rawState);
    return [
      {
        value: 'fullbody',
        label: buildSessionLabel((state.sessionCount || 0) + 1, state.currentStreak || 0),
        isRecommended: true,
        done: false,
      },
    ];
  },
  buildSession: (
    _selectedOption: string,
    rawState: CasualFullBodyState,
    context?: ProgramSessionBuildContext
  ): WorkoutExercise[] => {
    const state = migrateState(rawState);
    const lastUsed = state.lastExercisesUsed || [];
    const exercises: WorkoutExercise[] = [];

    SLOTS.forEach((slot, index) => {
      const name = pickOne(slot.pool, lastUsed);
      exercises.push({
        id: Date.now() + Math.random(),
        name,
        note: `${slot.name} · ${trCFB('program.cfb.note_main', '3 sets × 8-12 reps')}`,
        isAux: false,
        isAccessory: false,
        tm: 0,
        auxSlotIdx: index,
        sets: Array.from({ length: 3 }, () => ({
          weight: '',
          reps: 10,
          done: false,
          rpe: null,
        })),
      });
    });

    const accessories = pickTwo(ACCESSORY_POOL, lastUsed);
    accessories.forEach((name) => {
      exercises.push({
        id: Date.now() + Math.random(),
        name,
        note: trCFB('program.cfb.note_accessory', 'Accessory · 3 sets × 8-12 reps'),
        isAux: true,
        isAccessory: true,
        tm: 0,
        auxSlotIdx: 4,
        sets: Array.from({ length: 3 }, () => ({
          weight: '',
          reps: 12,
          done: false,
          rpe: null,
        })),
      });
    });

    if (context?.energyBoost) {
      const bonusName = pickOne(
        ACCESSORY_POOL.filter((name) => !accessories.includes(name)),
        lastUsed
      );
      exercises.push({
        id: Date.now() + Math.random(),
        name: bonusName,
        note: trCFB('program.cfb.note_accessory', 'Accessory · 3 sets × 8-12 reps'),
        isAux: true,
        isAccessory: true,
        tm: 0,
        auxSlotIdx: 5,
        sets: Array.from({ length: 3 }, () => ({
          weight: '',
          reps: 12,
          done: false,
          rpe: null,
        })),
      });
    }

    return exercises;
  },
  getSessionLabel: (_selectedOption, rawState) => {
    const state = migrateState(rawState);
    return buildSessionLabel((state.sessionCount || 0) + 1, state.currentStreak || 0);
  },
  getBlockInfo: (rawState) => {
    const state = migrateState(rawState);
    const streak = state.currentStreak || 0;
    const streakText =
      streak > 0
        ? ` · ${trCFB('program.cfb.week_streak_long', '{count}-week streak', {
            count: streak,
          })}`
        : '';
    return {
      name: trCFB('program.cfb.block_name', 'Gym Basics'),
      weekLabel:
        trCFB('program.cfb.block_label', 'Session {count}', {
          count: state.sessionCount || 0,
        }) + streakText,
      pct: null,
      isDeload: false,
      totalWeeks: null,
    };
  },
  getSessionCharacter: () => ({
    tone: 'normal',
    icon: 'Workout',
    labelKey: 'program.cfb.character.normal',
    labelFallback: trCFB(
      'program.cfb.character.normal',
      'Full body - varied exercises'
    ),
    labelParams: {},
  }),
  getPreSessionNote: (
    _selectedOption: string,
    rawState: CasualFullBodyState
  ) => {
    const state = migrateState(rawState);
    const count = (state.sessionCount || 0) + 1;
    const streak = state.currentStreak || 0;
    const streakNote =
      streak >= 2
        ? ` · ${trCFB('program.cfb.week_streak_long', '{count}-week streak', {
            count: streak,
          })}`
        : '';
    return (
      trCFB('program.cfb.note.default', 'Session {count}. Focus on effort and form.', {
        count,
      }) + streakNote
    );
  },
  adjustAfterSession: (exercises, rawState) => {
    const state = migrateState(rawState);
    return {
      ...state,
      lastExercisesUsed: exercises.map((exercise) => exercise.name),
    };
  },
  advanceState: (rawState) => {
    const state = migrateState(rawState);
    const currentWeekKey = isoWeekKey(new Date());
    const previousWeekKey = state.lastSessionWeekKey;
    let nextStreak = state.currentStreak || 0;

    if (!previousWeekKey) nextStreak = 1;
    else if (currentWeekKey === previousWeekKey) nextStreak = state.currentStreak || 0;
    else if (isNextWeek(previousWeekKey, currentWeekKey))
      nextStreak = (state.currentStreak || 0) + 1;
    else nextStreak = 1;

    return {
      ...state,
      sessionCount: (state.sessionCount || 0) + 1,
      currentStreak: nextStreak,
      lastSessionWeekKey: currentWeekKey,
    };
  },
  dateCatchUp: (state) => migrateState(state),
  getAuxSwapOptions: () => [],
  getBackSwapOptions: () => [],
  onAuxSwap: (state) => state,
  onBackSwap: (state) => state,
  getDashboardTMs: (rawState) => {
    const state = migrateState(rawState);
    const streak = state.currentStreak || 0;
    return [
      {
        name: trCFB('program.cfb.stats.sessions', 'Sessions'),
        value: String(state.sessionCount || 0),
      },
      {
        name: trCFB('program.cfb.stats.week_streak', 'Week Streak'),
        value:
          streak > 0
            ? trCFB(
                streak === 1
                  ? 'program.cfb.week_count_one'
                  : 'program.cfb.week_count_many',
                streak === 1 ? '{count} week' : '{count} weeks',
                { count: streak }
              )
            : trCFB('program.cfb.none', '-'),
      },
    ];
  },
  getBannerHTML: (_options, rawState, schedule, workouts) => {
    const state = migrateState(rawState);
    const sessionCount = state.sessionCount || 0;
    const streak = state.currentStreak || 0;
    const last = state.lastExercisesUsed || [];
    const todayDow = new Date().getDay();
    const sportDays = schedule?.sportDays || [];
    const legsHeavy = schedule?.sportLegsHeavy !== false;
    const recentHours =
      ({ easy: 18, moderate: 24, hard: 30 } as Record<string, number>)[
        String(schedule?.sportIntensity || 'hard')
      ] || 30;
    const sportName = schedule?.sportName || getDefaultSportName();
    const isSportDay = sportDays.includes(todayDow);
    const hadSportRecently = (workouts || []).some(
      (workout) =>
        (workout.type === 'sport' || workout.type === 'hockey') &&
        (Date.now() - new Date(workout.date).getTime()) / 3600000 <= recentHours
    );

    if ((isSportDay || hadSportRecently) && legsHeavy) {
      const sportLabel = isSportDay
        ? trCFB('dashboard.status.sport_day', '{sport} day', { sport: sportName })
        : trCFB('dashboard.post_sport', 'Post-{sport}', {
            sport: String(sportName).toLowerCase(),
          });
      return {
        style: 'rgba(59,130,246,0.1)',
        border: 'rgba(59,130,246,0.25)',
        color: 'var(--blue)',
        html: `Running ${sportLabel} - ${trCFB(
          'program.cfb.banner_sport_warning',
          'Session includes squats and hinges. Consider going lighter or resting today.'
        )}`,
      };
    }

    const streakText =
      streak > 1
        ? ` · <strong>${trCFB('program.cfb.week_streak_exclaim', '{count}-week streak!', {
            count: streak,
          })}</strong>`
        : streak === 1
          ? ` · ${trCFB('program.cfb.week_count_one', '{count} week', { count: 1 })}`
          : '';
    const lastHtml = last.length
      ? `<div style="margin-top:6px;font-size:11px;color:var(--muted)">${trCFB(
          'program.cfb.last_session',
          'Last session'
        )}: ${escapeHtml(last.slice(0, 4).join(', '))}${
          last.length > 4
            ? ` +${last.length - 4} ${trCFB('program.cfb.more', 'more')}`
            : ''
        } - ${trCFB(
          'program.cfb.next_rotates',
          'next session picks different exercises'
        )}</div>`
      : '';

    return {
      style: 'rgba(167,139,250,0.08)',
      border: 'rgba(167,139,250,0.15)',
      color: 'var(--purple)',
      html:
        trCFB('program.cfb.session_label', 'Gym Basics · Session {count}', {
          count: sessionCount + 1,
        }) +
        streakText +
        lastHtml,
    };
  },
  renderSimpleSettings: (rawState, container) => {
    const state = migrateState(rawState);
    container.innerHTML = `
      <div class="program-settings-grid">
        <div class="settings-section-card">
          <div class="settings-section-title">${trCFB(
            'program.cfb.simple.overview_title',
            'Weekly rhythm'
          )}</div>
          <div class="settings-section-sub">${trCFB(
            'program.cfb.simple.overview',
            'Gym Basics is the easy default: show up, train a balanced full-body session, and let the exercise rotation handle the planning. Weekly frequency now comes from Training Preferences.'
          )}</div>
          <div class="settings-row-note">${trCFB(
            'program.global_frequency_hint',
            'Uses your Training preference: {value}.',
            { value: getTrainingDaysPerWeekLabel(getDaysPerWeek()) }
          )}</div>
          <div class="settings-row-note">${trCFB(
            'program.cfb.no_tm_needed',
            'No Training Max setup needed. Add weight when 12 reps feels easy.'
          )}</div>
        </div>
        <div class="settings-section-card">
          <div class="settings-section-title">${trCFB(
            'program.cfb.session_stats',
            'Session Stats'
          )}</div>
          <div class="settings-section-sub">${trCFB(
            'program.cfb.simple.stats_help',
            'Exercise choices rotate automatically, so the main setup decision is simply how often you want to train.'
          )}</div>
          <div class="settings-picker-stack">
            <div class="settings-picker-row">
              <div class="settings-picker-main">
                <div class="settings-picker-label">${trCFB(
                  'program.cfb.stats.sessions',
                  'Sessions'
                )}</div>
                <div class="settings-picker-value">${escapeHtml(
                  String(state.sessionCount || 0)
                )}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  getSimpleSettingsSummary: () =>
    trCFB(
      'program.cfb.simple.summary',
      '{count} sessions/week · balanced full-body training',
      { count: getDaysPerWeek() }
    ),
  renderSettings: (rawState: CasualFullBodyState, container: HTMLElement) => {
    const state = migrateState(rawState);
    const last = state.lastExercisesUsed || [];
    const lastHtml = last.length
      ? last
          .map(
            (exercise) =>
              `<div style="font-size:12px;color:var(--text);padding:2px 0">• ${escapeHtml(
                getDisplayName(exercise)
              )}</div>`
          )
          .join('')
      : `<div style="font-size:12px;color:var(--muted)">${trCFB(
          'program.cfb.no_sessions_yet',
          'No sessions logged yet'
        )}</div>`;
    const slotHtml = SLOTS.map(
      (slot) => `<div style="margin-bottom:8px">
         <div style="font-size:11px;color:var(--muted);margin-bottom:3px">${escapeHtml(
           slot.name
         )}</div>
         <div style="font-size:12px;color:var(--text);padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px">
           ${slot.pool.map((name) => escapeHtml(getDisplayName(name))).join(' &nbsp;·&nbsp; ')}
         </div>
       </div>`
    ).join('');

    container.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;background:rgba(167,139,250,0.08);padding:8px 12px;border-radius:8px">
        ${trCFB(
          'program.cfb.setup_summary',
          'Low-planning full-body training · 3 sets × 8-12 reps · Exercises rotate automatically'
        )}
      </div>

      <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--text)">${escapeHtml(
            String(state.sessionCount || 0)
          )}</div>
          <div style="font-size:11px;color:var(--muted)">${trCFB(
            'history.total_sessions',
            'Total Sessions'
          )}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--text)">${escapeHtml(
            state.currentStreak > 0 ? String(state.currentStreak) : trCFB('program.cfb.none', '-')
          )}</div>
          <div style="font-size:11px;color:var(--muted)">${trCFB(
            'program.cfb.stats.week_streak',
            'Week Streak'
          )}</div>
        </div>
      </div>

      <div style="font-size:11px;color:var(--muted);margin-bottom:14px">
        ${trCFB('program.global_frequency_hint', 'Uses your Training preference: {value}.', {
          value: getTrainingDaysPerWeekLabel(getDaysPerWeek()),
        })}
      </div>

      <div class="divider-label"><span>${trCFB(
        'program.cfb.movement_pools',
        'Movement Pattern Pools'
      )}</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;margin-top:4px">
        ${trCFB(
          'program.cfb.pool_help',
          'Each session picks one exercise per slot and avoids last session choices.'
        )}
      </div>
      ${slotHtml}
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:3px">${trCFB(
          'program.cfb.slot5_accessories',
          'Slot 5 · Accessories (2 picked per session)'
        )}</div>
        <div style="font-size:12px;color:var(--text);padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px">
          ${ACCESSORY_POOL.map((name) => escapeHtml(getDisplayName(name))).join(
            ' &nbsp;·&nbsp; '
          )}
        </div>
      </div>

      <div class="divider-label"><span>${trCFB(
        'program.cfb.last_session',
        'Last session'
      )}</span></div>
      <div style="margin-top:8px;margin-bottom:14px">${lastHtml}</div>

      <div style="font-size:11px;color:var(--muted);margin-bottom:14px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;line-height:1.5">
        ${trCFB(
          'program.cfb.no_tm_needed',
          'No Training Max setup needed. Add weight when 12 reps feels easy.'
        )}
      </div>

      <button class="btn btn-purple" onclick="saveProgramSetup()">${trCFB(
        'program.cfb.save_setup',
        'Save Program Setup'
      )}</button>
    `;
  },
  saveSettings: (rawState) => migrateState(rawState),
  saveSimpleSettings: (rawState) => migrateState(rawState),
};
