function getSportQuickLogMeta() {
  const sportName =
    (schedule.sportName || getDefaultSportName()).trim() ||
    getDefaultSportName();
  const displayName = displaySportName(sportName);
  const normalized = sportName.toLowerCase();
  let icon = 'S';
  if (normalized.includes('hock')) icon = 'HK';
  else if (normalized.includes('run')) icon = 'RN';
  else if (normalized.includes('cycl') || normalized.includes('bike'))
    icon = 'BK';
  else if (normalized.includes('swim')) icon = 'SW';
  else if (normalized.includes('row')) icon = 'RW';
  else if (normalized.includes('soccer') || normalized.includes('football'))
    icon = 'FB';
  else if (normalized.includes('basket')) icon = 'BB';
  else if (normalized.includes('tennis')) icon = 'TN';
  const subtitle = i18nText(
    'workout.unscheduled_session',
    'Unscheduled {sport} session',
    {
      sport:
        normalized === 'cardio' || normalized === 'kestävyys'
          ? displayName.toLowerCase()
          : displayName,
    }
  );
  return { sportName: displayName, icon, subtitle };
}

function getRuntimeBridge() {
  return window.__IRONFORGE_RUNTIME_BRIDGE__ || null;
}

function pushLogStartView() {
  const bridge = getRuntimeBridge();
  if (!bridge || typeof bridge.setLogStartView !== 'function') return;
  bridge.setLogStartView(buildLogStartView());
}

function isLogStartIslandActive() {
  const bridge = getRuntimeBridge();
  return !!bridge && typeof bridge.setLogStartView === 'function';
}

function notifyLogStartIsland() {
  pushLogStartView();
}

function getLogStartPreviewSnapshot(prog, selectedOption, snapshot) {
  if (!selectedOption || !snapshot) return null;
  const previewState = snapshot.buildState || {};
  const session = Array.isArray(snapshot.exercises) ? snapshot.exercises : [];
  const simple =
    typeof isSimpleMode === 'function' && isSimpleMode(profile);
  const chips = simple
    ? []
    : typeof getProgramPreviewHeaderChips === 'function'
      ? getProgramPreviewHeaderChips(prog, previewState, session)
      : [];
  const title =
    typeof cleanProgramOptionLabel === 'function'
      ? cleanProgramOptionLabel(selectedOption.label)
      : String(selectedOption.label || '').trim();
  const dayNumber =
    typeof getProgramOptionDayNumber === 'function'
      ? getProgramOptionDayNumber(selectedOption)
      : '';
  const headerTitle = simple
    ? i18nText('workout.simple.your_workout', 'Your Workout')
    : dayNumber
      ? `${i18nText('workout.day', 'Day')} ${dayNumber}`
      : title || i18nText('workout.training_day', 'Training Day');
  const rows = session.map((exercise, index) => {
    const meta =
      typeof getProgramPreviewExerciseMeta === 'function'
        ? getProgramPreviewExerciseMeta(exercise)
        : { pattern: '', weight: '' };
    return {
      id: `preview-${index}-${exercise?.name || 'exercise'}`,
      index: index + 1,
      name: displayExerciseName(exercise?.name || ''),
      pattern: meta.pattern || '',
      weight: meta.weight || '',
    };
  });
  return {
    headerTitle,
    chips,
    rows,
  };
}

function getLogStartDecisionCardSnapshot(
  prog,
  state,
  decision,
  sessionModeBundle,
  context
) {
  const recommendedMode =
    sessionModeBundle?.recommendedSessionMode === 'light' ? 'light' : 'normal';
  const displayDecision =
    recommendedMode === 'light' && !isLightTrainingAction(decision?.action)
      ? applySessionModeToDecision(decision, 'light')
      : decision;
  const summary = getWorkoutDecisionSummary(displayDecision, context);
  if (!summary) return null;
  const summaryVm =
    typeof buildTrainingCommentaryState === 'function' &&
    typeof presentTrainingCommentary === 'function'
      ? presentTrainingCommentary(
          buildTrainingCommentaryState({ decision: displayDecision, context }),
          'workout_summary'
        )
      : null;
  const reasons = summary.reasonLabels || [];
  const selectedMode = normalizeSessionMode(
    sessionModeBundle?.selectedSessionMode || 'auto'
  );
  const autoCopy = i18nText(
    recommendedMode === 'light'
      ? 'workout.session_mode.auto_copy_light'
      : 'workout.session_mode.auto_copy_normal',
    recommendedMode === 'light'
      ? "Follow today's light-session recommendation automatically."
      : "Follow today's normal-session recommendation automatically."
  );
  return {
    kicker:
      summaryVm?.kicker || i18nText('workout.plan.kicker', "Today's decision"),
    title: summary.title,
    copy: summary.copy,
    reasons,
    options: [
      {
        value: 'auto',
        title: i18nText('workout.session_mode.auto', 'Auto'),
        copy: autoCopy,
        active: selectedMode === 'auto',
      },
      {
        value: 'normal',
        title: i18nText('workout.session_mode.normal', 'Normal session'),
        copy: i18nText(
          'workout.session_mode.normal_copy',
          'Keep the original plan and suppress the automatic lightening.'
        ),
        active: selectedMode === 'normal',
      },
      {
        value: 'light',
        title: i18nText('workout.session_mode.light', 'Light session'),
        copy: i18nText(
          'workout.session_mode.light_copy',
          'Start with the lighter session version even if today would otherwise be normal.'
        ),
        active: selectedMode === 'light',
      },
    ],
  };
}

function getLogStartTodayPanelsSnapshot(
  prog,
  state,
  trainingDecision,
  sessionModeBundle,
  planningContext,
  selectedOption
) {
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
  const tags =
    typeof getProgramTodayMuscleTags === 'function'
      ? getProgramTodayMuscleTags(planningContext)
      : [];
  const decisionCard = getLogStartDecisionCardSnapshot(
    prog,
    state,
    trainingDecision || effectiveDecision,
    sessionModeBundle,
    planningContext
  );
  const needsWarning =
    (trainingDecision?.action && trainingDecision.action !== 'train') ||
    (trainingDecision?.restrictionFlags || []).includes('avoid_heavy_legs') ||
    (trainingDecision?.reasonCodes || []).includes('low_recovery') ||
    (trainingDecision?.reasonCodes || []).includes('conservative_recovery');
  const caution =
    trainingDecision?.action === 'shorten' ||
    (trainingDecision?.restrictionFlags || []).includes('avoid_heavy_legs');
  return {
    focus: {
      kicker: i18nText('workout.today.kicker', "Today's focus"),
      copy:
        guidance[0] ||
        i18nText(
          'workout.today.focus',
          'Train sharp and keep the main work crisp.'
        ),
      sub: summary?.copy || '',
      tags,
    },
    decisionCard,
    warning:
      !decisionCard && warningSummary && needsWarning
        ? {
            title:
              warningSummary.title ||
              i18nText('workout.warning.low_recovery', 'Low recovery'),
            copy:
              warningSummary.copy ||
              i18nText(
                'workout.warning.low_recovery_copy',
                'Consider resting. If you train, Day {day} is the safer option.',
                {
                  day:
                    typeof getProgramOptionDayNumber === 'function'
                      ? getProgramOptionDayNumber(selectedOption) || '1'
                      : '1',
                }
              ),
            caution,
          }
        : null,
  };
}

function buildLogStartView() {
  const shell = document.getElementById('workout-not-started');
  const prefs = normalizeTrainingPreferences(profile);
  const prog = getActiveProgram();
  let state =
    getActiveProgramState() ||
    (prog?.getInitialState ? prog.getInitialState() : {});
  if (prefs.sportReadinessCheckEnabled && !pendingSportReadinessLevel)
    pendingSportReadinessLevel = 'none';
  const manualSportContext = getPendingSportReadinessContext();
  const sportContext = mergeSportPreferenceContext(
    getAutomaticSportPreferenceContext(schedule, workouts),
    manualSportContext
  );
  if (prog?.getSessionOptions) {
    try {
      prog.getSessionOptions(state, workouts, schedule);
    } catch (_error) {
      state = prog.getInitialState ? prog.getInitialState() : state;
    }
  }
  const decisionBundle = prog
    ? getWorkoutStartDecisionBundle({ prog, state, sportContext })
    : null;
  const rawOptions = prog?.getSessionOptions
    ? prog.getSessionOptions(state, workouts, schedule)
    : [];
  const options = prog
    ? applyPreferenceRecommendation(prog, rawOptions, state, sportContext)
    : [];
  const previousSelectedOption =
    typeof getSelectedWorkoutStartOption === 'function'
      ? getSelectedWorkoutStartOption()
      : '';
  const recommended = options.find((o) => o.isRecommended) || options[0];
  const hasMatch =
    previousSelectedOption &&
    options.some((o) => o.value === previousSelectedOption);
  const selectedValue = String(
    hasMatch
      ? previousSelectedOption
      : recommended?.value || options[0]?.value || ''
  );
  const selectedOption =
    (hasMatch
      ? options.find((o) => o.value === previousSelectedOption)
      : recommended) ||
    recommended ||
    null;
  if (typeof setSelectedWorkoutStartOption === 'function') {
    setSelectedWorkoutStartOption(selectedValue);
  }
  const startSnapshot =
    prog && selectedOption?.value !== undefined
      ? getWorkoutStartSnapshot({
          prog,
          state,
          selectedOption: selectedOption.value,
          sportContext,
          decisionBundle,
        })
      : null;
  const panels =
    prog && decisionBundle
      ? getLogStartTodayPanelsSnapshot(
          prog,
          state,
          decisionBundle.trainingDecision,
          decisionBundle,
          decisionBundle.planningContext,
          selectedOption
        )
      : { focus: null, decisionCard: null, warning: null };
  const sportLoadLevel = pendingSportReadinessLevel || 'none';
  const sportLoadTiming = getEffectivePendingSportReadinessTiming();
  const showTimingStep = sportLoadLevel !== 'none';
  const autoSelectedToday =
    showTimingStep &&
    sportLoadTiming === 'today' &&
    !pendingSportReadinessTimingTouched &&
    isTodayRegularSportDay();
  const timingTone = sportLoadLevel === 'heavy' ? 'warning' : 'info';
  const quickLogMeta = getSportQuickLogMeta();
  const simple =
    typeof isSimpleMode === 'function' && isSimpleMode(profile);
  return {
    labels: {
      trainingSession: i18nText('workout.training_session', 'Training Session'),
      startWorkout: simple
        ? i18nText('workout.simple.start', 'Start Workout')
        : i18nText('workout.start_workout', 'Start Workout'),
      day: i18nText('workout.day', 'Day'),
      warningTitle: i18nText('workout.warning.title', 'Training warning'),
      quickLogTitle: i18nText('workout.log_extra_sport', 'Log Extra Sport'),
      quickLogSubtitle: quickLogMeta.subtitle,
    },
    values: {
      simpleMode: simple,
      visible: !shell || shell.style.display !== 'none',
      quickLog: {
        icon: quickLogMeta.icon,
        title: i18nText('workout.log_extra_sport', 'Log Extra Sport'),
        subtitle: quickLogMeta.subtitle,
      },
      selectedOption: selectedValue,
      sessionCharacter:prog?.getSessionCharacter?prog.getSessionCharacter(selectedValue,state):null,
      preSessionNote:prog?.getPreSessionNote?prog.getPreSessionNote(selectedValue,state):null,
      options: options.map((o) => {
        const isSelected = String(o.value) === selectedValue;
        return {
          value: String(o.value || ''),
          dayNumber:
            typeof getProgramOptionDayNumber === 'function'
              ? getProgramOptionDayNumber(o)
              : String(o.value || ''),
          status: o.done
            ? i18nText('program.done', 'Done')
            : o.isRecommended
              ? simple
                ? i18nText('program.simple.next', 'Next')
                : i18nText('program.recommended', 'Recommended')
              : simple
                ? ''
                : i18nText('program.future', 'Upcoming'),
          statusIcon: o.done ? 'OK' : o.isRecommended ? '*' : '',
          selected: isSelected,
          done: o.done === true,
          upcoming: !o.done && !o.isRecommended,
        };
      }),
      preview: getLogStartPreviewSnapshot(prog, selectedOption, startSnapshot),
      focusPanel: simple ? null : panels.focus,
      decisionCard: simple ? null : panels.decisionCard,
      warningCard: panels.warning,
      sportReadiness: prefs.sportReadinessCheckEnabled
        ? {
            level: sportLoadLevel,
            timing: sportLoadTiming,
            showTimingStep,
            autoSelectedToday,
            timingTone,
            levelTitle: i18nText(
              'workout.sport_check.level_title',
              'How much sport load are you working around?'
            ),
            timingTitle: i18nText(
              'workout.sport_check.timing_title',
              'When is it?'
            ),
            title: i18nText(
              'workout.sport_check.inline_title',
              'Sport load check-in'
            ),
            subtitle: i18nText(
              'workout.sport_check.inline_sub',
              'Use sport load around today to guide the session recommendation.'
            ),
            levels: [
              {
                value: 'none',
                label: i18nText('workout.sport_check.none', 'No sport load'),
                tone: 'positive',
                active: sportLoadLevel === 'none',
              },
              {
                value: 'light',
                label: i18nText(
                  'workout.sport_check.light',
                  'Light sport load'
                ),
                tone: 'info',
                active: sportLoadLevel === 'light',
              },
              {
                value: 'heavy',
                label: i18nText(
                  'workout.sport_check.heavy',
                  'Heavy sport load'
                ),
                tone: 'warning',
                active: sportLoadLevel === 'heavy',
              },
            ],
            timings: [
              {
                value: 'today',
                label: i18nText('workout.sport_check.today', 'Today'),
                active: sportLoadTiming === 'today',
              },
              {
                value: 'yesterday',
                label: i18nText('workout.sport_check.yesterday', 'Yesterday'),
                active: sportLoadTiming === 'yesterday',
              },
              {
                value: 'tomorrow',
                label: i18nText('workout.sport_check.tomorrow', 'Tomorrow'),
                active: sportLoadTiming === 'tomorrow',
              },
              {
                value: 'both',
                label: i18nText('workout.sport_check.both', 'Both days'),
                active: sportLoadTiming === 'both',
              },
            ],
            hint: autoSelectedToday
              ? i18nText(
                  'workout.sport_check.today_hint',
                  'Today is marked as a regular sport day, so timing was preselected.'
                )
              : '',
          }
        : null,
      energyAssessment: simple ? null : {
        title: i18nText('workout.energy.title', 'How do you feel?'),
        options: [
          {value: 'low', label: i18nText('workout.energy.low', 'Low energy'), tone: 'caution', active: pendingEnergyLevel === 'low'},
          {value: 'normal', label: i18nText('workout.energy.normal', 'Normal'), tone: 'neutral', active: pendingEnergyLevel === 'normal'},
          {value: 'strong', label: i18nText('workout.energy.strong', 'Feeling strong'), tone: 'positive', active: pendingEnergyLevel === 'strong'},
        ],
      },
      bonusSession:
        window.BONUS_SESSION &&
        BONUS_SESSION.isBonusSessionAvailable(prog, state, workouts, schedule)
          ? BONUS_SESSION.getBonusSessionSnapshot(prog, state, workouts, schedule)
          : null,
    },
  };
}
let logActiveUiSignalToken = 0;
let pendingLogActiveUiSignals = {
  focusTarget: null,
  setSignal: null,
  collapseSignal: null,
};

function pushLogActiveView() {
  const bridge = getRuntimeBridge();
  if (!bridge || typeof bridge.setLogActiveView !== 'function') return;
  bridge.setLogActiveView(buildLogActiveView());
}

function isLogActiveIslandActive() {
  const bridge = getRuntimeBridge();
  return !!bridge && typeof bridge.setLogActiveView === 'function';
}

function notifyLogActiveIsland() {
  pushLogActiveView();
}

function nextLogActiveUiSignalToken() {
  logActiveUiSignalToken += 1;
  return logActiveUiSignalToken;
}

function queueLogActiveFocusTarget(inputId) {
  if (!inputId) return null;
  pendingLogActiveUiSignals = {
    ...pendingLogActiveUiSignals,
    focusTarget: {
      token: nextLogActiveUiSignalToken(),
      inputId: String(inputId),
    },
  };
  return pendingLogActiveUiSignals.focusTarget;
}

function clearLogActiveFocusTarget(token) {
  if (
    pendingLogActiveUiSignals.focusTarget &&
    pendingLogActiveUiSignals.focusTarget.token === token
  ) {
    pendingLogActiveUiSignals = {
      ...pendingLogActiveUiSignals,
      focusTarget: null,
    };
    pushLogActiveView();
  }
}

function queueLogActiveSetSignal(exerciseUiKey, setIndex, prEvent) {
  pendingLogActiveUiSignals = {
    ...pendingLogActiveUiSignals,
    setSignal: {
      token: nextLogActiveUiSignalToken(),
      exerciseUiKey,
      setIndex,
      isPr: !!prEvent,
    },
  };
  return pendingLogActiveUiSignals.setSignal;
}

function clearLogActiveSetSignal(token) {
  if (
    pendingLogActiveUiSignals.setSignal &&
    pendingLogActiveUiSignals.setSignal.token === token
  ) {
    pendingLogActiveUiSignals = {
      ...pendingLogActiveUiSignals,
      setSignal: null,
    };
    pushLogActiveView();
  }
}

function queueLogActiveCollapseSignal(exerciseUiKey) {
  pendingLogActiveUiSignals = {
    ...pendingLogActiveUiSignals,
    collapseSignal: {
      token: nextLogActiveUiSignalToken(),
      exerciseUiKey,
    },
  };
  return pendingLogActiveUiSignals.collapseSignal;
}

function clearLogActiveCollapseSignal(token) {
  if (
    pendingLogActiveUiSignals.collapseSignal &&
    pendingLogActiveUiSignals.collapseSignal.token === token
  ) {
    pendingLogActiveUiSignals = {
      ...pendingLogActiveUiSignals,
      collapseSignal: null,
    };
    pushLogActiveView();
  }
}

function getLogActiveUiSignalsSnapshot() {
  return {
    focusTarget: pendingLogActiveUiSignals.focusTarget
      ? { ...pendingLogActiveUiSignals.focusTarget }
      : null,
    setSignal: pendingLogActiveUiSignals.setSignal
      ? { ...pendingLogActiveUiSignals.setSignal }
      : null,
    collapseSignal: pendingLogActiveUiSignals.collapseSignal
      ? { ...pendingLogActiveUiSignals.collapseSignal }
      : null,
  };
}

