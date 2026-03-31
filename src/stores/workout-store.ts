import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type {
  ActiveWorkout,
  WorkoutExercise,
  WorkoutRecord,
  WorkoutStartSnapshot,
} from '../domain/types';
import {
  normalizeActiveWorkout,
  normalizeWorkoutStartSnapshot,
} from '../domain/workout-helpers';
import { dataStore } from './data-store';
import { programStore } from './program-store';
import { profileStore } from './profile-store';
import { useRuntimeStore } from '../app/store/runtime-store';

type WorkoutStoreState = {
  activeWorkout: ActiveWorkout | null;
  startSnapshot: WorkoutStartSnapshot | null;
  hasActiveWorkout: boolean;
  restDuration: number;
  restEndsAt: number;
  restSecondsLeft: number;
  restTotal: number;
  refreshSnapshot: () => WorkoutStoreSnapshot;
  getStartSnapshot: () => WorkoutStartSnapshot | null;
  getCachedStartSnapshot: () => WorkoutStartSnapshot | null;
  clearStartSnapshot: () => void;
  startWorkout: (selectedOption?: string) => void;
  resumeActiveWorkoutUI: () => ActiveWorkout | null;
  updateRestDuration: (nextValue?: string | number | null) => void;
  startRestTimer: () => void;
  skipRest: () => void;
  addExerciseByName: (name: string) => void;
  selectExerciseCatalogExercise: (exerciseId: string) => void;
  showSetRIRPrompt: (exerciseIndex: number, setIndex: number) => void;
  applySetRIR: (
    exerciseIndex: number,
    setIndex: number,
    rirValue: string | number
  ) => void;
  toggleSet: (exerciseIndex: number, setIndex: number) => void;
  updateSet: (
    exerciseIndex: number,
    setIndex: number,
    field: string,
    value: string | number
  ) => void;
  addSet: (exerciseIndex: number) => void;
  removeExercise: (exerciseIndex: number) => void;
  finishWorkout: () => Promise<WorkoutRecord | null>;
  cancelWorkout: () => void;
};

type WorkoutStoreSnapshot = Omit<
  WorkoutStoreState,
  | 'refreshSnapshot'
  | 'getStartSnapshot'
  | 'getCachedStartSnapshot'
  | 'clearStartSnapshot'
  | 'startWorkout'
  | 'resumeActiveWorkoutUI'
  | 'updateRestDuration'
  | 'startRestTimer'
  | 'skipRest'
  | 'addExerciseByName'
  | 'selectExerciseCatalogExercise'
  | 'showSetRIRPrompt'
  | 'applySetRIR'
  | 'toggleSet'
  | 'updateSet'
  | 'addSet'
  | 'removeExercise'
  | 'finishWorkout'
  | 'cancelWorkout'
>;

let workoutStoreRef: StoreApi<WorkoutStoreState> | null = null;
let cachedStartSnapshot: WorkoutStartSnapshot | null = null;
let unsubscribeDataStore: (() => void) | null = null;

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function readWorkoutSnapshot(): WorkoutStoreSnapshot {
  const dataState = dataStore.getState();
  return {
    activeWorkout: normalizeActiveWorkout(dataState.activeWorkout),
    startSnapshot: normalizeWorkoutStartSnapshot(cachedStartSnapshot),
    hasActiveWorkout: !!dataState.activeWorkout,
    restDuration: Number(dataState.restDuration || 0),
    restEndsAt: Number(dataState.restEndsAt || 0),
    restSecondsLeft: Number(dataState.restSecondsLeft || 0),
    restTotal: Number(dataState.restTotal || 0),
  };
}

function refreshStoreSnapshot() {
  const snapshot = readWorkoutSnapshot();
  workoutStoreRef?.setState((state) => ({
    ...state,
    ...snapshot,
  }));
  return snapshot;
}

function getWeekStart(date = new Date()) {
  const next = new Date(date);
  const offset = (next.getDay() + 6) % 7;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - offset);
  return next;
}

function countSessionsThisWeek(workouts: WorkoutRecord[]) {
  const weekStart = getWeekStart(new Date());
  return workouts.filter((workout) => new Date(workout.date) >= weekStart).length;
}

