import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const LOG_START_EVENT =
  window.__IRONFORGE_LOG_START_ISLAND_EVENT__ ||
  'ironforge:log-start-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';

const initialSnapshot = {
  labels: {
    trainingSession: 'Training Session',
    startWorkout: 'Start Workout',
  },
  values: {
    visible: true,
    quickLog: {
      icon: 'S',
      title: 'Log Extra Sport',
      subtitle: 'Unscheduled sport session',
    },
    selectedOption: '',
    options: [],
    preview: null,
    focusPanel: null,
    decisionCard: null,
    warningCard: null,
    sportReadiness: null,
  },
};

function getSnapshot() {
  if (typeof window.getLogStartReactSnapshot === 'function') {
    return window.getLogStartReactSnapshot() || initialSnapshot;
  }
  return initialSnapshot;
}

function DecisionCard({ card }) {
  if (!card) return null;
  return (
    <div className="workout-today-section">
      <div className="workout-today-section-label">{card.kicker}</div>
      <div className="workout-decision-card workout-decision-card-actionable">
        <div className="workout-decision-kicker">{card.kicker}</div>
        <div className="workout-decision-title">{card.title}</div>
        <div className="workout-decision-copy">{card.copy}</div>
        {card.reasons?.length ? (
          <div className="workout-decision-reasons">
            {card.reasons.map((reason) => (
              <div className="workout-decision-chip" key={reason}>
                {reason}
              </div>
            ))}
          </div>
        ) : null}
        <div className="workout-decision-options">
          {card.options.map((option) => (
            <button
              className={`workout-decision-option${
                option.active ? ' is-active' : ''
              }`}
              type="button"
              key={option.value}
              onClick={() => window.setPendingSessionMode?.(option.value)}
            >
              <div className="workout-decision-option-title">{option.title}</div>
              <div className="workout-decision-option-copy">{option.copy}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ preview }) {
  if (!preview) return null;
  return (
    <div className="workout-today-section">
      <div className="workout-session-card">
        <div className="workout-session-card-head">
          <div className="workout-session-card-title">{preview.headerTitle}</div>
          <div className="workout-session-card-chips">
            {preview.chips.map((chip) => (
              <span className="workout-session-chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div className="workout-session-card-body">
          {preview.rows.length ? (
            preview.rows.map((row) => (
              <div className="workout-session-row" key={row.id}>
                <div className="workout-session-row-index">{row.index}</div>
                <div className="workout-session-row-main">{row.name}</div>
                <div className="workout-session-row-meta">
                  {row.pattern ? (
                    <div className="workout-session-row-pattern">{row.pattern}</div>
                  ) : null}
                  {row.weight ? (
                    <div className="workout-session-row-weight">{row.weight}</div>
                  ) : null}
                </div>
                <div className="workout-session-row-chevron" aria-hidden="true">
                  &gt;
                </div>
              </div>
            ))
          ) : (
            <div className="workout-session-empty">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FocusCard({ panel }) {
  if (!panel) return null;
  return (
    <div className="workout-today-section">
      <div className="workout-today-section-label">{panel.kicker}</div>
      <div className="workout-today-card">
        <div className="workout-today-copy">{panel.copy}</div>
        {panel.sub ? <div className="workout-today-sub">{panel.sub}</div> : null}
        {panel.tags?.length ? (
          <div className="workout-today-tags">
            {panel.tags.map((tag) => (
              <span className={`workout-today-tag is-${tag.level}`} key={`${tag.name}-${tag.level}`}>
                {tag.name} {tag.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WarningCard({ card }) {
  if (!card) return null;
  return (
    <div className="workout-today-section">
      <div className="workout-today-section-label">{card.kicker}</div>
      <div className={`workout-warning-card${card.caution ? ' is-caution' : ''}`}>
        <div className="workout-warning-title">{card.title}</div>
        <div className="workout-warning-copy">{card.copy}</div>
      </div>
    </div>
  );
}

function SportReadiness({ sportReadiness }) {
  if (!sportReadiness) return null;
  return (
    <div className="sport-readiness-inline">
      <div className="sport-readiness-inline-header">
        <div className="sport-readiness-inline-title">{sportReadiness.title}</div>
        <div className="sport-readiness-inline-sub">{sportReadiness.subtitle}</div>
      </div>
      <div className="sport-readiness-step">
        <div className="sport-readiness-step-label">{sportReadiness.levelTitle}</div>
        <div className="sport-readiness-inline-grid sport-readiness-inline-grid-level">
          {sportReadiness.levels.map((option) => (
            <button
              type="button"
              className={`sport-readiness-chip sport-readiness-chip-${option.tone}${
                option.active ? ' active' : ''
              }`}
              data-sport-check-kind="level"
              data-sport-check-option={option.value}
              key={option.value}
              onClick={() => window.setPendingSportReadinessLevel?.(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {sportReadiness.showTimingStep ? (
        <div className="sport-readiness-step">
          <div className="sport-readiness-step-label">{sportReadiness.timingTitle}</div>
          <div className="sport-readiness-inline-grid sport-readiness-inline-grid-timing">
            {sportReadiness.timings.map((option) => (
              <button
                type="button"
                className={`sport-readiness-chip sport-readiness-chip-${sportReadiness.timingTone}${
                  option.active ? ' active' : ''
                }`}
                data-sport-check-kind="timing"
                data-sport-check-option={option.value}
                key={option.value}
                onClick={() => window.setPendingSportReadinessTiming?.(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {sportReadiness.hint ? (
            <div className="sport-readiness-inline-hint">{sportReadiness.hint}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LogStartIsland() {
  const snapshot = useIslandSnapshot(
    [LOG_START_EVENT, LANGUAGE_EVENT],
    getSnapshot
  );

  return (
    <div
      id="workout-not-started"
      style={{ display: snapshot.values.visible ? '' : 'none' }}
    >
      <div className="quick-log-row">
        <button className="quick-log-card ql-sport" type="button" onClick={() => window.quickLogSport?.()}>
          <div className="ql-icon">{snapshot.values.quickLog.icon}</div>
          <div>
            <div className="ql-title">{snapshot.values.quickLog.title}</div>
            <div className="ql-sub">{snapshot.values.quickLog.subtitle}</div>
          </div>
        </button>
      </div>

      <div className="divider-label">
        <span>{snapshot.labels.trainingSession}</span>
      </div>

      <div className="workout-start-shell">
        <div id="program-week-display" hidden />
        <input type="hidden" id="program-day-select" value={snapshot.values.selectedOption} readOnly />
        <div id="program-day-options" className="program-day-options">
          {snapshot.values.options.map((option) => (
            <button
              type="button"
              className={`program-day-option${option.selected ? ' active' : ''}${
                option.done ? ' done' : ''
              }${option.upcoming ? ' upcoming' : ''}`}
              key={option.value}
              onClick={() => window.setProgramDayOption?.(option.value)}
            >
              <div className="program-day-option-day">{snapshot.labels.day}</div>
              <div className="program-day-option-number">{option.dayNumber}</div>
              <div className="program-day-option-status">
                {option.statusIcon ? (
                  <span className="program-day-option-status-icon">
                    {option.statusIcon}
                  </span>
                ) : null}
                {option.status}
              </div>
            </button>
          ))}
        </div>
        <div id="program-warning-panel">
          <DecisionCard card={snapshot.values.decisionCard} />
          <WarningCard
            card={
              snapshot.values.warningCard
                ? {
                    ...snapshot.values.warningCard,
                    kicker: snapshot.labels.warningTitle,
                  }
                : null
            }
          />
        </div>
        <div id="program-session-preview">
          <PreviewCard preview={snapshot.values.preview} />
        </div>
        <div id="program-today-panel">
          <FocusCard panel={snapshot.values.focusPanel} />
        </div>
        <SportReadiness sportReadiness={snapshot.values.sportReadiness} />
        <div className="workout-start-footer">
          <button
            className="btn btn-primary cta-btn workout-start-cta"
            type="button"
            onClick={() => window.startWorkout?.()}
          >
            {snapshot.labels.startWorkout}
          </button>
        </div>
      </div>
    </div>
  );
}

mountIsland({
  mountId: 'log-start-react-root',
  legacyShellId: 'log-start-legacy-shell',
  mountedFlag: '__IRONFORGE_LOG_START_ISLAND_MOUNTED__',
  eventName: LOG_START_EVENT,
  Component: LogStartIsland,
});
