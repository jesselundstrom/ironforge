import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

async function openActiveWorkout(page: Page) {
  await page.evaluate(() => {
    window.eval(`
      showPage('log', document.querySelectorAll('.nav-btn')[1]);
      startWorkout();
    `);
  });

  await expect(page.locator('#workout-active')).toBeVisible();
}

test('log active island renders the active workout editor through the legacy bridge', async ({
  page,
}) => {
  await openAppShell(page);
  await openActiveWorkout(page);

  await expect(page.locator('#log-active-legacy-shell')).toHaveCount(0);
  await expect(page.locator('#log-active-react-root #workout-active')).toBeVisible();
  await expect(page.locator('#log-active-react-root #active-session-title')).not.toBeEmpty();
  await expect(page.locator('#log-active-react-root .exercise-block').first()).toBeVisible();
});

test('log active island keeps set completion and rest timer controls working', async ({ page }) => {
  await openAppShell(page);
  await openActiveWorkout(page);

  await page.locator('#log-active-react-root #rest-duration').selectOption('180');

  const restDuration = await page.evaluate(() => window.eval('restDuration'));
  expect(restDuration).toBe(180);

  await page.locator('#log-active-react-root .set-check').first().click();
  await expect(page.locator('#log-active-react-root')).toContainText(/sets done|done/i);
});
