declare module './AppShell.jsx' {
  import type { ComponentType } from 'react';

  const AppShell: ComponentType;
  export default AppShell;
}

declare module './OnboardingFlow.jsx' {
  import type { ComponentType } from 'react';

  const OnboardingFlow: ComponentType;
  export default OnboardingFlow;
}

declare global {
  interface Window {
    I18N?: {
      t?: (
        key: string,
        params?: Record<string, unknown> | null,
        fallback?: string
      ) => string;
      extendStrings?: (locale: string, entries: Record<string, string>) => void;
      setLanguage?: (
        locale: string,
        options?: { persist?: boolean; notify?: boolean }
      ) => string;
      getLanguage?: () => string;
      applyTranslations?: (root?: ParentNode | null) => void;
      fallbackLocale?: string;
      supportedLocales?: string[];
    };
    tr?: (
      key: string,
      fallback?: string,
      params?: Record<string, unknown> | null
    ) => string;
    __IRONFORGE_APP_SHELL_READY__?: boolean;
    __IRONFORGE_RUNTIME_BRIDGE__?: {
      navigateToPage?: (page: string) => void;
      setActiveSettingsTab?: (tab: string) => void;
      openConfirm?: (confirm: {
        open?: boolean;
        title?: string;
        message?: string;
        confirmLabel?: string;
        cancelLabel?: string;
      }) => void;
      closeConfirm?: () => void;
      showToast?: (toast: {
        message: string;
        color?: string;
        variant?: string;
        undoLabel?: string;
        undoAction?: (() => void) | null;
        durationMs?: number;
      }) => void;
      hideToast?: () => void;
      setWorkoutSessionState?: (partial: Record<string, unknown>) => void;
      setLogStartView?: (view: Record<string, unknown> | null) => void;
      setLogActiveView?: (view: Record<string, unknown> | null) => void;
      setHistoryView?: (view: Record<string, unknown> | null) => void;
      setDashboardView?: (view: Record<string, unknown> | null) => void;
      setNutritionView?: (view: Record<string, unknown> | null) => void;
      setSettingsAccountView?: (view: Record<string, unknown> | null) => void;
      setSettingsBodyView?: (view: Record<string, unknown> | null) => void;
      setSettingsPreferencesView?: (view: Record<string, unknown> | null) => void;
      setSettingsProgramView?: (view: Record<string, unknown> | null) => void;
      setSettingsScheduleView?: (view: Record<string, unknown> | null) => void;
      setExerciseCatalogView?: (view: Record<string, unknown> | null) => void;
    };
    syncRuntimeStoreFromLegacy?: () => void;
    syncWorkoutSessionBridge?: () => void;
    syncHistoryBridge?: () => void;
    syncDashboardBridge?: () => void;
    syncSettingsBridge?: () => void;
    syncNutritionBridge?: () => void;
    getOnboardingDefaultDraft?: () => Record<string, unknown> | null;
    getProgramRegistry?: () => Record<string, unknown>;
    getRegisteredPrograms?: () => Array<Record<string, unknown>>;
    hasRegisteredPrograms?: () => boolean;
    registerProgram?: (program: Record<string, unknown>) => void;
    getProgramById?: (programId: string) => Record<string, unknown> | null;
    getProgramInitialState?: (programId: string) => Record<string, unknown> | null;
    getExerciseLibrary?: () => Record<string, unknown> | null;
    hasExerciseLibrary?: () => boolean;
    resolveRegisteredExerciseId?: (input: unknown) => string | null;
    getRegisteredExercise?: (input: unknown) => Record<string, unknown> | null;
    getExerciseMetadata?: (
      input: unknown,
      locale?: string
    ) => Record<string, unknown> | null;
    getExerciseDisplayName?: (input: unknown, locale?: string) => string;
    getExerciseGuidanceFor?: (
      input: unknown,
      locale?: string
    ) => Record<string, unknown> | null;
    mapExerciseMuscleToDisplayGroup?: (muscle: unknown) => string | null;
    listRegisteredExercises?: (options?: Record<string, unknown>) => Array<Record<string, unknown>>;
    searchRegisteredExercises?: (
      query?: string,
      filters?: Record<string, unknown>
    ) => Array<Record<string, unknown>>;
    getRelatedRegisteredExercises?: (
      exerciseId: string,
      options?: Record<string, unknown>
    ) => Array<Record<string, unknown>>;
    registerCustomExercise?: (
      definition: Record<string, unknown>
    ) => Record<string, unknown> | null;
    setRestBarActiveState?: (active: boolean) => void;
    loadData?: (options?: {
      allowCloudSync?: boolean;
      userId?: string;
      allowLegacyFallback?: boolean;
    }) => Promise<void> | void;
    getLocalCacheKey?: (baseKey: string, userId?: string) => string;
    clearLocalDataCache?: (options?: Record<string, unknown>) => void;
    getActiveWorkoutDraftCache?: () => Record<string, unknown> | null;
    getWorkoutStartSnapshot?: (
      input?: Record<string, unknown>
    ) => Record<string, unknown> | null;
    getLiveWorkoutSessionSnapshot?: () => Record<string, unknown> | null;
    getCachedWorkoutStartSnapshot?: () => Record<string, unknown> | null;
    clearWorkoutStartSnapshot?: () => void;
    saveWorkouts?: (...args: unknown[]) => Promise<unknown> | unknown;
    saveScheduleData?: (...args: unknown[]) => Promise<unknown> | unknown;
    saveProfileData?: (...args: unknown[]) => Promise<unknown> | unknown;
    saveTrainingPreferences?: (options?: Record<string, unknown>) => void;
    saveRestTimer?: () => void;
    saveBodyMetrics?: () => void;
    persistActiveWorkoutDraft?: (...args: unknown[]) => unknown;
    clearActiveWorkoutDraft?: (...args: unknown[]) => unknown;
    currentUser?: Record<string, unknown> | null;
    workouts?: Array<Record<string, unknown>>;
    schedule?: Record<string, unknown> | null;
    profile?: Record<string, unknown> | null;
    activeWorkout?: Record<string, unknown> | null;
    startWorkout?: () => void;
    resumeActiveWorkoutUI?: (options?: Record<string, unknown>) => unknown;
    updateRestDuration?: (nextValue?: string | number | null) => void;
    startRestTimer?: () => void;
    skipRest?: () => void;
    addExerciseByName?: (name: string) => void;
    showSetRIRPrompt?: (exerciseIndex: number, setIndex: number) => void;
    applySetRIR?: (
      exerciseIndex: number,
      setIndex: number,
      rirValue: string | number
    ) => void;
    toggleSet?: (exerciseIndex: number, setIndex: number) => void;
    updateSet?: (
      exerciseIndex: number,
      setIndex: number,
      field: string,
      value: string | number
    ) => void;
    addSet?: (exerciseIndex: number) => void;
    removeEx?: (exerciseIndex: number) => void;
    finishWorkout?: () => Promise<unknown> | unknown;
    cancelWorkout?: () => void;
    restDuration?: number;
    restEndsAt?: number;
    restSecondsLeft?: number;
    __IRONFORGE_TEST_USER_ID__?: string;
    runPageActivationSideEffects?: (page: string) => void;
    resetNotStartedView?: () => void;
    showSettingsTab?: (tab: string, trigger?: Element | null) => void;
    updateDashboard?: () => void;
    renderHistory?: () => void;
    getTodayTrainingDecision?: (
      context?: Record<string, unknown> | null
    ) => Record<string, unknown> | null;
    showConfirm?: (
      title: string,
      message: string,
      onConfirm?: (() => void) | null
    ) => void;
    confirmOk?: () => void;
    confirmCancel?: () => void;
    clearNutritionHistory?: () => void;
    retryLastNutritionMessage?: () => void;
    loginWithEmail?: () => Promise<unknown> | unknown;
    signUpWithEmail?: () => Promise<unknown> | unknown;
    logout?: () => Promise<unknown> | unknown;
    setSelectedNutritionAction?: (actionId: string) => void;
    submitNutritionTextMessage?: (text: string, isCorrection?: boolean) => void;
    handleNutritionPhoto?: (event: Event) => void;
    setExerciseCatalogSearch?: (value: string) => void;
    setExerciseCatalogFilter?: (group: string, value: string) => void;
    clearExerciseCatalogFilters?: () => void;
    selectExerciseCatalogExercise?: (exerciseId: string) => void;
    closeNameModal?: () => void;
    showSessionSummary?: () => Promise<unknown> | unknown;
    __IRONFORGE_STORES__?: {
      data?: {
        getState?: () => any;
        getActiveWorkoutDraftCache?: () => any;
      };
      workout?: {
        getState?: () => any;
        startWorkout?: () => void;
        resumeActiveWorkoutUI?: (options?: Record<string, unknown>) => unknown;
        updateRestDuration?: (nextValue?: string | number | null) => void;
        addExerciseByName?: (name: string) => void;
        applySetRIR?: (
          exerciseIndex: number,
          setIndex: number,
          rirValue: string | number
        ) => void;
        toggleSet?: (exerciseIndex: number, setIndex: number) => void;
        updateSet?: (
          exerciseIndex: number,
          setIndex: number,
          field: string,
          value: string | number
        ) => void;
        addSet?: (exerciseIndex: number) => void;
        finishWorkout?: () => Promise<unknown> | unknown;
        cancelWorkout?: () => void;
      };
      runtime?: {
        getState?: () => any;
      };
    };
    __IRONFORGE_E2E__?: {
      app?: {
        loadData?: (options?: Record<string, unknown>) => Promise<void>;
        navigateToPage?: (page: string) => void;
        setCurrentUser?: (user: Record<string, unknown> | null) => void;
        seedData?: (snapshot: {
          workouts?: Array<Record<string, unknown>>;
          profile?: Record<string, unknown> | null;
          schedule?: Record<string, unknown> | null;
        }) => Promise<void>;
      };
      settings?: {
        openProgramTab?: (
          programId?: string,
          programState?: Record<string, unknown> | null
        ) => void;
        openBodyTab?: (
          bodyMetrics?: Record<string, unknown> | null
        ) => Promise<void>;
        openPreferencesTab?: (options?: {
          preferences?: Record<string, unknown> | null;
          defaultRest?: number | string | null;
        }) => Promise<void>;
      };
      program?: {
        getById?: (programId: string) => Record<string, unknown> | null;
        getInitialState?: (programId: string) => Record<string, unknown> | null;
      };
      i18n?: {
        setLanguage?: (
          locale: string,
          options?: { persist?: boolean; notify?: boolean }
        ) => string;
      };
      profile?: {
        update?: (patch: Record<string, unknown>) => Record<string, unknown> | null;
        setSportReadinessCheckEnabled?: (enabled: boolean) => void;
      };
      workout?: {
        showRPEPicker?: (
          exerciseName: string,
          setNumber: number,
          callback: (value: number | null) => void
        ) => unknown;
        showSportReadinessCheck?: (
          callback: (context: Record<string, unknown> | null) => void
        ) => unknown;
        showSessionSummary?: (summaryData: Record<string, unknown>) => unknown;
      };
    };
  }
}

export {};
