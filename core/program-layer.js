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
    const meta = window.getExerciseMetadata(ex?.exerciseId || ex?.name || ex);
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
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getRegisteredPrograms) return runtime.getRegisteredPrograms();
  return Object.values(PROGRAMS);
}
function getCanonicalProgramRef(programId) {
  return typeof getCanonicalProgramId === 'function'
    ? getCanonicalProgramId(programId)
    : programId;
}
function getProgramById(programId) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getProgramById) return runtime.getProgramById(programId);
  const canonicalId = getCanonicalProgramRef(programId);
  return PROGRAMS[canonicalId] || null;
}
function hasRegisteredPrograms() {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.hasRegisteredPrograms) return runtime.hasRegisteredPrograms();
  return getRegisteredPrograms().length > 0;
}
function getProgramInitialState(programId) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getProgramInitialState) {
    return runtime.getProgramInitialState(programId);
  }
  const prog = getProgramById(programId);
  if (!prog || typeof prog.getInitialState !== 'function') return null;
  return cloneJson(prog.getInitialState()) || {};
}
function getProfileStoreBridge() {
  return window.__IRONFORGE_PROFILE_STORE__ || null;
}

function requireProfileStoreBridgeMethod(methodName) {
  const bridge = getProfileStoreBridge();
  const method = bridge?.[methodName];
  if (typeof method === 'function') {
    return method.bind(bridge);
  }
  throw new Error(
    '[Ironforge] Profile store bridge is required before legacy program writes.'
  );
}
function getActiveProgramId() {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getActiveProgramId) return runtime.getActiveProgramId();
  return getCanonicalProgramRef(profile.activeProgram || 'forge') || 'forge';
}
function getActiveProgram() {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getActiveProgram) return runtime.getActiveProgram();
  return (
    getProgramById(getActiveProgramId()) ||
    getProgramById('forge') ||
    getRegisteredPrograms()[0] ||
    {}
  );
}
function getActiveProgramState() {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getActiveProgramState) return runtime.getActiveProgramState();
  const activeProgramId = getActiveProgramId();
  const currentState = profile.programs?.[activeProgramId];
  if (currentState && typeof currentState === 'object') return currentState;
  const initialState =
    getProgramInitialState(activeProgramId) || getProgramInitialState('forge');
  if (initialState) return initialState;
  return {};
}
function setProgramState(id, state) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.setProgramState) return runtime.setProgramState(id, state);
  const canonicalId = getCanonicalProgramRef(id);
  if (!canonicalId) return null;
  return requireProfileStoreBridgeMethod('setProgramState')(canonicalId, state);
}
function recomputeProgramStateFromWorkouts(programId) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.recomputeProgramStateFromWorkouts) {
    return runtime.recomputeProgramStateFromWorkouts(programId);
  }
  return null;
}

function applyProgramDateCatchUp(programId) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.applyProgramDateCatchUp) {
    return runtime.applyProgramDateCatchUp(programId);
  }
  return false;
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
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getProgramFrequencyCompatibility) {
    return runtime.getProgramFrequencyCompatibility(programId, profileLike);
  }
  return {
    requested: 3,
    effective: 3,
    range: { min: 2, max: 6 },
    supportsExact: true,
  };
}

function getProgramsSupportingTrainingDays(days) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getSuggestedProgramsForTrainingDays) {
    return runtime.getSuggestedProgramsForTrainingDays(days, profile);
  }
  return [];
}

function getSuggestedProgramsForTrainingDays(days, profileLike) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getSuggestedProgramsForTrainingDays) {
    return runtime.getSuggestedProgramsForTrainingDays(days, profileLike);
  }
  return [];
}

function getActiveProgramFrequencyMismatch(profileLike) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getActiveProgramFrequencyMismatch) {
    return runtime.getActiveProgramFrequencyMismatch(profileLike);
  }
  return null;
}

function getProgramFrequencyNoticeHTML(programId, profileLike) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getProgramFrequencyNoticeHTML) {
    return runtime.getProgramFrequencyNoticeHTML(programId, profileLike);
  }
  return '';
}

function switchProgram(id) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.switchProgram) return runtime.switchProgram(id);
  return null;
}

function saveProgramSetup() {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.saveProgramSetup) return runtime.saveProgramSetup();
  return null;
}

function resolveProgramExerciseName(input) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.resolveProgramExerciseName) {
    return runtime.resolveProgramExerciseName(input);
  }
  return '';
}

function openProgramExercisePicker(config) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.openProgramExercisePicker) {
    return runtime.openProgramExercisePicker(config);
  }
  return false;
}

function updateProgramLift(array, idx, field, val) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.updateProgramLift) {
    return runtime.updateProgramLift(array, idx, field, val);
  }
  return null;
}

function updateSLLift(key, val) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.updateSLLift) return runtime.updateSLLift(key, val);
  return null;
}

function setSLNextWorkout(wk) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.setSLNextWorkout) return runtime.setSLNextWorkout(wk);
  return null;
}

function previewProgramSplit() {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.previewProgramSplit) return runtime.previewProgramSplit();
  return false;
}

function updateForgeModeSetting() {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.updateForgeModeSetting) return runtime.updateForgeModeSetting();
  return false;
}

function cleanProgramOptionLabel(label) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.cleanProgramOptionLabel) {
    return runtime.cleanProgramOptionLabel(label);
  }
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
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getProgramOptionDayNumber) {
    return runtime.getProgramOptionDayNumber(option);
  }
  const fromValue = String(option?.value || '').match(/\d+/);
  if (fromValue) return fromValue[0];
  const fromLabel = String(cleanProgramOptionLabel(option?.label || '')).match(
    /\d+/
  );
  return fromLabel ? fromLabel[0] : '';
}

function getProgramPreviewExerciseMeta(exercise) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getProgramPreviewExerciseMeta) {
    return runtime.getProgramPreviewExerciseMeta(exercise);
  }
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

function getProgramPreviewHeaderChips(prog, state, session, buildContext) {
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getProgramPreviewHeaderChips) {
    return runtime.getProgramPreviewHeaderChips(
      prog,
      state,
      session,
      buildContext
    );
  }
  const chips = [];
  const previewContext =
    buildContext ||
    (typeof getProgramSessionBuildContext === 'function'
      ? getProgramSessionBuildContext({ prog, state, preview: true })
      : null);
  const bi = prog.getBlockInfo
    ? prog.getBlockInfo(state, previewContext)
    : null;
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
  const chips = getProgramPreviewHeaderChips(
    prog,
    previewState,
    session,
    snapshot?.buildContext || null
  );
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
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (runtime?.getProgramTodayMuscleTags) {
    return runtime.getProgramTodayMuscleTags(planningContext);
  }
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
  const manualSportContext =
    typeof getPendingSportReadinessContext === 'function'
      ? getPendingSportReadinessContext()
      : null;
  const sportContext = mergeSportPreferenceContext(
    getAutomaticSportPreferenceContext(schedule, workouts),
    manualSportContext
  );
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
  const programBuildContext =
    typeof getProgramSessionBuildContext === 'function'
      ? getProgramSessionBuildContext({
          prog,
          state,
          sessionModeBundle: decisionBundle,
        })
      : null;
  const rawOptions = prog.getSessionOptions
    ? prog.getSessionOptions(state, workouts, schedule, programBuildContext)
    : [];
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
    const bi = prog.getBlockInfo(
      previewState,
      startSnapshot?.buildContext || programBuildContext
    );
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
