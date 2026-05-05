export {};

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

interface IronforgeUser {
  id: string;
  email?: string;
  [key: string]: unknown;
}

interface IronforgeTrainingPreferences {
  goal?: string;
  trainingDaysPerWeek?: number;
  sessionMinutes?: number;
  equipmentAccess?: string;
  sportReadinessCheckEnabled?: boolean;
  warmupSetsEnabled?: boolean;
  notes?: string;
  [key: string]: unknown;
}

interface IronforgeCoachingProfile {
  guidanceMode?: string;
  experienceLevel?: string;
  sportProfile: {
    inSeason?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface IronforgeBodyMetrics {
  weight?: number;
  height?: number;
  age?: number;
  sex?: string;
  activityLevel?: string;
  bodyGoal?: string;
  targetWeight?: number;
  [key: string]: unknown;
}

interface IronforgeProfile {
  language?: string;
  activeProgram?: string;
  defaultRest?: number;
  bodyMetrics: IronforgeBodyMetrics;
  preferences: IronforgeTrainingPreferences;
  coaching: IronforgeCoachingProfile;
  programs: Record<string, unknown>;
  [key: string]: unknown;
}

interface IronforgeSchedule {
  sportName?: string;
  sportDays: number[];
  sportIntensity?: string;
  sportLegsHeavy?: boolean;
  [key: string]: unknown;
}

type IronforgeWorkout = Record<string, unknown>;

interface IronforgeI18nApi {
  t: (key: string, params?: unknown, fallback?: string) => string;
  getLanguage: () => string;
  setLanguage: (
    language: string,
    options?: { persist?: boolean; notify?: boolean }
  ) => void;
  applyTranslations?: (root?: ParentNode) => void;
  normalizeLocale?: (locale?: string) => string;
}

interface IronforgeHistoryReactSnapshot {
  stats: {
    e1rm: {
      lifts: Array<{
        key: string;
        pts: unknown[];
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface IronforgeSettingsAccountReactSnapshot {
  values: {
    dangerOpen?: boolean;
    dangerDeleteDisabled?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

declare global {
  var currentUser: IronforgeUser | null;
  var workouts: IronforgeWorkout[];
  var schedule: IronforgeSchedule;
  var profile: IronforgeProfile;
  var settingsAccountUiState: {
    dangerOpen: boolean;
    dangerInput: string;
  };
  var I18N: IronforgeI18nApi;

  function initSettings(): void;
  function showSettingsTab(name: string, el?: Element | null): void;
  function saveLanguageSetting(language?: string): void;
  function notifySettingsAccountIsland(): void;
  function getSettingsAccountReactSnapshot(): IronforgeSettingsAccountReactSnapshot;
  function checkDangerConfirm(nextValue?: string): void;
  function renderHistory(): void;
  function refreshSyncedUI(options?: { toast?: boolean }): void;
  function setSyncStatus(state: string): void;
  function retryCloudSync(options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  function runCloudSyncHealthCheck(
    options?: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
  function getLastSyncDiagnostics(): Record<string, unknown>;
  function getSyncStatusState(): Record<string, unknown>;
  function openProgramSetupSheet(): void;
  function saveSchedule(nextValues?: Partial<IronforgeSchedule>): void;
  function clearNutritionHistory(): void;
  function clearNutritionLocalData(options?: {
    includeScoped?: boolean;
    includeLegacy?: boolean;
  }): void;
  function isNutritionCoachAvailable(): boolean;
  function openNutritionLogin(): void;
  function confirmOk(): void;
  function normalizeTrainingPreferences(
    profileLike?: Partial<IronforgeProfile> | Record<string, unknown>
  ): IronforgeTrainingPreferences;
  function normalizeCoachingProfile(
    profileLike?: Partial<IronforgeProfile> | Record<string, unknown>
  ): IronforgeCoachingProfile;

  interface Window {
    __IRONFORGE_APP_SHELL_READY__?: boolean;
    __IRONFORGE_AUTH_RUNTIME__?: {
      bootstrap?: () => Promise<void>;
      loginWithEmail?: (credentials?: {
        email?: string;
        password?: string;
      }) => Promise<void>;
      signUpWithEmail?: (credentials?: {
        email?: string;
        password?: string;
      }) => Promise<void>;
      logout?: () => Promise<void>;
      showLoginScreen?: () => void;
      hideLoginScreen?: () => void;
      getSupabaseClient?: () => unknown;
    };
    setupRealtimeSync?: () => void;
    teardownRealtimeSync?: () => void;
    resetRuntimeState?: () => void;
    __importWorkoutXssTriggered?: boolean;
    __sportNameXssTriggered?: boolean;
    syncRuntimeStoreFromLegacy?: () => void;
    loadData?: (options?: {
      allowCloudSync?: boolean;
      userId?: string;
    }) => Promise<void> | void;
    I18N?: IronforgeI18nApi;
    getCanonicalProgramId: (programId?: string | null) => string | null;
    initNutritionPage: () => void;
    clearNutritionHistory: () => void;
    handleNutritionPhoto: (event: Event) => void;
    submitNutritionTextMessage: (text: string) => void;
    setSelectedNutritionAction: (actionId: string) => void;
    setNutritionSessionContext: (
      ctx?: {
        duration?: number;
        exerciseCount?: number;
        tonnage?: number;
        rpe?: number;
        [key: string]: unknown;
      } | null
    ) => void;
    clearNutritionLocalData: (options?: {
      includeScoped?: boolean;
      includeLegacy?: boolean;
    }) => void;
    isNutritionCoachAvailable: () => boolean;
    openNutritionLogin: () => void;
    retryLastNutritionMessage: () => void;
    saveLanguageSetting: (language?: string) => void;
    initSettings: () => void;
    showSettingsTab: (name: string, el?: Element | null) => void;
    notifySettingsAccountIsland: () => void;
    getSettingsAccountReactSnapshot: () => IronforgeSettingsAccountReactSnapshot;
    saveSchedule: (nextValues?: Partial<IronforgeSchedule>) => void;
    switchHistoryTab: (tab: string) => void;
    getHistoryReactSnapshot: () => IronforgeHistoryReactSnapshot;
    refreshSyncedUI: (options?: { toast?: boolean }) => void;
    setSyncStatus?: (state: string) => void;
    retryCloudSync?: (
      options?: Record<string, unknown>
    ) => Promise<Record<string, unknown>>;
    runCloudSyncHealthCheck?: (
      options?: Record<string, unknown>
    ) => Promise<Record<string, unknown>>;
    getLastSyncDiagnostics?: () => Record<string, unknown>;
    getSyncStatusState?: () => Record<string, unknown>;
    __IRONFORGE_SYNC_RETRY_CALLS__?: number;
    openProgramSetupSheet: () => void;
    renderHistory: () => void;
    confirmOk: () => void;
  }
}
