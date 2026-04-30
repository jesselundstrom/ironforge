import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataStore } from './data-store';
import { workoutStore } from './workout-store';
import { useRuntimeStore } from '../app/store/runtime-store';

type TestWindow = Window & {
  activeWorkout?: Record<string, unknown> | null;
  startWorkout?: () => unknown;
  resumeActiveWorkoutUI?: (options?: Record<string, unknown>) => unknown;
  showToast?: ReturnType<typeof vi.fn>;
  showRPEPicker?: ReturnType<typeof vi.fn>;
  showSessionSummary?: ReturnType<typeof vi.fn>;
  I18N?: {
    t?: (
      key: string,
      params?: Record<string, unknown> | null,
      fallback?: string
    ) => string;
  };
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
  addEventListener?: typeof vi.fn;
  removeEventListener?: typeof vi.fn;
  getActiveWorkoutSession?: () => Record<string, unknown> | null;
  persistActiveWorkoutDraft?: ReturnType<typeof vi.fn>;
  renderActiveWorkoutPlanPanel?: ReturnType<typeof vi.fn>;
  renderExercises?: ReturnType<typeof vi.fn>;
  showCustomModal?: ReturnType<typeof vi.fn>;
  showShortenAdjustmentOptions?: ReturnType<typeof vi.fn>;
  showConfirm?: ReturnType<typeof vi.fn>;
  closeCustomModal?: ReturnType<typeof vi.fn>;
  ensureExerciseUiKey?: (exercise: Record<string, unknown>) => string | null;
  getSetInputId?: (
    uiKey: string,
    setIndex: number,
    field: string
  ) => string;
  isLogActiveIslandActive?: () => boolean;
  updateExerciseCard?: ReturnType<typeof vi.fn>;
  removeExerciseCard?: ReturnType<typeof vi.fn>;
  insertExerciseCard?: ReturnType<typeof vi.fn>;
  setExerciseCardCollapsed?: ReturnType<typeof vi.fn>;
  isExerciseComplete?: (exercise: Record<string, unknown>) => boolean;
  detectSetPr?: ReturnType<typeof vi.fn>;
  clearSetPr?: ReturnType<typeof vi.fn>;
  i18nText?: (key: string, fallback: string) => string;
  displayExerciseName?: (input: unknown) => string;
  getRegisteredExercise?: (input: unknown) => Record<string, unknown> | null;
  resolveRegisteredExerciseId?: (input: unknown) => string | null;
  getSuggested?: ReturnType<typeof vi.fn>;
  getActiveProgramState?: () => Record<string, unknown> | null;
  getActiveProgram?: () => Record<string, unknown> | null;
  setProgramState?: ReturnType<typeof vi.fn>;
  saveProfileData?: ReturnType<typeof vi.fn>;
  upsertWorkoutRecord?: ReturnType<typeof vi.fn>;
  saveWorkouts?: ReturnType<typeof vi.fn>;
  buildExerciseIndex?: ReturnType<typeof vi.fn>;
  inferDurationSignal?: ReturnType<typeof vi.fn>;
  buildTrainingCommentaryState?: (
    input?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  presentTrainingCommentary?: ReturnType<typeof vi.fn>;
  createTrainingCommentaryEvent?: (
    code: string,
    params?: Record<string, unknown>
  ) => Record<string, unknown> | null;
  applyWorkoutTeardownPlan?: ReturnType<typeof vi.fn>;
  __IRONFORGE_WORKOUT_RUNTIME__?: Partial<
    NonNullable<Window['__IRONFORGE_WORKOUT_RUNTIME__']>
  >;
  __IRONFORGE_LEGACY_RUNTIME_ACCESS__?: {
    read?: (name: string) => unknown;
    write?: ReturnType<typeof vi.fn>;
  };
};

function installTestWindow(overrides: Partial<TestWindow> = {}) {
  const testWindow = {
    location: {
      hash: '#/dashboard',
    },
    showToast: vi.fn(),
    I18N: {
      t: (_key, _params, fallback) => fallback || '',
    },
    ...overrides,
  } as TestWindow;
  (globalThis as Record<string, unknown>).window = testWindow;
  return testWindow;
}

function installWorkoutWindow(activeWorkout: Record<string, unknown>) {
  const persistActiveWorkoutDraft = vi.fn();
  const renderActiveWorkoutPlanPanel = vi.fn();
  const renderExercises = vi.fn();
  const showToast = vi.fn();
  return installTestWindow({
    activeWorkout,
    setTimeout,
    clearTimeout,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getActiveWorkoutSession: () => activeWorkout,
    persistActiveWorkoutDraft,
    renderActiveWorkoutPlanPanel,
    renderExercises,
    showToast,
    showRPEPicker: vi.fn((_exerciseName, _setNumber, callback) => callback(7)),
    showSessionSummary: vi.fn(async () => null),
    showCustomModal: vi.fn(),
    showShortenAdjustmentOptions: vi.fn(),
    showConfirm: vi.fn((_title, _message, onConfirm) => onConfirm()),
    closeCustomModal: vi.fn(),
    ensureExerciseUiKey: (exercise: Record<string, unknown>) => {
      exercise.uiKey = exercise.uiKey || `ui-${String(exercise.name || 'ex')}`;
      return String(exercise.uiKey);
    },
    getSetInputId: (uiKey: string, setIndex: number, field: string) =>
      `${uiKey}-${setIndex}-${field}`,
    isLogActiveIslandActive: () => false,
    updateExerciseCard: vi.fn(),
    removeExerciseCard: vi.fn(),
    insertExerciseCard: vi.fn(),
    setExerciseCardCollapsed: vi.fn(),
    isExerciseComplete: (exercise: Record<string, unknown>) =>
      Array.isArray(exercise.sets) &&
      exercise.sets.length > 0 &&
      exercise.sets.every((set) => set.done === true),
    detectSetPr: vi.fn(() => null),
    clearSetPr: vi.fn((_exercise, set) => {
      if (set) set.isPr = false;
    }),
    i18nText: (_key: string, fallback: string) => fallback,
    displayExerciseName: (input: unknown) => String(input || ''),
    getRegisteredExercise: (input: unknown) => {
      const key =
        typeof input === 'object'
          ? String((input as Record<string, unknown>).exerciseId || '')
          : String(input || '').toLowerCase();
      if (key === 'dumbbell_row' || key === 'dumbbell row') {
        return { id: 'dumbbell_row', name: 'Dumbbell Row' };
      }
      return null;
    },
    resolveRegisteredExerciseId: (input: unknown) => {
      const value = String(input || '').toLowerCase();
      return value === 'dumbbell row' || value === 'dumbbell_row'
        ? 'dumbbell_row'
        : null;
    },
    getSuggested: vi.fn(() => 42.5),
    getActiveProgram: () => ({ id: 'forge', name: 'Forge' }),
    getActiveProgramState: () => ({ rounding: 2.5 }),
    setProgramState: vi.fn(),
    saveProfileData: vi.fn(async () => {}),
    upsertWorkoutRecord: vi.fn(async () => {}),
    saveWorkouts: vi.fn(async () => {}),
    buildExerciseIndex: vi.fn(),
    inferDurationSignal: vi.fn(() => ''),
    buildTrainingCommentaryState: (input?: Record<string, unknown>) => ({
      version: 1,
      decisionCode: 'train',
      reasonCodes: [],
      restrictionFlags: [],
      adaptationEvents: [],
      equipmentHint: null,
      runnerEvents: [],
      ...(input || {}),
    }),
    presentTrainingCommentary: vi.fn(() => null),
    createTrainingCommentaryEvent: (code, params) => ({
      code,
      params: params || {},
    }),
    applyWorkoutTeardownPlan: vi.fn(),
    __IRONFORGE_LEGACY_RUNTIME_ACCESS__: {
      read: (name: string) =>
        name === 'activeWorkout' ? activeWorkout : undefined,
      write: vi.fn((_name: string, _value: unknown) => {}),
    },
  });
}

function installTestDocument() {
  (globalThis as Record<string, unknown>).document = {
    hidden: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getElementById: vi.fn(() => null),
  };
  (globalThis as Record<string, unknown>).HTMLInputElement =
    class HTMLInputElement {};
}

function resetStores() {
  dataStore.setState((state) => ({
    ...state,
    activeWorkout: null,
  }));
  useRuntimeStore.setState((state) => ({
    ...state,
    navigation: {
      ...state.navigation,
      activePage: 'dashboard',
    },
    workoutSession: {
      ...state.workoutSession,
      session: {
        ...state.workoutSession.session,
        activeWorkout: null,
      },
    },
  }));
  workoutStore.setState((state) => ({
    ...state,
    activeWorkout: null,
    hasActiveWorkout: false,
  }));
}

describe('workout store start boundary', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'window');
    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'document');
    Reflect.deleteProperty(
      globalThis as Record<string, unknown>,
      'HTMLInputElement'
    );
    vi.restoreAllMocks();
  });

  it('does not navigate when the legacy start delegate is unavailable', () => {
    const testWindow = installTestWindow();

    const result = workoutStore.getState().startWorkout();

    expect(result).toBeUndefined();
    expect(useRuntimeStore.getState().navigation.activePage).toBe('dashboard');
    expect(testWindow.location.hash).toBe('#/dashboard');
    expect(testWindow.showToast).toHaveBeenCalledWith(
      'Workout could not be started. Please reload and try again.',
      'var(--orange)'
    );
  });

  it('navigates only after the legacy delegate creates an active workout', () => {
    const testWindow = installTestWindow({
      startWorkout: vi.fn(() => {
        testWindow.activeWorkout = {
          id: 'workout-1',
          date: '2026-04-26',
          program: 'forge',
          type: 'training',
          exercises: [],
          startTime: 123,
        };
      }),
      resumeActiveWorkoutUI: vi.fn(),
    });

    const result = workoutStore.getState().startWorkout();

    expect(result).toBe(true);
    expect(testWindow.resumeActiveWorkoutUI).toHaveBeenCalledWith({
      toast: false,
    });
    expect(useRuntimeStore.getState().navigation.activePage).toBe('log');
    expect(workoutStore.getState().hasActiveWorkout).toBe(true);
  });

  it('keeps the user in place when the legacy start delegate throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const testWindow = installTestWindow({
      startWorkout: vi.fn(() => {
        throw new Error('start failed');
      }),
    });

    const result = workoutStore.getState().startWorkout();

    expect(result).toBe(false);
    expect(useRuntimeStore.getState().navigation.activePage).toBe('dashboard');
    expect(testWindow.showToast).toHaveBeenCalledWith(
      'Workout could not be started. Please reload and try again.',
      'var(--orange)'
    );
    expect(warnSpy).toHaveBeenCalled();
  });

  it('updates set values through typed mutation ownership', () => {
    const activeWorkout = {
      exercises: [
        {
          name: 'Bench',
          sets: [
            { weight: 60, reps: 5, done: false },
            { weight: 60, reps: 5, done: false },
          ],
        },
      ],
    };
    const runtimeWindow = installWorkoutWindow(activeWorkout);
    installTestDocument();

    workoutStore.getState().updateSet(0, 0, 'weight', '72.55');

    const exercise = activeWorkout.exercises[0] as Record<string, unknown>;
    const sets = exercise.sets as Array<Record<string, unknown>>;
    expect(sets[0].weight).toBe(72.6);
    expect(sets[1].weight).toBe(72.6);
    expect(runtimeWindow.persistActiveWorkoutDraft).toHaveBeenCalled();
  });

  it('toggles set completion and removes exercises without legacy action delegates', () => {
    const activeWorkout = {
      exercises: [
        { name: 'Bench', sets: [{ weight: 60, reps: 5, done: false }] },
        { name: 'Row', sets: [{ weight: 40, reps: 8, done: false }] },
      ],
    };
    const runtimeWindow = installWorkoutWindow(activeWorkout);
    installTestDocument();

    workoutStore.getState().toggleSet(0, 0);
    expect(
      ((activeWorkout.exercises[0] as Record<string, unknown>).sets as Array<
        Record<string, unknown>
      >)[0].done
    ).toBe(true);

    workoutStore.getState().removeExercise(1);
    expect(activeWorkout.exercises).toHaveLength(1);
    expect(runtimeWindow.showToast).toHaveBeenCalled();

    const undo = runtimeWindow.showToast?.mock.calls[0][2] as () => void;
    undo();
    expect(activeWorkout.exercises).toHaveLength(2);
    expect((activeWorkout.exercises[1] as Record<string, unknown>).name).toBe(
      'Row'
    );
  });

  it('owns set RIR prompt rendering and save mutation', () => {
    const activeWorkout = {
      programMode: 'rir',
      exercises: [
        {
          name: 'Squat',
          sets: [{ weight: 100, reps: 5, done: true }],
        },
      ],
    };
    const runtimeWindow = installWorkoutWindow(activeWorkout);
    installTestDocument();

    workoutStore.getState().showSetRIRPrompt(0, 0);

    expect(runtimeWindow.showCustomModal).toHaveBeenCalledWith(
      'Last set check-in',
      expect.stringContaining('data-rir-value="2"')
    );

    workoutStore.getState().applySetRIR(0, 0, '2');

    expect(
      ((activeWorkout.exercises[0] as Record<string, unknown>).sets as Array<
        Record<string, unknown>
      >)[0].rir
    ).toBe('2');
    expect(runtimeWindow.persistActiveWorkoutDraft).toHaveBeenCalled();
    expect(runtimeWindow.closeCustomModal).toHaveBeenCalled();
    expect(runtimeWindow.showToast).toHaveBeenCalledWith(
      'RIR saved',
      'var(--blue)'
    );
  });

  it('owns adding an exercise to the active workout from a catalog name', () => {
    const activeWorkout = {
      exercises: [{ name: 'Bench', sets: [{ weight: 60, reps: 5, done: false }] }],
    };
    const runtimeWindow = installWorkoutWindow(activeWorkout);
    installTestDocument();

    workoutStore.getState().addExerciseByName('Dumbbell Row');

    expect(activeWorkout.exercises).toHaveLength(2);
    expect((activeWorkout.exercises[1] as Record<string, unknown>).name).toBe(
      'Dumbbell Row'
    );
    expect(
      ((activeWorkout.exercises[1] as Record<string, unknown>).sets as Array<
        Record<string, unknown>
      >)[0].weight
    ).toBe(42.5);
    expect(runtimeWindow.persistActiveWorkoutDraft).toHaveBeenCalled();
    expect(runtimeWindow.insertExerciseCard).toHaveBeenCalledWith(
      1,
      activeWorkout.exercises[1]
    );
  });

  it('owns quick workout shorten mutations and undo', () => {
    const activeWorkout = {
      planningDecision: { action: 'train' },
      runnerState: { mode: 'train', adjustments: [] },
      exercises: [
        {
          name: 'Bench',
          sets: [
            { weight: 100, reps: 5, done: true },
            { weight: 100, reps: 5, done: false },
            { weight: 100, reps: 5, done: false },
            { weight: 100, reps: 5, done: false },
          ],
        },
        {
          name: 'Curls',
          isAccessory: true,
          sets: [
            { weight: 20, reps: 10, done: false },
            { weight: 20, reps: 10, done: false },
          ],
        },
      ],
    };
    const runtimeWindow = installWorkoutWindow(activeWorkout);
    installTestDocument();

    workoutStore
      .getState()
      .applyQuickWorkoutAdjustment('shorten', 'medium');

    expect(activeWorkout.exercises).toHaveLength(1);
    expect(
      ((activeWorkout.exercises[0] as Record<string, unknown>).sets as Array<
        Record<string, unknown>
      >)
    ).toHaveLength(2);
    expect(
      (activeWorkout.runnerState as Record<string, unknown>).mode
    ).toBe('shorten');
    expect(
      (activeWorkout.runnerState as Record<string, unknown>).undoSnapshot
    ).toBeTruthy();
    expect(runtimeWindow.persistActiveWorkoutDraft).toHaveBeenCalled();
    expect(runtimeWindow.renderExercises).toHaveBeenCalled();
    expect(runtimeWindow.showToast).toHaveBeenCalledWith(
      'Session shortened to the essential work',
      'var(--blue)'
    );

    workoutStore.getState().undoQuickWorkoutAdjustment();

    expect(activeWorkout.exercises).toHaveLength(2);
    expect(
      (activeWorkout.runnerState as Record<string, unknown>).undoSnapshot
    ).toBeUndefined();
    expect(
      ((activeWorkout.runnerState as Record<string, unknown>)
        .adjustments as Array<unknown>)
    ).toHaveLength(0);
    expect(runtimeWindow.showToast).toHaveBeenLastCalledWith(
      'Last adjustment undone',
      'var(--blue)'
    );
  });

  it('keeps quick adjustment modal and confirmation UI as delegates', () => {
    const activeWorkout = {
      exercises: [
        {
          name: 'Bench',
          sets: [
            { weight: 100, reps: 5, done: false },
            { weight: 100, reps: 5, done: false },
            { weight: 100, reps: 5, done: false },
          ],
        },
      ],
    };
    const runtimeWindow = installWorkoutWindow(activeWorkout);
    installTestDocument();

    workoutStore.getState().applyQuickWorkoutAdjustment('shorten');
    expect(runtimeWindow.showShortenAdjustmentOptions).toHaveBeenCalled();

    workoutStore.getState().applyQuickWorkoutAdjustment('lighten');
    expect(runtimeWindow.showConfirm).toHaveBeenCalledWith(
      'Go lighter this session?',
      expect.stringContaining('lowers the remaining load'),
      expect.any(Function)
    );
    expect(
      (((activeWorkout.exercises[0] as Record<string, unknown>).sets as Array<
        Record<string, unknown>
      >)[0].weight)
    ).toBe(95);
  });

  it('owns cancel workout teardown planning', () => {
    const activeWorkout = {
      exercises: [{ name: 'Bench', sets: [{ weight: 60, reps: 5, done: false }] }],
    };
    const runtimeWindow = installWorkoutWindow(activeWorkout);
    installTestDocument();
    const buildWorkoutTeardownPlan = vi.fn(() => ({
      showNotStarted: true,
      hideActive: true,
      resetNotStartedView: true,
      notifyLogActive: true,
      updateDashboard: true,
      discardToast: 'Workout discarded',
    }));
    runtimeWindow.__IRONFORGE_WORKOUT_RUNTIME__ = {
      buildWorkoutTeardownPlan,
    };

    workoutStore.getState().cancelWorkout();

    expect(buildWorkoutTeardownPlan).toHaveBeenCalledWith(
      { mode: 'cancel' },
      { t: expect.any(Function) }
    );
    expect(runtimeWindow.applyWorkoutTeardownPlan).toHaveBeenCalledWith(
      {
        showNotStarted: true,
        hideActive: true,
        resetNotStartedView: true,
        notifyLogActive: true,
        updateDashboard: true,
        discardToast: 'Workout discarded',
      },
      { showDiscardToast: true }
    );
  });

  it('owns finish workout orchestration through the typed runtime', async () => {
    const activeWorkout = {
      startTime: Date.now() - 90000,
      programLabel: 'Forge',
      exercises: [
        {
          name: 'Bench',
          exerciseId: 'bench',
          sets: [{ weight: 80, reps: 5, done: true }],
        },
      ],
      rewardState: {
        detectedPrs: [{ setKey: 'bench-0' }],
      },
    };
    const workouts: Array<Record<string, unknown>> = [];
    const runtimeWindow = installWorkoutWindow(activeWorkout);
    installTestDocument();
    const savedWorkout = { id: 'saved-1', date: '2026-04-30' };
    const finishPlan = {
      savedWorkout,
      summaryData: { duration: 90 },
      finishTeardownPlan: {
        showNotStarted: true,
        hideActive: true,
        resetNotStartedView: true,
        notifyLogActive: true,
        updateDashboard: true,
        discardToast: '',
      },
      advancedState: { week: 2 },
      newState: { week: 2 },
      progressionResult: {},
      progressionToast: null,
      programHookFailed: false,
      tmAdjustments: [],
      totalSets: 1,
      stateBeforeSession: {},
      progressionSourceState: {},
    };
    const sanitizeWorkoutExercisesForSave = vi.fn(
      (input?: Record<string, unknown>) =>
        (input?.exercises as Array<Record<string, unknown>>) || []
    );
    const buildWorkoutFinishPlan = vi.fn(() => finishPlan);
    const commitWorkoutFinishPersistence = vi.fn(
      async (
        input?: { workouts?: Array<Record<string, unknown>> | null },
        deps?: Record<string, unknown>
      ) => {
        input?.workouts?.push(savedWorkout);
        await (deps?.saveWorkouts as () => Promise<unknown>)?.();
        (deps?.buildExerciseIndex as () => void)?.();
      }
    );
    const buildPostWorkoutOutcome = vi.fn(() => ({
      shouldSaveWorkouts: false,
      tmAdjustmentToast: '',
      goToNutrition: false,
      nutritionContext: null,
      durationSignal: '',
    }));
    const applyPostWorkoutOutcomeEffects = vi.fn(async () => {});
    const writeLegacy = vi.fn((name: string, value: unknown) => {
      if (name === 'workouts') {
        workouts.splice(
          0,
          workouts.length,
          ...((value as Array<Record<string, unknown>>) || [])
        );
      }
    });
    runtimeWindow.__IRONFORGE_LEGACY_RUNTIME_ACCESS__ = {
      read: (name: string) => {
        if (name === 'activeWorkout') return activeWorkout;
        if (name === 'workouts') return workouts;
        return undefined;
      },
      write: writeLegacy,
    };
    runtimeWindow.__IRONFORGE_WORKOUT_RUNTIME__ = {
      sanitizeWorkoutExercisesForSave,
      buildWorkoutFinishPlan,
      commitWorkoutFinishPersistence,
      buildPostWorkoutOutcome,
      applyPostWorkoutOutcomeEffects,
    };
    runtimeWindow.showRPEPicker = vi.fn((_name, _set, callback) => callback(8));
    runtimeWindow.showSessionSummary = vi.fn(async () => ({
      feedback: 'good',
      notes: '',
      goToNutrition: false,
    }));

    const result = await workoutStore.getState().finishWorkout();

    expect(result).toBe(true);
    expect(sanitizeWorkoutExercisesForSave).toHaveBeenCalled();
    expect(buildWorkoutFinishPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        activeWorkout,
        sessionRPE: 8,
        prCount: 1,
      }),
      expect.objectContaining({
        parseLoggedRepCount: expect.any(Function),
      })
    );
    expect(commitWorkoutFinishPersistence).toHaveBeenCalled();
    expect(runtimeWindow.applyWorkoutTeardownPlan).toHaveBeenCalledWith(
      finishPlan.finishTeardownPlan,
      { renderTimer: true }
    );
    expect(runtimeWindow.showSessionSummary).toHaveBeenCalledWith(
      finishPlan.summaryData
    );
    expect(buildPostWorkoutOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        savedWorkout,
        summaryData: finishPlan.summaryData,
      }),
      expect.objectContaining({
        t: expect.any(Function),
      })
    );
    expect(applyPostWorkoutOutcomeEffects).toHaveBeenCalled();
    expect(runtimeWindow.saveWorkouts).toHaveBeenCalled();
    expect(runtimeWindow.buildExerciseIndex).toHaveBeenCalled();
    expect(workouts).toEqual([savedWorkout]);
  });

});
