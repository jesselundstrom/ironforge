import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import {
  completeOnboardingForTests,
  openAppShell,
} from './helpers';

test.describe.configure({ mode: 'serial' });

async function openTrainPage(page: Page) {
  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
    if (window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout) {
      window.__IRONFORGE_STORES__?.workout?.resumeActiveWorkoutUI?.({
        toast: false,
      });
    }
  });

  await expect(page.locator('#page-log')).toHaveClass(/active/);
}

async function startWorkout(page: Page) {
  await openTrainPage(page);
  await completeOnboardingForTests(page);
  await expect(page.getByRole('button', { name: /start workout/i })).toBeVisible();
  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.startWorkout?.();
    if (window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout) {
      window.__IRONFORGE_STORES__?.workout?.resumeActiveWorkoutUI?.({
        toast: false,
      });
    }
  });
  await expect(page.locator('#workout-active')).toBeVisible();
}

test('active workout updates the persisted draft cache while the session is live', async ({
  page,
}) => {
  await openAppShell(page);
  await startWorkout(page);

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.updateSet?.(0, 0, 'weight', '60');
  });
  await expect(
    page.locator('#log-active-react-root input[data-field="weight"]').first()
  ).toHaveValue('60');
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            String(
              window.__IRONFORGE_STORES__?.data?.getActiveWorkoutDraftCache?.()
                ?.activeWorkout?.exercises?.[0]?.sets?.[0]?.weight ?? ''
            )
        ),
      { timeout: 15000 }
    )
    .toBe('60');
});

test('finishing a workout clears the persisted draft', async ({ page }) => {
  test.slow();
  await openAppShell(page);
  await startWorkout(page);

  expect(
    await page.evaluate(
      () =>
        !!window.__IRONFORGE_STORES__?.data?.getActiveWorkoutDraftCache?.()
    )
  ).toBe(true);

  await page.evaluate(async () => {
    window.showRPEPicker = (_title, _index, cb) => cb(7);
    window.showSessionSummary = async () => {};
    await window.__IRONFORGE_STORES__?.workout?.finishWorkout?.();
  });

  await expect(page.locator('#workout-not-started')).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__IRONFORGE_STORES__?.data?.getActiveWorkoutDraftCache?.()
        ),
      {
        timeout: 15000,
      }
    )
    .toBeNull();
});

test('discarding a workout clears the persisted draft', async ({ page }) => {
  await openAppShell(page);
  await startWorkout(page);

  expect(
    await page.evaluate(
      () =>
        !!window.__IRONFORGE_STORES__?.data?.getActiveWorkoutDraftCache?.()
    )
  ).toBe(true);

  await page.getByRole('button', { name: /discard workout/i }).click({ force: true });

  await page.waitForFunction(
    () => !window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout
  );
  await expect(page.locator('#workout-not-started')).toBeVisible();
  await expect(page.locator('#workout-active')).toBeHidden();
  await expect(page.getByRole('button', { name: /start workout/i })).toBeVisible();
  expect(
    await page.evaluate(
      () => window.__IRONFORGE_STORES__?.data?.getActiveWorkoutDraftCache?.()
    )
  ).toBeNull();
});
