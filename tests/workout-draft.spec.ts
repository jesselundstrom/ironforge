import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { confirmModal, openAppShell, reloadAppShell } from './helpers';

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

test('active workout draft restores after reload', async ({ page }) => {
  test.slow();
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

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const activeWorkout =
            window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout;
          const firstSet = activeWorkout?.exercises?.[0]?.sets?.[0];
          return {
            hasActiveWorkout: !!activeWorkout,
            firstWeight: String(firstSet?.weight ?? ''),
          };
        }),
      { timeout: 15000 }
    )
    .toEqual({
      hasActiveWorkout: true,
      firstWeight: '60',
    });

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const inputs = Array.from(
            document.querySelectorAll<HTMLInputElement>(
              '#exercises-container input[data-field="weight"]'
            )
          );
          const visibleInput = inputs.find((input) => {
            const rect = input.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          return visibleInput?.value || '';
        }),
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
  await confirmModal(page);

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
