import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { dataStore } from '../stores/data-store';
import { profileStore } from '../stores/profile-store';
import { programStore } from '../stores/program-store';
import { i18nStore } from '../stores/i18n-store';
import {
  normalizeBodyMetrics,
  normalizeProfileState,
  normalizeScheduleState,
  normalizeTrainingPreferences,
} from '../domain/normalizers';
import { t } from './services/i18n';
import { showConfirm } from './services/confirm-actions';
import { useRuntimeStore } from './store/runtime-store';

const TABS = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'program', label: 'Program' },
  { id: 'body', label: 'Body' },
  { id: 'account', label: 'Account' },
];

const BACKUP_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_BACKUP_SECTIONS = new Set([
  'version',
  'exported',
  'workouts',
  'profile',
  'schedule',
]);

function cloneJson(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function showSettingsToast(message, variant = 'info') {
  useRuntimeStore.getState().showToast({ message, variant });
}

function countWorkoutsSince(workouts) {
  if (!Array.isArray(workouts) || workouts.length === 0) return '';
  const timestamps = workouts
    .map((workout) => new Date(String(workout?.date || '')).getTime())
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) return '';
  const oldest = new Date(Math.min(...timestamps));
  return oldest.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function validateWorkoutBackupEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return { ok: false };
  }
  const workoutId = String(entry.id || '').trim();
  const workoutDate = String(entry.date || '').trim();
  if (!workoutId || !workoutDate) {
    return { ok: false };
  }
  if (!Number.isFinite(new Date(workoutDate).getTime())) {
    return { ok: false };
  }
  if (!Array.isArray(entry.exercises)) {
    return { ok: false };
  }
  return { ok: true };
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, message: 'Backup file is not a valid object.' };
  }

  if (Object.keys(payload).some((key) => !ALLOWED_BACKUP_SECTIONS.has(key))) {
    return { ok: false, message: 'Backup file contains unsupported sections.' };
  }

  if ('workouts' in payload && !Array.isArray(payload.workouts)) {
    return { ok: false, message: 'Backup workouts must be an array.' };
  }

  if (
    'profile' in payload &&
    (typeof payload.profile !== 'object' || Array.isArray(payload.profile))
  ) {
    return { ok: false, message: 'Backup profile must be an object.' };
  }

  if (
    'schedule' in payload &&
    (typeof payload.schedule !== 'object' || Array.isArray(payload.schedule))
  ) {
    return { ok: false, message: 'Backup schedule must be an object.' };
  }

  const workoutIds = new Set();
  for (const workout of Array.isArray(payload.workouts) ? payload.workouts : []) {
    if (!validateWorkoutBackupEntry(workout).ok) {
      return { ok: false, message: 'Backup contains an invalid workout entry.' };
    }
    const workoutId = String(workout.id || '');
    if (workoutIds.has(workoutId)) {
      return { ok: false, message: 'Backup contains duplicate workout ids.' };
    }
    workoutIds.add(workoutId);
  }

  return { ok: true };
}

function buildNormalizedBackup(payload, language) {
  return {
    workouts: Array.isArray(payload?.workouts) ? cloneJson(payload.workouts) : null,
    profile:
      payload?.profile && typeof payload.profile === 'object'
        ? normalizeProfileState(cloneJson(payload.profile))
        : null,
    schedule:
      payload?.schedule && typeof payload.schedule === 'object'
        ? normalizeScheduleState(cloneJson(payload.schedule), {
            locale: language,
          })
        : null,
  };
}

async function clearAllData() {
  const language = i18nStore.getState().language;
  const currentProfile = cloneJson(dataStore.getState().profile || {});
  await dataStore.getState().replaceWorkouts([]);
  await dataStore.getState().setProfileState({
    ...currentProfile,
    language,
    activeProgram: currentProfile.activeProgram || 'forge',
    programs: {},
    bodyMetrics: normalizeBodyMetrics({ bodyMetrics: {} }),
    preferences: normalizeTrainingPreferences({ preferences: {} }),
  });
  await dataStore.getState().setScheduleState({
    sportName: '',
    sportDays: [],
    sportIntensity: 'hard',
    sportLegsHeavy: true,
  });
  dataStore.getState().setActiveWorkoutState(null, {
    restEndsAt: 0,
    restSecondsLeft: 0,
    restTotal: 0,
  });
  showSettingsToast(t('settings.cleared', 'Local training data cleared.'));
}

