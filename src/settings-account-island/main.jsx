import { useEffect, useRef, useState } from 'react';
import { useRuntimeStore } from '../app/store/runtime-store.ts';
import {
  checkDangerConfirm,
  clearAllData,
  exportData,
  importData,
  logout,
  saveLanguageSetting,
  showDangerConfirm,
} from '../app/services/settings-actions.ts';

function getSnapshot() {
  const appVersion = String(window.__IRONFORGE_APP_VERSION__ || '').trim();
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
      backupHelp:
        'Export saves all data as a JSON file. Import replaces all current data.',
      nutritionTitle: 'AI Nutrition Coach',
      nutritionHelp:
        'Sign in to use Nutrition Coach. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.',
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
      nutritionReady: false,
      appVersion: appVersion ? `Ironforge v${appVersion}` : 'Ironforge',
      dangerOpen: false,
      dangerInput: '',
      dangerDeleteDisabled: true,
    },
  };
}

function getFormValues(snapshot) {
  return {
    language: snapshot.values.language ?? 'en',
    dangerInput: snapshot.values.dangerInput ?? '',
  };
}

function SettingsAccountIsland() {
  const snapshot =
    useRuntimeStore((state) => state.pages.settingsAccountView) || getSnapshot();
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
      <div className="card" data-ui="settings-account-card">
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
              saveLanguageSetting(nextLanguage);
            }}
          >
            <option value="en">{labels.optionEn}</option>
            <option value="fi">{labels.optionFi}</option>
          </select>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => logout()}
        >
          {labels.signOut}
        </button>
      </div>

      <div className="card" data-ui="settings-backup-card">
        <div className="card-title">{labels.dataBackup}</div>
        <div className="settings-note settings-note-top" id="backup-context">
          {values.backupContext}
        </div>
        <div className="settings-button-row">
          <button
            className="btn btn-secondary settings-row-button"
            type="button"
            onClick={() => exportData()}
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
              data-ui="settings-backup-import"
              onChange={(event) => importData(event.nativeEvent)}
            />
          </label>
        </div>
        <div className="settings-note settings-note-tight">
          {labels.backupHelp}
        </div>
      </div>

      <div className="card" data-ui="settings-nutrition-card">
        <div className="card-title">{labels.nutritionTitle}</div>
        <div className="settings-note settings-note-top">
          {labels.nutritionHelp}
        </div>
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
                checkDangerConfirm(nextValue);
              }}
            />
            <button
              className="btn btn-ghost danger-btn danger-btn-final"
              id="danger-zone-delete-btn"
              type="button"
              disabled={values.dangerDeleteDisabled}
              onClick={() => clearAllData()}
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
            onClick={() => showDangerConfirm()}
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

export { SettingsAccountIsland };
