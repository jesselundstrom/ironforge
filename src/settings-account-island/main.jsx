import { useEffect, useRef, useState } from 'react';
import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const SETTINGS_ACCOUNT_EVENT =
  window.__IRONFORGE_SETTINGS_ACCOUNT_ISLAND_EVENT__ ||
  'ironforge:settings-account-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';

function getSnapshot() {
  if (typeof window.getSettingsAccountReactSnapshot === 'function') {
    return window.getSettingsAccountReactSnapshot();
  }

  return {
    labels: {
      accountSection: 'Account',
      languageLabel: 'App language',
      optionEn: 'English',
      optionFi: 'Finnish',
      signOut: 'Sign Out',
      dataBackup: 'Data Backup',
      export: 'Export',
      import: 'Import',
      backupHelp: 'Export saves all data as a JSON file. Import replaces all current data.',
      apiTitle: 'AI Nutrition Coach',
      apiHelp:
        'Get your free API key at console.anthropic.com. The key is stored only on this device and is never synced to the cloud.',
      apiLabel: 'Claude API Key',
      apiPlaceholder: 'sk-ant-...',
      apiSave: 'Save Key',
      danger: 'Danger Zone',
      dangerDesc:
        'This permanently deletes all your workouts, programs, and settings. This cannot be undone.',
      dangerTypeConfirm: 'Type DELETE to confirm',
      clearAll: 'Clear All Data',
      clearAllConfirm: 'Permanently Delete All Data',
    },
    values: {
      email: '',
      syncLabel: 'Synced to cloud',
      syncClassName: 'sync-status synced',
      language: 'en',
      backupContext: '',
      apiKey: '',
      appVersion: 'Ironforge v1.0.0',
      dangerOpen: false,
      dangerInput: '',
      dangerDeleteDisabled: true,
    },
  };
}

function getFormValues(snapshot) {
  return {
    language: snapshot.values.language ?? 'en',
    apiKey: snapshot.values.apiKey ?? '',
    dangerInput: snapshot.values.dangerInput ?? '',
  };
}

function SettingsAccountIsland() {
  const snapshot = useIslandSnapshot(
    [SETTINGS_ACCOUNT_EVENT, LANGUAGE_EVENT],
    getSnapshot
  );
  const [formValues, setFormValues] = useState(() => getFormValues(snapshot));
  const importRef = useRef(null);

  useEffect(() => {
    setFormValues(getFormValues(snapshot));
  }, [snapshot]);

  const labels = snapshot.labels;
  const values = snapshot.values;

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <div className="card">
        <div className="card-title">{labels.accountSection}</div>
        <div className="account-email" id="account-email">
          {values.email}
        </div>
        <div className={values.syncClassName} id="sync-status">
          {values.syncLabel}
        </div>
        <div className="account-field">
          <label htmlFor="app-language">{labels.languageLabel}</label>
          <select
            id="app-language"
            value={formValues.language}
            onChange={(event) => {
              const nextLanguage = event.target.value;
              updateField('language', nextLanguage);
              window.saveLanguageSetting?.(nextLanguage);
            }}
          >
            <option value="en">{labels.optionEn}</option>
            <option value="fi">{labels.optionFi}</option>
          </select>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => window.logout?.()}>
          {labels.signOut}
        </button>
      </div>

      <div className="card">
        <div className="card-title">{labels.dataBackup}</div>
        <div className="settings-note settings-note-top" id="backup-context">
          {values.backupContext}
        </div>
        <div className="settings-button-row">
          <button
            className="btn btn-secondary settings-row-button"
            type="button"
            onClick={() => window.exportData?.()}
          >
            {labels.export}
          </button>
          <label className="btn btn-secondary settings-row-button settings-import-button">
            {labels.import}
            <input
              ref={importRef}
              type="file"
              accept=".json"
              className="file-input-hidden"
              onChange={(event) => window.importData?.(event)}
            />
          </label>
        </div>
        <div className="settings-note settings-note-tight">{labels.backupHelp}</div>
      </div>

      <div className="card">
        <div className="card-title">{labels.apiTitle}</div>
        <div className="settings-note settings-note-top">{labels.apiHelp}</div>
        <div className="account-field">
          <label htmlFor="nutrition-api-key-input">{labels.apiLabel}</label>
          <input
            type="password"
            id="nutrition-api-key-input"
            placeholder={labels.apiPlaceholder}
            autoComplete="off"
            spellCheck="false"
            value={formValues.apiKey}
            onChange={(event) => updateField('apiKey', event.target.value)}
          />
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => window.saveNutritionApiKey?.(formValues.apiKey)}
        >
          {labels.apiSave}
        </button>
      </div>

      <div className="card danger-zone-card">
        <div className="danger-zone-header">
          <span className="danger-zone-icon">&#9888;</span>
          <div className="card-title">{labels.danger}</div>
        </div>
        <div className="danger-zone-desc">{labels.dangerDesc}</div>
        {values.dangerOpen ? (
          <div className="danger-zone-confirm" id="danger-zone-confirm">
            <label className="danger-zone-label" htmlFor="danger-zone-input">
              {labels.dangerTypeConfirm}
            </label>
            <input
              type="text"
              id="danger-zone-input"
              className="danger-zone-input"
              placeholder="DELETE"
              autoComplete="off"
              spellCheck="false"
              value={formValues.dangerInput}
              onChange={(event) => {
                const nextValue = event.target.value;
                updateField('dangerInput', nextValue);
                window.checkDangerConfirm?.(nextValue);
              }}
            />
            <button
              className="btn btn-ghost danger-btn danger-btn-final"
              id="danger-zone-delete-btn"
              type="button"
              disabled={values.dangerDeleteDisabled}
              onClick={() => window.clearAllData?.()}
            >
              {labels.clearAllConfirm}
            </button>
          </div>
        ) : null}
        {!values.dangerOpen ? (
          <button
            className="btn btn-ghost danger-btn"
            id="danger-zone-trigger"
            type="button"
            onClick={() => window.showDangerConfirm?.()}
          >
            {labels.clearAll}
          </button>
        ) : null}
      </div>

      <div className="app-version" id="app-version">
        {values.appVersion}
      </div>
    </>
  );
}

mountIsland({
  mountId: 'settings-account-react-root',
  legacyShellId: 'settings-account-legacy-shell',
  mountedFlag: '__IRONFORGE_SETTINGS_ACCOUNT_ISLAND_MOUNTED__',
  eventName: SETTINGS_ACCOUNT_EVENT,
  Component: SettingsAccountIsland,
});
