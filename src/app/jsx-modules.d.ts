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
  type IronforgeWorkoutToastPlan = {
    text: string;
    color: string;
    delay?: number;
  };
  type IronforgePostWorkoutSummaryResult = {
    feedback?: string;
    notes?: string;
    goToNutrition?: boolean;
  };
  type IronforgePostWorkoutOutcomeInput = {
    savedWorkout?: Record<string, unknown> | null;
    summaryResult?: IronforgePostWorkoutSummaryResult | null;
    summaryData?: Record<string, unknown> | null;
  };
  type IronforgePostWorkoutOutcomeResult = {
    shouldSaveWorkouts: boolean;
    tmAdjustmentToast: string;
    goToNutrition: boolean;
    nutritionContext: Record<string, unknown> | null;
    durationSignal?: string | null;
  };
  type IronforgeWorkoutStartPresentationInput = {
    activeWorkout?: Record<string, unknown> | null;
    isBonus?: boolean;
    title?: string;
    programLabel?: string;
    programName?: string;
    sessionDescription?: string;
    effectiveDecision?: Record<string, unknown> | null;
    planningContext?: Record<string, unknown> | null;
    startSnapshot?: Record<string, unknown> | null;
    schedule?: Record<string, unknown> | null;
    legLifts?: Array<unknown>;
    isSportDay?: boolean;
    hadSportRecently?: boolean;
    isDeload?: boolean;
  };
  type IronforgeWorkoutStartPresentationResult = {
    title: string;
    descriptionText: string;
    descriptionVisible: boolean;
    immediateToast: IronforgeWorkoutToastPlan;
    queuedToasts: IronforgeWorkoutToastPlan[];
  };
  type IronforgeWorkoutTeardownPlanInput = {
    mode?: 'finish' | 'cancel' | string;
  };
  type IronforgeWorkoutTeardownPlanResult = {
    showNotStarted: boolean;
    hideActive: boolean;
    resetNotStartedView: boolean;
    notifyLogActive: boolean;
    updateDashboard: boolean;
    discardToast: string;
  };
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
    __IRONFORGE_APP_RUNTIME__?: {
      buildSettingsAccountView?: () => Record<string, unknown>;
      buildSettingsScheduleView?: () => Record<string, unknown>;
      buildSettingsProgramView?: () => Record<string, unknown>;
      buildSettingsPreferencesView?: () => Record<string, unknown>;
      buildSettingsBodyView?: () => Record<string, unknown>;
      getLegacyRuntimeState?: () => Record<string, unknown>;
      setLegacyRuntimeState?: (partial: Record<string, unknown>) => void;
      saveSchedule?: (nextValues?: Record<string, unknown>) => void;
      syncSettingsBridge?: () => void;
      syncSettingsAccountView?: () => void;
      syncSettingsScheduleView?: () => void;
      syncSettingsProgramView?: () => void;
      syncSettingsPreferencesView?: () => void;
      syncSettingsBodyView?: () => void;
      getOnboardingDefaultDraft?: () => Record<string, unknown> | null;
      buildOnboardingRecommendation?: (
        draft?: Record<string, unknown>
      ) => Record<string, unknown> | null;
      updateLanguageDependentUI?: () => void;
    };
    __IRONFORGE_ACTIVE_SETTINGS_TAB__?: string;
    setupRealtimeSync?: () => void;
    teardownRealtimeSync?: () => void;
    resetRuntimeState?: () => void;
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
      getSupabaseClient?: () => {
        auth?: {
          getSession?: () => Promise<unknown>;
          onAuthStateChange?: (
            callback: (event: string, session: unknown | null) => void
          ) => unknown;
          signInWithPassword?: (credentials: {
            email: string;
            password: string;
          }) => Promise<unknown>;
          signUp?: (credentials: {
            email: string;
            password: string;
          }) => Promise<unknown>;
          signOut?: () => Promise<unknown>;
        };
      };
    };
    __IRONFORGE_APP_VERSION__?: string;
    __IRONFORGE_APP_SHELL_READY__?: boolean;
    __IRONFORGE_DISABLE_LEGACY_SW__?: boolean;
    __IRONFORGE_PWA_UPDATE_RUNTIME__?: {
      register?: () => Promise<void>;
      applyUpdate?: () => void;
      setWaitingWorkerForTest?: (
        worker: { postMessage: (message: unknown) => void } | null,
        options?: { autoApply?: boolean }
      ) => void;
    };
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
      setSettingsAccountView?: (view: Record<string, unknown> | null) => void;
      setSettingsBodyView?: (view: Record<string, unknown> | null) => void;
      setSettingsPreferencesView?: (
        view: Record<string, unknown> | null
      ) => void;
      setSettingsProgramView?: (view: Record<string, unknown> | null) => void;
      setSettingsScheduleView?: (view: Record<string, unknown> | null) => void;
      setExerciseCatalogView?: (view: Record<string, unknown> | null) => void;
    };
    syncRuntimeStoreFromLegacy?: () => void;
    syncWorkoutSessionBridge?: () => void;
    syncSettingsBridge?: () => void;
    __IRONFORGE_SET_AUTH_LOGGED_IN__?: (isLoggedIn: boolean) => void;
    __IRONFORGE_SET_AUTH_STATE__?: (partial: {
      phase?: 'booting' | 'signed_out' | 'signed_in' | 'loading';
      isLoggedIn?: boolean;
      pendingAction?: 'sign_in' | 'sign_up' | 'sign_out' | null;
      message?: string;
      messageTone?: '' | 'info' | 'error';
    }) => void;
    getOnboardingDefaultDraft?: () => Record<string, unknown> | null;
    buildOnboardingRecommendation?: (
      draft?: Record<string, unknown>
    ) => Record<string, unknown> | null;
    getSettingsAccountUiStateSnapshot?: () => {
      dangerOpen?: boolean;
      dangerInput?: string;
    };
    getProgramRegistry?: () => Record<string, unknown>;
    getRegisteredPrograms?: () => Array<Record<string, unknown>>;
    hasRegisteredPrograms?: () => boolean;
    registerProgram?: (program: Record<string, unknown>) => void;
    getProgramById?: (programId: string) => Record<string, unknown> | null;
    getProgramInitialState?: (
      programId: string
    ) => Record<string, unknown> | null;
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
    listRegisteredExercises?: (
      options?: Record<string, unknown>
    ) => Array<Record<string, unknown>>;
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
    __IRONFORGE_LEGACY_RUNTIME_ACCESS__?: {
      read?: (name: string) => unknown;
      write?: (name: string, value: unknown) => void;
    };
    __IRONFORGE_SUPABASE__?: {
      auth?: {
        getSession?: () => Promise<unknown>;
        onAuthStateChange?: (
          callback: (event: string, session: unknown | null) => void
        ) => unknown;
        signInWithPassword?: (credentials: {
          email: string;
          password: string;
        }) => Promise<unknown>;
        signUp?: (credentials: {
          email: string;
          password: string;
        }) => Promise<unknown>;
        signOut?: () => Promise<unknown>;
      };
    };
    __IRONFORGE_GET_SUPABASE_CLIENT__?: () => {
      auth?: {
        getSession?: () => Promise<unknown>;
        onAuthStateChange?: (
          callback: (event: string, session: unknown | null) => void
        ) => unknown;
        signInWithPassword?: (credentials: {
          email: string;
          password: string;
        }) => Promise<unknown>;
        signUp?: (credentials: {
          email: string;
          password: string;
        }) => Promise<unknown>;
        signOut?: () => Promise<unknown>;
      };
    };
    __IRONFORGE_SUPABASE_URL__?: string;
    __IRONFORGE_SUPABASE_PUBLISHABLE_KEY__?: string;
    supabase?: {
      createClient?: (
        url: string,
        key: string,
        options?: Record<string, unknown>
      ) => unknown;
    };
    __IRONFORGE_WORKOUT_RUNTIME__?: {
      getWorkoutStartSnapshotSignature?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => string;
      buildWorkoutStartSnapshot?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown> | null;
      buildSessionSummaryStats?: (
        summaryData?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Array<Record<string, unknown>>;
      buildSavedWorkoutRecord?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown>;
      buildSessionSummaryData?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown>;
      buildBonusActiveWorkout?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown>;
      buildPlannedActiveWorkout?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown>;
      sanitizeSetValue?: (field: unknown, raw: unknown) => string | number;
      applySetUpdateMutation?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown> | null;
      toggleWorkoutSetCompletion?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown> | null;
      appendWorkoutSet?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown> | null;
      removeWorkoutExercise?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown> | null;
      sanitizeWorkoutExercisesForSave?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Array<Record<string, unknown>>;
      buildProgramTmAdjustments?: (
        stateBefore?: Record<string, unknown> | null,
        stateAfter?: Record<string, unknown> | null
      ) => Array<Record<string, unknown>>;
      buildWorkoutProgressionResult?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown>;
      buildCoachNote?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => string;
      buildTmAdjustmentToast?: (
        adjustments?: Array<Record<string, unknown>> | null,
        deps?: Record<string, unknown>
      ) => string;
      buildPostWorkoutOutcome?: (
        input?: IronforgePostWorkoutOutcomeInput,
        deps?: Record<string, unknown>
      ) => IronforgePostWorkoutOutcomeResult;
      buildWorkoutStartPresentation?: (
        input?: IronforgeWorkoutStartPresentationInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutStartPresentationResult;
      buildWorkoutTeardownPlan?: (
        input?: IronforgeWorkoutTeardownPlanInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutTeardownPlanResult;
    };
    __IRONFORGE_GET_LEGACY_RUNTIME_STATE__?: () => Record<
      string,
      unknown
    > | null;
    __IRONFORGE_SET_LEGACY_RUNTIME_STATE__?: (
      partial: Record<string, unknown>
    ) => void;
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
    wasSportRecently?: (hours?: number) => boolean;
    wasHockeyRecently?: (hours?: number) => boolean;
    renderHistory?: () => void;
    getDashboardLabels?: () => Record<string, string>;
    getDashboardWeekLegendItems?: () => Array<Record<string, unknown>>;
    getDashboardDayDetailData?: (
      index: number
    ) => Array<Record<string, unknown>>;
    getDashboardRecoverySnapshot?: (
      fatigue: Record<string, unknown>
    ) => Record<string, unknown>;
    getDashboardTrainingMaxData?: (
      prog: Record<string, unknown>,
      ps: Record<string, unknown>
    ) => Record<string, unknown>;
    buildDashboardPlanStructuredSnapshot?: (
      prog: Record<string, unknown>,
      ps: Record<string, unknown>,
      fatigue: Record<string, unknown>
    ) => Record<string, unknown>;
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
    loginWithEmail?: (credentials?: {
      email?: string;
      password?: string;
    }) => Promise<unknown> | unknown;
    signUpWithEmail?: (credentials?: {
      email?: string;
      password?: string;
    }) => Promise<unknown> | unknown;
    logout?: () => Promise<unknown> | unknown;
    getNutritionRuntimeState?: () => Record<string, unknown>;
    getNutritionActionDefinitions?: () => Array<Record<string, unknown>>;
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
        setLegacyRuntimeState?: (partial: Record<string, unknown>) => void;
        getLegacyRuntimeState?: () => Record<string, unknown> | null;
        getSeedSnapshot?: () => {
          workouts?: Array<Record<string, unknown>>;
          profile?: Record<string, unknown> | null;
          schedule?: Record<string, unknown> | null;
        };
        seedData?: (snapshot: {
          workouts?: Array<Record<string, unknown>>;
          profile?: Record<string, unknown> | null;
          schedule?: Record<string, unknown> | null;
        }) => Promise<void>;
      };
      settings?: {
        openTab?: (tab: string) => void;
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
        update?: (
          patch: Record<string, unknown>
        ) => Record<string, unknown> | null;
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
