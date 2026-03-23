const HISTORY_ISLAND_EVENT = 'ironforge:history-updated';
let historyTabState = 'log';
let historyHeatmapOpen = false;
let historyStatsRangeState = '16w';
const HISTORY_STATS_RANGES = {
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
];
const HISTORY_EXACT_LIFT_NAME_MAP = {
  squat: new Set(['squat', 'back squat', 'barbell back squat']),
  bench: new Set(['bench press', 'bench']),
  deadlift: new Set(['deadlift']),
  ohp: new Set(['ohp', 'overhead press', 'overhead press (ohp)']),
};

function hasHistoryIslandMount() {
  return !!document.getElementById('history-react-root');
}

function isHistoryIslandActive() {
  return window.__IRONFORGE_HISTORY_ISLAND_MOUNTED__ === true;
}

function notifyHistoryIsland() {
  if (!hasHistoryIslandMount()) return;
  window.dispatchEvent(new CustomEvent(HISTORY_ISLAND_EVENT));
}

function switchHistoryTab(tab) {
  historyTabState = tab === 'stats' ? 'stats' : 'log';
  if (isHistoryIslandActive()) {
    notifyHistoryIsland();
    return;
  }
  document.querySelectorAll('#page-history .tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.historyTab === historyTabState);
    t.setAttribute(
      'aria-selected',
      t.dataset.historyTab === historyTabState ? 'true' : 'false'
    );
  });
  document.getElementById('history-log').style.display =
    historyTabState === 'log' ? 'block' : 'none';
  document.getElementById('history-stats').style.display =
    historyTabState === 'stats' ? 'block' : 'none';
  if (historyTabState === 'stats') updateStats();
}

function switchHistoryStatsRange(range) {
  historyStatsRangeState =
    HISTORY_STATS_RANGES[range] !== undefined ? range : '16w';
  if (isHistoryIslandActive()) {
    notifyHistoryIsland();
    return;
  }
  document
    .querySelectorAll('#history-stats .stats-range-btn')
    .forEach((btn) => {
      const active = btn.dataset.range === historyStatsRangeState;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  updateStats();
}

function trHist(key, fallback, params) {
  if (window.I18N) return I18N.t(key, params, fallback);
  return fallback;
}

function histLocale() {
  return window.I18N && I18N.getLanguage() === 'fi' ? 'fi-FI' : 'en-GB';
}

function histDisplayName(input) {
  if (window.EXERCISE_LIBRARY && EXERCISE_LIBRARY.getDisplayName)
    return EXERCISE_LIBRARY.getDisplayName(input);
  return String(input || '');
}

function histCanonicalExerciseName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  if (typeof window.resolveExerciseSelection === 'function') {
    const resolved = window.resolveExerciseSelection(raw);
    return String(resolved?.name || raw)
      .trim()
      .toLowerCase();
  }
  return raw.toLowerCase();
}

function histNormalizeLiftKey(name) {
  const value = histCanonicalExerciseName(name);
  if (!value) return '';
  if (HISTORY_EXACT_LIFT_NAME_MAP.bench.has(value)) return 'bench';
  if (HISTORY_EXACT_LIFT_NAME_MAP.deadlift.has(value)) return 'deadlift';
  if (HISTORY_EXACT_LIFT_NAME_MAP.ohp.has(value)) return 'ohp';
  if (HISTORY_EXACT_LIFT_NAME_MAP.squat.has(value)) return 'squat';
  return '';
}

function histGetStatsRangeWeeks() {
  return HISTORY_STATS_RANGES[historyStatsRangeState] !== undefined
    ? HISTORY_STATS_RANGES[historyStatsRangeState]
    : HISTORY_STATS_RANGES['16w'];
}

function histGetStatsCutoff(nWeeks) {
  if (nWeeks == null) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - nWeeks * 7);
  return cutoff;
}

function histFilterStatsWorkoutDate(dateLike, cutoff) {
  const value = new Date(dateLike);
  value.setHours(0, 0, 0, 0);
  if (!Number.isFinite(value.getTime())) return null;
  if (cutoff && value < cutoff) return null;
  return value;
}

