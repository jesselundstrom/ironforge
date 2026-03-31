// Program registry + program UI/state helpers extracted from app.js.
function trProg(key, fallback, params) {
  if (window.I18N) return I18N.t(key, params, fallback);
  return fallback;
}

function cloneProgramSession(exercises) {
  return (exercises || []).map((ex) => ({
    ...ex,
    sets: Array.isArray(ex?.sets)
      ? ex.sets.map((set) => ({ ...set }))
      : ex?.sets,
  }));
}

function stripWarmupSetsFromExercises(exercises) {
  return (exercises || []).map((ex) => ({
    ...ex,
    sets: Array.isArray(ex?.sets)
      ? ex.sets.filter((set) => !set?.isWarmup).map((set) => ({ ...set }))
      : [],
  }));
}

function analyzeProgramSessionShape(prog, session) {
  const exercises = Array.isArray(session) ? session : [];
  const totalSets = exercises.reduce(
    (sum, ex) => sum + (Array.isArray(ex.sets) ? ex.sets.length : 0),
    0
  );
  const accessoryCount = exercises.filter((ex) => ex.isAccessory).length;
  const auxCount = exercises.filter((ex) => ex.isAux && !ex.isAccessory).length;
  const legNames = new Set(
    (prog.legLifts || []).map((name) => String(name).toLowerCase())
  );
  const hasLegs = exercises.some((ex) =>
    legNames.has(String(ex.name || '').toLowerCase())
  );
  return {
    totalSets,
    accessoryCount,
    auxCount,
    hasLegs,
    exerciseCount: exercises.length,
  };
}

function getPlannedSessionDisplayMuscleLoad(session) {
  const totals = {};
  if (
    typeof window.getExerciseMetadata !== 'function' ||
    typeof window.mapExerciseMuscleToDisplayGroup !== 'function'
  )
    return totals;
  (Array.isArray(session) ? session : []).forEach((ex) => {
    const meta = window.getExerciseMetadata(
      ex?.exerciseId || ex?.name || ex
    );
    if (!meta) return;
    const setCount = Array.isArray(ex?.sets) ? ex.sets.length : 0;
    if (!setCount) return;
    const exerciseScale = ex?.isAccessory ? 0.6 : ex?.isAux ? 0.85 : 1;
    (meta.primaryMuscles || []).forEach((muscle) => {
      const group = window.mapExerciseMuscleToDisplayGroup(muscle);
      if (!group) return;
      totals[group] = (totals[group] || 0) + setCount * exerciseScale;
    });
    (meta.secondaryMuscles || []).forEach((muscle) => {
      const group = window.mapExerciseMuscleToDisplayGroup(muscle);
      if (!group) return;
      totals[group] = (totals[group] || 0) + setCount * 0.5 * exerciseScale;
    });
  });
  return totals;
}

function scoreSessionAgainstRecentMuscleLoad(sessionMuscles, recentMuscles) {
  let score = 0;
  Object.entries(sessionMuscles || {}).forEach(([group, plannedLoad]) => {
    const recentLoad = recentMuscles?.[group] || 0;
    const emphasis = plannedLoad >= 6 ? 1.4 : plannedLoad >= 3 ? 1 : 0.65;
    if (recentLoad >= 8) score -= Math.round(6 * emphasis);
    else if (recentLoad >= 4) score -= Math.round(3 * emphasis);
    else if (recentLoad < 1.5) score += Math.round(3 * emphasis);
    else if (recentLoad < 4) score += Math.round(1.5 * emphasis);
  });
  return score;
}

function getFreshTargetGroups(sessionMuscles, recentMuscles) {
  return Object.entries(sessionMuscles || {})
    .filter(([, plannedLoad]) => plannedLoad >= 2)
    .map(([group, plannedLoad]) => ({
      group,
      plannedLoad,
      recentLoad: recentMuscles?.[group] || 0,
    }))
    .filter((item) => item.recentLoad < 4)
    .sort(
      (a, b) => a.recentLoad - b.recentLoad || b.plannedLoad - a.plannedLoad
    )
    .slice(0, 2)
    .map((item) => item.group);
}

