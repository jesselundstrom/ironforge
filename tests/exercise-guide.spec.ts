import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

declare let activeWorkout: Record<string, any> | null;

declare function buildWorkoutRewardState(...args: any[]): Record<string, unknown>;
declare function ensureWorkoutExerciseUiKeys(
  exercises: Array<Record<string, any>>
): Array<Record<string, any>>;
test('exercise guide modal shows specific bench guidance from the active workout', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const benchId =
      window.resolveRegisteredExerciseId?.('Bench Press') || 'bench-press';

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
                sets: [{ weight: 80, reps: 5, done: false, rpe: null }],
              },
            ])
          : [
              {
                name: 'Bench Press',
                exerciseId: benchId,
                sets: [{ weight: 80, reps: 5, done: false, rpe: null }],
              },
            ],
      startTime: Date.now() - 120000,
    };
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
    window.__IRONFORGE_STORES__?.workout?.resumeActiveWorkoutUI?.({
      toast: false,
    });
  });

  await expect(page.locator('.exercise-guide-open-btn')).toBeVisible();
  await page.locator('.exercise-guide-open-btn').click();

  await expect(page.locator('#exercise-guide-modal')).toHaveClass(/active/);
  await expect(page.locator('#exercise-guide-modal-title')).toHaveText('Bench Press');
  await expect(page.locator('#exercise-guide-modal-body')).toContainText('Setup');
  await expect(page.locator('#exercise-guide-modal-body')).toContainText('Execution');
  await expect(page.locator('#exercise-guide-modal-body')).toContainText('Key cues');
  await expect(page.locator('#exercise-guide-modal-body')).toContainText('Safety');
  await expect(page.locator('#exercise-guide-modal-body')).toContainText(
    'Same touch point every rep.'
  );
});