function createWorkoutId() {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createExerciseSet(exercise?: WorkoutExercise) {
  const lastSet = exercise?.sets?.[exercise.sets.length - 1];
  return {
    weight: lastSet?.weight ?? '',
    reps: lastSet?.reps ?? '',
    done: false,
    rir: null,
    rpe: null,
  };
}

function setActiveWorkout(
  activeWorkout: ActiveWorkout | null,
  restOverrides?: {
    restDuration?: number;
    restTotal?: number;
    restEndsAt?: number;
    restSecondsLeft?: number;
  }
) {
  dataStore.getState().setActiveWorkoutState(activeWorkout, restOverrides);
  refreshStoreSnapshot();
}

function getSessionOption(selectedOption?: string) {
  if (selectedOption) return selectedOption;
  const program = programStore.getState().activeProgram;
  const state = programStore.getState().activeProgramState || {};
  const workouts = dataStore.getState().workouts || [];
  const schedule = profileStore.getState().schedule || null;
  const options =
    typeof program?.getSessionOptions === 'function'
      ? program.getSessionOptions(state as any, workouts, schedule as any)
      : [];
  return (
    options.find((option) => option.isRecommended)?.value ||
    options.find((option) => option.done !== true)?.value ||
    options[0]?.value ||
    '1'
  );
}

async function persistProgramStateAfterFinish(
  workout: ActiveWorkout,
  nextWorkouts: WorkoutRecord[]
) {
  const programId = String(workout.program || '').trim();
  if (!programId) return;
  const program = programStore.getState().getProgramById(programId);
  let nextProgramState = cloneJson(programStore.getState().activeProgramState || {}) || {};

  if (typeof program?.adjustAfterSession === 'function') {
    nextProgramState =
      program.adjustAfterSession(
        cloneJson(workout.exercises),
        cloneJson(nextProgramState),
        workout.programOption
      ) || nextProgramState;
  }

  if (typeof program?.advanceState === 'function') {
    nextProgramState =
      program.advanceState(
        cloneJson(nextProgramState),
        countSessionsThisWeek(nextWorkouts)
      ) || nextProgramState;
  }

  await dataStore.getState().updateProgramState(programId, nextProgramState);
}

export const workoutStore: StoreApi<WorkoutStoreState> =
  createStore<WorkoutStoreState>(() => ({
    ...readWorkoutSnapshot(),
    refreshSnapshot: () => refreshStoreSnapshot(),
    getStartSnapshot: () => normalizeWorkoutStartSnapshot(cachedStartSnapshot),
    getCachedStartSnapshot: () => normalizeWorkoutStartSnapshot(cachedStartSnapshot),
    clearStartSnapshot: () => {
      cachedStartSnapshot = null;
      refreshStoreSnapshot();
    },
    startWorkout: (selectedOption) => {
      const program = programStore.getState().activeProgram;
      const programId = programStore.getState().activeProgramId || 'forge';
      const programState = cloneJson(programStore.getState().activeProgramState || {}) || {};
      const sessionOption = getSessionOption(selectedOption);
      const exercises =
        typeof program?.buildSession === 'function'
          ? program.buildSession(sessionOption, cloneJson(programState) as any, {
              preview: false,
            })
          : [];
      const label =
        typeof program?.getSessionLabel === 'function'
          ? program.getSessionLabel(sessionOption, cloneJson(programState) as any, {
              preview: false,
            })
          : `Session ${sessionOption}`;

      const activeWorkout: ActiveWorkout = {
        id: createWorkoutId(),
        date: new Date().toISOString(),
        program: programId,
        type: 'training',
        programOption: sessionOption,
        programDayNum: Number.isFinite(Number(sessionOption))
          ? Number(sessionOption)
          : undefined,
        programLabel: label,
        programStateBefore: cloneJson(programState),
        exercises: cloneJson(exercises || []),
        startTime: Date.now(),
        startedAt: new Date().toISOString(),
        sessionDescription: label,
      };

      cachedStartSnapshot = {
        programId,
        selectedOption: sessionOption,
        exercises: cloneJson(exercises || []),
        sessionDescription: label,
        programLabel: label,
      };

      setActiveWorkout(activeWorkout, {
        restDuration: Number(profileStore.getState().profile?.defaultRest || 120),
        restTotal: 0,
        restEndsAt: 0,
        restSecondsLeft: 0,
      });
      useRuntimeStore.getState().navigateToPage('log');
    },
    resumeActiveWorkoutUI: () => normalizeActiveWorkout(dataStore.getState().activeWorkout),
    updateRestDuration: (nextValue) => {
      const restDuration = Math.max(0, Number(nextValue || 0));
      dataStore.getState().setActiveWorkoutState(
        normalizeActiveWorkout(dataStore.getState().activeWorkout),
        {
          restDuration,
          restTotal: restDuration,
          restEndsAt: restDuration > 0 ? Date.now() + restDuration * 1000 : 0,
          restSecondsLeft: restDuration,
        }
      );
      refreshStoreSnapshot();
    },
    startRestTimer: () => {
      const restDuration = Number(dataStore.getState().restDuration || 0);
      if (restDuration <= 0) return;
      dataStore.getState().setActiveWorkoutState(
        normalizeActiveWorkout(dataStore.getState().activeWorkout),
        {
          restDuration,
          restTotal: restDuration,
          restEndsAt: Date.now() + restDuration * 1000,
          restSecondsLeft: restDuration,
        }
      );
      refreshStoreSnapshot();
    },
    skipRest: () => {
      dataStore.getState().setActiveWorkoutState(
        normalizeActiveWorkout(dataStore.getState().activeWorkout),
        {
          restEndsAt: 0,
          restSecondsLeft: 0,
          restTotal: 0,
        }
      );
      refreshStoreSnapshot();
    },
    addExerciseByName: (name) => {
      const activeWorkout = normalizeActiveWorkout(dataStore.getState().activeWorkout);
      if (!activeWorkout) return;
      activeWorkout.exercises.push({
        name: String(name || '').trim(),
        sets: [createExerciseSet()],
      } as WorkoutExercise);
      setActiveWorkout(activeWorkout);
    },
    selectExerciseCatalogExercise: (exerciseId) => {
      workoutStore.getState().addExerciseByName(exerciseId);
    },
    showSetRIRPrompt: () => {},
    applySetRIR: (exerciseIndex, setIndex, rirValue) => {
      const activeWorkout = normalizeActiveWorkout(dataStore.getState().activeWorkout);
      const targetSet = activeWorkout?.exercises?.[exerciseIndex]?.sets?.[setIndex];
      if (!activeWorkout || !targetSet) return;
      targetSet.rir = rirValue;
      setActiveWorkout(activeWorkout);
    },
    toggleSet: (exerciseIndex, setIndex) => {
      const activeWorkout = normalizeActiveWorkout(dataStore.getState().activeWorkout);
      const targetSet = activeWorkout?.exercises?.[exerciseIndex]?.sets?.[setIndex];
      if (!activeWorkout || !targetSet) return;
      targetSet.done = !targetSet.done;
      if (targetSet.done) {
        workoutStore.getState().startRestTimer();
      } else {
        workoutStore.getState().skipRest();
      }
      setActiveWorkout(activeWorkout);
    },
    updateSet: (exerciseIndex, setIndex, field, value) => {
      const activeWorkout = normalizeActiveWorkout(dataStore.getState().activeWorkout);
      const targetSet = activeWorkout?.exercises?.[exerciseIndex]?.sets?.[setIndex];
      if (!activeWorkout || !targetSet) return;
      (targetSet as Record<string, unknown>)[field] = value;
      setActiveWorkout(activeWorkout);
    },
    addSet: (exerciseIndex) => {
      const activeWorkout = normalizeActiveWorkout(dataStore.getState().activeWorkout);
      const exercise = activeWorkout?.exercises?.[exerciseIndex];
      if (!activeWorkout || !exercise) return;
      exercise.sets.push(createExerciseSet(exercise) as any);
      setActiveWorkout(activeWorkout);
    },
    removeExercise: (exerciseIndex) => {
      const activeWorkout = normalizeActiveWorkout(dataStore.getState().activeWorkout);
      if (!activeWorkout) return;
      activeWorkout.exercises.splice(exerciseIndex, 1);
      setActiveWorkout(activeWorkout);
    },
    finishWorkout: async () => {
      const activeWorkout = normalizeActiveWorkout(dataStore.getState().activeWorkout);
      if (!activeWorkout) return null;
      const finishedWorkout: WorkoutRecord = {
        ...cloneJson(activeWorkout),
        duration: Math.max(
          0,
          Math.round((Date.now() - Number(activeWorkout.startTime || Date.now())) / 1000)
        ),
      } as WorkoutRecord;
      const nextWorkouts = [...cloneJson(dataStore.getState().workouts || []), finishedWorkout];
      await dataStore.getState().replaceWorkouts(nextWorkouts);
      await persistProgramStateAfterFinish(activeWorkout, nextWorkouts);
      cachedStartSnapshot = null;
      setActiveWorkout(null, {
        restEndsAt: 0,
        restSecondsLeft: 0,
        restTotal: 0,
      });
      useRuntimeStore.getState().showToast({
        message: 'Workout saved',
        variant: 'info',
      });
      return finishedWorkout;
    },
    cancelWorkout: () => {
      cachedStartSnapshot = null;
      setActiveWorkout(null, {
        restEndsAt: 0,
        restSecondsLeft: 0,
        restTotal: 0,
      });
    },
  }));

workoutStoreRef = workoutStore;

export function installWorkoutStore() {
  refreshStoreSnapshot();
  unsubscribeDataStore?.();
  unsubscribeDataStore = dataStore.subscribe(() => {
    refreshStoreSnapshot();
  });
}

export function getWorkoutStoreSnapshot() {
  return workoutStore.getState().refreshSnapshot();
}
