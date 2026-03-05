// ── CASUAL FULL BODY ──────────────────────────────────────────────────────────
// Slot-based variety engine: 2-3x/week, full body, approachable.
// Every session picks from equipment-restricted movement pattern pools,
// always rotating away from the last session's exercises.
// State tracks: session streak (weekly) + last exercises used (for variety).
(function () {
'use strict';

// ─── SLOT POOLS ──────────────────────────────────────────────────────────────
const SLOTS = [
  {
    id: 'quad',
    name: 'Quad-Dominant (Legs)',
    pool: ['Barbell Back Squat', 'Dumbbell Goblet Squat', 'Machine Leg Press', 'Dumbbell Lunges']
  },
  {
    id: 'hpress',
    name: 'Horizontal Press',
    pool: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Machine Chest Press']
  },
  {
    id: 'pull',
    name: 'Pull (Back / Biceps)',
    pool: ['Lat Pull-down (Wide Grip)', 'Lat Pull-down (Close Grip)', 'Dumbbell Rows', 'Barbell Rows']
  },
  {
    id: 'hinge',
    name: 'Hinge / Hamstrings',
    pool: ['Barbell Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Dumbbell Glute Bridges']
  }
];

const ACCESSORY_POOL = [
  'Dumbbell Bicep Curls',
  'Dumbbell Lateral Raises',
  'Overhead Dumbbell Press',
  'Ab Crunches'
];

// ─── SELECTION HELPERS ────────────────────────────────────────────────────────

// Pick one exercise from pool, preferring those not used last session.
function pickOne(pool, lastUsed) {
  const fresh = pool.filter(ex => !lastUsed.includes(ex));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Pick two distinct exercises from pool, preferring those not used last session.
function pickTwo(pool, lastUsed) {
  const fresh = pool.filter(ex => !lastUsed.includes(ex));
  const primary = fresh.length >= 2 ? fresh : [...pool];

  // Fisher-Yates shuffle on a copy
  const shuffled = primary.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const first = shuffled[0];
  // Pick second from full pool excluding first, still preferring fresh
  const remaining = pool.filter(ex => ex !== first);
  const second = pickOne(remaining, lastUsed);
  return [first, second];
}

// ─── STREAK HELPERS ───────────────────────────────────────────────────────────
// Returns a compact "YYYY-WW" ISO week key for a Date.
function isoWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Shift to nearest Thursday (ISO week definition)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - yearStart) / 86400000 - 3 + (yearStart.getDay() + 6) % 7) / 7);
  return d.getFullYear() + '-' + String(weekNum).padStart(2, '0');
}

// Parse "YYYY-WW" into { year, week }
function parseWeekKey(key) {
  if (!key) return null;
  const [y, w] = key.split('-').map(Number);
  return isNaN(y) || isNaN(w) ? null : { year: y, week: w };
}

// Returns true if keyB is exactly one ISO week after keyA.
function isNextWeek(keyA, keyB) {
  const a = parseWeekKey(keyA);
  const b = parseWeekKey(keyB);
  if (!a || !b) return false;
  // Simple: convert to total week number and compare
  const totalA = a.year * 53 + a.week;
  const totalB = b.year * 53 + b.week;
  return totalB - totalA === 1;
}

