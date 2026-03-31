import { useEffect, useLayoutEffect, useState } from 'react';
import { useRuntimeStore } from '../app/store/runtime-store.ts';
import { showConfirm } from '../app/services/confirm-actions';
import {
  addSet,
  applyQuickWorkoutAdjustment,
  cancelWorkout,
  clearLogActiveCollapseSignal,
  clearLogActiveFocusTarget,
  clearLogActiveSetSignal,
  closeExerciseGuide,
  collapseCompletedExercise,
  expandCompletedExercise,
  finishWorkout,
  handleSetInputKey,
  openExerciseCatalogForAdd,
  openExerciseGuide,
  removeExercise,
  swapAuxExercise,
  swapBackExercise,
  toggleSet,
  undoQuickWorkoutAdjustment,
  updateRestDuration,
  updateSet,
} from '../app/services/workout-ui-actions.ts';

const initialSnapshot = {
  labels: {
    addExercise: 'Add Exercise',
    restTimer: 'Rest timer',
    finishSession: 'Finish Session',
    cancelSession: 'Discard Workout',
    cancelConfirmTitle: 'Discard Workout',
    cancelConfirmMessage:
      "Discard this in-progress workout? Sets won't be saved.",
    lastBest: 'Last best: {weight}kg',
    aux: 'AUX',
    back: 'BACK',
    swap: 'Swap',
    swapBack: 'Swap back exercise',
    addSet: '+ Set',
    removeExercise: 'Remove exercise',
    collapse: 'Minimize',
    movementGuide: 'Movement Guide',
    weightPlaceholder: 'kg',
    repsPlaceholder: 'reps',
    repsHit: 'reps hit',
    prBadge: 'NEW PR',
    shorten: 'Shorten',
    lighten: 'Go lighter',
    undoAdjustment: 'Undo adjustment',
    restOptions: [
      { value: '60', label: '1 min' },
      { value: '90', label: '90s' },
      { value: '120', label: '2 min' },
      { value: '180', label: '3 min' },
      { value: '240', label: '4 min' },
      { value: '300', label: '5 min' },
      { value: '0', label: 'Off' },
    ],
  },
  values: {
    visible: false,
    title: 'Session',
    description: '',
    descriptionVisible: false,
    timer: { text: '00:00', seed: 0 },
    rest: { duration: '120' },
    planPanel: null,
    ui: {
      focusTarget: null,
      setSignal: null,
      collapseSignal: null,
    },
    exercises: [],
  },
};

function invokeLegacy(name, ...args) {
  const fn = {
    applyQuickWorkoutAdjustment,
    undoQuickWorkoutAdjustment,
    expandCompletedExercise,
    collapseCompletedExercise,
    swapAuxExercise,
    swapBackExercise,
    openExerciseGuide,
  }[name];
  if (typeof fn === 'function') return fn(...args);
  return undefined;
}

function invokeWorkoutAction(name, ...args) {
  const action = {
    updateSet,
    toggleSet,
    addSet,
    removeExercise,
    finishWorkout,
    cancelWorkout,
    updateRestDuration,
  }[name];
  if (typeof action === 'function') return action(...args);
  return undefined;
}

function formatTemplate(template, params) {
  return Object.entries(params || {}).reduce(
    (value, [key, next]) => value.replace(`{${key}}`, String(next)),
    String(template || '')
  );
}