function getAutomaticSportPreferenceContext(schedule, workouts) {
  const sportDays = Array.isArray(schedule?.sportDays)
    ? schedule.sportDays
    : [];
  const legsHeavy = schedule?.sportLegsHeavy !== false;
  const intensity = String(schedule?.sportIntensity || 'hard').toLowerCase();
  const recentHours = { easy: 18, moderate: 24, hard: 30 }[intensity] || 30;
  const sportName =
    String(schedule?.sportName || trProg('common.sport', 'Sport')).trim() ||
    trProg('common.sport', 'Sport');
  const todayDow = new Date().getDay();
  const isSportDay = sportDays.includes(todayDow);
  const hadSportRecently =
    Array.isArray(workouts) &&
    workouts.some(
      (w) =>
        (w.type === 'sport' || w.type === 'hockey') &&
        (Date.now() - new Date(w.date).getTime()) / 3600000 <= recentHours
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

function mergeSportPreferenceContext(autoContext, manualContext) {
  const base = autoContext || getAutomaticSportPreferenceContext({}, []);
  const manualSportLoadLevel = manualContext?.sportLoadLevel || 'none';
  const manualLegsStress = manualContext?.legsStress || 'none';
  const hasManualLegsStress = manualLegsStress !== 'none';
  return {
    ...base,
    ...manualContext,
    sportName: manualContext?.sportName || base.sportName,
    sportLoadLevel: manualSportLoadLevel,
    legsStress: manualLegsStress,
    manualLegsStress,
    hasManualLegsStress,
    preferUpper: base.preferUpper || hasManualLegsStress,
  };
}

function buildRecommendationReasons(
  prefs,
  option,
  shape,
  sessionMuscles,
  recentMuscles,
  sportContext
) {
  const reasons = [];
  if (option?.isRecommended) {
    reasons.push(
      trProg(
        'program.recommend_reason.progression',
        'Matches your normal training order.'
      )
    );
  }
  if (sportContext?.preferUpper && !shape.hasLegs) {
    reasons.push(
      trProg(
        'program.recommend_reason.sport_context_upper',
        'Keeps the focus away from already busy legs.'
      )
    );
  }
  if (prefs.sessionMinutes <= 30 && shape.totalSets && shape.totalSets <= 14) {
    reasons.push(
      trProg(
        'program.recommend_reason.short_session',
        'Fits your shorter session target.'
      )
    );
  } else if (
    prefs.sessionMinutes <= 45 &&
    shape.totalSets &&
    shape.totalSets <= 18
  ) {
    reasons.push(
      trProg(
        'program.recommend_reason.lower_volume',
        'Keeps total session volume more manageable today.'
      )
    );
  }
  if (prefs.goal === 'sport_support' && !shape.hasLegs) {
    reasons.push(
      trProg(
        'program.recommend_reason.sport_support_upper',
        'Keeps leg fatigue lower for sport support.'
      )
    );
  }
  const freshGroups = getFreshTargetGroups(sessionMuscles, recentMuscles);
  if (freshGroups.length) {
    const groups = freshGroups
      .map((group) => trProg('dashboard.muscle_group.' + group, group))
      .join(', ');
    reasons.push(
      trProg(
        'program.recommend_reason.fresh_muscles',
        'Targets fresher muscle groups: {groups}.',
        { groups }
      )
    );
  }
  if (
    shape.hasLegs &&
    sportContext?.hasManualLegsStress &&
    sportContext.manualLegsStress === 'yesterday' &&
    shape.totalSets <= 16
  ) {
    reasons.push(
      trProg(
        'program.recommend_reason.sport_context_yesterday',
        "Keeps lower-body work more manageable after yesterday's leg-heavy sport."
      )
    );
  } else if (
    shape.hasLegs &&
    sportContext?.hasManualLegsStress &&
    sportContext.manualLegsStress === 'today' &&
    shape.totalSets <= 15
  ) {
    reasons.push(
      trProg(
        'program.recommend_reason.sport_context_today',
        "Keeps lower-body work more manageable around today's sport."
      )
    );
  } else if (
    shape.hasLegs &&
    sportContext?.hasManualLegsStress &&
    sportContext.manualLegsStress === 'tomorrow' &&
    shape.totalSets <= 16
  ) {
    reasons.push(
      trProg(
        'program.recommend_reason.sport_context_tomorrow',
        "Keeps lower-body work more manageable before tomorrow's sport."
      )
    );
  } else if (
    shape.hasLegs &&
    sportContext?.hasManualLegsStress &&
    sportContext.manualLegsStress === 'both' &&
    shape.totalSets <= 15
  ) {
    reasons.push(
      trProg(
        'program.recommend_reason.sport_context_both',
        'Keeps lower-body work more manageable with sport load on both sides.'
      )
    );
  }
  return [...new Set(reasons)].slice(0, 2);
}

function getProgramPreferenceRecommendation(
  prog,
  options,
  state,
  sportContext
) {
  const prefs = normalizeTrainingPreferences(profile);
  const activeOptions = (options || []).filter((o) => !o.done);
  if (activeOptions.length <= 1) return null;
  const recentMuscleLookback = Math.max(
    1,
    parseInt(MUSCLE_LOAD_CONFIG?.lookbackDays, 10) || 7
  );
  const recentMuscles =
    typeof getRecentDisplayMuscleLoads === 'function'
      ? getRecentDisplayMuscleLoads(recentMuscleLookback)
      : {};
  let best = null;
  activeOptions.forEach((option, idx) => {
    let score = option.isRecommended ? 20 : 0;
    let shape = {
      totalSets: 0,
      accessoryCount: 0,
      auxCount: 0,
      hasLegs: false,
      exerciseCount: 0,
    };
    let sessionMuscles = {};
    try {
      const plannedSession = cloneProgramSession(
        prog.buildSession
          ? prog.buildSession(option.value, state, { preview: true })
          : []
      );
      shape = analyzeProgramSessionShape(prog, plannedSession);
      sessionMuscles = getPlannedSessionDisplayMuscleLoad(plannedSession);
    } catch (_e) {}
    if (prefs.sessionMinutes <= 30) {
      score += shape.totalSets <= 14 ? 10 : -8;
      score -= shape.accessoryCount * 5;
      score -= Math.max(0, shape.auxCount - 1) * 2;
    } else if (prefs.sessionMinutes <= 45) {
      score += shape.totalSets <= 18 ? 6 : -5;
      score -= shape.accessoryCount * 3;
      score -= Math.max(0, shape.auxCount - 2);
    }
    if (prefs.goal === 'sport_support') {
      score += shape.hasLegs ? -6 : 5;
      score += shape.totalSets <= 16 ? 2 : -2;
      score -= shape.accessoryCount * 2;
    }
    if (sportContext?.preferUpper) {
      score += shape.hasLegs ? -18 : 6;
    }
    if (sportContext?.legsStress === 'yesterday') {
      score += shape.hasLegs ? -8 : 4;
      score += shape.totalSets <= 16 ? 1 : 0;
    } else if (sportContext?.legsStress === 'today') {
      score += shape.hasLegs ? -9 : 4;
      score += shape.totalSets <= 15 ? 1 : 0;
    } else if (sportContext?.legsStress === 'tomorrow') {
      score += shape.hasLegs ? -6 : 3;
    } else if (sportContext?.legsStress === 'both') {
      score += shape.hasLegs ? -11 : 5;
      score += shape.totalSets <= 15 ? 2 : 0;
    }
    score += scoreSessionAgainstRecentMuscleLoad(sessionMuscles, recentMuscles);
    const reasons = buildRecommendationReasons(
      prefs,
      option,
      shape,
      sessionMuscles,
      recentMuscles,
      sportContext
    );
    if (
      best === null ||
      score > best.score ||
      (score === best.score && idx === 0)
    )
      best = { value: option.value, score, reasons };
  });
  return best || null;
}

function applyPreferenceRecommendation(prog, options, state, sportContext) {
  const recommendation = getProgramPreferenceRecommendation(
    prog,
    options,
    state,
    sportContext
  );
  if (!recommendation?.value) return options;
  return (options || []).map((option) => ({
    ...option,
    isRecommended: !option.done && option.value === recommendation.value,
    preferenceReasons:
      !option.done && option.value === recommendation.value
        ? recommendation.reasons || []
        : [],
  }));
}

// Programs (loaded via <script> tags) call registerProgram() to self-register.
const PROGRAMS = {};
function registerProgram(p) {
  PROGRAMS[p.id] = p;
}
function getProgramRegistry() {
  return PROGRAMS;
}
function getRegisteredPrograms() {
  return Object.values(PROGRAMS);
}
function getCanonicalProgramRef(programId) {
  return typeof getCanonicalProgramId === 'function'
    ? getCanonicalProgramId(programId)
    : programId;
}
function getProgramById(programId) {
  const canonicalId = getCanonicalProgramRef(programId);
  return PROGRAMS[canonicalId] || null;
}
function hasRegisteredPrograms() {
  return getRegisteredPrograms().length > 0;
}
function getProgramInitialState(programId) {
  const prog = getProgramById(programId);
  if (!prog || typeof prog.getInitialState !== 'function') return null;
  return cloneJson(prog.getInitialState()) || {};
}
function getActiveProgramId() {
  return getCanonicalProgramRef(profile.activeProgram || 'forge') || 'forge';
}
function getActiveProgram() {
  return (
    getProgramById(getActiveProgramId()) ||
    getProgramById('forge') ||
    getRegisteredPrograms()[0] ||
    {}
  );
}
function getActiveProgramState() {
  const activeProgramId = getActiveProgramId();
  const currentState = profile.programs?.[activeProgramId];
  if (currentState && typeof currentState === 'object') return currentState;
  const initialState =
    getProgramInitialState(activeProgramId) || getProgramInitialState('forge');
  if (initialState) return initialState;
  return {};
}
function setProgramState(id, state) {
  const canonicalId = getCanonicalProgramRef(id);
  if (!profile.programs) profile.programs = {};
  profile.programs[canonicalId] = state;
}
function getWorkoutProgramId(w) {
  if (!w) return null;
  if (w.program) return getCanonicalProgramRef(w.program);
  if (!w.type || w.type === 'sport' || w.type === 'hockey') return null;
  return getCanonicalProgramRef(w.type);
}
function recomputeProgramStateFromWorkouts(programId) {
  const canonicalId = getCanonicalProgramRef(programId);
  const prog = getProgramById(canonicalId);
  if (!prog) return null;
  if (!profile.programs) profile.programs = {};

  const programWorkouts = workouts
    .filter((w) => getWorkoutProgramId(w) === canonicalId)
    .sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date);
      if (d !== 0) return d;
      return (a.id || 0) - (b.id || 0);
    });

  let state = programWorkouts[0]?.programStateUsedForBuild
    ? JSON.parse(JSON.stringify(programWorkouts[0].programStateUsedForBuild))
    : programWorkouts[0]?.programStateBefore
      ? JSON.parse(JSON.stringify(programWorkouts[0].programStateBefore))
      : prog.getInitialState
        ? prog.getInitialState()
        : {};
  if (prog.migrateState) state = prog.migrateState(state);

  programWorkouts.forEach((w, idx) => {
    const exercises = stripWarmupSetsFromExercises(
      Array.isArray(w.exercises) ? w.exercises : []
    );
    if (prog.adjustAfterSession)
      state = prog.adjustAfterSession(exercises, state, w.programOption);
    if (prog.advanceState) {
      const wd = new Date(w.date);
      const sow = getWeekStart(wd);
      const sessionsThisWeek = programWorkouts
        .slice(0, idx + 1)
        .filter((sw) => new Date(sw.date) >= sow).length;
      state = prog.advanceState(state, sessionsThisWeek);
    }
  });

  profile.programs[canonicalId] = state;
  return state;
}