function SectionCard({ title, children, ...props }) {
  return (
    <section
      className="rounded-card border border-border bg-surface p-4 shadow-card"
      {...props}
    >
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
        {title}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children }) {
  return <label className="grid gap-1 text-sm font-semibold text-text">{children}</label>;
}

function ScheduleSettings() {
  const schedule = useStore(profileStore, (state) => state.schedule);
  const [draft, setDraft] = useState(schedule || {});

  useEffect(() => {
    setDraft(schedule || {});
  }, [schedule]);

  const sportDays = Array.isArray(draft.sportDays) ? draft.sportDays : [];
  const summaryText = String(draft.sportName || '').trim() || 'Sport / cardio';

  return (
    <div className="grid gap-4" id="settings-schedule-react-root">
      <SectionCard title={t('settings.schedule', 'Training Context')}>
        <div
          className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm text-text"
          id="sport-status-bar"
        >
          {summaryText}
        </div>

        <FieldLabel>
          <span>{t('settings.sport_name', 'Sport or cardio')}</span>
          <input
            className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
            id="sport-name"
            type="text"
            value={String(draft.sportName || '')}
            onChange={(event) =>
              setDraft((current) => ({ ...current, sportName: event.target.value }))
            }
          />
        </FieldLabel>

        <div className="grid gap-2">
          <div className="text-sm font-semibold text-text">
            {t('settings.sport_days', 'Regular sport days')}
          </div>
          <div className="flex flex-wrap gap-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => {
              const active = sportDays.includes(index);
              return (
                <button
                  key={`${label}-${index}`}
                  type="button"
                  className={`rounded-full border px-3 py-2 text-sm font-bold ${
                    active
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-white/[0.03] text-text'
                  }`}
                  onClick={() =>
                    setDraft((current) => {
                      const nextDays = new Set(
                        Array.isArray(current.sportDays) ? current.sportDays : []
                      );
                      if (nextDays.has(index)) nextDays.delete(index);
                      else nextDays.add(index);
                      return {
                        ...current,
                        sportDays: [...nextDays].sort((left, right) => left - right),
                      };
                    })
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel>
            <span>{t('settings.sport_intensity', 'Sport intensity')}</span>
            <select
              className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              id="sport-intensity"
              value={String(draft.sportIntensity || 'hard')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sportIntensity: event.target.value,
                }))
              }
            >
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="hard">Hard</option>
            </select>
          </FieldLabel>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-semibold text-text">
            <span>{t('settings.legs_heavy', 'Leg-heavy sport')}</span>
            <input
              id="sport-legs-heavy"
              type="checkbox"
              checked={draft.sportLegsHeavy !== false}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sportLegsHeavy: event.target.checked,
                }))
              }
            />
          </label>
        </div>

        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff983d,#f5821f)] px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-white"
          onClick={() => void profileStore.getState().setSchedule(draft)}
        >
          {t('common.save', 'Save')}
        </button>
      </SectionCard>
    </div>
  );
}