function getLogActiveTimerText() {
  const elapsedSeconds = Math.max(0, getWorkoutElapsedSeconds());
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getLogActivePlanPanelSnapshot() {
  if (!activeWorkout) return null;
  const summary = getRunnerPlanSummary(activeWorkout);
  const elapsed = Math.floor(getWorkoutElapsedSeconds() / 60);
  const totalTrackedSets =
    (summary?.completedSets || 0) + (summary?.remainingSets || 0);
  const progressPercent = totalTrackedSets
    ? Math.round(((summary?.completedSets || 0) / totalTrackedSets) * 100)
    : 100;
  const nextTargetText = summary?.nextTarget
    ? `${summary.nextTarget.exerciseName} · ${i18nText('rpe.set', 'Set')} ${summary.nextTarget.setLabel}${summary.nextTarget.weight !== '' && summary.nextTarget.weight !== undefined ? ` · ${summary.nextTarget.weight}kg` : ''}${summary.nextTarget.reps !== '' && summary.nextTarget.reps !== undefined ? ` × ${summary.nextTarget.reps}` : ''}`
    : i18nText(
        'workout.runner.done',
        'Main work is done. You can finish here or wrap up optional work.'
      );
  return {
    kicker:
      summary?.kicker || i18nText('workout.runner.kicker', 'Session plan'),
    title: summary?.title || i18nText('common.session', 'Session'),
    copy: summary?.copy || '',
    progressPercent,
    completedSets: summary?.completedSets || 0,
    remainingSets: summary?.remainingSets || 0,
    elapsedMinutes: elapsed,
    nextTargetText,
    completedSetsText: i18nText(
      'workout.runner.completed',
      '{count} sets done',
      { count: summary?.completedSets || 0 }
    ),
    remainingSetsText: i18nText(
      'workout.runner.remaining',
      '{count} sets left',
      { count: summary?.remainingSets || 0 }
    ),
    elapsedText: i18nText('workout.runner.elapsed', '{count} min elapsed', {
      count: elapsed,
    }),
    nextText: i18nText('workout.runner.next', 'Next: {target}', {
      target: nextTargetText,
    }),
    finishPoint: summary?.finishPoint || null,
    adjustments: (summary?.adjustments || []).slice(-3).map((item) => ({
      label: item.label || getRunnerAdjustmentLabel(item),
    })),
    undoAvailable: getRunnerUndoAvailable(activeWorkout),
  };
}

function getLogActiveExerciseSnapshot(exercise, exerciseIndex) {
  const uiKey = ensureExerciseUiKey(exercise);
  const previousSets = getPreviousSets(exercise);
  const suggested = getSuggested(exercise);
  const counts = getExerciseCompletionCounts(exercise);
  const isComplete = isExerciseComplete(exercise);
  const isCollapsed = isExerciseCardCollapsed(exercise);
  return {
    uiKey,
    exerciseIndex,
    name: exercise.name,
    displayName: displayExerciseName(exercise.name),
    previousText: previousSets
      ? i18nText('workout.last_prefix', 'Last:') +
        ' ' +
        previousSets.map((set) => set.weight + 'kg×' + set.reps).join(', ')
      : i18nText('workout.no_previous_data', 'No previous data'),
    suggested: suggested || '',
    isComplete,
    isCollapsed,
    isAux: exercise.isAux === true,
    isAccessory: exercise.isAccessory === true,
    guideAvailable: !!getExerciseGuide(exercise),
    counts,
    setsId: getExerciseSetsId(exercise),
    collapsedSummary: {
      name: displayExerciseName(exercise.name),
      meta: i18nText(
        'workout.completed_sets',
        '{completed}/{total} sets done',
        { completed: counts.completed, total: counts.total }
      ),
      badge: i18nText('common.done', 'Done'),
    },
    sets: (exercise.sets || []).map((set, setIndex) => {
      const warmupsBefore = exercise.sets.filter(
        (row, idx) => idx < setIndex && row.isWarmup
      ).length;
      return {
        index: setIndex,
        label: set.isWarmup
          ? 'W'
          : set.isAmrap
            ? i18nText('workout.max_short', 'MAX')
            : String(setIndex + 1 - warmupsBefore),
        weight: set.weight ?? '',
        reps: set.isAmrap && set.reps === 'AMRAP' ? '' : (set.reps ?? ''),
        done: set.done === true,
        isWarmup: set.isWarmup === true,
        isAmrap: set.isAmrap === true,
        isPr: set.isPr === true,
        weightInputId: getSetInputId(uiKey, setIndex, 'weight'),
        repsInputId: getSetInputId(uiKey, setIndex, 'reps'),
      };
    }),
  };
}

function buildLogActiveView() {
  const shell = document.getElementById('workout-active');
  const title =
    activeWorkout?.programLabel || i18nText('common.session', 'Session');
  const sessionDescription = activeWorkout?.sessionDescription || '';
  const selectedRestDuration =
    typeof getSelectedRestDuration === 'function'
      ? getSelectedRestDuration()
      : restDuration || profile.defaultRest || 120;
  return {
    labels: {
      addExercise: i18nText('workout.add_exercise', 'Add Exercise'),
      restTimer: i18nText('workout.rest_timer', 'Rest timer'),
      finishSession: i18nText('workout.finish_session', 'Finish Session'),
      cancelSession: i18nText('workout.cancel_session', 'Discard Workout'),
      cancelConfirmTitle: i18nText('workout.cancel_session', 'Discard Workout'),
      cancelConfirmMessage: i18nText(
        'workout.discard_session',
        "Discard this in-progress workout? Sets won't be saved."
      ),
      lastBest: i18nText('workout.last_best', 'Last best: {weight}kg'),
      aux: i18nText('workout.aux', 'AUX'),
      back: i18nText('workout.back', 'BACK'),
      swap: i18nText('workout.swap', 'Swap'),
      swapBack: i18nText('workout.swap_back', 'Swap back exercise'),
      addSet: i18nText('workout.add_set', '+ Set'),
      removeExercise: i18nText('workout.remove_exercise', 'Remove exercise'),
      collapse: i18nText('workout.collapse', 'Minimize'),
      movementGuide: i18nText('guidance.title', 'Movement Guide'),
      weightPlaceholder: i18nText('workout.weight_placeholder', 'kg'),
      repsPlaceholder: i18nText('workout.reps_placeholder', 'reps'),
      repsHit: i18nText('workout.reps_hit', 'reps hit'),
      prBadge: i18nText('workout.pr_badge', 'NEW PR'),
      completedSets: i18nText('workout.runner.completed', '{count} sets done', {
        count: 0,
      }),
      remainingSets: i18nText('workout.runner.remaining', '{count} sets left', {
        count: 0,
      }),
      elapsed: i18nText('workout.runner.elapsed', '{count} min elapsed', {
        count: 0,
      }),
      next: i18nText('workout.runner.next', 'Next: {target}', { target: '' }),
      shorten: i18nText('workout.runner.shorten_btn', 'Shorten'),
      lighten: i18nText('workout.runner.lighten_btn', 'Go lighter'),
      undoAdjustment: i18nText('workout.runner.undo_btn', 'Undo adjustment'),
      restOptions: [
        { value: '60', label: '1 min' },
        { value: '90', label: '90s' },
        { value: '120', label: '2 min' },
        { value: '180', label: '3 min' },
        { value: '240', label: '4 min' },
        { value: '300', label: '5 min' },
        { value: '0', label: i18nText('common.off', 'Off') },
      ],
    },
    values: {
      visible: !!shell && shell.style.display !== 'none',
      title,
      description: sessionDescription
        ? i18nText('session.description', 'Session focus') +
          ': ' +
          sessionDescription
        : '',
      descriptionVisible: !!sessionDescription,
      timer: {
        text: getLogActiveTimerText(),
        seed: activeWorkout?.startTime || 0,
      },
      rest: {
        duration: String(selectedRestDuration),
      },
      planPanel: getLogActivePlanPanelSnapshot(),
      ui: getLogActiveUiSignalsSnapshot(),
      exercises: (activeWorkout?.exercises || []).map(
        (exercise, exerciseIndex) =>
          getLogActiveExerciseSnapshot(exercise, exerciseIndex)
      ),
    },
  };
}
window.getLogActiveTimerText = getLogActiveTimerText;
window.clearLogActiveFocusTarget = clearLogActiveFocusTarget;
window.clearLogActiveSetSignal = clearLogActiveSetSignal;
window.clearLogActiveCollapseSignal = clearLogActiveCollapseSignal;

function persistCurrentWorkoutDraft() {
  if (typeof persistActiveWorkoutDraft === 'function')
    persistActiveWorkoutDraft();
}

function clearCurrentWorkoutDraft() {
  if (typeof clearActiveWorkoutDraft === 'function') clearActiveWorkoutDraft();
}

function restoreActiveWorkoutDraft(draft, options) {
  const payload = draft && typeof draft === 'object' ? draft : null;
  const restoredWorkout = payload?.activeWorkout;
  if (
    !restoredWorkout ||
    typeof restoredWorkout !== 'object' ||
    !Array.isArray(restoredWorkout.exercises) ||
    !restoredWorkout.startTime
  ) {
    activeWorkout = null;
    return false;
  }
  if (typeof normalizeWorkoutRecord === 'function')
    normalizeWorkoutRecord(restoredWorkout);
  activeWorkout = {
    ...restoredWorkout,
    sessionSnapshot: normalizeWorkoutStartSnapshot(
      restoredWorkout.sessionSnapshot
    ),
    exercises: ensureWorkoutExerciseUiKeys(
      (restoredWorkout.exercises || []).map((ex) =>
        withResolvedExerciseId({
          ...ex,
          sets: Array.isArray(ex?.sets)
            ? ex.sets.map((set) => ({ ...set }))
            : [],
        })
      )
    ),
  };
  activeWorkout.rewardState = buildWorkoutRewardState(
    restoredWorkout.rewardState
  );
  rebuildActiveWorkoutRewardState();
  workoutStartSnapshotCache = normalizeWorkoutStartSnapshot(
    activeWorkout.sessionSnapshot
  );
  restDuration =
    parseInt(payload.restDuration, 10) || profile.defaultRest || 120;
  restTotal = parseInt(payload.restTotal, 10) || 0;
  restEndsAt = parseInt(payload.restEndsAt, 10) || 0;
  if (restEndsAt && restEndsAt <= Date.now()) {
    restEndsAt = 0;
    restTotal = 0;
    restSecondsLeft = 0;
  }
  startWorkoutTimer();
  if (restEndsAt) syncRestTimer();
  if (
    document.getElementById('workout-active') &&
    document.getElementById('workout-not-started')
  ) {
    resumeActiveWorkoutUI({ toast: false });
  } else {
    renderWorkoutTimer();
  }
  if (options?.toast !== false) {
    showToast(
      i18nText('workout.resumed', 'Resumed your in-progress workout.'),
      'var(--blue)'
    );
  }
  return true;
}

function resumeActiveWorkoutUI(options) {
  if (!activeWorkout) return false;
  ensureActiveWorkoutExerciseUiKeys();
  updateProgramDisplay();
  const isReactActive = isLogActiveIslandActive();
  const notStarted = document.getElementById('workout-not-started');
  const active = document.getElementById('workout-active');
  if (notStarted) notStarted.style.display = 'none';
  if (active) active.style.display = 'block';
  if (!isReactActive) {
    const titleEl = document.getElementById('active-session-title');
    if (titleEl)
      titleEl.textContent =
        activeWorkout.programLabel || i18nText('common.session', 'Session');
    const descEl = document.getElementById('active-session-description');
    if (descEl) {
      const prefix = i18nText('session.description', 'Session focus');
      const sessionDescription = activeWorkout.sessionDescription || '';
      descEl.textContent = sessionDescription
        ? prefix + ': ' + sessionDescription
        : '';
      descEl.style.display = sessionDescription ? '' : 'none';
    }
  }
  const restSelect = document.getElementById('rest-duration');
  if (restSelect)
    restSelect.value = String(
      typeof getSelectedRestDuration === 'function'
        ? getSelectedRestDuration()
        : restDuration || profile.defaultRest || 120
    );
  renderWorkoutTimer();
  if (!isReactActive) renderExercises();
  if (restEndsAt) {
    window.setRestBarActiveState?.(true);
    syncRestTimer();
  } else {
    window.setRestBarActiveState?.(false);
  }
  if (isReactActive) notifyLogActiveIsland();
  if (isLogStartIslandActive()) notifyLogStartIsland();
  if (options?.toast) {
    showToast(
      i18nText('workout.resumed', 'Resumed your in-progress workout.'),
      'var(--blue)'
    );
  }
  return true;
}

function resetNotStartedView() {
  if (activeWorkout) {
    resumeActiveWorkoutUI({ toast: false });
    return;
  }
  const prog = getActiveProgram();
  const prefs = normalizeTrainingPreferences(profile);
  const state = getActiveProgramState();
  const previousSelectedOption =
    typeof getSelectedWorkoutStartOption === 'function'
      ? getSelectedWorkoutStartOption()
      : '';
  if (prefs.sportReadinessCheckEnabled && !pendingSportReadinessLevel)
    pendingSportReadinessLevel = 'none';
  const decisionBundle = getWorkoutStartDecisionBundle({
    prog,
    state,
    sportContext: getPendingSportReadinessContext(),
  });
  const trainingDecision = decisionBundle.trainingDecision;
  const sportLoadLevel = pendingSportReadinessLevel || 'none';
  const sportLoadTiming = getEffectivePendingSportReadinessTiming();
  const showTimingStep = sportLoadLevel !== 'none';
  const autoSelectedToday =
    showTimingStep &&
    sportLoadTiming === 'today' &&
    !pendingSportReadinessTimingTouched &&
    isTodayRegularSportDay();
  const timingTone = sportLoadLevel === 'heavy' ? 'warning' : 'info';
  if (isLogStartIslandActive()) {
    if (typeof updateProgramDisplay === 'function') updateProgramDisplay();
    notifyLogStartIsland();
    return;
  }
  const sportCheckControls = prefs.sportReadinessCheckEnabled
    ? `<div class="sport-readiness-inline">
        <div class="sport-readiness-inline-header">
          <div class="sport-readiness-inline-title">${escapeHtml(i18nText('workout.sport_check.inline_title', 'Sport load check-in'))}</div>
          <div class="sport-readiness-inline-sub">${escapeHtml(i18nText('workout.sport_check.inline_sub', 'Use sport load around today to guide the session recommendation.'))}</div>
        </div>
        <div class="sport-readiness-step">
          <div class="sport-readiness-step-label">${escapeHtml(i18nText('workout.sport_check.level_title', 'How much sport load are you working around?'))}</div>
          <div class="sport-readiness-inline-grid sport-readiness-inline-grid-level">
            <button type="button" class="sport-readiness-chip sport-readiness-chip-positive" data-sport-check-kind="level" data-sport-check-option="none" onclick="setPendingSportReadinessLevel('none')">${escapeHtml(i18nText('workout.sport_check.none', 'No sport load'))}</button>
            <button type="button" class="sport-readiness-chip sport-readiness-chip-info" data-sport-check-kind="level" data-sport-check-option="light" onclick="setPendingSportReadinessLevel('light')">${escapeHtml(i18nText('workout.sport_check.light', 'Light sport load'))}</button>
            <button type="button" class="sport-readiness-chip sport-readiness-chip-warning" data-sport-check-kind="level" data-sport-check-option="heavy" onclick="setPendingSportReadinessLevel('heavy')">${escapeHtml(i18nText('workout.sport_check.heavy', 'Heavy sport load'))}</button>
          </div>
        </div>
        ${
          showTimingStep
            ? `<div class="sport-readiness-step">
          <div class="sport-readiness-step-label">${escapeHtml(i18nText('workout.sport_check.timing_title', 'When is it?'))}</div>
          <div class="sport-readiness-inline-grid sport-readiness-inline-grid-timing">
            <button type="button" class="sport-readiness-chip sport-readiness-chip-${timingTone}" data-sport-check-kind="timing" data-sport-check-option="today" onclick="setPendingSportReadinessTiming('today')">${escapeHtml(i18nText('workout.sport_check.today', 'Today'))}</button>
            <button type="button" class="sport-readiness-chip sport-readiness-chip-${timingTone}" data-sport-check-kind="timing" data-sport-check-option="yesterday" onclick="setPendingSportReadinessTiming('yesterday')">${escapeHtml(i18nText('workout.sport_check.yesterday', 'Yesterday'))}</button>
            <button type="button" class="sport-readiness-chip sport-readiness-chip-${timingTone}" data-sport-check-kind="timing" data-sport-check-option="tomorrow" onclick="setPendingSportReadinessTiming('tomorrow')">${escapeHtml(i18nText('workout.sport_check.tomorrow', 'Tomorrow'))}</button>
            <button type="button" class="sport-readiness-chip sport-readiness-chip-${timingTone}" data-sport-check-kind="timing" data-sport-check-option="both" onclick="setPendingSportReadinessTiming('both')">${escapeHtml(i18nText('workout.sport_check.both', 'Both days'))}</button>
          </div>
          ${autoSelectedToday ? `<div class="sport-readiness-inline-hint">${escapeHtml(i18nText('workout.sport_check.today_hint', 'Today is marked as a regular sport day, so timing was preselected.'))}</div>` : ''}
        </div>`
            : ''
        }
      </div>`
    : '';
  document.getElementById('workout-not-started').innerHTML = `
    <div class="workout-start-shell">
      <div id="program-week-display" hidden></div>
      <input type="hidden" id="program-day-select" value="${escapeHtml(previousSelectedOption)}">
      <input type="hidden" id="bonus-duration-select" value="${escapeHtml(typeof getSelectedBonusDuration === 'function' ? getSelectedBonusDuration() : 'standard')}">
      <div id="program-day-options" class="program-day-options"></div>
      <div id="program-warning-panel"></div>
      <div id="program-session-preview"></div>
      <div id="program-today-panel"></div>
      ${sportCheckControls}
      <div class="workout-start-footer">
        <button class="btn btn-primary cta-btn workout-start-cta" onclick="startWorkout()">${i18nText('workout.start_workout', 'Start Workout')}</button>
      </div>
      </div>`;
  syncWorkoutStartSelectionInputs();
  updateSportReadinessChoiceUI();
  updateProgramDisplay();
  if (isLogStartIslandActive()) notifyLogStartIsland();
}

function exerciseIdForName(name) {
  if (typeof window.resolveRegisteredExerciseId !== 'function')
    return null;
  return window.resolveRegisteredExerciseId(name) || null;
}

function getWorkoutExercise(input) {
  if (typeof window.getRegisteredExercise !== 'function') return null;
  return window.getRegisteredExercise(input) || null;
}

function getWorkoutExerciseMeta(input, locale) {
  if (typeof window.getExerciseMetadata !== 'function') return null;
  return window.getExerciseMetadata(input, locale) || null;
}

function getWorkoutExerciseDisplayName(input, locale) {
  if (typeof window.getExerciseDisplayName !== 'function')
    return String(input || '');
  return window.getExerciseDisplayName(input, locale) || String(input || '');
}

function getWorkoutExerciseGuidance(input, locale) {
  if (typeof window.getExerciseGuidanceFor !== 'function') return null;
  return window.getExerciseGuidanceFor(input, locale) || null;
}

function getWorkoutExerciseList(options) {
  if (typeof window.listRegisteredExercises !== 'function') return [];
  return window.listRegisteredExercises(options) || [];
}

function searchWorkoutExercises(query, filters) {
  if (typeof window.searchRegisteredExercises !== 'function') return [];
  return window.searchRegisteredExercises(query, filters) || [];
}

function registerWorkoutExercise(definition) {
  if (typeof window.registerCustomExercise !== 'function') return null;
  return window.registerCustomExercise(definition) || null;
}

function withResolvedExerciseId(ex) {
  if (!ex) return ex;
  const exerciseId = ex.exerciseId || exerciseIdForName(ex.name);
  return exerciseId ? { ...ex, exerciseId } : { ...ex, exerciseId: null };
}

function i18nText(key, fallback, params) {
  if (window.I18N && I18N.t) return I18N.t(key, params, fallback);
  return fallback;
}

function getTrainingToastColor(input) {
  const tone = input?.tone || 'neutral';
  if (tone === 'warning') return 'var(--orange)';
  if (tone === 'positive') return 'var(--green)';
  if (tone === 'info') return 'var(--blue)';
  return 'var(--muted)';
}

function arrayify(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function uniqueList(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function normalizeEnergyLevel(value) {
  return value === 'low' || value === 'strong' ? value : 'normal';
}

let pendingSportReadinessCallback = null;
let pendingSportCheckPromptState = null;
let pendingSummaryPromptState = null;
let pendingSportReadinessLevel = 'none';
let pendingSportReadinessTiming = 'none';
let pendingSportReadinessTimingTouched = false;
let pendingWorkoutStartOption = '';
let pendingBonusDuration = 'standard';
let pendingSessionMode = 'auto';
let pendingEnergyLevel = 'normal';
window.setPendingEnergyLevel = function(value) {
  pendingEnergyLevel = normalizeEnergyLevel(value);
  if (typeof setPendingSessionMode === 'function') {
    if (pendingEnergyLevel === 'low')
      setPendingSessionMode('light', { preserveEnergySync: true });
    else if (pendingEnergyLevel === 'strong')
      setPendingSessionMode('normal', { preserveEnergySync: true });
    else setPendingSessionMode('auto', { preserveEnergySync: true });
  }
  notifyLogStartIsland();
};

function syncWorkoutStartSelectionInputs() {
  const optionInput = document.getElementById('program-day-select');
  if (optionInput) optionInput.value = String(pendingWorkoutStartOption || '');
  const bonusInput = document.getElementById('bonus-duration-select');
  if (bonusInput) bonusInput.value = String(pendingBonusDuration || 'standard');
}

function getSelectedWorkoutStartOption() {
  const inputValue = document.getElementById('program-day-select')?.value;
  if (inputValue) {
    pendingWorkoutStartOption = String(inputValue);
    return pendingWorkoutStartOption;
  }
  return String(pendingWorkoutStartOption || '');
}

function setSelectedWorkoutStartOption(value) {
  pendingWorkoutStartOption = String(value || '');
  syncWorkoutStartSelectionInputs();
}

function getSelectedBonusDuration() {
  const inputValue = document.getElementById('bonus-duration-select')?.value;
  if (inputValue) {
    pendingBonusDuration = String(inputValue);
    return pendingBonusDuration;
  }
  return String(pendingBonusDuration || 'standard');
}

function setSelectedBonusDuration(value) {
  pendingBonusDuration = String(value || 'standard');
  syncWorkoutStartSelectionInputs();
  if (!activeWorkout) pushLogStartView();
  if (isLogStartIslandActive() && !activeWorkout) notifyLogStartIsland();
}

function notifySportCheckOverlayShell() {
  if (typeof window.syncWorkoutSessionBridge === 'function') {
    window.syncWorkoutSessionBridge();
  }
}

function notifySummaryOverlayShell() {
  if (typeof window.syncWorkoutSessionBridge === 'function') {
    window.syncWorkoutSessionBridge();
  }
}

function getSportCheckPromptSnapshot() {
  return pendingSportCheckPromptState
    ? { ...pendingSportCheckPromptState }
    : null;
}

function getSessionSummaryPromptSnapshot() {
  return pendingSummaryPromptState
    ? {
        ...pendingSummaryPromptState,
        stats: Array.isArray(pendingSummaryPromptState.stats)
          ? pendingSummaryPromptState.stats.map((stat) => ({ ...stat }))
          : [],
        feedbackOptions: Array.isArray(
          pendingSummaryPromptState.feedbackOptions
        )
          ? pendingSummaryPromptState.feedbackOptions.map((option) => ({
              ...option,
            }))
          : [],
        summaryData:
          pendingSummaryPromptState.summaryData &&
          typeof pendingSummaryPromptState.summaryData === 'object'
            ? { ...pendingSummaryPromptState.summaryData }
            : null,
      }
    : null;
}

window.getSelectedWorkoutStartOption = getSelectedWorkoutStartOption;
window.setSelectedWorkoutStartOption = setSelectedWorkoutStartOption;
window.getSelectedBonusDuration = getSelectedBonusDuration;
window.setSelectedBonusDuration = setSelectedBonusDuration;
window.getSportCheckPromptSnapshot = getSportCheckPromptSnapshot;
window.getSessionSummaryPromptSnapshot = getSessionSummaryPromptSnapshot;

const baseWorkoutSessionBridgeSync =
  typeof window.syncWorkoutSessionBridge === 'function'
    ? window.syncWorkoutSessionBridge
    : null;

window.syncWorkoutSessionBridge = function syncWorkoutSessionBridge() {
  if (typeof baseWorkoutSessionBridgeSync === 'function') {
    baseWorkoutSessionBridgeSync();
  }
  pushLogStartView();
  pushLogActiveView();
};

let workoutStartSnapshotCache = null;
let collapsedExerciseCardState = {};
let activeGuideExerciseKey = null;
let exerciseUiKeyCounter = 0;
let exerciseListInteractionsBound = false;

function prefersReducedMotionUI() {
  return (
    document.documentElement.classList.contains('test-env') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function getWorkoutExerciseRewardKeys(exercise) {
  if (typeof exerciseLookupKeys === 'function')
    return exerciseLookupKeys(exercise);
  const source = typeof exercise === 'string' ? { name: exercise } : exercise;
  const keys = [];
  if (source?.exerciseId) keys.push('id:' + source.exerciseId);
  if (source?.name)
    keys.push('name:' + String(source.name).trim().toLowerCase());
  return keys;
}

function getWorkoutExerciseRewardKey(exercise) {
  return getWorkoutExerciseRewardKeys(exercise)[0] || '';
}

function getSetRewardKey(exercise, setIndex) {
  return `${ensureExerciseUiKey(exercise)}:${setIndex}`;
}

function getCompletedSetPerformance(set) {
  if (!set?.done || set.isWarmup) return 0;
  const weight = parseFloat(set.weight);
  const reps = parseLoggedRepCount(set.reps);
  if (
    !Number.isFinite(weight) ||
    weight <= 0 ||
    !Number.isFinite(reps) ||
    reps <= 0
  )
    return 0;
  return weight * reps;
}

function buildWorkoutPrBaseline() {
  const baseline = {};
  workouts.forEach((workout) => {
    if (isSportWorkout(workout)) return;
    (workout.exercises || []).forEach((exercise) => {
      const score = Math.max(
        0,
        ...(exercise.sets || []).map(getCompletedSetPerformance)
      );
      if (!score) return;
      getWorkoutExerciseRewardKeys(exercise).forEach((key) => {
        baseline[key] = Math.max(baseline[key] || 0, score);
      });
    });
  });
  return baseline;
}

function normalizeDetectedPrs(entries) {
  return Array.isArray(entries)
    ? entries
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          setKey: String(entry.setKey || ''),
          exerciseKey: String(entry.exerciseKey || ''),
          exerciseName: String(entry.exerciseName || ''),
          weight: parseFloat(entry.weight) || 0,
          reps: parseLoggedRepCount(entry.reps) || 0,
          score: parseFloat(entry.score) || 0,
        }))
        .filter((entry) => entry.setKey && entry.exerciseKey && entry.score > 0)
    : [];
}

function buildWorkoutRewardState(baseState) {
  const normalized = {
    prBaseline: { ...(baseState?.prBaseline || buildWorkoutPrBaseline()) },
    prCurrentBest: { ...(baseState?.prCurrentBest || {}) },
    detectedPrs: normalizeDetectedPrs(baseState?.detectedPrs),
  };
  Object.keys(normalized.prBaseline).forEach((key) => {
    normalized.prCurrentBest[key] = Math.max(
      normalized.prCurrentBest[key] || 0,
      normalized.prBaseline[key] || 0
    );
  });
  return normalized;
}

function getActiveWorkoutRewardState() {
  if (!activeWorkout) return null;
  if (!activeWorkout.rewardState)
    activeWorkout.rewardState = buildWorkoutRewardState();
  return activeWorkout.rewardState;
}

function rebuildActiveWorkoutRewardState() {
  if (!activeWorkout) return null;
  const rewardState = buildWorkoutRewardState({
    prBaseline: activeWorkout.rewardState?.prBaseline,
  });
  (activeWorkout.exercises || []).forEach((exercise) => {
    const exerciseKey = getWorkoutExerciseRewardKey(exercise);
    const keys = getWorkoutExerciseRewardKeys(exercise);
    (exercise.sets || []).forEach((set, setIndex) => {
      if (!set?.done || set.isWarmup) return;
      const score = getCompletedSetPerformance(set);
      if (!score) return;
      const setKey = getSetRewardKey(exercise, setIndex);
      keys.forEach((key) => {
        rewardState.prCurrentBest[key] = Math.max(
          rewardState.prCurrentBest[key] || 0,
          score
        );
      });
      if (set.isPr) {
        rewardState.detectedPrs.push({
          setKey,
          exerciseKey,
          exerciseName: displayExerciseName(exercise.name),
          weight: parseFloat(set.weight) || 0,
          reps: parseLoggedRepCount(set.reps) || 0,
          score,
        });
      }
    });
  });
  activeWorkout.rewardState = rewardState;
  return rewardState;
}

function getWorkoutPrCount(workout) {
  return (workout?.rewardState?.detectedPrs || []).length;
}

function formatWorkoutWeight(value) {
  const rounded = Math.round((parseFloat(value) || 0) * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded.toFixed(0))
    : String(rounded.toFixed(1));
}

function formatWorkoutDuration(seconds) {
  const total = Math.max(0, Math.round(seconds) || 0);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins > 0) return `${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
  return `${secs}s`;
}

function formatWorkoutTonnage(tonnage) {
  const safe = Math.max(0, parseFloat(tonnage) || 0);
  return safe >= 1000
    ? `${(safe / 1000).toFixed(1)} t`
    : `${Math.round(safe)} kg`;
}

function detectSetPr(exercise, set, setIndex) {
  const rewardState = getActiveWorkoutRewardState();
  if (!rewardState) return null;
  const keys = getWorkoutExerciseRewardKeys(exercise);
  const exerciseKey = keys[0] || '';
  const score = getCompletedSetPerformance(set);
  if (!exerciseKey || !score) return null;
  const bestSoFar = keys.reduce(
    (max, key) =>
      Math.max(
        max,
        rewardState.prCurrentBest[key] || rewardState.prBaseline[key] || 0
      ),
    0
  );
  if (score <= bestSoFar) return null;
  const setKey = getSetRewardKey(exercise, setIndex);
  const event = {
    setKey,
    exerciseKey,
    exerciseName: displayExerciseName(exercise.name),
    weight: parseFloat(set.weight) || 0,
    reps: parseLoggedRepCount(set.reps) || 0,
    score,
  };
  set.isPr = true;
  keys.forEach((key) => {
    rewardState.prCurrentBest[key] = score;
  });
  rewardState.detectedPrs = rewardState.detectedPrs.filter(
    (entry) => entry.setKey !== setKey
  );
  rewardState.detectedPrs.push(event);
  return event;
}

function clearSetPr(exercise, set, setIndex) {
  if (set) set.isPr = false;
  const rewardState = getActiveWorkoutRewardState();
  if (!rewardState) return;
  const setKey = getSetRewardKey(exercise, setIndex);
  rewardState.detectedPrs = rewardState.detectedPrs.filter(
    (entry) => entry.setKey !== setKey
  );
  rebuildActiveWorkoutRewardState();
}

function ensureSetPrBadge(row) {
  const actionCell = row?.querySelector('.set-action-cell');
  if (!actionCell) return null;
  let badge = actionCell.querySelector('.set-pr-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'set-pr-badge';
    badge.textContent = i18nText('workout.pr_badge', 'NEW PR');
    actionCell.appendChild(badge);
  }
  actionCell.classList.add('has-pr');
  return badge;
}

function playSetPrCelebration(row, check, prEvent) {
  if (!row || !check || !prEvent) return;
  const badge = ensureSetPrBadge(row);
  row.classList.add('set-pr-celebration');
  check.classList.add('set-pr-highlight');
  requestAnimationFrame(() => badge?.classList.add('is-visible'));
  if (isLogActiveIslandActive()) notifyLogActiveIsland();
  spawnForgeEmbers(check, {
    colors: ['#ffd700', '#ffec8b', '#f5c842', '#fff8dc'],
    count: 5,
    distanceMin: 24,
    distanceMax: 34,
    sizeMin: 3,
    sizeMax: 5,
  });
  tryHaptic([20, 40, 20, 40, 80]);
  showToast(
    i18nText('workout.pr_toast', 'New PR! {name} {weight}kg x {reps}', {
      name: prEvent.exerciseName,
      weight: formatWorkoutWeight(prEvent.weight),
      reps: prEvent.reps,
    }),
    'var(--yellow)'
  );
  window.setTimeout(() => {
    row.classList.remove('set-pr-celebration');
    check.classList.remove('set-pr-highlight');
  }, 900);
}

function createExerciseUiKey() {
  exerciseUiKeyCounter += 1;
  return `exercise-ui-${Date.now().toString(36)}-${exerciseUiKeyCounter.toString(36)}`;
}

function ensureExerciseUiKey(exercise) {
  if (!exercise) return null;
  if (!exercise.uiKey) exercise.uiKey = createExerciseUiKey();
  return exercise.uiKey;
}

function ensureWorkoutExerciseUiKeys(exercises) {
  if (!Array.isArray(exercises)) return [];
  exercises.forEach(ensureExerciseUiKey);
  return exercises;
}

function ensureActiveWorkoutExerciseUiKeys() {
  return ensureWorkoutExerciseUiKeys(activeWorkout?.exercises);
}

function getExerciseStateKey(exercise) {
  return ensureExerciseUiKey(exercise);
}

function getExerciseIndexByUiKey(uiKey) {
  ensureActiveWorkoutExerciseUiKeys();
  if (!activeWorkout?.exercises?.length) return -1;
  return activeWorkout.exercises.findIndex(
    (exercise) => exercise.uiKey === uiKey
  );
}

function getExerciseByUiKey(uiKey) {
  const index = getExerciseIndexByUiKey(uiKey);
  return index >= 0 ? activeWorkout.exercises[index] : null;
}

function resetActiveWorkoutUIState() {
  collapsedExerciseCardState = {};
  activeGuideExerciseKey = null;
  document.getElementById('exercise-guide-modal')?.classList.remove('active');
}

function isExerciseComplete(exercise) {
  return (
    Array.isArray(exercise?.sets) &&
    exercise.sets.length > 0 &&
    exercise.sets.every((set) => set.done === true)
  );
}

function getExerciseCompletionCounts(exercise) {
  const total = Array.isArray(exercise?.sets) ? exercise.sets.length : 0;
  const completed = Array.isArray(exercise?.sets)
    ? exercise.sets.filter((set) => set.done === true).length
    : 0;
  return { completed, total };
}

function isExerciseCardCollapsed(exercise) {
  const stateKey = getExerciseStateKey(exercise);
  if (!stateKey) return false;
  if (!isExerciseComplete(exercise)) {
    delete collapsedExerciseCardState[stateKey];
    return false;
  }
  if (!(stateKey in collapsedExerciseCardState))
    collapsedExerciseCardState[stateKey] = true;
  return collapsedExerciseCardState[stateKey] !== false;
}

function setExerciseCardCollapsed(exercise, collapsed) {
  const stateKey = getExerciseStateKey(exercise);
  if (!stateKey) return;
  if (!isExerciseComplete(exercise)) {
    delete collapsedExerciseCardState[stateKey];
    return;
  }
  collapsedExerciseCardState[stateKey] = collapsed;
}

function isLowerBodyExercise(ex) {
  const meta = getWorkoutExerciseMeta(ex?.exerciseId || ex?.name || ex);
  if (!meta) return false;
  const groups = new Set(meta.displayMuscleGroups || []);
  return (
    groups.has('quads') ||
    groups.has('hamstrings') ||
    groups.has('glutes') ||
    groups.has('calves')
  );
}

function getSportStressLevel(sportContext) {
  const signal = sportContext?.legsStress || 'none';
  if (signal === 'both') return 3;
  if (signal === 'today') return 2;
  if (signal === 'yesterday') return 2;
  if (signal === 'tomorrow') return 1;
  return 0;
}

function isTodayRegularSportDay() {
  return (
    Array.isArray(schedule?.sportDays) &&
    schedule.sportDays.includes(new Date().getDay())
  );
}

function getDefaultSportReadinessTiming(level) {
  if ((level || 'none') === 'none') return 'none';
  return isTodayRegularSportDay() ? 'today' : 'none';
}

function getEffectivePendingSportReadinessTiming() {
  const level = pendingSportReadinessLevel || 'none';
  if (level === 'none') return 'none';
  if (pendingSportReadinessTiming && pendingSportReadinessTiming !== 'none')
    return pendingSportReadinessTiming;
  return pendingSportReadinessTimingTouched
    ? 'none'
    : getDefaultSportReadinessTiming(level);
}

function buildSportReadinessContext(level, timing) {
  const nextLevel = level || 'none';
  const nextTiming = nextLevel === 'none' ? 'none' : timing || 'none';
  if (nextLevel === 'none' || nextTiming === 'none') return null;
  return {
    sportLoadLevel: nextLevel,
    legsStress: nextTiming,
    checkedAt: new Date().toISOString(),
    sportName:
      (schedule?.sportName || getDefaultSportName()).trim() ||
      getDefaultSportName(),
  };
}

function getPendingSportReadinessContext() {
  const prefs = normalizeTrainingPreferences(profile);
  if (!prefs.sportReadinessCheckEnabled) return null;
  return buildSportReadinessContext(
    pendingSportReadinessLevel || 'none',
    getEffectivePendingSportReadinessTiming()
  );
}

function updateSportReadinessChoiceUI() {
  if (isLogStartIslandActive() && !activeWorkout) {
    notifyLogStartIsland();
    return;
  }
  const level = pendingSportReadinessLevel || 'none';
  const timing = getEffectivePendingSportReadinessTiming();
  document
    .querySelectorAll('[data-sport-check-kind="level"]')
    .forEach((btn) => {
      btn.classList.toggle(
        'active',
        btn.getAttribute('data-sport-check-option') === level
      );
    });
  document
    .querySelectorAll('[data-sport-check-kind="timing"]')
    .forEach((btn) => {
      btn.classList.toggle(
        'active',
        btn.getAttribute('data-sport-check-option') === timing
      );
    });
}

function setPendingSportReadinessLevel(level) {
  pendingSportReadinessLevel = level || 'none';
  if (
    pendingSportReadinessLevel !== 'none' &&
    (!pendingSportReadinessTimingTouched ||
      !pendingSportReadinessTiming ||
      pendingSportReadinessTiming === 'none')
  ) {
    pendingSportReadinessTiming = getDefaultSportReadinessTiming(
      pendingSportReadinessLevel
    );
  }
  resetNotStartedView();
}

function setPendingSportReadinessTiming(timing) {
  pendingSportReadinessTiming = timing || 'none';
  pendingSportReadinessTimingTouched = true;
  resetNotStartedView();
}

function setPendingSportReadiness(signal) {
  const legacySignal = signal || 'none';
  if (legacySignal === 'none') {
    pendingSportReadinessLevel = 'none';
    pendingSportReadinessTiming = 'none';
    pendingSportReadinessTimingTouched = false;
  } else {
    pendingSportReadinessLevel = 'heavy';
    pendingSportReadinessTiming = legacySignal;
    pendingSportReadinessTimingTouched = true;
  }
  resetNotStartedView();
}

function cloneTrainingDecision(decision) {
  if (!decision || typeof decision !== 'object') return decision || null;
  return {
    ...decision,
    reasonCodes: [...arrayify(decision.reasonCodes)],
    restrictionFlags: [...arrayify(decision.restrictionFlags)],
  };
}

function isProgramBlockDeload(prog, state) {
  const blockInfo =
    typeof prog?.getBlockInfo === 'function'
      ? prog.getBlockInfo(state || {})
      : null;
  return !!blockInfo?.isDeload;
}

function normalizeSessionMode(mode) {
  return mode === 'normal' || mode === 'light' || mode === 'auto'
    ? mode
    : 'auto';
}

function isLightTrainingAction(action) {
  return action === 'train_light' || action === 'deload';
}

function getProgramRecommendedSessionMode(prog, state, planningContext) {
  if (typeof prog?.getSessionModeRecommendation === 'function') {
    const mode = prog.getSessionModeRecommendation(
      state || {},
      planningContext || null
    );
    return mode === 'light' ? 'light' : 'normal';
  }
  return 'normal';
}

function getRecommendedSessionMode(prog, state, decision, planningContext) {
  if (isLightTrainingAction(decision?.action)) return 'light';
  return getProgramRecommendedSessionMode(prog, state, planningContext);
}

function syncPendingSessionMode(recommendedSessionMode) {
  pendingSessionMode = normalizeSessionMode(pendingSessionMode);
  if (recommendedSessionMode !== 'light' && pendingSessionMode === 'light')
    return pendingSessionMode;
  return pendingSessionMode;
}

function resolveEffectiveSessionMode(
  selectedSessionMode,
  recommendedSessionMode
) {
  const selected = normalizeSessionMode(selectedSessionMode);
  if (selected === 'light') return 'light';
  if (selected === 'normal') return 'normal';
  return recommendedSessionMode === 'light' ? 'light' : 'normal';
}

function applySessionModeToDecision(decision, effectiveSessionMode) {
  const base = cloneTrainingDecision(decision) || {};
  if (effectiveSessionMode === 'normal' && isLightTrainingAction(base.action)) {
    return {
      ...base,
      action: 'train',
      autoregulationLevel: 'normal',
    };
  }
  if (
    effectiveSessionMode === 'light' &&
    !isLightTrainingAction(base.action) &&
    base.action !== 'rest' &&
    base.action !== 'shorten'
  ) {
    return {
      ...base,
      action: 'train_light',
      autoregulationLevel: 'light',
    };
  }
  return base;
}

function getWorkoutStartDecisionBundle(input) {
  const next = input || {};
  const prog = next.prog || getActiveProgram();
  const state = next.state || getActiveProgramState();
  const energyLevel = normalizeEnergyLevel(next.energyLevel || pendingEnergyLevel);
  const sportContext =
    'sportContext' in next
      ? next.sportContext
      : getPendingSportReadinessContext();
  const planningContext =
    typeof buildPlanningContext === 'function'
      ? buildPlanningContext({
          profile,
          schedule,
          workouts,
          activeProgram: prog,
          activeProgramState: state,
          fatigue:
            typeof computeFatigue === 'function' ? computeFatigue() : null,
          sportContext,
        })
      : null;
  const trainingDecision =
    typeof getTodayTrainingDecision === 'function'
      ? getTodayTrainingDecision(planningContext)
      : null;
  const recommendedSessionMode = getRecommendedSessionMode(
    prog,
    state,
    trainingDecision,
    planningContext
  );
  let selectedSessionMode = syncPendingSessionMode(recommendedSessionMode);
  if (energyLevel === 'low') selectedSessionMode = 'light';
  else if (energyLevel === 'strong') selectedSessionMode = 'normal';
  const effectiveSessionMode = resolveEffectiveSessionMode(
    selectedSessionMode,
    recommendedSessionMode
  );
  const effectiveDecision = applySessionModeToDecision(
    trainingDecision,
    effectiveSessionMode
  );
  const sportAwareLowerBody =
    !!effectiveDecision?.restrictionFlags?.includes('avoid_heavy_legs');
  return {
    planningContext,
    trainingDecision,
    recommendedSessionMode,
    selectedSessionMode,
    effectiveSessionMode,
    energyLevel,
    sportAwareLowerBody,
    effectiveDecision,
    sportContext,
  };
}

function getProgramSessionBuildContext(input) {
  const next = input || {};
  const bundle = next.sessionModeBundle || {};
  const energyLevel = normalizeEnergyLevel(
    next.energyLevel || bundle.energyLevel || pendingEnergyLevel
  );
  const selectedSessionMode = normalizeSessionMode(
    next.selectedSessionMode || bundle.selectedSessionMode || 'auto'
  );
  const effectiveSessionMode = resolveEffectiveSessionMode(
    next.effectiveSessionMode ||
      bundle.effectiveSessionMode ||
      selectedSessionMode,
    bundle.recommendedSessionMode || 'normal'
  );
  return {
    preview: !!next.preview,
    energyLevel,
    energyBoost: energyLevel === 'strong',
    sessionMode: selectedSessionMode,
    effectiveSessionMode: effectiveSessionMode === 'light' ? 'light' : 'normal',
    sportAwareLowerBody:
      bundle.sportAwareLowerBody === true || next.sportAwareLowerBody === true,
  };
}

function getProgramSessionStateForBuild(prog, state, buildContext) {
  if (!prog || !state || !buildContext) return state;
  const week = parseInt(state.week, 10);
  if (
    buildContext.effectiveSessionMode !== 'normal' ||
    !Number.isFinite(week) ||
    week <= 1
  )
    return state;
  const blockInfo =
    typeof prog.getBlockInfo === 'function' ? prog.getBlockInfo(state) : null;
  if (!blockInfo?.isDeload) return state;
  return {
    ...state,
    week: Math.max(1, week - 1),
  };
}

function setPendingSessionMode(mode, options) {
  pendingSessionMode = normalizeSessionMode(mode);
  if (!options?.preserveEnergySync) {
    pendingEnergyLevel = pendingSessionMode === 'light' ? 'low' : 'normal';
  }
  if (typeof updateProgramDisplay === 'function') updateProgramDisplay();
}

function setPendingWorkoutStartOverride(mode) {
  setPendingSessionMode(mode === 'normal' ? 'normal' : 'auto');
}

function showSportReadinessCheck(callback) {
  pendingSportReadinessCallback = callback;
  const sportLabel = displaySportName(
    (schedule?.sportName || getDefaultSportName()).trim() ||
      getDefaultSportName()
  );
  pendingSportCheckPromptState = {
    open: true,
    title: i18nText('workout.sport_check.title', 'Sport check-in'),
    subtitle: i18nText(
      'workout.sport_check.sub',
      'Have you had a leg-heavy {sport} session yesterday, or do you have one tomorrow?',
      { sport: sportLabel.toLowerCase() }
    ),
  };
  notifySportCheckOverlayShell();
}

function selectSportReadiness(signal) {
  pendingSportCheckPromptState = null;
  notifySportCheckOverlayShell();
  setPendingSportReadiness(signal);
  const cb = pendingSportReadinessCallback;
  pendingSportReadinessCallback = null;
  if (cb) cb(getPendingSportReadinessContext());
}

function cancelSportReadinessCheck() {
  pendingSportCheckPromptState = null;
  notifySportCheckOverlayShell();
  pendingSportReadinessCallback = null;
}

function cloneWorkoutExercises(exercises) {
  return ensureWorkoutExerciseUiKeys(
    (exercises || []).map((ex) => ({
      ...ex,
      sets: Array.isArray(ex?.sets)
        ? ex.sets.map((set) => ({ ...set }))
        : ex?.sets,
    }))
  );
}

function cloneWorkoutStartSnapshot(snapshot) {
  return snapshot && typeof snapshot === 'object' ? cloneJson(snapshot) : null;
}

function normalizeWorkoutStartSnapshot(snapshot) {
  const next = cloneWorkoutStartSnapshot(snapshot);
  if (!next) return null;
  next.programId = String(next.programId || '').trim();
  next.selectedOption = String(next.selectedOption || '');
  next.signature = String(next.signature || '');
  next.buildContext =
    next.buildContext && typeof next.buildContext === 'object'
      ? next.buildContext
      : {};
  next.buildState =
    next.buildState && typeof next.buildState === 'object'
      ? next.buildState
      : {};
  next.trainingDecision = cloneTrainingDecision(next.trainingDecision);
  next.effectiveDecision = cloneTrainingDecision(next.effectiveDecision);
  next.exercises = cloneWorkoutExercises(
    (next.exercises || []).map(withResolvedExerciseId)
  );
  next.programLabel = String(next.programLabel || '');
  next.sessionDescription = String(next.sessionDescription || '');
  next.changes = Array.isArray(next.changes)
    ? next.changes.filter(Boolean)
    : [];
  next.equipmentHint = String(next.equipmentHint || '');
  next.commentary = next.commentary ? cloneJson(next.commentary) : undefined;
  return next;
}

function getCachedWorkoutStartSnapshot() {
  return normalizeWorkoutStartSnapshot(workoutStartSnapshotCache);
}

function clearWorkoutStartSnapshot() {
  workoutStartSnapshotCache = null;
}

function getWorkoutRuntime() {
  const runtime = window.__IRONFORGE_WORKOUT_RUNTIME__;
  if (!runtime) {
    throw new Error('Workout runtime bridge is not installed');
  }
  return runtime;
}

function getWorkoutStartSnapshotSignature(input) {
  return getWorkoutRuntime().getWorkoutStartSnapshotSignature(
    {
      ...(input || {}),
      profile,
      pendingSessionMode,
      pendingEnergyLevel,
    },
    {
      normalizeTrainingPreferences,
      getProfile: () => profile,
      getActiveProgram,
      getActiveProgramState,
      normalizeEnergyLevel,
    }
  );
}

function buildWorkoutStartSnapshot(input) {
  return getWorkoutRuntime().buildWorkoutStartSnapshot(
    {
      ...(input || {}),
      profile,
    },
    {
      getProfile: () => profile,
      getActiveProgram,
      getActiveProgramState,
      getWorkoutStartDecisionBundle,
      getProgramSessionBuildContext,
      getProgramSessionStateForBuild,
      cloneWorkoutExercises,
      withResolvedExerciseId,
      applyTrainingPreferencesToExercises,
      normalizeTrainingPreferences,
      injectWarmupSets,
    }
  );
}

function getWorkoutStartSnapshot(input) {
  const signature = getWorkoutStartSnapshotSignature(input);
  if (workoutStartSnapshotCache?.signature === signature) {
    return getCachedWorkoutStartSnapshot();
  }
  const snapshot = buildWorkoutStartSnapshot(input);
  workoutStartSnapshotCache = snapshot;
  return getCachedWorkoutStartSnapshot();
}

function getCompletedSetCount(exercise) {
  return Array.isArray(exercise?.sets)
    ? exercise.sets.filter((set) => set.done && !set.isWarmup).length
    : 0;
}

function getRemainingSetCount(exercise) {
  return Array.isArray(exercise?.sets)
    ? exercise.sets.filter((set) => !set.done && !set.isWarmup).length
    : 0;
}

function getWorkoutRemainingWorkSets() {
  if (!activeWorkout?.exercises) return 0;
  return activeWorkout.exercises.reduce(
    (sum, exercise) => sum + getRemainingSetCount(exercise),
    0
  );
}

function getWorkoutCompletedWorkSets() {
  if (!activeWorkout?.exercises) return 0;
  return activeWorkout.exercises.reduce(
    (sum, exercise) => sum + getCompletedSetCount(exercise),
    0
  );
}

function getExercisePriority(exercise) {
  if (exercise?.isAccessory) return 1;
  if (exercise?.isAux) return 2;
  return 3;
}

function getActiveWorkoutNextTarget() {
  if (!activeWorkout?.exercises) return null;
  for (
    let exerciseIndex = 0;
    exerciseIndex < activeWorkout.exercises.length;
    exerciseIndex++
  ) {
    const exercise = activeWorkout.exercises[exerciseIndex];
    for (
      let setIndex = 0;
      setIndex < (exercise.sets || []).length;
      setIndex++
    ) {
      const set = exercise.sets[setIndex];
      if (set.done || set.isWarmup) continue;
      const warmupsBefore = exercise.sets.filter(
        (item, idx) => idx < setIndex && item.isWarmup
      ).length;
      const setLabel = set.isAmrap
        ? i18nText('workout.max_short', 'MAX')
        : String(setIndex + 1 - warmupsBefore);
      return {
        exerciseIndex,
        setIndex,
        exerciseName: displayExerciseName(exercise.name),
        setLabel,
        reps: set.reps,
        weight: set.weight,
      };
    }
  }
  return null;
}

function getRemainingWorkExerciseEntries(workoutLike) {
  if (!workoutLike?.exercises) return [];
  return workoutLike.exercises
    .map((exercise, exerciseIndex) => ({
      exercise,
      exerciseIndex,
      remainingSets: getRemainingSetCount(exercise),
      priority: getExercisePriority(exercise),
    }))
    .filter((item) => item.remainingSets > 0);
}

function getActiveWorkoutFinishPoint(workoutLike) {
  const activeLike = workoutLike || activeWorkout;
  const remainingEntries = getRemainingWorkExerciseEntries(activeLike);
  if (!remainingEntries.length) return null;
  const decision = activeLike?.planningDecision || {};
  const nextTarget = getActiveWorkoutNextTarget();
  const currentEntry = nextTarget
    ? remainingEntries.find(
        (item) => item.exerciseIndex === nextTarget.exerciseIndex
      )
    : remainingEntries[0];
  const essentialEntries = remainingEntries.filter(
    (item) => item.priority >= 2
  );
  const targetEntry =
    (essentialEntries.length
      ? essentialEntries[essentialEntries.length - 1]
      : remainingEntries[0]) || currentEntry;
  const sportAware = decision.restrictionFlags?.includes('avoid_heavy_legs');
  if (!targetEntry) return null;
  if (
    remainingEntries.length === 1 ||
    targetEntry.exerciseIndex === currentEntry?.exerciseIndex
  ) {
    return {
      title: i18nText(
        sportAware
          ? 'workout.runner.sport_finish_title'
          : 'workout.runner.stop_after_this',
        sportAware
          ? 'Good finish point after this lift'
          : 'You can stop after this lift'
      ),
      copy: i18nText(
        sportAware
          ? 'workout.runner.sport_finish_copy'
          : 'workout.runner.stop_after_this_copy',
        sportAware
          ? 'Sport load is high enough that finishing after this lift is a smart call today.'
          : 'Once this lift is done, you have already kept the high-value work in the session.'
      ),
    };
  }
  const targetName = displayExerciseName(targetEntry.exercise?.name || '');
  return {
    title: i18nText(
      'workout.runner.stop_after_target',
      'You can stop after {target}',
      { target: targetName }
    ),
    copy: i18nText(
      sportAware
        ? 'workout.runner.sport_finish_copy'
        : 'workout.runner.stop_after_target_copy',
      sportAware
        ? 'Sport load is high enough that ending after the key work is a smart call today.'
        : 'That leaves the important work in place and turns the rest into optional volume.'
    ),
  };
}

function getLastWorkSetIndex(exercise) {
  if (!exercise?.sets?.length) return -1;
  for (let index = exercise.sets.length - 1; index >= 0; index--) {
    if (!exercise.sets[index]?.isWarmup) return index;
  }
  return -1;
}

function shouldPromptForSetRIR(exercise, setIndex) {
  if ((activeWorkout?.programMode || 'sets') !== 'rir') return false;
  if (!exercise || exercise.isAccessory) return false;
  return setIndex === getLastWorkSetIndex(exercise);
}

function showSetRIRPrompt(exerciseIndex, setIndex) {
  const exercise = activeWorkout?.exercises?.[exerciseIndex];
  const set = exercise?.sets?.[setIndex];
  if (!exercise || !set) return;
  const exerciseName = displayExerciseName(exercise.name);
  const currentValue =
    set.rir !== undefined && set.rir !== null && set.rir !== ''
      ? String(set.rir)
      : '';
  const options = ['0', '1', '2', '3', '4', '5+'];
  const buttons = options
    .map((value) => {
      const normalizedValue = value === '5+' ? '5' : value;
      const isActive = currentValue === normalizedValue;
      return `<button class="btn btn-secondary${isActive ? ' active' : ''}" type="button" data-custom-modal-action="apply-set-rir" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}" data-rir-value="${escapeHtml(normalizedValue)}">${escapeHtml(value)}</button>`;
    })
    .join('');
  showCustomModal(
    escapeHtml(i18nText('workout.rir_prompt_title', 'Last set check-in')),
    `<div style="font-size:13px;line-height:1.5;color:var(--muted);margin-bottom:12px">${escapeHtml(i18nText('workout.rir_prompt_body', 'How many reps did you still have left after the last work set of {exercise}?', { exercise: exerciseName }))}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${buttons}</div>
    <button class="btn btn-secondary" style="margin-top:12px;width:100%" type="button" data-custom-modal-action="skip-set-rir">${escapeHtml(i18nText('workout.rir_prompt_skip', 'Skip for now'))}</button>`
  );
}

