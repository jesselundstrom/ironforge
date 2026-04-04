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
    const nextPreferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
      },
    });
    window.__IRONFORGE_E2E__?.profile?.update?.({
      preferences: nextPreferences,
    });
    window.__IRONFORGE_E2E__?.profile?.setActiveProgram?.('casualfullbody');
    window.__IRONFORGE_E2E__?.profile?.setProgramState?.(
      'casualfullbody',
      window.__IRONFORGE_E2E__?.program?.getInitialState?.('casualfullbody')
    );
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
    const nextPreferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
        warmupSetsEnabled: false,
      },
    });
    window.__IRONFORGE_E2E__?.profile?.update?.({
      preferences: nextPreferences,
    });
    window.__IRONFORGE_E2E__?.profile?.setActiveProgram?.('forge');
    window.__IRONFORGE_E2E__?.profile?.setProgramState?.('forge', {
      ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge'),
      week: 7,
      mode: 'rir',
    });
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
    const nextPreferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
        warmupSetsEnabled: false,
      },
    });
    window.__IRONFORGE_E2E__?.profile?.update?.({
      preferences: nextPreferences,
    });
    window.__IRONFORGE_E2E__?.profile?.setActiveProgram?.('forge');
    window.__IRONFORGE_E2E__?.profile?.setProgramState?.('forge', {
      ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge'),
      week: 7,
      mode: 'rir',
    });
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
    const nextPreferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
        warmupSetsEnabled: true,
      },
    });
    window.__IRONFORGE_E2E__?.profile?.update?.({
      preferences: nextPreferences,
    });
    window.__IRONFORGE_E2E__?.profile?.setActiveProgram?.('forge');
    window.__IRONFORGE_E2E__?.profile?.setProgramState?.('forge', {
      ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge'),
      week: 6,
      mode: 'sets',
    });
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
    window.__IRONFORGE_E2E__?.profile?.setProgramState?.('forge', {
      ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge'),
      week: 1,
      weekStartDate: daysAgo(15),
    });
    window.__IRONFORGE_E2E__?.profile?.setProgramState?.('hypertrophysplit', {
      ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('hypertrophysplit'),
      week: 1,
      weekStartDate: daysAgo(15),
    });
    window.__IRONFORGE_E2E__?.profile?.setActiveProgram?.('wendler531');
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

test('store-owned active program changes keep program store and legacy snapshot aligned', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.profile?.setProgramState?.(
      'stronglifts5x5',
      {
        ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('stronglifts5x5'),
        testWeek: 9,
      }
    );
    window.__IRONFORGE_E2E__?.profile?.setActiveProgram?.('stronglifts5x5');

    const programState = window.__IRONFORGE_E2E__?.program?.getState?.() || null;

    return {
      activeProgramId: programState?.activeProgramId || null,
      activeProgramStateWeek: programState?.activeProgramState?.testWeek || null,
      legacyActiveProgram: window.profile?.activeProgram || null,
      legacyActiveProgramStateWeek:
        window.profile?.programs?.stronglifts5x5?.testWeek || null,
    };
  });

  expect(result.activeProgramId).toBe('stronglifts5x5');
  expect(result.activeProgramStateWeek).toBe(9);
  expect(result.legacyActiveProgram).toBe('stronglifts5x5');
  expect(result.legacyActiveProgramStateWeek).toBe(9);
});

test('program store derives from the canonical profile store instead of stray legacy program mutations', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.profile?.setProgramState?.('forge', {
      ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge'),
      week: 4,
      testMarker: 'typed-owner',
    });
    window.__IRONFORGE_E2E__?.profile?.setActiveProgram?.('forge');

    window.__IRONFORGE_LEGACY_RUNTIME_ACCESS__?.write?.('profile', {
      ...(window.__IRONFORGE_GET_LEGACY_RUNTIME_STATE?.()?.profile || {}),
      activeProgram: 'stronglifts5x5',
      programs: {
        ...((window.__IRONFORGE_GET_LEGACY_RUNTIME_STATE?.()?.profile || {}).programs || {}),
        forge: {
          week: 99,
          testMarker: 'stale-legacy',
        },
      },
    });

    const profileState = window.__IRONFORGE_STORES__?.profile?.getState?.().profile || null;
    const programState = window.__IRONFORGE_E2E__?.program?.getState?.() || null;

    return {
      canonicalActiveProgram: profileState?.activeProgram || null,
      canonicalWeek: profileState?.programs?.forge?.week || null,
      canonicalMarker: profileState?.programs?.forge?.testMarker || null,
      derivedActiveProgram: programState?.activeProgramId || null,
      derivedWeek: programState?.activeProgramState?.week || null,
      derivedMarker: programState?.activeProgramState?.testMarker || null,
      legacyActiveProgram: window.profile?.activeProgram || null,
      legacyWeek: window.profile?.programs?.forge?.week || null,
      legacyMarker: window.profile?.programs?.forge?.testMarker || null,
    };
  });

  expect(result.canonicalActiveProgram).toBe('forge');
  expect(result.canonicalWeek).toBe(4);
  expect(result.canonicalMarker).toBe('typed-owner');
  expect(result.derivedActiveProgram).toBe('forge');
  expect(result.derivedWeek).toBe(4);
  expect(result.derivedMarker).toBe('typed-owner');
  expect(result.legacyActiveProgram).toBe('stronglifts5x5');
  expect(result.legacyWeek).toBe(99);
  expect(result.legacyMarker).toBe('stale-legacy');
});