function PlanBanner({ labels, planPanel }) {
  if (!planPanel) return <div id="active-session-plan" />;

  return (
    <div id="active-session-plan">
      <div className="active-session-plan-card">
        <div className="active-session-plan-top">
          <div>
            <div className="active-session-plan-kicker">{planPanel.kicker}</div>
            <div className="active-session-plan-title">{planPanel.title}</div>
            <div className="active-session-plan-copy">{planPanel.copy}</div>
          </div>
          <div className="active-session-plan-progress-pill">
            {planPanel.progressPercent}%
          </div>
        </div>
        <div className="active-session-plan-track" aria-hidden="true">
          <div
            className="active-session-plan-track-fill"
            style={{ width: `${planPanel.progressPercent}%` }}
          />
        </div>
        <div className="active-session-plan-meta">
          <div className="active-session-plan-pill">
            {planPanel.completedSetsText}
          </div>
          <div className="active-session-plan-pill">
            {planPanel.remainingSetsText}
          </div>
          <div className="active-session-plan-pill">
            {planPanel.elapsedText}
          </div>
        </div>
        <div className="active-session-progress">
          <div className="active-session-next">{planPanel.nextText}</div>
          {planPanel.finishPoint ? (
            <div className="active-session-finish-point">
              <div className="active-session-finish-title">
                {planPanel.finishPoint.title || ''}
              </div>
              <div className="active-session-finish-copy">
                {planPanel.finishPoint.copy || ''}
              </div>
            </div>
          ) : null}
          {planPanel.adjustments?.length ? (
            <div className="active-session-adjustments">
              {planPanel.adjustments.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  className="active-session-adjustment"
                >
                  {'• '}
                  {item.label}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="active-session-plan-actions">
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() =>
              invokeLegacy('applyQuickWorkoutAdjustment', 'shorten')
            }
          >
            {labels.shorten}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() =>
              invokeLegacy('applyQuickWorkoutAdjustment', 'lighten')
            }
          >
            {labels.lighten}
          </button>
          {planPanel.undoAvailable ? (
            <button
              className="btn btn-secondary btn-sm btn-full"
              type="button"
              onClick={() => invokeLegacy('undoQuickWorkoutAdjustment')}
            >
              {labels.undoAdjustment}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({ exercise, labels, setSignal, collapseSignal }) {
  const isSetSignalFor = (setIndex) =>
    setSignal &&
    setSignal.exerciseUiKey === exercise.uiKey &&
    setSignal.setIndex === setIndex;
  const isCollapseSignal =
    collapseSignal && collapseSignal.exerciseUiKey === exercise.uiKey;

  if (exercise.isCollapsed) {
    return (
      <div
        className={`exercise-block exercise-block-complete is-collapsed${
          isCollapseSignal ? ' seal-enter' : ''
        }`}
        data-ui-key={exercise.uiKey}
        data-exercise-index={exercise.exerciseIndex}
      >
        <button
          className="exercise-collapse-summary"
          type="button"
          data-action="expand-exercise"
          onClick={() =>
            invokeLegacy('expandCompletedExercise', exercise.uiKey)
          }
        >
          <div className="exercise-collapse-main">
            <div className="exercise-collapse-name">
              {exercise.collapsedSummary.name}
            </div>
            <div className="exercise-collapse-meta">
              {exercise.collapsedSummary.meta}
            </div>
          </div>
          <div className="exercise-collapse-status">
            <span className="exercise-collapse-badge">
              {exercise.collapsedSummary.badge}
            </span>
          </div>
        </button>
      </div>
    );
  }

  const totalSets = exercise.sets.length;
  const completedSets = exercise.sets.filter((s) => s.done).length;
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <div
      className={`exercise-block${exercise.isComplete ? ' exercise-block-complete' : ''}`}
      data-ui-key={exercise.uiKey}
      data-exercise-index={exercise.exerciseIndex}
    >
      {/* Header */}
      <div className="exercise-top">
        <div className="exercise-header">
          <div className="exercise-title-stack">
            {/* Chip row: AUX/BACK label + divider + previous data */}
            {(exercise.isAux || exercise.isAccessory) && (
              <div className="exercise-meta-row">
                {exercise.isAux ? (
                  <span className="exercise-chip">{labels.aux}</span>
                ) : (
                  <span className="exercise-chip exercise-chip-blue">
                    {labels.back}
                  </span>
                )}
                <span className="exercise-meta-divider" aria-hidden="true" />
                <span className="last-session">{exercise.previousText}</span>
              </div>
            )}
            <div className="exercise-name">{exercise.displayName}</div>
            {!exercise.isAux && !exercise.isAccessory && (
              <div className="last-session">{exercise.previousText}</div>
            )}
          </div>
          <div className="exercise-action-row">
            {exercise.isAux ? (
              <button
                className="btn btn-secondary exercise-action-btn exercise-swap-btn"
                type="button"
                data-action="swap-aux"
                title={labels.swap}
                aria-label={labels.swap}
                onClick={() =>
                  invokeLegacy('swapAuxExercise', exercise.exerciseIndex)
                }
              >
                {labels.swap}
              </button>
            ) : null}
            {exercise.isAccessory ? (
              <button
                className="btn btn-secondary exercise-action-btn exercise-swap-btn"
                type="button"
                data-action="swap-back"
                title={labels.swapBack}
                aria-label={labels.swapBack}
                onClick={() =>
                  invokeLegacy('swapBackExercise', exercise.exerciseIndex)
                }
              >
                {labels.swap}
              </button>
            ) : null}
            <button
              className="btn btn-ghost btn-sm exercise-remove-btn"
              type="button"
              data-action="remove-exercise"
              title={labels.removeExercise}
              aria-label={labels.removeExercise}
              onClick={() =>
                invokeWorkoutAction('removeExercise', exercise.exerciseIndex)
              }
            >
              {labels.removeExercise}
            </button>
            {exercise.isComplete ? (
              <button
                className="btn btn-icon btn-secondary exercise-action-btn exercise-collapse-btn"
                type="button"
                data-action="collapse-exercise"
                title={labels.collapse}
                aria-label={labels.collapse}
                onClick={() =>
                  invokeLegacy('collapseCompletedExercise', exercise.uiKey)
                }
              >
                ▾
              </button>
            ) : null}
          </div>
        </div>
        {exercise.suggested ? (
          <div className="exercise-badges">
            <div className="suggest-badge">
              {'📈 '}
              {formatTemplate(labels.lastBest, { weight: exercise.suggested })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Progress bar */}
      <div className="exercise-progress-bar-track">
        <div
          className="exercise-progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="exercise-progress-label">
        <span>{completedSets}/{totalSets} sets</span>
        <span>{Math.round(progress)}%</span>
      </div>

      {/* Movement guide — full-width accent button */}
      {exercise.guideAvailable ? (
        <button
          className="btn exercise-guide-open-btn"
          type="button"
          data-action="open-guide"
          onClick={() => invokeLegacy('openExerciseGuide', exercise.uiKey)}
        >
          ▶ {labels.movementGuide}
        </button>
      ) : null}

      <div id={exercise.setsId} className="exercise-sets">
        <div className="set-grid-header">
          <span className="set-grid-spacer" aria-hidden="true" />
          <div className="set-col-label">{labels.weightPlaceholder}</div>
          <div className="set-col-label">{labels.repsPlaceholder}</div>
          <span className="set-grid-spacer" aria-hidden="true" />
        </div>
        {exercise.sets.map((set) => (
          <div
            key={set.index}
            className={`set-row${set.isWarmup ? ' set-warmup' : ''}${
              set.done ? ' is-done' : ''
            }${set.isAmrap ? ' set-amrap' : ''}${set.isPr ? ' has-pr' : ''}${
              isSetSignalFor(set.index) && setSignal.isPr
                ? ' set-pr-celebration'
                : ''
            }${isSetSignalFor(set.index) ? ' set-done-anim' : ''}`}
            data-set-index={set.index}
          >
            <span
              className="set-num"
              style={
                set.isAmrap
                  ? { color: 'var(--purple)', fontWeight: 800 }
                  : undefined
              }
            >
              {set.label}
            </span>
            <div className={`set-input-cell${set.done ? ' is-done' : ''}${set.isAmrap ? ' is-amrap' : ''}`}>
              <input
                id={set.weightInputId}
                className="set-input"
                type="number"
                inputMode="decimal"
                min="0"
                max="999"
                step="any"
                data-field="weight"
                data-set-index={set.index}
                data-exercise-index={exercise.exerciseIndex}
                placeholder={labels.weightPlaceholder}
                value={String(set.weight ?? '')}
                onChange={(event) =>
                  invokeWorkoutAction(
                    'updateSet',
                    exercise.exerciseIndex,
                    set.index,
                    'weight',
                    event.target.value
                  )
                }
                onKeyDown={(event) =>
                  handleSetInputKey(
                    event.nativeEvent,
                    exercise.uiKey,
                    set.index,
                    'weight'
                  )
                }
              />
            </div>
            <div className={`set-input-cell${set.done ? ' is-done' : ''}${set.isAmrap ? ' is-amrap' : ''}`}>
              <input
                id={set.repsInputId}
                className="set-input"
                type="number"
                inputMode="numeric"
                min="0"
                max="999"
                data-field="reps"
                data-set-index={set.index}
                data-exercise-index={exercise.exerciseIndex}
                placeholder={
                  set.isAmrap ? labels.repsHit : labels.repsPlaceholder
                }
                value={String(set.reps ?? '')}
                onChange={(event) =>
                  invokeWorkoutAction(
                    'updateSet',
                    exercise.exerciseIndex,
                    set.index,
                    'reps',
                    event.target.value
                  )
                }
                onKeyDown={(event) =>
                  handleSetInputKey(
                    event.nativeEvent,
                    exercise.uiKey,
                    set.index,
                    'reps'
                  )
                }
              />
            </div>
            <div className={`set-action-cell${set.isPr ? ' has-pr' : ''}`}>
              <button
                className={`set-check ${set.done ? 'done' : ''}${
                  set.isPr ? ' set-check-pr' : ''
                }${isSetSignalFor(set.index) ? ' set-done-anim' : ''}${
                  isSetSignalFor(set.index) && setSignal.isPr
                    ? ' set-pr-highlight'
                    : ''
                }`}
                type="button"
                data-action="toggle-set"
                data-set-index={set.index}
                data-exercise-index={exercise.exerciseIndex}
                onClick={() =>
                  invokeWorkoutAction(
                    'toggleSet',
                    exercise.exerciseIndex,
                    set.index
                  )
                }
              >
                {set.done ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8L6.5 11.5L13 5"
                      stroke="white"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="set-check-inner-box" />
                )}
              </button>
              {set.isPr ? (
                <span className="set-pr-badge is-visible">
                  {labels.prBadge}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn exercise-add-set-btn"
        type="button"
        data-action="add-set"
        onClick={() => invokeWorkoutAction('addSet', exercise.exerciseIndex)}
      >
        {labels.addSet}
      </button>
    </div>
  );
}

function LogActiveIsland() {
  const snapshot =
    useRuntimeStore((state) => state.workoutSession.logActiveView) ||
    initialSnapshot;
  const [setSignal, setSetSignal] = useState(null);
  const [collapseSignal, setCollapseSignal] = useState(null);

  useLayoutEffect(() => {
    const focusTarget = snapshot.values.ui?.focusTarget;
    if (!focusTarget?.token || !focusTarget.inputId) return;
    const input = document.getElementById(focusTarget.inputId);
    if (!(input instanceof HTMLInputElement)) return;
    input.focus();
    input.select?.();
    clearLogActiveFocusTarget(focusTarget.token);
  }, [snapshot.values.ui?.focusTarget?.token, snapshot.values.ui?.focusTarget?.inputId]);

  useEffect(() => {
    const nextSignal = snapshot.values.ui?.setSignal;
    if (!nextSignal?.token) return undefined;
    setSetSignal(nextSignal);
    clearLogActiveSetSignal(nextSignal.token);
    const timeoutId = window.setTimeout(
      () =>
        setSetSignal((current) =>
          current?.token === nextSignal.token ? null : current
        ),
      nextSignal.isPr ? 950 : 500
    );
    return () => window.clearTimeout(timeoutId);
  }, [snapshot.values.ui?.setSignal?.token]);

  useEffect(() => {
    const nextSignal = snapshot.values.ui?.collapseSignal;
    if (!nextSignal?.token) return undefined;
    setCollapseSignal(nextSignal);
    clearLogActiveCollapseSignal(nextSignal.token);
    const timeoutId = window.setTimeout(
      () =>
        setCollapseSignal((current) =>
          current?.token === nextSignal.token ? null : current
        ),
      400
    );
    return () => window.clearTimeout(timeoutId);
  }, [snapshot.values.ui?.collapseSignal?.token]);

  return (
    <div
      id="workout-active"
      style={{ display: snapshot.values.visible ? 'block' : 'none' }}
    >
      <div className="active-session-header">
        <div className="active-session-heading">
          <div className="active-session-title" id="active-session-title">
            {snapshot.values.title}
          </div>
          <div
            className="active-session-description"
            id="active-session-description"
            style={{
              display: snapshot.values.descriptionVisible ? '' : 'none',
            }}
          >
            {snapshot.values.description}
          </div>
          <div className="active-session-timer" id="active-session-timer">
            {snapshot.values.timer?.text || '00:00'}
          </div>
        </div>
        <button
          className="btn btn-sm btn-secondary active-session-add-btn"
          type="button"
          onClick={() => openExerciseCatalogForAdd()}
        >
          {snapshot.labels.addExercise}
        </button>
      </div>

      <PlanBanner
        labels={snapshot.labels}
        planPanel={snapshot.values.planPanel}
      />

      <div className="rest-timer-inline">
        <span className="rest-timer-inline-label">
          {snapshot.labels.restTimer}
        </span>
        <div
          className="rest-timer-pills"
          role="group"
          aria-label={snapshot.labels.restTimer}
        >
          {snapshot.labels.restOptions.map((option) => {
            const isActive =
              String(snapshot.values.rest.duration) === String(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={`rest-timer-pill${isActive ? ' is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() =>
                  invokeWorkoutAction('updateRestDuration', option.value)
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div id="exercises-container">
        {snapshot.values.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.uiKey}
            exercise={exercise}
            labels={snapshot.labels}
            setSignal={setSignal}
            collapseSignal={collapseSignal}
          />
        ))}
      </div>

        <button
          className="btn btn-primary session-primary-action"
          type="button"
        onClick={() => finishWorkout()}
      >
        {snapshot.labels.finishSession}
      </button>

        <button
          className="btn btn-ghost session-secondary-action"
          type="button"
          onClick={() => {
            showConfirm(
              snapshot.labels.cancelConfirmTitle,
              snapshot.labels.cancelConfirmMessage,
              () => cancelWorkout()
            );
          }}
        >
          {snapshot.labels.cancelSession}
        </button>
    </div>
  );
}

export { LogActiveIsland };