function applySetRIR(exerciseIndex, setIndex, rirValue) {
  const set = activeWorkout?.exercises?.[exerciseIndex]?.sets?.[setIndex];
  if (!set) return;
  set.rir = rirValue;
  closeCustomModal();
  showToast(i18nText('workout.rir_saved', 'RIR saved'), 'var(--blue)');
}

function skipSetRIRPrompt() {
  closeCustomModal();
}

function trimExerciseRemainingSets(exercise, keepUndoneCount) {
  if (!Array.isArray(exercise?.sets)) return false;
  const nextSets = [];
  let keptUndone = 0;
  let changed = false;
  exercise.sets.forEach((set) => {
    if (set.done || set.isWarmup) {
      nextSets.push(set);
      return;
    }
    if (keptUndone < keepUndoneCount) {
      nextSets.push(set);
      keptUndone++;
      return;
    }
    changed = true;
  });
  if (changed) exercise.sets = nextSets;
  return changed;
}

function reduceRemainingSetTarget(set) {
  if (!set || set.done || set.isWarmup) return false;
  const numericReps = parseLoggedRepCount(set.reps);
  if (Number.isFinite(numericReps) && numericReps > 3) {
    set.reps = Math.max(3, numericReps - 1);
  }
  const numericWeight = parseFloat(set.weight);
  if (Number.isFinite(numericWeight) && numericWeight > 0) {
    const rounding = getCurrentWorkoutRounding();
    set.weight = Math.max(
      0,
      Math.round((numericWeight * 0.95) / rounding) * rounding
    );
    return true;
  }
  return Number.isFinite(numericReps) && numericReps > 3;
}

