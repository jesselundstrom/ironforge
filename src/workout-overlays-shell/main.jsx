import { mountIsland } from '../island-runtime/index.jsx';

function WorkoutOverlaysShell() {
  return (
    <>
      <div className="modal-overlay" id="rpe-modal">
        <div className="modal-sheet">
          <div className="modal-handle" />
          <div className="modal-title" data-i18n="rpe.session_title">
            How hard was this session?
          </div>
          <div
            className="modal-sub"
            id="rpe-modal-sub"
            data-i18n="rpe.session_prompt"
          >
            Rate overall effort (6 = easy, 10 = max)
          </div>
          <div className="rpe-grid" id="rpe-grid" />
          <div
            className="rpe-skip"
            role="button"
            tabIndex={0}
            onClick={() => window.skipRPE?.()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.skipRPE?.();
              }
            }}
            data-i18n="common.skip"
          >
            Skip
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="summary-modal">
        <div className="modal-sheet summary-sheet">
          <div className="modal-handle" />
          <div id="summary-modal-content" className="summary-modal-content" />
        </div>
      </div>

      <div className="modal-overlay" id="sport-check-modal">
        <div className="modal-sheet">
          <div className="modal-handle" />
          <div
            className="modal-title"
            id="sport-check-title"
            data-i18n="workout.sport_check.title"
          >
            Sport check-in
          </div>
          <div
            className="modal-sub"
            id="sport-check-sub"
            data-i18n="workout.sport_check.sub"
          >
            Have you had a leg-heavy sport session yesterday, or do you have one tomorrow?
          </div>
          <div className="sport-check-grid">
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => window.selectSportReadiness?.('none')}
              data-i18n="workout.sport_check.none"
            >
              No
            </button>
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => window.selectSportReadiness?.('yesterday')}
              data-i18n="workout.sport_check.yesterday"
            >
              Yes, yesterday
            </button>
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => window.selectSportReadiness?.('tomorrow')}
              data-i18n="workout.sport_check.tomorrow"
            >
              Yes, tomorrow
            </button>
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => window.selectSportReadiness?.('both')}
              data-i18n="workout.sport_check.both"
            >
              Yes, both
            </button>
          </div>
          <button
            className="btn btn-ghost session-secondary-action"
            type="button"
            onClick={() => window.cancelSportReadinessCheck?.()}
            data-i18n="common.cancel"
          >
            Cancel
          </button>
        </div>
      </div>

      <div
        className="modal-overlay"
        id="exercise-guide-modal"
        onClick={(event) => window.closeExerciseGuide?.(event)}
      >
        <div className="modal-sheet exercise-guide-sheet">
          <div className="modal-handle" />
          <div
            className="modal-title"
            id="exercise-guide-modal-title"
            data-i18n="guidance.title"
          >
            Movement Guide
          </div>
          <div className="modal-sub" id="exercise-guide-modal-sub" />
          <div
            className="exercise-guide-sheet-body"
            id="exercise-guide-modal-body"
          />
          <button
            className="btn btn-ghost exercise-guide-sheet-close"
            type="button"
            onClick={() => window.closeExerciseGuide?.()}
            data-i18n="common.done"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

mountIsland({
  mountId: 'workout-overlays-shell-react-root',
  legacyShellId: [
    'rpe-modal',
    'summary-modal',
    'sport-check-modal',
    'exercise-guide-modal',
  ],
  mountedFlag: '__IRONFORGE_WORKOUT_OVERLAYS_SHELL_MOUNTED__',
  eventName: 'ironforge:workout-overlays-shell-mounted',
  Component: WorkoutOverlaysShell,
});
