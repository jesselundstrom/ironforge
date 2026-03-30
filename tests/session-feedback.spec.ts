import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { openAppShell, reloadAppShell } from './helpers';

declare let workouts: Array<Record<string, any>>;
declare let profile: Record<string, any>;
declare let activeWorkout: Record<string, any> | null;
declare let currentUser: Record<string, unknown> | null;
declare let upsertWorkoutRecord: (...args: any[]) => Promise<unknown>;
declare let saveProfileData: (...args: any[]) => Promise<unknown>;

declare function buildExerciseIndex(): void;
declare function buildWorkoutRewardState(...args: any[]): Record<string, unknown>;
declare function ensureWorkoutExerciseUiKeys(
  exercises: Array<Record<string, any>>
): Array<Record<string, any>>;
declare function setSummaryFeedback(value: string): void;
declare function closeSummaryModal(goToNutrition?: boolean): void;
declare function renderHistory(): void;
declare function normalizeTrainingPreferences(
  profileLike?: Record<string, any> | null
): Record<string, any>;
declare function buildPlanningContext(
  input?: Record<string, unknown>
): Record<string, any>;
declare function getTodayTrainingDecision(
  context?: Record<string, unknown> | null
): { action: string; reasonCodes: string[] };
declare function updateDashboard(): void;

/**
 * Sets up a ready-to-finish workout state with seeded history and mocked saves.
 */
async function setupWorkoutState(page: Page, seedWorkouts: object[] = []) {
  await page.evaluate((seeds) => {
    const benchId =
      window.resolveRegisteredExerciseId?.('Bench Press') || 'bench-press';
    const forgeState =
      window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {};

    workouts = structuredClone(seeds);
    profile.activeProgram = 'forge';
    profile.programs = {
      ...(profile.programs || {}),
      forge: structuredClone(forgeState),
    };
    buildExerciseIndex();
    upsertWorkoutRecord = async () => {};
    saveProfileData = async () => {};

    activeWorkout = {
      program: 'forge',
      type: 'forge',
      programOption: '1',
      programDayNum: 1,
      programLabel: 'Forge · Day 1',
      sessionDescription: 'Bench focus',
      rewardState:
        typeof buildWorkoutRewardState === 'function' ? buildWorkoutRewardState() : {},
      exercises:
        typeof ensureWorkoutExerciseUiKeys === 'function'
          ? ensureWorkoutExerciseUiKeys([
              {
                name: 'Bench Press',
                exerciseId: benchId,
                sets: [{ weight: 80, reps: 5, done: true, rpe: 7 }],
              },
            ])
          : [
              {
                name: 'Bench Press',
                exerciseId: benchId,
                sets: [{ weight: 80, reps: 5, done: true, rpe: 7 }],
              },
            ],
      startTime: Date.now() - 3600000,
    };

    window.showRPEPicker = (
      _name: string,
      _setNum: number,
      cb: (v: number) => void
    ) => cb(7);
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
    window.__IRONFORGE_STORES__?.workout?.resumeActiveWorkoutUI?.({
      toast: false,
    });
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
    exercises: [
      {
        name: 'Bench Press',
        sets: [{ weight: 80, reps: 5, done: true }],
      },
    ],
    ...overrides,
  };
}

test('feedback capture: tap too_hard, verify on workout record', async ({ page }) => {
  await openAppShell(page);
  await setupWorkoutState(page);

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });

  await expect(page.locator('#summary-modal')).toHaveClass(/active/);
  await expect(page.locator('.summary-feedback-btn')).toHaveCount(3);

  await page.evaluate(() => {
    setSummaryFeedback('too_hard');
    closeSummaryModal();
  });

  const feedback = await page.evaluate(() => workouts[workouts.length - 1]?.sessionFeedback);
  expect(feedback).toBe('too_hard');
});

test('feedback survives reload', async ({ page }) => {
  await openAppShell(page);
  await setupWorkoutState(page);

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });
  await expect(page.locator('#summary-modal')).toHaveClass(/active/);

  await page.evaluate(() => {
    setSummaryFeedback('good');
    closeSummaryModal();
  });

  await reloadAppShell(page);

  const feedback = await page.evaluate(() => workouts[workouts.length - 1]?.sessionFeedback);
  expect(feedback).toBe('good');
});

test('summary notes persist onto the workout record and history card', async ({ page }) => {
  await openAppShell(page);
  await setupWorkoutState(page);

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });
  await expect(page.locator('#summary-modal')).toHaveClass(/active/);

  await page.locator('#summary-notes-textarea').fill('Left shoulder felt tight on the descent.');
  await page.evaluate(() => {
    closeSummaryModal();
  });

  const saved = await page.evaluate(() => workouts[workouts.length - 1]?.sessionNotes || null);
  expect(saved).toBe('Left shoulder felt tight on the descent.');

  await page.evaluate(() => {
    renderHistory();
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
  });
  await expect(page.locator('.hist-session-notes')).toContainText(
    'Left shoulder felt tight on the descent'
  );
});