function dropTrailingUnstartedExercise(exercises) {
  if (!Array.isArray(exercises) || exercises.length <= 1) return false;
  for (let index = exercises.length - 1; index >= 0; index--) {
    const exercise = exercises[index];
    const hasDoneWork =
      Array.isArray(exercise?.sets) &&
      exercise.sets.some((set) => set.done && !set.isWarmup);
    const hasUndoneWork =
      Array.isArray(exercise?.sets) &&
      exercise.sets.some((set) => !set.done && !set.isWarmup);
    if (hasDoneWork || !hasUndoneWork) continue;
    exercises.splice(index, 1);
    return true;
  }
  return false;
}

function cleanupAdjustedWorkoutExercises(exercises) {
  return (exercises || []).filter((exercise) => {
    const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
    if (!sets.length) return false;
    const hasUndoneWork = sets.some((set) => !set.done && !set.isWarmup);
    const hasCompletedWork = sets.some((set) => set.done && !set.isWarmup);
    const hasWarmupsOnly = sets.every((set) => set.isWarmup);
    if (hasWarmupsOnly) return false;
    return hasUndoneWork || hasCompletedWork;
  });
}

function getExerciseMinimumWorkSetTarget(exercise, mode) {
  if (mode === 'lighten') {
    if (exercise.isAccessory) return 1;
    if (exercise.isAux) return 1;
    return 2;
  }
  return 0;
}

function trimExerciseToWorkSetFloor(exercise, mode) {
  const minimumTotal = getExerciseMinimumWorkSetTarget(exercise, mode);
  const completed = getCompletedSetCount(exercise);
  const keepUndone = Math.max(0, minimumTotal - completed);
  return trimExerciseRemainingSets(exercise, keepUndone);
}

function trimOneExtraRemainingSet(exercise, mode) {
  const minimumTotal = getExerciseMinimumWorkSetTarget(exercise, mode);
  const completed = getCompletedSetCount(exercise);
  const remaining = getRemainingSetCount(exercise);
  if (remaining <= 0) return false;
  const minimumRemaining = Math.max(0, minimumTotal - completed);
  if (remaining <= minimumRemaining) return false;
  return trimExerciseRemainingSets(exercise, remaining - 1);
}

function getRunnerAdjustmentLabel(adjustment) {
  const map = {
    shorten: i18nText('workout.runner.shorten', 'Shortened session'),
    lighten: i18nText('workout.runner.lighten', 'Lightened session'),
  };
  return (
    map[adjustment?.type] ||
    i18nText('workout.runner.adjusted', 'Adjusted session')
  );
}

function getRunnerUndoAvailable(workoutLike) {
  return !!workoutLike?.runnerState?.undoSnapshot;
}

function getQuickAdjustmentPreview(mode) {
  if (mode === 'shorten') {
    return {
      title: i18nText(
        'workout.runner.shorten_confirm_title',
        'Shorten this session?'
      ),
      body: i18nText(
        'workout.runner.shorten_confirm_body',
        'Choose how aggressively to trim the remaining work based on how much time you need to save.'
      ),
    };
  }
  return {
    title: i18nText(
      'workout.runner.light_confirm_title',
      'Go lighter this session?'
    ),
    body: i18nText(
      'workout.runner.light_confirm_body',
      'This keeps the session structure mostly intact, but lowers the remaining load and trims a little volume when useful. Use this when recovery feels off.'
    ),
  };
}

function showShortenAdjustmentOptions() {
  const preview = getQuickAdjustmentPreview('shorten');
  showCustomModal(
    escapeHtml(preview.title),
    `<div class="custom-modal-copy">${escapeHtml(preview.body)}</div>
    <div class="custom-modal-option-stack">
      <button class="btn btn-secondary" type="button" data-custom-modal-action="select-shorten-adjustment" data-adjustment-level="light">${escapeHtml(i18nText('workout.runner.shorten_option_light', 'Save ~5 min'))}</button>
      <div class="custom-modal-option-note">${escapeHtml(i18nText('workout.runner.shorten_option_light_body', 'Remove accessory work only and keep the rest of the structure intact.'))}</div>
      <button class="btn btn-secondary" type="button" data-custom-modal-action="select-shorten-adjustment" data-adjustment-level="medium">${escapeHtml(i18nText('workout.runner.shorten_option_medium', 'Save ~10 min'))}</button>
      <div class="custom-modal-option-note">${escapeHtml(i18nText('workout.runner.shorten_option_medium_body', 'Keep at least two work sets per remaining exercise and cut lower-priority volume.'))}</div>
      <button class="btn btn-secondary" type="button" data-custom-modal-action="select-shorten-adjustment" data-adjustment-level="hard">${escapeHtml(i18nText('workout.runner.shorten_option_hard', 'Save ~15 min'))}</button>
      <div class="custom-modal-option-note">${escapeHtml(i18nText('workout.runner.shorten_option_hard_body', 'Trim harder: keep two work sets per exercise and drop the last unstarted lift if needed.'))}</div>
    </div>`
  );
}

function selectShortenAdjustment(level) {
  closeCustomModal();
  executeQuickWorkoutAdjustment('shorten', level || 'medium');
}

function getRunnerPlanSummary(activeLike) {
  const workoutLike = activeLike || activeWorkout;
  if (!workoutLike) return null;
  const decision = workoutLike.planningDecision || {};
  const nextTarget = getActiveWorkoutNextTarget();
  const finishPoint = getActiveWorkoutFinishPoint(workoutLike);
  const completedSets = getWorkoutCompletedWorkSets();
  const remainingSets = getWorkoutRemainingWorkSets();
  const runnerCopy =
    typeof presentTrainingCommentary === 'function'
      ? presentTrainingCommentary(
          getWorkoutCommentaryState(workoutLike),
          'runner_summary'
        )
      : null;
  return {
    kicker:
      runnerCopy?.kicker || i18nText('workout.runner.kicker', 'Session plan'),
    title:
      runnerCopy?.title ||
      i18nText('workout.runner.normal_title', 'Normal session flow'),
    copy:
      runnerCopy?.copy ||
      i18nText(
        'workout.runner.normal_copy',
        'Stay on the main work and move through the remaining sets in order.'
      ),
    completedSets,
    remainingSets,
    nextTarget,
    finishPoint,
    adjustments: workoutLike.runnerState?.adjustments || [],
  };
}

function renderActiveWorkoutPlanPanel() {
  if (isLogActiveIslandActive()) {
    notifyLogActiveIsland();
    return;
  }
  const container = document.getElementById('active-session-plan');
  if (!container) return;
  if (!activeWorkout) {
    container.innerHTML = '';
    return;
  }
  const summary = getRunnerPlanSummary(activeWorkout);
  const elapsed = getWorkoutElapsedSeconds();
  const minutes = Math.floor(elapsed / 60);
  const totalTrackedSets =
    (summary?.completedSets || 0) + (summary?.remainingSets || 0);
  const progressPercent = totalTrackedSets
    ? Math.round(((summary?.completedSets || 0) / totalTrackedSets) * 100)
    : 100;
  const nextTargetText = summary?.nextTarget
    ? `${summary.nextTarget.exerciseName} · ${i18nText('rpe.set', 'Set')} ${summary.nextTarget.setLabel}${summary.nextTarget.weight !== '' && summary.nextTarget.weight !== undefined ? ` · ${summary.nextTarget.weight}kg` : ''}${summary.nextTarget.reps !== '' && summary.nextTarget.reps !== undefined ? ` × ${summary.nextTarget.reps}` : ''}`
    : i18nText(
        'workout.runner.done',
        'Main work is done. You can finish here or wrap up optional work.'
      );
  const adjustments = (summary?.adjustments || []).slice(-3);
  container.innerHTML = `<div class="active-session-plan-card">
    <div class="active-session-plan-top">
      <div>
        <div class="active-session-plan-kicker">${escapeHtml(summary?.kicker || i18nText('workout.runner.kicker', 'Session plan'))}</div>
        <div class="active-session-plan-title">${escapeHtml(summary?.title || i18nText('common.session', 'Session'))}</div>
        <div class="active-session-plan-copy">${escapeHtml(summary?.copy || '')}</div>
      </div>
      <div class="active-session-plan-progress-pill">${escapeHtml(`${progressPercent}%`)}</div>
    </div>
    <div class="active-session-plan-track" aria-hidden="true"><div class="active-session-plan-track-fill" style="width:${progressPercent}%"></div></div>
    <div class="active-session-plan-meta">
      <div class="active-session-plan-pill">${escapeHtml(i18nText('workout.runner.completed', '{count} sets done', { count: summary?.completedSets || 0 }))}</div>
      <div class="active-session-plan-pill">${escapeHtml(i18nText('workout.runner.remaining', '{count} sets left', { count: summary?.remainingSets || 0 }))}</div>
      <div class="active-session-plan-pill">${escapeHtml(i18nText('workout.runner.elapsed', '{count} min elapsed', { count: minutes }))}</div>
    </div>
    <div class="active-session-progress">
      <div class="active-session-next">${escapeHtml(i18nText('workout.runner.next', 'Next: {target}', { target: nextTargetText }))}</div>
      ${
        summary?.finishPoint
          ? `<div class="active-session-finish-point">
        <div class="active-session-finish-title">${escapeHtml(summary.finishPoint.title || '')}</div>
        <div class="active-session-finish-copy">${escapeHtml(summary.finishPoint.copy || '')}</div>
      </div>`
          : ''
      }
      ${adjustments.length ? `<div class="active-session-adjustments">${adjustments.map((item) => `<div class="active-session-adjustment">• ${escapeHtml(item.label || getRunnerAdjustmentLabel(item))}</div>`).join('')}</div>` : ''}
    </div>
    <div class="active-session-plan-actions">
      <button class="btn btn-secondary btn-sm" type="button" onclick="applyQuickWorkoutAdjustment('shorten')">${escapeHtml(i18nText('workout.runner.shorten_btn', 'Shorten'))}</button>
      <button class="btn btn-secondary btn-sm" type="button" onclick="applyQuickWorkoutAdjustment('lighten')">${escapeHtml(i18nText('workout.runner.lighten_btn', 'Go lighter'))}</button>
      ${getRunnerUndoAvailable(activeWorkout) ? `<button class="btn btn-secondary btn-sm btn-full" type="button" onclick="undoQuickWorkoutAdjustment()">${escapeHtml(i18nText('workout.runner.undo_btn', 'Undo adjustment'))}</button>` : ''}
    </div>
  </div>`;
  if (isLogActiveIslandActive()) notifyLogActiveIsland();
}

function applySportReadinessAdjustments(adjusted, sportContext) {
  const changes = [];
  const stressSignal = sportContext?.legsStress || 'none';
  const stressLevel = getSportStressLevel(sportContext);
  if (!stressLevel) return { exercises: adjusted, changes };
  let changed = false;
  adjusted.forEach((ex) => {
    if (!isLowerBodyExercise(ex)) return;
    if (ex.isAccessory) {
      return;
    }
    if (Array.isArray(ex.sets) && ex.sets.length) {
      const currentCount = ex.sets.length;
      let targetCount = currentCount;
      if (ex.isAux) {
        targetCount =
          stressLevel >= 2
            ? Math.min(currentCount, 2)
            : Math.min(currentCount, 3);
      } else {
        const trimBy = stressLevel >= 3 ? 2 : 1;
        targetCount = Math.max(3, currentCount - trimBy);
      }
      if (targetCount < currentCount) {
        ex.sets = ex.sets.slice(0, targetCount);
        changed = true;
      }
    }
  });
  if (changed) {
    const keyMap = {
      tomorrow: [
        'workout.pref_adjustment.sport_tomorrow',
        'Tomorrow looks leg-heavy, so lower-body work was kept slightly lighter.',
      ],
      today: [
        'workout.pref_adjustment.sport_today',
        "Keeps lower-body work more manageable around today's sport.",
      ],
      yesterday: [
        'workout.pref_adjustment.sport_yesterday',
        'Yesterday was leg-heavy, so lower-body work was kept lighter today.',
      ],
      both: [
        'workout.pref_adjustment.sport_both',
        'Leg-heavy sport sits on both sides of this session, so lower-body work was trimmed.',
      ],
    };
    const [key, fallback] = keyMap[stressSignal] || keyMap.tomorrow;
    changes.push(i18nText(key, fallback));
  }
  return { exercises: adjusted, changes };
}

// Generate warm-up ramp sets for a given working weight.
// 40-59 kg → 1 set (50%×5), 60-79 kg → 2 sets (+70%×3), 80+ kg → 3 sets (+85%×2).
function generateWarmupSets(workingWeight, rounding) {
  if (!workingWeight || workingWeight <= 0) return [];
  const r = rounding || 2.5;
  const snap = (v) => Math.max(0, Math.round(v / r) * r);
  const sets = [];
  if (workingWeight >= 40)
    sets.push({
      weight: snap(workingWeight * 0.5),
      reps: 5,
      done: false,
      rpe: null,
      isWarmup: true,
    });
  if (workingWeight >= 60)
    sets.push({
      weight: snap(workingWeight * 0.7),
      reps: 3,
      done: false,
      rpe: null,
      isWarmup: true,
    });
  if (workingWeight >= 80)
    sets.push({
      weight: snap(workingWeight * 0.85),
      reps: 2,
      done: false,
      rpe: null,
      isWarmup: true,
    });
  return sets;
}

// Prepend warm-up sets to main (non-aux, non-accessory) exercises that have a working weight.
function injectWarmupSets(exercises) {
  const rounding = getCurrentWorkoutRounding();
  exercises.forEach((ex) => {
    if (
      ex.isAux ||
      ex.isAccessory ||
      !Array.isArray(ex.sets) ||
      !ex.sets.length
    )
      return;
    const firstWeight = parseFloat(ex.sets[0].weight) || ex.tm || 0;
    if (firstWeight <= 0) return;
    const warmups = generateWarmupSets(firstWeight, rounding);
    if (warmups.length) ex.sets.unshift(...warmups);
  });
}

function applyTrainingPreferencesToExercises(exercises, sportContext, options) {
  const opts = options || {};
  if (
    typeof buildPlanningContext === 'function' &&
    typeof getTodayTrainingDecision === 'function' &&
    typeof buildAdaptiveSessionPlan === 'function'
  ) {
    const prog =
      typeof getActiveProgram === 'function' ? getActiveProgram() : null;
    const state =
      typeof getActiveProgramState === 'function'
        ? getActiveProgramState()
        : {};
    const context =
      opts.planningContext ||
      buildPlanningContext({
        profile,
        schedule,
        workouts,
        activeProgram: prog,
        activeProgramState: state,
        fatigue: typeof computeFatigue === 'function' ? computeFatigue() : null,
        sportContext,
      });
    const decision = opts.decision || getTodayTrainingDecision(context);
    const adapted = buildAdaptiveSessionPlan({
      programId: prog?.id,
      baseSession: exercises,
      context,
      decision,
      effectiveSessionMode: opts.effectiveSessionMode,
    });
    const commentary =
      adapted && adapted.commentary && typeof adapted.commentary === 'object'
        ? adapted.commentary
        : typeof buildTrainingCommentaryRecord === 'function'
          ? buildTrainingCommentaryRecord({
              decision,
              context,
              commentary: {
                version: 1,
                decisionCode:
                  typeof getTrainingDecisionCode === 'function'
                    ? getTrainingDecisionCode(decision)
                    : 'train',
                reasonCodes: [...(decision?.reasonCodes || [])],
                restrictionFlags: [...(decision?.restrictionFlags || [])],
                adaptationEvents: [...(adapted?.adaptationEvents || [])],
                equipmentHint: adapted?.equipmentHint || null,
                runnerEvents: [],
              },
            })
          : null;
    const commentaryState =
      typeof buildTrainingCommentaryState === 'function' && commentary
        ? buildTrainingCommentaryState({ decision, context, commentary })
        : null;
    return {
      exercises: adapted.exercises || cloneWorkoutExercises(exercises),
      commentary,
      changes:
        typeof presentTrainingCommentary === 'function' && commentaryState
          ? presentTrainingCommentary(
              commentaryState,
              'workout_adaptation_list'
            )
          : [],
      equipmentHint:
        typeof presentTrainingCommentary === 'function' && commentaryState
          ? presentTrainingCommentary(commentaryState, 'workout_equipment_hint')
              ?.text || ''
          : '',
    };
  }
  const prefs = normalizeTrainingPreferences(profile);
  const next = cloneWorkoutExercises(exercises);
  const changes = [];

  let adjusted = next;

  if (prefs.goal === 'sport_support') {
    const beforeLen = adjusted.length;
    adjusted = adjusted.filter((ex) => !ex.isAccessory);
    if (adjusted.length !== beforeLen) {
      changes.push(
        i18nText(
          'workout.pref_adjustment.sport_support',
          'Accessory work removed to keep the session sharper for sport support.'
        )
      );
    }
    adjusted.forEach((ex) => {
      if (
        ex.isAux &&
        !ex.isAccessory &&
        Array.isArray(ex.sets) &&
        ex.sets.length > 3
      ) {
        ex.sets = ex.sets.slice(0, 3);
      }
    });
  }

  if (prefs.sessionMinutes <= 45) {
    const beforeLen = adjusted.length;
    adjusted = adjusted.filter((ex) => !ex.isAccessory);
    if (
      adjusted.length !== beforeLen &&
      !changes.includes(
        i18nText(
          'workout.pref_adjustment.accessories',
          'Accessory work trimmed for a shorter session.'
        )
      )
    ) {
      changes.push(
        i18nText(
          'workout.pref_adjustment.accessories',
          'Accessory work trimmed for a shorter session.'
        )
      );
    }
  }

  if (prefs.sessionMinutes <= 30) {
    let auxTrimmed = false;
    adjusted.forEach((ex) => {
      if (
        ex.isAux &&
        !ex.isAccessory &&
        Array.isArray(ex.sets) &&
        ex.sets.length > 2
      ) {
        ex.sets = ex.sets.slice(0, 2);
        auxTrimmed = true;
      }
    });
    if (auxTrimmed) {
      changes.push(
        i18nText(
          'workout.pref_adjustment.aux_volume',
          'Auxiliary volume reduced to fit your time cap.'
        )
      );
    }
  } else if (prefs.sessionMinutes <= 45) {
    let auxTrimmed = false;
    adjusted.forEach((ex) => {
      if (
        ex.isAux &&
        !ex.isAccessory &&
        Array.isArray(ex.sets) &&
        ex.sets.length > 3
      ) {
        ex.sets = ex.sets.slice(0, 3);
        auxTrimmed = true;
      }
    });
    if (auxTrimmed) {
      changes.push(
        i18nText(
          'workout.pref_adjustment.aux_volume',
          'Auxiliary volume reduced to fit your time cap.'
        )
      );
    }
  }

  const sportAdjusted = applySportReadinessAdjustments(adjusted, sportContext);
  adjusted = sportAdjusted.exercises;
  sportAdjusted.changes.forEach((change) => changes.push(change));

  return {
    exercises: adjusted,
    commentary: null,
    changes: [...new Set(changes)],
    equipmentHint:
      prefs.equipmentAccess === 'basic_gym' ||
      prefs.equipmentAccess === 'home_gym' ||
      prefs.equipmentAccess === 'minimal'
        ? i18nText(
            'workout.pref_adjustment.swap_hint',
            'Use exercise swap freely if your setup does not match the planned lift exactly.'
          )
        : '',
  };
}

function ensureWorkoutCommentaryRecord(workoutLike) {
  if (!workoutLike) return null;
  if (workoutLike.commentary && typeof workoutLike.commentary === 'object') {
    workoutLike.commentary.version = 1;
    workoutLike.commentary.adaptationEvents = Array.isArray(
      workoutLike.commentary.adaptationEvents
    )
      ? workoutLike.commentary.adaptationEvents
      : [];
    workoutLike.commentary.runnerEvents = Array.isArray(
      workoutLike.commentary.runnerEvents
    )
      ? workoutLike.commentary.runnerEvents
      : [];
    return workoutLike.commentary;
  }
  if (typeof buildTrainingCommentaryRecord === 'function') {
    workoutLike.commentary = buildTrainingCommentaryRecord({
      workout: workoutLike,
    });
    return workoutLike.commentary;
  }
  return null;
}

function getEffectiveWorkoutDecisionForUi(workoutLike) {
  const decision = cloneTrainingDecision(workoutLike?.planningDecision) || {};
  const selectedSessionMode =
    workoutLike?.runnerState?.selectedSessionMode ||
    (workoutLike?.runnerState?.startOverride === 'normal' ? 'normal' : 'auto');
  const effectiveSessionMode =
    workoutLike?.runnerState?.effectiveSessionMode ||
    resolveEffectiveSessionMode(
      selectedSessionMode,
      isLightTrainingAction(decision.action) ? 'light' : 'normal'
    );
  return applySessionModeToDecision(decision, effectiveSessionMode);
}

function getWorkoutCommentaryState(workoutLike, overrides) {
  if (typeof buildTrainingCommentaryState !== 'function') return null;
  return buildTrainingCommentaryState({
    workout: workoutLike || activeWorkout || {},
    decision: getEffectiveWorkoutDecisionForUi(
      workoutLike || activeWorkout || {}
    ),
    ...(overrides || {}),
  });
}

function appendWorkoutRunnerEvent(workoutLike, code, params) {
  const commentary = ensureWorkoutCommentaryRecord(workoutLike);
  if (!commentary || typeof createTrainingCommentaryEvent !== 'function')
    return commentary;
  commentary.runnerEvents = [...(commentary.runnerEvents || [])];
  commentary.runnerEvents.push(createTrainingCommentaryEvent(code, params));
  return commentary;
}

function appendWorkoutAdaptationEvent(workoutLike, code, params) {
  const commentary = ensureWorkoutCommentaryRecord(workoutLike);
  if (!commentary || typeof createTrainingCommentaryEvent !== 'function')
    return commentary;
  commentary.adaptationEvents = [...(commentary.adaptationEvents || [])];
  commentary.adaptationEvents.push(createTrainingCommentaryEvent(code, params));
  return commentary;
}

