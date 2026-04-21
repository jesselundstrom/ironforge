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
  type IronforgeWorkoutSessionBootstrapInput = {
    programId?: string;
    selectedOption?: string;
    programMode?: string | null;
    programLabel?: string;
    sportContext?: Record<string, unknown> | null;
    trainingDecision?: Record<string, unknown> | null;
    planningContext?: Record<string, unknown> | null;
    commentary?: Record<string, unknown> | null;
    effectiveDecision?: Record<string, unknown> | null;
    selectedSessionMode?: string;
    effectiveSessionMode?: string;
    sportAwareLowerBody?: boolean;
    sessionDescription?: string;
    sessionSnapshot?: Record<string, unknown> | null;
    exercises?: Array<Record<string, unknown>>;
    startTime?: number;
    isBonus?: boolean;
  };
  type IronforgeWorkoutSessionBootstrapResult = {
    program: string;
    type: string;
    programOption?: string;
    programDayNum?: number;
    programMode?: unknown;
    programLabel: string;
    sportContext?: Record<string, unknown>;
    planningDecision?: Record<string, unknown>;
    planningContext?: Record<string, unknown>;
    commentary?: Record<string, unknown>;
    runnerState?: Record<string, unknown>;
    sessionDescription: string;
    sessionSnapshot?: Record<string, unknown> | null;
    rewardState: Record<string, unknown>;
    exercises: Array<Record<string, unknown>>;
    startTime: number;
    isBonus?: boolean;
  };
  type IronforgeWorkoutStartPlanInput = {
    prog?: Record<string, unknown> | null;
    state?: Record<string, unknown> | null;
    selectedOption?: string;
    sportContext?: Record<string, unknown> | null;
    workouts?: Array<Record<string, unknown>> | null;
    schedule?: Record<string, unknown> | null;
    profile?: Record<string, unknown> | null;
    pendingSessionMode?: string | null;
    pendingEnergyLevel?: string | null;
  };
  type IronforgeWorkoutStartPlanResult = {
    activeWorkout: IronforgeWorkoutSessionBootstrapResult | null;
    startSnapshot: Record<string, unknown> | null;
    startPresentation: IronforgeWorkoutStartPresentationResult | null;
  };
  type IronforgeWorkoutSummaryPromptInput = {
    summaryData?: Record<string, unknown> | null;
    canLogNutrition?: boolean;
    seed?: number;
  };
  type IronforgeWorkoutSummaryPromptState = {
    open: boolean;
    seed: number;
    kicker: string;
    title: string;
    programLabel: string;
    coachNote: string;
    notesLabel: string;
    notesPlaceholder: string;
    feedbackLabel: string;
    feedbackOptions: Array<{
      value: string;
      label: string;
    }>;
    nutritionLabel: string;
    doneLabel: string;
    notes: string;
    feedback: string | null;
    canLogNutrition: boolean;
    stats: Array<{
      key: string;
      accent: string;
      label: string;
      initialText: string;
    }>;
    summaryData: Record<string, unknown>;
  };
  type IronforgeWorkoutRestTimerInput = {
    restDuration?: unknown;
    restTotal?: unknown;
    restEndsAt?: unknown;
    restSecondsLeft?: unknown;
    profileDefaultRest?: unknown;
    now?: unknown;
  };
  type IronforgeWorkoutRestTimerResult = {
    restDuration: number;
    restTotal: number;
    restEndsAt: number;
    restSecondsLeft: number;
    restBarActive: boolean;
    shouldSkip: boolean;
    isComplete: boolean;
  };
  type IronforgeWorkoutRestDisplayInput = {
    restSecondsLeft?: unknown;
    restTotal?: unknown;
  };
  type IronforgeWorkoutRestDisplayResult = {
    text: string;
    className: string;
    arcOffset: number;
  };
  type IronforgeWorkoutRestLifecycleInput = IronforgeWorkoutRestTimerInput & {
    mode?: 'sync' | 'complete' | 'skip' | string;
  };
  type IronforgeWorkoutRestLifecyclePlan = {
    timerState: IronforgeWorkoutRestTimerResult;
    displayState: IronforgeWorkoutRestDisplayResult;
    shouldComplete: boolean;
    shouldPlayBeep: boolean;
    hideDelayMs: number;
  };
  type IronforgeWorkoutRestHostDeps = {
    setInterval?: (callback: () => void, delay?: number) => unknown;
    clearInterval?: (handle: unknown) => void;
    setTimeout?: (callback: () => void, delay?: number) => unknown;
    clearTimeout?: (handle: unknown) => void;
  };
  type IronforgeWorkoutSessionSnapshotInput = {
    activeWorkout?: unknown;
    restDuration?: unknown;
    restEndsAt?: unknown;
    restSecondsLeft?: unknown;
    restTotal?: unknown;
    currentUser?: unknown;
    restBarActive?: unknown;
    rpePrompt?: Record<string, unknown> | null;
    summaryPrompt?: Record<string, unknown> | null;
    sportCheckPrompt?: Record<string, unknown> | null;
    exerciseGuidePrompt?: Record<string, unknown> | null;
  };
  type IronforgeWorkoutSessionSnapshotResult = {
    activeWorkout: unknown;
    restDuration: number;
    restEndsAt: number;
    restSecondsLeft: number;
    restTotal: number;
    currentUser: unknown;
    restBarActive: boolean;
    rpeOpen: boolean;
    rpePrompt: Record<string, unknown> | null;
    summaryOpen: boolean;
    summaryPrompt: Record<string, unknown> | null;
    sportCheckOpen: boolean;
    sportCheckPrompt: Record<string, unknown> | null;
    exerciseGuideOpen: boolean;
    exerciseGuidePrompt: Record<string, unknown> | null;
  };
  type IronforgeWorkoutMutationInput = {
    exercise?: Record<string, unknown> | null;
    exercises?: Array<Record<string, unknown>> | null;
    setIndex?: number | string | null;
    exerciseIndex?: number | string | null;
    field?: string | null;
    rawValue?: unknown;
  };
  type IronforgeWorkoutMutationResult = {
    exercise?: Record<string, unknown> | null;
    exercises?: Array<Record<string, unknown>> | null;
    set?: Record<string, unknown> | null;
    sanitizedValue?: string | number;
    shouldRefreshDoneSet?: boolean;
    propagatedSetIndexes?: number[];
    isNowDone?: boolean;
    newSetIndex?: number;
    removed?: Record<string, unknown> | null;
  } | null;
  type IronforgeWorkoutProgramMetaInput = {
    prog?: Record<string, unknown> | null;
    progressionSourceState?: Record<string, unknown> | null;
    buildContext?: Record<string, unknown> | null;
  };
  type IronforgeWorkoutProgramMetaResult = {
    programMeta: Record<string, unknown>;
    error?: unknown;
  };
  type IronforgeWorkoutProgressionToastInput = {
    activeWorkout?: Record<string, unknown> | null;
    prog?: Record<string, unknown> | null;
    programName?: string;
    advancedState?: Record<string, unknown> | null;
    newState?: Record<string, unknown> | null;
    programHookFailed?: boolean;
    buildContext?: Record<string, unknown> | null;
  };
  type IronforgeWorkoutFinishPlanInput = {
    prog?: Record<string, unknown> | null;
    activeWorkout?: Record<string, unknown> | null;
    state?: Record<string, unknown> | null;
    workouts?: Array<Record<string, unknown>> | null;
    sessionRPE?: unknown;
    duration?: unknown;
    prCount?: unknown;
    workoutId?: unknown;
    workoutDate?: unknown;
    programName?: string;
  };
  type IronforgeWorkoutFinishPlanResult = {
    savedWorkout: IronforgeWorkoutSavePlan;
    summaryData: Record<string, unknown>;
    progressionResult: IronforgeWorkoutProgressionResult;
    finishTeardownPlan: IronforgeWorkoutTeardownPlanResult;
    progressionToast: IronforgeWorkoutToastPlan | null;
    advancedState: Record<string, unknown>;
    newState: Record<string, unknown>;
    programHookFailed: boolean;
    tmAdjustments: Array<Record<string, unknown>>;
    totalSets: number;
    stateBeforeSession: Record<string, unknown> | null;
    progressionSourceState: Record<string, unknown> | null;
    programMetaError?: unknown;
  };
  type IronforgeWorkoutFinishPersistenceInput = {
    prog?: Record<string, unknown> | null;
    finishPlan?: IronforgeWorkoutFinishPlanResult | null;
    workouts?: Array<Record<string, unknown>> | null;
  };
  type IronforgeWorkoutPostOutcomeEffectsInput = {
    postWorkoutOutcome?: IronforgePostWorkoutOutcomeResult | null;
    summaryData?: Record<string, unknown> | null;
  };
  type IronforgeWorkoutSavePlan = Record<string, unknown>;
  type IronforgeWorkoutProgressionResult = Record<string, unknown>;
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
      getSettingsAccountUiStateSnapshot?: () => {
        dangerOpen: boolean;
        dangerInput: string;
      };
      showSettingsTab?: (tab?: string) => void;
      showDangerConfirm?: () => void;
      checkDangerConfirm?: (nextValue?: string) => void;
      resetSettingsAccountUiState?: () => void;
      getLegacyRuntimeState?: () => Record<string, unknown>;
      setLegacyRuntimeState?: (partial: Record<string, unknown>) => void;
      bootstrapProfileRuntime?: (input?: {
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
      saveTrainingPreferences?: (
        options?: Record<string, unknown>
      ) => Record<string, unknown> | null;
      saveRestTimer?: () => Record<string, unknown> | null;
      saveBodyMetrics?: () => Record<string, unknown> | null;
      saveLanguageSetting?: (
        nextLanguage?: string
      ) => Record<string, unknown> | null;
      exportData?: () => void;
      importData?: (event?: Event | null) => void;
      clearAllData?: () => Promise<void>;
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
    __IRONFORGE_SYNC_RUNTIME__?: {
      resolveProfileSaveDocKeys?: (
        options?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => string[];
      buildStateFromProfileDocuments?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => {
        profile: Record<string, unknown>;
        schedule: Record<string, unknown>;
        rowsByKey: Map<string, Record<string, unknown>>;
      };
      saveScheduleData?: (
        options?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Promise<void>;
      saveProfileData?: (
        options?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Promise<void>;
      upsertProfileDocuments?: (
        docKeys?: string[],
        profileLike?: Record<string, unknown> | null,
        scheduleLike?: Record<string, unknown> | null,
        options?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Promise<{
        ok: boolean;
        appliedDocKeys: string[];
        staleDocKeys: string[];
        rows: Array<Record<string, unknown>>;
      }>;
      pullProfileDocuments?: (
        options?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Promise<{
        usedDocs: boolean;
        supported: boolean;
      }>;
      loadData?: (
        options?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Promise<void>;
      pushToCloud?: (
        options?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Promise<boolean>;
      flushPendingCloudSync?: (deps?: Record<string, unknown>) => Promise<boolean>;
      pullFromCloud?: (
        options?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Promise<{
        usedCloud: boolean;
        usedDocs: boolean;
        requiresBootstrapFinalize: boolean;
      }>;
      resolveStaleProfileDocumentRejects?: (
        staleDocKeys?: string[],
        deps?: Record<string, unknown>
      ) => Promise<boolean>;
      teardownRealtimeSync?: (deps?: Record<string, unknown>) => void;
      applyRealtimeSync?: (
        reason?: string,
        deps?: Record<string, unknown>
      ) => Promise<void>;
      scheduleRealtimeSync?: (
        reason?: string,
        deps?: Record<string, unknown>
      ) => void;
      setupRealtimeSync?: (deps?: Record<string, unknown>) => void;
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
      getCachedWorkoutStartSnapshot?: () => Record<string, unknown> | null;
      setCachedWorkoutStartSnapshot?: (
        snapshot?: Record<string, unknown> | null
      ) => Record<string, unknown> | null;
      clearWorkoutStartSnapshot?: () => void;
      resolveWorkoutStartSnapshot?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown> | null;
      buildWorkoutStartSnapshot?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Record<string, unknown> | null;
      buildWorkoutStartPlan?: (
        input?: IronforgeWorkoutStartPlanInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutStartPlanResult;
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
        input?: IronforgeWorkoutSessionBootstrapInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutSessionBootstrapResult;
      buildPlannedActiveWorkout?: (
        input?: IronforgeWorkoutSessionBootstrapInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutSessionBootstrapResult;
      sanitizeSetValue?: (field: unknown, raw: unknown) => string | number;
      applySetUpdateMutation?: (
        input?: IronforgeWorkoutMutationInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutMutationResult;
      toggleWorkoutSetCompletion?: (
        input?: IronforgeWorkoutMutationInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutMutationResult;
      appendWorkoutSet?: (
        input?: IronforgeWorkoutMutationInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutMutationResult;
      removeWorkoutExercise?: (
        input?: IronforgeWorkoutMutationInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutMutationResult;
      sanitizeWorkoutExercisesForSave?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => Array<Record<string, unknown>>;
      buildProgramTmAdjustments?: (
        stateBefore?: Record<string, unknown> | null,
        stateAfter?: Record<string, unknown> | null
      ) => Array<Record<string, unknown>>;
      resolveWorkoutProgramMeta?: (
        input?: IronforgeWorkoutProgramMetaInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutProgramMetaResult;
      buildWorkoutProgressionResult?: (
        input?: Record<string, unknown>,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutProgressionResult;
      buildWorkoutProgressionToast?: (
        input?: IronforgeWorkoutProgressionToastInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutToastPlan | null;
      buildWorkoutFinishPlan?: (
        input?: IronforgeWorkoutFinishPlanInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutFinishPlanResult | null;
      commitWorkoutFinishPersistence?: (
        input?: IronforgeWorkoutFinishPersistenceInput,
        deps?: Record<string, unknown>
      ) => Promise<void>;
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
      applyPostWorkoutOutcomeEffects?: (
        input?: IronforgeWorkoutPostOutcomeEffectsInput,
        deps?: Record<string, unknown>
      ) => Promise<void>;
      buildWorkoutStartPresentation?: (
        input?: IronforgeWorkoutStartPresentationInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutStartPresentationResult;
      buildSessionSummaryPromptState?: (
        input?: IronforgeWorkoutSummaryPromptInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutSummaryPromptState;
      clearWorkoutRestIntervalHost?: (
        deps?: IronforgeWorkoutRestHostDeps
      ) => void;
      clearWorkoutRestHideHost?: (
        deps?: IronforgeWorkoutRestHostDeps
      ) => void;
      scheduleWorkoutRestIntervalHost?: (
        callback: () => void,
        deps?: IronforgeWorkoutRestHostDeps
      ) => void;
      scheduleWorkoutRestHideHost?: (
        callback: () => void,
        delay?: number,
        deps?: IronforgeWorkoutRestHostDeps
      ) => void;
      buildWorkoutRestLifecyclePlan?: (
        input?: IronforgeWorkoutRestLifecycleInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutRestLifecyclePlan;
      buildWorkoutRestDisplayState?: (
        input?: IronforgeWorkoutRestDisplayInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutRestDisplayResult;
      buildWorkoutSessionSnapshot?: (
        input?: IronforgeWorkoutSessionSnapshotInput
      ) => IronforgeWorkoutSessionSnapshotResult;
      resolveWorkoutRestDuration?: (
        input?: IronforgeWorkoutRestTimerInput
      ) => number;
      restoreWorkoutRestTimer?: (
        input?: IronforgeWorkoutRestTimerInput
      ) => IronforgeWorkoutRestTimerResult;
      startWorkoutRestTimer?: (
        input?: IronforgeWorkoutRestTimerInput
      ) => IronforgeWorkoutRestTimerResult;
      syncWorkoutRestTimer?: (
        input?: IronforgeWorkoutRestTimerInput
      ) => IronforgeWorkoutRestTimerResult;
      completeWorkoutRestTimer?: (
        input?: IronforgeWorkoutRestTimerInput
      ) => IronforgeWorkoutRestTimerResult;
      skipWorkoutRestTimer?: (
        input?: IronforgeWorkoutRestTimerInput
      ) => IronforgeWorkoutRestTimerResult;
      buildWorkoutTeardownPlan?: (
        input?: IronforgeWorkoutTeardownPlanInput,
        deps?: Record<string, unknown>
      ) => IronforgeWorkoutTeardownPlanResult;
    };
    __IRONFORGE_WORKOUT_PERSISTENCE_RUNTIME__?: {
      persistLocalWorkoutsCache?: (input?: {
        userId?: string | null;
        currentUser?: Record<string, unknown> | null;
        workouts?: Array<Record<string, unknown>> | null;
      }) => boolean;
      saveWorkouts?: (input?: {
        userId?: string | null;
        currentUser?: Record<string, unknown> | null;
        workouts?: Array<Record<string, unknown>> | null;
      }) => boolean;
      upsertWorkoutRecord?: (
        input?: Record<string, unknown> | null,
        deps?: Record<string, unknown>
      ) => Promise<void>;
      upsertWorkoutRecords?: (
        input?: Record<string, unknown> | null,
        deps?: Record<string, unknown>
      ) => Promise<void>;
      softDeleteWorkoutRecord?: (
        input?: Record<string, unknown> | null,
        deps?: Record<string, unknown>
      ) => Promise<void>;
      replaceWorkoutTableSnapshot?: (
        input?: Record<string, unknown> | null,
        deps?: Record<string, unknown>
      ) => Promise<void>;
      pullWorkoutsFromTable?: (
        input?: Record<string, unknown> | null,
        deps?: Record<string, unknown>
      ) => Promise<{
        usedTable: boolean;
        didBackfill: boolean;
        workouts: Array<Record<string, unknown>>;
        shouldMarkWorkoutTableReady: boolean;
      }>;
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
      profile?: {
        getState?: () => any;
        updateProfile?: (patch: Record<string, unknown>) => any;
        setActiveProgram?: (programId: string | null) => string | null;
        setProgramState?: (
          programId: string,
          state: Record<string, unknown> | null
        ) => Record<string, unknown> | null;
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
        setActiveProgram?: (programId: string | null) => string | null;
        setProgramState?: (
          programId: string,
          state: Record<string, unknown> | null
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
