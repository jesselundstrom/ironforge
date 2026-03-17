import { useEffect, useState } from 'react';
import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const SETTINGS_PREFERENCES_EVENT =
  window.__IRONFORGE_SETTINGS_PREFERENCES_ISLAND_EVENT__ ||
  'ironforge:settings-preferences-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';

function getSnapshot() {
  if (typeof window.getSettingsPreferencesReactSnapshot === 'function') {
    return window.getSettingsPreferencesReactSnapshot();
  }

  return {
    labels: {
      statusBar: '',
      title: 'Training Preferences',
      help: 'These preferences shape future smart recommendations and AI-generated training.',
      goalsSection: 'Goals & Volume',
      goalLabel: 'Primary Goal',
      goalStrength: 'Strength',
      goalHypertrophy: 'Hypertrophy',
      goalGeneralFitness: 'General Fitness',
      goalSportSupport: 'Sport Support',
      trainingDaysLabel: 'Target Training Frequency',
      trainingDays2: '2 sessions / week',
      trainingDays3: '3 sessions / week',
      trainingDays4: '4 sessions / week',
      trainingDays5: '5 sessions / week',
      trainingDays6: '6 sessions / week',
      sessionDurationLabel: 'Target Session Length',
      duration30: '30 min',
      duration45: '45 min',
      duration60: '60 min',
      duration75: '75 min',
      duration90: '90 min',
      equipmentSection: 'Equipment & Session Prep',
      equipmentLabel: 'Equipment Access',
      equipmentFullGym: 'Full Gym',
      equipmentBasicGym: 'Basic Gym',
      equipmentHomeGym: 'Home Gym',
      equipmentMinimal: 'Minimal Equipment',
      warmupTitle: 'Automatic warm-up sets',
      warmupHelp:
        'Prepend warm-up ramp sets (50%-85%) to main compound lifts at the start of each workout.',
      sportCheckTitle: 'Pre-workout sport check-in',
      sportCheckHelp:
        'Ask about sport load around today before recommending the session.',
      sessionSection: 'Session Settings',
      restLabel: 'Default Rest Timer',
      off: 'Off',
      notesLabel: 'Notes, limitations, preferences',
      notesPlaceholder:
        'e.g. Avoid high-impact jumps, prefer barbell compounds, 60 min cap',
      restartOnboarding: 'Run Guided Setup Again',
    },
    values: {
      summary: '',
      goal: 'strength',
      trainingDaysPerWeek: '3',
      sessionMinutes: '60',
      equipmentAccess: 'full_gym',
      warmupSetsEnabled: true,
      sportReadinessCheckEnabled: true,
      defaultRest: '120',
      notes: '',
    },
  };
}

function getFormValues(snapshot) {
  return {
    goal: snapshot.values.goal ?? 'strength',
    trainingDaysPerWeek: snapshot.values.trainingDaysPerWeek ?? '3',
    sessionMinutes: snapshot.values.sessionMinutes ?? '60',
    equipmentAccess: snapshot.values.equipmentAccess ?? 'full_gym',
    warmupSetsEnabled: snapshot.values.warmupSetsEnabled === true,
    sportReadinessCheckEnabled: snapshot.values.sportReadinessCheckEnabled === true,
    defaultRest: snapshot.values.defaultRest ?? '120',
    notes: snapshot.values.notes ?? '',
  };
}