function getWorkoutDecisionSummary(decision, context) {
  if (
    typeof buildTrainingCommentaryState === 'function' &&
    typeof presentTrainingCommentary === 'function'
  ) {
    const state = buildTrainingCommentaryState({ decision, context });
    const summary = presentTrainingCommentary(state, 'workout_summary');
    if (!summary) return null;
    return {
      title: summary.title,
      copy: summary.copy || '',
      body: summary.copy || '',
      tone: summary.tone || state.tone,
      reasons: [...state.reasonCodes],
      reasonLabels: [...(summary.reasonLabels || [])],
    };
  }
  return null;
}

function renderWorkoutDecisionPreview(decision, context) {
  const summary = getWorkoutDecisionSummary(decision, context);
  if (!summary) return '';
  const summaryVm =
    typeof buildTrainingCommentaryState === 'function' &&
    typeof presentTrainingCommentary === 'function'
      ? presentTrainingCommentary(
          buildTrainingCommentaryState({ decision, context }),
          'workout_summary'
        )
      : null;
  const reasons = summary.reasonLabels || [];
  return `<div class="workout-decision-card">
    <div class="workout-decision-kicker">${escapeHtml(summaryVm?.kicker || i18nText('workout.plan.kicker', "Today's decision"))}</div>
    <div class="workout-decision-title">${escapeHtml(summary.title)}</div>
    <div class="workout-decision-copy">${escapeHtml(summary.copy)}</div>
    ${reasons.length ? `<div class="workout-decision-reasons">${reasons.map((reason) => `<div class="workout-decision-chip">${escapeHtml(reason)}</div>`).join('')}</div>` : ''}
  </div>`;
}

function renderWorkoutStartDecisionCard(
  prog,
  state,
  decision,
  sessionModeBundle,
  context
) {
  const recommendedMode =
    sessionModeBundle?.recommendedSessionMode === 'light' ? 'light' : 'normal';
  const displayDecision =
    recommendedMode === 'light' && !isLightTrainingAction(decision?.action)
      ? applySessionModeToDecision(decision, 'light')
      : decision;
  const summary = getWorkoutDecisionSummary(displayDecision, context);
  if (!summary) return '';
  const summaryVm =
    typeof buildTrainingCommentaryState === 'function' &&
    typeof presentTrainingCommentary === 'function'
      ? presentTrainingCommentary(
          buildTrainingCommentaryState({ decision: displayDecision, context }),
          'workout_summary'
        )
      : null;
  const reasons = summary.reasonLabels || [];
  const selectedMode = normalizeSessionMode(
    sessionModeBundle?.selectedSessionMode || 'auto'
  );
  const autoCopy = i18nText(
    recommendedMode === 'light'
      ? 'workout.session_mode.auto_copy_light'
      : 'workout.session_mode.auto_copy_normal',
    recommendedMode === 'light'
      ? "Follow today's light-session recommendation automatically."
      : "Follow today's normal-session recommendation automatically."
  );
  return `<div class="workout-decision-card workout-decision-card-actionable">
    <div class="workout-decision-kicker">${escapeHtml(summaryVm?.kicker || i18nText('workout.plan.kicker', "Today's decision"))}</div>
    <div class="workout-decision-title">${escapeHtml(summary.title)}</div>
    <div class="workout-decision-copy">${escapeHtml(summary.copy)}</div>
    ${reasons.length ? `<div class="workout-decision-reasons">${reasons.map((reason) => `<div class="workout-decision-chip">${escapeHtml(reason)}</div>`).join('')}</div>` : ''}
    <div class="workout-decision-options">
      <button class="workout-decision-option${selectedMode === 'auto' ? ' is-active' : ''}" type="button" onclick="setPendingSessionMode('auto')">
        <div class="workout-decision-option-title">${escapeHtml(i18nText('workout.session_mode.auto', 'Auto'))}</div>
        <div class="workout-decision-option-copy">${escapeHtml(autoCopy)}</div>
      </button>
      <button class="workout-decision-option${selectedMode === 'normal' ? ' is-active' : ''}" type="button" onclick="setPendingSessionMode('normal')">
        <div class="workout-decision-option-title">${escapeHtml(i18nText('workout.session_mode.normal', 'Normal session'))}</div>
        <div class="workout-decision-option-copy">${escapeHtml(i18nText('workout.session_mode.normal_copy', 'Keep the original plan and suppress the automatic lightening.'))}</div>
      </button>
      <button class="workout-decision-option${selectedMode === 'light' ? ' is-active' : ''}" type="button" onclick="setPendingSessionMode('light')">
        <div class="workout-decision-option-title">${escapeHtml(i18nText('workout.session_mode.light', 'Light session'))}</div>
        <div class="workout-decision-option-copy">${escapeHtml(i18nText('workout.session_mode.light_copy', 'Start with the lighter session version even if today would otherwise be normal.'))}</div>
      </button>
    </div>
  </div>`;
}

// escapeHtml() is defined globally in i18n-layer.js (loaded first)

function displayExerciseName(input) {
  return getWorkoutExerciseDisplayName(input);
}

function displaySportName(input) {
  const raw = String(input || '').trim();
  if (!raw) return raw;
  const locale = window.I18N && I18N.getLanguage ? I18N.getLanguage() : 'en';
  if (locale === 'fi' && raw.toLowerCase() === 'hockey') return 'Jääkiekko';
  if (locale === 'fi' && raw.toLowerCase() === 'cardio') return 'Kestävyys';
  if (locale === 'en' && raw.toLowerCase() === 'kestävyys') return 'Cardio';
  return raw;
}

function getExerciseGuide(ex) {
  if (!ex) return null;
  const guide = getWorkoutExerciseGuidance(
    ex.exerciseId || ex.name,
    window.I18N && I18N.getLanguage ? I18N.getLanguage() : 'en'
  );
  if (!guide) {
    return null;
  }
  return guide;
}

function getExerciseGuidePromptSnapshot() {
  const exercise = activeGuideExerciseKey
    ? getExerciseByUiKey(activeGuideExerciseKey)
    : null;
  const guide = getExerciseGuide(exercise);
  if (!exercise || !guide) return null;
  const mediaLinks = [];
  if (guide.media?.videoUrl) {
    mediaLinks.push(
      {
        href: guide.media.videoUrl,
        label: i18nText('guidance.media.video', 'Open video'),
      }
    );
  }
  if (guide.media?.imageUrl) {
    mediaLinks.push(
      {
        href: guide.media.imageUrl,
        label: i18nText('guidance.media.image', 'Open image'),
      }
    );
  }
  return {
    open: true,
    title: displayExerciseName(exercise.name),
    subtitle: i18nText('guidance.title', 'Movement Guide'),
    setup: guide.setup || '',
    execution: Array.isArray(guide.execution) ? guide.execution.slice() : [],
    cues: Array.isArray(guide.cues) ? guide.cues.slice() : [],
    safety: guide.safety || '',
    mediaLinks,
  };
}

function refreshExerciseGuideModal() {
  const exercise = activeGuideExerciseKey
    ? getExerciseByUiKey(activeGuideExerciseKey)
    : null;
  if (!exercise || !getExerciseGuide(exercise)) {
    closeExerciseGuide();
    return;
  }
  if (typeof window.syncWorkoutSessionBridge === 'function') {
    window.syncWorkoutSessionBridge();
  }
}

function openExerciseGuide(exerciseRef) {
  const exercise =
    typeof exerciseRef === 'string'
      ? getExerciseByUiKey(exerciseRef)
      : activeWorkout?.exercises?.[exerciseRef];
  const guide = getExerciseGuide(exercise);
  if (!exercise || !guide) return;
  activeGuideExerciseKey = ensureExerciseUiKey(exercise);
  if (typeof window.syncWorkoutSessionBridge === 'function') {
    window.syncWorkoutSessionBridge();
  }
}

function closeExerciseGuide(event) {
  if (event && event.target !== event.currentTarget) return;
  activeGuideExerciseKey = null;
  if (typeof window.syncWorkoutSessionBridge === 'function') {
    window.syncWorkoutSessionBridge();
  }
}

window.getExerciseGuidePromptSnapshot = getExerciseGuidePromptSnapshot;

function renderExerciseGuideButton(exercise) {
  if (!getExerciseGuide(exercise)) return '';
  return `<button class="btn btn-blue btn-sm exercise-guide-open-btn" type="button" data-action="open-guide">${escapeHtml(i18nText('guidance.title', 'Movement Guide'))}</button>`;
}

function renderExerciseCollapsedSummary(exercise) {
  const counts = getExerciseCompletionCounts(exercise);
  return `
    <button class="exercise-collapse-summary" type="button" data-action="expand-exercise">
      <div class="exercise-collapse-main">
        <div class="exercise-collapse-name">${escapeHtml(displayExerciseName(exercise.name))}</div>
        <div class="exercise-collapse-meta">${escapeHtml(i18nText('workout.completed_sets', '{completed}/{total} sets done', { completed: counts.completed, total: counts.total }))}</div>
      </div>
      <div class="exercise-collapse-status">
        <span class="exercise-collapse-badge">${escapeHtml(i18nText('common.done', 'Done'))}</span>
      </div>
    </button>`;
}

function expandCompletedExercise(exerciseRef) {
  const exercise =
    typeof exerciseRef === 'string'
      ? getExerciseByUiKey(exerciseRef)
      : activeWorkout?.exercises?.[exerciseRef];
  if (!exercise) return;
  setExerciseCardCollapsed(exercise, false);
  updateExerciseCard(ensureExerciseUiKey(exercise));
}

// Shared helper: run forgeSeal animation on a card, then replace with collapsed summary.
// Uses a setTimeout fallback in case animationend never fires (tab switch, low-power mode).
function runForgeSealCollapse(card, uiKey) {
  let settled = false;
  function finish() {
    if (settled) return;
    settled = true;
    const currentExercise = getExerciseByUiKey(uiKey);
    if (currentExercise && isExerciseComplete(currentExercise)) {
      updateExerciseCard(uiKey);
      const newCard = getExerciseCardElement(uiKey);
      if (newCard) {
        newCard.classList.add('seal-enter');
        newCard.addEventListener(
          'animationend',
          () => newCard.classList.remove('seal-enter'),
          { once: true }
        );
      }
    } else {
      updateExerciseCard(uiKey);
    }
  }
  card.classList.add('collapsing');
  card.addEventListener('animationend', finish, { once: true });
  // Fallback: forgeSeal CSS animation is 300ms — 400ms gives safe margin
  window.setTimeout(finish, 400);
}

function collapseCompletedExercise(exerciseRef) {
  const exercise =
    typeof exerciseRef === 'string'
      ? getExerciseByUiKey(exerciseRef)
      : activeWorkout?.exercises?.[exerciseRef];
  if (!exercise || !isExerciseComplete(exercise)) return;
  const uiKey = ensureExerciseUiKey(exercise);
  setExerciseCardCollapsed(exercise, true);
  const card = getExerciseCardElement(uiKey);
  if (card) runForgeSealCollapse(card, uiKey);
}

function getExerciseSetsId(exercise) {
  return `sets-${ensureExerciseUiKey(exercise)}`;
}

function getSetInputId(exerciseRef, setIndex, field) {
  const uiKey =
    typeof exerciseRef === 'string'
      ? exerciseRef
      : ensureExerciseUiKey(exerciseRef);
  return `set-input-${uiKey}-${setIndex}-${field}`;
}

function getSetRowSelector(setIndex) {
  return `.set-row[data-set-index="${setIndex}"]`;
}

function buildSetGridHeader() {
  return `
    <div class="set-grid-header">
      <span class="set-grid-spacer" aria-hidden="true"></span>
      <div class="set-col-label">${escapeHtml(i18nText('workout.weight_placeholder', 'kg'))}</div>
      <div class="set-col-label">${escapeHtml(i18nText('workout.reps_placeholder', 'reps'))}</div>
      <span class="set-grid-spacer" aria-hidden="true"></span>
    </div>`;
}

function buildSetRow(exercise, exerciseIndex, setIndex, set) {
  const uiKey = ensureExerciseUiKey(exercise);
  const isAmrap = set.isAmrap;
  const warmupsBefore = exercise.sets.filter(
    (s, i) => i < setIndex && s.isWarmup
  ).length;
  const setLabel = set.isWarmup
    ? 'W'
    : isAmrap
      ? i18nText('workout.max_short', 'MAX')
      : String(setIndex + 1 - warmupsBefore);
  const repVal = isAmrap && set.reps === 'AMRAP' ? '' : set.reps;
  const rowClass = ['set-row'];
  const actionClass = ['set-action-cell'];
  if (set.isWarmup) rowClass.push('set-warmup');
  if (set.done) rowClass.push('is-done');
  if (isAmrap) rowClass.push('set-amrap');
  if (set.isPr) {
    rowClass.push('has-pr');
    actionClass.push('has-pr');
  }
  return `
    <div class="${rowClass.join(' ')}" data-set-index="${setIndex}">
      <span class="set-num"${isAmrap ? ' style="color:var(--purple);font-weight:800"' : ''}>${setLabel}</span>
      <input id="${getSetInputId(uiKey, setIndex, 'weight')}" class="set-input" type="number" inputmode="decimal" min="0" max="999" step="any" data-field="weight" data-set-index="${setIndex}" data-exercise-index="${exerciseIndex}" placeholder="${escapeHtml(i18nText('workout.weight_placeholder', 'kg'))}" value="${escapeHtml(String(set.weight ?? ''))}">
      <input id="${getSetInputId(uiKey, setIndex, 'reps')}" class="set-input" type="number" inputmode="numeric" min="0" max="999" data-field="reps" data-set-index="${setIndex}" data-exercise-index="${exerciseIndex}" placeholder="${escapeHtml(isAmrap ? i18nText('workout.reps_hit', 'reps hit') : i18nText('workout.reps_placeholder', 'reps'))}" value="${escapeHtml(String(repVal ?? ''))}"${isAmrap ? ' style="border-color:var(--purple)"' : ''}>
      <div class="${actionClass.join(' ')}">
        <button class="set-check ${set.done ? 'done' : ''}${set.isPr ? ' set-check-pr' : ''}" type="button" data-action="toggle-set" data-set-index="${setIndex}" data-exercise-index="${exerciseIndex}">✓</button>
        ${set.isPr ? `<span class="set-pr-badge is-visible">${escapeHtml(i18nText('workout.pr_badge', 'NEW PR'))}</span>` : ''}
      </div>
    </div>`;
}

function getExercisesContainer() {
  return document.getElementById('exercises-container');
}

function getExerciseCardElement(uiKey) {
  const container = getExercisesContainer();
  if (!container || !uiKey) return null;
  return container.querySelector(`.exercise-block[data-ui-key="${uiKey}"]`);
}

function syncExerciseCardIndexes() {
  const container = getExercisesContainer();
  if (!container) return;
  Array.from(
    container.querySelectorAll('.exercise-block[data-ui-key]')
  ).forEach((card) => {
    const index = getExerciseIndexByUiKey(card.dataset.uiKey || '');
    if (index >= 0) card.dataset.exerciseIndex = String(index);
  });
}

function createExerciseCardElement(exercise, exerciseIndex) {
  const uiKey = ensureExerciseUiKey(exercise);
  const prev = getPreviousSets(exercise);
  const prevText = prev
    ? i18nText('workout.last_prefix', 'Last:') +
      ' ' +
      prev.map((set) => set.weight + 'kg×' + set.reps).join(', ')
    : i18nText('workout.no_previous_data', 'No previous data');
  const suggested = getSuggested(exercise);
  const isComplete = isExerciseComplete(exercise);
  const isCollapsed = isExerciseCardCollapsed(exercise);
  const block = document.createElement('div');
  block.className =
    'exercise-block' +
    (isComplete ? ' exercise-block-complete' : '') +
    (isCollapsed ? ' is-collapsed' : '');
  block.dataset.uiKey = uiKey;
  block.dataset.exerciseIndex = String(exerciseIndex);

  if (isCollapsed) {
    block.innerHTML = renderExerciseCollapsedSummary(exercise);
    return block;
  }

  let badges = '';
  if (suggested)
    badges += `<div class="suggest-badge">📈 ${i18nText('workout.last_best', 'Last best: {weight}kg', { weight: suggested })}</div>`;
  const guideButtonHtml = renderExerciseGuideButton(exercise);
  let swapBtn = '';
  if (exercise.isAux && exercise.auxSlotIdx >= 0) {
    swapBtn = `<button class="btn btn-secondary exercise-action-btn exercise-swap-btn" type="button" data-action="swap-aux" title="${escapeHtml(i18nText('workout.swap', 'Swap'))}" aria-label="${escapeHtml(i18nText('workout.swap', 'Swap'))}">${escapeHtml(i18nText('workout.swap', 'Swap'))}</button>`;
  }
  if (exercise.isAccessory) {
    swapBtn = `<button class="btn btn-secondary exercise-action-btn exercise-swap-btn" type="button" data-action="swap-back" title="${escapeHtml(i18nText('workout.swap_back', 'Swap back exercise'))}" aria-label="${escapeHtml(i18nText('workout.swap_back', 'Swap back exercise'))}">${escapeHtml(i18nText('workout.swap', 'Swap'))}</button>`;
  }
  const typeLabel = exercise.isAux
    ? `<span class="exercise-chip">${escapeHtml(i18nText('workout.aux', 'AUX'))}</span>`
    : exercise.isAccessory
      ? `<span class="exercise-chip exercise-chip-blue">${escapeHtml(i18nText('workout.back', 'BACK'))}</span>`
      : '';
  const badgesHtml = badges
    ? `<div class="exercise-badges">${badges}</div>`
    : '';
  const guideRowHtml = guideButtonHtml
    ? `<div class="exercise-secondary-row">${guideButtonHtml}</div>`
    : '';
  const setsHtml =
    buildSetGridHeader() +
    exercise.sets
      .map((set, setIndex) =>
        buildSetRow(exercise, exerciseIndex, setIndex, set)
      )
      .join('');

  block.innerHTML = `
    <div class="exercise-top">
      <div class="exercise-header">
        <div class="exercise-title-stack">
          <div class="exercise-title-row">
            <div class="exercise-name">${escapeHtml(displayExerciseName(exercise.name))}</div>
            ${typeLabel}
          </div>
          <div class="last-session">${prevText}</div>
        </div>
        <div class="exercise-action-row">${swapBtn}${isComplete ? `<button class="btn btn-icon btn-secondary exercise-action-btn exercise-collapse-btn" type="button" data-action="collapse-exercise" title="${escapeHtml(i18nText('workout.collapse', 'Minimize'))}" aria-label="${escapeHtml(i18nText('workout.collapse', 'Minimize'))}">▾</button>` : ''}<button class="btn btn-icon btn-secondary exercise-action-btn exercise-remove-btn" type="button" data-action="remove-exercise" title="${escapeHtml(i18nText('workout.remove_exercise', 'Remove exercise'))}" aria-label="${escapeHtml(i18nText('workout.remove_exercise', 'Remove exercise'))}">✕</button></div>
      </div>
      ${badgesHtml}
    </div>
    ${guideRowHtml}
    <div id="${getExerciseSetsId(exercise)}" class="exercise-sets">${setsHtml}</div>
    <button class="btn btn-sm btn-secondary" style="margin-top:8px" type="button" data-action="add-set">${i18nText('workout.add_set', '+ Set')}</button>`;
  return block;
}

function renderExercises() {
  if (!activeWorkout) return;
  ensureActiveWorkoutExerciseUiKeys();
  ensureExerciseListInteractions();
  const container = getExercisesContainer();
  if (!container) return;
  const fragment = document.createDocumentFragment();
  activeWorkout.exercises.forEach((exercise, exerciseIndex) => {
    fragment.appendChild(createExerciseCardElement(exercise, exerciseIndex));
  });
  container.replaceChildren(fragment);
  syncExerciseCardIndexes();
  renderActiveWorkoutPlanPanel();
  refreshExerciseGuideModal();
}

function updateExerciseCard(uiKey) {
  if (isLogActiveIslandActive()) {
    notifyLogActiveIsland();
    refreshExerciseGuideModal();
    return getExerciseCardElement(uiKey);
  }
  const exercise = getExerciseByUiKey(uiKey);
  const container = getExercisesContainer();
  if (!exercise || !container) return null;
  const exerciseIndex = getExerciseIndexByUiKey(uiKey);
  const nextCard = createExerciseCardElement(exercise, exerciseIndex);
  const currentCard = getExerciseCardElement(uiKey);
  if (currentCard) currentCard.replaceWith(nextCard);
  else {
    const beforeNode = container.children[exerciseIndex] || null;
    container.insertBefore(nextCard, beforeNode);
  }
  syncExerciseCardIndexes();
  refreshExerciseGuideModal();
  return nextCard;
}

function appendExerciseCard(exercise) {
  if (isLogActiveIslandActive()) {
    notifyLogActiveIsland();
    refreshExerciseGuideModal();
    return getExerciseCardElement(ensureExerciseUiKey(exercise));
  }
  const container = getExercisesContainer();
  if (!container) return null;
  const card = createExerciseCardElement(
    exercise,
    getExerciseIndexByUiKey(ensureExerciseUiKey(exercise))
  );
  container.appendChild(card);
  syncExerciseCardIndexes();
  refreshExerciseGuideModal();
  return card;
}

function insertExerciseCard(exerciseIndex, exercise) {
  if (isLogActiveIslandActive()) {
    notifyLogActiveIsland();
    refreshExerciseGuideModal();
    return getExerciseCardElement(ensureExerciseUiKey(exercise));
  }
  const container = getExercisesContainer();
  if (!container) return null;
  const card = createExerciseCardElement(exercise, exerciseIndex);
  const beforeNode = container.children[exerciseIndex] || null;
  container.insertBefore(card, beforeNode);
  syncExerciseCardIndexes();
  refreshExerciseGuideModal();
  return card;
}

function removeExerciseCard(uiKey) {
  if (isLogActiveIslandActive()) {
    if (activeGuideExerciseKey === uiKey) closeExerciseGuide();
    notifyLogActiveIsland();
    return;
  }
  const card = getExerciseCardElement(uiKey);
  if (card) card.remove();
  syncExerciseCardIndexes();
  if (activeGuideExerciseKey === uiKey) closeExerciseGuide();
}

function getExerciseActionContext(target) {
  const card = target.closest('.exercise-block[data-ui-key]');
  if (!card) return null;
  const uiKey = card.dataset.uiKey || '';
  const exerciseIndex = getExerciseIndexByUiKey(uiKey);
  if (exerciseIndex < 0) return null;
  const row = target.closest('.set-row[data-set-index]');
  const setIndexRaw = row?.dataset?.setIndex ?? target.dataset?.setIndex;
  const setIndex = setIndexRaw === undefined ? -1 : parseInt(setIndexRaw, 10);
  return {
    card,
    uiKey,
    exerciseIndex,
    setIndex,
    exercise: activeWorkout.exercises[exerciseIndex],
  };
}

function handleExerciseListClick(event) {
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  const context = getExerciseActionContext(actionTarget);
  if (!context) return;
  if (action === 'open-guide') {
    openExerciseGuide(context.uiKey);
    return;
  }
  if (action === 'expand-exercise') {
    expandCompletedExercise(context.uiKey);
    return;
  }
  if (action === 'collapse-exercise') {
    collapseCompletedExercise(context.uiKey);
    return;
  }
  if (action === 'toggle-set' && context.setIndex >= 0) {
    toggleSet(context.exerciseIndex, context.setIndex);
    return;
  }
  if (action === 'add-set') {
    addSet(context.exerciseIndex);
    return;
  }
  if (action === 'remove-exercise') {
    removeEx(context.exerciseIndex);
    return;
  }
  if (action === 'swap-aux') {
    swapAuxExercise(context.exerciseIndex);
    return;
  }
  if (action === 'swap-back') {
    swapBackExercise(context.exerciseIndex);
  }
}

function handleExerciseListChange(event) {
  const input = event.target.closest('.set-input[data-field]');
  if (!input) return;
  const context = getExerciseActionContext(input);
  if (!context || context.setIndex < 0) return;
  updateSet(
    context.exerciseIndex,
    context.setIndex,
    input.dataset.field,
    event.target.value
  );
}

function handleExerciseListKeydown(event) {
  const input = event.target.closest('.set-input[data-field]');
  if (!input) return;
  const context = getExerciseActionContext(input);
  if (!context || context.setIndex < 0) return;
  handleSetInputKey(
    event,
    context.uiKey,
    context.setIndex,
    input.dataset.field
  );
}

function ensureExerciseListInteractions() {
  if (exerciseListInteractionsBound) return;
  const container = getExercisesContainer();
  if (!container) return;
  container.addEventListener('click', handleExerciseListClick);
  container.addEventListener('change', handleExerciseListChange);
  container.addEventListener('keydown', handleExerciseListKeydown);
  exerciseListInteractionsBound = true;
}

