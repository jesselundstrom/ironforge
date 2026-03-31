import { useEffect, useRef, useState } from 'react';
import { cn } from '../app/utils/cn.ts';
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

const cardClass =
  'mb-4 w-full rounded-card border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] bg-surface p-4 shadow-card transition-[border-color,background-color,transform] duration-200 hover:border-[#35353a] hover:shadow-none xl:mx-auto xl:max-w-[640px]';
const cardTitleClass =
  "mb-2.5 text-[11px] font-bold uppercase tracking-[1.2px] text-muted before:mr-1 before:align-middle before:text-[7px] before:text-accent/50 before:content-['\\25C6']";
const noteClass = 'text-[11px] leading-[1.45] text-muted';
const fieldClass = 'mb-3.5 border-t border-white/6 pt-2.5';
const buttonRowClass = 'mb-2.5 flex gap-2.5';
const buttonClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-[18px] py-3 font-condensed text-base font-bold uppercase tracking-[0.04em] transition-[transform,opacity,box-shadow,background-color,border-color,color] duration-200 active:scale-[0.97] active:opacity-90 disabled:pointer-events-none disabled:opacity-50';
const secondaryButtonClass = cn(
  buttonClass,
  'border border-border bg-white/[0.02] text-text hover:bg-white/[0.05]'
);
const ghostButtonClass = cn(
  buttonClass,
  'border border-white/8 bg-transparent text-text'
);
const dangerButtonClass = cn(
  ghostButtonClass,
  'border-red/30 text-red'
);

function getSyncState(syncClassName) {
  if (syncClassName.includes('error')) return 'error';
  if (syncClassName.includes('offline')) return 'offline';
  if (syncClassName.includes('syncing')) return 'syncing';
  return 'synced';
}

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
  const syncState = getSyncState(values.syncClassName || '');

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <div className={cardClass} data-ui="settings-account-card">
        <div className={cardTitleClass}>{labels.accountSection}</div>
        <div
          className={cn(
            'mb-3.5 text-[13px] text-muted empty:hidden',
            !values.email && 'hidden'
          )}
          id="account-email"
        >
          {values.email}
        </div>
        <div
          className={cn(
            'mb-3.5 rounded-xl border px-3 py-2.5 text-xs leading-[1.4] text-text',
            syncState === 'synced' &&
              'border-[rgba(76,175,121,0.28)] bg-[rgba(76,175,121,0.08)] text-[#dff8e8]',
            syncState === 'syncing' &&
              'border-[rgba(74,143,232,0.28)] bg-[rgba(74,143,232,0.08)] text-[#edf5ff]',
            syncState === 'offline' &&
              'border-[rgba(245,130,31,0.28)] bg-[rgba(245,130,31,0.08)] text-[#fff0df]',
            syncState === 'error' &&
              'border-[rgba(224,82,82,0.28)] bg-[rgba(224,82,82,0.08)] text-[#fff0f0]'
          )}
          id="sync-status"
          data-state={syncState}
        >
          {values.syncLabel}
        </div>
        <div className={fieldClass}>
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
          className={ghostButtonClass}
          type="button"
          onClick={() => logout()}
        >
          {labels.signOut}
        </button>
      </div>

      <div className={cardClass} data-ui="settings-backup-card">
        <div className={cardTitleClass}>{labels.dataBackup}</div>
        <div className={cn(noteClass, 'mb-2.5')} id="backup-context">
          {values.backupContext}
        </div>
        <div className={buttonRowClass}>
          <button
            className={cn(secondaryButtonClass, 'flex-1')}
            type="button"
            onClick={() => exportData()}
          >
            {labels.export}
          </button>
          <label className={cn(secondaryButtonClass, 'm-0 flex-1 cursor-pointer text-center')}>
            {labels.import}
            <input
              ref={importRef}
              type="file"
              accept=".json"
              className="hidden"
              data-ui="settings-backup-import"
              onChange={(event) => importData(event.nativeEvent)}
            />
          </label>
        </div>
        <div className={noteClass}>
          {labels.backupHelp}
        </div>
      </div>

      <div className={cardClass} data-ui="settings-nutrition-card">
        <div className={cardTitleClass}>{labels.nutritionTitle}</div>
        <div className={noteClass}>
          {labels.nutritionHelp}
        </div>
      </div>

      <div
        className={cn(
          cardClass,
          'mt-6 border-[rgba(239,68,68,0.2)] bg-[linear-gradient(180deg,rgba(239,68,68,0.06),rgba(239,68,68,0.02))]'
        )}
        data-ui="danger-zone-card"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-base text-red/80">&#9888;</span>
          <div className="mb-0 text-[11px] font-bold uppercase tracking-[1.2px] text-red/90">
            {labels.danger}
          </div>
        </div>
        <div className="mb-3 text-xs leading-[1.5] text-muted">{labels.dangerDesc}</div>
        {values.dangerOpen ? (
          <div className="mt-3" id="danger-zone-confirm">
            <label
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-red"
              htmlFor="danger-zone-input"
            >
              {labels.dangerTypeConfirm}
            </label>
            <input
              type="text"
              id="danger-zone-input"
              className="mb-2.5 border-red/30 font-condensed tracking-[0.06em]"
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
              className={cn(dangerButtonClass, 'mt-1 w-full')}
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
            className={dangerButtonClass}
            id="danger-zone-trigger"
            type="button"
            onClick={() => showDangerConfirm()}
          >
            {labels.clearAll}
          </button>
        ) : null}
      </div>

      <div
        className="px-0 py-5 text-center text-[11px] tracking-[0.04em] text-muted opacity-50"
        id="app-version"
      >
        {values.appVersion}
      </div>
    </>
  );
}

export { SettingsAccountIsland };
