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
      timerText: '00:00',
      timerSeed: 0,
      planHtml: '',
      restDuration: '120',
      exercisesHtml: '',
    },
  };
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

function LogActiveIsland() {
  const snapshot = useIslandSnapshot(
    [LOG_ACTIVE_EVENT, LANGUAGE_EVENT],
    getSnapshot
  );

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
              initialText={snapshot.values.timerText}
              timerSeed={snapshot.values.timerSeed}
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

      <div
        id="active-session-plan"
        dangerouslySetInnerHTML={{ __html: snapshot.values.planHtml }}
      />

      <div className="rest-timer-inline">
        <span className="rest-timer-inline-label">{snapshot.labels.restTimer}</span>
        <select
          id="rest-duration"
          className="rest-timer-inline-select"
          value={String(snapshot.values.restDuration)}
          onChange={() => window.updateRestDuration?.()}
        >
          {snapshot.labels.restOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div
        id="exercises-container"
        dangerouslySetInnerHTML={{ __html: snapshot.values.exercisesHtml }}
      />

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
