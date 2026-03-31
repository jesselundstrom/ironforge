import { useEffect, useRef, useState } from 'react';
import { useRuntimeStore } from '../app/store/runtime-store.ts';
import { workoutStore } from '../stores/workout-store.ts';
import { t } from '../app/services/i18n.ts';
import {
  getSelectedBonusDuration,
  quickLogSport,
  setPendingEnergyLevel,
  setPendingSessionMode,
  setPendingSportReadinessLevel,
  setPendingSportReadinessTiming,
  setProgramDayOption,
  setSelectedBonusDuration,
  setSelectedWorkoutStartOption,
} from '../app/services/workout-ui-actions.ts';

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
    sessionCharacter: null,
    preSessionNote: null,
    energyAssessment: null,
    sportReadiness: null,
  },
};

function PreviewCard({ preview, context }) {
  if (!preview) return null;
  const lead = context?.focusCopy || '';
  const note = context?.note || '';
  const metaTags = context?.tags || [];
  return (
    <div className="workout-today-section">
      <div className="workout-session-card">
        <div className="workout-session-card-head">
          <div className="workout-session-card-title">
            {preview.headerTitle}
          </div>
          <div className="workout-session-card-chips">
            {preview.chips.map((chip) => (
              <span className="workout-session-chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div className="workout-session-card-body">
          {lead || note || metaTags.length ? (
            <div className="workout-session-brief">
              {lead ? (
                <div className="workout-session-brief-copy">{lead}</div>
              ) : null}
              {note && note !== lead ? (
                <div className="workout-session-brief-note">{note}</div>
              ) : null}
              {metaTags.length ? (
                <div className="workout-session-brief-tags">
                  {metaTags.map((tag) => (
                    <span
                      className={`workout-today-tag is-${tag.level}`}
                      key={`${tag.name}-${tag.level}`}
                    >
                      {tag.name} {tag.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {preview.rows.length ? (
            preview.rows.map((row) => (
              <div className="workout-session-row" key={row.id}>
                <div className="workout-session-row-index">{row.index}</div>
                <div className="workout-session-row-main">{row.name}</div>
                <div className="workout-session-row-meta">
                  {row.pattern ? (
                    <div className="workout-session-row-pattern">
                      {row.pattern}
                    </div>
                  ) : null}
                  {row.weight ? (
                    <div className="workout-session-row-weight">
                      {row.weight}
                    </div>
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

function SportReadiness({ sportReadiness, embedded = false }) {
  if (!sportReadiness) return null;
  return (
    <div className={`sport-readiness-inline${embedded ? ' is-embedded' : ''}`}>
      <div className="sport-readiness-inline-header">
        <div className="sport-readiness-inline-title">
          {sportReadiness.title}
        </div>
        <div className="sport-readiness-inline-sub">
          {sportReadiness.subtitle}
        </div>
      </div>
      <div className="sport-readiness-step">
        <div className="sport-readiness-step-label">
          {sportReadiness.levelTitle}
        </div>
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
              onClick={() =>
                setPendingSportReadinessLevel(option.value)
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {sportReadiness.showTimingStep ? (
        <div className="sport-readiness-step">
          <div className="sport-readiness-step-label">
            {sportReadiness.timingTitle}
          </div>
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
                onClick={() =>
                  setPendingSportReadinessTiming(option.value)
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          {sportReadiness.hint ? (
            <div className="sport-readiness-inline-hint">
              {sportReadiness.hint}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EnergyAssessment({ assessment }) {
  if (!assessment) return null;
  return (
    <div className="energy-assessment is-embedded">
      <div className="energy-assessment-label">{assessment.title}</div>
      <div className="energy-assessment-options">
        {assessment.options.map((opt) => (
          <button
            type="button"
            className={`energy-assessment-btn energy-assessment-btn-${opt.tone}${
              opt.active ? ' active' : ''
            }`}
            key={opt.value}
            onClick={() => setPendingEnergyLevel(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getSportLoadDecisionContext(sportReadiness, decisionCard) {
  if (!sportReadiness || !decisionCard?.reasons?.length) return null;
  const sportLoadLabel = t('training.reason.sport_load.label', 'Sport load');
  if (!decisionCard.reasons.includes(sportLoadLabel)) return null;

  const activeLevel = sportReadiness.levels?.find(
    (option) => option.active && option.value !== 'none'
  );
  if (!activeLevel) return null;

  const activeTiming = sportReadiness.timings?.find((option) => option.active);
  return {
    label: sportLoadLabel,
    value: activeLevel.label,
    timing: activeTiming?.label || '',
  };
}

function SessionSetupCard({
  assessment,
  sportReadiness,
  decisionCard,
  warningCard,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeMode = decisionCard?.options?.find((option) => option.active);
  const setupKicker = t('workout.setup.kicker', 'Session setup');
  const advancedLabel = t(
    'workout.setup.advanced_toggle',
    'Fine-tune: {mode}',
    { mode: activeMode?.title || 'Auto' }
  );
  const advancedHint = t(
    'workout.setup.advanced_hint',
    'Use this only if you want to override the usual recommendation.'
  );

  if (
    !assessment &&
    !sportReadiness &&
    !decisionCard?.options?.length &&
    !warningCard
  ) {
    return null;
  }

  const summary = decisionCard
    ? {
        kicker: decisionCard.kicker,
        title: decisionCard.title,
        copy: decisionCard.copy,
        reasons: decisionCard.reasons,
        tone: 'is-recommendation',
      }
    : warningCard
      ? {
          kicker: warningCard.kicker,
          title: warningCard.title,
          copy: warningCard.copy,
          reasons: [],
          tone: warningCard.caution ? 'is-caution' : '',
        }
      : null;
  const sportLoadContext = getSportLoadDecisionContext(
    sportReadiness,
    decisionCard
  );

  return (
    <div className="workout-today-section">
      <div className="workout-today-section-label">{setupKicker}</div>
      <div className="workout-setup-card">
        {summary ? (
          <div
            className={`workout-setup-summary${summary.tone ? ` ${summary.tone}` : ''}`}
          >
            <div className="workout-setup-summary-title">{summary.title}</div>
            <div className="workout-setup-summary-copy">{summary.copy}</div>
            {sportLoadContext ? (
              <div className="workout-setup-summary-context">
                <span className="workout-setup-summary-context-label">
                  {sportLoadContext.label}:
                </span>
                <span>{sportLoadContext.value}</span>
                {sportLoadContext.timing ? (
                  <span className="workout-setup-summary-context-timing">
                    {sportLoadContext.timing}
                  </span>
                ) : null}
              </div>
            ) : null}
            {summary.reasons?.length ? (
              <div className="workout-decision-reasons">
                {summary.reasons.map((reason) => (
                  <div className="workout-decision-chip" key={reason}>
                    {reason}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {assessment ? <EnergyAssessment assessment={assessment} /> : null}
        {sportReadiness ? (
          <SportReadiness sportReadiness={sportReadiness} embedded />
        ) : null}
        {decisionCard?.options?.length ? (
          <div className="workout-setup-advanced-wrap">
            <button
              className={`workout-setup-advanced-toggle${
                advancedOpen ? ' is-open' : ''
              }`}
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen ? 'true' : 'false'}
            >
              <span>{advancedLabel}</span>
              <span
                className="workout-setup-advanced-chevron"
                aria-hidden="true"
              >
                {advancedOpen ? '-' : '+'}
              </span>
            </button>
            <div className="workout-setup-advanced-hint">{advancedHint}</div>
            {advancedOpen ? (
              <div className="workout-decision-options workout-decision-options-embedded">
                {decisionCard.options.map((option) => (
                  <button
                    className={`workout-decision-option${
                      option.active ? ' is-active' : ''
                    }`}
                    type="button"
                    key={option.value}
                    onClick={() => setPendingSessionMode(option.value)}
                  >
                    <div className="workout-decision-option-title">
                      {option.title}
                    </div>
                    <div className="workout-decision-option-copy">
                      {option.copy}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BonusDurationChooser({ options, selected, onChange }) {
  if (!options?.length) return null;
  return (
    <div className="bonus-duration-chooser">
      {options.map((opt) => (
        <button
          type="button"
          className={`bonus-duration-btn${opt.value === selected ? ' active' : ''}`}
          key={opt.value}
          onClick={(e) => {
            e.stopPropagation();
            onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function BonusSessionCard({ bonus, onSelect, selected, duration, onDurationChange }) {
  if (!bonus?.available) return null;
  const preview = selected ? bonus.previews?.[duration] : null;
  return (
    <div className="workout-today-section">
      <div className="workout-today-section-label">{bonus.kicker}</div>
      <div
        className={`workout-session-card bonus-session-card${selected ? ' is-selected' : ''}`}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="workout-session-card-head">
          <div className="workout-session-card-title">{bonus.label}</div>
          {bonus.targetGroups?.length ? (
            <div className="workout-session-card-chips">
              {bonus.targetGroups.slice(0, 3).map((group) => (
                <span className="workout-session-chip" key={group}>
                  {group}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="workout-session-card-body">
          <div className="workout-session-brief">
            <div className="workout-session-brief-note">{bonus.subtitle}</div>
          </div>
          {selected ? (
            <>
              <BonusDurationChooser
                options={bonus.durationOptions}
                selected={duration}
                onChange={onDurationChange}
              />
              {preview?.rows?.length
                ? preview.rows.map((row) => (
                    <div className="workout-session-row" key={row.id}>
                      <div className="workout-session-row-index">
                        {row.index}
                      </div>
                      <div className="workout-session-row-main">
                        {row.name}
                      </div>
                      <div className="workout-session-row-meta">
                        <div className="workout-session-row-pattern">
                          {row.pattern}
                        </div>
                      </div>
                      <div
                        className="workout-session-row-chevron"
                        aria-hidden="true"
                      >
                        &gt;
                      </div>
                    </div>
                  ))
                : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LogStartIsland() {
  const snapshot =
    useRuntimeStore((state) => state.workoutSession.logStartView) ||
    initialSnapshot;
  const bonus = snapshot.values.bonusSession;
  const allDone =
    snapshot.values.options.length > 0 &&
    snapshot.values.options.every((o) => o.done);
  const [bonusSelected, setBonusSelected] = useState(false);
  const [bonusDuration, setBonusDuration] = useState(
    () => getSelectedBonusDuration() || 'standard'
  );
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (allDone && bonus?.available && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
      setBonusSelected(true);
      setSelectedWorkoutStartOption('bonus');
    }
  }, [allDone, bonus?.available]);

  useEffect(() => {
    const selectedOption = snapshot.values.selectedOption || '';
    setBonusSelected(selectedOption === 'bonus');
  }, [snapshot.values.selectedOption]);

  useEffect(() => {
    const selectedDuration = getSelectedBonusDuration() || 'standard';
    setBonusDuration(selectedDuration);
  }, [snapshot.values.selectedOption, bonus?.available]);

  function selectBonus() {
    setBonusSelected(true);
    setSelectedWorkoutStartOption('bonus');
  }

  function selectDay(value) {
    setBonusSelected(false);
    setProgramDayOption(value);
  }

  function changeBonusDuration(value) {
    setBonusDuration(value);
    setSelectedBonusDuration(value);
  }

  return (
    <div
      id="workout-not-started"
      style={{ display: snapshot.values.visible ? '' : 'none' }}
    >
      <div className="quick-log-row">
        <button
          className="quick-log-card ql-sport"
          type="button"
          onClick={() => quickLogSport()}
        >
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
        <div id="program-day-options" className="program-day-options">
          {snapshot.values.options.map((option) => (
            <button
              type="button"
              className={`program-day-option${
                !bonusSelected && option.selected ? ' active' : ''
              }${option.done ? ' done' : ''}${
                option.upcoming ? ' upcoming' : ''
              }`}
              key={option.value}
              data-option-value={option.value}
              onClick={() => selectDay(option.value)}
            >
              <div className="program-day-option-day">
                {snapshot.labels.day}
              </div>
              <div className="program-day-option-number">
                {option.dayNumber}
              </div>
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

        {bonus?.available ? (
          <BonusSessionCard
            bonus={bonus}
            onSelect={selectBonus}
            selected={bonusSelected}
            duration={bonusDuration}
            onDurationChange={changeBonusDuration}
          />
        ) : null}

        {!bonusSelected ? (
          <>
            <SessionSetupCard
              assessment={snapshot.values.energyAssessment}
              sportReadiness={snapshot.values.sportReadiness}
              decisionCard={snapshot.values.decisionCard}
              warningCard={
                snapshot.values.warningCard
                  ? {
                      ...snapshot.values.warningCard,
                      kicker: snapshot.labels.warningTitle,
                    }
                  : null
              }
            />
            <div id="program-session-preview">
              <PreviewCard
                preview={snapshot.values.preview}
                context={{
                  focusCopy: snapshot.values.focusPanel?.copy,
                  note: snapshot.values.preSessionNote,
                  tags: snapshot.values.focusPanel?.tags || [],
                }}
              />
            </div>
          </>
        ) : null}

        <div id="program-warning-panel" hidden />
        <div className="workout-start-footer">
          <button
            className={`btn btn-primary cta-btn workout-start-cta${
              bonusSelected ? ' bonus-cta' : ''
            }`}
            type="button"
            onClick={() => workoutStore.getState().startWorkout()}
          >
            {bonusSelected
              ? bonus?.startLabel || snapshot.labels.startWorkout
              : snapshot.labels.startWorkout}
          </button>
        </div>
      </div>
    </div>
  );
}

export { LogStartIsland };