// WORKOUT STARTER
function startWorkout() {
  const prefs = normalizeTrainingPreferences(profile);
  if (prefs.sportReadinessCheckEnabled) {
    beginWorkoutStart(getPendingSportReadinessContext());
    return;
  }
  beginWorkoutStart(null);
}

function beginWorkoutStart(sportContext) {
  const prog = getActiveProgram();
  const state = getActiveProgramState();
  let selectedOption =
    typeof getSelectedWorkoutStartOption === 'function'
      ? getSelectedWorkoutStartOption()
      : '';

  // ── Bonus workout branch ──────────────────────────────────────
  if (selectedOption === 'bonus' && window.BONUS_SESSION) {
    const bonusDuration =
      typeof getSelectedBonusDuration === 'function'
        ? getSelectedBonusDuration()
        : 'standard';
    const bonusExercises = BONUS_SESSION.buildBonusSession(
      prog, state, workouts, schedule, bonusDuration
    );
    const bonusLabel = i18nText('workout.bonus.label', 'Bonus Workout');
    activeWorkout = getWorkoutRuntime().buildBonusActiveWorkout(
      {
        programId: prog.id,
        programLabel: bonusLabel,
        sportContext: sportContext || undefined,
        sessionDescription: i18nText(
          'workout.bonus.subtitle',
          'Extra session for undertrained areas'
        ),
        exercises: bonusExercises,
        startTime: Date.now(),
      },
      {
        buildWorkoutRewardState,
        ensureWorkoutExerciseUiKeys,
      }
    );
    ensureWorkoutCommentaryRecord(activeWorkout);
    resetActiveWorkoutUIState();
    persistCurrentWorkoutDraft();
    updateProgramDisplay();
    const isReactActive = isLogActiveIslandActive();
    const bonusPresentation = getWorkoutRuntime().buildWorkoutStartPresentation(
      {
        isBonus: true,
        title: bonusLabel,
        sessionDescription: activeWorkout.sessionDescription || '',
        activeWorkout,
      },
      {
        t: i18nText,
      }
    );
    document.getElementById('workout-not-started').style.display = 'none';
    document.getElementById('workout-active').style.display = 'block';
    if (!isReactActive) {
      document.getElementById('active-session-title').textContent =
        bonusPresentation?.title || bonusLabel;
      const descEl = document.getElementById('active-session-description');
      if (descEl) {
        descEl.textContent =
          bonusPresentation?.descriptionText || activeWorkout.sessionDescription;
        descEl.style.display =
          bonusPresentation?.descriptionVisible === false ? 'none' : '';
      }
    }
    restDuration =
      typeof getSelectedRestDuration === 'function'
        ? getSelectedRestDuration()
        : restDuration || profile.defaultRest || 120;
    startWorkoutTimer();
    if (!isReactActive) renderExercises();
    showToast(
      bonusPresentation?.immediateToast?.text ||
        i18nText('workout.bonus.toast_started', 'Bonus workout started!'),
      bonusPresentation?.immediateToast?.color || 'var(--purple)'
    );
    notifyLogStartIsland();
    notifyLogActiveIsland();
    notifyDashboardIsland();
    return;
  }

  const decisionBundle = getWorkoutStartDecisionBundle({
    prog,
    state,
    sportContext,
  });
  const planningContext = decisionBundle.planningContext;
  const trainingDecision = decisionBundle.trainingDecision;
  const cachedSnapshot = getCachedWorkoutStartSnapshot();
  const canReuseSnapshot =
    cachedSnapshot &&
    cachedSnapshot.programId === prog.id &&
    (!selectedOption ||
      cachedSnapshot.selectedOption === String(selectedOption));
  const startSnapshot = canReuseSnapshot
    ? cachedSnapshot
    : getWorkoutStartSnapshot({
        prog,
        state,
        selectedOption,
        sportContext,
        decisionBundle,
        planningContext,
        trainingDecision,
      });
  selectedOption = startSnapshot?.selectedOption || selectedOption;
  const effectiveDecision =
    startSnapshot?.effectiveDecision ||
    decisionBundle.effectiveDecision ||
    trainingDecision;
  const buildContext =
    startSnapshot?.buildContext ||
    getProgramSessionBuildContext({ sessionModeBundle: decisionBundle });
  const buildState =
    startSnapshot?.buildState ||
    getProgramSessionStateForBuild(prog, state, buildContext);
  const exercises = startSnapshot?.exercises
    ? cloneWorkoutExercises(startSnapshot.exercises)
    : [];
  const label =
    startSnapshot?.programLabel ||
    prog.getSessionLabel(selectedOption, buildState, buildContext);
  const bi = prog.getBlockInfo
    ? prog.getBlockInfo(buildState)
    : { isDeload: false };
  const sessionDescription =
    startSnapshot?.sessionDescription ||
    (prog.getSessionDescription
      ? prog.getSessionDescription(selectedOption, buildState, buildContext) ||
        ''
      : bi.modeDesc || bi.name || '');

  activeWorkout =
    getWorkoutRuntime().buildPlannedActiveWorkout(
      {
        programId: prog.id,
        selectedOption,
        programMode: state.mode || undefined,
        programLabel: label,
        sportContext: sportContext || undefined,
        trainingDecision: trainingDecision || undefined,
        planningContext: planningContext || undefined,
        commentary: startSnapshot?.commentary || undefined,
        effectiveDecision,
        selectedSessionMode: decisionBundle.selectedSessionMode || 'auto',
        effectiveSessionMode: decisionBundle.effectiveSessionMode || 'normal',
        sportAwareLowerBody: decisionBundle.sportAwareLowerBody === true,
        sessionDescription,
        sessionSnapshot: startSnapshot || undefined,
        exercises,
        startTime: Date.now(),
      },
      {
        buildWorkoutRewardState,
        ensureWorkoutExerciseUiKeys,
      }
    );
  ensureWorkoutCommentaryRecord(activeWorkout);
  resetActiveWorkoutUIState();
  persistCurrentWorkoutDraft();

  const isReactActive = isLogActiveIslandActive();
  updateProgramDisplay();
  document.getElementById('workout-not-started').style.display = 'none';
  document.getElementById('workout-active').style.display = 'block';
  if (!isReactActive) {
    document.getElementById('active-session-title').textContent = label;
    const descEl = document.getElementById('active-session-description');
    if (descEl) {
      const prefix = i18nText('session.description', 'Session focus');
      descEl.textContent = sessionDescription
        ? prefix + ': ' + sessionDescription
        : '';
      descEl.style.display = sessionDescription ? '' : 'none';
    }
  }
  restDuration =
    typeof getSelectedRestDuration === 'function'
      ? getSelectedRestDuration()
      : restDuration || profile.defaultRest || 120;
  startWorkoutTimer();
  if (!isReactActive) renderExercises();
  const progName =
    window.I18N && I18N.t
      ? I18N.t('program.' + prog.id + '.name', null, prog.name || 'Training')
      : prog.name || 'Training';
  const todayDow = new Date().getDay();
  const isSportDay = schedule.sportDays.includes(todayDow);
  const hadSportRecently = wasSportRecently();
  const startPresentation = getWorkoutRuntime().buildWorkoutStartPresentation(
    {
      activeWorkout,
      title: label,
      programName: progName,
      sessionDescription,
      effectiveDecision,
      planningContext,
      startSnapshot,
      schedule,
      legLifts: prog.legLifts || [],
      isSportDay,
      hadSportRecently,
      isDeload: bi.isDeload === true,
    },
    {
      t: i18nText,
      getWorkoutCommentaryState,
      presentTrainingCommentary,
      getWorkoutDecisionSummary,
      getTrainingToastColor,
    }
  );
  showToast(
    startPresentation?.immediateToast?.text ||
      (bi.isDeload
        ? i18nText('workout.deload_light', 'Deload - keep it light')
        : progName),
    startPresentation?.immediateToast?.color ||
      (bi.isDeload ? 'var(--blue)' : 'var(--purple)')
  );
  if (isLogActiveIslandActive()) notifyLogActiveIsland();
  if (isLogStartIslandActive()) notifyLogStartIsland();
  const queuedStartToasts = Array.isArray(startPresentation?.queuedToasts)
    ? startPresentation.queuedToasts
    : [];
  queuedStartToasts.forEach((toast) => {
    const delay = parseInt(String(toast.delay || 0), 10) || 0;
    setTimeout(() => showToast(toast.text, toast.color), delay);
  });
  if (!isReactActive) {
    document.getElementById('active-session-title').textContent =
      startPresentation?.title || label;
    const descEl = document.getElementById('active-session-description');
    if (descEl) {
      descEl.textContent =
        startPresentation?.descriptionText ||
        (sessionDescription
          ? `${i18nText('session.description', 'Session focus')}: ${sessionDescription}`
          : '');
      descEl.style.display =
        startPresentation?.descriptionVisible === false
          ? 'none'
          : sessionDescription
            ? ''
            : 'none';
    }
  }
}

// QUICK LOG
function quickLogSport() {
  const { sportName } = getSportQuickLogMeta();
  showConfirm(
    i18nText('workout.log_extra', 'Log Extra {sport}', { sport: sportName }),
    i18nText(
      'workout.log_extra_confirm',
      'Log an extra {sport} session for today?',
      { sport: sportName.toLowerCase() }
    ),
    async () => {
      const workout = {
        id: Date.now(),
        date: new Date().toISOString(),
        type: 'sport',
        subtype: 'extra',
        duration: 5400,
        exercises: [],
        rpe: 7,
        sets: 0,
      };
      workouts.push(workout);
      await upsertWorkoutRecord(workout);
      await saveWorkouts();
      showToast(
        i18nText('workout.extra_logged', 'Extra {sport} logged!', {
          sport: sportName,
        }),
        'var(--accent)'
      );
      updateDashboard();
    }
  );
}
function quickLogHockey() {
  quickLogSport();
}

// WORKOUT LOGGING
function getWorkoutElapsedSeconds() {
  if (!activeWorkout?.startTime) return 0;
  return Math.max(0, Math.floor((Date.now() - activeWorkout.startTime) / 1000));
}

function renderWorkoutTimer() {
  workoutSeconds = getWorkoutElapsedSeconds();
  if (isLogActiveIslandActive()) return;
  const m = String(Math.floor(workoutSeconds / 60)).padStart(2, '0');
  const s = String(workoutSeconds % 60).padStart(2, '0');
  const timerEl = document.getElementById('active-session-timer');
  if (timerEl) timerEl.textContent = m + ':' + s;
}

function clearWorkoutTimer() {
  if (workoutTimer) {
    clearInterval(workoutTimer);
    workoutTimer = null;
  }
}

function startWorkoutTimer() {
  clearWorkoutTimer();
  renderWorkoutTimer();
  workoutTimer = setInterval(renderWorkoutTimer, 1000);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderWorkoutTimer();
});
window.addEventListener('pageshow', renderWorkoutTimer);

const EXERCISE_CATALOG_FILTERS = {
  movement: [
    {
      value: 'squat',
      labelKey: 'catalog.filter.movement.squat',
      fallback: 'Squat',
    },
    {
      value: 'hinge',
      labelKey: 'catalog.filter.movement.hinge',
      fallback: 'Hinge',
    },
    {
      value: 'horizontal_press',
      labelKey: 'catalog.filter.movement.horizontal_press',
      fallback: 'Horizontal Press',
    },
    {
      value: 'vertical_press',
      labelKey: 'catalog.filter.movement.vertical_press',
      fallback: 'Vertical Press',
    },
    {
      value: 'horizontal_pull',
      labelKey: 'catalog.filter.movement.horizontal_pull',
      fallback: 'Horizontal Pull',
    },
    {
      value: 'vertical_pull',
      labelKey: 'catalog.filter.movement.vertical_pull',
      fallback: 'Vertical Pull',
    },
    {
      value: 'single_leg',
      labelKey: 'catalog.filter.movement.single_leg',
      fallback: 'Single-Leg',
    },
    {
      value: 'core',
      labelKey: 'catalog.filter.movement.core',
      fallback: 'Core',
    },
  ],
  muscle: [
    {
      value: 'chest',
      labelKey: 'dashboard.muscle_group.chest',
      fallback: 'Chest',
    },
    {
      value: 'back',
      labelKey: 'dashboard.muscle_group.back',
      fallback: 'Back',
    },
    {
      value: 'shoulders',
      labelKey: 'dashboard.muscle_group.shoulders',
      fallback: 'Shoulders',
    },
    {
      value: 'biceps',
      labelKey: 'dashboard.muscle_group.biceps',
      fallback: 'Biceps',
    },
    {
      value: 'triceps',
      labelKey: 'dashboard.muscle_group.triceps',
      fallback: 'Triceps',
    },
    {
      value: 'quads',
      labelKey: 'dashboard.muscle_group.quads',
      fallback: 'Quads',
    },
    {
      value: 'hamstrings',
      labelKey: 'dashboard.muscle_group.hamstrings',
      fallback: 'Hamstrings',
    },
    {
      value: 'glutes',
      labelKey: 'dashboard.muscle_group.glutes',
      fallback: 'Glutes',
    },
    {
      value: 'core',
      labelKey: 'dashboard.muscle_group.core',
      fallback: 'Core',
    },
  ],
  equipment: [
    {
      value: 'barbell',
      labelKey: 'catalog.filter.equipment.barbell',
      fallback: 'Barbell',
    },
    {
      value: 'dumbbell',
      labelKey: 'catalog.filter.equipment.dumbbell',
      fallback: 'Dumbbell',
    },
    {
      value: 'machine',
      labelKey: 'catalog.filter.equipment.machine',
      fallback: 'Machine',
    },
    {
      value: 'cable',
      labelKey: 'catalog.filter.equipment.cable',
      fallback: 'Cable',
    },
    {
      value: 'bodyweight',
      labelKey: 'catalog.filter.equipment.bodyweight',
      fallback: 'Bodyweight',
    },
    {
      value: 'pullup_bar',
      labelKey: 'catalog.filter.equipment.pullup_bar',
      fallback: 'Pull-up Bar',
    },
    {
      value: 'band',
      labelKey: 'catalog.filter.equipment.band',
      fallback: 'Band',
    },
    {
      value: 'trap_bar',
      labelKey: 'catalog.filter.equipment.trap_bar',
      fallback: 'Trap Bar',
    },
  ],
};

let exerciseCatalogState = null;
let exerciseCatalogListenersBound = false;

function getExerciseCatalogRuntimeBridge() {
  return window.__IRONFORGE_RUNTIME_BRIDGE__ || null;
}

function mergeExerciseCatalogFilterGroup(baseValues, selectedValue) {
  const base = arrayify(baseValues).filter(Boolean);
  if (!selectedValue) return base;
  if (!base.length) return [selectedValue];
  return base.includes(selectedValue) ? [selectedValue] : ['__no_match__'];
}

function getExerciseCatalogUserFilters() {
  return {
    movementTags: exerciseCatalogState?.movementTag
      ? [exerciseCatalogState.movementTag]
      : [],
    muscleGroups: exerciseCatalogState?.muscleGroup
      ? [exerciseCatalogState.muscleGroup]
      : [],
    equipmentTags: exerciseCatalogState?.equipmentTag
      ? [exerciseCatalogState.equipmentTag]
      : [],
  };
}

function getExerciseCatalogFilterPayload() {
  const base = exerciseCatalogState?.baseFilters || {};
  const ui = getExerciseCatalogUserFilters();
  return {
    categories: arrayify(base.categories),
    includeIds: arrayify(base.includeIds),
    excludeIds: arrayify(base.excludeIds),
    movementTags: mergeExerciseCatalogFilterGroup(
      base.movementTags,
      ui.movementTags[0] || ''
    ),
    muscleGroups: mergeExerciseCatalogFilterGroup(
      base.muscleGroups,
      ui.muscleGroups[0] || ''
    ),
    equipmentTags: mergeExerciseCatalogFilterGroup(
      base.equipmentTags,
      ui.equipmentTags[0] || ''
    ),
  };
}

function hasExerciseCatalogFilters() {
  return !!(
    exerciseCatalogState?.movementTag ||
    exerciseCatalogState?.muscleGroup ||
    exerciseCatalogState?.equipmentTag
  );
}

function isExerciseCatalogSwapMode() {
  return (
    exerciseCatalogState?.mode === 'swap' ||
    exerciseCatalogState?.mode === 'settings'
  );
}

