// @ts-nocheck
import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

declare let workouts: Array<Record<string, any>>;
declare let profile: Record<string, any>;
declare let activeWorkout: Record<string, any> | null;

declare function getDefaultTrainingPreferences(): Record<string, any>;
declare function normalizeTrainingPreferences(
  profileLike?: Record<string, any> | null
): Record<string, any>;
declare function resetNotStartedView(): void;
declare function getCachedWorkoutStartSnapshot(): Record<string, any> | null;
declare function setPendingSessionMode(mode: string): void;
declare function updateProgramDisplay(): void;
declare function cloneJson<T>(value: T): T;
declare function recomputeProgramStateFromWorkouts(programId: string): void;
declare function switchProgram(programId: string): void;

async function openTrainPage(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
    window.resetNotStartedView?.();
  });
}

test('gym basics preview stays locked to the started session', async ({ page }) => {
  await openAppShell(page);
  await openTrainPage(page);

  const result = await page.evaluate(() => {
    profile.preferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
      },
    });
    profile.activeProgram = 'casualfullbody';
    profile.programs.casualfullbody =
      window.__IRONFORGE_E2E__?.program?.getInitialState?.('casualfullbody');
    resetNotStartedView();
    const snapshot = getCachedWorkoutStartSnapshot();
    const previewNames = (snapshot?.exercises || []).map((exercise) => exercise.name);
    window.__IRONFORGE_STORES__?.workout?.startWorkout?.();
    const activeNames = (activeWorkout?.exercises || []).map((exercise) => exercise.name);
    window.__IRONFORGE_STORES__?.workout?.cancelWorkout?.();
    return { previewNames, activeNames };
  });

  expect(result.previewNames.length).toBeGreaterThan(0);
  expect(result.activeNames).toEqual(result.previewNames);
});

test('forge normal override on deload uses the previous build week for progression', async ({ page }) => {
  await openAppShell(page);
  await openTrainPage(page);

  const result = await page.evaluate(async () => {
    profile.preferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
        warmupSetsEnabled: false,
      },
    });
    profile.activeProgram = 'forge';
    profile.programs.forge = window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge');
    profile.programs.forge.week = 7;
    profile.programs.forge.mode = 'rir';
    resetNotStartedView();
    setPendingSessionMode('normal');
    updateProgramDisplay();
    const snapshot = getCachedWorkoutStartSnapshot();
    const tmBefore = profile.programs.forge.lifts.main[0].tm;
    window.showRPEPicker = (_title, _index, cb) => cb(7);
    window.showSessionSummary = async () => {};
    window.__IRONFORGE_STORES__?.workout?.startWorkout?.();
    activeWorkout.exercises.forEach((exercise) => {
      if (exercise.isAccessory) return;
      exercise.sets.forEach((set, idx) => {
        set.done = true;
        if (idx === exercise.sets.length - 1) set.rir = 3;
      });
    });
    await window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
    return {
      snapshotWeek: snapshot?.buildState?.week,
      storedBuildWeek: workouts[workouts.length - 1]?.programStateUsedForBuild?.week,
      tmBefore,
      tmAfter: profile.programs.forge.lifts.main[0].tm,
    };
  });

  expect(result.snapshotWeek).toBe(6);
  expect(result.storedBuildWeek).toBe(6);
  expect(result.tmAfter).toBeGreaterThan(result.tmBefore);
});

test('forge default deload stays light and does not apply normal-week progression', async ({ page }) => {
  await openAppShell(page);
  await openTrainPage(page);

  const result = await page.evaluate(async () => {
    profile.preferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
        warmupSetsEnabled: false,
      },
    });
    profile.activeProgram = 'forge';
    profile.programs.forge = window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge');
    profile.programs.forge.week = 7;
    profile.programs.forge.mode = 'rir';
    resetNotStartedView();
    updateProgramDisplay();
    const snapshot = getCachedWorkoutStartSnapshot();
    const tmBefore = profile.programs.forge.lifts.main[0].tm;
    window.showRPEPicker = (_title, _index, cb) => cb(7);
    window.showSessionSummary = async () => {};
    window.__IRONFORGE_STORES__?.workout?.startWorkout?.();
    activeWorkout.exercises.forEach((exercise) => {
      if (exercise.isAccessory) return;
      exercise.sets.forEach((set, idx) => {
        set.done = true;
        if (idx === exercise.sets.length - 1) set.rir = 3;
      });
    });
    await window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
    return {
      snapshotWeek: snapshot?.buildState?.week,
      storedBuildWeek: workouts[workouts.length - 1]?.programStateUsedForBuild?.week,
      tmBefore,
      tmAfter: profile.programs.forge.lifts.main[0].tm,
    };
  });

  expect(result.snapshotWeek).toBe(7);
  expect(result.storedBuildWeek).toBe(7);
  expect(result.tmAfter).toBe(result.tmBefore);
});

