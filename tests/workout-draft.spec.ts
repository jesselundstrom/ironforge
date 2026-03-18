import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { confirmModal, openAppShell, reloadAppShell } from './helpers';

async function openTrainPage(page: Page) {
  await page.evaluate(() => {
    window.eval("showPage('log')");
    window.eval("window.runPageActivationSideEffects && window.runPageActivationSideEffects('log')");
    window.eval("if (activeWorkout) resumeActiveWorkoutUI({toast:false})");
  });

  await expect(page.locator('#page-log')).toHaveClass(/active/);
}

async function startWorkout(page: Page) {
  await openTrainPage(page);
  await expect(page.getByRole('button', { name: /start workout/i })).toBeVisible();
  await page.evaluate(() => {
    window.eval('startWorkout()');
    window.eval("if (activeWorkout) resumeActiveWorkoutUI({toast:false})");
  });
  await expect(page.locator('#workout-active')).toBeVisible();
}

test('active workout draft restores after reload', async ({ page }) => {
  await openAppShell(page);
  await startWorkout(page);

  const firstWeightInput = page.locator('#exercises-container input[data-field="weight"]').first();
  await firstWeightInput.fill('60');
  await firstWeightInput.evaluate((input: HTMLInputElement) => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
  });

  await reloadAppShell(page);
  await openTrainPage(page);

  await page.waitForFunction(() => window.eval('!!activeWorkout'));
  await page.evaluate(() => {
    window.eval("resumeActiveWorkoutUI({toast:false})");
  });
  await expect(page.locator('#workout-active')).toBeVisible();
  await expect(page.locator('#exercises-container input[data-field="weight"]').first()).toHaveValue('60');
});

test('finishing a workout clears the persisted draft', async ({ page }) => {
  await openAppShell(page);
  await startWorkout(page);

  expect(await page.evaluate(() => window.eval('Boolean(getActiveWorkoutDraftCache())'))).toBe(true);

  await page.evaluate(async () => {
    await window.eval(`
      (async () => {
        window.showRPEPicker = (_title, _index, cb) => cb(7);
        window.showSessionSummary = async () => {};
        await finishWorkout();
      })()
    `);
  });

  await expect(page.locator('#workout-not-started')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.eval('getActiveWorkoutDraftCache()')), {
      timeout: 15000,
    })
    .toBeNull();
});

test('discarding a workout clears the persisted draft', async ({ page }) => {
  await openAppShell(page);
  await startWorkout(page);

  expect(await page.evaluate(() => window.eval('Boolean(getActiveWorkoutDraftCache())'))).toBe(true);

  await page.getByRole('button', { name: /discard workout/i }).click({ force: true });
  await confirmModal(page);

  await expect(page.locator('#workout-not-started')).toBeVisible();
  expect(await page.evaluate(() => window.eval('getActiveWorkoutDraftCache()'))).toBeNull();
});
