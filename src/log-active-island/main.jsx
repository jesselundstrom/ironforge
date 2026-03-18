import { useEffect, useState } from 'react';
import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const LOG_ACTIVE_EVENT =
  window.__IRONFORGE_LOG_ACTIVE_ISLAND_EVENT__ ||
  'ironforge:log-active-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';

function getSnapshot() {
  if (typeof window.getLogActiveReactSnapshot === 'function') {
    const snapshot = window.getLogActiveReactSnapshot();
    if (snapshot) return snapshot;
  }

  return {
    labels: {
      addExercise: 'Add Exercise',
      restTimer: 'Rest timer',
      finishSession: 'Finish Session',
      cancelSession: 'Discard Workout',
      cancelConfirmTitle: 'Discard Workout',
      cancelConfirmMessage: "Discard this in-progress workout? Sets won't be saved.",
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
      exercises: [],
    },
  };
}

function invokeLegacy(name, ...args) {
  const fn = window[name];
  if (typeof fn === 'function') return fn(...args);
  if (typeof window.eval === 'function') {
    const serializedArgs = args.map((arg) => JSON.stringify(arg)).join(',');
    return window.eval(`${name}(${serializedArgs})`);
  }
  return undefined;
}

function formatTemplate(template, params) {
  return Object.entries(params || {}).reduce(
    (value, [key, next]) => value.replace(`{${key}}`, String(next)),
    String(template || '')
  );
}

function ActiveWorkoutTimer({ initialText, timerSeed, visible }) {
  const [timerText, setTimerText] = useState(initialText || '00:00');

  useEffect(() => {
    setTimerText(initialText || '00:00');
  }, [initialText, timerSeed, visible]);

  useEffect(() => {
    if (!visible) return undefined;

    const tick = () => {
      if (typeof window.getLogActiveTimerText === 'function') {
        setTimerText(window.getLogActiveTimerText());
      }
    };

    tick();
    const timerId = window.setInterval(tick, 1000);
    return () => window.clearInterval(timerId);
  }, [visible, timerSeed]);

  return <>{timerText}</>;
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
          <div className="active-session-plan-pill">{planPanel.completedSetsText}</div>
          <div className="active-session-plan-pill">{planPanel.remainingSetsText}</div>
          <div className="active-session-plan-pill">{planPanel.elapsedText}</div>
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
                <div key={`${item.label}-${index}`} className="active-session-adjustment">
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
            onClick={() => invokeLegacy('applyQuickWorkoutAdjustment', 'shorten')}
          >
            {labels.shorten}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => invokeLegacy('applyQuickWorkoutAdjustment', 'lighten')}
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