function PreferenceSettings() {
  const profile = useStore(profileStore, (state) => state.profile);
  const [draft, setDraft] = useState(profile || {});

  useEffect(() => {
    setDraft(profile || {});
  }, [profile]);

  const preferences = {
    ...(draft.preferences || {}),
  };
  const sessionsPerWeekLabel = t(
    'training.days_per_week',
    { count: preferences.trainingDaysPerWeek || 3 },
    '{count} sessions / week'
  );

  return (
    <div className="grid gap-4" id="settings-preferences-react-root">
      <SectionCard title={t('settings.preferences', 'Training Preferences')}>
        <div
          className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm text-text"
          id="training-status-bar"
        >
          {`${preferences.goal || 'strength'} · ${sessionsPerWeekLabel}`}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel>
            <span>{t('settings.goal', 'Goal')}</span>
            <select
              className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              id="training-goal"
              value={String(preferences.goal || 'strength')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  preferences: {
                    ...(current.preferences || {}),
                    goal: event.target.value,
                  },
                }))
              }
            >
              <option value="strength">Strength</option>
              <option value="hypertrophy">Hypertrophy</option>
              <option value="general_fitness">General Fitness</option>
              <option value="sport_support">Sport Support</option>
            </select>
          </FieldLabel>

          <FieldLabel>
            <span>{t('settings.frequency', 'Sessions per week')}</span>
            <select
              className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              id="training-days-per-week"
              value={String(preferences.trainingDaysPerWeek || 3)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  preferences: {
                    ...(current.preferences || {}),
                    trainingDaysPerWeek: Number(event.target.value),
                  },
                }))
              }
            >
              {[2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </FieldLabel>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel>
            <span>{t('settings.session_minutes', 'Session length')}</span>
            <select
              className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              id="training-session-minutes"
              value={String(preferences.sessionMinutes || 60)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  preferences: {
                    ...(current.preferences || {}),
                    sessionMinutes: Number(event.target.value),
                  },
                }))
              }
            >
              {[30, 45, 60, 75, 90].map((value) => (
                <option key={value} value={value}>
                  {value} min
                </option>
              ))}
            </select>
          </FieldLabel>

          <FieldLabel>
            <span>{t('settings.equipment', 'Equipment')}</span>
            <select
              className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              id="training-equipment"
              value={String(preferences.equipmentAccess || 'full_gym')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  preferences: {
                    ...(current.preferences || {}),
                    equipmentAccess: event.target.value,
                  },
                }))
              }
            >
              <option value="full_gym">Full Gym</option>
              <option value="basic_gym">Basic Gym</option>
              <option value="home_gym">Home Gym</option>
              <option value="minimal">Minimal</option>
            </select>
          </FieldLabel>
        </div>

        <FieldLabel>
          <span>{t('settings.default_rest', 'Default rest timer')}</span>
          <input
            className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
            id="default-rest"
            type="number"
            min="0"
            value={String(draft.defaultRest || 120)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                defaultRest: Number(event.target.value),
              }))
            }
          />
        </FieldLabel>

        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff983d,#f5821f)] px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-white"
          onClick={() => void profileStore.getState().setProfile(draft)}
        >
          {t('common.save', 'Save')}
        </button>
      </SectionCard>
    </div>
  );
}

