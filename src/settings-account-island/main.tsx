import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRuntimeStore } from '../app/store/runtime-store.ts';
import {
  checkDangerConfirm,
  clearAllData,
  exportData,
  importData,
  logout,
  retryCloudSync,
  saveLanguageSetting,
  showDangerConfirm,
} from '../app/services/settings-actions.ts';

type SettingsAccountLabels = {
  accountSection: string;
  languageLabel: string;
  optionEn: string;
  optionFi: string;
  signOut: string;
  retrySync: string;
  syncRetrying: string;
  dataBackup: string;
  export: string;
  import: string;
  backupHelp: string;
  nutritionTitle: string;
  nutritionHelp: string;
  danger: string;
  dangerDesc: string;
  dangerTypeConfirm: string;
  clearAll: string;
  clearAllConfirm: string;
};

type SettingsAccountValues = {
  email: string;
  syncLabel: string;
  syncClassName: string;
  syncDetail: string;
  showSyncRetry: boolean;
  syncRetryDisabled: boolean;
  language: string;
  backupContext: string;
  nutritionReady: boolean;
  appVersion: string;
  dangerOpen: boolean;
  dangerInput: string;
  dangerDeleteDisabled: boolean;
};

type SettingsAccountSnapshot = {
  labels: SettingsAccountLabels;
  values: SettingsAccountValues;
};

type SettingsAccountFormValues = Pick<
  SettingsAccountValues,
  'language' | 'dangerInput'
>;

function getSnapshot(): SettingsAccountSnapshot {
  const runtimeWindow = window as Window & {
    __IRONFORGE_APP_VERSION__?: string;
  };
  const appVersion = String(runtimeWindow.__IRONFORGE_APP_VERSION__ || '').trim();
  return {
    labels: {
      accountSection: 'Account',
      languageLabel: 'App language',
      optionEn: 'English',
      optionFi: 'Finnish',
      signOut: 'Sign Out',
      retrySync: 'Retry sync',
      syncRetrying: 'Retrying...',
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
      syncDetail: '',
      showSyncRetry: false,
      syncRetryDisabled: false,
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

function toAccountSnapshot(input: unknown): SettingsAccountSnapshot {
  const fallback = getSnapshot();
  if (!input || typeof input !== 'object') return fallback;
  const candidate = input as {
    labels?: Partial<SettingsAccountLabels>;
    values?: Partial<SettingsAccountValues>;
  };
  return {
    labels: {
      ...fallback.labels,
      ...(candidate.labels || {}),
    },
    values: {
      ...fallback.values,
      ...(candidate.values || {}),
      nutritionReady: candidate.values?.nutritionReady === true,
      dangerOpen: candidate.values?.dangerOpen === true,
      dangerDeleteDisabled: candidate.values?.dangerDeleteDisabled !== false,
    },
  };
}

function getFormValues(
  snapshot: SettingsAccountSnapshot
): SettingsAccountFormValues {
  return {
    language: snapshot.values.language ?? 'en',
    dangerInput: snapshot.values.dangerInput ?? '',
  };
}

function SettingsAccountIsland() {
  const rawSnapshot = useRuntimeStore((state) => state.pages.settingsAccountView);
  const snapshot = useMemo(() => toAccountSnapshot(rawSnapshot), [rawSnapshot]);
  const [formValues, setFormValues] = useState(() => getFormValues(snapshot));
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFormValues(getFormValues(snapshot));
  }, [snapshot]);

  const labels = snapshot.labels;
  const values = snapshot.values;

  function updateField<K extends keyof SettingsAccountFormValues>(
    key: K,
    value: SettingsAccountFormValues[K]
  ) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    importData(event.nativeEvent);
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
        {values.syncDetail ? (
          <div className="settings-note settings-note-tight" data-ui="sync-detail">
            {values.syncDetail}
          </div>
        ) : null}
        {values.showSyncRetry ? (
          <button
            className="btn btn-secondary settings-row-button"
            type="button"
            data-ui="retry-sync"
            disabled={values.syncRetryDisabled}
            onClick={() => {
              void retryCloudSync();
            }}
          >
            {values.syncRetryDisabled ? labels.syncRetrying : labels.retrySync}
          </button>
        ) : null}
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
              onChange={handleImportChange}
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
              autoFocus
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
