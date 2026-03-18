import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { openAppShell, reloadAppShell } from './helpers';

/**
 * Sets up a ready-to-finish workout state with seeded history and mocked saves.
 * Returns the benchId used for exercises.
 */
async function setupWorkoutState(page: Page, seedWorkouts: object[] = []) {
  await page.evaluate((seeds) => {
    const benchId = window.eval("EXERCISE_LIBRARY.resolveExerciseId('Bench Press')");
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));

    window.eval(`
      workouts = ${JSON.stringify(seeds)};
      profile.activeProgram = 'forge';
      profile.programs = { ...(profile.programs || {}), forge: ${JSON.stringify(forgeState)} };
      buildExerciseIndex();
      upsertWorkoutRecord = async () => {};
      saveProfileData = async () => {};
    `);

    window.eval(`
      activeWorkout = {
        program: 'forge',
        type: 'forge',
        programOption: '1',
        programDayNum: 1,
        programLabel: 'Forge · Day 1',
        sessionDescription: 'Bench focus',
        rewardState: typeof buildWorkoutRewardState === 'function' ? buildWorkoutRewardState() : {},
        exercises: typeof ensureWorkoutExerciseUiKeys === 'function'
          ? ensureWorkoutExerciseUiKeys([{
              name: 'Bench Press',
              exerciseId: '${benchId}',
              sets: [{ weight: 80, reps: 5, done: true, rpe: 7 }]
            }])
          : [{
              name: 'Bench Press',
              exerciseId: '${benchId}',
              sets: [{ weight: 80, reps: 5, done: true, rpe: 7 }]
            }],
        startTime: Date.now() - 3600000
      };
    `);

    window.showRPEPicker = (_name: string, _setNum: number, cb: (v: number) => void) => cb(7);
    window.showPage('log', document.querySelectorAll('.nav-btn')[1]);
    window.resumeActiveWorkoutUI({ toast: false });
  }, seedWorkouts);
}

function makeWorkout(id: number, daysAgo: number, overrides: Record<string, unknown> = {}) {
  const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return {
    id,
    date,
    program: 'forge',
    type: 'forge',
    programDayNum: 1,
    programLabel: 'Forge · Day 1',
    duration: 3600,
    rpe: 7,
    sets: 1,
    exercises: [{
      name: 'Bench Press',
      sets: [{ weight: 80, reps: 5, done: true }]
    }],
    ...overrides
  };
}

test('feedback capture: tap too_hard, verify on workout record', async ({ page }) => {
  await openAppShell(page);
  await setupWorkoutState(page);

  await page.evaluate(() => { window.finishWorkout(); });

  await expect(page.locator('#summary-modal')).toHaveClass(/active/);
  await expect(page.locator('.summary-feedback-btn')).toHaveCount(3);

  await page.evaluate(() => {
    window.eval("setSummaryFeedback('too_hard'); closeSummaryModal()");
  });

  const feedback = await page.evaluate(() => {
    const ws = window.eval('workouts');
    return ws[ws.length - 1]?.sessionFeedback;
  });
  expect(feedback).toBe('too_hard');
});

test('feedback survives reload', async ({ page }) => {
  await openAppShell(page);
  await setupWorkoutState(page);

  await page.evaluate(() => { window.finishWorkout(); });
  await expect(page.locator('#summary-modal')).toHaveClass(/active/);

  await page.evaluate(() => {
    window.eval("setSummaryFeedback('good'); closeSummaryModal()");
  });

  await reloadAppShell(page);

  const feedback = await page.evaluate(() => {
    const ws = window.eval('workouts');
    return ws[ws.length - 1]?.sessionFeedback;
  });
  expect(feedback).toBe('good');
});

test('duration signal: long session infers too_long', async ({ page }) => {
  await openAppShell(page);
  await setupWorkoutState(page);

  // Override startTime to simulate an 80-minute session (target is 60 min)
  await page.evaluate(() => {
    window.eval('activeWorkout.startTime = Date.now() - 80 * 60 * 1000');
  });

  await page.evaluate(() => { window.finishWorkout(); });
  await expect(page.locator('#summary-modal')).toHaveClass(/active/);
  await page.evaluate(() => {
    window.eval('closeSummaryModal()');
  });

  const signal = await page.evaluate(() => {
    const ws = window.eval('workouts');
    return ws[ws.length - 1]?.durationSignal;
  });
  expect(signal).toBe('too_long');
});