function ProgramSettings() {
  const profile = useStore(profileStore, (state) => state.profile);
  const programState = useStore(programStore, (state) => state);
  const [selectedProgram, setSelectedProgram] = useState(
    profile?.activeProgram || programState.activeProgramId || 'forge'
  );

  useEffect(() => {
    setSelectedProgram(profile?.activeProgram || programState.activeProgramId || 'forge');
  }, [profile?.activeProgram, programState.activeProgramId]);

  const selectedProgramMeta =
    programState.programs.find((program) => program.id === selectedProgram) ||
    programState.activeProgram;

  return (
    <div className="grid gap-4" id="settings-program-react-root">
      <SectionCard title={t('settings.program', 'Program')}>
        <div
          className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm text-text"
          id="training-program-summary"
        >
          {selectedProgramMeta?.name || 'Forge'}
        </div>

        <div className="grid gap-3">
          {programState.programs.map((program) => {
            const active = selectedProgram === program.id;
            return (
              <button
                key={program.id}
                type="button"
                data-ui="program-card"
                data-state={active ? 'active' : 'inactive'}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-white/[0.03]'
                }`}
                onClick={() => setSelectedProgram(program.id)}
              >
                <div className="text-base font-bold text-text">{program.name}</div>
                <div className="mt-2 text-sm leading-6 text-muted">
                  {program.description}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff983d,#f5821f)] px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-white"
          onClick={async () => {
            const initialState =
              programState.getProgramInitialState(selectedProgram) || {};
            const currentPrograms =
              profile?.programs && typeof profile.programs === 'object'
                ? profile.programs
                : {};
            await profileStore.getState().updateProfile({
              activeProgram: selectedProgram,
              programs: {
                ...currentPrograms,
                [selectedProgram]:
                  currentPrograms?.[selectedProgram] || initialState,
              },
            });
          }}
        >
          {t('settings.use_program', 'Use Program')}
        </button>
      </SectionCard>
    </div>
  );
}

function BodySettings() {
  const profile = useStore(profileStore, (state) => state.profile);
  const [draft, setDraft] = useState(profile || {});

  useEffect(() => {
    setDraft(profile || {});
  }, [profile]);

  const bodyMetrics = {
    ...(draft.bodyMetrics || {}),
  };

  return (
    <div className="grid gap-4" id="settings-body-react-root">
      <SectionCard
        title={t('settings.body', 'Body Metrics')}
        data-ui="settings-body-metrics-card"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel>
            <span>{t('settings.weight', 'Weight')}</span>
            <input
              className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              id="body-weight"
              type="number"
              value={String(bodyMetrics.weight || '')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  bodyMetrics: {
                    ...(current.bodyMetrics || {}),
                    weight: event.target.value,
                  },
                }))
              }
            />
          </FieldLabel>
          <FieldLabel>
            <span>{t('settings.height', 'Height')}</span>
            <input
              className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              id="body-height"
              type="number"
              value={String(bodyMetrics.height || '')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  bodyMetrics: {
                    ...(current.bodyMetrics || {}),
                    height: event.target.value,
                  },
                }))
              }
            />
          </FieldLabel>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel>
            <span>{t('settings.age', 'Age')}</span>
            <input
              className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              id="body-age"
              type="number"
              value={String(bodyMetrics.age || '')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  bodyMetrics: {
                    ...(current.bodyMetrics || {}),
                    age: event.target.value,
                  },
                }))
              }
            />
          </FieldLabel>
          <FieldLabel>
            <span>{t('settings.target_weight', 'Target weight')}</span>
            <input
              className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              id="body-target-weight"
              type="number"
              value={String(bodyMetrics.targetWeight || '')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  bodyMetrics: {
                    ...(current.bodyMetrics || {}),
                    targetWeight: event.target.value,
                  },
                }))
              }
            />
          </FieldLabel>
        </div>
      </SectionCard>

      <SectionCard
        title={t('settings.body_goal', 'Body Goal')}
        data-ui="settings-body-goal-card"
      >
        <FieldLabel>
          <span>{t('settings.body_goal', 'Body Goal')}</span>
          <select
            className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
            id="body-goal"
            value={String(bodyMetrics.bodyGoal || '')}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                bodyMetrics: {
                  ...(current.bodyMetrics || {}),
                  bodyGoal: event.target.value || null,
                },
              }))
            }
          >
            <option value="">Select</option>
            <option value="lose_fat">Lose Fat</option>
            <option value="gain_muscle">Gain Muscle</option>
            <option value="recomp">Recomp</option>
            <option value="maintain">Maintain</option>
          </select>
        </FieldLabel>

        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff983d,#f5821f)] px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-white"
          onClick={() => void profileStore.getState().setProfile(draft)}
        >
          {t('common.save', 'Save')}
        </button>
      </SectionCard>
    </div>
  );
}

function AccountSettings() {
  const currentUser = useStore(dataStore, (state) => state.currentUser);
  const syncStatus = useStore(dataStore, (state) => state.syncStatus);
  const language = useStore(i18nStore, (state) => state.language);
  const workouts = useStore(dataStore, (state) => state.workouts);
  const fileInputRef = useRef(null);
  const [pendingBackup, setPendingBackup] = useState(null);
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  const [dangerText, setDangerText] = useState('');

  const backupContext = useMemo(() => {
    const count = Array.isArray(workouts) ? workouts.length : 0;
    const since = countWorkoutsSince(workouts);
    if (!count) return t('settings.backup_empty', 'No workouts saved yet.');
    return `${count} workouts since ${since}`;
  }, [workouts]);

  async function applyBackupImport(backup) {
    if (!backup) return;
    if (backup.workouts) {
      await dataStore.getState().replaceWorkouts(backup.workouts);
    }
    if (backup.profile) {
      await dataStore.getState().setProfileState(backup.profile);
    }
    if (backup.schedule) {
      await dataStore.getState().setScheduleState(backup.schedule);
    }
    showSettingsToast(t('settings.import_done', 'Backup imported.'));
    setPendingBackup(null);
  }

  async function handleBackupFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > BACKUP_MAX_BYTES) {
      showSettingsToast(t('settings.import_too_large', 'Backup file is too large.'), 'error');
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const validation = validateBackupPayload(parsed);
      if (!validation.ok) {
        showSettingsToast(validation.message, 'error');
        return;
      }

      const normalized = buildNormalizedBackup(parsed, language);
      setPendingBackup(normalized);
      showConfirm(
        t('settings.import_confirm_title', 'Import backup?'),
        t(
          'settings.import_confirm_body',
          'This replaces the imported sections with the backup contents.'
        ),
        () => {
          void applyBackupImport(normalized);
        }
      );
    } catch (_error) {
      showSettingsToast(t('settings.import_invalid', 'Backup file could not be read.'), 'error');
    }
  }

  return (
    <div className="grid gap-4" id="settings-account-react-root">
      <SectionCard title={t('settings.account', 'Account')} data-ui="settings-account-card">
        <div className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm text-text">
          {String(currentUser?.email || '')}
        </div>
        <div className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm text-text">
          {t('settings.sync_status', 'Sync')}: {syncStatus.state}
        </div>
        <FieldLabel>
          <span>{t('settings.language', 'Language')}</span>
          <select
            className="h-12 rounded-xl border border-border bg-white/[0.03] px-3 text-text"
            id="settings-language"
            value={language}
            onChange={(event) =>
              i18nStore.getState().setLanguage(event.target.value)
            }
          >
            <option value="en">English</option>
            <option value="fi">Finnish</option>
          </select>
        </FieldLabel>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border bg-white/[0.03] px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-text"
          onClick={() => void dataStore.getState().logout()}
        >
          {t('settings.sign_out', 'Sign Out')}
        </button>
      </SectionCard>

      <SectionCard title={t('settings.backup', 'Backup')} data-ui="settings-backup-card">
        <div
          className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm text-text"
          id="backup-context"
        >
          {backupContext}
        </div>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept="application/json"
          data-ui="settings-backup-import"
          onChange={(event) => {
            void handleBackupFile(event);
          }}
        />
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border bg-white/[0.03] px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-text"
          onClick={() => fileInputRef.current?.click()}
        >
          {t('settings.import_backup', 'Import Backup')}
        </button>
        {pendingBackup ? (
          <div className="text-xs text-muted">
            {t('settings.import_pending', 'Backup ready to import.')}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title={t('settings.reset', 'Reset')} data-ui="settings-reset-card">
        <button
          id="danger-zone-trigger"
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-red/40 bg-red/10 px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-red"
          onClick={() => setDangerZoneOpen((value) => !value)}
        >
          {t('settings.open_danger_zone', 'Open Reset Controls')}
        </button>

        {dangerZoneOpen ? (
          <div
            className="rounded-2xl border border-red/30 bg-red/8 p-4"
            id="danger-zone-confirm"
          >
            <div className="text-sm font-semibold text-text">
              {t('settings.reset_label', 'Type DELETE to clear local training data.')}
            </div>
            <input
              id="danger-zone-input"
              className="mt-3 h-12 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-text"
              type="text"
              value={dangerText}
              onChange={(event) => setDangerText(event.target.value)}
            />
            <button
              id="danger-zone-delete-btn"
              type="button"
              disabled={dangerText.trim() !== 'DELETE'}
              className="mt-3 inline-flex min-h-12 items-center justify-center rounded-2xl bg-red px-4 py-3 font-condensed text-base font-bold uppercase tracking-[0.05em] text-white disabled:opacity-50"
              onClick={() => {
                showConfirm(
                  t('settings.clear_confirm_title', 'Clear training data?'),
                  t(
                    'settings.clear_confirm_body',
                    'This clears local workouts, profile settings, and schedule data.'
                  ),
                  () => {
                    void clearAllData();
                    setDangerText('');
                    setDangerZoneOpen(false);
                  }
                );
              }}
            >
              {t('settings.clear_data', 'Clear Data')}
            </button>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

export default function SettingsPage() {
  const activeTab = useRuntimeStore((state) => state.navigation.activeSettingsTab);
  const setActiveTab = useRuntimeStore((state) => state.setActiveSettingsTab);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              className={`rounded-full border px-4 py-2 text-sm font-bold ${
                active
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-white/[0.03] text-text'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'schedule' ? <ScheduleSettings /> : null}
      {activeTab === 'preferences' ? <PreferenceSettings /> : null}
      {activeTab === 'program' ? <ProgramSettings /> : null}
      {activeTab === 'body' ? <BodySettings /> : null}
      {activeTab === 'account' ? <AccountSettings /> : null}
    </div>
  );
}