function mergeExerciseCatalogLists(primary, extra) {
  const seen = new Set();
  return [...(primary || []), ...(extra || [])].filter((ex) => {
    const id = ex?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function getExerciseCatalogCandidateExercises(filters) {
  const candidateIds = arrayify(exerciseCatalogState?.candidateIds);
  if (!candidateIds.length) return [];
  return getWorkoutExerciseList({
    sort: 'featured',
    filters: {
      ...filters,
      includeIds: candidateIds,
      excludeIds: arrayify(exerciseCatalogState?.baseFilters?.excludeIds),
    },
  });
}

function getExerciseCatalogRecent(limit) {
  const ids = [];
  const seen = new Set();
  workouts
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((workout) => {
      (workout?.exercises || []).forEach((ex) => {
        const resolved = exerciseIdForName(ex.exerciseId || ex.name);
        if (!resolved || seen.has(resolved)) return;
        seen.add(resolved);
        ids.push(resolved);
      });
    });
  return ids
    .slice(0, limit)
    .map((id) => getWorkoutExercise(id))
    .filter(Boolean);
}

function getExerciseCatalogFeatured(limit, filters) {
  return getWorkoutExerciseList({
    sort: 'featured',
    filters: { ...filters, featuredOnly: true },
  }).slice(0, limit);
}

function getExerciseCatalogAll(filters) {
  return getWorkoutExerciseList({ sort: 'name', filters });
}

function getExerciseCatalogResults() {
  const search = exerciseCatalogState?.search || '';
  const filters = getExerciseCatalogFilterPayload();
  const userFilters = getExerciseCatalogUserFilters();
  if (search) {
    const baseResults = searchWorkoutExercises(search, {
      ...filters,
      limit: 120,
    });
    const candidateResults = getExerciseCatalogCandidateExercises({
      ...userFilters,
      limit: 120,
    });
    const searchedCandidates = search
      ? searchWorkoutExercises(search, {
          ...userFilters,
          includeIds: candidateResults.map((ex) => ex.id),
          excludeIds: arrayify(exerciseCatalogState?.baseFilters?.excludeIds),
          limit: 120,
        })
      : candidateResults;
    return mergeExerciseCatalogLists(baseResults, searchedCandidates).slice(
      0,
      120
    );
  }
  return mergeExerciseCatalogLists(
    getExerciseCatalogAll(filters),
    getExerciseCatalogCandidateExercises(userFilters)
  );
}

function getExerciseCatalogMetaLine(exercise) {
  const parts = [];
  const firstMovement = exercise?.movementTags?.[0];
  const firstMuscle = exercise?.displayMuscleGroups?.[0];
  const firstEquipment = exercise?.equipmentTags?.[0];
  if (firstMovement)
    parts.push(
      i18nText('catalog.filter.movement.' + firstMovement, firstMovement)
    );
  if (firstMuscle)
    parts.push(i18nText('dashboard.muscle_group.' + firstMuscle, firstMuscle));
  if (firstEquipment)
    parts.push(
      i18nText('catalog.filter.equipment.' + firstEquipment, firstEquipment)
    );
  return parts.join(' · ');
}

function renderExerciseCatalogSection(titleKey, fallback, items, emptyCopy) {
  if (!items.length && emptyCopy === false) return '';
  const body = items.length
    ? items
        .map(
          (ex) =>
            `<button type="button" class="catalog-item" data-exercise-id="${escapeHtml(ex.id)}" onclick="selectExerciseCatalogExercise(this.dataset.exerciseId||'')"><span class="catalog-item-main">${escapeHtml(displayExerciseName(ex.name))}</span><span class="catalog-item-meta">${escapeHtml(getExerciseCatalogMetaLine(ex))}</span></button>`
        )
        .join('')
    : `<div class="catalog-section-empty">${escapeHtml(emptyCopy || i18nText('catalog.section.empty', 'No exercises in this section yet.'))}</div>`;
  return `<section class="catalog-section"><div class="catalog-section-title">${escapeHtml(i18nText(titleKey, fallback))}</div>${body}</section>`;
}

function buildExerciseCatalogFilterGroups() {
  const groups = [
    {
      id: 'movement',
      labelKey: 'catalog.filter_group.movement',
      fallback: 'Movement',
      active: exerciseCatalogState?.movementTag || '',
      options: EXERCISE_CATALOG_FILTERS.movement,
    },
    {
      id: 'muscle',
      labelKey: 'catalog.filter_group.muscle',
      fallback: 'Muscle',
      active: exerciseCatalogState?.muscleGroup || '',
      options: EXERCISE_CATALOG_FILTERS.muscle,
    },
    {
      id: 'equipment',
      labelKey: 'catalog.filter_group.equipment',
      fallback: 'Equipment',
      active: exerciseCatalogState?.equipmentTag || '',
      options: EXERCISE_CATALOG_FILTERS.equipment,
    },
  ];
  return groups.map((group) => ({
    id: group.id,
    label: i18nText(group.labelKey, group.fallback),
    activeValue: group.active,
    options: [
      {
        value: '',
        label: i18nText('catalog.filter.all', 'All'),
      },
      ...group.options.map((option) => ({
        value: option.value,
        label: i18nText(option.labelKey, option.fallback),
      })),
    ],
  }));
}

function toExerciseCatalogItems(items) {
  return arrayify(items).map((ex) => ({
    id: ex.id,
    name: displayExerciseName(ex.name),
    meta: getExerciseCatalogMetaLine(ex),
  }));
}

function buildExerciseCatalogView() {
  if (!exerciseCatalogState) {
    return {
      open: false,
      mode: 'add',
      title: '',
      subtitle: '',
      search: '',
      clearVisible: false,
      emptyVisible: false,
      emptyCopy: i18nText(
        'catalog.empty',
        'No exercises matched your filters.'
      ),
      filters: [],
      sections: [],
    };
  }

  const title = i18nText(
    exerciseCatalogState?.titleKey || 'catalog.title.add',
    exerciseCatalogState?.titleFallback || 'Add Exercise',
    exerciseCatalogState?.titleParams
  );
  const subtitle = i18nText(
    exerciseCatalogState?.subtitleKey || 'catalog.sub',
    exerciseCatalogState?.subtitleFallback ||
      'Pick an exercise from the library or search by name.',
    exerciseCatalogState?.subtitleParams
  );
  const search = exerciseCatalogState?.search || '';
  const filters = buildExerciseCatalogFilterGroups();
  const clearVisible = !!(search || hasExerciseCatalogFilters());
  const emptyCopy = i18nText(
    'catalog.empty',
    'No exercises matched your filters.'
  );
  const payloadFilters = getExerciseCatalogFilterPayload();
  const userFilters = getExerciseCatalogUserFilters();
  let sections = [];
  let emptyVisible = false;

  if (search || hasExerciseCatalogFilters()) {
    const results = search
      ? getExerciseCatalogResults()
      : mergeExerciseCatalogLists(
          getExerciseCatalogAll(payloadFilters),
          getExerciseCatalogCandidateExercises(userFilters)
        );
    sections = results.length
      ? [
          {
            id: 'results',
            title: i18nText('catalog.section.results', 'Results'),
            items: toExerciseCatalogItems(results),
          },
        ]
      : [];
    emptyVisible = !results.length;
  } else if (isExerciseCatalogSwapMode()) {
    const results = getExerciseCatalogResults();
    sections = results.length
      ? [
          {
            id: 'swap',
            title: i18nText('catalog.section.swap', 'Available options'),
            items: toExerciseCatalogItems(results),
          },
        ]
      : [];
    emptyVisible = !results.length;
  } else {
    const recent = getExerciseCatalogRecent(8);
    const featured = getExerciseCatalogFeatured(10, {});
    const all = getExerciseCatalogAll({});
    sections = [
      {
        id: 'recent',
        title: i18nText('catalog.section.recent', 'Recently used'),
        items: toExerciseCatalogItems(recent),
        emptyCopy: i18nText(
          'catalog.section.recent_empty',
          'Log a few workouts and your recent exercises will show up here.'
        ),
      },
      {
        id: 'featured',
        title: i18nText('catalog.section.featured', 'Popular basics'),
        items: toExerciseCatalogItems(featured),
      },
      {
        id: 'all',
        title: i18nText('catalog.section.all', 'All exercises'),
        items: toExerciseCatalogItems(all),
      },
    ];
  }

  return {
    open: true,
    mode: exerciseCatalogState?.mode || 'add',
    title,
    subtitle,
    search,
    clearVisible,
    emptyVisible,
    emptyCopy,
    filters,
    sections,
  };
}

function pushExerciseCatalogView() {
  const bridge = getExerciseCatalogRuntimeBridge();
  if (!bridge || typeof bridge.setExerciseCatalogView !== 'function') return;
  bridge.setExerciseCatalogView(buildExerciseCatalogView());
}

function refreshExerciseCatalogCopy() {
  const titleEl = document.getElementById('name-modal-title');
  const subEl = document.getElementById('exercise-catalog-sub');
  if (titleEl)
    titleEl.textContent = i18nText(
      exerciseCatalogState?.titleKey || 'catalog.title.add',
      exerciseCatalogState?.titleFallback || 'Add Exercise',
      exerciseCatalogState?.titleParams
    );
  if (subEl)
    subEl.textContent = i18nText(
      exerciseCatalogState?.subtitleKey || 'catalog.sub',
      exerciseCatalogState?.subtitleFallback ||
        'Pick an exercise from the library or search by name.',
      exerciseCatalogState?.subtitleParams
    );
}

function renderExerciseCatalog() {
  pushExerciseCatalogView();
}

function ensureExerciseCatalogListeners() {
  if (exerciseCatalogListenersBound) return;
  exerciseCatalogListenersBound = true;
}

function resolveExerciseSelection(input) {
  const raw =
    typeof input === 'object' ? input?.name || input?.exerciseId || '' : input;
  const resolved =
    getWorkoutExercise(input) || getWorkoutExercise(exerciseIdForName(raw));
  return {
    exerciseId: resolved?.id || exerciseIdForName(raw),
    name: resolved?.name || String(raw || '').trim(),
  };
}

function inferExerciseCatalogSwapFilters(exercise, category) {
  const meta = getWorkoutExerciseMeta(
    exercise?.exerciseId || exercise?.name || exercise
  );
  const categoryFilters = {
    squat: {
      movementTags: ['squat'],
      equipmentTags: ['barbell', 'dumbbell', 'machine', 'bodyweight'],
      muscleGroups: ['quads', 'glutes'],
    },
    bench: {
      movementTags: ['horizontal_press'],
      equipmentTags: ['barbell', 'dumbbell', 'machine', 'bodyweight'],
      muscleGroups: ['chest', 'triceps', 'shoulders'],
    },
    deadlift: {
      movementTags: ['hinge'],
      equipmentTags: [
        'barbell',
        'trap_bar',
        'dumbbell',
        'machine',
        'bodyweight',
      ],
      muscleGroups: ['hamstrings', 'glutes', 'back'],
    },
    ohp: {
      movementTags: ['vertical_press'],
      equipmentTags: ['barbell', 'dumbbell', 'machine', 'bodyweight'],
      muscleGroups: ['shoulders', 'triceps'],
    },
    back: {
      movementTags: ['horizontal_pull', 'vertical_pull'],
      equipmentTags: [
        'barbell',
        'dumbbell',
        'cable',
        'machine',
        'pullup_bar',
        'bodyweight',
      ],
      muscleGroups: ['back', 'biceps'],
    },
    core: {
      movementTags: ['core'],
      equipmentTags: ['bodyweight', 'cable', 'band', 'pullup_bar'],
      muscleGroups: ['core'],
    },
    pressing: {
      movementTags: ['horizontal_press', 'vertical_press'],
      equipmentTags: ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable'],
      muscleGroups: ['chest', 'shoulders', 'triceps'],
    },
    triceps: {
      movementTags: ['isolation', 'horizontal_press', 'vertical_press'],
      equipmentTags: ['bodyweight', 'cable', 'dumbbell', 'barbell'],
      muscleGroups: ['triceps'],
    },
    'single-leg': {
      movementTags: ['single_leg', 'squat'],
      equipmentTags: ['dumbbell', 'bodyweight', 'machine'],
      muscleGroups: ['quads', 'glutes'],
    },
    'upper back': {
      movementTags: ['horizontal_pull'],
      equipmentTags: ['barbell', 'dumbbell', 'cable', 'machine'],
      muscleGroups: ['back', 'biceps'],
    },
    'posterior chain': {
      movementTags: ['hinge'],
      equipmentTags: ['barbell', 'machine', 'bodyweight'],
      muscleGroups: ['hamstrings', 'glutes', 'back'],
    },
    'vertical pull': {
      movementTags: ['vertical_pull'],
      equipmentTags: ['pullup_bar', 'bodyweight', 'cable', 'machine'],
      muscleGroups: ['back', 'biceps'],
    },
  };
  if (categoryFilters[category]) return categoryFilters[category];
  return {
    movementTags: (meta?.movementTags || []).slice(0, 2),
    equipmentTags: (meta?.equipmentTags || []).slice(0, 3),
    muscleGroups: (meta?.displayMuscleGroups || []).slice(0, 2),
  };
}

function getResolvedCatalogOptionExercises(options) {
  const seen = new Set();
  return arrayify(options)
    .map((option) => {
      const resolved =
        getWorkoutExercise(option) ||
        getWorkoutExercise(exerciseIdForName(option)) ||
        registerWorkoutExercise({ name: option });
      if (!resolved || seen.has(resolved.id)) return null;
      seen.add(resolved.id);
      return resolved;
    })
    .filter(Boolean);
}

function openExerciseCatalogPicker(config) {
  const next = config || {};
  ensureExerciseCatalogListeners();
  const intent = next.intent || 'add';
  if (intent === 'add') {
    nameModalCallback =
      next.onSubmit || next.callback || nameModalCallback || addExerciseByName;
    exerciseCatalogState = {
      mode: 'add',
      search: '',
      movementTag: '',
      muscleGroup: '',
      equipmentTag: '',
      baseFilters: {},
      candidateIds: [],
      titleKey: 'catalog.title.add',
      titleFallback: next.title || 'Add Exercise',
      titleParams: next.titleParams || null,
      subtitleKey: 'catalog.sub',
      subtitleFallback:
        next.subtitle || 'Pick an exercise from the library or search by name.',
      subtitleParams: next.subtitleParams || null,
      onSelect: null,
    };
    renderExerciseCatalog();
    setTimeout(() => document.getElementById('name-modal-input')?.focus(), 80);
    return true;
  }

  const exercise =
    next.exercise || activeWorkout?.exercises?.[next.exerciseIndex];
  if (!exercise) return false;
  const info = Array.isArray(next.swapInfo)
    ? { options: next.swapInfo }
    : next.swapInfo || {};
  const current = resolveExerciseSelection(exercise);
  const fallbackOptions = getResolvedCatalogOptionExercises(
    next.options || info.options || []
  );
  const configuredFilters = next.filters || info.filters || null;
  const baseFilters = {
    ...(configuredFilters ||
      inferExerciseCatalogSwapFilters(
        exercise,
        info.category || next.category || ''
      )),
  };
  const excludeIds = arrayify(info.excludeIds);
  if (intent === 'swap' && current.exerciseId)
    excludeIds.push(current.exerciseId);
  baseFilters.excludeIds = uniqueList(excludeIds);
  const candidateIds = uniqueList([
    ...arrayify(info.includeIds),
    ...fallbackOptions.map((ex) => ex.id),
  ]);
  const defaultSubtitle =
    intent === 'settings'
      ? 'Choose the exercise variant this program should use.'
      : 'Showing options limited by the current exercise and program rules.';
  exerciseCatalogState = {
    mode: intent,
    search: '',
    movementTag: '',
    muscleGroup: '',
    equipmentTag: '',
    baseFilters,
    candidateIds,
    titleKey:
      intent === 'settings' ? 'catalog.title.settings' : 'catalog.title.swap',
    titleFallback:
      next.title ||
      (intent === 'settings' ? 'Choose Exercise' : 'Swap Exercise'),
    titleParams: next.titleParams || null,
    subtitleKey:
      intent === 'settings' ? 'catalog.sub.settings' : 'catalog.sub.swap',
    subtitleFallback: next.subtitle || defaultSubtitle,
    subtitleParams:
      next.subtitleParams ||
      (intent === 'swap' ? { name: displayExerciseName(current.name) } : null),
    onSelect: next.onSelect || null,
  };
  renderExerciseCatalog();
  setTimeout(() => document.getElementById('name-modal-input')?.focus(), 80);
  return true;
}

function openExerciseCatalogForAdd(title, cb) {
  return openExerciseCatalogPicker({ intent: 'add', title, callback: cb });
}

function openExerciseCatalogForSwap(config) {
  return openExerciseCatalogPicker({ ...config, intent: 'swap' });
}

function openExerciseCatalogForSettings(config) {
  return openExerciseCatalogPicker({ ...config, intent: 'settings' });
}

function setExerciseCatalogFilter(group, value) {
  if (!exerciseCatalogState) return;
  if (group === 'movement') exerciseCatalogState.movementTag = value || '';
  if (group === 'muscle') exerciseCatalogState.muscleGroup = value || '';
  if (group === 'equipment') exerciseCatalogState.equipmentTag = value || '';
  renderExerciseCatalog();
}

function setExerciseCatalogSearch(value) {
  if (!exerciseCatalogState) return;
  exerciseCatalogState.search = value || '';
  renderExerciseCatalog();
}

function clearExerciseCatalogFilters() {
  if (!exerciseCatalogState) return;
  exerciseCatalogState.search = '';
  exerciseCatalogState.movementTag = '';
  exerciseCatalogState.muscleGroup = '';
  exerciseCatalogState.equipmentTag = '';
  renderExerciseCatalog();
  document.getElementById('name-modal-input')?.focus();
}

function resetExerciseCatalogState() {
  exerciseCatalogState = null;
  renderExerciseCatalog();
}

function selectExerciseCatalogExercise(exerciseId) {
  const exercise = getWorkoutExercise(exerciseId);
  if (!exercise) return;
  const onSelect = exerciseCatalogState?.onSelect || null;
  const cb = nameModalCallback;
  nameModalCallback = null;
  exerciseCatalogState = null;
  renderExerciseCatalog();
  if (onSelect) {
    onSelect(exercise);
    return;
  }
  if (cb) cb(exercise.name);
}

function submitExerciseCatalogSelection() {
  const first = getExerciseCatalogResults()[0];
  if (first) selectExerciseCatalogExercise(first.id);
}

function addExerciseByName(name) {
  if (!activeWorkout) return;
  const resolved = resolveExerciseSelection(name);
  const exerciseId = resolved.exerciseId;
  const canonicalName = resolved.name;
  const suggested = getSuggested({ name: canonicalName, exerciseId });
  const exercise = ensureWorkoutExerciseUiKeys([
    {
      id: Date.now() + Math.random(),
      exerciseId,
      name: canonicalName,
      note: '',
      sets: [
        { weight: suggested || '', reps: 5, done: false, rpe: null },
        { weight: suggested || '', reps: 5, done: false, rpe: null },
        { weight: suggested || '', reps: 5, done: false, rpe: null },
      ],
    },
  ])[0];
  activeWorkout.exercises.push(exercise);
  persistCurrentWorkoutDraft();
  appendExerciseCard(exercise);
  renderActiveWorkoutPlanPanel();
}

function sanitizeSetValue(field, raw) {
  return getWorkoutRuntime().sanitizeSetValue(field, raw);
}

function getCurrentWorkoutRounding() {
  const state =
    typeof getActiveProgramState === 'function'
      ? getActiveProgramState()
      : null;
  const rounding = parseFloat(state?.rounding);
  return Number.isFinite(rounding) && rounding > 0 ? rounding : 2.5;
}

function parseLoggedRepCount(raw) {
  const reps = parseInt(raw, 10);
  return Number.isFinite(reps) && reps >= 0 ? reps : null;
}

function updateSet(ei, si, f, v) {
  const exercise = activeWorkout.exercises[ei];
  const set = exercise?.sets?.[si];
  if (!set) return;
  const mutation =
    window.__IRONFORGE_WORKOUT_RUNTIME__?.applySetUpdateMutation?.({
      exercise,
      setIndex: si,
      field: f,
      rawValue: v,
    }) || null;
  const sanitizedValue =
    mutation?.sanitizedValue !== undefined
      ? mutation.sanitizedValue
      : sanitizeSetValue(f, v);
  const shouldRefreshDoneSet =
    mutation?.shouldRefreshDoneSet !== undefined
      ? mutation.shouldRefreshDoneSet
      : set.done && !set.isWarmup && (f === 'weight' || f === 'reps');
  if (!mutation) {
    set[f] = sanitizedValue;
  }
  if (shouldRefreshDoneSet) {
    set.isPr = false;
    rebuildActiveWorkoutRewardState();
    detectSetPr(exercise, set, si);
  }
  persistCurrentWorkoutDraft();
  const exerciseUiKey = ensureExerciseUiKey(exercise);
  if (isLogActiveIslandActive()) {
    notifyLogActiveIsland();
    return;
  }
  if (f !== 'weight') {
    if (shouldRefreshDoneSet) {
      updateExerciseCard(exerciseUiKey);
      renderActiveWorkoutPlanPanel();
    }
    return;
  }
  if (set.isWarmup) return;
  const propagatedSetIndexes = Array.isArray(mutation?.propagatedSetIndexes)
    ? mutation.propagatedSetIndexes
    : [];
  const weightIndexesToRefresh = propagatedSetIndexes.length
    ? propagatedSetIndexes
    : (() => {
        const indexes = [];
        for (let nextIndex = si + 1; nextIndex < exercise.sets.length; nextIndex++) {
          const nextSet = exercise.sets[nextIndex];
          if (nextSet.done || nextSet.isWarmup) continue;
          nextSet.weight = sanitizedValue;
          indexes.push(nextIndex);
        }
        return indexes;
      })();
  for (const nextIndex of weightIndexesToRefresh) {
    const weightInput = document.getElementById(
      getSetInputId(exerciseUiKey, nextIndex, 'weight')
    );
    if (weightInput) weightInput.value = sanitizedValue;
  }
  if (shouldRefreshDoneSet) {
    updateExerciseCard(exerciseUiKey);
    renderActiveWorkoutPlanPanel();
  }
}

function findNextEditableSetInputId(exerciseUiKey, setIndex, field) {
  const exerciseIndex = getExerciseIndexByUiKey(exerciseUiKey);
  if (exerciseIndex < 0) return null;
  if (field === 'weight') {
    return getSetInputId(exerciseUiKey, setIndex, 'reps');
  }
  for (
    let nextSetIndex = setIndex + 1;
    nextSetIndex <
    (activeWorkout?.exercises?.[exerciseIndex]?.sets || []).length;
    nextSetIndex++
  ) {
    const nextSet = activeWorkout.exercises[exerciseIndex].sets[nextSetIndex];
    if (nextSet?.isWarmup) continue;
    return getSetInputId(exerciseUiKey, nextSetIndex, 'weight');
  }
  for (
    let nextExerciseIndex = exerciseIndex + 1;
    nextExerciseIndex < (activeWorkout?.exercises?.length || 0);
    nextExerciseIndex++
  ) {
    const nextExercise = activeWorkout.exercises[nextExerciseIndex];
    const firstWorkIndex =
      nextExercise?.sets?.findIndex((set) => !set.isWarmup) ?? -1;
    if (firstWorkIndex < 0) continue;
    return getSetInputId(
      ensureExerciseUiKey(nextExercise),
      firstWorkIndex,
      'weight'
    );
  }
  return null;
}

function handleSetInputKey(event, exerciseUiKey, setIndex, field) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const exerciseIndex = getExerciseIndexByUiKey(exerciseUiKey);
  if (exerciseIndex < 0) return;
  updateSet(exerciseIndex, setIndex, field, event.target.value);
  const nextInputId = findNextEditableSetInputId(exerciseUiKey, setIndex, field);
  if (!nextInputId) return;
  if (isLogActiveIslandActive()) {
    queueLogActiveFocusTarget(nextInputId);
    notifyLogActiveIsland();
    return;
  }
  const nextInput = document.getElementById(nextInputId);
  if (nextInput) nextInput.focus();
}

function tryHaptic(pattern) {
  try {
    if (navigator.vibrate && !prefersReducedMotionUI())
      navigator.vibrate(pattern);
  } catch (e) {}
}

function spawnForgeEmbers(checkEl, options) {
  if (prefersReducedMotionUI()) return;
  const config = options || {};
  const rect = checkEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors =
    Array.isArray(config.colors) && config.colors.length
      ? config.colors
      : ['#ffa040', '#ff8c1a', '#ffcc66', '#ff6a1a', '#ffd699', '#fff0d0'];
  const count = Math.max(1, parseInt(config.count, 10) || 8);
  const distanceMin = parseFloat(config.distanceMin) || 28;
  const distanceMax = parseFloat(config.distanceMax) || 50;
  const sizeMin = parseFloat(config.sizeMin) || 3;
  const sizeMax = parseFloat(config.sizeMax) || 6;
  for (let i = 0; i < count; i++) {
    const angle = ((Math.PI * 2) / count) * i + (Math.random() - 0.5) * 0.6;
    const dist =
      distanceMin + Math.random() * Math.max(1, distanceMax - distanceMin);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const ember = document.createElement('span');
    ember.className = 'forge-ember';
    const size = sizeMin + Math.random() * Math.max(0.5, sizeMax - sizeMin);
    ember.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px;--ember-x:${dx}px;--ember-y:${dy}px;--ember-color:${colors[i % colors.length]};position:fixed;`;
    document.body.appendChild(ember);
    ember.addEventListener('animationend', () => ember.remove(), {
      once: true,
    });
  }
}

function toggleSet(ei, si) {
  const exercise = activeWorkout.exercises[ei];
  const set = exercise?.sets?.[si];
  if (!exercise || !set) return;
  const exerciseUiKey = ensureExerciseUiKey(exercise);
  const isReactActive = isLogActiveIslandActive();
  const toggleResult =
    window.__IRONFORGE_WORKOUT_RUNTIME__?.toggleWorkoutSetCompletion?.({
      exercise,
      setIndex: si,
    }) || null;
  const isNowDone =
    toggleResult?.isNowDone !== undefined ? toggleResult.isNowDone : !set.done;
  if (!toggleResult) {
    if (isNowDone) {
      set.done = true;
    } else {
      set.done = false;
      set.rir = undefined;
    }
  }
  if (isNowDone) {
    const prEvent = detectSetPr(exercise, set, si);
    tryHaptic(40);
    if (isReactActive) {
      queueLogActiveSetSignal(exerciseUiKey, si, prEvent);
      if (prEvent) {
        showToast(
          i18nText('workout.pr_toast', 'New PR! {name} {weight}kg x {reps}', {
            name: prEvent.exerciseName,
            weight: formatWorkoutWeight(prEvent.weight),
            reps: prEvent.reps,
          }),
          'var(--yellow)'
        );
      }
      if (isExerciseComplete(exercise)) {
        window.setTimeout(() => {
          const currentExercise = getExerciseByUiKey(exerciseUiKey);
          if (!currentExercise || !isExerciseComplete(currentExercise)) return;
          setExerciseCardCollapsed(currentExercise, true);
          queueLogActiveCollapseSignal(exerciseUiKey);
          notifyLogActiveIsland();
        }, prEvent ? 950 : 500);
      }
      notifyLogActiveIsland();
    } else {
      const row = getExerciseCardElement(exerciseUiKey)?.querySelector(
        getSetRowSelector(si)
      );
      const check = row?.querySelector('.set-check');
      if (row) row.classList.add('is-done', 'set-done-anim');
      if (check) {
        check.classList.add('done', 'set-done-anim');
        check.addEventListener(
          'animationend',
          () => check.classList.remove('set-done-anim'),
          { once: true }
        );
        spawnForgeEmbers(check);
      }
      if (row) {
        row.addEventListener(
          'animationend',
          () => row.classList.remove('set-done-anim'),
          { once: true }
        );
      }
      if (prEvent && row && check) {
        window.setTimeout(() => playSetPrCelebration(row, check, prEvent), 500);
      }
      if (isExerciseComplete(exercise)) {
        setExerciseCardCollapsed(exercise, true);
        const card = getExerciseCardElement(exerciseUiKey);
        if (card) {
          // Delay the collapse animation so the last set's forge strike plays first
          window.setTimeout(
            () => runForgeSealCollapse(card, exerciseUiKey),
            prEvent ? 950 : 500
          );
        }
      }
    }
    startRestTimer();
    if (shouldPromptForSetRIR(exercise, si)) {
      // Delay RIR prompt so forge strike + collapse animations finish first.
      // Timing budget (CSS): forgeStrike 420ms + forgeSeal 300ms + seal-enter 320ms.
      // With PR celebration (+500ms). Without collapse the strike alone needs ~550ms.
      const rirDelay = isExerciseComplete(exercise)
        ? prEvent
          ? 1250
          : 900
        : prEvent
          ? 900
          : 550;
      window.setTimeout(() => showSetRIRPrompt(ei, si), rirDelay);
    }
  } else {
    clearSetPr(exercise, set, si);
    delete collapsedExerciseCardState[exerciseUiKey];
    persistCurrentWorkoutDraft();
    updateExerciseCard(exerciseUiKey);
    renderActiveWorkoutPlanPanel();
    return;
  }
  persistCurrentWorkoutDraft();
  renderActiveWorkoutPlanPanel();
}

function addSet(ei) {
  const exercise = activeWorkout.exercises[ei];
  if (!exercise) return;
  const exerciseUiKey = ensureExerciseUiKey(exercise);
  delete collapsedExerciseCardState[exerciseUiKey];
  const appendResult =
    window.__IRONFORGE_WORKOUT_RUNTIME__?.appendWorkoutSet?.({
      exercise,
    }) || null;
  if (!appendResult) {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    exercise.sets.push({
      weight: lastSet?.weight || '',
      reps: lastSet?.reps || 5,
      done: false,
      rpe: null,
    });
  }
  persistCurrentWorkoutDraft();
  const newSetIndex =
    appendResult?.newSetIndex ?? exercise.sets.length - 1;
  const newInputId = getSetInputId(exerciseUiKey, newSetIndex, 'weight');
  if (isLogActiveIslandActive()) queueLogActiveFocusTarget(newInputId);
  updateExerciseCard(exerciseUiKey);
  renderActiveWorkoutPlanPanel();
  const weightInput = document.getElementById(newInputId);
  if (weightInput && !isLogActiveIslandActive()) weightInput.focus();
}

function removeEx(ei) {
  const removal =
    window.__IRONFORGE_WORKOUT_RUNTIME__?.removeWorkoutExercise?.({
      exercises: activeWorkout.exercises,
      exerciseIndex: ei,
    }) || null;
  const removed = removal?.removed || activeWorkout.exercises.splice(ei, 1)[0];
  const removedUiKey = removed?.uiKey || null;
  if (removedUiKey) delete collapsedExerciseCardState[removedUiKey];
  if (removedUiKey) removeExerciseCard(removedUiKey);
  persistCurrentWorkoutDraft();
  renderActiveWorkoutPlanPanel();
  if (removed) {
    showToast(
      escapeHtml(
        i18nText('workout.exercise_removed', '{name} removed', {
          name: displayExerciseName(removed.name),
        })
      ),
      'var(--muted)',
      () => {
        ensureExerciseUiKey(removed);
        activeWorkout.exercises.splice(ei, 0, removed);
        persistCurrentWorkoutDraft();
        insertExerciseCard(ei, removed);
        renderActiveWorkoutPlanPanel();
      }
    );
  }
}

function swapAuxExercise(ei) {
  const exercise = activeWorkout.exercises[ei];
  if (!exercise || exercise.auxSlotIdx < 0) return;
  const exerciseUiKey = ensureExerciseUiKey(exercise);
  const prog = getActiveProgram();
  const swapInfo = prog.getAuxSwapOptions
    ? prog.getAuxSwapOptions(exercise)
    : null;
  if (!swapInfo) return;
  const cat = swapInfo.category || '';
  const title = cat
    ? i18nText('workout.swap_aux_category', 'Swap {cat} auxiliary', {
        cat: cat.charAt(0).toUpperCase() + cat.slice(1),
      })
    : i18nText('workout.swap_exercise', 'Swap exercise');
  openExerciseCatalogForSwap({
    exerciseIndex: ei,
    exercise,
    swapInfo,
    title,
    onSelect: (selected) =>
      doAuxSwap(exerciseUiKey, selected.name, exercise.auxSlotIdx),
  });
}

function doAuxSwap(exerciseUiKey, newName, slotIdx) {
  const exerciseIndex = getExerciseIndexByUiKey(exerciseUiKey);
  if (exerciseIndex < 0) return;
  const resolved = resolveExerciseSelection(newName);
  activeWorkout.exercises[exerciseIndex].name = resolved.name;
  activeWorkout.exercises[exerciseIndex].exerciseId = resolved.exerciseId;
  persistCurrentWorkoutDraft();
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  const newState = prog.onAuxSwap
    ? prog.onAuxSwap(slotIdx, resolved.name, state)
    : state;
  setProgramState(prog.id, newState);
  saveProfileData({ programIds: [prog.id] });
  updateExerciseCard(exerciseUiKey);
  renderActiveWorkoutPlanPanel();
  showToast(
    i18nText('workout.swapped_to', 'Swapped to {name}', {
      name: displayExerciseName(resolved.name),
    }),
    'var(--purple)'
  );
}

function swapBackExercise(ei) {
  const exercise = activeWorkout.exercises[ei];
  if (!exercise) return;
  const exerciseUiKey = ensureExerciseUiKey(exercise);
  const prog = getActiveProgram();
  const swapInfo = prog.getBackSwapOptions
    ? prog.getBackSwapOptions(exercise)
    : [];
  if (!swapInfo) return;
  openExerciseCatalogForSwap({
    exerciseIndex: ei,
    exercise,
    swapInfo,
    title: i18nText('workout.swap_back_title', 'Swap Back Exercise'),
    onSelect: (selected) => doBackSwap(exerciseUiKey, selected.name),
  });
}

function doBackSwap(exerciseUiKey, newName) {
  const exerciseIndex = getExerciseIndexByUiKey(exerciseUiKey);
  if (exerciseIndex < 0) return;
  const resolved = resolveExerciseSelection(newName);
  activeWorkout.exercises[exerciseIndex].name = resolved.name;
  activeWorkout.exercises[exerciseIndex].exerciseId = resolved.exerciseId;
  persistCurrentWorkoutDraft();
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  const newState = prog.onBackSwap
    ? prog.onBackSwap(resolved.name, state)
    : state;
  setProgramState(prog.id, newState);
  saveProfileData({ programIds: [prog.id] });
  updateExerciseCard(exerciseUiKey);
  renderActiveWorkoutPlanPanel();
  showToast(
    i18nText('workout.swapped_to', 'Swapped to {name}', {
      name: displayExerciseName(resolved.name),
    }),
    'var(--purple)'
  );
}

function showCustomModal(title, bodyHtml) {
  let m = document.getElementById('custom-swap-modal');
  if (m) m.remove();
  m = document.createElement('div');
  m.id = 'custom-swap-modal';
  m.className = 'custom-modal-overlay';
  m.innerHTML = `<div class="custom-modal-sheet">
    <div class="custom-modal-title">${title}</div>
    ${bodyHtml}
    <button class="btn btn-secondary custom-modal-cancel" type="button" data-custom-modal-action="close">${i18nText('common.cancel', 'Cancel')}</button>
  </div>`;
  m.onclick = (e) => {
    if (e.target === m) {
      closeCustomModal();
      return;
    }
    const actionTarget = e.target?.closest?.('[data-custom-modal-action]');
    if (!actionTarget || !m.contains(actionTarget)) return;
    const action = actionTarget.dataset.customModalAction || '';
    if (action === 'close' || action === 'skip-set-rir') {
      closeCustomModal();
      return;
    }
    if (action === 'apply-set-rir') {
      applySetRIR(
        Number(actionTarget.dataset.exerciseIndex),
        Number(actionTarget.dataset.setIndex),
        actionTarget.dataset.rirValue || ''
      );
      return;
    }
    if (action === 'select-shorten-adjustment') {
      selectShortenAdjustment(actionTarget.dataset.adjustmentLevel || 'medium');
    }
  };
  document.body.appendChild(m);
}

function closeCustomModal() {
  const m = document.getElementById('custom-swap-modal');
  if (m) m.remove();
}

function buildCoachNote(
  summaryData,
  stateBeforeSession,
  advancedState,
  workout
) {
  return getWorkoutRuntime().buildCoachNote(
    {
      summaryData,
      stateBeforeSession,
      advancedState,
      workout,
    },
    {
      t: i18nText,
      formatWorkoutWeight,
    }
  );
}

function formatWorkoutWeight(value) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  if (!Number.isFinite(rounded)) return '0';
  return String(rounded)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

function buildTmAdjustmentCoachSummary(adjustments) {
  const items = Array.isArray(adjustments) ? adjustments.slice(0, 2) : [];
  if (!items.length) return '';
  return items
    .map((adj) =>
      i18nText(
        adj.direction === 'up'
          ? 'workout.coach_note.tm_adjustment_up'
          : 'workout.coach_note.tm_adjustment_down',
        adj.direction === 'up'
          ? '{lift} TM ↑ {tm} kg (+{delta})'
          : '{lift} TM ↓ {tm} kg (-{delta})',
        {
          lift: adj.lift,
          tm: formatWorkoutWeight(adj.newTM),
          delta: formatWorkoutWeight(Math.abs(adj.delta)),
        }
      )
    )
    .join(' · ');
}

function buildTmAdjustmentToast(adjustments) {
  return getWorkoutRuntime().buildTmAdjustmentToast(adjustments, {
    t: i18nText,
    formatWorkoutWeight,
  });
}

function buildSessionSummaryStats(summaryData) {
  return getWorkoutRuntime().buildSessionSummaryStats(summaryData, {
    t: i18nText,
    formatDuration: formatWorkoutDuration,
    formatTonnage: formatWorkoutTonnage,
  });
}

function animateSessionSummaryStats(modal, stats) {
  const runInstant = prefersReducedMotionUI();
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  stats.forEach((stat, index) => {
    const card = modal.querySelector(`.summary-stat-${stat.key}`);
    const valueEl = modal.querySelector(`[data-stat-key="${stat.key}"]`);
    if (!card || !valueEl) return;
    const applyValue = (value) => {
      valueEl.dataset.statValue = String(value);
      valueEl.textContent = stat.formatter(value);
    };
    if (runInstant) {
      card.classList.add('is-visible');
      applyValue(stat.value);
      return;
    }
    window.setTimeout(() => {
      card.classList.add('is-visible');
      const start = performance.now();
      const duration = 800;
      function frame(now) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = easeOutCubic(progress);
        applyValue(stat.value * eased);
        if (progress < 1) {
          requestAnimationFrame(frame);
          return;
        }
        applyValue(stat.value);
      }
      requestAnimationFrame(frame);
    }, index * 100);
  });
}

function startSessionSummaryCelebration(modal, summaryData) {
  const cleanup = window._summaryCleanup;
  if (typeof cleanup === 'function') cleanup();
  window._summaryCleanup = null;
  if (!modal) return;
  const canvas = modal.querySelector('.summary-burst-canvas');
  if (
    canvas &&
    typeof window.playForgeBurst === 'function' &&
    !prefersReducedMotionUI()
  ) {
    window._summaryCleanup = window.playForgeBurst(canvas, {
      densityMultiplier: 2,
      duration: 1100,
      originY: 0.8,
      glowFrom: 0.18,
      glowTo: 0.4,
    });
    tryHaptic([40, 80, 40]);
  }
  animateSessionSummaryStats(modal, buildSessionSummaryStats(summaryData));
}
window.startSessionSummaryCelebration = startSessionSummaryCelebration;

function showSessionSummary(summaryData) {
  return new Promise((resolve) => {
    const stats = buildSessionSummaryStats(summaryData);
    const canLogNutrition =
      typeof window.isNutritionCoachAvailable === 'function'
        ? window.isNutritionCoachAvailable()
        : !!currentUser;
    pendingSummaryPromptState = {
      open: true,
      seed: Date.now(),
      kicker: i18nText('workout.session_complete', 'Session Complete'),
      title: 'SESSION FORGED',
      programLabel: summaryData.programLabel || '',
      coachNote: summaryData.coachNote || '',
      notesLabel: i18nText('workout.summary.notes_label', 'Session notes'),
      notesPlaceholder: i18nText(
        'workout.summary.notes_placeholder',
        'Any notes about this session?'
      ),
      feedbackLabel: i18nText(
        'workout.summary.feedback_label',
        'How did it feel?'
      ),
      feedbackOptions: [
        {
          value: 'too_hard',
          label: i18nText('workout.summary.feedback_too_hard', 'Too hard'),
        },
        {
          value: 'good',
          label: i18nText('workout.summary.feedback_good', 'Good'),
        },
        {
          value: 'too_easy',
          label: i18nText('workout.summary.feedback_too_easy', 'Too easy'),
        },
      ],
      nutritionLabel: i18nText(
        'workout.summary.log_post_workout_meal',
        'Log post-workout meal'
      ),
      doneLabel: i18nText('common.done', 'Done'),
      notes: '',
      feedback: null,
      canLogNutrition,
      stats: stats.map((stat) => ({
        key: stat.key,
        accent: stat.accent || '',
        label: stat.label,
        initialText: stat.formatter(0),
      })),
      summaryData: { ...summaryData },
    };
    notifySummaryOverlayShell();
    window._summaryResolve = resolve;
  });
}
function closeSummaryModal(goToNutrition) {
  const modal = document.getElementById('summary-modal');
  modal?.classList.remove('active', 'reduced-motion');
  if (typeof window._summaryCleanup === 'function') window._summaryCleanup();
  window._summaryCleanup = null;
  const feedback =
    pendingSummaryPromptState?.feedback || window._summaryFeedbackValue || null;
  const notes = String(
    pendingSummaryPromptState?.notes ||
      document.getElementById('summary-notes-textarea')?.value ||
      ''
  )
    .trim()
    .slice(0, 500);
  pendingSummaryPromptState = null;
  notifySummaryOverlayShell();
  window._summaryFeedbackValue = null;
  if (window._summaryResolve) {
    window._summaryResolve({
      feedback,
      notes,
      goToNutrition: goToNutrition === true,
    });
    window._summaryResolve = null;
  }
}
function setSummaryFeedback(value) {
  window._summaryFeedbackValue = value;
  if (pendingSummaryPromptState) {
    pendingSummaryPromptState = {
      ...pendingSummaryPromptState,
      feedback: value,
    };
    notifySummaryOverlayShell();
    if (typeof tryHaptic === 'function') tryHaptic([20]);
    return;
  }
  document.querySelectorAll('.summary-feedback-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.feedback === value);
  });
  if (typeof tryHaptic === 'function') tryHaptic([20]);
}

function updateSummaryNotes(value) {
  if (!pendingSummaryPromptState) return;
  pendingSummaryPromptState = {
    ...pendingSummaryPromptState,
    notes: String(value || '').slice(0, 500),
  };
  notifySummaryOverlayShell();
}

window.updateSummaryNotes = updateSummaryNotes;

function applyQuickWorkoutAdjustment(mode) {
  if (mode === 'shorten') {
    showShortenAdjustmentOptions();
    return;
  }
  const preview = getQuickAdjustmentPreview(mode);
  showConfirm(preview.title, preview.body, () =>
    executeQuickWorkoutAdjustment(mode)
  );
}

function executeQuickWorkoutAdjustment(mode, detailLevel) {
  if (!activeWorkout?.exercises?.length) return;
  ensureWorkoutCommentaryRecord(activeWorkout);
  const previousSnapshot = {
    exercises: cloneWorkoutExercises(activeWorkout.exercises),
    mode:
      activeWorkout.runnerState?.mode ||
      activeWorkout.planningDecision?.action ||
      'train',
    adjustments: (activeWorkout.runnerState?.adjustments || []).map((item) => ({
      ...item,
    })),
    commentary: activeWorkout.commentary
      ? JSON.parse(JSON.stringify(activeWorkout.commentary))
      : null,
  };
  const exercises = cloneWorkoutExercises(activeWorkout.exercises);
  let changed = false;
  if (mode === 'shorten') {
    const level = detailLevel || 'medium';
    if (level === 'light') {
      exercises.forEach((exercise) => {
        if (exercise.isAccessory && trimExerciseRemainingSets(exercise, 0))
          changed = true;
      });
    } else {
      exercises.forEach((exercise) => {
        if (exercise.isAccessory) {
          if (trimExerciseRemainingSets(exercise, 0)) changed = true;
          return;
        }
        if (
          trimExerciseRemainingSets(
            exercise,
            Math.max(0, 2 - getCompletedSetCount(exercise))
          )
        )
          changed = true;
      });
      if (level === 'hard' && dropTrailingUnstartedExercise(exercises))
        changed = true;
    }
  } else if (mode === 'lighten') {
    exercises.forEach((exercise) => {
      if (trimOneExtraRemainingSet(exercise, 'lighten')) changed = true;
      (exercise.sets || []).forEach((set) => {
        if (reduceRemainingSetTarget(set)) changed = true;
      });
    });
  }
  const cleanedExercises = cleanupAdjustedWorkoutExercises(exercises);
  if (changed) {
    activeWorkout.exercises = cleanedExercises;
    activeWorkout.runnerState = activeWorkout.runnerState || {
      mode: 'train',
      adjustments: [],
    };
    activeWorkout.runnerState.mode = mode === 'lighten' ? 'lighten' : 'shorten';
    activeWorkout.runnerState.undoSnapshot = previousSnapshot;
    activeWorkout.runnerState.adjustments.push({
      type: mode,
      at: new Date().toISOString(),
      detailLevel: detailLevel || undefined,
      label: getRunnerAdjustmentLabel({ type: mode }),
    });
    ensureWorkoutCommentaryRecord(activeWorkout);
    if (mode === 'shorten') {
      appendWorkoutAdaptationEvent(activeWorkout, 'runner_shorten');
      appendWorkoutRunnerEvent(activeWorkout, 'runner_shorten');
    } else {
      appendWorkoutAdaptationEvent(activeWorkout, 'runner_lighten');
      appendWorkoutRunnerEvent(activeWorkout, 'runner_lighten');
    }
    const runnerToast =
      typeof presentTrainingCommentary === 'function'
        ? presentTrainingCommentary(
            getWorkoutCommentaryState(activeWorkout),
            'runner_toast'
          )
        : null;
    showToast(
      runnerToast?.text ||
        i18nText(
          mode === 'shorten'
            ? 'workout.runner.shorten_toast'
            : 'workout.runner.light_toast',
          mode === 'shorten'
            ? 'Session shortened to the essential work'
            : 'Remaining work lightened'
        ),
      'var(--blue)'
    );
    persistCurrentWorkoutDraft();
    if (isLogActiveIslandActive()) notifyLogActiveIsland();
    else renderExercises();
    return;
  }
  const currentState = getWorkoutCommentaryState(activeWorkout) || {};
  const emptyToast =
    typeof presentTrainingCommentary === 'function'
      ? presentTrainingCommentary(
          {
            ...currentState,
            runnerEvents: [{ code: 'runner_no_change', params: {} }],
          },
          'runner_toast'
        )
      : null;
  showToast(
    emptyToast?.text ||
      i18nText(
        'workout.runner.no_change',
        'No remaining work needed adjustment'
      ),
    'var(--muted)'
  );
}

function undoQuickWorkoutAdjustment() {
  const snapshot = activeWorkout?.runnerState?.undoSnapshot;
  if (!snapshot || !activeWorkout) return;
  activeWorkout.exercises = cloneWorkoutExercises(snapshot.exercises);
  activeWorkout.commentary = snapshot.commentary
    ? JSON.parse(JSON.stringify(snapshot.commentary))
    : activeWorkout.commentary;
  activeWorkout.runnerState = activeWorkout.runnerState || {};
  activeWorkout.runnerState.mode =
    snapshot.mode || activeWorkout.planningDecision?.action || 'train';
  activeWorkout.runnerState.adjustments = (snapshot.adjustments || []).map(
    (item) => ({ ...item })
  );
  delete activeWorkout.runnerState.undoSnapshot;
  appendWorkoutRunnerEvent(activeWorkout, 'runner_undo');
  persistCurrentWorkoutDraft();
  if (isLogActiveIslandActive()) notifyLogActiveIsland();
  else renderExercises();
  const undoToast =
    typeof presentTrainingCommentary === 'function'
      ? presentTrainingCommentary(
          getWorkoutCommentaryState(activeWorkout),
          'runner_toast'
        )
      : null;
  showToast(
    undoToast?.text ||
      i18nText('workout.runner.undo_toast', 'Last adjustment undone'),
    'var(--blue)'
  );
}

function diffProgramTMs(prog, stateBefore, stateAfter) {
  return getWorkoutRuntime().buildProgramTmAdjustments(stateBefore, stateAfter);
}

async function finishWorkout() {
  if (!activeWorkout.exercises.length) {
    showToast(
      i18nText('workout.add_at_least_one', 'Add at least one exercise!'),
      'var(--orange)'
    );
    return;
  }
  clearWorkoutTimer();
  renderWorkoutTimer();
  skipRest();
  activeWorkout.exercises = getWorkoutRuntime().sanitizeWorkoutExercisesForSave({
    exercises: activeWorkout.exercises,
    withResolvedExerciseId,
  });
  let totalSets = 0;
  activeWorkout.exercises.forEach((e) => {
    totalSets += e.sets.length;
  });

  const sessionRPE = await new Promise((resolve) => {
    showRPEPicker(i18nText('common.session', 'Session'), -1, (val) =>
      resolve(val || 7)
    );
  });

  const prog = getActiveProgram();
  const programName =
    window.I18N && I18N.t
      ? I18N.t('program.' + prog.id + '.name', null, prog.name || 'Training')
      : prog.name || 'Training';
  const state = getActiveProgramState();
  const stateBeforeSession = JSON.parse(JSON.stringify(state));
  const sessionSnapshot = normalizeWorkoutStartSnapshot(
    activeWorkout.sessionSnapshot
  );
  const progressionSourceState = sessionSnapshot?.buildState
    ? cloneJson(sessionSnapshot.buildState)
    : stateBeforeSession;

  // Structured state snapshot at session time (program-agnostic; used by history + analytics)
  let programMeta;
  try {
    programMeta = prog.getWorkoutMeta
      ? prog.getWorkoutMeta(progressionSourceState)
      : {
          week: progressionSourceState.week,
          cycle: progressionSourceState.cycle,
        };
  } catch (e) {
    logWarn('getWorkoutMeta', e);
    programMeta = {
      week: progressionSourceState.week,
      cycle: progressionSourceState.cycle,
    };
  }
  const workoutId = Date.now();
  const workoutDate = new Date().toISOString();
  ensureWorkoutCommentaryRecord(activeWorkout);
  const sessionPrCount = getWorkoutPrCount(activeWorkout);

  // Push workout record with canonical program metadata fields only.
  const savedWorkout = getWorkoutRuntime().buildSavedWorkoutRecord(
    {
      workoutId,
      workoutDate,
      programId: prog.id,
      activeWorkout,
      programMeta,
      prCount: sessionPrCount,
      stateBeforeSession,
      progressionSourceState,
      duration: getWorkoutElapsedSeconds(),
      exercises: activeWorkout.exercises,
      sessionRPE,
      totalSets,
    },
    {
      cloneTrainingDecision,
    }
  );
  workouts.push(savedWorkout);

  // Program state adjustment — wrapped in try/catch so a program bug never loses the workout.
  // If anything throws, the workout is already in the array and will be saved below.
  let advancedState = state;
  let newState = state;
  let programHookFailed = false;
  let tmAdjustments = [];

  const progressionResult = getWorkoutRuntime().buildWorkoutProgressionResult(
    {
      prog,
      activeWorkout,
      state,
      progressionSourceState,
      workouts,
    },
    {
      stripWarmupSetsFromExercises,
      getWeekStart,
    }
  );
  advancedState = progressionResult.advancedState || state;
  newState = progressionResult.newState || state;
  tmAdjustments = Array.isArray(progressionResult.tmAdjustments)
    ? progressionResult.tmAdjustments
    : [];
  programHookFailed = progressionResult.programHookFailed === true;
  savedWorkout.programStateAfter =
    progressionResult.programStateAfter ||
    JSON.parse(JSON.stringify(advancedState));
  if (tmAdjustments.length) savedWorkout.tmAdjustments = tmAdjustments;

  if (!activeWorkout.isBonus && !programHookFailed) {
    if (
      advancedState.cycle !== undefined &&
      advancedState.cycle !== newState.cycle
    ) {
      const bi = prog.getBlockInfo
        ? prog.getBlockInfo(advancedState)
        : { name: '' };
      setTimeout(
        () =>
          showToast(
            i18nText(
              'workout.next_cycle',
              '{program} - cycle {cycle} starts now.',
              { program: programName, cycle: advancedState.cycle }
            ),
            'var(--purple)'
          ),
        500
      );
    } else if (
      advancedState.week !== undefined &&
      advancedState.week !== newState.week
    ) {
      const bi = prog.getBlockInfo
        ? prog.getBlockInfo(advancedState)
        : { name: '', weekLabel: '' };
      setTimeout(
        () =>
          showToast(
            i18nText('workout.next_week', '{program} - {label} up next!', {
              program: programName,
              label: bi.name || 'Week ' + advancedState.week,
            }),
            'var(--purple)'
          ),
        500
      );
    }
  }

  setProgramState(prog.id, advancedState);
  saveProfileData({ programIds: [prog.id] });
  await upsertWorkoutRecord(savedWorkout);
  await saveWorkouts();
  buildExerciseIndex();

  const summaryData = getWorkoutRuntime().buildSessionSummaryData(
    {
      activeWorkout,
      exercises: activeWorkout.exercises,
      duration: getWorkoutElapsedSeconds(),
      sessionRPE,
      prCount: sessionPrCount,
      isBonus: activeWorkout.isBonus || false,
      programLabel: activeWorkout.programLabel || '',
      tmAdjustments,
      stateBeforeSession,
      advancedState,
      totalSets,
    },
    {
      parseLoggedRepCount,
      buildCoachNote,
    }
  );

  const finishTeardownPlan = getWorkoutRuntime().buildWorkoutTeardownPlan(
    {
      mode: 'finish',
    },
    {
      t: i18nText,
    }
  );
  resetActiveWorkoutUIState();
  activeWorkout = null;
  clearWorkoutStartSnapshot();
  clearCurrentWorkoutDraft();
  document.getElementById('workout-not-started').style.display =
    finishTeardownPlan.showNotStarted === false ? 'none' : 'block';
  document.getElementById('workout-active').style.display =
    finishTeardownPlan.hideActive === false ? 'block' : 'none';
  if (finishTeardownPlan.resetNotStartedView !== false) {
    resetNotStartedView();
  }
  if (isLogActiveIslandActive() && finishTeardownPlan.notifyLogActive !== false)
    notifyLogActiveIsland();
  if (finishTeardownPlan.updateDashboard !== false) updateDashboard();

  if (programHookFailed)
    showToast(
      i18nText(
        'workout.program_error',
        'Session saved, but program state may need review.'
      ),
      'var(--orange)'
    );
  const summaryResult = await showSessionSummary(summaryData);
  const postWorkoutOutcome = getWorkoutRuntime().buildPostWorkoutOutcome(
    {
      savedWorkout,
      summaryResult,
      summaryData,
    },
    {
      inferDurationSignal,
      t: i18nText,
      formatWorkoutWeight,
    }
  );
  if (
    postWorkoutOutcome.shouldSaveWorkouts ||
    summaryResult?.feedback ||
    summaryResult?.notes ||
    savedWorkout.durationSignal
  )
    await saveWorkouts();
  const tmAdjustmentToast =
    typeof postWorkoutOutcome.tmAdjustmentToast === 'string'
      ? postWorkoutOutcome.tmAdjustmentToast
      : buildTmAdjustmentToast(savedWorkout.tmAdjustments);
  if (tmAdjustmentToast) {
    setTimeout(
      () => showToast(tmAdjustmentToast, 'var(--blue)'),
      600
    );
  }
  if (postWorkoutOutcome.goToNutrition || summaryResult?.goToNutrition) {
    if (typeof window.setNutritionSessionContext === 'function') {
      window.setNutritionSessionContext(
        postWorkoutOutcome.nutritionContext || summaryData
      );
    }
    const bridge =
      typeof getRuntimeBridge === 'function' ? getRuntimeBridge() : null;
    if (bridge && typeof bridge.navigateToPage === 'function') {
      bridge.navigateToPage('nutrition');
    } else if (typeof window.showPage === 'function') {
      window.showPage('nutrition');
    }
  }
}

function cancelWorkout() {
  const cancelTeardownPlan = getWorkoutRuntime().buildWorkoutTeardownPlan(
    {
      mode: 'cancel',
    },
    {
      t: i18nText,
    }
  );
  clearWorkoutTimer();
  skipRest();
  resetActiveWorkoutUIState();
  activeWorkout = null;
  clearWorkoutStartSnapshot();
  clearCurrentWorkoutDraft();
  document.getElementById('workout-not-started').style.display =
    cancelTeardownPlan.showNotStarted === false ? 'none' : 'block';
  document.getElementById('workout-active').style.display =
    cancelTeardownPlan.hideActive === false ? 'block' : 'none';
  if (cancelTeardownPlan.resetNotStartedView !== false) {
    resetNotStartedView();
  }
  if (isLogActiveIslandActive() && cancelTeardownPlan.notifyLogActive !== false)
    notifyLogActiveIsland();
  showToast(
    cancelTeardownPlan.discardToast ||
      i18nText('workout.session_discarded', 'Workout discarded.')
  );
}