function applyProgramDateCatchUp(programId) {
  const canonicalId = getCanonicalProgramRef(programId);
  const prog = getProgramById(canonicalId);
  if (!prog || !prog.dateCatchUp || !profile.programs?.[canonicalId])
    return false;
  const currentState = profile.programs[canonicalId];
  const caughtState = prog.dateCatchUp(currentState);
  if (
    !caughtState ||
    JSON.stringify(caughtState) === JSON.stringify(currentState)
  )
    return false;
  profile.programs[canonicalId] = caughtState;
  return true;
}

function buildProgramSwitcherMarkup() {
  const active = getActiveProgramId();
  const requested =
    typeof getPreferredTrainingDaysPerWeek === 'function'
      ? getPreferredTrainingDaysPerWeek(profile)
      : 3;
  const requestedLabel =
    typeof getTrainingDaysPerWeekLabel === 'function'
      ? getTrainingDaysPerWeekLabel(requested)
      : requested + ' sessions / week';
  const exactPrograms = getSuggestedProgramsForTrainingDays(requested, profile);
  const visible = exactPrograms.slice();
  if (
    active &&
    !visible.some((program) => program.id === active) &&
    getProgramById(active)
  ) {
    visible.push(getProgramById(active));
  }
  const cards = (visible.length ? visible : getRegisteredPrograms())
    .map((p) => {
      const compatibility = getProgramFrequencyCompatibility(p.id, profile);
      const pName = trProg('program.' + p.id + '.name', p.name);
      const pDesc = trProg('program.' + p.id + '.description', p.description);
      const difficulty =
        typeof getProgramDifficultyMeta === 'function'
          ? getProgramDifficultyMeta(p.id)
          : {
              key: 'intermediate',
              labelKey: 'program.difficulty.intermediate',
              fallback: 'Intermediate',
            };
      const difficultyLabel = trProg(difficulty.labelKey, difficulty.fallback);
      const effectiveLabel =
        typeof getTrainingDaysPerWeekLabel === 'function'
          ? getTrainingDaysPerWeekLabel(compatibility.effective)
          : compatibility.effective + ' sessions / week';
      const fitBadge = compatibility.supportsExact
        ? `<span class="program-card-fit program-card-fit-ok">${escapeHtml(trProg('program.frequency_card.fit', 'Fits {value}', { value: requestedLabel }))}</span>`
        : `<span class="program-card-fit program-card-fit-fallback">${escapeHtml(trProg('program.frequency_card.fallback', 'Uses {value}', { value: effectiveLabel }))}</span>`;
      const difficultyBadge = `<span class="program-card-difficulty program-card-difficulty-${escapeHtml(difficulty.key)}">${escapeHtml(difficultyLabel)}</span>`;
      return `
    <button type="button" class="program-card${p.id === active ? ' active' : ''}" onclick="switchProgram('${escapeHtml(p.id)}')" aria-pressed="${p.id === active ? 'true' : 'false'}">
      <div class="program-card-icon">${escapeHtml(p.icon || '🏋️')}</div>
      <div style="flex:1;min-width:0">
        <div class="program-card-name">${escapeHtml(pName)}</div>
        <div class="program-card-desc">${escapeHtml(pDesc)}</div>
        <div class="program-card-meta">${difficultyBadge}${fitBadge}</div>
      </div>
      ${p.id === active ? '<div class="program-card-badge">' + escapeHtml(trProg('program.active', 'Active')) + '</div>' : ''}
    </button>`;
    })
    .join('');
  const helper = `<div class="program-switcher-note">${escapeHtml(trProg('program.frequency_filter.showing', 'Showing programs that fit {value}. Your current program stays visible if it needs a fallback.', { value: requestedLabel }))}</div>`;
  return helper + cards;
}

