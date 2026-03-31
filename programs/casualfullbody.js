// ── CASUAL FULL BODY ──────────────────────────────────────────────────────────
// Slot-based variety engine: 2-3x/week, full body, approachable.
// Every session picks from equipment-restricted movement pattern pools,
// always rotating away from the last session's exercises.
// State tracks: session streak (weekly) + last exercises used (for variety).
(function () {
'use strict';

function trCFB(key,fallback,params){
  if(window.I18N)return I18N.t(key,params,fallback);
  return fallback;
}

function getCFBDaysPerWeek(){
  return typeof getProgramTrainingDaysPerWeek==='function'
    ? getProgramTrainingDaysPerWeek('casualfullbody')
    : 3;
}

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
    pool: ['Lat Pull-down', 'Dumbbell Rows', 'Machine Rows']
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

function getISOWeekStartDate(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const weekStart = new Date(week1Monday);
  weekStart.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart;
}

// Returns true if keyB is exactly one ISO week after keyA.
function isNextWeek(keyA, keyB) {
  const a = parseWeekKey(keyA);
  const b = parseWeekKey(keyB);
  if (!a || !b) return false;
  const diffMs = getISOWeekStartDate(b.year, b.week).getTime() - getISOWeekStartDate(a.year, a.week).getTime();
  return diffMs === 7 * 24 * 60 * 60 * 1000;
}

// ─── PROGRAM OBJECT ───────────────────────────────────────────────────────────
const CASUAL_FULL_BODY = {
  id:          'casualfullbody',
  name:        trCFB('program.cfb.name','Gym Basics'),
  description: trCFB('program.cfb.description','Easy gym program with rotating full-body sessions. No maxes or planning needed.'),
  icon:        '🎯',
  dashboardStatsLabel: trCFB('program.cfb.session_stats','Session Stats'),

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
    const streakBadge = streak > 1 ? ' · ' + trCFB('program.cfb.week_streak_short','{count}-wk streak',{count:streak}) : '';
    return [{
      value:         'fullbody',
      label:         trCFB('program.cfb.session_label','Gym Basics · Session {count}',{count:(sc+1)}) + streakBadge,
      isRecommended: true,
      done:          false
    }];
  },

  // ─── Build Session ────────────────────────────────────────────────────────
  buildSession(selectedOption, state, context) {
    const lastUsed  = state.lastExercisesUsed || [];
    const exercises = [];

    // Slots 1–4: one exercise each
    SLOTS.forEach((slot, idx) => {
      const name = pickOne(slot.pool, lastUsed);
      exercises.push({
        id:         Date.now() + Math.random(),
        name,
        note:       slot.name + ' · ' + trCFB('program.cfb.note_main','3 sets × 8-12 reps'),
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
        note:        trCFB('program.cfb.note_accessory','Accessory · 3 sets × 8-12 reps'),
        isAux:       true,
        isAccessory: true,
        tm:          0,
        auxSlotIdx:  4,
        slotId:      'accessory',
        sets:        Array.from({ length: 3 }, () => ({ weight: '', reps: 12, done: false, rpe: null }))
      });
    });
    if (context?.energyBoost) {
      const bonusName = pickOne(
        ACCESSORY_POOL.filter(name => !accessories.includes(name)),
        lastUsed
      );
      if (bonusName) {
        exercises.push({
          id:          Date.now() + Math.random(),
          name:        bonusName,
          note:        trCFB('program.cfb.note_accessory','Accessory · 3 sets × 8-12 reps'),
          isAux:       true,
          isAccessory: true,
          tm:          0,
          auxSlotIdx:  5,
          slotId:      'accessory',
          sets:        Array.from({ length: 3 }, () => ({ weight: '', reps: 12, done: false, rpe: null }))
        });
      }
    }

    return exercises;
  },

  // ─── Labels & Info ────────────────────────────────────────────────────────
  getSessionLabel(selectedOption, state, context) {
    const sc     = (state.sessionCount || 0) + 1;
    const streak = state.currentStreak || 0;
    const fireStr = streak > 1 ? ' · ' + trCFB('program.cfb.week_streak_short','{count}-wk streak',{count:streak}) : '';
    return trCFB('program.cfb.session_label','Gym Basics · Session {count}',{count:sc}) + fireStr;
  },

  getBlockInfo(state) {
    const sc     = state.sessionCount || 0;
    const streak = state.currentStreak || 0;
    const streakStr = streak > 0 ? ' · ' + trCFB('program.cfb.week_streak_long','{count}-week streak',{count:streak}) : '';
    return {
      name:       trCFB('program.cfb.block_name','Gym Basics'),
      weekLabel:  trCFB('program.cfb.block_label','Session {count}',{count:sc}) + streakStr,
      pct:        null,
      isDeload:   false,
      totalWeeks: null
    };
  },

  getSessionCharacter(selectedOption,state){
    return{tone:'normal',icon:'🏋️',labelKey:'program.cfb.character.normal',labelFallback:trCFB('program.cfb.character.normal','Full body — varied exercises'),labelParams:{}};
  },

  getPreSessionNote(selectedOption,state){
    const count=(state.sessionCount||0)+1;
    const streak=state.currentStreak||0;
    const streakNote=streak>=2?' · '+trCFB('program.cfb.week_streak_long','{count}-week streak',{count:streak}):'';
    return trCFB('program.cfb.note.default','Session {count}. Focus on effort and form.',{count})+streakNote;
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
      { name: trCFB('program.cfb.stats.sessions','Sessions'), value: String(sc) },
      { name: trCFB('program.cfb.stats.week_streak','Week Streak'),
        value: streak > 0
          ? trCFB(streak===1?'program.cfb.week_count_one':'program.cfb.week_count_many',streak===1?'{count} week':'{count} weeks',{count:streak})
          : trCFB('program.cfb.none','—') }
    ];
  },

  // ─── Dashboard Banner ─────────────────────────────────────────────────────
  getBannerHTML(options, state, schedule, workouts) {
    const sc     = state.sessionCount || 0;
    const streak = state.currentStreak || 0;
    const last   = state.lastExercisesUsed || [];

    const todayDow          = new Date().getDay();
    const sportDays         = schedule?.sportDays||[];
    const legsHeavy         = schedule?.sportLegsHeavy!==false;
    const recentHours       = {easy:18,moderate:24,hard:30}[schedule?.sportIntensity||'hard'];
    const sportName         = schedule?.sportName||trCFB('common.sport','Sport');
    const isSportDay        = sportDays.includes(todayDow);
    const hadSportRecently  = workouts?.some(w =>
      (w.type === 'sport' || w.type === 'hockey') && (Date.now() - new Date(w.date).getTime()) / 3600000 <= recentHours
    );

    if ((isSportDay || hadSportRecently) && legsHeavy) {
      const sportLabel = isSportDay
        ? trCFB('dashboard.status.sport_day','{sport} day',{sport:sportName})
        : trCFB('dashboard.post_sport','Post-{sport}',{sport:sportName.toLowerCase()});
      return {
        style:  'rgba(59,130,246,0.1)',
        border: 'rgba(59,130,246,0.25)',
        color:  'var(--blue)',
        html:   '🏃 '+sportLabel+' — '+trCFB('program.cfb.banner_sport_warning','Session includes squats and hinges. Consider going lighter or resting today.')
      };
    }

    const streakStr = streak > 1
      ? ' · <strong>' + trCFB('program.cfb.week_streak_exclaim','{count}-week streak!',{count:streak}) + '</strong>'
      : streak === 1 ? ' · ' + trCFB('program.cfb.week_count_one','{count} week',{count:1}) : '';

    const lastStr = last.length
      ? '<div style="margin-top:6px;font-size:11px;color:var(--muted)">'+trCFB('program.cfb.last_session','Last session')+': '
          + last.slice(0, 4).join(', ')
          + (last.length > 4 ? ' +' + (last.length - 4) + ' ' + trCFB('program.cfb.more','more') : '')
          + ' — ' + trCFB('program.cfb.next_rotates','next session picks different exercises') + '</div>'
      : '';

    return {
      style:  'rgba(167,139,250,0.08)',
      border: 'rgba(167,139,250,0.15)',
      color:  'var(--purple)',
      html:   trCFB('program.cfb.session_label','Gym Basics · Session {count}',{count:(sc+1)}) + streakStr + lastStr
    };
  },

  // ─── Settings ─────────────────────────────────────────────────────────────
  renderSimpleSettings(state, container) {
    const sc   = state.sessionCount || 0;
    const freq = getCFBDaysPerWeek();

    container.innerHTML = `
      <div class="program-settings-grid">
        <div class="settings-section-card">
          <div class="settings-section-title">${trCFB('program.cfb.simple.overview_title','Weekly rhythm')}</div>
          <div class="settings-section-sub">${trCFB('program.cfb.simple.overview','Gym Basics is the easy default: show up, train a balanced full-body session, and let the exercise rotation handle the planning. Weekly frequency now comes from Training Preferences.')}</div>
          <div class="settings-row-note">${trCFB('program.global_frequency_hint','Uses your Training preference: {value}.',{value:(typeof getTrainingDaysPerWeekLabel==='function'?getTrainingDaysPerWeekLabel(freq):freq+' sessions / week')})}</div>
          <div class="settings-row-note">${trCFB('program.cfb.no_tm_needed','No Training Max setup needed. Add weight when 12 reps feels easy.')}</div>
        </div>
        <div class="settings-section-card">
          <div class="settings-section-title">${trCFB('program.cfb.session_stats','Session Stats')}</div>
          <div class="settings-section-sub">${trCFB('program.cfb.simple.stats_help','Exercise choices rotate automatically, so the main setup decision is simply how often you want to train.')}</div>
          <div class="settings-picker-stack">
            <div class="settings-picker-row">
              <div class="settings-picker-main">
                <div class="settings-picker-label">${trCFB('program.cfb.stats.sessions','Sessions')}</div>
                <div class="settings-picker-value">${escapeHtml(String(sc))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    `;
  },

  getSimpleSettingsSummary(state) {
    const freq = getCFBDaysPerWeek();
    return trCFB('program.cfb.simple.summary','{count} sessions/week · balanced full-body training',{count:freq});
  },

  renderSettings(state, container) {
    const sc     = state.sessionCount || 0;
    const streak = state.currentStreak || 0;
    const last   = state.lastExercisesUsed || [];
    const freq   = getCFBDaysPerWeek();

    const lastStr = last.length
      ? last.map(ex => `<div style="font-size:12px;color:var(--text);padding:2px 0">• ${ex}</div>`).join('')
      : '<div style="font-size:12px;color:var(--muted)">'+trCFB('program.cfb.no_sessions_yet','No sessions logged yet')+'</div>';

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
        ${trCFB('program.cfb.setup_summary','Low-planning full-body training · 3 sets × 8-12 reps · Exercises rotate automatically')}
      </div>

      <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--text)">${sc}</div>
          <div style="font-size:11px;color:var(--muted)">${trCFB('history.total_sessions','Total Sessions')}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:var(--text)">${streak > 0 ? streak : trCFB('program.cfb.none','—')}</div>
          <div style="font-size:11px;color:var(--muted)">${trCFB('program.cfb.stats.week_streak','Week Streak')}</div>
        </div>
      </div>

      <div style="font-size:11px;color:var(--muted);margin-bottom:14px">
        ${trCFB('program.global_frequency_hint','Uses your Training preference: {value}.',{value:(typeof getTrainingDaysPerWeekLabel==='function'?getTrainingDaysPerWeekLabel(freq):freq+' sessions / week')})}
      </div>

      <div class="divider-label"><span>${trCFB('program.cfb.movement_pools','Movement Pattern Pools')}</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;margin-top:4px">
        ${trCFB('program.cfb.pool_help','Each session picks one exercise per slot and avoids last session choices.')}
      </div>
      ${slotRows}
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:3px">${trCFB('program.cfb.slot5_accessories','Slot 5 · Accessories (2 picked per session)')}</div>
        <div style="font-size:12px;color:var(--text);padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px">
          ${ACCESSORY_POOL.join(' &nbsp;·&nbsp; ')}
        </div>
      </div>

      <div class="divider-label"><span>${trCFB('program.cfb.last_session','Last session')}</span></div>
      <div style="margin-top:8px;margin-bottom:14px">${lastStr}</div>

      <div style="font-size:11px;color:var(--muted);margin-bottom:14px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:6px;line-height:1.5">
        ${trCFB('program.cfb.no_tm_needed','No Training Max setup needed. Add weight when 12 reps feels easy.')}
      </div>

      <button class="btn btn-purple" onclick="saveProgramSetup()">${trCFB('program.cfb.save_setup','Save Program Setup')}</button>
    `;
  },

  saveSettings(state) {
    return { ...state };
  },

  saveSimpleSettings(state) {
    return { ...state };
  }
};

registerProgram(CASUAL_FULL_BODY);
})();
