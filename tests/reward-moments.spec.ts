import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

declare let workouts: Array<Record<string, any>>;
declare let profile: Record<string, any>;
declare let activeWorkout: Record<string, any> | null;
declare let upsertWorkoutRecord: (...args: any[]) => Promise<unknown>;
declare let saveWorkouts: (...args: any[]) => Promise<unknown>;
declare let saveProfileData: (...args: any[]) => Promise<unknown>;
declare let _lastTmSignature: string;
declare let _lastTmValues: Record<string, unknown>;

declare function buildExerciseIndex(): void;
declare function buildWorkoutRewardState(...args: any[]): Record<string, unknown>;
declare function ensureWorkoutExerciseUiKeys(
  exercises: Array<Record<string, any>>
): Array<Record<string, any>>;
declare function closeSummaryModal(goToNutrition?: boolean): void;
declare function renderHistory(): void;
declare function updateDashboard(): void;

test.describe.configure({ mode: 'serial' });

async function setupRewardSession(
  page: Page,
  options?: {
  priorWorkouts?: Array<Record<string, unknown>>;
  completedReps?: number;
  activeReps?: number;
  activeRpe?: number | null;
}
) {
  const next = options || {};
  await page.evaluate((seed) => {
    const priorWorkouts = Array.isArray(seed.priorWorkouts) ? seed.priorWorkouts : [];
    const completedReps = Number(seed.completedReps ?? 7);
    const activeReps = Number(seed.activeReps ?? 8);
    const activeRpe = seed.activeRpe ?? 8;

    const benchId = window.resolveRegisteredExerciseId?.('Bench Press') || 'bench-press';
    const forgeState = window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {};

    workouts = structuredClone(priorWorkouts);
    profile.activeProgram = 'forge';
    profile.programs = {
      ...(profile.programs || {}),
      forge: structuredClone(forgeState),
    };
    buildExerciseIndex();
    upsertWorkoutRecord = async () => {};
    saveWorkouts = async () => {};
    saveProfileData = async () => {};

    activeWorkout = {
      program: 'forge',
      type: 'forge',
      programOption: '1',
      programDayNum: 1,
      programLabel: 'Forge · Day 1',
      sessionDescription: 'Bench focus',
      rewardState: buildWorkoutRewardState(),
      exercises: ensureWorkoutExerciseUiKeys([
        {
          name: 'Bench Press',
          exerciseId: benchId,
          sets: [{ weight: 80, reps: activeReps, done: false, rpe: activeRpe }],
        },
      ]),
      startTime: Date.now(),
    };

    if (!priorWorkouts.length && completedReps > 0) {
      workouts = [
        {
          id: 1,
          date: '2026-03-10T09:00:00.000Z',
          program: 'forge',
          type: 'forge',
          programDayNum: 1,
          programLabel: 'Forge · Day 1',
          duration: 1800,
          rpe: 7,
          sets: 1,
          exercises: [
            {
              name: 'Bench Press',
              exerciseId: benchId,
              sets: [{ weight: 80, reps: completedReps, done: true, rpe: 8 }],
            },
          ],
        },
      ];
    }

    window.showRPEPicker = (_name, _setNum, cb) =>
      cb(typeof activeRpe === 'number' ? activeRpe : 8);
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
    window.__IRONFORGE_STORES__?.workout?.resumeActiveWorkoutUI?.({
      toast: false,
    });
  }, next);
}

test('live PR detection flows into the summary and history views', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAppShell(page);

  await setupRewardSession(page);

  await expect(page.locator('#log-active-react-root #workout-active')).toBeVisible();
  await expect(page.locator('#log-active-react-root .exercise-block')).toHaveCount(1);

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.toggleSet?.(0, 0);
  });
  await page.waitForFunction(() =>
    (document.getElementById('toast')?.textContent || '').includes('New PR!')
  );
  await expect(page.locator('#toast')).toContainText('New PR!');

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });

  await expect(page.locator('#summary-modal')).toHaveClass(/active/);
  await expect(page.locator('#summary-modal .summary-title')).toHaveText('SESSION FORGED');
  await page.waitForFunction(
    () =>
      (document.querySelector('.summary-stat-prs .summary-stat-value')?.textContent || '').trim() ===
      '1'
  );
  await expect(page.locator('.summary-stat-prs .summary-stat-value')).toHaveText('1');

  await page.evaluate(() => {
    closeSummaryModal();
  });

  await page.evaluate(() => {
    renderHistory();
  });

  await page.waitForFunction(() => {
    const badge = document.querySelector('.hist-pr-badge');
    return /new pr/i.test(badge?.textContent || '');
  });
});