function renderProgramSwitcher(targetContainer) {
  const container =
    targetContainer || document.getElementById('program-switcher-container');
  if (!container) return;
  if (
    !targetContainer &&
    typeof isSettingsProgramIslandActive === 'function' &&
    isSettingsProgramIslandActive()
  ) {
    notifySettingsProgramIsland();
    return;
  }
  container.innerHTML = buildProgramSwitcherMarkup();
}

function getProgramFrequencyCompatibility(programId, profileLike) {
  const requested =
    typeof getPreferredTrainingDaysPerWeek === 'function'
      ? getPreferredTrainingDaysPerWeek(profileLike)
      : 3;
  const effective =
    typeof getEffectiveProgramFrequency === 'function'
      ? getEffectiveProgramFrequency(programId, profileLike)
      : requested;
  const range =
    typeof getProgramTrainingDaysRange === 'function'
      ? getProgramTrainingDaysRange(programId)
      : { min: 2, max: 6 };
  return {
    requested,
    effective,
    range,
    supportsExact: requested >= range.min && requested <= range.max,
  };
}

function getProgramsSupportingTrainingDays(days) {
  return getRegisteredPrograms().filter((prog) => {
    if (typeof getProgramTrainingDaysRange !== 'function') return false;
    const { min, max } = getProgramTrainingDaysRange(prog.id);
    return days >= min && days <= max;
  });
}

function scoreProgramForTrainingDays(prog, days, prefs) {
  if (typeof getProgramCapabilities === 'function') {
    const capabilities = getProgramCapabilities(prog.id);
    if (typeof capabilities.recommendationScore === 'function') {
      return capabilities.recommendationScore(days, prefs);
    }
  }
  return 0;
}

function getSuggestedProgramsForTrainingDays(days, profileLike) {
  const prefs = normalizeTrainingPreferences(profileLike || profile || {});
  return getProgramsSupportingTrainingDays(days)
    .map((prog) => ({
      prog,
      score: scoreProgramForTrainingDays(prog, days, prefs),
    }))
    .sort((a, b) => b.score - a.score || a.prog.name.localeCompare(b.prog.name))
    .map((entry) => entry.prog);
}

function getActiveProgramFrequencyMismatch(profileLike) {
  const activeId = getCanonicalProgramRef(
    profileLike?.activeProgram || profile.activeProgram || 'forge'
  );
  const prog = getProgramById(activeId);
  if (!prog) return null;
  const compatibility = getProgramFrequencyCompatibility(activeId, profileLike);
  if (compatibility.supportsExact) return null;
  const requestedLabel =
    typeof getTrainingDaysPerWeekLabel === 'function'
      ? getTrainingDaysPerWeekLabel(compatibility.requested)
      : compatibility.requested + ' sessions / week';
  const effectiveLabel =
    typeof getTrainingDaysPerWeekLabel === 'function'
      ? getTrainingDaysPerWeekLabel(compatibility.effective)
      : compatibility.effective + ' sessions / week';
  const suggestions = getSuggestedProgramsForTrainingDays(
    compatibility.requested,
    profileLike
  ).filter((candidate) => candidate.id !== activeId);
  return {
    prog,
    ...compatibility,
    requestedLabel,
    effectiveLabel,
    suggestions,
  };
}

function getProgramFrequencyNoticeHTML(programId, profileLike) {
  const mismatch = getActiveProgramFrequencyMismatch(profileLike);
  if (!mismatch || mismatch.prog.id !== programId) return '';
  const currentName = trProg(
    'program.' + mismatch.prog.id + '.name',
    mismatch.prog.name
  );
  const body = trProg(
    'program.frequency_notice.body',
    '{name} does not support {requested}. It is currently using {effective}.',
    {
      name: currentName,
      requested: mismatch.requestedLabel,
      effective: mismatch.effectiveLabel,
    }
  );
  const suggestionLine = mismatch.suggestions.length
    ? `<div class="program-frequency-note">${escapeHtml(trProg('program.frequency_notice.suggestion', 'For {requested}, switch to a program that supports it directly.', { requested: mismatch.requestedLabel }))}</div>`
    : '';
  const actions = mismatch.suggestions
    .slice(0, 3)
    .map((candidate) => {
      const name = trProg('program.' + candidate.id + '.name', candidate.name);
      return `<button type="button" class="btn btn-secondary program-frequency-action" onclick="switchProgram('${escapeHtml(candidate.id)}')">${escapeHtml(name)}</button>`;
    })
    .join('');
  return `
    <div class="program-frequency-notice">
      <div class="program-frequency-kicker">${escapeHtml(trProg('program.frequency_notice.kicker', 'Program fit'))}</div>
      <div class="program-frequency-title">${escapeHtml(trProg('program.frequency_notice.title', 'Selected weekly frequency no longer fits this program'))}</div>
      <div class="program-frequency-body">${escapeHtml(body)}</div>
      ${suggestionLine}
      ${actions ? `<div class="program-frequency-actions">${actions}</div>` : ''}
    </div>
  `;
}

function normalizeEstimateExerciseName(input) {
  const raw = String(
    typeof input === 'object' ? input?.name || '' : input || ''
  ).trim();
  if (!raw) return '';
  if (typeof window.resolveExerciseSelection === 'function') {
    const resolved = window.resolveExerciseSelection(raw);
    return String(resolved?.name || raw).trim().toLowerCase();
  }
  return raw.toLowerCase();
}