function ExerciseCard({ exercise, labels }) {
  if (exercise.isCollapsed) {
    return (
      <div
        className="exercise-block exercise-block-complete is-collapsed"
        data-ui-key={exercise.uiKey}
        data-exercise-index={exercise.exerciseIndex}
      >
        <button
          className="exercise-collapse-summary"
          type="button"
          data-action="expand-exercise"
          onClick={() => invokeLegacy('expandCompletedExercise', exercise.uiKey)}
        >
          <div className="exercise-collapse-main">
            <div className="exercise-collapse-name">{exercise.collapsedSummary.name}</div>
            <div className="exercise-collapse-meta">{exercise.collapsedSummary.meta}</div>
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

  return (
    <div
      className={`exercise-block${exercise.isComplete ? ' exercise-block-complete' : ''}`}
      data-ui-key={exercise.uiKey}
      data-exercise-index={exercise.exerciseIndex}
    >
      <div className="exercise-top">
        <div className="exercise-header">
          <div className="exercise-title-stack">
            <div className="exercise-title-row">
              <div className="exercise-name">{exercise.displayName}</div>
              {exercise.isAux ? (
                <span className="exercise-chip">{labels.aux}</span>
              ) : null}
              {exercise.isAccessory ? (
                <span className="exercise-chip exercise-chip-blue">{labels.back}</span>
              ) : null}
            </div>
            <div className="last-session">{exercise.previousText}</div>
          </div>
          <div className="exercise-action-row">
            {exercise.isAux ? (
              <button
                className="btn btn-secondary exercise-action-btn exercise-swap-btn"
                type="button"
                data-action="swap-aux"
                title={labels.swap}
                aria-label={labels.swap}
                onClick={() => invokeLegacy('swapAuxExercise', exercise.exerciseIndex)}
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
                onClick={() => invokeLegacy('swapBackExercise', exercise.exerciseIndex)}
              >
                {labels.swap}
              </button>
            ) : null}
            {exercise.isComplete ? (
              <button
                className="btn btn-icon btn-secondary exercise-action-btn exercise-collapse-btn"
                type="button"
                data-action="collapse-exercise"
                title={labels.collapse}
                aria-label={labels.collapse}
                onClick={() => invokeLegacy('collapseCompletedExercise', exercise.uiKey)}
              >
                ▾
              </button>
            ) : null}
            <button
              className="btn btn-icon btn-secondary exercise-action-btn exercise-remove-btn"
              type="button"
              data-action="remove-exercise"
              title={labels.removeExercise}
              aria-label={labels.removeExercise}
              onClick={() => invokeLegacy('removeEx', exercise.exerciseIndex)}
            >
              ✕
            </button>
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

      {exercise.guideAvailable ? (
        <div className="exercise-secondary-row">
          <button
            className="btn btn-blue btn-sm exercise-guide-open-btn"
            type="button"
            data-action="open-guide"
            onClick={() => invokeLegacy('openExerciseGuide', exercise.uiKey)}
          >
            {labels.movementGuide}
          </button>
        </div>
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
            }${set.isAmrap ? ' set-amrap' : ''}${set.isPr ? ' has-pr' : ''}`}
            data-set-index={set.index}
          >
            <span
              className="set-num"
              style={set.isAmrap ? { color: 'var(--purple)', fontWeight: 800 } : undefined}
            >
              {set.label}
            </span>
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
                invokeLegacy(
                  'updateSet',
                  exercise.exerciseIndex,
                  set.index,
                  'weight',
                  event.target.value
                )
              }
              onKeyDown={(event) =>
                window.handleSetInputKey?.(
                  event.nativeEvent,
                  exercise.uiKey,
                  set.index,
                  'weight'
                )
              }
            />
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
              placeholder={set.isAmrap ? labels.repsHit : labels.repsPlaceholder}
              value={String(set.reps ?? '')}
              style={set.isAmrap ? { borderColor: 'var(--purple)' } : undefined}
              onChange={(event) =>
                invokeLegacy(
                  'updateSet',
                  exercise.exerciseIndex,
                  set.index,
                  'reps',
                  event.target.value
                )
              }
              onKeyDown={(event) =>
                window.handleSetInputKey?.(
                  event.nativeEvent,
                  exercise.uiKey,
                  set.index,
                  'reps'
                )
              }
            />
            <div className={`set-action-cell${set.isPr ? ' has-pr' : ''}`}>
              <button
                className={`set-check ${set.done ? 'done' : ''}${set.isPr ? ' set-check-pr' : ''}`}
                type="button"
                data-action="toggle-set"
                data-set-index={set.index}
                data-exercise-index={exercise.exerciseIndex}
                onClick={() => invokeLegacy('toggleSet', exercise.exerciseIndex, set.index)}
              >
                ✓
              </button>
              {set.isPr ? (
                <span className="set-pr-badge is-visible">{labels.prBadge}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-sm btn-secondary"
        style={{ marginTop: 8 }}
        type="button"
        data-action="add-set"
        onClick={() => invokeLegacy('addSet', exercise.exerciseIndex)}
      >
        {labels.addSet}
      </button>
    </div>
  );
}

function LogActiveIsland() {
  const snapshot = useIslandSnapshot([LOG_ACTIVE_EVENT, LANGUAGE_EVENT], getSnapshot);

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
            style={{ display: snapshot.values.descriptionVisible ? '' : 'none' }}
          >
            {snapshot.values.description}
          </div>
          <div className="active-session-timer" id="active-session-timer">
            <ActiveWorkoutTimer
              initialText={snapshot.values.timer.text}
              timerSeed={snapshot.values.timer.seed}
              visible={snapshot.values.visible}
            />
          </div>
        </div>
        <button
          className="btn btn-sm btn-secondary active-session-add-btn"
          type="button"
          onClick={() => window.openExerciseCatalogForAdd?.()}
        >
          {snapshot.labels.addExercise}
        </button>
      </div>

      <PlanBanner labels={snapshot.labels} planPanel={snapshot.values.planPanel} />

      <div className="rest-timer-inline">
        <span className="rest-timer-inline-label">{snapshot.labels.restTimer}</span>
        <select
          id="rest-duration"
          className="rest-timer-inline-select"
          value={String(snapshot.values.rest.duration)}
          onChange={() => window.updateRestDuration?.()}
        >
          {snapshot.labels.restOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div id="exercises-container">
        {snapshot.values.exercises.map((exercise) => (
          <ExerciseCard key={exercise.uiKey} exercise={exercise} labels={snapshot.labels} />
        ))}
      </div>

      <button
        className="btn btn-primary session-primary-action"
        type="button"
        onClick={() => window.finishWorkout?.()}
      >
        {snapshot.labels.finishSession}
      </button>

      <button
        className="btn btn-ghost session-secondary-action"
        type="button"
        onClick={() =>
          window.showConfirm?.(
            snapshot.labels.cancelConfirmTitle,
            snapshot.labels.cancelConfirmMessage,
            window.cancelWorkout
          )
        }
      >
        {snapshot.labels.cancelSession}
      </button>
    </div>
  );
}

mountIsland({
  mountId: 'log-active-react-root',
  legacyShellId: 'log-active-legacy-shell',
  mountedFlag: '__IRONFORGE_LOG_ACTIVE_ISLAND_MOUNTED__',
  eventName: LOG_ACTIVE_EVENT,
  Component: LogActiveIsland,
});