test('recomputing forge state from history matches the saved post-workout state', async ({ page }) => {
  await openAppShell(page);
  await openTrainPage(page);

  const result = await page.evaluate(async () => {
    profile.preferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
        warmupSetsEnabled: true,
      },
    });
    profile.activeProgram = 'forge';
    profile.programs.forge = window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge');
    profile.programs.forge.week = 6;
    profile.programs.forge.mode = 'sets';
    resetNotStartedView();
    updateProgramDisplay();
    window.showRPEPicker = (_title, _index, cb) => cb(7);
    window.showSessionSummary = async () => {};
    window.__IRONFORGE_STORES__?.workout?.startWorkout?.();
    activeWorkout.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        set.done = true;
      });
    });
    await window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
    const savedState = cloneJson(profile.programs.forge);
    const savedWorkout = cloneJson(workouts[workouts.length - 1]);
    workouts = workouts.filter((workout) => workout.id !== savedWorkout.id);
    recomputeProgramStateFromWorkouts('forge');
    workouts.push(savedWorkout);
    workouts.sort((left, right) => new Date(left.date) - new Date(right.date));
    recomputeProgramStateFromWorkouts('forge');
    return {
      savedState,
      recomputedState: cloneJson(profile.programs.forge),
    };
  });

  expect(result.recomputedState).toEqual(result.savedState);
});

test('wendler 531 three-day flow rotates four lifts before the scheme week advances', async ({ page }) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    const program = window.__IRONFORGE_E2E__?.program?.getById?.('wendler531');

    profile.preferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
      },
    });
    let state3 = program.migrateState(program.getInitialState());
    const order0 = program.getSessionOptions(state3, workouts).map((option) => option.value);
    state3 = program.advanceState(state3, 1);
    const order1 = program.getSessionOptions(state3, workouts).map((option) => option.value);
    state3 = program.advanceState(state3, 2);
    const order2 = program.getSessionOptions(state3, workouts).map((option) => option.value);
    state3 = program.advanceState(state3, 3);
    const order3 = program.getSessionOptions(state3, workouts).map((option) => option.value);
    const weekAfterThree = state3.week;
    state3 = program.advanceState(state3, 4);

    profile.preferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 2,
      },
    });
    let state2 = program.migrateState(program.getInitialState());
    state2 = program.advanceState(state2, 1);
    const week2AfterOne = state2.week;
    state2 = program.advanceState(state2, 2);
    const week2AfterTwo = state2.week;

    profile.preferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 4,
      },
    });
    let state4 = program.migrateState(program.getInitialState());
    state4 = program.advanceState(state4, 3);
    const week4AfterThree = state4.week;
    state4 = program.advanceState(state4, 4);

    return {
      order0,
      order1,
      order2,
      order3,
      weekAfterThree,
      weekAfterFour: state3.week,
      weekSessionIndexAfterFour: state3.weekSessionIndex,
      week2AfterOne,
      week2AfterTwo,
      week4AfterThree,
      week4AfterFour: state4.week,
    };
  });

  expect(result.order0).toEqual(['1', '2', '3', '4']);
  expect(result.order1).toEqual(['2', '3', '4', '1']);
  expect(result.order2).toEqual(['3', '4', '1', '2']);
  expect(result.order3).toEqual(['4', '1', '2', '3']);
  expect(result.weekAfterThree).toBe(1);
  expect(result.weekAfterFour).toBe(2);
  expect(result.weekSessionIndexAfterFour).toBe(0);
  expect(result.week2AfterOne).toBe(1);
  expect(result.week2AfterTwo).toBe(2);
  expect(result.week4AfterThree).toBe(1);
  expect(result.week4AfterFour).toBe(2);
});

test('switching to delayed calendar-based programs applies catch-up immediately', async ({ page }) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    const daysAgo = (count) =>
      new Date(Date.now() - count * 24 * 60 * 60 * 1000).toISOString();
    profile.programs.forge = {
      ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge'),
      week: 1,
      weekStartDate: daysAgo(15),
    };
    profile.programs.hypertrophysplit = {
      ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('hypertrophysplit'),
      week: 1,
      weekStartDate: daysAgo(15),
    };
    profile.activeProgram = 'wendler531';
    const originalConfirm = window.showConfirm;
    window.showConfirm = (_title, _message, onConfirm) => onConfirm();
    switchProgram('forge');
    const forgeWeek = profile.programs.forge.week;
    switchProgram('hypertrophysplit');
    const hypertrophyWeek = profile.programs.hypertrophysplit.week;
    window.showConfirm = originalConfirm;
    return { forgeWeek, hypertrophyWeek, activeProgram: profile.activeProgram };
  });

  expect(result.forgeWeek).toBeGreaterThan(1);
  expect(result.hypertrophyWeek).toBeGreaterThan(1);
  expect(result.activeProgram).toBe('hypertrophysplit');
});