test('summary coach note shows PR message when a PR is set', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAppShell(page);

  await setupRewardSession(page);

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.toggleSet?.(0, 0);
  });

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });

  await expect(page.locator('#summary-modal')).toHaveClass(/active/);
  await expect(page.locator('.summary-coach-note')).toBeVisible();
  await expect(page.locator('.summary-coach-note')).toContainText(/PR/i);

  await page.evaluate(() => {
    closeSummaryModal();
  });
});

test('summary coach note shows clean fallback when session completes without PRs or TM changes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAppShell(page);

  await setupRewardSession(page, {
    priorWorkouts: [],
    completedReps: 0,
    activeReps: 5,
    activeRpe: 7,
  });

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.toggleSet?.(0, 0);
  });

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });

  await expect(page.locator('#summary-modal')).toHaveClass(/active/);
  await expect(page.locator('.summary-coach-note')).toBeVisible();
  await expect(page.locator('.summary-coach-note')).not.toBeEmpty();

  await page.evaluate(() => {
    closeSummaryModal();
  });
});

test('dashboard rounds TM display to 0.5kg and ignores raw changes inside the same bucket', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const state = (window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {
      lifts: { main: [{ tm: 0 }, { tm: 0 }] },
    }) as Record<string, unknown> & {
      lifts: { main: Array<{ tm: number }> };
    };
    state.lifts.main[1].tm = 82.43;
    profile.activeProgram = 'forge';
    profile.programs = { ...(profile.programs || {}), forge: structuredClone(state) };
    _lastTmSignature = '';
    _lastTmValues = {};
    updateDashboard();
    profile.programs.forge.lifts.main[1].tm = 82.49;
    updateDashboard();
  });

  const benchCard = page.locator('.lift-stat').filter({ hasText: 'Bench Press' });
  await expect(benchCard.locator('.value')).toHaveText('82.5kg');
  await expect(benchCard).not.toHaveClass(/tm-updated/);
  await expect(benchCard.locator('.tm-delta-badge')).toHaveCount(0);
  await expect(benchCard.locator('.tm-digit-stack.is-changing')).toHaveCount(0);
});

test('dashboard shows rounded TM change state with rolling counter markers', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const state = (window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {
      lifts: { main: [{ tm: 0 }, { tm: 0 }] },
    }) as Record<string, unknown> & {
      lifts: { main: Array<{ tm: number }> };
    };
    profile.activeProgram = 'forge';
    profile.programs = { ...(profile.programs || {}), forge: structuredClone(state) };
    _lastTmSignature = '';
    _lastTmValues = {};
    updateDashboard();
    profile.programs.forge.lifts.main[1].tm = 82.74;
    updateDashboard();
  });

  await page.waitForFunction(() => {
    const cards = Array.from(document.querySelectorAll('.lift-stat'));
    const benchCard = cards.find((card) => /Bench Press/.test(card.textContent || ''));
    if (!(benchCard instanceof HTMLElement)) return false;
    return (
      benchCard.classList.contains('tm-updated') &&
      /\+2\.5/.test(benchCard.textContent || '') &&
      !!benchCard.querySelector('.tm-digit-stack.is-changing')
    );
  });
});

test('dashboard TM rounding does not change exercise prescriptions', async ({ page }) => {
  await openAppShell(page);

  const sessionSnapshot = await page.evaluate(() => {
    const state = (window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {
      lifts: { main: [{ tm: 0 }, { tm: 0 }] },
    }) as Record<string, unknown> & {
      lifts: { main: Array<{ tm: number }> };
    };
    const forgeProgram = (window.__IRONFORGE_E2E__?.program?.getById?.('forge') || {
      buildSession: () => [],
    }) as {
      buildSession: (
        option: string,
        programState: Record<string, unknown>,
        context: Record<string, unknown>
      ) => Array<any>;
    };
    state.lifts.main[1].tm = 82.43;
    const snapshotSession = (exercises: Array<any>) =>
      exercises.map((exercise) => ({
        name: exercise.name,
        prescribedWeight: exercise.prescribedWeight ?? null,
        firstSetWeight: exercise.sets?.[0]?.weight ?? null,
        firstSetReps: exercise.sets?.[0]?.reps ?? null,
      }));
    const before = snapshotSession(forgeProgram.buildSession('1', state, {}));

    profile.activeProgram = 'forge';
    profile.programs = { ...(profile.programs || {}), forge: structuredClone(state) };
    _lastTmSignature = '';
    _lastTmValues = {};
    updateDashboard();

    const after = snapshotSession(forgeProgram.buildSession('1', state, {}));

    return {
      before,
      after,
      storedBenchTm: profile.programs.forge.lifts.main[1].tm,
    };
  });

  expect(sessionSnapshot.before).toEqual(sessionSnapshot.after);
  expect(sessionSnapshot.storedBenchTm).toBe(82.43);
});
