import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test.describe.configure({ mode: 'serial' });

test('log start island renders from the legacy bridge and still starts a workout', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.resetNotStartedView?.();
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
  });

  await expect(page.locator('#page-log')).toHaveClass(/active/);

  await expect(page.locator('#log-start-legacy-shell')).toHaveCount(0);
  await expect(page.locator('#log-start-react-root #workout-not-started')).toBeVisible();
  await expect(page.locator('#log-start-react-root #program-day-select')).toHaveCount(0);
  await expect(page.locator('#log-start-react-root #bonus-duration-select')).toHaveCount(0);
  await expect(
    page.locator('#log-start-react-root #program-day-options .program-day-option').first()
  ).toBeVisible();
  await expect(page.locator('#log-start-react-root .workout-setup-card')).toBeVisible();
  await expect(page.locator('#log-start-react-root .workout-decision-options')).toHaveCount(0);

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.startWorkout?.();
  });

  await expect(page.locator('#workout-active')).toBeVisible();
  await expect(
    page.locator('#log-start-react-root').getByRole('button', { name: /start workout/i })
  ).toHaveCount(0);
});

test('log start island uses explicit selection state when starting a different day', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.resetNotStartedView?.();
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
  });

  await expect(page.locator('#page-log')).toHaveClass(/active/);

  const targetSelection = await page.evaluate(() => {
    const options = Array.from(
      document.querySelectorAll('#program-day-options .program-day-option')
    );
    const index = options[1] ? 1 : 0;
    const target = options[index];
    return {
      index,
      value: target?.getAttribute('data-option-value') || '',
    };
  });

  await page
    .locator('#log-start-react-root #program-day-options .program-day-option')
    .nth(targetSelection.index)
    .click();

  await page.evaluate(() => {
    window.__IRONFORGE_STORES__?.workout?.startWorkout?.();
  });

  await expect(page.locator('#workout-active')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          String(
            window.__IRONFORGE_STORES__?.workout?.getState?.().activeWorkout
              ?.programOption || ''
          )
      )
    )
    .toBe(String(targetSelection.value));
});

test('log start island keeps sport readiness check-in interactions working', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    profile.preferences = normalizeTrainingPreferences({
      preferences: {
        ...(profile.preferences || {}),
        sportReadinessCheckEnabled: true,
      },
    });
    window.resetNotStartedView?.();
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('log');
  });

  await expect(page.locator('#page-log')).toHaveClass(/active/);

  await expect(page.locator('#log-start-react-root [data-sport-check-kind="level"]')).toHaveCount(3);

  await page
    .locator('#log-start-react-root [data-sport-check-kind="level"][data-sport-check-option="heavy"]')
    .click();

  await expect(
    page.locator('#log-start-react-root [data-sport-check-kind="timing"]').first()
  ).toBeVisible();
  await expect(
    page.locator('#log-start-react-root [data-sport-check-kind="level"][data-sport-check-option="heavy"]')
  ).toHaveClass(/active/);
});

test('workout start planner keeps queued toast ordering stable', async ({ page }) => {
  await openAppShell(page);

  const plan = await page.evaluate(() => {
    return window.__IRONFORGE_WORKOUT_RUNTIME__?.buildWorkoutStartPresentation?.(
      {
        activeWorkout: {
          exercises: [{ name: 'Squat' }],
        },
        title: 'Lower Body',
        programName: 'Forge',
        sessionDescription: 'Heavy lower focus',
        effectiveDecision: {
          action: 'train_light',
          restrictionFlags: ['avoid_heavy_legs'],
        },
        planningContext: {},
        startSnapshot: {
          changes: ['Reduce lower-body volume'],
          equipmentHint: 'Use dumbbells if racks are busy',
        },
        schedule: {
          sportName: 'Hockey',
          sportLegsHeavy: true,
        },
        legLifts: ['squat'],
        isSportDay: true,
        hadSportRecently: false,
        isDeload: false,
      },
      {
        t: (key: string, fallback: string, params?: Record<string, unknown>) => {
          if (!params) return fallback;
          return Object.entries(params).reduce(
            (text, [paramKey, value]) =>
              text.replace(`{${paramKey}}`, String(value ?? '')),
            fallback
          );
        },
        getWorkoutCommentaryState: () => ({ tone: 'caution' }),
        presentTrainingCommentary: () => ({ text: 'Take it lighter today' }),
        getWorkoutDecisionSummary: () => ({ title: 'Adjusted session plan' }),
        getTrainingToastColor: () => 'var(--orange)',
      }
    );
  });

  expect(plan?.immediateToast?.text).toBe('Forge');
  expect(plan?.queuedToasts?.map((toast: { text: string; delay?: number }) => ({
    text: toast.text,
    delay: toast.delay,
  }))).toEqual([
    { text: 'Take it lighter today', delay: 700 },
    { text: 'Reduce lower-body volume', delay: 1800 },
    { text: 'Use dumbbells if racks are busy', delay: 3500 },
    { text: 'Hockey legs - consider fewer sets or swapping day order', delay: 1500 },
  ]);
});