// ─── PROGRAM OBJECT ───────────────────────────────────────────────────────────
const CASUAL_FULL_BODY = {
  id:          'casualfullbody',
  name:        'Casual Full Body',
  description: 'Flexible full body training, 2-3 sessions/week. No maxes needed.',
  icon:        '🎯',
  dashboardStatsLabel: 'Session Stats',

  // Legs-containing lift names (lowercase) for hockey fatigue awareness
  legLifts: [
    'barbell back squat', 'dumbbell goblet squat', 'machine leg press', 'dumbbell lunges',
    'barbell romanian deadlift', 'dumbbell romanian deadlift', 'dumbbell glute bridges'
  ],

  // ─── State ────────────────────────────────────────────────────────────────
  getInitialState() {
    return {
      sessionCount:      0,
      currentStreak:     0,      // consecutive weeks with >= 1 session
      lastSessionWeekKey: null,  // ISO week key of the most recent session
      lastExercisesUsed: [],     // exercise names from the previous session
      daysPerWeek:       3
    };
  },

  // ─── Session Options ──────────────────────────────────────────────────────
  getSessionOptions(state) {
    const sc     = state.sessionCount || 0;
    const streak = state.currentStreak || 0;
    const streakBadge = streak > 1 ? ' · ' + streak + '-wk streak' : '';
    return [{
      value:         'fullbody',
      label:         'Full Body · Session ' + (sc + 1) + streakBadge,
      isRecommended: true,
      done:          false
    }];
  },

  // ─── Build Session ────────────────────────────────────────────────────────
  buildSession(selectedOption, state) {
    const lastUsed  = state.lastExercisesUsed || [];
    const exercises = [];

    // Slots 1–4: one exercise each
    SLOTS.forEach((slot, idx) => {
      const name = pickOne(slot.pool, lastUsed);
      exercises.push({
        id:         Date.now() + Math.random(),
        name,
        note:       slot.name + ' · 3 sets × 8–12 reps',
        isAux:      false,
        isAccessory: false,
        tm:         0,
        auxSlotIdx: idx,
        slotId:     slot.id,
        sets:       Array.from({ length: 3 }, () => ({ weight: '', reps: 10, done: false, rpe: null }))
      });
    });

    // Slot 5: pick 2 accessories
    const accessories = pickTwo(ACCESSORY_POOL, lastUsed);
    accessories.forEach(name => {
      exercises.push({
        id:          Date.now() + Math.random(),
        name,
        note:        'Accessory · 3 sets × 8–12 reps',
        isAux:       true,
        isAccessory: true,
        tm:          0,
        auxSlotIdx:  4,
        slotId:      'accessory',
        sets:        Array.from({ length: 3 }, () => ({ weight: '', reps: 12, done: false, rpe: null }))
      });
    });

    return exercises;
  },

  // ─── Labels & Info ────────────────────────────────────────────────────────
  getSessionLabel(selectedOption, state) {
    const sc     = (state.sessionCount || 0) + 1;
    const streak = state.currentStreak || 0;
    const fireStr = streak > 1 ? ' · ' + streak + '-wk streak' : '';
    return 'Full Body · Session ' + sc + fireStr;
  },

  getBlockInfo(state) {
    const sc     = state.sessionCount || 0;
    const streak = state.currentStreak || 0;
    const streakStr = streak > 0 ? ' · ' + streak + '-week streak' : '';
    return {
      name:       'Full Body',
      weekLabel:  'Session ' + sc + streakStr,
      pct:        null,
      isDeload:   false,
      totalWeeks: null
    };
  },

  // ─── Adjust After Session ─────────────────────────────────────────────────
  // Saves the exercises used so the next buildSession can avoid repeating them.
  adjustAfterSession(exercises, state) {
    const newState = JSON.parse(JSON.stringify(state));
    newState.lastExercisesUsed = exercises.map(ex => ex.name);
    return newState;
  },

  // ─── Advance State ────────────────────────────────────────────────────────
  // Increments session count and updates the weekly streak.
  advanceState(state) {
    const newState      = JSON.parse(JSON.stringify(state));
    newState.sessionCount = (state.sessionCount || 0) + 1;

    const thisWeekKey  = isoWeekKey(new Date());
    const lastWeekKey  = state.lastSessionWeekKey || null;

    if (!lastWeekKey || thisWeekKey === lastWeekKey) {
      // First ever session, or second/third session in the same week
      // Streak starts at 1 if this is the first session logged for that week
      if (!lastWeekKey) newState.currentStreak = 1;
      // else: same week — no change to streak
    } else if (isNextWeek(lastWeekKey, thisWeekKey)) {
      // Consecutive week — extend streak
      newState.currentStreak = (state.currentStreak || 0) + 1;
    } else {
      // Missed one or more weeks — reset
      newState.currentStreak = 1;
    }

    newState.lastSessionWeekKey = thisWeekKey;
    return newState;
  },

  dateCatchUp: null,

  // ─── Aux/Back Swap (not used) ─────────────────────────────────────────────
  getAuxSwapOptions() { return null; },
  getBackSwapOptions() { return []; },
  onAuxSwap(_si, _n, s) { return s; },
  onBackSwap(_n, s)     { return s; },

  // ─── Dashboard Stats ──────────────────────────────────────────────────────
  getDashboardTMs(state) {
    const sc     = state.sessionCount || 0;
    const streak = state.currentStreak || 0;
    return [
      { name: 'Sessions',    value: String(sc) },
      { name: 'Week Streak',  value: streak > 0 ? streak + (streak === 1 ? ' week' : ' weeks') : '—' }
    ];
  },

  // ─── Dashboard Banner ─────────────────────────────────────────────────────
  getBannerHTML(options, state, schedule, workouts) {
    const sc     = state.sessionCount || 0;
    const streak = state.currentStreak || 0;
    const last   = state.lastExercisesUsed || [];

    const todayDow          = new Date().getDay();
    const sportDays         = schedule?.sportDays||schedule?.hockeyDays||[];
    const legsHeavy         = schedule?.sportLegsHeavy!==false;
    const recentHours       = {easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const sportName         = schedule?.sportName||'Sport';
    const isSportDay        = sportDays.includes(todayDow);
    const hadSportRecently  = workouts?.some(w =>
      (w.type === 'sport' || w.type === 'hockey') && (Date.now() - new Date(w.date).getTime()) / 3600000 <= recentHours
    );

    if ((isSportDay || hadSportRecently) && legsHeavy) {
      const sportLabel = isSportDay ? sportName+' day' : 'Post-'+sportName.toLowerCase();
      return {
        style:  'rgba(59,130,246,0.1)',
        border: 'rgba(59,130,246,0.25)',
        color:  'var(--blue)',
        html:   '🏃 '+sportLabel+' — session includes Squats &amp; Hinges. Consider going lighter or resting today.'
      };
    }

    const streakStr = streak > 1
      ? ' · <strong>' + streak + '-week streak!</strong>'
      : streak === 1 ? ' · 1-week streak' : '';

    const lastStr = last.length
      ? '<div style="margin-top:6px;font-size:11px;color:var(--muted)">Last session: '
          + last.slice(0, 4).join(', ')
          + (last.length > 4 ? ' +' + (last.length - 4) + ' more' : '')
          + ' — next session picks different exercises</div>'
      : '';

    return {
      style:  'rgba(167,139,250,0.08)',
      border: 'rgba(167,139,250,0.15)',
      color:  'var(--purple)',
      html:   'Full Body · Session ' + (sc + 1) + streakStr + lastStr
    };
  },

  // ─── Settings ─────────────────────────────────────────────────────────────
  renderSettings(state, container) {
    const sc     = state.sessionCount || 0;
    const streak = state.currentStreak || 0;
    const last   = state.lastExercisesUsed || [];
    const freq   = state.daysPerWeek || 3;

    const freqOpts = [2, 3].map(n =>
      `<option value="${n}"${n === freq ? ' selected' : ''}>${n}x per week</option>`
    ).join('');

    const lastStr = last.length
      ? last.map(ex => `<div style="font-size:12px;color:var(--text);padding:2px 0">• ${ex}</div>`).join('')
      : '<div style="font-size:12px;color:var(--muted)">No sessions logged yet</div>';

    const slotRows = SLOTS.map(slot =>
      `<div style="margin-bottom:8px">
         <div style="font-size:11px;color:var(--muted);margin-bottom:3px">${slot.name}</div>
         <div style="font-size:12px;color:var(--text);padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px">
           ${slot.pool.join(' &nbsp;·&nbsp; ')}
         </div>
       </div>`
    ).join('');

    container.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;background:rgba(167,139,250,0.08);padding:8px 12px;border-radius:8px">
        Slot-based variety · 3 sets × 8–12 reps · Exercises rotate each session automatically
      </div>

      <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--text)">${sc}</div>
          <div style="font-size:11px;color:var(--muted)">Total Sessions</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--text)">${streak > 0 ? streak : '—'}</div>
          <div style="font-size:11px;color:var(--muted)">Week Streak</div>
        </div>
      </div>

      <label>Target Frequency</label>
      <select id="cfb-freq">${freqOpts}</select>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;margin-bottom:14px">
        Reference only. This program does not auto-schedule sessions.
      </div>

      <div class="divider-label"><span>Movement Pattern Pools</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;margin-top:4px">
        Each session picks one exercise per slot and avoids last session choices.
      </div>
      ${slotRows}
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:3px">Slot 5 · Accessories (2 picked per session)</div>
        <div style="font-size:12px;color:var(--text);padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px">
          ${ACCESSORY_POOL.join(' &nbsp;·&nbsp; ')}
        </div>
      </div>

      <div class="divider-label"><span>Last Session</span></div>
      <div style="margin-top:8px;margin-bottom:14px">${lastStr}</div>

      <div style="font-size:11px;color:var(--muted);margin-bottom:14px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;line-height:1.5">
        No Training Max setup needed. Add weight when 12 reps feels easy.
      </div>

      <button class="btn btn-purple" onclick="saveProgramSetup()">Save Program Setup</button>
    `;
  },

  saveSettings(state) {
    const freq = parseInt(document.getElementById('cfb-freq')?.value) || 3;
    return { ...state, daysPerWeek: freq };
  }
};

registerProgram(CASUAL_FULL_BODY);
})();
