import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('log start island renders from the legacy bridge and still starts a workout', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      resetNotStartedView();
      showPage('log', document.querySelectorAll('.nav-btn')[1]);
    `);
  });

  await expect(page.locator('#log-start-legacy-shell')).toHaveCount(0);
  await expect(page.locator('#log-start-react-root #workout-not-started')).toBeVisible();
  await expect(
    page.locator('#log-start-react-root #program-day-options .program-day-option').first()
  ).toBeVisible();

  await page.evaluate(() => {
    window.eval('startWorkout()');
  });

  await expect(page.locator('#workout-active')).toBeVisible();
  await expect(
    page.locator('#log-start-react-root').getByRole('button', { name: /start workout/i })
  ).toHaveCount(0);
});

test('log start island keeps sport readiness check-in interactions working', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      profile.preferences = normalizeTrainingPreferences({
        preferences: {
          ...(profile.preferences || {}),
          sportReadinessCheckEnabled: true
        }
      });
      resetNotStartedView();
      showPage('log', document.querySelectorAll('.nav-btn')[1]);
    `);
  });

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
