import { useEffect, useState } from 'react';
import { useRuntimeStore } from '../app/store/runtime-store.ts';
import { saveBodyMetrics } from '../app/services/settings-actions.ts';

function getSnapshot() {
  return {
    labels: {
      metricsTitle: 'Body Metrics',
      metricsHelp:
        'Used by the AI Nutrition Coach to personalise advice. All weights in kg.',
      sex: 'Sex',
      sexNone: '— select —',
      sexMale: 'Male',
      sexFemale: 'Female',
      activity: 'Activity level',
      activityNone: '— select —',
      activitySedentary: 'Sedentary',
      activityLight: 'Lightly active',
      activityModerate: 'Active',
      activityVery: 'Very active',
      weight: 'Current weight (kg)',
      height: 'Height (cm)',
      age: 'Age',
      targetWeight: 'Target weight (kg)',
      goalTitle: 'Body Composition Goal',
      goalLabel: 'What are you working towards?',
      goalNone: '— select —',
      goalLoseFat: 'Lose fat',
      goalGainMuscle: 'Gain muscle',
      goalRecomp: 'Body recomp (lose fat + gain muscle)',
      goalMaintain: 'Maintain',
      save: 'Save',
    },
    values: {
      sex: '',
      activityLevel: '',
      weight: '',
      height: '',
      age: '',
      targetWeight: '',
      bodyGoal: '',
    },
  };
}

function getFormValues(snapshot) {
  return {
    sex: snapshot.values.sex ?? '',
    activityLevel: snapshot.values.activityLevel ?? '',
    weight: snapshot.values.weight ?? '',
    height: snapshot.values.height ?? '',
    age: snapshot.values.age ?? '',
    targetWeight: snapshot.values.targetWeight ?? '',
    bodyGoal: snapshot.values.bodyGoal ?? '',
  };
}

function SettingsBodyIsland() {
  const snapshot =
    useRuntimeStore((state) => state.pages.settingsBodyView) || getSnapshot();
  const [formValues, setFormValues] = useState(() => getFormValues(snapshot));

  useEffect(() => {
    setFormValues(getFormValues(snapshot));
  }, [snapshot]);

  const labels = snapshot.labels;

  function handleFieldChange(event) {
    const { id, value } = event.target;
    setFormValues((current) => ({
      ...current,
      [id === 'body-sex'
        ? 'sex'
        : id === 'body-activity'
          ? 'activityLevel'
          : id === 'body-weight'
            ? 'weight'
            : id === 'body-height'
              ? 'height'
              : id === 'body-age'
                ? 'age'
                : id === 'body-target-weight'
                  ? 'targetWeight'
                  : 'bodyGoal']: value,
    }));
  }

  return (
    <>
      <div className="card" data-ui="settings-body-metrics-card">
        <div className="card-title">{labels.metricsTitle}</div>
        <div className="settings-note settings-note-top">{labels.metricsHelp}</div>
        <div className="settings-row-2col">
          <div className="account-field">
            <label htmlFor="body-sex">{labels.sex}</label>
            <select id="body-sex" value={formValues.sex} onChange={handleFieldChange}>
              <option value="">{labels.sexNone}</option>
              <option value="male">{labels.sexMale}</option>
              <option value="female">{labels.sexFemale}</option>
            </select>
          </div>
          <div className="account-field">
            <label htmlFor="body-activity">{labels.activity}</label>
            <select
              id="body-activity"
              value={formValues.activityLevel}
              onChange={handleFieldChange}
            >
              <option value="">{labels.activityNone}</option>
              <option value="sedentary">{labels.activitySedentary}</option>
              <option value="light">{labels.activityLight}</option>
              <option value="moderate">{labels.activityModerate}</option>
              <option value="very_active">{labels.activityVery}</option>
            </select>
          </div>
        </div>
        <div className="settings-row-2col">
          <div className="account-field">
            <label htmlFor="body-weight">{labels.weight}</label>
            <input
              type="number"
              id="body-weight"
              min="30"
              max="300"
              step="0.1"
              placeholder="e.g. 82"
              value={formValues.weight}
              onChange={handleFieldChange}
            />
          </div>
          <div className="account-field">
            <label htmlFor="body-height">{labels.height}</label>
            <input
              type="number"
              id="body-height"
              min="100"
              max="250"
              step="1"
              placeholder="e.g. 178"
              value={formValues.height}
              onChange={handleFieldChange}
            />
          </div>
        </div>
        <div className="settings-row-2col">
          <div className="account-field">
            <label htmlFor="body-age">{labels.age}</label>
            <input
              type="number"
              id="body-age"
              min="10"
              max="100"
              step="1"
              placeholder="e.g. 28"
              value={formValues.age}
              onChange={handleFieldChange}
            />
          </div>
          <div className="account-field">
            <label htmlFor="body-target-weight">{labels.targetWeight}</label>
            <input
              type="number"
              id="body-target-weight"
              min="30"
              max="300"
              step="0.1"
              placeholder="e.g. 85"
              value={formValues.targetWeight}
              onChange={handleFieldChange}
            />
          </div>
        </div>
      </div>

      <div className="card" data-ui="settings-body-goal-card">
        <div className="card-title">{labels.goalTitle}</div>
        <div className="account-field">
          <label htmlFor="body-goal">{labels.goalLabel}</label>
          <select id="body-goal" value={formValues.bodyGoal} onChange={handleFieldChange}>
            <option value="">{labels.goalNone}</option>
            <option value="lose_fat">{labels.goalLoseFat}</option>
            <option value="gain_muscle">{labels.goalGainMuscle}</option>
            <option value="recomp">{labels.goalRecomp}</option>
            <option value="maintain">{labels.goalMaintain}</option>
          </select>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => saveBodyMetrics()}
        >
          {labels.save}
        </button>
      </div>
    </>
  );
}

export { SettingsBodyIsland };