test('post-workout nutrition nudge appears for a signed-in user and routes into nutrition', async ({
  page,
}) => {
  await openAppShell(page);
  await setupWorkoutState(page);

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });
  await expect(page.locator('#summary-modal')).toHaveClass(/active/);
  await expect(page.locator('.summary-nutrition-action')).toBeVisible();

  await page.locator('#summary-notes-textarea').fill('Quick post-workout note.');
  await page.locator('.summary-nutrition-action').click({ force: true });

  await expect(page.locator('#page-nutrition')).toHaveClass(/active/);

  const saved = await page.evaluate(() => workouts[workouts.length - 1]?.sessionNotes || null);
  expect(saved).toBe('Quick post-workout note.');
});

test('post-workout nutrition nudge stays hidden when signed out', async ({ page }) => {
  await openAppShell(page);
  await setupWorkoutState(page);

  await page.evaluate(() => {
    currentUser = null;
  });

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });
  await expect(page.locator('#summary-modal')).toHaveClass(/active/);
  await expect(page.locator('.summary-nutrition-action')).toHaveCount(0);
});

test('duration signal: long session infers too_long', async ({ page }) => {
  await openAppShell(page);
  await setupWorkoutState(page);

  await page.evaluate(() => {
    if (activeWorkout) activeWorkout.startTime = Date.now() - 80 * 60 * 1000;
  });

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });
  await expect(page.locator('#summary-modal')).toHaveClass(/active/);
  await page.evaluate(() => {
    closeSummaryModal();
  });

  const signal = await page.evaluate(() => workouts[workouts.length - 1]?.durationSignal);
  expect(signal).toBe('too_long');
});

test('2-of-3 too_hard biases decision toward train_light', async ({ page }) => {
  await openAppShell(page);

  const seeds = [
    makeWorkout(1, 5, { sessionFeedback: 'good' }),
    makeWorkout(2, 3, { sessionFeedback: 'too_hard' }),
    makeWorkout(3, 1, { sessionFeedback: 'too_hard' }),
  ];

  await page.evaluate((workoutSeeds) => {
    const forgeState =
      window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {};
    workouts = structuredClone(workoutSeeds);
    profile.preferences = normalizeTrainingPreferences({
      ...profile,
      preferences: {
        ...profile.preferences,
        trainingDaysPerWeek: 6,
      },
    });
    profile.activeProgram = 'forge';
    profile.programs = {
      ...(profile.programs || {}),
      forge: structuredClone(forgeState),
    };
  }, seeds);

  const result = await page.evaluate(() => {
    const decision = getTodayTrainingDecision(buildPlanningContext({}));
    return { action: decision.action, reasonCodes: decision.reasonCodes };
  });

  expect(result.reasonCodes).toContain('session_feedback_hard');
  expect(['train_light', 'shorten']).toContain(result.action);
});

test('one good session after too_hard streak clears the bias', async ({ page }) => {
  await openAppShell(page);

  const seeds = [
    makeWorkout(1, 7, { sessionFeedback: 'too_hard' }),
    makeWorkout(2, 5, { sessionFeedback: 'too_hard' }),
    makeWorkout(3, 1, { sessionFeedback: 'good' }),
  ];

  await page.evaluate((workoutSeeds) => {
    const forgeState =
      window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {};
    workouts = structuredClone(workoutSeeds);
    profile.activeProgram = 'forge';
    profile.programs = {
      ...(profile.programs || {}),
      forge: structuredClone(forgeState),
    };
  }, seeds);

  const result = await page.evaluate(() => {
    const decision = getTodayTrainingDecision(buildPlanningContext({}));
    return { action: decision.action, reasonCodes: decision.reasonCodes };
  });

  expect(result.reasonCodes).not.toContain('session_feedback_hard');
});

test('duration friction biases decision toward shorten', async ({ page }) => {
  await openAppShell(page);

  const seeds = [
    makeWorkout(1, 14, { durationSignal: 'on_target' }),
    makeWorkout(2, 12, { durationSignal: 'too_long' }),
    makeWorkout(3, 10, { durationSignal: 'too_long' }),
    makeWorkout(4, 8, { durationSignal: 'on_target' }),
  ];

  await page.evaluate((workoutSeeds) => {
    const forgeState =
      window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {};
    workouts = structuredClone(workoutSeeds);
    profile.activeProgram = 'forge';
    profile.programs = {
      ...(profile.programs || {}),
      forge: structuredClone(forgeState),
    };
  }, seeds);

  const result = await page.evaluate(() => {
    const decision = getTodayTrainingDecision(buildPlanningContext({}));
    return { action: decision.action, reasonCodes: decision.reasonCodes };
  });

  expect(result.reasonCodes).toContain('duration_friction');
});

test('dashboard coach card renders reason chips when reasons exist', async ({ page }) => {
  await openAppShell(page);

  const seeds = [
    makeWorkout(1, 3, { sessionFeedback: 'too_hard' }),
    makeWorkout(2, 1, { sessionFeedback: 'too_hard' }),
  ];

  await page.evaluate((workoutSeeds) => {
    const forgeState =
      window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {};
    workouts = structuredClone(workoutSeeds);
    profile.activeProgram = 'forge';
    profile.programs = {
      ...(profile.programs || {}),
      forge: structuredClone(forgeState),
    };
    updateDashboard();
  }, seeds);

  await page.waitForFunction(() => {
    if (typeof updateDashboard === 'function') updateDashboard();
    return document.querySelectorAll('.dashboard-plan-coach-chip').length > 0;
  });
});