function parseEstimateRepCount(value) {
  if (typeof parseLoggedRepCount === 'function') {
    const parsed = parseLoggedRepCount(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  const raw = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(raw) ? raw : 0;
}

function formatEstimatedWeight(value) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  if (!Number.isFinite(rounded)) return '0';
  return String(rounded)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

function roundEstimatedWeight(value, increment) {
  const step = Number(increment) > 0 ? Number(increment) : 2.5;
  return Math.round(value / step) * step;
}

function getProgramEstimateTargets(targetProgramId) {
  const canonicalId = getCanonicalProgramRef(targetProgramId);
  const prog = getProgramById(canonicalId);
  const initialState = prog?.getInitialState ? prog.getInitialState() : {};
  const rounding = initialState?.rounding || 2.5;
  if (Array.isArray(initialState?.lifts?.main)) {
    return initialState.lifts.main.map((lift) => ({
      key: lift.name,
      label: lift.name,
      rounding,
    }));
  }
  if (initialState?.lifts && typeof initialState.lifts === 'object') {
    return Object.keys(initialState.lifts).map((key) => ({
      key,
      label:
        prog?._names?.[key] ||
        key.charAt(0).toUpperCase() + key.slice(1),
      rounding,
    }));
  }
  return [];
}

function estimateTMsFromHistory(targetProgramId, workouts, profile) {
  void profile;
  const targets = getProgramEstimateTargets(targetProgramId);
  if (!targets.length) return {};
  const now = Date.now();
  const lookbackMs = 60 * 864e5;
  const recentWorkouts = (Array.isArray(workouts) ? workouts : []).filter(
    (workout) =>
      workout &&
      workout.type !== 'sport' &&
      workout.type !== 'hockey' &&
      Array.isArray(workout.exercises) &&
      now - new Date(workout.date).getTime() <= lookbackMs
  );
  const estimates = {};

  targets.forEach((target) => {
    const targetName = normalizeEstimateExerciseName(target.label || target.key);
    if (!targetName) return;
    const matchedSessions = new Set();
    let bestWeight = 0;
    let bestReps = 0;

    recentWorkouts.forEach((workout, workoutIndex) => {
      const workoutTag = String(
        workout.id || `${workout.date || ''}:${workoutIndex}`
      );
      workout.exercises.forEach((exercise) => {
        if (normalizeEstimateExerciseName(exercise) !== targetName) return;
        let matchedInWorkout = false;
        (Array.isArray(exercise?.sets) ? exercise.sets : []).forEach((set) => {
          if (!set?.done || set?.isWarmup) return;
          const weight = Number(set.weight);
          const reps = parseEstimateRepCount(set.reps);
          if (!Number.isFinite(weight) || weight <= 0 || reps <= 0) return;
          matchedInWorkout = true;
          if (
            weight > bestWeight ||
            (weight === bestWeight && reps > bestReps)
          ) {
            bestWeight = weight;
            bestReps = reps;
          }
        });
        if (matchedInWorkout) matchedSessions.add(workoutTag);
      });
    });

    if (matchedSessions.size < 2 || bestWeight <= 0 || bestReps <= 0) return;
    const estimatedOneRepMax = bestWeight * (1 + bestReps / 30);
    const cappedTrainingMax = Math.min(bestWeight, estimatedOneRepMax * 0.85);
    const rounded = roundEstimatedWeight(cappedTrainingMax, target.rounding);
    const finalValue = Math.min(bestWeight, rounded);
    if (finalValue > 0) estimates[target.key] = finalValue;
  });

  return Object.keys(estimates).length >= 2 ? estimates : {};
}

function switchProgram(id) {
  const canonicalId = getCanonicalProgramRef(id);
  if (canonicalId === getActiveProgramId()) return;
  const prog = getProgramById(canonicalId);
  if (!prog) return;
  const progName = trProg('program.' + prog.id + '.name', prog.name);
  showConfirm(
    trProg('program.switch_to', 'Switch to {name}', { name: progName }),
    trProg(
      'program.switch_msg',
      'Your current program is paused. {name} will start where you left off.',
      { name: progName }
    ),
    () => {
      profile.activeProgram = canonicalId;
      if (!profile.programs) profile.programs = {};
      let estimatedLoads = [];
      if (!profile.programs[canonicalId]) {
        profile.programs[canonicalId] = prog.getInitialState();
        const estimates = estimateTMsFromHistory(canonicalId, workouts, profile);
        const nextState = profile.programs[canonicalId];
        if (Object.keys(estimates).length) {
          if (Array.isArray(nextState?.lifts?.main)) {
            nextState.lifts.main.forEach((lift) => {
              if (estimates[lift.name] !== undefined) lift.tm = estimates[lift.name];
            });
            estimatedLoads = nextState.lifts.main
              .filter((lift) => estimates[lift.name] !== undefined)
              .map((lift) => ({
                lift: lift.name,
                value: estimates[lift.name],
              }));
          } else if (nextState?.lifts && typeof nextState.lifts === 'object') {
            Object.keys(nextState.lifts).forEach((key) => {
              if (estimates[key] !== undefined) nextState.lifts[key].weight = estimates[key];
            });
            estimatedLoads = Object.keys(nextState.lifts)
              .filter((key) => estimates[key] !== undefined)
              .map((key) => ({
                lift:
                  prog._names?.[key] ||
                  key.charAt(0).toUpperCase() + key.slice(1),
                value: estimates[key],
              }));
          }
        }
      }
      applyProgramDateCatchUp(canonicalId);
      saveProfileData({
        docKeys: [PROFILE_CORE_DOC_KEY, programDocKey(canonicalId)],
      });
      initSettings();
      updateDashboard();
      showToast(
        trProg('program.switched', 'Switched to {name}', { name: progName }),
        'var(--purple)'
      );
      if (estimatedLoads.length) {
        const changes = estimatedLoads
          .map((item) => `${item.lift} ${formatEstimatedWeight(item.value)} kg`)
          .join(', ');
        setTimeout(
          () =>
            showToast(
              trProg(
                'program.switch_estimated_loads',
                'Starting loads estimated from your recent training: {changes}. Adjust in Settings if needed.',
                { changes }
              ),
              'var(--blue)'
            ),
          500
        );
      }
    }
  );
}

function saveProgramSetup() {
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  const newState = prog.saveSettings ? prog.saveSettings(state) : state;
  setProgramState(prog.id, newState);
  saveProfileData({ programIds: [prog.id] });
  closeProgramSetupSheet();
  showToast(
    trProg('program.setup_saved', 'Program setup saved!'),
    'var(--purple)'
  );
  updateProgramDisplay();
}

function resolveProgramExerciseName(input) {
  if (typeof window.resolveExerciseSelection === 'function') {
    const resolved = window.resolveExerciseSelection(input);
    return String(resolved?.name || '').trim();
  }
  return String(
    typeof input === 'object' ? input?.name || '' : input || ''
  ).trim();
}

function openProgramExercisePicker(config) {
  const next = config || {};
  if (typeof window.openExerciseCatalogForSettings !== 'function') return false;
  const currentName = resolveProgramExerciseName(
    next.currentName || next.exercise?.name || ''
  );
  const swapInfo = {
    category: next.category || '',
    filters: { ...(next.filters || {}) },
    options: Array.isArray(next.options) ? next.options.slice() : [],
  };
  return window.openExerciseCatalogForSettings({
    exercise: {
      name: currentName || next.fallbackName || swapInfo.options[0] || '',
    },
    swapInfo,
    title: next.title || trProg('catalog.title.settings', 'Choose Exercise'),
    subtitle:
      next.subtitle ||
      trProg(
        'catalog.sub.settings',
        'Choose the exercise variant this program should use.'
      ),
    titleParams: next.titleParams || null,
    onSelect: (exercise) => {
      const resolvedName = resolveProgramExerciseName(exercise);
      if (next.onSelect) next.onSelect(resolvedName, exercise);
    },
  });
}

function updateProgramLift(array, idx, field, val) {
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  if (!state.lifts || !state.lifts[array] || !state.lifts[array][idx]) return;
  const newState = JSON.parse(JSON.stringify(state));
  if (field === 'tm' || field === 'weight') {
    const n = parseFloat(val);
    val = isNaN(n) ? 0 : Math.max(0, Math.min(999, Math.round(n * 10) / 10));
  }
  newState.lifts[array][idx][field] = val;
  setProgramState(prog.id, newState);
}

function updateSLLift(key, val) {
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  const newState = JSON.parse(JSON.stringify(state));
  if (newState.lifts && newState.lifts[key]) {
    const n = parseFloat(val);
    newState.lifts[key].weight = isNaN(n)
      ? 0
      : Math.max(0, Math.min(999, Math.round(n * 10) / 10));
  }
  setProgramState(prog.id, newState);
}

function setSLNextWorkout(wk) {
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  setProgramState(prog.id, { ...state, nextWorkout: wk });
  initSettings();
}

function previewProgramSplit() {
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  if (prog._previewSplit) {
    const freq =
      parseInt(document.getElementById('prog-days')?.value, 10) ||
      (typeof getEffectiveProgramFrequency === 'function'
        ? getEffectiveProgramFrequency(prog.id, profile)
        : 0) ||
      state.daysPerWeek ||
      3;
    prog._previewSplit(freq, state.lifts);
  }
}

function updateForgeModeSetting() {
  const prog = getActiveProgram();
  const mode = document.getElementById('prog-mode')?.value || 'sets';
  if (prog._updateModeDesc) prog._updateModeDesc(mode);
}

function cleanProgramOptionLabel(label) {
  return String(label || '')
    .replace(/^([⭐✅🏃⚠️]+\s*)+/u, '')
    .trim();
}

function setProgramDayOption(value) {
  if (typeof setSelectedWorkoutStartOption === 'function') {
    setSelectedWorkoutStartOption(value);
  } else {
    const input = document.getElementById('program-day-select');
    if (input) input.value = String(value || '');
  }
  updateProgramDisplay();
}

function getProgramOptionDayNumber(option) {
  const fromValue = String(option?.value || '').match(/\d+/);
  if (fromValue) return fromValue[0];
  const fromLabel = String(cleanProgramOptionLabel(option?.label || '')).match(
    /\d+/
  );
  return fromLabel ? fromLabel[0] : '';
}

function getProgramPreviewSession(
  prog,
  optionValue,
  state,
  sportContext,
  planningContext,
  sessionModeBundle
) {
  if (!prog || !prog.buildSession) return [];
  const effectiveDecision =
    sessionModeBundle?.effectiveDecision ||
    sessionModeBundle?.trainingDecision ||
    null;
  const buildContext =
    typeof getProgramSessionBuildContext === 'function'
      ? getProgramSessionBuildContext({ preview: true, sessionModeBundle })
      : { preview: true };
  const buildState =
    typeof getProgramSessionStateForBuild === 'function'
      ? getProgramSessionStateForBuild(prog, state, buildContext)
      : state;
  let preview = cloneProgramSession(
    prog.buildSession(optionValue, buildState, buildContext) || []
  );
  if (typeof withResolvedExerciseId === 'function')
    preview = preview.map(withResolvedExerciseId);
  if (typeof applyTrainingPreferencesToExercises === 'function') {
    const adjusted = applyTrainingPreferencesToExercises(
      preview,
      sportContext,
      {
        planningContext,
        decision: effectiveDecision,
        effectiveSessionMode: sessionModeBundle?.effectiveSessionMode,
      }
    );
    preview = adjusted?.exercises || preview;
  }
  return preview;
}

function getProgramPreviewBuildState(prog, state, sessionModeBundle) {
  const buildContext =
    typeof getProgramSessionBuildContext === 'function'
      ? getProgramSessionBuildContext({ preview: true, sessionModeBundle })
      : { preview: true };
  return typeof getProgramSessionStateForBuild === 'function'
    ? getProgramSessionStateForBuild(prog, state, buildContext)
    : state;
}

function getProgramPreviewExerciseMeta(exercise) {
  const workSets = (exercise?.sets || []).filter((set) => !set.isWarmup);
  const reps = workSets.map((set) => String(set.reps ?? '')).filter(Boolean);
  const sameReps =
    reps.length && reps.every((rep) => rep === reps[0]) ? reps[0] : '';
  const pattern = workSets.length
    ? sameReps
      ? `${workSets.length}×${sameReps}`
      : `${workSets.length} ${trProg('common.sets', 'sets')}`
    : '';
  const weightRaw =
    exercise?.prescribedWeight ??
    workSets.find(
      (set) =>
        set.weight !== undefined && set.weight !== null && set.weight !== ''
    )?.weight;
  const weightNum = parseFloat(weightRaw);
  const weight = Number.isFinite(weightNum) ? `${weightNum} kg` : '';
  return { pattern, weight };
}

function getProgramPreviewHeaderChips(prog, state, session) {
  const chips = [];
  const bi = prog.getBlockInfo ? prog.getBlockInfo(state) : null;
  if (bi?.pct) chips.push(`${bi.pct}% 1RM`);
  const primary = (session || []).find((ex) => !ex.isAccessory) || session?.[0];
  if (primary) {
    const meta = getProgramPreviewExerciseMeta(primary);
    if (meta.pattern) chips.push(meta.pattern);
    if (
      state?.mode === 'rir' &&
      primary.rirCutoff !== undefined &&
      primary.rirCutoff !== null
    )
      chips.push(`RIR ${primary.rirCutoff}`);
  }
  return chips.slice(0, 3);
}

function renderProgramSessionPreview(prog, selectedOption, snapshot) {
  const container = document.getElementById('program-session-preview');
  if (!container || !selectedOption) {
    if (container) container.innerHTML = '';
    return;
  }
  const previewState = snapshot?.buildState || {};
  const session = Array.isArray(snapshot?.exercises) ? snapshot.exercises : [];
  const chips = getProgramPreviewHeaderChips(prog, previewState, session);
  const title =
    cleanProgramOptionLabel(selectedOption.label) ||
    trProg('workout.training_day', 'Training Day');
  const dayNumber = getProgramOptionDayNumber(selectedOption);
  const headerTitle = dayNumber
    ? `${trProg('workout.day', 'Day')} ${dayNumber}`
    : title;
  const rows = session
    .map((exercise, index) => {
      const meta = getProgramPreviewExerciseMeta(exercise);
      return `<div class="workout-session-row">
      <div class="workout-session-row-index">${index + 1}</div>
      <div class="workout-session-row-main">${escapeHtml(displayExerciseName(exercise.name || ''))}</div>
      <div class="workout-session-row-meta">
        ${meta.pattern ? `<div class="workout-session-row-pattern">${escapeHtml(meta.pattern)}</div>` : ''}
        ${meta.weight ? `<div class="workout-session-row-weight">${escapeHtml(meta.weight)}</div>` : ''}
      </div>
      <div class="workout-session-row-chevron" aria-hidden="true">&gt;</div>
    </div>`;
    })
    .join('');
  container.innerHTML = `<div class="workout-today-section">
    <div class="workout-session-card">
      <div class="workout-session-card-head">
        <div class="workout-session-card-title">${escapeHtml(headerTitle)}</div>
        <div class="workout-session-card-chips">${chips.map((chip) => `<span class="workout-session-chip">${escapeHtml(chip)}</span>`).join('')}</div>
      </div>
      <div class="workout-session-card-body">${rows || `<div class="workout-session-empty">${escapeHtml(trProg('common.loading', 'Loading...'))}</div>`}</div>
    </div>
  </div>`;
}

function getProgramTodayMuscleTags(planningContext) {
  const loadMap = planningContext?.recentMuscleLoad || {};
  return Object.entries(loadMap)
    .map(([name, load]) => {
      let level = 'light';
      if (load >= 8) level = 'high';
      else if (load >= 4) level = 'moderate';
      return {
        name: trProg('dashboard.muscle_group.' + name, name),
        level,
        label: trProg(`dashboard.muscle_load.${level}`, level),
      };
    })
    .sort((a, b) => {
      const order = { high: 0, moderate: 1, light: 2 };
      return order[a.level] - order[b.level];
    })
    .slice(0, 3);
}

function renderProgramTodayPanels(
  prog,
  state,
  trainingDecision,
  sessionModeBundle,
  planningContext,
  selectedOption
) {
  const todayPanel = document.getElementById('program-today-panel');
  const warningPanel = document.getElementById('program-warning-panel');
  if (todayPanel) todayPanel.innerHTML = '';
  if (warningPanel) warningPanel.innerHTML = '';
  if (!todayPanel) return;
  const effectiveDecision =
    sessionModeBundle?.effectiveDecision || trainingDecision;
  const fatigue = planningContext?.fatigue || computeFatigue();
  const recovery = Math.max(0, 100 - (fatigue?.overall || 0));
  const guidance =
    typeof getPreferenceGuidance === 'function'
      ? getPreferenceGuidance(profile, {
          canPushVolume:
            recovery >= 70 && effectiveDecision?.action === 'train',
        })
      : [];
  const commentaryState =
    typeof buildTrainingCommentaryState === 'function'
      ? buildTrainingCommentaryState({
          decision: effectiveDecision || trainingDecision,
          context: planningContext,
        })
      : null;
  const summary =
    typeof presentTrainingCommentary === 'function' && commentaryState
      ? presentTrainingCommentary(commentaryState, 'workout_summary')
      : null;
  const warningSummary =
    typeof presentTrainingCommentary === 'function' && commentaryState
      ? presentTrainingCommentary(commentaryState, 'program_warning')
      : null;
  const focusLine =
    guidance[0] ||
    trProg('workout.today.focus', 'Train sharp and keep the main work crisp.');
  const supportLine = summary?.copy || '';
  const tags = getProgramTodayMuscleTags(planningContext);
  todayPanel.innerHTML = `<div class="workout-today-section">
    <div class="workout-today-section-label">${escapeHtml(trProg('workout.today.kicker', "Today's focus"))}</div>
    <div class="workout-today-card">
      <div class="workout-today-copy">${escapeHtml(focusLine)}</div>
      ${supportLine ? `<div class="workout-today-sub">${escapeHtml(supportLine)}</div>` : ''}
      ${tags.length ? `<div class="workout-today-tags">${tags.map((tag) => `<span class="workout-today-tag is-${escapeHtml(tag.level)}">${escapeHtml(tag.name)} ${escapeHtml(tag.label)}</span>`).join('')}</div>` : ''}
    </div>
  </div>`;
  if (typeof renderWorkoutStartDecisionCard === 'function') {
    const decisionCard = renderWorkoutStartDecisionCard(
      prog,
      state,
      trainingDecision || effectiveDecision,
      sessionModeBundle,
      planningContext
    );
    if (decisionCard && warningPanel) {
      warningPanel.innerHTML = `<div class="workout-today-section">
        <div class="workout-today-section-label">${escapeHtml(trProg('workout.plan.kicker', "Today's decision"))}</div>
        ${decisionCard}
      </div>`;
      return;
    }
  }
  if (!warningPanel || !warningSummary) return;
  const needsWarning =
    (trainingDecision?.action && trainingDecision.action !== 'train') ||
    (trainingDecision?.restrictionFlags || []).includes('avoid_heavy_legs') ||
    (trainingDecision?.reasonCodes || []).includes('low_recovery') ||
    (trainingDecision?.reasonCodes || []).includes('conservative_recovery');
  if (!needsWarning) return;
  const caution =
    trainingDecision?.action === 'shorten' ||
    (trainingDecision?.restrictionFlags || []).includes('avoid_heavy_legs');
  warningPanel.innerHTML = `<div class="workout-today-section">
    <div class="workout-today-section-label">${escapeHtml(trProg('workout.warning.title', 'Training warning'))}</div>
      <div class="workout-warning-card${caution ? ' is-caution' : ''}">
      <div class="workout-warning-title">${escapeHtml(warningSummary.title || trProg('workout.warning.low_recovery', 'Low recovery'))}</div>
      <div class="workout-warning-copy">${escapeHtml(warningSummary.copy || trProg('workout.warning.low_recovery_copy', 'Consider resting. If you train, Day {day} is the safer option.', { day: getProgramOptionDayNumber(selectedOption) || '1' }))}</div>
    </div>
  </div>`;
}

function updateProgramDisplay() {
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  const optionWrap = document.getElementById('program-day-options');
  const prevVal =
    typeof getSelectedWorkoutStartOption === 'function'
      ? getSelectedWorkoutStartOption()
      : document.getElementById('program-day-select')?.value || '';
  const rawOptions = prog.getSessionOptions
    ? prog.getSessionOptions(state, workouts, schedule)
    : [];
  const manualSportContext =
    typeof getPendingSportReadinessContext === 'function'
      ? getPendingSportReadinessContext()
      : null;
  const sportContext = mergeSportPreferenceContext(
    getAutomaticSportPreferenceContext(schedule, workouts),
    manualSportContext
  );
  const options = applyPreferenceRecommendation(
    prog,
    rawOptions,
    state,
    sportContext
  );
  const recommended = options.find((o) => o.isRecommended) || options[0];
  const hasMatch = prevVal && options.some((o) => o.value === prevVal);
  const selectedValue = String(
    hasMatch ? prevVal : recommended?.value || options[0]?.value || ''
  );
  const selectedOption =
    (hasMatch ? options.find((o) => o.value === prevVal) : recommended) ||
    recommended ||
    null;
  if (typeof setSelectedWorkoutStartOption === 'function') {
    setSelectedWorkoutStartOption(selectedValue);
  } else {
    const ds = document.getElementById('program-day-select');
    if (ds) ds.value = selectedValue;
  }
  if (
    typeof isLogStartIslandActive === 'function' &&
    isLogStartIslandActive() &&
    !activeWorkout
  ) {
    notifyLogStartIsland();
    return;
  }
  if (optionWrap) {
    optionWrap.innerHTML = options
      .map((o) => {
        const selected = String(o.value) === selectedValue;
        const dayNumber = getProgramOptionDayNumber(o) || String(o.value || '');
        const status = o.done
          ? trProg('program.done', 'Done')
          : o.isRecommended
            ? trProg('program.recommended', 'Recommended')
            : trProg('program.future', 'Upcoming');
        const icon = o.done ? 'OK' : o.isRecommended ? '*' : '';
        const cls = `program-day-option${selected ? ' active' : ''}${o.done ? ' done' : ''}${!o.done && !o.isRecommended ? ' upcoming' : ''}`;
        return `<button type="button" class="${cls}" data-option-value="${escapeHtml(o.value)}" onclick="setProgramDayOption(this.dataset.optionValue||'')">
        <div class="program-day-option-day">${escapeHtml(trProg('workout.day', 'Day'))}</div>
        <div class="program-day-option-number">${escapeHtml(dayNumber)}</div>
        <div class="program-day-option-status">${icon ? `<span class="program-day-option-status-icon">${escapeHtml(icon)}</span>` : ''}${escapeHtml(status)}</div>
      </button>`;
      })
      .join('');
  }
  const info = document.getElementById('program-week-display');
  const decisionBundle =
    typeof getWorkoutStartDecisionBundle === 'function'
      ? getWorkoutStartDecisionBundle({ prog, state, sportContext })
      : {
          planningContext:
            typeof buildPlanningContext === 'function'
              ? buildPlanningContext({
                  profile,
                  schedule,
                  workouts,
                  activeProgram: prog,
                  activeProgramState: state,
                  fatigue:
                    typeof computeFatigue === 'function'
                      ? computeFatigue()
                      : null,
                  sportContext,
                })
              : null,
          trainingDecision: null,
          effectiveDecision: null,
        };
  const planningContext = decisionBundle.planningContext;
  const trainingDecision =
    decisionBundle.trainingDecision ||
    (typeof getTodayTrainingDecision === 'function'
      ? getTodayTrainingDecision(planningContext)
      : null);
  const startSnapshot =
    typeof getWorkoutStartSnapshot === 'function' &&
    selectedOption?.value !== undefined
      ? getWorkoutStartSnapshot({
          prog,
          state,
          selectedOption: selectedOption.value,
          sportContext,
          decisionBundle,
          planningContext,
          trainingDecision,
        })
      : null;
  const previewState = startSnapshot?.buildState || state;
  if (info && prog.getBlockInfo) {
    const bi = prog.getBlockInfo(previewState);
    const progName = trProg('program.' + prog.id + '.name', prog.name);
    info.textContent = [progName, bi.name, bi.weekLabel]
      .filter(Boolean)
      .join(' - ');
  }
  renderProgramSessionPreview(prog, selectedOption, startSnapshot);
  renderProgramTodayPanels(
    prog,
    state,
    trainingDecision,
    decisionBundle,
    planningContext,
    selectedOption
  );
  if (
    typeof isLogStartIslandActive === 'function' &&
    isLogStartIslandActive() &&
    !activeWorkout
  ) {
    notifyLogStartIsland();
  }
}

function onDaySelectChange() {
  updateProgramDisplay();
}
