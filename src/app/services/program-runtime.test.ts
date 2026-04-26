import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataStore } from '../../stores/data-store';
import { profileStore } from '../../stores/profile-store';
import { programStore } from '../../stores/program-store';
import {
  applyProgramDateCatchUp,
  cleanProgramOptionLabel,
  estimateTMsFromHistory,
  getActiveProgramState,
  getActiveProgramFrequencyMismatch,
  getProgramOptionDayNumber,
  getProgramFrequencyCompatibility,
  getProgramPreviewExerciseMeta,
  getProgramPreviewHeaderChips,
  getProgramTodayMuscleTags,
  getSuggestedProgramsForTrainingDays,
  openProgramExercisePicker,
  previewProgramSplit,
  recomputeProgramStateFromWorkouts,
  saveProgramSetup,
  setSLNextWorkout,
  switchProgram,
  updateForgeModeSetting,
  updateProgramLift,
  updateSLLift,
} from './program-runtime';

type MutableRecord = Record<string, unknown>;

function makeProgram(
  id: string,
  name: string,
  options: {
    range?: { min: number; max: number };
    score?: number;
    initialState?: MutableRecord;
    dateCatchUp?: (state: MutableRecord) => MutableRecord;
    saveSettings?: (state: MutableRecord) => MutableRecord;
    migrateState?: (state: MutableRecord) => MutableRecord;
    adjustAfterSession?: (
      exercises: MutableRecord[],
      state: MutableRecord,
      option?: unknown,
      context?: MutableRecord | null | undefined
    ) => MutableRecord;
    advanceState?: (
      state: MutableRecord,
      sessionsThisWeek?: number,
      context?: MutableRecord | null
    ) => MutableRecord;
    previewSplit?: (frequency: number, lifts?: unknown) => void;
    updateModeDesc?: (mode: string) => void;
  } = {}
) {
  return {
    id,
    name,
    description: `${name} description`,
    icon: id,
    getInitialState: () => ({
      ...(options.initialState || { week: 1 }),
    }),
    getCapabilities: () => ({
      frequencyRange: options.range || { min: 2, max: 6 },
      recommendationScore: () => options.score || 0,
    }),
    saveSettings: options.saveSettings,
    migrateState: options.migrateState,
    adjustAfterSession: options.adjustAfterSession,
    advanceState: options.advanceState,
    dateCatchUp: options.dateCatchUp,
    _previewSplit: options.previewSplit,
    _updateModeDesc: options.updateModeDesc,
  };
}

function setProgramRegistry(programs: Array<ReturnType<typeof makeProgram>>) {
  const registry = Object.fromEntries(
    programs.map((program) => [program.id, program])
  );
  programStore.setState((state) => ({
    ...state,
    registry: registry as never,
    programs: programs as never,
    activeProgramId: 'alpha',
    activeProgram: programs[0] as never,
    activeProgramState: null,
    syncFromLegacy: () => {
      const profile = profileStore.getState().profile as MutableRecord | null;
      const activeProgramId = String(profile?.activeProgram || 'alpha');
      const programsState =
        profile?.programs && typeof profile.programs === 'object'
          ? (profile.programs as MutableRecord)
          : {};
      const snapshot = {
        registry: registry as never,
        programs: programs as never,
        activeProgramId,
        activeProgram: (registry[activeProgramId] || programs[0]) as never,
        activeProgramState: (programsState[activeProgramId] as never) || null,
      };
      programStore.setState((current) => ({
        ...current,
        ...snapshot,
      }));
      return snapshot;
    },
  }));
}

function resetStores() {
  const profile = {
    activeProgram: 'alpha',
    preferences: {
      goal: 'strength',
      trainingDaysPerWeek: 3,
      sessionMinutes: 60,
      equipmentAccess: 'full_gym',
    },
    programs: {},
  };
  dataStore.setState((state) => ({
    ...state,
    workouts: [],
    profile,
    schedule: {},
  }));
  profileStore.setState((state) => ({
    ...state,
    profile: profile as never,
    schedule: {} as never,
  }));
  setProgramRegistry([
    makeProgram('alpha', 'Alpha', { range: { min: 2, max: 6 } }),
  ]);
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis as MutableRecord, 'window');
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetStores();
});

