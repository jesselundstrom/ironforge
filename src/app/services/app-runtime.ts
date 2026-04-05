import { dataStore } from '../../stores/data-store';
import { profileStore } from '../../stores/profile-store';
import { programStore } from '../../stores/program-store';
import { workoutStore } from '../../stores/workout-store';
import {
  getDefaultCoachingProfile,
  getDefaultTrainingPreferences,
  normalizeCoachingProfile,
  normalizeTrainingPreferences,
} from '../../domain/normalizers';
import { bootstrapProfileRuntime as normalizeBootstrapProfileRuntime } from '../../domain/profile-bootstrap';
import { getInitialPlanRecommendation } from '../../domain/planning';
import { isSimpleMode } from '../../domain/dashboard-view';
import type { Profile } from '../../domain/types';
import { useRuntimeStore } from '../store/runtime-store';
import { isSettingsTab, type SettingsTab } from '../constants';
import { t } from './i18n';
import { callLegacyWindowFunction, readLegacyWindowValue } from './legacy-call';

type MutableRecord = Record<string, unknown>;

type RuntimeApi = {
  buildSettingsAccountView: () => Record<string, unknown>;
  buildSettingsScheduleView: () => Record<string, unknown>;
  buildSettingsProgramView: () => Record<string, unknown>;
  buildSettingsPreferencesView: () => Record<string, unknown>;
  buildSettingsBodyView: () => Record<string, unknown>;
  getLegacyRuntimeState: () => Record<string, unknown>;
  setLegacyRuntimeState: (partial: Record<string, unknown>) => void;
  bootstrapProfileRuntime: (input?: {
    profile?: Record<string, unknown> | null;
    schedule?: Record<string, unknown> | null;
    workouts?: Array<Record<string, unknown>> | null;
    applyToStore?: boolean;
    normalizeWorkouts?: boolean;
    applyProgramCatchUp?: boolean;
  }) => {
    profile: Record<string, unknown>;
    schedule: Record<string, unknown>;
    workouts: Array<Record<string, unknown>>;
    changed: {
      profile: boolean;
      schedule: boolean;
      workouts: boolean;
    };
  };
  saveSchedule: (nextValues?: Record<string, unknown>) => void;
  syncSettingsBridge: () => void;
  syncSettingsAccountView: () => void;
  syncSettingsScheduleView: () => void;
  syncSettingsProgramView: () => void;
  syncSettingsPreferencesView: () => void;
  syncSettingsBodyView: () => void;
  getOnboardingDefaultDraft: () => Record<string, unknown>;
  buildOnboardingRecommendation: (
    draft?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  updateLanguageDependentUI: () => void;
};

type RuntimeWindow = Window & {
  __IRONFORGE_APP_RUNTIME__?: RuntimeApi;
  __IRONFORGE_ACTIVE_SETTINGS_TAB__?: string;
  __IRONFORGE_APP_VERSION__?: string;
  __IRONFORGE_LEGACY_RUNTIME_ACCESS__?: {
    read?: (name: string) => unknown;
    write?: (name: string, value: unknown) => void;
  };
  __IRONFORGE_PROFILE_STORE__?: {
    hydrateProfileRuntime?: (input: {
      profile: Record<string, unknown> | null;
      schedule: Record<string, unknown> | null;
    }) => unknown;
    setProfile?: (profile: Record<string, unknown> | null) => unknown;
    setSchedule?: (schedule: Record<string, unknown> | null) => unknown;
  };
  currentUser?: Record<string, unknown> | null;
  workouts?: Array<Record<string, unknown>>;
  schedule?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  activeWorkout?: Record<string, unknown> | null;
  syncWorkoutSessionBridge?: () => void;
  renderHistory?: () => void;
  resetNotStartedView?: () => void;
  getSettingsAccountUiStateSnapshot?: () => {
    dangerOpen?: boolean;
    dangerInput?: string;
  };
  getOnboardingDefaultDraft?: () => Record<string, unknown> | null;
  buildOnboardingRecommendation?: (
    draft?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  __IRONFORGE_GET_LEGACY_RUNTIME_STATE__?: () => Record<string, unknown>;
  __IRONFORGE_SET_LEGACY_RUNTIME_STATE__?: (
    partial: Record<string, unknown>
  ) => void;
  syncSettingsBridge?: () => void;
  updateLanguageDependentUI?: () => void;
};

function getRuntimeWindow(): RuntimeWindow | null {
  if (typeof window === 'undefined') return null;
  return window as RuntimeWindow;
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function readLegacyRuntimeValue<T>(name: string): T | undefined {
  return getRuntimeWindow()?.__IRONFORGE_LEGACY_RUNTIME_ACCESS__?.read?.(
    name
  ) as T | undefined;
}

function writeLegacyRuntimeValue(name: string, value: unknown) {
  getRuntimeWindow()?.__IRONFORGE_LEGACY_RUNTIME_ACCESS__?.write?.(
    name,
    cloneJson(value)
  );
}

function hasOwnRuntimeField(partial: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(partial, key);
}

function getProfileRecord() {
  const runtimeState = getLegacyRuntimeState();
  return cloneJson(
    ((runtimeState.profile as MutableRecord | null) ||
      (profileStore.getState().profile as MutableRecord | null) ||
      (dataStore.getState().profile as MutableRecord | null) ||
      {}) as MutableRecord
  );
}

function getScheduleRecord() {
  const runtimeState = getLegacyRuntimeState();
  return cloneJson(
    ((runtimeState.schedule as MutableRecord | null) ||
      (profileStore.getState().schedule as MutableRecord | null) ||
      (dataStore.getState().schedule as MutableRecord | null) ||
      {}) as MutableRecord
  );
}

function getCurrentUserRecord() {
  const runtimeState = getLegacyRuntimeState();
  const dataUser = dataStore.getState().currentUser as MutableRecord | null;
  return cloneJson(
    (runtimeState.currentUser as MutableRecord | null) || dataUser || null
  );
}

function getDefaultSettingsTab(): SettingsTab {
  const runtimeWindow = getRuntimeWindow();
  const raw =
    String(runtimeWindow?.__IRONFORGE_ACTIVE_SETTINGS_TAB__ || '').trim() ||
    String(useRuntimeStore.getState().navigation.activeSettingsTab || '').trim() ||
    'schedule';
  return isSettingsTab(raw) ? raw : 'schedule';
}

function getShortDayNames() {
  return [
    t('day.mon.short', 'Mon'),
    t('day.tue.short', 'Tue'),
    t('day.wed.short', 'Wed'),
    t('day.thu.short', 'Thu'),
    t('day.fri.short', 'Fri'),
    t('day.sat.short', 'Sat'),
    t('day.sun.short', 'Sun'),
  ];
}

function getTrainingGoalLabel(goal: string): string {
  const map: Record<string, [string, string]> = {
    strength: ['settings.preferences.goal.strength', 'Strength'],
    hypertrophy: ['settings.preferences.goal.hypertrophy', 'Hypertrophy'],
    general_fitness: ['settings.preferences.goal.general_fitness', 'General Fitness'],
    sport_support: ['settings.preferences.goal.sport_support', 'Sport Support'],
  };
  const [key, fallback] = map[goal] || map.strength;
  return t(key, fallback);
}

function getEquipmentAccessLabel(value: string): string {
  const map: Record<string, [string, string]> = {
    full_gym: ['settings.preferences.equipment.full_gym', 'Full Gym'],
    basic_gym: ['settings.preferences.equipment.basic_gym', 'Basic Gym'],
    home_gym: ['settings.preferences.equipment.home_gym', 'Home Gym'],
    minimal: ['settings.preferences.equipment.minimal', 'Minimal Equipment'],
  };
  const [key, fallback] = map[value] || map.full_gym;
  return t(key, fallback);
}

function getTrainingSummary(profileLike: MutableRecord) {
  const prefs = normalizeTrainingPreferences(profileLike);
  const goal = getTrainingGoalLabel(String(prefs.goal || ''));
  const days = t(
    'settings.preferences.training_days_value',
    '{count} sessions / week',
    { count: prefs.trainingDaysPerWeek }
  );
  const minutes = t(
    'settings.preferences.duration_value',
    '{minutes} min',
    { minutes: prefs.sessionMinutes }
  );
  const equipment = getEquipmentAccessLabel(String(prefs.equipmentAccess || ''));
  return t(
    'dashboard.preferences_context',
    'Goal: {goal} · {days} · {minutes} · {equipment}',
    { goal, days, minutes, equipment }
  );
}

function isSimpleModeProfile(profileLike: MutableRecord) {
  return isSimpleMode(profileLike as Profile | null);
}

type ProgramSwitcherCard = {
  id: string;
  icon: string;
  name: string;
  description: string;
  fitLabel: string;
  fitTone: string;
  difficultyKey: string;
  difficultyTone: string;
  difficultyLabel: string;
  active: boolean;
  activeLabel: string;
};

function buildProgramSwitcherData(): { helper: string; cards: ProgramSwitcherCard[] } {
  const profile = getProfileRecord();
  const prefs = normalizeTrainingPreferences(profile);
  const requested = Number(prefs.trainingDaysPerWeek) || 3;
  const requestedLabel = t(
    'settings.preferences.training_days_value',
    '{count} sessions / week',
    { count: requested }
  );
  const store = programStore.getState();
  const activeProgramId = store.activeProgramId || '';

  // Build list: programs that support requested days, always include active, fallback to all
  const matching = store.programs.filter((prog) => {
    const range = store.getProgramTrainingDaysRange(prog.id as string);
    return requested >= range.min && requested <= range.max;
  });
  const visible = matching.slice();
  if (
    activeProgramId &&
    !visible.some((prog) => (prog.id as string) === activeProgramId)
  ) {
    const activeProg = store.getProgramById(activeProgramId);
    if (activeProg) visible.push(activeProg);
  }
  const source = visible.length ? visible : store.programs;

  // Sort by recommendationScore desc, then name asc (mirrors legacy sort)
  const sorted = source
    .map((prog) => {
      const caps = store.getProgramCapabilities(prog.id as string);
      const score =
        typeof caps.recommendationScore === 'function'
          ? caps.recommendationScore(requested, prefs as Record<string, unknown>)
          : 0;
      return { prog, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(a.prog.name || '').localeCompare(String(b.prog.name || ''))
    )
    .map((entry) => entry.prog);

  const cards: ProgramSwitcherCard[] = sorted.map((prog) => {
    const id = String(prog.id || '');
    const range = store.getProgramTrainingDaysRange(id);
    const supportsExact = requested >= range.min && requested <= range.max;
    const effective = store.getEffectiveProgramFrequency(id, profile);
    const effectiveLabel = t(
      'settings.preferences.training_days_value',
      '{count} sessions / week',
      { count: effective }
    );
    const difficultyMeta = store.getProgramDifficultyMeta(id);
    const isActive = id === activeProgramId;

    return {
      id,
      icon: String(prog.icon || '🏋️'),
      name: t(`program.${id}.name`, String(prog.name || '')),
      description: t(`program.${id}.description`, String(prog.description || '')),
      fitLabel: supportsExact
        ? t('program.frequency_card.fit', 'Fits {value}', { value: requestedLabel })
        : t('program.frequency_card.fallback', 'Uses {value}', { value: effectiveLabel }),
      fitTone: supportsExact ? 'ok' : 'fallback',
      difficultyKey: difficultyMeta.key,
      difficultyTone: difficultyMeta.key,
      difficultyLabel: t(difficultyMeta.labelKey, difficultyMeta.fallback),
      active: isActive,
      activeLabel: t('program.active', 'Active'),
    };
  });

  return {
    helper: t(
      'program.frequency_filter.showing',
      'Showing programs that fit {value}. Your current program stays visible if it needs a fallback.',
      { value: requestedLabel }
    ),
    cards,
  };
}

function buildSyncStatusLabel(): { label: string; className: string } {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      label: t(
        'settings.sync.offline',
        'Offline. Changes will sync when you reconnect.'
      ),
      className: 'sync-status offline',
    };
  }
  const { state } = dataStore.getState().syncStatus;
  if (state === 'syncing') {
    return {
      label: t('settings.sync.syncing', 'Syncing changes...'),
      className: 'sync-status syncing',
    };
  }
  if (state === 'error') {
    return {
      label: t(
        'settings.sync.error',
        'Cloud sync issue. Local changes are kept on this device.'
      ),
      className: 'sync-status error',
    };
  }
  return {
    label: t('settings.sync.synced', 'Synced to cloud'),
    className: 'sync-status synced',
  };
}

function buildBackupContextText(): string {
  const workouts = dataStore.getState().workouts;
  const count = workouts.length;
  if (!count) return t('settings.backup_empty', 'No workouts recorded yet.');
  const dates = workouts.map((w) => String(w.date || '')).filter(Boolean).sort();
  const first = dates[0] || '';
  const firstFormatted = first
    ? new Date(first).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
  return t('settings.backup_context', '{count} workouts since {date}', {
    count,
    date: firstFormatted,
  });
}

function buildSettingsAccountView() {
  const profile = getProfileRecord();
  const currentUser = getCurrentUserRecord();
  const syncStatus = buildSyncStatusLabel();
  const nutritionReady = !!String(currentUser?.id || '').trim();
  const uiState = getRuntimeWindow()?.getSettingsAccountUiStateSnapshot?.() || {};

  return {
    labels: {
      accountSection: t('settings.account_section', 'Account'),
      languageLabel: t('settings.language.label', 'App language'),
      optionEn: t('settings.language.option.en', 'English'),
      optionFi: t('settings.language.option.fi', 'Finnish'),
      signOut: t('settings.sign_out', 'Sign Out'),
      dataBackup: t('settings.data_backup', 'Data Backup'),
      export: t('settings.export', 'Export'),
      import: t('settings.import', 'Import'),
      backupHelp: t(
        'settings.backup_help',
        'Export saves all data as a JSON file. Import replaces all current data.'
      ),
      nutritionTitle: t('settings.nutrition_coach.title', 'AI Nutrition Coach'),
      nutritionHelp: nutritionReady
        ? t(
            'settings.nutrition_coach.help_ready',
            'Nutrition Coach is ready on this account. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.'
          )
        : t(
            'settings.nutrition_coach.help_signed_out',
            'Sign in to use Nutrition Coach. Claude requests are routed through Ironforge securely, and no Claude API key is stored on this device.'
          ),
      danger: t('settings.danger', 'Danger Zone'),
      dangerDesc: t(
        'settings.danger_desc',
        'This permanently deletes all your workouts, programs, and settings. This cannot be undone.'
      ),
      dangerTypeConfirm: t(
        'settings.danger_type_confirm',
        'Type DELETE to confirm'
      ),
      clearAll: t('settings.clear_all', 'Clear All Data'),
      clearAllConfirm: t(
        'settings.clear_all_confirm',
        'Permanently Delete All Data'
      ),
    },
    values: {
      email: String(currentUser?.email || ''),
      syncLabel: syncStatus.label,
      syncClassName: syncStatus.className,
      language:
        String(profile.language || '').trim() ||
        getRuntimeWindow()?.I18N?.getLanguage?.() ||
        'en',
      backupContext: buildBackupContextText(),
      nutritionReady,
      appVersion: getAppVersionLabel(),
      dangerOpen: uiState.dangerOpen === true,
      dangerInput: String(uiState.dangerInput || ''),
      dangerDeleteDisabled:
        String(uiState.dangerInput || '').trim().toUpperCase() !== 'DELETE',
    },
  };
}

function getAppVersionLabel() {
  const version = String(getRuntimeWindow()?.__IRONFORGE_APP_VERSION__ || '').trim();
  return version ? `Ironforge v${version}` : 'Ironforge';
}

function syncLegacyActiveSessionLanguage() {
  const runtimeState = getLegacyRuntimeState();
  const activeWorkout =
    (runtimeState.activeWorkout as MutableRecord | null) || null;
  if (!activeWorkout) return;

  const activeProgram = programStore.getState().activeProgram;
  const activeProgramState =
    (programStore.getState().activeProgramState as Record<string, unknown> | null) ||
    null;
  const titleEl = document.getElementById('active-session-title');
  if (
    titleEl &&
    activeProgram &&
    typeof activeProgram.getSessionLabel === 'function'
  ) {
    const programOption = String(activeWorkout.programOption || '').trim();
    titleEl.textContent = String(
      activeProgram.getSessionLabel(programOption, activeProgramState) || ''
    );
  }

  const descEl = document.getElementById('active-session-description');
  if (!descEl) return;

  const prefix = t('session.description', 'Session focus');
  const sessionDescription = String(activeWorkout.sessionDescription || '').trim();
  descEl.textContent = sessionDescription
    ? `${prefix}: ${sessionDescription}`
    : '';
  descEl.style.display = sessionDescription ? '' : 'none';
}

function buildSettingsScheduleView() {
  const schedule = getScheduleRecord();
  const intensity = String(schedule.sportIntensity || 'hard');
  const sportDays = Array.isArray(schedule.sportDays)
    ? [...schedule.sportDays]
    : [];
  const dayNames = getShortDayNames();
  const statusName =
    String(schedule.sportName || '').trim() ||
    t('settings.status.generic_sport', 'Sport / cardio');
  const intensityLabel = t(
    `settings.intensity.${intensity}`,
    intensity.charAt(0).toUpperCase() + intensity.slice(1)
  );
  const dayText = sportDays.length
    ? sportDays
        .slice()
        .sort((left, right) => left - right)
        .map((day) => dayNames[(Number(day) + 6) % 7] || '')
        .join(', ')
    : t('settings.status.no_days', 'No days set');

  return {
    labels: {
      statusBar: [statusName, intensityLabel, dayText].filter(Boolean).join(' · '),
      title: t('settings.sport_load.title', 'My Sport'),
      subtitle: t(
        'settings.sport_load.subtitle',
        'Set the sport or cardio that most affects your training week.'
      ),
      activitySection: t('settings.sport_load.section.activity', 'Sport'),
      activitySectionSub: t(
        'settings.sport_load.section.activity_sub',
        'Name the recurring sport or cardio that affects your training week.'
      ),
      activityName: t('settings.activity_name', 'Activity name'),
      activityPlaceholder: t(
        'settings.activity_placeholder',
        'e.g. Hockey, Soccer, Running'
      ),
      profileSection: t('settings.sport_load.section.profile', 'Load profile'),
      profileSectionSub: t(
        'settings.sport_load.section.profile_sub',
        'Shape how strongly sport load should push training away from hard lower-body work.'
      ),
      intensityLabel: t('settings.intensity', 'Intensity'),
      intensityEasy: t('settings.intensity.easy', 'Easy'),
      intensityModerate: t('settings.intensity.moderate', 'Moderate'),
      intensityHard: t('settings.intensity.hard', 'Hard'),
      legHeavy: t('settings.leg_heavy', 'Leg-heavy'),
      legHeavySub: t(
        'settings.leg_heavy_sub',
        'Warns when scheduling legs after sport'
      ),
      regularSportDays: t('settings.regular_sport_days', 'Regular Sport Days'),
    },
    values: {
      sportName: String(schedule.sportName || '').trim(),
      sportIntensity: intensity,
      sportLegsHeavy: schedule.sportLegsHeavy !== false,
      sportDays,
      dayNames,
    },
  };
}

type SettingsTreeNode =
  | { type: 'text'; text: string }
  | { type: 'element'; tag: string; attrs: Record<string, unknown>; children: SettingsTreeNode[] };

function parseInlineStyle(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  style.split(';').forEach((decl) => {
    const idx = decl.indexOf(':');
    if (idx < 0) return;
    const prop = decl.slice(0, idx).trim();
    const val = decl.slice(idx + 1).trim();
    if (prop && val) result[prop] = val;
  });
  return result;
}

function serializeSettingsNode(node: Node): SettingsTreeNode | null {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? { type: 'text', text: node.textContent } : null;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const attrs: Record<string, unknown> = {};
  Array.from(el.attributes || []).forEach((attr) => {
    if (attr.name === 'class') attrs.className = attr.value;
    else if (attr.name === 'for') attrs.htmlFor = attr.value;
    else if (attr.name === 'style') attrs.style = parseInlineStyle(attr.value);
    else if (attr.name === 'onclick') attrs.onClickCode = attr.value;
    else if (attr.name === 'onchange') attrs.onChangeCode = attr.value;
    else if (attr.name === 'checked') attrs.defaultChecked = true;
    else attrs[attr.name] = attr.value === '' ? true : attr.value;
  });
  if (el.tagName === 'INPUT') {
    const inputEl = el as HTMLInputElement;
    if (inputEl.type === 'checkbox') {
      attrs.defaultChecked = inputEl.checked === true;
    } else if (attrs.value !== undefined) {
      attrs.defaultValue = attrs.value;
      delete attrs.value;
    } else if (inputEl.value !== '') {
      attrs.defaultValue = inputEl.value;
    }
  } else if (el.tagName === 'TEXTAREA') {
    attrs.defaultValue = (el as HTMLTextAreaElement).value || '';
  } else if (el.tagName === 'SELECT') {
    attrs.defaultValue = (el as HTMLSelectElement).value || '';
  }
  return {
    type: 'element',
    tag: el.tagName.toLowerCase(),
    attrs,
    children: Array.from(el.childNodes || [])
      .map(serializeSettingsNode)
      .filter((n): n is SettingsTreeNode => n !== null),
  };
}

function buildProgramBasicsSnapshot(): {
  visible: boolean;
  summary: string;
  tree: SettingsTreeNode[];
} {
  const store = programStore.getState();
  const program = store.activeProgram as
    | (Record<string, unknown> & {
        renderSimpleSettings?: (state: Record<string, unknown> | null, container: HTMLElement) => void;
        getSimpleSettingsSummary?: (state: Record<string, unknown> | null) => string;
      })
    | null;
  const state = (store.activeProgramState as Record<string, unknown> | null) || null;

  if (!program || typeof program.renderSimpleSettings !== 'function') {
    return { visible: false, summary: '', tree: [] };
  }

  const card = document.createElement('details');
  const container = document.createElement('div');
  const summaryEl = document.createElement('div');

  card.style.display = '';
  program.renderSimpleSettings(state, container);

  // Inject frequency notice if active program doesn't match user's requested days
  const noticeHtml = callLegacyWindowFunction<string>(
    'getProgramFrequencyNoticeHTML',
    String(program.id || ''),
    cloneJson(getProfileRecord())
  );
  if (noticeHtml) container.insertAdjacentHTML('afterbegin', noticeHtml);

  // Apply i18n translations to the detached tree
  const runtimeWindow = getRuntimeWindow();
  if (runtimeWindow?.I18N && typeof runtimeWindow.I18N.applyTranslations === 'function') {
    runtimeWindow.I18N.applyTranslations(card);
  }

  summaryEl.textContent =
    typeof program.getSimpleSettingsSummary === 'function'
      ? program.getSimpleSettingsSummary(state) || ''
      : '';

  return {
    visible: card.style.display !== 'none',
    summary: summaryEl.textContent || '',
    tree: Array.from(container.childNodes)
      .map(serializeSettingsNode)
      .filter((n): n is SettingsTreeNode => n !== null),
  };
}

function buildSettingsProgramView() {
  const profile = getProfileRecord();
  const program = programStore.getState().activeProgram as
    | (MutableRecord & {
        id?: string;
        name?: string;
        description?: string;
        getSimpleSettingsSummary?: (state?: Record<string, unknown> | null) => string;
      })
    | null;
  const state =
    (programStore.getState().activeProgramState as Record<string, unknown> | null) ||
    null;
  const basics = buildProgramBasicsSnapshot();
  const switcher = buildProgramSwitcherData();
  const programId = String(program?.id || programStore.getState().activeProgramId || '');
  const programName = t(`program.${programId}.name`, String(program?.name || ''));
  const programDescription = t(
    `program.${programId}.description`,
    String(program?.description || '')
  );
  const summary =
    typeof program?.getSimpleSettingsSummary === 'function'
      ? String(program.getSimpleSettingsSummary(state) || '')
      : '';

  return {
    labels: {
      statusBar: summary ? `${programName} · ${summary}` : programName,
      basicsTitle: t('settings.program_basics', 'Program Basics'),
      trainingProgram: t('settings.training_program', 'Training Program'),
      advancedTitle: t('settings.program_advanced_title', 'Advanced Setup'),
      advancedHelp: t(
        'settings.program_advanced_help',
        'Exercise swaps, cycle controls, peak block, and program-specific options.'
      ),
    },
    values: {
      programId,
      simpleMode: isSimpleModeProfile(profile),
      basicsVisible: basics.visible === true,
      basicsSummary: String(basics.summary || ''),
      basicsTree: Array.isArray(basics.tree) ? basics.tree : [],
      basicsRenderKey: JSON.stringify(basics.tree || []),
      trainingProgramSummary: programDescription
        ? `${programName} · ${programDescription}`
        : programName,
      switcher,
    },
  };
}

function buildSettingsPreferencesView() {
  const profile = getProfileRecord();
  const prefs = normalizeTrainingPreferences(profile);

  return {
    labels: {
      statusBar: getTrainingSummary(profile),
      title: t('settings.preferences.title', 'Training Preferences'),
      help: t(
        'settings.preferences.help',
        'These preferences shape future smart recommendations and AI-generated training.'
      ),
      goalsSection: t('settings.preferences.section.goals', 'Goals & Volume'),
      goalLabel: t('settings.preferences.goal', 'Primary Goal'),
      goalStrength: t('settings.preferences.goal.strength', 'Strength'),
      goalHypertrophy: t(
        'settings.preferences.goal.hypertrophy',
        'Hypertrophy'
      ),
      goalGeneralFitness: t(
        'settings.preferences.goal.general_fitness',
        'General Fitness'
      ),
      goalSportSupport: t(
        'settings.preferences.goal.sport_support',
        'Sport Support'
      ),
      trainingDaysLabel: t(
        'settings.preferences.training_days',
        'Target Training Frequency'
      ),
      trainingDays2: t(
        'settings.preferences.training_days_value',
        '2 sessions / week',
        { count: 2 }
      ),
      trainingDays3: t(
        'settings.preferences.training_days_value',
        '3 sessions / week',
        { count: 3 }
      ),
      trainingDays4: t(
        'settings.preferences.training_days_value',
        '4 sessions / week',
        { count: 4 }
      ),
      trainingDays5: t(
        'settings.preferences.training_days_value',
        '5 sessions / week',
        { count: 5 }
      ),
      trainingDays6: t(
        'settings.preferences.training_days_value',
        '6 sessions / week',
        { count: 6 }
      ),
      sessionDurationLabel: t(
        'settings.preferences.session_duration',
        'Target Session Length'
      ),
      duration30: t('settings.preferences.duration_value.30', '30 min'),
      duration45: t('settings.preferences.duration_value.45', '45 min'),
      duration60: t('settings.preferences.duration_value.60', '60 min'),
      duration75: t('settings.preferences.duration_value.75', '75 min'),
      duration90: t('settings.preferences.duration_value.90', '90 min'),
      equipmentSection: t(
        'settings.preferences.section.equipment',
        'Equipment & Session Prep'
      ),
      equipmentLabel: t('settings.preferences.equipment', 'Equipment Access'),
      equipmentFullGym: t(
        'settings.preferences.equipment.full_gym',
        'Full Gym'
      ),
      equipmentBasicGym: t(
        'settings.preferences.equipment.basic_gym',
        'Basic Gym'
      ),
      equipmentHomeGym: t(
        'settings.preferences.equipment.home_gym',
        'Home Gym'
      ),
      equipmentMinimal: t(
        'settings.preferences.equipment.minimal',
        'Minimal Equipment'
      ),
      warmupTitle: t(
        'settings.preferences.warmup_sets',
        'Automatic warm-up sets'
      ),
      warmupHelp: t(
        'settings.preferences.warmup_sets_help',
        'Prepend warm-up ramp sets (50%-85%) to main compound lifts at the start of each workout.'
      ),
      sportCheckTitle: t(
        'settings.preferences.sport_check',
        'Pre-workout sport check-in'
      ),
      sportCheckHelp: t(
        'settings.preferences.sport_check_help',
        'Ask about sport load around today before recommending the session.'
      ),
      detailedViewTitle: t(
        'settings.preferences.detailed_view',
        'Show detailed metrics'
      ),
      detailedViewHelp: t(
        'settings.preferences.detailed_view_help',
        'Show advanced stats like individual fatigue gauges and training maxes on the dashboard.'
      ),
      sessionSection: t(
        'settings.preferences.section.session',
        'Session Settings'
      ),
      restLabel: t('settings.default_rest', 'Default Rest Timer'),
      off: t('common.off', 'Off'),
      notesLabel: t(
        'settings.preferences.notes',
        'Notes, limitations, preferences'
      ),
      notesPlaceholder: t(
        'settings.preferences.notes_placeholder',
        'e.g. Avoid high-impact jumps, prefer barbell compounds, 60 min cap'
      ),
      restartOnboarding: t(
        'settings.preferences.restart_onboarding',
        'Run Guided Setup Again'
      ),
    },
    values: {
      summary: getTrainingSummary(profile),
      goal: prefs.goal,
      trainingDaysPerWeek: String(prefs.trainingDaysPerWeek),
      sessionMinutes: String(prefs.sessionMinutes),
      equipmentAccess: prefs.equipmentAccess,
      warmupSetsEnabled: prefs.warmupSetsEnabled === true,
      sportReadinessCheckEnabled: prefs.sportReadinessCheckEnabled === true,
      detailedView:
        typeof prefs.detailedView === 'boolean'
          ? prefs.detailedView
          : !isSimpleModeProfile(profile),
      defaultRest: String(profile.defaultRest || 120),
      notes: String(prefs.notes || ''),
    },
  };
}

function buildSettingsBodyView() {
  const profile = getProfileRecord();
  const bodyMetrics =
    (profile.bodyMetrics as MutableRecord | undefined) || {};

  return {
    labels: {
      metricsTitle: t('settings.body.metrics_title', 'Body Metrics'),
      metricsHelp: t(
        'settings.body.metrics_help',
        'Used by the AI Nutrition Coach to personalise advice. All weights in kg.'
      ),
      sex: t('settings.body.sex', 'Sex'),
      sexNone: t('settings.body.sex_none', '— select —'),
      sexMale: t('settings.body.sex_male', 'Male'),
      sexFemale: t('settings.body.sex_female', 'Female'),
      activity: t('settings.body.activity', 'Activity level'),
      activityNone: t('settings.body.activity_none', '— select —'),
      activitySedentary: t('settings.body.activity_sedentary', 'Sedentary'),
      activityLight: t('settings.body.activity_light', 'Lightly active'),
      activityModerate: t('settings.body.activity_moderate', 'Active'),
      activityVery: t('settings.body.activity_very', 'Very active'),
      weight: t('settings.body.weight', 'Current weight (kg)'),
      height: t('settings.body.height', 'Height (cm)'),
      age: t('settings.body.age', 'Age'),
      targetWeight: t('settings.body.target_weight', 'Target weight (kg)'),
      goalTitle: t('settings.body.goal_title', 'Body Composition Goal'),
      goalLabel: t(
        'settings.body.goal_label',
        'What are you working towards?'
      ),
      goalNone: t('settings.body.goal_none', '— select —'),
      goalLoseFat: t('settings.body.goal.lose_fat', 'Lose fat'),
      goalGainMuscle: t('settings.body.goal.gain_muscle', 'Gain muscle'),
      goalRecomp: t(
        'settings.body.goal.recomp',
        'Body recomp (lose fat + gain muscle)'
      ),
      goalMaintain: t('settings.body.goal.maintain', 'Maintain'),
      save: t('settings.body.save', 'Save'),
    },
    values: {
      sex: String(bodyMetrics.sex || ''),
      activityLevel: String(bodyMetrics.activityLevel || ''),
      weight: bodyMetrics.weight ?? '',
      height: bodyMetrics.height ?? '',
      age: bodyMetrics.age ?? '',
      targetWeight: bodyMetrics.targetWeight ?? '',
      bodyGoal: String(bodyMetrics.bodyGoal || ''),
    },
  };
}

function syncSettingsAccountView() {
  useRuntimeStore.getState().setSettingsAccountView(buildSettingsAccountView());
}

function syncSettingsScheduleView() {
  useRuntimeStore.getState().setSettingsScheduleView(buildSettingsScheduleView());
}

function syncSettingsProgramView() {
  useRuntimeStore.getState().setSettingsProgramView(buildSettingsProgramView());
}

function syncSettingsPreferencesView() {
  useRuntimeStore
    .getState()
    .setSettingsPreferencesView(buildSettingsPreferencesView());
}

function syncSettingsBodyView() {
  useRuntimeStore.getState().setSettingsBodyView(buildSettingsBodyView());
}

function syncSettingsBridge() {
  useRuntimeStore.getState().setActiveSettingsTab(getDefaultSettingsTab());
  syncSettingsAccountView();
  syncSettingsScheduleView();
  syncSettingsProgramView();
  syncSettingsPreferencesView();
  syncSettingsBodyView();
}

function parseOnboardingExerciseIds(text: unknown) {
  const runtimeWindow = getRuntimeWindow();
  return String(text || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((name) => runtimeWindow?.resolveRegisteredExerciseId?.(name) || name)
    .filter(Boolean);
}

function getOnboardingDefaultDraft() {
  const profile = getProfileRecord();
  const schedule = getScheduleRecord();
  const prefs = normalizeTrainingPreferences(profile);
  const coaching = normalizeCoachingProfile(profile);

  return {
    goal: prefs.goal,
    experienceLevel: coaching.experienceLevel,
    trainingDaysPerWeek: prefs.trainingDaysPerWeek,
    sessionMinutes: prefs.sessionMinutes,
    equipmentAccess: prefs.equipmentAccess,
    sportName:
      String(coaching.sportProfile?.name || '').trim() ||
      String(schedule.sportName || '').trim(),
    inSeason: coaching.sportProfile?.inSeason === true,
    sportSessionsPerWeek:
      Number(coaching.sportProfile?.sessionsPerWeek) ||
      (Array.isArray(schedule.sportDays) ? schedule.sportDays.length : 0),
    jointFlags: [...(coaching.limitations?.jointFlags || [])],
    avoidMovementTags: [...(coaching.limitations?.avoidMovementTags || [])],
    avoidExercisesText: (coaching.limitations?.avoidExerciseIds || []).join(', '),
    guidanceMode: coaching.guidanceMode,
  };
}

function buildOnboardingRecommendation(draft?: Record<string, unknown>) {
  const profile = getProfileRecord();
  const schedule = getScheduleRecord();
  const nextDraft = draft || getOnboardingDefaultDraft();
  const nextProfile = cloneJson(profile) || {};

  nextProfile.preferences = normalizeTrainingPreferences({
    ...nextProfile,
    preferences: {
      ...(((nextProfile.preferences as MutableRecord) ||
        getDefaultTrainingPreferences()) as MutableRecord),
      goal: nextDraft.goal,
      trainingDaysPerWeek: parseInt(String(nextDraft.trainingDaysPerWeek), 10) || 3,
      sessionMinutes: parseInt(String(nextDraft.sessionMinutes), 10) || 60,
      equipmentAccess: nextDraft.equipmentAccess,
    },
  });

  nextProfile.coaching = normalizeCoachingProfile({
    ...nextProfile,
    coaching: {
      ...(((nextProfile.coaching as MutableRecord) ||
        getDefaultCoachingProfile()) as MutableRecord),
      experienceLevel: nextDraft.experienceLevel,
      guidanceMode: nextDraft.guidanceMode,
      sportProfile: {
        name: String(nextDraft.sportName || '').trim(),
        inSeason: nextDraft.inSeason === true,
        sessionsPerWeek:
          parseInt(String(nextDraft.sportSessionsPerWeek), 10) || 0,
      },
      limitations: {
        jointFlags: [...(((nextDraft.jointFlags as string[]) || []) as string[])],
        avoidMovementTags: [
          ...(((nextDraft.avoidMovementTags as string[]) || []) as string[]),
        ],
        avoidExerciseIds: parseOnboardingExerciseIds(
          nextDraft.avoidExercisesText
        ),
      },
      exercisePreferences: {
        preferredExerciseIds: [],
        excludedExerciseIds: parseOnboardingExerciseIds(
          nextDraft.avoidExercisesText
        ),
      },
      onboardingCompleted: false,
    },
  });

  return getInitialPlanRecommendation({
    profile: nextProfile,
    schedule: {
      ...schedule,
      sportName:
        String(nextDraft.sportName || schedule.sportName || '').trim() ||
        String(schedule.sportName || ''),
    },
  });
}

function getLegacyRuntimeState() {
  const dataState = dataStore.getState();
  const workoutState = workoutStore.getState();
  const profileState = profileStore.getState();
  const runtimeWindow = getRuntimeWindow();
  const legacyCurrentUser = readLegacyRuntimeValue<MutableRecord | null>('currentUser');
  const legacyWorkouts = readLegacyRuntimeValue<Array<Record<string, unknown>>>(
    'workouts'
  );
  const legacyActiveWorkout = readLegacyRuntimeValue<MutableRecord | null>(
    'activeWorkout'
  );

  return {
    currentUser: cloneJson(
      legacyCurrentUser !== undefined
        ? legacyCurrentUser
        : dataState.currentUser || runtimeWindow?.currentUser || null
    ),
    workouts: cloneJson(
      legacyWorkouts !== undefined
        ? legacyWorkouts
        : dataState.workouts || runtimeWindow?.workouts || []
    ),
    schedule: cloneJson(
      (profileState.schedule as MutableRecord | null) ||
          (dataState.schedule as MutableRecord | null) ||
          runtimeWindow?.schedule ||
          null
    ),
    profile: cloneJson(
      (profileState.profile as MutableRecord | null) ||
          (dataState.profile as MutableRecord | null) ||
          runtimeWindow?.profile ||
          null
    ),
    activeWorkout: cloneJson(
      legacyActiveWorkout !== undefined
        ? legacyActiveWorkout
        : (workoutState.activeWorkout as MutableRecord | null) ||
          (dataState.activeWorkout as MutableRecord | null) ||
          runtimeWindow?.activeWorkout ||
          null
    ),
  };
}

function setLegacyRuntimeState(partial: Record<string, unknown>) {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow || !partial || typeof partial !== 'object') return;
  const hasCurrentUser = hasOwnRuntimeField(partial, 'currentUser');
  const hasWorkouts = hasOwnRuntimeField(partial, 'workouts');
  const hasSchedule = hasOwnRuntimeField(partial, 'schedule');
  const hasProfile = hasOwnRuntimeField(partial, 'profile');
  const hasActiveWorkout = hasOwnRuntimeField(partial, 'activeWorkout');
  const profileBridge = runtimeWindow.__IRONFORGE_PROFILE_STORE__ || null;
  const hasCombinedProfileSchedule = hasProfile && hasSchedule;

  if (hasCurrentUser) {
    const nextValue = cloneJson((partial.currentUser as MutableRecord | null) || null);
    runtimeWindow.currentUser = nextValue;
    writeLegacyRuntimeValue('currentUser', nextValue);
  }
  if (hasWorkouts) {
    const nextValue = Array.isArray(partial.workouts)
      ? cloneJson(partial.workouts as Array<Record<string, unknown>>)
      : [];
    runtimeWindow.workouts = nextValue;
    writeLegacyRuntimeValue('workouts', nextValue);
  }
  if (hasCombinedProfileSchedule) {
    const nextProfile = cloneJson((partial.profile as MutableRecord | null) || null);
    const nextSchedule = cloneJson((partial.schedule as MutableRecord | null) || null);
    if (typeof profileBridge?.hydrateProfileRuntime === 'function') {
      profileBridge.hydrateProfileRuntime({
        profile: nextProfile,
        schedule: nextSchedule,
      });
    } else if (
      typeof profileBridge?.setProfile === 'function' &&
      typeof profileBridge?.setSchedule === 'function'
    ) {
      profileBridge.setProfile(nextProfile);
      profileBridge.setSchedule(nextSchedule);
    } else {
      throw new Error(
        '[Ironforge] Profile store bridge is required before writing legacy profile state.'
      );
    }
  } else if (hasSchedule) {
    const nextValue = cloneJson((partial.schedule as MutableRecord | null) || null);
    if (typeof profileBridge?.setSchedule === 'function') {
      profileBridge.setSchedule(nextValue);
    } else {
      throw new Error(
        '[Ironforge] Profile store bridge is required before writing legacy schedule state.'
      );
    }
  }
  if (hasProfile && !hasSchedule) {
    const nextValue = cloneJson((partial.profile as MutableRecord | null) || null);
    if (typeof profileBridge?.setProfile === 'function') {
      profileBridge.setProfile(nextValue);
    } else {
      throw new Error(
        '[Ironforge] Profile store bridge is required before writing legacy profile state.'
      );
    }
  }
  if (hasActiveWorkout) {
    const nextValue = cloneJson(
      (partial.activeWorkout as MutableRecord | null) || null
    );
    runtimeWindow.activeWorkout = nextValue;
    writeLegacyRuntimeValue('activeWorkout', nextValue);
  }

  const shouldSyncDataStore = hasCurrentUser || hasWorkouts || hasActiveWorkout;
  if (shouldSyncDataStore) {
    dataStore.getState().syncFromLegacy();
  }
  if (!profileBridge && (hasProfile || hasSchedule)) {
    profileStore.getState().syncFromDataStore();
  }
  if (shouldSyncDataStore || hasProfile || hasSchedule) {
    programStore.getState().syncFromLegacy();
  }
  if (shouldSyncDataStore) {
    workoutStore.getState().syncFromLegacy();
  }
  syncSettingsBridge();
  if (hasWorkouts || hasActiveWorkout) {
    runtimeWindow.syncWorkoutSessionBridge?.();
  }
}

function bootstrapProfileRuntime(input?: {
  profile?: Record<string, unknown> | null;
  schedule?: Record<string, unknown> | null;
  workouts?: Array<Record<string, unknown>> | null;
  applyToStore?: boolean;
  normalizeWorkouts?: boolean;
  applyProgramCatchUp?: boolean;
}) {
  const shouldApplyToStore = input?.applyToStore !== false;
  const locale = getRuntimeWindow()?.I18N?.getLanguage?.() || 'en';
  const next = normalizeBootstrapProfileRuntime({
    profile: cloneJson((input?.profile as MutableRecord | null) || null),
    schedule: cloneJson((input?.schedule as MutableRecord | null) || null),
    workouts: cloneJson(input?.workouts || []),
    locale,
    normalizeWorkouts: input?.normalizeWorkouts,
    applyProgramCatchUp: input?.applyProgramCatchUp,
  });
  if (shouldApplyToStore) {
    profileStore.getState().hydrateProfileRuntime({
      profile: next.profile,
      schedule: next.schedule,
    });
    programStore.getState().syncFromLegacy();
    syncSettingsBridge();
  }
  return next;
}

function saveSchedule(nextValues?: Record<string, unknown>) {
  const currentSchedule = getScheduleRecord();
  const nextSchedule = {
    ...(currentSchedule || {}),
  } as MutableRecord;

  if (nextValues && typeof nextValues === 'object') {
    if (hasOwnRuntimeField(nextValues, 'sportName')) {
      nextSchedule.sportName = String(nextValues.sportName || '').trim();
    }
    if (hasOwnRuntimeField(nextValues, 'sportLegsHeavy')) {
      nextSchedule.sportLegsHeavy = nextValues.sportLegsHeavy !== false;
    }
    if (hasOwnRuntimeField(nextValues, 'sportIntensity')) {
      nextSchedule.sportIntensity = nextValues.sportIntensity || 'hard';
    }
    if (hasOwnRuntimeField(nextValues, 'sportDays')) {
      nextSchedule.sportDays = Array.isArray(nextValues.sportDays)
        ? [...nextValues.sportDays]
        : [];
    }
  } else {
    const nameInput = document.getElementById('sport-name');
    if (nameInput instanceof HTMLInputElement) {
      nextSchedule.sportName = nameInput.value.trim();
    }
    const legsHeavyInput = document.getElementById('sport-legs-heavy');
    if (legsHeavyInput instanceof HTMLInputElement) {
      nextSchedule.sportLegsHeavy = legsHeavyInput.checked;
    }
  }

  profileStore.getState().setSchedule(nextSchedule);
  if (!getLegacyRuntimeState().activeWorkout) {
    callLegacyWindowFunction('resetNotStartedView');
  }
  callLegacyWindowFunction('saveScheduleData');
  syncSettingsScheduleView();
  callLegacyWindowFunction('updateProgramDisplay');
  callLegacyWindowFunction('updateDashboard');
  callLegacyWindowFunction('renderSportStatusBar');
  callLegacyWindowFunction(
    'showToast',
    t('toast.schedule_saved', 'Saved'),
    'var(--blue)'
  );
}

function updateLanguageDependentUI() {
  const runtimeWindow = getRuntimeWindow();
  runtimeWindow?.I18N?.applyTranslations?.(document);
  useRuntimeStore.getState().bumpLanguageVersion();
  syncSettingsBridge();

  callLegacyWindowFunction('updateDashboard');
  callLegacyWindowFunction('renderSportDayToggles');

  if (getLegacyRuntimeState().activeWorkout) {
    syncLegacyActiveSessionLanguage();
    callLegacyWindowFunction('renderExercises');
    callLegacyWindowFunction('notifyLogActiveIsland');
    runtimeWindow?.syncWorkoutSessionBridge?.();
  }

  const historyPageActive =
    document.getElementById('page-history')?.classList.contains('active') === true;
  const logPageActive =
    document.getElementById('page-log')?.classList.contains('active') === true;

  if (historyPageActive) {
    runtimeWindow?.renderHistory?.();
  } else if (logPageActive && !getLegacyRuntimeState().activeWorkout) {
    runtimeWindow?.resetNotStartedView?.();
  }

  if (document.getElementById('name-modal')?.classList.contains('active')) {
    callLegacyWindowFunction('renderExerciseCatalog');
  }
}

export function installAppRuntimeBridge() {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  if (runtimeWindow.__IRONFORGE_APP_RUNTIME__) {
    return runtimeWindow.__IRONFORGE_APP_RUNTIME__;
  }

  const api: RuntimeApi = {
    buildSettingsAccountView,
    buildSettingsScheduleView,
    buildSettingsProgramView,
    buildSettingsPreferencesView,
    buildSettingsBodyView,
    getLegacyRuntimeState,
    setLegacyRuntimeState,
    bootstrapProfileRuntime,
    saveSchedule,
    syncSettingsBridge,
    syncSettingsAccountView,
    syncSettingsScheduleView,
    syncSettingsProgramView,
    syncSettingsPreferencesView,
    syncSettingsBodyView,
    getOnboardingDefaultDraft,
    buildOnboardingRecommendation,
    updateLanguageDependentUI,
  };

  runtimeWindow.__IRONFORGE_APP_RUNTIME__ = api;
  runtimeWindow.__IRONFORGE_GET_LEGACY_RUNTIME_STATE__ = getLegacyRuntimeState;
  runtimeWindow.__IRONFORGE_SET_LEGACY_RUNTIME_STATE__ = setLegacyRuntimeState;
  runtimeWindow.syncSettingsBridge = syncSettingsBridge;
  runtimeWindow.getOnboardingDefaultDraft = getOnboardingDefaultDraft;
  runtimeWindow.buildOnboardingRecommendation = buildOnboardingRecommendation;
  runtimeWindow.updateLanguageDependentUI = updateLanguageDependentUI;
  syncSettingsBridge();
  return api;
}