function histFormatStatsDate(dateLike) {
  const value = new Date(dateLike);
  if (!Number.isFinite(value.getTime())) return '';
  return value.toLocaleDateString(histLocale(), {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

// History helpers

function histLiftIcon(name) {
  if (!name) return trHist('history.legend.lift', 'Lift');
  if (name.includes('Squat')) return 'SQ';
  if (name.includes('Bench')) return 'BP';
  if (name.includes('Deadlift')) return 'DL';
  if (name.includes('Press') || name.includes('OHP')) return 'PR';
  if (name.includes('Row')) return 'RW';
  return trHist('history.legend.lift', 'Lift');
}

function histNormalizeSessionNotes(value) {
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

function histBuildExerciseSummary(exercise) {
  const workSets = (exercise.sets || []).filter((set) => set.done && !set.isWarmup);
  const allDoneSets = (exercise.sets || []).filter((set) => set.done);
  const doneSets = workSets.length > 0 ? workSets : allDoneSets;
  if (!doneSets.length) return null;

  const maxKg = Math.max(...doneSets.map((set) => parseFloat(set.weight) || 0));
  const heaviestSets = doneSets.filter(
    (set) => (parseFloat(set.weight) || 0) === maxKg
  );
  const repCounts = new Map();

  heaviestSets.forEach((set) => {
    const reps =
      typeof parseLoggedRepCount === 'function'
        ? parseLoggedRepCount(set.reps)
        : parseInt(set.reps, 10);
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
    (set) => set.isLastHeavySet && set.done
  );
  const lastHeavyReps =
    typeof parseLoggedRepCount === 'function'
      ? parseLoggedRepCount(lastHeavy?.reps)
      : parseInt(lastHeavy?.reps, 10);

  return {
    name: histDisplayName(exercise.name),
    maxKg,
    setCount,
    topReps,
    amrapReps: Number.isFinite(lastHeavyReps) && lastHeavyReps > 0 ? lastHeavyReps : null,
  };
}

// Build a Set of workout IDs that contain a rep PR on an AMRAP/last-heavy set
function histComputePRs() {
  const sorted = workouts
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const best = {}; // "ExerciseName_weight" -> maxReps seen so far
  const prs = new Set();
  for (const w of sorted) {
    let hasPR =
      (parseInt(w?.prCount, 10) || 0) > 0 ||
      (w.exercises || []).some((ex) =>
        (ex.sets || []).some((s) => s?.isPr === true)
      );
    (w.exercises || []).forEach((ex) => {
      ex.sets.forEach((s) => {
        if (!s.isLastHeavySet && !s.isAmrap) return;
        if (!s.done) return;
        const reps = parseInt(s.reps);
        if (isNaN(reps) || reps <= 0) return;
        const key = ex.name + '_' + (parseFloat(s.weight) || 0);
        if (key in best && reps > best[key]) hasPR = true;
      });
    });
    if (hasPR) prs.add(w.id);
    // Update best AFTER checking so first occurrence never auto-qualifies
    (w.exercises || []).forEach((ex) => {
      ex.sets.forEach((s) => {
        if (!s.isLastHeavySet && !s.isAmrap) return;
        if (!s.done) return;
        const reps = parseInt(s.reps);
        if (isNaN(reps) || reps <= 0) return;
        const key = ex.name + '_' + (parseFloat(s.weight) || 0);
        if (!(key in best) || reps > best[key]) best[key] = reps;
      });
    });
  }
  return prs;
}

// Estimate recovery (0-100) at time of each workout based on gap + prior RPE
function histComputeRecovery() {
  const sorted = workouts
    .filter((w) => w.type !== 'hockey')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const map = {};
  let prev = null;
  for (const w of sorted) {
    if (!prev) {
      map[w.id] = 85; // first session - assume well-rested
    } else {
      const gapDays = (new Date(w.date) - new Date(prev.date)) / MS_PER_DAY;
      const prevRPE = prev.rpe || 7;
      // Base: gap adds recovery, high-RPE sessions reduce it
      const raw = Math.round(40 + (gapDays - 1) * 25 - (prevRPE - 7) * 4);
      map[w.id] = Math.max(20, Math.min(95, raw));
    }
    prev = w;
  }
  return map;
}

// Group workouts into [{groupLabel, groupIcon, programId, weeks:[{weekLabel, workouts:[]}]}]
// Newest-first within each group and week
function histGroupWorkouts() {
  const groups = new Map();
  const sorted = workouts
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const locale = histLocale();

  for (const w of sorted) {
    const d = new Date(w.date);
    const ws = getWeekStart(d);
    const key = ws.toISOString().slice(0, 10);

    if (!groups.has(key)) {
      const wEnd = new Date(ws);
      wEnd.setDate(wEnd.getDate() + 6);
      const startStr = ws.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      const endStr = wEnd.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      groups.set(key, {
        key,
        groupLabel: startStr + ' – ' + endStr,
        workouts: [],
      });
    }
    groups.get(key).workouts.push(w);
  }

  return [...groups.values()];
}

function histRecoveryStyle(pct) {
  if (pct === null || pct === undefined) return null;
  if (pct >= 70)
    return {
      color: 'var(--green)',
      bg: 'rgba(52,211,153,0.12)',
      border: 'rgba(52,211,153,0.3)',
    };
  if (pct >= 45)
    return {
      color: 'var(--orange)',
      bg: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.3)',
    };
  return {
    color: 'var(--accent)',
    bg: 'rgba(230,57,70,0.12)',
    border: 'rgba(230,57,70,0.3)',
  };
}

function histDeleteAction(w, options) {
  if (options?.interactive === false) return '';
  const actionLabel = trHist('common.delete', 'Delete');
  const titleLabel = escapeHtml(histDeleteTitle(w));
  return `<button class="hist-delete-btn" type="button" data-workout-id="${escapeHtml(String(w.id ?? ''))}" onclick="deleteWorkout(this.dataset.workoutId || '')" title="${titleLabel}" aria-label="${titleLabel}">${escapeHtml(actionLabel)}</button>`;
}

function histDeleteTitle(w) {
  if (!isSportWorkout(w))
    return trHist('history.delete_workout', 'Delete Workout');
  const sportLabel =
    w.type === 'hockey'
      ? 'Hockey'
      : schedule.sportName || trHist('common.sport', 'Sport');
  return trHist('history.delete_sport', 'Delete {sport} Session', {
    sport: sportLabel,
  });
}

function histDeleteMessage(w, dateStr) {
  if (!isSportWorkout(w))
    return trHist(
      'history.remove_workout_from',
      'Remove workout from {date}?',
      { date: dateStr }
    );
  const sportLabel =
    w.type === 'hockey'
      ? 'Hockey'
      : schedule.sportName || trHist('common.sport', 'Sport');
  return trHist(
    'history.remove_sport_from',
    'Remove {sport} session from {date}?',
    { sport: sportLabel, date: dateStr }
  );
}

function histRenderCard(w, isPR, recovery, options) {
  const d = new Date(w.date);
  const dateStr = d.toLocaleDateString(histLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const mins = Math.floor((w.duration || 0) / 60);
  const isExtra = w.subtype === 'extra';

  if (isSportWorkout(w)) {
    const sportLabel =
      w.type === 'hockey'
        ? 'Hockey'
        : schedule.sportName || trHist('common.sport', 'Sport');
    const sLabel = isExtra
      ? trHist('history.extra_sport_session', 'Extra {sport} Session', {
          sport: sportLabel,
        })
      : trHist('history.sport_session', '{sport} Session', {
          sport: sportLabel,
        });
    return `<div class="hist-card hist-sport-card" data-wid="${w.id}">
      <div class="hist-card-header">
        <div class="hist-card-left">
          <span class="hist-lift-icon hist-icon-sport">${trHist('history.sport', 'Sport')}</span>
          <div>
            <div class="hist-card-title">${escapeHtml(sLabel)}</div>
            <div class="hist-card-date">${dateStr}</div>
            ${mins > 0 ? `<div class="hist-sport-duration">${mins} min</div>` : ''}
          </div>
        </div>
        ${histDeleteAction(w, options)}
      </div>
    </div>`;
  }

  // Primary lift: first main-lift exercise
  const MAIN = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'OHP'];
  const mainEx = (w.exercises || []).find((e) =>
    MAIN.some((l) => e.name.includes(l))
  );
  const liftIcon = histLiftIcon(
    mainEx?.name || (w.exercises || [])[0]?.name || ''
  );

  // Build card title from programMeta
  const meta = w.programMeta || {};
  let cardTitle;
  if (w.program === 'forge' && meta.week) {
    const weekDay = trHist('history.card.week_day', 'Week {week} · Day {day}', {
      week: meta.week,
      day: w.programDayNum || 1,
    });
    cardTitle = weekDay;
  } else {
    // Fallback: strip emoji from programLabel
    const rawLabel = w.programLabel || '';
    cardTitle =
      rawLabel.replace(/^[\u{1F300}-\u{1FFFF}\u2600-\u27FF]\s*/u, '').trim() ||
      d.toLocaleDateString(histLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });
  }

  // Subtitle: date + session description
  const cardSub = dateStr;

  // Tonnage
  let tonnage = 0;
  (w.exercises || []).forEach((ex) => {
    ex.sets
      .filter((s) => s.done)
      .forEach((s) => {
        tonnage += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
      });
  });

  // Badges — recovery + duration inline
  const rs = histRecoveryStyle(recovery);
  const recovBadge = rs
    ? ` <span class="hist-recovery-tag" style="background:${rs.bg};color:${rs.color};border-color:${rs.border}">${recovery}%</span>`
    : '';
  const durationBadge =
    mins > 0 ? ` <span class="hist-meta-tag">${mins}min</span>` : '';
  const prBadge = isPR
    ? ` <span class="hist-pr-badge">${escapeHtml(trHist('history.pr_badge', 'NEW PR'))}</span>`
    : '';
  const bonusBadge = w.isBonus
    ? ` <span class="hist-bonus-badge">${escapeHtml(trHist('history.bonus_badge', 'Bonus'))}</span>`
    : '';
  const programBadge = _programBadge(w);
  const programBadgeHtml = programBadge
    ? `<span class="hist-program-badge">${escapeHtml(programBadge)}</span>`
    : '';

  // Exercise rows
  const completedExercises = (w.exercises || []).filter((ex) =>
    ex.sets.some((s) => s.done)
  );
  const exRows = completedExercises
    .map((ex) => {
      const summary = histBuildExerciseSummary(ex);
      if (!summary) return '';
      const schemeHtml =
        summary.topReps > 0
          ? `<span class="hist-exercise-scheme"> · ${summary.setCount}\u00d7${summary.topReps}</span>`
          : '';
      const amrapStr = summary.amrapReps
        ? ` <span class="hist-amrap-reps">${summary.amrapReps}+</span>`
        : '';
      return `<div class="hist-exercise-row">
      <span>${escapeHtml(summary.name)}</span>
      <span class="hist-exercise-vol">${summary.maxKg > 0 ? summary.maxKg + 'kg' : 'bw'}${schemeHtml}${amrapStr}</span>
    </div>`;
    })
    .filter(Boolean)
    .join('');

  // Footer: volume, exercises, RPE
  const exCount = completedExercises.length;
  const volStr = tonnage > 0 ? (tonnage / 1000).toFixed(1) + 't' : '0t';
  const footerHtml = `<div class="hist-card-footer">
    <span class="hist-footer-stat">${trHist('history.card.volume', 'Volume')} <span class="hist-footer-val">${volStr}</span></span>
    <span class="hist-footer-stat">${trHist('history.card.exercises', 'Exercises')} <span class="hist-footer-val">${exCount}</span></span>
    <span class="hist-footer-stat">RPE <span class="hist-footer-val">${w.rpe || '\u2014'}</span></span>
  </div>`;

  return `<div class="hist-card" data-wid="${w.id}">
    <div class="hist-card-header">
      <div class="hist-card-left">
        <span class="hist-lift-icon">${liftIcon}</span>
        <div class="hist-card-copy">
          <div class="hist-card-title">${escapeHtml(cardTitle)}${bonusBadge}${prBadge}${recovBadge}${durationBadge}</div>
          <div class="hist-card-date">${escapeHtml(cardSub)}${programBadgeHtml}</div>
        </div>
      </div>
      ${histDeleteAction(w, options)}
    </div>
    ${exRows ? `<div class="hist-exercises">${exRows}</div>` : ''}
    ${footerHtml}
  </div>`;
}

function histRenderGroup(g, isFirst, prSet, recovMap, options) {
  const count = g.workouts.length;
  const cards = g.workouts
    .map((w) =>
      histRenderCard(w, prSet.has(w.id), recovMap[w.id] ?? null, options)
    )
    .join('');
  return `<details class="hist-week-details"${isFirst ? ' open' : ''}>
    <summary class="hist-week-toggle">
      <div class="hist-week-toggle-left">
        <span class="hist-week-chevron" aria-hidden="true">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="hist-week-label">${escapeHtml(g.groupLabel)}</span>
      </div>
      <span class="hist-week-count">${count} ${count !== 1 ? trHist('dashboard.sessions_left', 'sessions') : trHist('dashboard.session_left', 'session', { count: 1 })}</span>
    </summary>
    <div class="hist-week-body">${cards}</div>
  </details>`;
}

function histEmptyState() {
  const prog = getActiveProgram();
  const state = getActiveProgramState();
  const bi = prog.getBlockInfo ? prog.getBlockInfo(state) : null;
  const phaseCard =
    bi && (bi.name || bi.modeDesc || bi.weekLabel)
      ? `
    <div class="hist-phase-card">
      <div class="hist-phase-card-label">${trHist('history.current_phase', 'Current Phase')}</div>
      <div class="hist-phase-card-name">${bi.name || bi.weekLabel || 'Week ' + state.week}</div>
      ${bi.modeDesc ? `<div class="hist-phase-card-desc">${bi.modeDesc}</div>` : ''}
    </div>`
      : '';
  return `<div class="hist-empty">
    <div class="hist-empty-kicker">${trHist('history.activity_title', 'Activity')}</div>
    <div class="hist-empty-orb"><div class="hist-empty-icon">LOG</div></div>
    <div class="hist-empty-title">${trHist('history.empty_title', 'No sessions yet')}</div>
    <div class="hist-empty-sub">${trHist('history.empty_sub', 'Complete your first workout to start building your training history.')}</div>
    <button class="btn btn-primary hist-empty-cta" type="button" onclick="showPage('log',document.querySelectorAll('.nav-btn')[1])">${trHist('history.start_today', "Start Today's Workout")}</button>
    ${phaseCard}
  </div>`;
}

function buildHeatmapMarkup(isOpen) {
  const WEEKS = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Monday of the current week
  const weekStart = getWeekStart(today);

  // Grid starts WEEKS weeks back (Monday)
  const gridStart = new Date(weekStart);
  gridStart.setDate(weekStart.getDate() - (WEEKS - 1) * 7);

  // Map each calendar date to what was trained
  const dayMap = {};
  workouts.forEach((w) => {
    const d = new Date(w.date);
    d.setHours(0, 0, 0, 0);
    const k = d.toISOString().slice(0, 10);
    if (!dayMap[k]) dayMap[k] = { lift: false, sport: false };
    if (isSportWorkout(w)) dayMap[k].sport = true;
    else dayMap[k].lift = true;
  });

  // Build cells (WEEKS x 7 days)
  const cells = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const k = d.toISOString().slice(0, 10);
    cells.push({
      k,
      isToday: d.getTime() === today.getTime(),
      isFuture: d > today,
      ...(dayMap[k] || {}),
    });
  }

  // Week streak: consecutive weeks (newest first) with >=1 lift
  let weekStreak = 0;
  for (let i = 0; i < WEEKS; i++) {
    const ws = new Date(weekStart);
    ws.setDate(weekStart.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    const hasLift = workouts.some((w) => {
      if (isSportWorkout(w)) return false;
      const wd = new Date(w.date);
      wd.setHours(0, 0, 0, 0);
      return wd >= ws && wd <= we;
    });
    if (hasLift) {
      weekStreak++;
    } else if (i === 0) {
      /* current week not started yet - don't break streak */
    } else {
      break;
    }
  }

  // Sessions per week over last 28 days
  const cut28 = new Date(today);
  cut28.setDate(today.getDate() - 27);
  const last28 = workouts.filter(
    (w) => !isSportWorkout(w) && new Date(w.date) >= cut28
  ).length;
  const perWeek = (last28 / 4).toFixed(1);

  // Total volume in heatmap period
  let totalVol = 0;
  workouts.forEach((w) => {
    if (isSportWorkout(w)) return;
    const wd = new Date(w.date);
    wd.setHours(0, 0, 0, 0);
    if (wd >= gridStart && wd <= today) {
      (w.exercises || []).forEach((ex) => {
        ex.sets
          .filter((s) => s.done)
          .forEach((s) => {
            totalVol += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
          });
      });
    }
  });
  const volStr = (totalVol / 1000).toFixed(1);

  // Week number labels (ISO week)
  const weekNums = [];
  for (let i = 0; i < WEEKS; i++) {
    const mon = new Date(gridStart);
    mon.setDate(gridStart.getDate() + i * 7);
    const tmp = new Date(mon.getTime());
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const w1 = new Date(tmp.getFullYear(), 0, 4);
    const wn =
      1 +
      Math.round(
        ((tmp.getTime() - w1.getTime()) / 86400000 -
          3 +
          ((w1.getDay() + 6) % 7)) /
          7
      );
    weekNums.push(wn);
  }
  const weekNumCells = weekNums
    .map((n) => `<div class="heatmap-week-label">${n}</div>`)
    .join('');

  const DAY_LABELS =
    histLocale() === 'fi-FI'
      ? ['M', 'T', 'K', 'T', 'P', 'L', 'S']
      : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const labelCells = DAY_LABELS.map(
    (l) => `<div class="heatmap-day-label">${l}</div>`
  ).join('');
  const gridCells = cells
    .map((c) => {
      let cls = 'heatmap-cell';
      if (c.isFuture) cls += ' future';
      else if (c.lift && c.sport) cls += ' both';
      else if (c.lift) cls += ' lift';
      else if (c.sport) cls += ' sport';
      if (c.isToday) cls += ' today';
      return `<div class="${cls}"></div>`;
    })
    .join('');

  // Stats
  const streakHtml =
    weekStreak > 0
      ? `<span class="heatmap-stat"><span class="heatmap-stat-val">${weekStreak}${trHist('history.streak_unit', 'wk')}</span> ${trHist('history.streak_label', 'streak')}</span>`
      : `<span class="heatmap-stat heatmap-stat-muted">${trHist('history.no_streak', 'No streak yet')}</span>`;
  const rateHtml = `<span class="heatmap-stat"><span class="heatmap-stat-val">${perWeek}</span> ${trHist('history.lifts_per_week', 'lifts/wk')}</span>`;
  const volHtml = `<span class="heatmap-stat"><span class="heatmap-stat-val">${volStr}t</span> ${trHist('history.total_volume_label', 'total volume')}</span>`;

  // Legend (moved to title row)
  const legendHtml = `<div class="heatmap-legend">
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot heatmap-legend-dot-lift"></div>${trHist('history.legend.lift', 'Lift')}</div>
    <div class="heatmap-legend-item"><div class="heatmap-legend-dot heatmap-legend-dot-sport"></div>${escapeHtml(schedule.sportName || trHist('common.sport', 'Sport'))}</div>
  </div>`;

  const inlineStatsHtml = `<div class="heatmap-inline-stats">${streakHtml}${rateHtml}${volHtml}</div>`;
  const openCls = isOpen ? ' open' : '';

  const titleHtml = `<div class="heatmap-title-row" onclick="toggleHeatmap()">
    <span class="heatmap-title">${trHist('history.activity_title', 'ACTIVITY \u00B7 {weeks} WK', { weeks: WEEKS })} <span class="heatmap-toggle-chevron">▼</span></span>
    ${inlineStatsHtml}
    ${legendHtml}
  </div>`;

  return `<div class="heatmap-wrap${openCls}">
    ${titleHtml}
    <div class="heatmap-collapsible"><div class="heatmap-collapsible-inner">
      <div class="heatmap-board">
        <div></div>
        <div class="heatmap-week-labels">${weekNumCells}</div>
        <div class="heatmap-day-labels">${labelCells}</div>
        <div class="heatmap-grid heatmap-grid-cells">${gridCells}</div>
      </div>
      <div class="heatmap-foot">
        <div class="heatmap-stats">${streakHtml}${rateHtml}${volHtml}</div>
      </div>
    </div></div>
  </div>`;
}

function renderHeatmap() {
  const el = document.getElementById('history-heatmap');
  if (!el) return;
  el.innerHTML = buildHeatmapMarkup(historyHeatmapOpen);
}

function toggleHeatmap() {
  historyHeatmapOpen = !historyHeatmapOpen;
  if (isHistoryIslandActive()) {
    notifyHistoryIsland();
    return;
  }
  renderHeatmap();
}

function buildHistoryLogMarkup(options) {
  if (!workouts.length) return histEmptyState();
  const prSet = histComputePRs();
  const recovMap = histComputeRecovery();
  const groups = histGroupWorkouts();
  return groups
    .map((g, i) => histRenderGroup(g, i === 0, prSet, recovMap, options))
    .join('');
}

function renderHistory() {
  if (isHistoryIslandActive()) {
    notifyHistoryIsland();
    return;
  }
  renderHeatmap();
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = buildHistoryLogMarkup();
  list
    .querySelectorAll('.hist-card')
    .forEach((el, i) => el.style.setProperty('--i', Math.min(i, 10)));
}

function deleteWorkout(id) {
  const w = workouts.find((w) => w.id === id);
  if (!w) return;
  const d = new Date(w.date);
  const dateStr = d.toLocaleDateString(histLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  showConfirm(histDeleteTitle(w), histDeleteMessage(w, dateStr), async () => {
    const programsBackup = JSON.parse(JSON.stringify(profile.programs || {}));
    const backup = workouts.find((x) => x.id === id);
    const affectedProgramId = getWorkoutProgramId(backup);
    workouts = workouts.filter((x) => x.id !== id);
    buildExerciseIndex();
    if (affectedProgramId) recomputeProgramStateFromWorkouts(affectedProgramId);
    await softDeleteWorkoutRecord(id);
    await saveWorkouts();
    if (affectedProgramId)
      await saveProfileData({ programIds: [affectedProgramId] });
    renderHistory();
    updateStats();
    updateDashboard();
    updateProgramDisplay();
    showToast(
      trHist('history.session_deleted', 'Session deleted'),
      'var(--muted)',
      async () => {
        workouts.push(backup);
        workouts.sort((a, b) => new Date(a.date) - new Date(b.date));
        profile.programs = programsBackup;
        buildExerciseIndex();
        await upsertWorkoutRecord(backup);
        await saveWorkouts();
        if (affectedProgramId)
          await saveProfileData({ programIds: [affectedProgramId] });
        renderHistory();
        updateStats();
        updateDashboard();
        updateProgramDisplay();
        showToast(
          trHist('history.session_restored', 'Session restored!'),
          'var(--green)'
        );
      }
    );
  });
}

// ── Stats chart helpers ───────────────────────────────────────────────

function _statsWeeklyVolume(n) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ws0 = getWeekStart(today);
  return Array.from({ length: n }, (_, i) => {
    const ws = new Date(ws0);
    ws.setDate(ws0.getDate() - (n - 1 - i) * 7);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    let vol = 0;
    workouts.forEach((w) => {
      if (isSportWorkout(w)) return;
      const wd = new Date(w.date);
      wd.setHours(0, 0, 0, 0);
      if (wd >= ws && wd <= we)
        (w.exercises || []).forEach((ex) =>
          ex.sets
            .filter((s) => s.done)
            .forEach((s) => {
              vol += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
            })
        );
    });
    const tmp = new Date(ws.getTime());
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const y1 = new Date(tmp.getFullYear(), 0, 4);
    const wn =
      1 + Math.round(((tmp - y1) / 86400000 - 3 + ((y1.getDay() + 6) % 7)) / 7);
    const wp = trHist('history.stats.week_prefix', 'W');
    return { vol, label: wp + wn, isCurrent: i === n - 1 };
  });
}

function _statsLiftProgress(matcher, nWeeks) {
  const cutoff = histGetStatsCutoff(nWeeks);
  const pts = [];
  workouts
    .filter((w) => !isSportWorkout(w))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((w) => {
      const wd = histFilterStatsWorkoutDate(w.date, cutoff);
      if (!wd) return;
      const ex = (w.exercises || []).find((e) => matcher(e.name));
      if (!ex) return;
      const wts = ex.sets
        .filter((s) => s.done)
        .map((s) => parseFloat(s.weight) || 0)
        .filter((x) => x > 0);
      if (wts.length)
        pts.push({
          date: wd,
          weight: Math.max(...wts),
          label: histFormatStatsDate(wd),
        });
    });
  return pts;
}

function _statsLiftE1rm(liftKey, nWeeks) {
  const cutoff = histGetStatsCutoff(nWeeks);
  const pts = [];
  workouts
    .filter((w) => !isSportWorkout(w))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((w) => {
      const wd = histFilterStatsWorkoutDate(w.date, cutoff);
      if (!wd) return;
      const matches = (w.exercises || []).filter(
        (ex) => histNormalizeLiftKey(ex.name) === liftKey
      );
      if (!matches.length) return;
      let best = 0;
      matches.forEach((ex) => {
        (ex.sets || [])
          .filter((s) => s.done)
          .forEach((set) => {
            const weight = parseFloat(set.weight) || 0;
            const reps = parseInt(set.reps, 10) || 0;
            if (weight <= 0 || reps <= 0) return;
            const e1rm = weight * (1 + reps / 30);
            if (e1rm > best) best = e1rm;
          });
      });
      if (best > 0) {
        pts.push({
          date: wd,
          weight: Math.round(best * 10) / 10,
          label: histFormatStatsDate(wd),
        });
      }
    });
  return pts;
}

function _statsTrainingMaxHistory(nWeeks) {
  const cutoff = histGetStatsCutoff(nWeeks);
  const historyMap = { squat: [], bench: [], deadlift: [], ohp: [] };
  workouts
    .filter((w) => !isSportWorkout(w))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((w) => {
      const wd = histFilterStatsWorkoutDate(w.date, cutoff);
      if (!wd) return;
      const mainLifts = w?.programStateBefore?.lifts?.main;
      if (!Array.isArray(mainLifts)) return;
      mainLifts.forEach((lift) => {
        const liftKey = histNormalizeLiftKey(lift?.name);
        const tm = parseFloat(lift?.tm) || 0;
        if (!liftKey || tm <= 0 || !historyMap[liftKey]) return;
        historyMap[liftKey].push({
          date: wd,
          weight: Math.round(tm * 10) / 10,
          label: histFormatStatsDate(wd),
        });
      });
    });
  return historyMap;
}

function _statsMilestones() {
  const bodyWeight = parseFloat(profile?.bodyMetrics?.weight) || 0;
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
  const milestones = [];
  thresholds.forEach((item) => {
    const target = bodyWeight * item.ratio;
    const pts = _statsLiftE1rm(item.liftKey, null);
    const hit = pts.find((point) => point.weight >= target);
    if (!hit) return;
    milestones.push({
      liftKey: item.liftKey,
      milestone: trHist(item.labelKey, item.fallback),
      date: hit.label || histFormatStatsDate(hit.date),
      weight: `${Math.round(hit.weight * 10) / 10} kg`,
    });
  });
  return milestones;
}

function _svgVolumeBars(weeks) {
  const W = 300,
    H = 90,
    padX = 4,
    bottomH = 18,
    topPad = 12;
  const chartH = H - bottomH - topPad;
  const n = weeks.length,
    gap = 2;
  const barW = Math.floor((W - padX * 2 - (n - 1) * gap) / n);
  const maxVol = Math.max(...weeks.map((w) => w.vol), 1);
  const bars = weeks
    .map((wk, i) => {
      const x = padX + i * (barW + gap);
      const h = Math.max(2, Math.round((wk.vol / maxVol) * chartH));
      const y = topPad + chartH - h;
      const op = (wk.vol > 0 ? 0.3 + 0.7 * (i / (n - 1)) : 0.1).toFixed(2);
      const fill = wk.isCurrent ? 'var(--orange)' : '#c46a10';
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="2" fill="${fill}" style="--bar-op:${op}" class="stats-bar stats-bar-${i}"/><text x="${x + barW / 2}" y="${H - 2}" text-anchor="middle" class="stats-wlabel">${wk.label}</text>`;
    })
    .join('');
  const maxLabel =
    maxVol >= 1000
      ? (maxVol / 1000).toFixed(0) + 't'
      : Math.round(maxVol) + 'kg';
  return `<svg viewBox="0 0 ${W} ${H}" class="stats-svg"><text x="${W - padX}" y="9" text-anchor="end" class="stats-axis-top">${maxLabel}</text>${bars}</svg>`;
}

function _svgLiftLines(lifts, nWeeks) {
  const active = lifts.filter((l) => l.pts.length >= 1);
  if (!active.length) return null;
  const W = 300,
    H = 160,
    padX = 10,
    padY = 10;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - nWeeks * 7);
  const xRange = today.getTime() - cutoff.getTime() || 1;
  const allW = active.flatMap((l) => l.pts.map((p) => p.weight));
  const minW = Math.min(...allW) * 0.96,
    maxW = Math.max(...allW) * 1.02;
  const wRange = maxW - minW || 1;
  const chartW = W - padX * 2,
    chartH = H - padY * 2;
  const tx = (d) =>
    padX + Math.round(((d.getTime() - cutoff.getTime()) / xRange) * chartW);
  const ty = (w) => padY + Math.round((1 - (w - minW) / wRange) * chartH);
  // Dynamic grid lines based on actual weight range
  const rawStep = wRange / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const res = rawStep / mag;
  const step = mag * (res <= 1.5 ? 1 : res <= 3 ? 2 : res <= 7 ? 5 : 10);
  const gridStart = Math.ceil(minW / step) * step;
  const gridLines = [];
  for (let kg = gridStart; kg <= maxW; kg += step) gridLines.push(kg);
  const grids = gridLines
    .map((kg) => {
      const y = ty(kg);
      return `<line x1="${padX}" y1="${y}" x2="${W - padX}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2 4"/><text x="${padX}" y="${y - 2}" class="stats-axis-top">${Math.round(kg)} kg</text>`;
    })
    .join('');
  const lines = active
    .map((l) => {
      const dots = l.pts
        .map(
          (p) =>
            `<circle cx="${tx(p.date)}" cy="${ty(p.weight)}" r="${l.pts.length === 1 ? 4 : 2.5}" fill="${l.color}"/>`
        )
        .join('');
      if (l.pts.length === 1) return dots;
      const pts = l.pts.map((p) => `${tx(p.date)},${ty(p.weight)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${l.color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>${dots}`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="stats-svg">${grids}${lines}</svg>`;
}

function buildHistoryStatsMarkup() {
  const liftWks = workouts.filter((w) => !isSportWorkout(w));
  const sportWks = workouts.filter((w) => isSportWorkout(w));
  const m = new Date().getMonth();
  let sets = 0;
  liftWks
    .filter((w) => new Date(w.date).getMonth() === m)
    .forEach((w) =>
      (w.exercises || []).forEach(
        (e) => (sets += e.sets.filter((s) => s.done).length)
      )
    );
  const allRPE = workouts.filter((w) => w.rpe).map((w) => w.rpe);
  const avgRPE = allRPE.length
    ? (allRPE.reduce((a, b) => a + b, 0) / allRPE.length).toFixed(1)
    : '\u2014';

  const numbersHtml = `
    <div class="stats-num-card" style="--c:var(--gold)"><div class="stats-num-label">${trHist('history.total_sessions', 'Total Sessions')}</div><div class="stats-num-val">${liftWks.length}</div></div>
    <div class="stats-num-card" style="--c:var(--blue)"><div class="stats-num-label">${trHist('history.sport_sessions', 'Sport Sessions')}</div><div class="stats-num-val">${sportWks.length}</div></div>
    <div class="stats-num-card" style="--c:var(--accent)"><div class="stats-num-label">${trHist('history.sets_this_month', 'Sets This Month')}</div><div class="stats-num-val">${sets}</div></div>
    <div class="stats-num-card" style="--c:var(--purple)"><div class="stats-num-label">${trHist('history.avg_rpe', 'Avg RPE')}</div><div class="stats-num-val">${avgRPE}</div></div>`;

  const weeks = _statsWeeklyVolume(10);
  const volumeVisible = weeks.some((w) => w.vol > 0);
  const volumeHtml = volumeVisible
    ? `<div class="stats-chart-title">${trHist('history.stats.volume', 'Weekly Volume')}</div>${_svgVolumeBars(weeks)}`
    : '';

  const NWEEKS = 16;
  const lifts = [
    {
      label: trHist('history.stats.lift.squat', 'Squat'),
      color: 'var(--orange)',
      pts: _statsLiftE1rm('squat', NWEEKS),
    },
    {
      label: trHist('history.stats.lift.bench', 'Bench'),
      color: 'var(--blue)',
      pts: _statsLiftE1rm('bench', NWEEKS),
    },
    {
      label: trHist('history.stats.lift.deadlift', 'Deadlift'),
      color: 'var(--gold)',
      pts: _statsLiftE1rm('deadlift', NWEEKS),
    },
    {
      label: trHist('history.stats.lift.ohp', 'OH Press'),
      color: 'var(--purple)',
      pts: _statsLiftE1rm('ohp', NWEEKS),
    },
  ];
  const svg = _svgLiftLines(lifts, NWEEKS);
  const strengthVisible = !!svg;
  const legend = strengthVisible
    ? lifts
        .filter((l) => l.pts.length > 0)
        .map(
          (l) =>
            `<span class="stats-legend-item" style="color:${l.color}"><span class="stats-legend-dot" style="background:${l.color}"></span>${l.label}</span>`
        )
        .join('')
    : '';
  const strengthHtml = strengthVisible
    ? `<div class="stats-chart-title">${trHist('history.stats.e1rm', 'Estimated 1RM')}</div>${svg}<div class="stats-chart-legend">${legend}</div>`
    : '';

  return {
    numbersHtml,
    volumeHtml,
    volumeVisible,
    strengthHtml,
    strengthVisible,
  };
}

function updateStats() {
  const stats = buildHistoryStatsMarkup();
  if (isHistoryIslandActive()) {
    notifyHistoryIsland();
    return stats;
  }
  const numEl = document.getElementById('stats-numbers-grid');
  if (numEl) numEl.innerHTML = stats.numbersHtml;

  const volEl = document.getElementById('stats-volume-wrap');
  if (volEl) {
    volEl.style.display = stats.volumeVisible ? '' : 'none';
    volEl.innerHTML = stats.volumeHtml;
  }

  const strEl = document.getElementById('stats-strength-wrap');
  if (strEl) {
    strEl.style.display = stats.strengthVisible ? '' : 'none';
    strEl.innerHTML = stats.strengthHtml;
  }
  return stats;
}

function _buildStructuredHeatmap() {
  const WEEKS = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart(today);
  const gridStart = new Date(weekStart);
  gridStart.setDate(weekStart.getDate() - (WEEKS - 1) * 7);

  const dayMap = {};
  workouts.forEach((w) => {
    const d = new Date(w.date);
    d.setHours(0, 0, 0, 0);
    const k = d.toISOString().slice(0, 10);
    if (!dayMap[k]) dayMap[k] = { lift: false, sport: false };
    if (isSportWorkout(w)) dayMap[k].sport = true;
    else dayMap[k].lift = true;
  });

  const cells = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const k = d.toISOString().slice(0, 10);
    cells.push({
      key: k,
      isToday: d.getTime() === today.getTime(),
      isFuture: d > today,
      lift: !!dayMap[k]?.lift,
      sport: !!dayMap[k]?.sport,
    });
  }

  let weekStreak = 0;
  for (let i = 0; i < WEEKS; i++) {
    const ws = new Date(weekStart);
    ws.setDate(weekStart.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    const hasLift = workouts.some((w) => {
      if (isSportWorkout(w)) return false;
      const wd = new Date(w.date);
      wd.setHours(0, 0, 0, 0);
      return wd >= ws && wd <= we;
    });
    if (hasLift) weekStreak++;
    else if (i === 0) {
    } else break;
  }

  const cut28 = new Date(today);
  cut28.setDate(today.getDate() - 27);
  const last28 = workouts.filter(
    (w) => !isSportWorkout(w) && new Date(w.date) >= cut28
  ).length;
  const perWeek = (last28 / 4).toFixed(1);

  let totalVol = 0;
  workouts.forEach((w) => {
    if (isSportWorkout(w)) return;
    const wd = new Date(w.date);
    wd.setHours(0, 0, 0, 0);
    if (wd >= gridStart && wd <= today)
      (w.exercises || []).forEach((ex) => {
        ex.sets
          .filter((s) => s.done)
          .forEach((s) => {
            totalVol += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
          });
      });
  });

  const weekNums = [];
  for (let i = 0; i < WEEKS; i++) {
    const mon = new Date(gridStart);
    mon.setDate(gridStart.getDate() + i * 7);
    const tmp = new Date(mon.getTime());
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const w1 = new Date(tmp.getFullYear(), 0, 4);
    weekNums.push(
      1 +
        Math.round(
          ((tmp.getTime() - w1.getTime()) / 86400000 -
            3 +
            ((w1.getDay() + 6) % 7)) /
            7
        )
    );
  }

  const dayLabels =
    histLocale() === 'fi-FI'
      ? ['M', 'T', 'K', 'T', 'P', 'L', 'S']
      : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return {
    isOpen: historyHeatmapOpen,
    weeks: WEEKS,
    cells,
    weekNums,
    dayLabels,
    stats: { weekStreak, perWeek, totalVolume: totalVol },
    sportName: schedule.sportName || trHist('common.sport', 'Sport'),
    labels: {
      title: trHist('history.activity_title', 'ACTIVITY \u00B7 {weeks} WK', {
        weeks: WEEKS,
      }),
      noStreak: trHist('history.no_streak', 'No streak yet'),
      streakUnit: trHist('history.streak_unit', 'wk'),
      streakLabel: trHist('history.streak_label', 'streak'),
      liftsPerWeek: trHist('history.lifts_per_week', 'lifts/wk'),
      totalVolumeLabel: trHist('history.total_volume_label', 'total volume'),
      lift: trHist('history.legend.lift', 'Lift'),
    },
  };
}

function _programBadge(w) {
  if (isSportWorkout(w))
    return w.type === 'hockey' ? 'Hockey' : schedule.sportName || trHist('common.sport', 'Sport');
  const BADGES = {
    forge: 'Forge',
    wendler531: '5/3/1',
    stronglifts5x5: 'SL 5\u00D75',
    casualfullbody: trHist('program.casualfullbody.shortName', 'Casual'),
    hypertrophysplit: trHist('program.hypertrophysplit.shortName', 'Hyper'),
  };
  const pid = w.program || w.type || '';
  return BADGES[pid] || w.programLabel || '';
}

function _buildStructuredCard(w, isPR, recovery) {
  const d = new Date(w.date);
  const dateStr = d.toLocaleDateString(histLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const mins = Math.floor((w.duration || 0) / 60);
  const isExtra = w.subtype === 'extra';

  if (isSportWorkout(w)) {
    const sportLabel =
      w.type === 'hockey'
        ? 'Hockey'
        : schedule.sportName || trHist('common.sport', 'Sport');
    const sLabel = isExtra
      ? trHist('history.extra_sport_session', 'Extra {sport} Session', {
          sport: sportLabel,
        })
      : trHist('history.sport_session', '{sport} Session', {
          sport: sportLabel,
        });
    return {
      id: w.id,
      isSport: true,
      title: sLabel,
      date: dateStr,
      duration: mins,
      iconLabel: trHist('history.sport', 'Sport'),
      programBadge: w.type === 'hockey' ? 'Hockey' : schedule.sportName || trHist('common.sport', 'Sport'),
    };
  }

  const MAIN = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'OHP'];
  const mainEx = (w.exercises || []).find((e) =>
    MAIN.some((l) => e.name.includes(l))
  );
  const liftIcon = histLiftIcon(
    mainEx?.name || (w.exercises || [])[0]?.name || ''
  );

  const meta = w.programMeta || {};
  let cardTitle;
  if (w.program === 'forge' && meta.week) {
    cardTitle = trHist('history.card.week_day', 'Week {week} · Day {day}', {
      week: meta.week,
      day: w.programDayNum || 1,
    });
  } else {
    const rawLabel = w.programLabel || '';
    cardTitle =
      rawLabel.replace(/^[\u{1F300}-\u{1FFFF}\u2600-\u27FF]\s*/u, '').trim() ||
      d.toLocaleDateString(histLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });
  }

  const cardSub = dateStr;

  let tonnage = 0;
  (w.exercises || []).forEach((ex) => {
    ex.sets
      .filter((s) => s.done)
      .forEach((s) => {
        tonnage += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
      });
  });

  const completedExercises = (w.exercises || []).filter((ex) =>
    ex.sets.some((s) => s.done)
  );
  const exercises = completedExercises
    .map((ex) => histBuildExerciseSummary(ex))
    .filter(Boolean);

  const rs = histRecoveryStyle(recovery);

  return {
    id: w.id,
    isSport: false,
    liftIcon,
    title: cardTitle,
    sub: cardSub,
    isPR,
    isBonus: w.isBonus === true,
    recovery: recovery != null ? recovery : null,
    recoveryStyle: rs,
    duration: mins,
    tonnage,
    exerciseCount: completedExercises.length,
    rpe: w.rpe || null,
    exercises,
    sessionNotes: histNormalizeSessionNotes(w.sessionNotes),
    tmAdjustments: w.tmAdjustments || null,
    deleteTitle: histDeleteTitle(w),
    programBadge: _programBadge(w),
  };
}

function _buildStructuredLog() {
  if (!workouts.length) {
    const prog = getActiveProgram();
    const state = getActiveProgramState();
    const bi = prog.getBlockInfo ? prog.getBlockInfo(state) : null;
    return {
      empty: true,
      labels: {
        kicker: trHist('history.activity_title', 'Activity'),
        title: trHist('history.empty_title', 'No sessions yet'),
        sub: trHist(
          'history.empty_sub',
          'Complete your first workout to start building your training history.'
        ),
        cta: trHist('history.start_today', "Start Today's Workout"),
        currentPhase: trHist('history.current_phase', 'Current Phase'),
      },
      phase:
        bi && (bi.name || bi.modeDesc || bi.weekLabel)
          ? {
              name: bi.name || bi.weekLabel || 'Week ' + state.week,
              desc: bi.modeDesc || null,
            }
          : null,
    };
  }
  const prSet = histComputePRs();
  const recovMap = histComputeRecovery();
  const groups = histGroupWorkouts();
  return {
    empty: false,
    groups: groups.map((g) => ({
      key: g.key,
      groupLabel: g.groupLabel,
      count: g.workouts.length,
      cards: g.workouts.map((w) =>
        _buildStructuredCard(w, prSet.has(w.id), recovMap[w.id] ?? null)
      ),
    })),
  };
}

function _buildStructuredStats() {
  const liftWks = workouts.filter((w) => !isSportWorkout(w));
  const sportWks = workouts.filter((w) => isSportWorkout(w));
  const m = new Date().getMonth();
  let sets = 0;
  liftWks
    .filter((w) => new Date(w.date).getMonth() === m)
    .forEach((w) =>
      (w.exercises || []).forEach(
        (e) => (sets += e.sets.filter((s) => s.done).length)
      )
    );
  const allRPE = workouts.filter((w) => w.rpe).map((w) => w.rpe);
  const avgRPE = allRPE.length
    ? (allRPE.reduce((a, b) => a + b, 0) / allRPE.length).toFixed(1)
    : null;

  const selectedRange = historyStatsRangeState;
  const nWeeks = histGetStatsRangeWeeks();
  const lifts = HISTORY_MAIN_LIFTS.map((lift) => ({
    key: lift.key,
    label: trHist(lift.labelKey, lift.fallback),
    color: lift.color,
    pts: _statsLiftProgress(
      (name) => histNormalizeLiftKey(name) === lift.key,
      nWeeks
    ),
  }));
  const e1rmLifts = HISTORY_MAIN_LIFTS.map((lift) => ({
    key: lift.key,
    label: trHist(lift.labelKey, lift.fallback),
    color: lift.color,
    pts: _statsLiftE1rm(lift.key, nWeeks),
  }));
  const tmSeries = _statsTrainingMaxHistory(nWeeks);
  const tmLifts = HISTORY_MAIN_LIFTS.map((lift) => ({
    key: lift.key,
    label: trHist(lift.labelKey, lift.fallback),
    color: lift.color,
    pts: tmSeries[lift.key] || [],
  }));
  const milestones = _statsMilestones();

  return {
    range: {
      selected: selectedRange,
      options: [
        { id: '8w', label: trHist('history.stats.range.8w', '8W') },
        { id: '16w', label: trHist('history.stats.range.16w', '16W') },
        { id: 'all', label: trHist('history.stats.range.all', 'All') },
      ],
    },
    numbers: [
      {
        label: trHist('history.total_sessions', 'Total Sessions'),
        value: liftWks.length,
        color: 'var(--gold)',
      },
      {
        label: trHist('history.sport_sessions', 'Sport Sessions'),
        value: sportWks.length,
        color: 'var(--blue)',
      },
      {
        label: trHist('history.sets_this_month', 'Sets This Month'),
        value: sets,
        color: 'var(--accent)',
      },
      {
        label: trHist('history.avg_rpe', 'Avg RPE'),
        value: avgRPE || '\u2014',
        color: 'var(--purple)',
      },
    ],
    volume: {
      title: trHist('history.stats.volume', 'Weekly Volume'),
      weeks: _statsWeeklyVolume(10),
      visible: _statsWeeklyVolume(10).some((w) => w.vol > 0),
    },
    strength: {
      title: trHist('history.stats.strength', 'Strength Progress'),
      lifts,
      nWeeks: nWeeks || 16,
      visible: false,
    },
    e1rm: {
      title: trHist('history.stats.e1rm', 'Estimated 1RM'),
      lifts: e1rmLifts,
      nWeeks: nWeeks || 16,
      visible: e1rmLifts.some((l) => l.pts.length >= 1),
    },
    tmHistory: {
      title: trHist('history.stats.tm_history', 'Training Max Trend'),
      lifts: tmLifts,
      nWeeks: nWeeks || 16,
      visible: tmLifts.some((l) => l.pts.length >= 1),
    },
    milestones: {
      title: trHist('history.stats.milestones', 'Milestones'),
      items: milestones,
      visible: milestones.length > 0,
    },
  };
}

function getHistoryReactSnapshot() {
  return {
    tab: historyTabState,
    labels: {
      log: trHist('history.tab.log', 'Workout Log'),
      stats: trHist('history.tab.stats', 'Stats'),
      sessions: trHist('dashboard.sessions_left', 'sessions'),
      session: trHist('dashboard.session_left', 'session', { count: 1 }),
      delete: trHist('common.delete', 'Delete'),
      prBadge: trHist('history.pr_badge', 'NEW PR'),
      bonusBadge: trHist('history.bonus_badge', 'Bonus'),
      volume: trHist('history.card.volume', 'Volume'),
      exercises: trHist('history.card.exercises', 'Exercises'),
      notes: trHist('history.card.notes', 'Notes'),
      statsEmptyTitle: trHist('history.stats_empty_title', 'No stats yet'),
      statsEmptySub: trHist(
        'history.stats_empty_sub',
        'Complete a few workouts to see your training trends.'
      ),
      milestoneDate: trHist('history.milestone.date', 'Unlocked {date}'),
    },
    heatmap: _buildStructuredHeatmap(),
    log: _buildStructuredLog(),
    stats: _buildStructuredStats(),
  };
}

window.__IRONFORGE_HISTORY_ISLAND_EVENT__ = HISTORY_ISLAND_EVENT;
window.getHistoryReactSnapshot = getHistoryReactSnapshot;
window.switchHistoryStatsRange = switchHistoryStatsRange;
