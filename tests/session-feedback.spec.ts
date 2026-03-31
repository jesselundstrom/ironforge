import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

async function seedForgeTrainingCore(
  page: Page,
  options?: {
    workouts?: Array<Record<string, unknown>>;
    trainingDaysPerWeek?: number;
  }
) {
  const next = options || {};
  await page.evaluate(async (seed) => {
    const forgeState =
      window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {};
    const currentProfile =
      (window.profile as Record<string, unknown> | null) || {};
    const currentPreferences =
      currentProfile.preferences &&
      typeof currentProfile.preferences === 'object'
        ? (currentProfile.preferences as Record<string, unknown>)
        : {};

    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: Array.isArray(seed.workouts) ? seed.workouts : [],
      profile: {
        ...currentProfile,
        activeProgram: 'forge',
        preferences: {
          ...currentPreferences,
          trainingDaysPerWeek: Number(seed.trainingDaysPerWeek || 3),
        },
        programs: {
          ...((currentProfile.programs as Record<string, unknown>) || {}),
          forge: structuredClone(forgeState),
        },
      },
      schedule: (window.schedule as Record<string, unknown> | null) || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
  }, next);
}

async function startForgeWorkout(page: Page, startedSecondsAgo = 60 * 60) {
  await page.evaluate((secondsAgo) => {
    window.__IRONFORGE_STORES__?.workout?.startWorkout?.();
    const dataState = window.__IRONFORGE_STORES__?.data?.getState?.();
    const activeWorkout = structuredClone(dataState?.activeWorkout || null);
    if (!activeWorkout) return;
    activeWorkout.startTime = Date.now() - Number(secondsAgo || 0) * 1000;
    dataState?.setActiveWorkoutState?.(activeWorkout, {
      restDuration: Number(dataState?.restDuration || 120),
      restEndsAt: 0,
      restSecondsLeft: 0,
      restTotal: 0,
    });
  }, startedSecondsAgo);
}

function makeWorkout(
  id: number,
  daysAgo: number,
  overrides: Record<string, unknown> = {}
) {
  const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return {
    id,
    date,
    program: 'forge',
    type: 'forge',
    programDayNum: 1,
    programLabel: 'Forge Day 1',
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

test('feedback metadata saves onto the finished workout record', async ({ page }) => {
  await openAppShell(page);
  await seedForgeTrainingCore(page);
  await startForgeWorkout(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.workout?.completeSession?.({
      feedback: 'too_hard',
    });
  });

  await expect
    .poll(() => page.evaluate(() => workouts[workouts.length - 1]?.sessionFeedback || null))
    .toBe('too_hard');
});

test('feedback metadata survives a fresh data reload', async ({ page }) => {
  await openAppShell(page);
  await seedForgeTrainingCore(page);
  await startForgeWorkout(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.workout?.completeSession?.({
      feedback: 'good',
    });
  });

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.app?.loadData?.({
      allowCloudSync: false,
      userId: window.__IRONFORGE_TEST_USER_ID__ || 'e2e-user',
    });
  });

  await expect
    .poll(() =>
      page.evaluate(
        () => {
          const raw = localStorage.getItem('if2_workouts::e2e-user');
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
              ? parsed[parsed.length - 1]?.sessionFeedback || null
              : null;
          } catch {
            return null;
          }
        }
      )
    )
    .toBe('good');
});

test('session notes persist onto the workout record and history card', async ({ page }) => {
  await openAppShell(page);
  await seedForgeTrainingCore(page);
  await startForgeWorkout(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.workout?.completeSession?.({
      notes: 'Left shoulder felt tight on the descent.',
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
    window.renderHistory?.();
  });

  await expect
    .poll(() => page.evaluate(() => workouts[workouts.length - 1]?.sessionNotes || null))
    .toBe('Left shoulder felt tight on the descent.');
  await expect(page.locator('.hist-session-notes')).toContainText(
    'Left shoulder felt tight on the descent'
  );
});

test('long sessions store a too_long duration signal', async ({ page }) => {
  await openAppShell(page);
  await seedForgeTrainingCore(page);
  await startForgeWorkout(page, 80 * 60);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.workout?.completeSession?.({
      inferDurationSignal: true,
    });
  });

  await expect
    .poll(() => page.evaluate(() => workouts[workouts.length - 1]?.durationSignal || null))
    .toBe('too_long');
});

test('dashboard coaching shows the felt hard signal when recent sessions skew too hard', async ({
  page,
}) => {
  await openAppShell(page);
  await seedForgeTrainingCore(page, {
    trainingDaysPerWeek: 6,
    workouts: [
      makeWorkout(1, 5, { sessionFeedback: 'good' }),
      makeWorkout(2, 3, { sessionFeedback: 'too_hard' }),
      makeWorkout(3, 1, { sessionFeedback: 'too_hard' }),
    ],
  });

  const decision = await page.evaluate(() => {
    return window.__IRONFORGE_E2E__?.planning?.getTodayDecision?.() || null;
  });
  expect(decision?.reasonCodes || []).toContain('session_feedback_hard');
  expect(['train_light', 'shorten']).toContain(String(decision?.action || ''));
});

test('dashboard coaching clears the felt hard signal after a good recent session', async ({
  page,
}) => {
  await openAppShell(page);
  await seedForgeTrainingCore(page, {
    trainingDaysPerWeek: 6,
    workouts: [
      makeWorkout(1, 7, { sessionFeedback: 'too_hard' }),
      makeWorkout(2, 5, { sessionFeedback: 'too_hard' }),
      makeWorkout(3, 1, { sessionFeedback: 'good' }),
    ],
  });

  const decision = await page.evaluate(() => {
    return window.__IRONFORGE_E2E__?.planning?.getTodayDecision?.() || null;
  });
  expect(decision?.reasonCodes || []).not.toContain('session_feedback_hard');
});

test('dashboard coaching shows the running long signal when recent sessions trend too long', async ({
  page,
}) => {
  await openAppShell(page);
  await seedForgeTrainingCore(page, {
    workouts: [
      makeWorkout(1, 14, { durationSignal: 'on_target' }),
      makeWorkout(2, 12, { durationSignal: 'too_long' }),
      makeWorkout(3, 10, { durationSignal: 'too_long' }),
      makeWorkout(4, 8, { durationSignal: 'on_target' }),
    ],
  });

  const decision = await page.evaluate(() => {
    return window.__IRONFORGE_E2E__?.planning?.getTodayDecision?.() || null;
  });
  expect(decision?.reasonCodes || []).toContain('duration_friction');
});
