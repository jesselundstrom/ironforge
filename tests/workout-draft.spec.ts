import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { bootstrapAppShell, confirmModal, openAppShell } from './helpers';

async function openTrainPage(page: Page) {
  await page.evaluate(() => {
    window.eval("showPage('log')");
  });

  await expect(page.locator('#page-log')).toHaveClass(/active/);
}

async function startWorkout(page: Page) {
  await openTrainPage(page);
  await expect(page.getByRole('button', { name: /start workout/i })).toBeVisible();
  await page.evaluate(() => {
    window.eval('startWorkout()');
  });
  await expect(page.locator('#workout-active')).toBeVisible();
}

test('active workout draft restores after reload', async ({ page }) => {
  await openAppShell(page);
  await startWorkout(page);

  const firstWeightInput = page.locator('#exercises-container input[data-field="weight"]').first();
  await firstWeightInput.fill('60');
  await firstWeightInput.blur();

  await page.reload();
  await bootstrapAppShell(page);
  await openTrainPage(page);

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
  expect(await page.evaluate(() => window.eval('getActiveWorkoutDraftCache()'))).toBeNull();
});

test('discarding a workout clears the persisted draft', async ({ page }) => {
  await openAppShell(page);
  await startWorkout(page);

  expect(await page.evaluate(() => window.eval('Boolean(getActiveWorkoutDraftCache())'))).toBe(true);

  await page.getByRole('button', { name: /discard workout/i }).click();
  await confirmModal(page);

  await expect(page.locator('#workout-not-started')).toBeVisible();
  expect(await page.evaluate(() => window.eval('getActiveWorkoutDraftCache()'))).toBeNull();
});