describe('program-runtime ownership', () => {
  it('computes frequency compatibility and clamps unsupported requested days', () => {
    setProgramRegistry([
      makeProgram('alpha', 'Alpha', { range: { min: 3, max: 4 } }),
    ]);

    const result = getProgramFrequencyCompatibility('alpha', {
      activeProgram: 'alpha',
      preferences: { trainingDaysPerWeek: 6 },
    });

    expect(result).toEqual({
      requested: 6,
      effective: 4,
      range: { min: 3, max: 4 },
      supportsExact: false,
    });
  });

  it('sorts suggested programs by recommendation score and then name', () => {
    setProgramRegistry([
      makeProgram('alpha', 'Alpha', { score: 1 }),
      makeProgram('beta', 'Beta', { score: 5 }),
      makeProgram('charlie', 'Aardvark', { score: 5 }),
    ]);

    const result = getSuggestedProgramsForTrainingDays(3, {
      preferences: { trainingDaysPerWeek: 3, goal: 'strength' },
    }).map((program) => program.id);

    expect(result).toEqual(['charlie', 'beta', 'alpha']);
  });

  it('returns active-program mismatch data with requested/effective labels and suggestions', () => {
    setProgramRegistry([
      makeProgram('alpha', 'Alpha', { range: { min: 2, max: 2 }, score: 1 }),
      makeProgram('beta', 'Beta', { range: { min: 4, max: 4 }, score: 5 }),
    ]);

    const result = getActiveProgramFrequencyMismatch({
      activeProgram: 'alpha',
      preferences: { trainingDaysPerWeek: 4 },
    });

    expect(result?.effective).toBe(2);
    expect(result?.requested).toBe(4);
    expect(result?.requestedLabel).toBe('4 sessions / week');
    expect(result?.effectiveLabel).toBe('2 sessions / week');
    expect(result?.suggestions.map((program) => program.id)).toEqual(['beta']);
  });

  it('estimates starting loads only after enough recent matching history exists', () => {
    setProgramRegistry([
      makeProgram('alpha', 'Alpha', {
        initialState: {
          rounding: 2.5,
          lifts: {
            main: [{ name: 'Squat' }, { name: 'Bench Press' }],
          },
        },
      }),
    ]);
    const now = Date.UTC(2026, 0, 15);
    const oneSession = [
      {
        id: 'w1',
        date: new Date(now - 864e5).toISOString(),
        exercises: [
          { name: 'Squat', sets: [{ done: true, weight: 120, reps: 5 }] },
          { name: 'Bench Press', sets: [{ done: true, weight: 100, reps: 5 }] },
        ],
      },
    ];
    const twoSessions = [
      ...oneSession,
      {
        id: 'w2',
        date: new Date(now - 2 * 864e5).toISOString(),
        exercises: [
          { name: 'Squat', sets: [{ done: true, weight: 115, reps: 5 }] },
          { name: 'Bench Press', sets: [{ done: true, weight: 95, reps: 5 }] },
        ],
      },
    ];

    expect(
      estimateTMsFromHistory('alpha', oneSession, { now: () => now })
    ).toEqual({});
    expect(
      estimateTMsFromHistory('alpha', twoSessions, { now: () => now })
    ).toEqual({
      Squat: 120,
      'Bench Press': 100,
    });
  });

  it('owns program start preview labels, exercise metadata, chips, and muscle tags', () => {
    const exercise = {
      name: 'Squat',
      rirCutoff: 2,
      sets: [
        { isWarmup: true, reps: 5, weight: 60 },
        { reps: 5, weight: 120 },
        { reps: 5, weight: 120 },
      ],
    };
    const prog = {
      id: 'alpha',
      name: 'Alpha',
      getBlockInfo: () => ({ pct: 85 }),
    };

    expect(cleanProgramOptionLabel('\u2b50 \u2705 Day 12')).toBe('Day 12');
    expect(getProgramOptionDayNumber({ value: 'day-3', label: 'Day 9' })).toBe(
      '3'
    );
    expect(getProgramOptionDayNumber({ value: 'auto', label: 'Day 9' })).toBe(
      '9'
    );
    expect(getProgramPreviewExerciseMeta(exercise)).toEqual({
      pattern: '2\u00d75',
      weight: '120 kg',
    });
    expect(
      getProgramPreviewHeaderChips(prog, { mode: 'rir' }, [exercise], null, {
        getProgramSessionBuildContext: () => ({ preview: true }),
      })
    ).toEqual(['85% 1RM', '2\u00d75', 'RIR 2']);
    expect(
      getProgramTodayMuscleTags({
        recentMuscleLoad: {
          legs: 9,
          chest: 5,
          back: 1,
          arms: 2,
        },
      })
    ).toEqual([
      { name: 'legs', level: 'high', label: 'high' },
      { name: 'chest', level: 'moderate', label: 'moderate' },
      { name: 'back', level: 'light', label: 'light' },
    ]);
  });

  it('switches programs by initializing missing state and applying date catch-up', () => {
    setProgramRegistry([
      makeProgram('alpha', 'Alpha'),
      makeProgram('beta', 'Beta', {
        initialState: { week: 1 },
        dateCatchUp: (state) => ({ ...state, week: 3 }),
      }),
    ]);
    profileStore.getState().setProfile({
      activeProgram: 'alpha',
      preferences: { trainingDaysPerWeek: 3 },
      programs: {},
    });

    const result = switchProgram('beta', {
      confirm: (_title, _message, onConfirm) => onConfirm(),
      saveProfileData: vi.fn(),
      initSettings: vi.fn(),
      updateDashboard: vi.fn(),
      showToast: vi.fn(),
      setTimeout: vi.fn(),
    });
    const profile = profileStore.getState().profile as MutableRecord;

    expect(result.switched).toBe(true);
    expect(profile.activeProgram).toBe('beta');
    expect((profile.programs as MutableRecord).beta).toEqual({ week: 3 });
  });

  it('preserves existing program state when switching to an initialized program', () => {
    setProgramRegistry([
      makeProgram('alpha', 'Alpha'),
      makeProgram('beta', 'Beta', { initialState: { week: 1 } }),
    ]);
    profileStore.getState().setProfile({
      activeProgram: 'alpha',
      preferences: { trainingDaysPerWeek: 3 },
      programs: {
        beta: { week: 8, marker: 'existing' },
      },
    });

    switchProgram('beta', {
      confirm: (_title, _message, onConfirm) => onConfirm(),
      saveProfileData: vi.fn(),
      initSettings: vi.fn(),
      updateDashboard: vi.fn(),
      showToast: vi.fn(),
      setTimeout: vi.fn(),
    });
    const profile = profileStore.getState().profile as MutableRecord;

    expect((profile.programs as MutableRecord).beta).toEqual({
      week: 8,
      marker: 'existing',
    });
  });

  it('owns advanced setup save and lift mutation actions', () => {
    const saveProfileData = vi.fn();
    const closeProgramSetupSheet = vi.fn();
    const updateProgramDisplay = vi.fn();
    const showToast = vi.fn();
    const initSettings = vi.fn();
    setProgramRegistry([
      makeProgram('alpha', 'Alpha', {
        initialState: {
          saved: false,
          lifts: {
            main: [{ name: 'Squat', tm: 100 }],
            squat: { weight: 90 },
          },
          nextWorkout: 'A',
        },
        saveSettings: (state) => ({ ...state, saved: true }),
      }),
    ]);
    profileStore.getState().setProfile({
      activeProgram: 'alpha',
      preferences: { trainingDaysPerWeek: 3 },
      programs: {
        alpha: {
          saved: false,
          lifts: {
            main: [{ name: 'Squat', tm: 100 }],
            squat: { weight: 90 },
          },
          nextWorkout: 'A',
        },
      },
    });

    saveProgramSetup({
      saveProfileData,
      closeProgramSetupSheet,
      updateProgramDisplay,
      showToast,
    });
    updateProgramLift('main', 0, 'tm', '123.44');
    updateSLLift('squat', '1000');
    setSLNextWorkout('B', { initSettings });

    const state = getActiveProgramState();
    expect(state.saved).toBe(true);
    expect(((state.lifts as MutableRecord).main as MutableRecord[])[0].tm).toBe(
      123.4
    );
    expect(((state.lifts as MutableRecord).squat as MutableRecord).weight).toBe(
      999
    );
    expect(state.nextWorkout).toBe('B');
    expect(saveProfileData).toHaveBeenCalledWith({ programIds: ['alpha'] });
    expect(closeProgramSetupSheet).toHaveBeenCalled();
    expect(updateProgramDisplay).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalled();
    expect(initSettings).toHaveBeenCalled();
  });

  it('owns exercise picker resolution and advanced setup preview helpers', () => {
    const onSelect = vi.fn();
    const openExerciseCatalogForSettings = vi.fn((config: MutableRecord) => {
      (config.onSelect as (exercise: MutableRecord) => void)({
        name: 'Resolved Bench',
      });
      return true;
    });
    const previewSplit = vi.fn();
    const updateModeDesc = vi.fn();
    setProgramRegistry([
      makeProgram('alpha', 'Alpha', {
        initialState: {
          daysPerWeek: 4,
          lifts: { main: [{ name: 'Squat', tm: 100 }] },
        },
        previewSplit,
        updateModeDesc,
      }),
    ]);
    profileStore.getState().setProfile({
      activeProgram: 'alpha',
      preferences: { trainingDaysPerWeek: 3 },
      programs: {
        alpha: {
          daysPerWeek: 4,
          lifts: { main: [{ name: 'Squat', tm: 100 }] },
        },
      },
    });

    expect(
      openProgramExercisePicker(
        {
          currentName: 'Bench',
          category: 'push',
          options: ['Fallback'],
          onSelect,
        },
        {
          resolveExerciseSelection: (input) => ({
            name: input === 'Bench' ? 'Bench Press' : 'Resolved Bench',
          }),
          openExerciseCatalogForSettings,
        }
      )
    ).toBe(true);
    expect(openExerciseCatalogForSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        exercise: { name: 'Bench Press' },
        swapInfo: expect.objectContaining({ category: 'push' }),
      })
    );
    expect(onSelect).toHaveBeenCalledWith('Resolved Bench', {
      name: 'Resolved Bench',
    });

    expect(
      previewProgramSplit({
        getElementValue: () => '5',
      })
    ).toBe(true);
    expect(previewSplit).toHaveBeenCalledWith(5, {
      main: [{ name: 'Squat', tm: 100 }],
    });
    expect(updateForgeModeSetting({ getElementValue: () => 'rir' })).toBe(true);
    expect(updateModeDesc).toHaveBeenCalledWith('rir');
  });

  it('recomputes program state from workout history with replay context and no warmup sets', () => {
    const adjustAfterSession = vi.fn(
      (
        exercises: MutableRecord[],
        state: MutableRecord,
        option,
        context?: MutableRecord | null
      ) => ({
        ...state,
        adjusted: Number(state.adjusted || 0) + 1,
        option,
        sawWarmup: (exercises[0].sets as MutableRecord[]).some(
          (set) => set.isWarmup
        ),
        daysPerWeek: (context?.programRuntime as MutableRecord)?.daysPerWeek,
      })
    );
    const advanceState = vi.fn((state: MutableRecord, sessionsThisWeek) => ({
      ...state,
      sessionsThisWeek,
      advanced: Number(state.advanced || 0) + 1,
    }));
    setProgramRegistry([
      makeProgram('alpha', 'Alpha', {
        initialState: { adjusted: 0, advanced: 0 },
        migrateState: (state) => ({ ...state, migrated: true }),
        adjustAfterSession,
        advanceState,
      }),
    ]);
    const monday = new Date(Date.UTC(2026, 0, 5));
    const workouts = [
      {
        id: 1,
        program: 'alpha',
        date: new Date(Date.UTC(2026, 0, 6)).toISOString(),
        programOption: 'day-1',
        programMeta: { daysPerWeek: 4 },
        exercises: [
          {
            name: 'Squat',
            sets: [
              { isWarmup: true, reps: 5, weight: 60 },
              { reps: 5, weight: 100 },
            ],
          },
        ],
      },
      {
        id: 2,
        program: 'alpha',
        date: new Date(Date.UTC(2026, 0, 7)).toISOString(),
        programOption: 'day-2',
        exercises: [{ name: 'Bench', sets: [{ reps: 5, weight: 80 }] }],
      },
    ];

    const state = recomputeProgramStateFromWorkouts('alpha', workouts, {
      getWeekStart: () => monday,
      getProgramSessionBuildContext: (input) => input || {},
    });

    expect(adjustAfterSession).toHaveBeenCalledTimes(2);
    expect(advanceState).toHaveBeenCalledTimes(2);
    expect(state).toEqual(
      expect.objectContaining({
        migrated: true,
        adjusted: 2,
        advanced: 2,
        option: 'day-2',
        sawWarmup: false,
        sessionsThisWeek: 2,
      })
    );
  });

  it('applies date catch-up as a typed compatibility action', () => {
    setProgramRegistry([
      makeProgram('alpha', 'Alpha', {
        dateCatchUp: (state) => ({ ...state, week: 9 }),
      }),
    ]);
    profileStore.getState().setProfile({
      activeProgram: 'alpha',
      preferences: { trainingDaysPerWeek: 3 },
      programs: { alpha: { week: 1 } },
    });

    expect(applyProgramDateCatchUp('alpha')).toBe(true);
    expect(getActiveProgramState()).toEqual({ week: 9 });
    expect(applyProgramDateCatchUp('missing')).toBe(false);
  });
});