test('2-of-3 too_hard biases decision toward train_light', async ({ page }) => {
  await openAppShell(page);

  const seeds = [
    makeWorkout(1, 5, { sessionFeedback: 'good' }),
    makeWorkout(2, 3, { sessionFeedback: 'too_hard' }),
    makeWorkout(3, 1, { sessionFeedback: 'too_hard' })
  ];

  await page.evaluate((workoutSeeds) => {
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));
    window.eval(`
      workouts = ${JSON.stringify(workoutSeeds)};
      profile.activeProgram = 'forge';
      profile.programs = { ...(profile.programs || {}), forge: ${JSON.stringify(forgeState)} };
    `);
  }, seeds);

  const result = await page.evaluate(() => {
    return window.eval('(function(){ var d = getTodayTrainingDecision(buildPlanningContext({})); return { action: d.action, reasonCodes: d.reasonCodes }; })()')
  });

  expect(result.reasonCodes).toContain('session_feedback_hard');
  expect(['train_light', 'shorten']).toContain(result.action);
});

test('one good session after too_hard streak clears the bias', async ({ page }) => {
  await openAppShell(page);

  const seeds = [
    makeWorkout(1, 7, { sessionFeedback: 'too_hard' }),
    makeWorkout(2, 5, { sessionFeedback: 'too_hard' }),
    makeWorkout(3, 1, { sessionFeedback: 'good' })
  ];

  await page.evaluate((workoutSeeds) => {
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));
    window.eval(`
      workouts = ${JSON.stringify(workoutSeeds)};
      profile.activeProgram = 'forge';
      profile.programs = { ...(profile.programs || {}), forge: ${JSON.stringify(forgeState)} };
    `);
  }, seeds);

  const result = await page.evaluate(() => {
    return window.eval('(function(){ var d = getTodayTrainingDecision(buildPlanningContext({})); return { action: d.action, reasonCodes: d.reasonCodes }; })()')
  });

  expect(result.reasonCodes).not.toContain('session_feedback_hard');
});

test('duration friction biases decision toward shorten', async ({ page }) => {
  await openAppShell(page);

  const seeds = [
    makeWorkout(1, 6, { durationSignal: 'on_target' }),
    makeWorkout(2, 4, { durationSignal: 'too_long' }),
    makeWorkout(3, 2, { durationSignal: 'too_long' }),
    makeWorkout(4, 1, { durationSignal: 'on_target' })
  ];

  await page.evaluate((workoutSeeds) => {
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));
    window.eval(`
      workouts = ${JSON.stringify(workoutSeeds)};
      profile.activeProgram = 'forge';
      profile.programs = { ...(profile.programs || {}), forge: ${JSON.stringify(forgeState)} };
    `);
  }, seeds);

  const result = await page.evaluate(() => {
    return window.eval('(function(){ var d = getTodayTrainingDecision(buildPlanningContext({})); return { action: d.action, reasonCodes: d.reasonCodes }; })()')
  });

  expect(result.reasonCodes).toContain('duration_friction');
});

test('dashboard coach card renders reason chips when reasons exist', async ({ page }) => {
  await openAppShell(page);

  // Seed workouts with too_hard feedback to trigger reason chips on dashboard
  const seeds = [
    makeWorkout(1, 3, { sessionFeedback: 'too_hard' }),
    makeWorkout(2, 1, { sessionFeedback: 'too_hard' })
  ];

  await page.evaluate((workoutSeeds) => {
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));
    window.eval(`
      workouts = ${JSON.stringify(workoutSeeds)};
      profile.activeProgram = 'forge';
      profile.programs = { ...(profile.programs || {}), forge: ${JSON.stringify(forgeState)} };
      updateDashboard();
    `);
  }, seeds);

  await page.waitForFunction(() => {
    window.eval("typeof updateDashboard === 'function' && updateDashboard()");
    return document.querySelectorAll('.dashboard-plan-coach-chip').length > 0;
  });
});