function SettingsPreferencesIsland() {
  const snapshot = useIslandSnapshot(
    [SETTINGS_PREFERENCES_EVENT, LANGUAGE_EVENT],
    getSnapshot
  );
  const [formValues, setFormValues] = useState(() => getFormValues(snapshot));

  useEffect(() => {
    setFormValues(getFormValues(snapshot));
  }, [snapshot]);

  const labels = snapshot.labels;

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <div className="settings-status-bar" id="training-status-bar">
        {snapshot.values.summary || labels.statusBar}
      </div>
      <details className="settings-panel" id="training-preferences-panel" open>
        <summary className="settings-panel-summary">
          <div>
            <div className="settings-panel-title">{labels.title}</div>
            <div className="settings-panel-sub" id="training-preferences-summary">
              {snapshot.values.summary}
            </div>
          </div>
          <div className="settings-panel-chevron">⌄</div>
        </summary>
        <div className="settings-panel-body">
          <div className="settings-help-text">{labels.help}</div>

          <div className="settings-subsection">
            <div className="settings-subsection-title">{labels.goalsSection}</div>
            <label htmlFor="training-goal">{labels.goalLabel}</label>
            <select
              id="training-goal"
              value={formValues.goal}
              onChange={(event) => {
                updateField('goal', event.target.value);
                window.saveTrainingPreferences?.();
              }}
            >
              <option value="strength">{labels.goalStrength}</option>
              <option value="hypertrophy">{labels.goalHypertrophy}</option>
              <option value="general_fitness">{labels.goalGeneralFitness}</option>
              <option value="sport_support">{labels.goalSportSupport}</option>
            </select>

            <label className="label-spaced" htmlFor="training-days-per-week">
              {labels.trainingDaysLabel}
            </label>
            <select
              id="training-days-per-week"
              value={formValues.trainingDaysPerWeek}
              onChange={(event) => {
                updateField('trainingDaysPerWeek', event.target.value);
                window.saveTrainingPreferences?.();
              }}
            >
              <option value="2">{labels.trainingDays2}</option>
              <option value="3">{labels.trainingDays3}</option>
              <option value="4">{labels.trainingDays4}</option>
              <option value="5">{labels.trainingDays5}</option>
              <option value="6">{labels.trainingDays6}</option>
            </select>

            <label className="label-spaced" htmlFor="training-session-minutes">
              {labels.sessionDurationLabel}
            </label>
            <select
              id="training-session-minutes"
              value={formValues.sessionMinutes}
              onChange={(event) => {
                updateField('sessionMinutes', event.target.value);
                window.saveTrainingPreferences?.();
              }}
            >
              <option value="30">{labels.duration30}</option>
              <option value="45">{labels.duration45}</option>
              <option value="60">{labels.duration60}</option>
              <option value="75">{labels.duration75}</option>
              <option value="90">{labels.duration90}</option>
            </select>
          </div>

          <div className="settings-subsection">
            <div className="settings-subsection-title">{labels.equipmentSection}</div>
            <label htmlFor="training-equipment">{labels.equipmentLabel}</label>
            <select
              id="training-equipment"
              value={formValues.equipmentAccess}
              onChange={(event) => {
                updateField('equipmentAccess', event.target.value);
                window.saveTrainingPreferences?.();
              }}
            >
              <option value="full_gym">{labels.equipmentFullGym}</option>
              <option value="basic_gym">{labels.equipmentBasicGym}</option>
              <option value="home_gym">{labels.equipmentHomeGym}</option>
              <option value="minimal">{labels.equipmentMinimal}</option>
            </select>

            <label className="toggle-row toggle-row-spaced" htmlFor="training-warmup-sets">
              <div>
                <div className="toggle-row-title">{labels.warmupTitle}</div>
                <div className="toggle-row-sub">{labels.warmupHelp}</div>
              </div>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  id="training-warmup-sets"
                  checked={formValues.warmupSetsEnabled}
                  onChange={(event) => {
                    updateField('warmupSetsEnabled', event.target.checked);
                    window.saveTrainingPreferences?.();
                  }}
                />
                <span className="toggle-track">
                  <span className="toggle-thumb"></span>
                </span>
              </div>
            </label>

            <label className="toggle-row" htmlFor="training-sport-check">
              <div>
                <div className="toggle-row-title">{labels.sportCheckTitle}</div>
                <div className="toggle-row-sub">{labels.sportCheckHelp}</div>
              </div>
              <div className="toggle-switch sport-toggle">
                <input
                  type="checkbox"
                  id="training-sport-check"
                  checked={formValues.sportReadinessCheckEnabled}
                  onChange={(event) => {
                    updateField('sportReadinessCheckEnabled', event.target.checked);
                    window.saveTrainingPreferences?.();
                  }}
                />
                <span className="toggle-track">
                  <span className="toggle-thumb"></span>
                </span>
              </div>
            </label>
          </div>

          <div className="settings-subsection">
            <div className="settings-subsection-title">{labels.sessionSection}</div>
            <div
              className="settings-panel-inline-row"
              style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}
            >
              <label className="settings-inline-control-label" htmlFor="default-rest">
                {labels.restLabel}
              </label>
              <select
                id="default-rest"
                className="settings-inline-control-select"
                value={formValues.defaultRest}
                onChange={(event) => {
                  updateField('defaultRest', event.target.value);
                  window.saveRestTimer?.();
                }}
              >
                <option value="60">1 min</option>
                <option value="90">90 sec</option>
                <option value="120">2 min</option>
                <option value="180">3 min</option>
                <option value="300">5 min</option>
                <option value="0">{labels.off}</option>
              </select>
            </div>

            <label className="label-spaced" htmlFor="training-preferences-notes">
              {labels.notesLabel}
            </label>
            <textarea
              id="training-preferences-notes"
              rows="4"
              placeholder={labels.notesPlaceholder}
              value={formValues.notes}
              onChange={(event) => {
                updateField('notes', event.target.value);
                window.saveTrainingPreferences?.();
              }}
            ></textarea>
          </div>

          <button
            className="btn btn-secondary settings-action-primary"
            type="button"
            onClick={() => window.restartOnboarding?.()}
          >
            {labels.restartOnboarding}
          </button>
        </div>
      </details>
    </>
  );
}

mountIsland({
  mountId: 'settings-preferences-react-root',
  legacyShellId: 'settings-preferences-legacy-shell',
  mountedFlag: '__IRONFORGE_SETTINGS_PREFERENCES_ISLAND_MOUNTED__',
  eventName: SETTINGS_PREFERENCES_EVENT,
  Component: SettingsPreferencesIsland,
});
