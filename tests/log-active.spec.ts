import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { completeOnboardingForTests, openAppShell } from './helpers';

test.describe.configure({ mode: 'serial' });

async function openActiveWorkout(page: Page) {
  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
    window.__IRONFORGE_STORES__?.workout?.startWorkout?.();
  });

  await page.waitForFunction(() => (window as any).getActivePageName?.() === 'log');
  await page.waitForFunction(() => {
    const shell = document.querySelector('#log-active-react-root #workout-active');
    return (
      shell instanceof HTMLElement &&
      shell.style.display !== 'none' &&
      shell.querySelectorAll('.exercise-block').length > 0
    );
  });
}

test('log active page renders the active workout editor through the store seam', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);
  await openActiveWorkout(page);

  await expect(page.locator('#log-active-react-root .active-session-title')).toContainText(/\S+/);
  await expect
    .poll(() => page.locator('#log-active-react-root .exercise-block').count())
    .toBeGreaterThan(0);
});

test('log active page keeps set completion and rest timer controls working', async ({ page }) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);
  await openActiveWorkout(page);

  await expect(page.getByRole('button', { name: '3 min' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: '3 min' }).click({ force: true });
  await expect
    .poll(() =>
      page.evaluate(() => window.__IRONFORGE_STORES__?.workout?.getState?.().restDuration)
    )
    .toBe(180);

  const interactionResult = await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.toggleSet?.(0, 0);
    const state = window.__IRONFORGE_STORES__?.workout?.getState?.();
    return {
      restDuration: state?.restDuration,
      done: state?.activeWorkout?.exercises?.[0]?.sets?.[0]?.done,
    };
  });

  expect(interactionResult.restDuration).toBe(180);
  expect(interactionResult.done).toBe(true);
});

test('log active page keeps weight edits and done toggles in sync with the visible UI', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);
  await openActiveWorkout(page);

  const firstWeightInput = page.locator('#log-active-react-root input[data-field="weight"]').first();
  const firstToggle = page.locator('#log-active-react-root .set-check').first();

  await firstWeightInput.fill('67.5');
  await firstWeightInput.blur();
  await expect(firstWeightInput).toHaveValue('67.5');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          String(
            window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout
              ?.exercises?.[0]?.sets?.[0]?.weight ?? ''
          )
      )
    )
    .toBe('67.5');

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.toggleSet?.(0, 0);
  });
  await expect(firstToggle).toHaveClass(/done/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout
            ?.exercises?.[0]?.sets?.[0]?.done
      )
    )
    .toBe(true);

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.toggleSet?.(0, 0);
  });
  await expect(firstToggle).not.toHaveClass(/(^| )done( |$)/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout
            ?.exercises?.[0]?.sets?.[0]?.done
      )
    )
    .toBe(false);
});

test('log active page keeps add-set interactions flowing through the workout store seam', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);
  await openActiveWorkout(page);

  const firstExercise = page.locator('#log-active-react-root .exercise-block').first();
  const addSetButton = firstExercise.locator('button[data-action="add-set"]');
  const initialSetCount = await firstExercise.locator('input[data-field="weight"]').count();

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout?.exercises?.[0]
          ?.sets?.length || 0
      )
    )
    .toBe(initialSetCount);

  await addSetButton.click();

  await expect(
    firstExercise.locator('input[data-field="weight"]').nth(initialSetCount)
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout?.exercises?.[0]
            ?.sets?.length || 0
      )
    )
    .toBe(initialSetCount + 1);
});

test('log active page keeps add exercise flowing through the workout store seam', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);
  await openActiveWorkout(page);

  const beforeCount = await page.evaluate(
    () =>
      window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout
        ?.exercises?.length || 0
  );

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.addExerciseByName?.('Dumbbell Row');
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout
            ?.exercises?.length || 0
      )
    )
    .toBe(beforeCount + 1);
});
