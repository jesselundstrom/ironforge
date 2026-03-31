import { expect, test } from '@playwright/test';
import { completeOnboardingForTests, openAppShell } from './helpers';

async function openScheduleTab(
  page: import('@playwright/test').Page,
  scheduleSnapshot: Record<string, unknown>
) {
  await page.evaluate(async (snapshot) => {
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: window.workouts || [],
      profile: window.profile || null,
      schedule: snapshot,
    });
    window.__IRONFORGE_E2E__?.settings?.openTab?.('schedule');
  }, scheduleSnapshot);
}

test('settings schedule page renders seeded data and saves schedule changes', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);
  await openScheduleTab(page, {
    sportName: 'Hockey',
    sportDays: [2, 4],
    sportIntensity: 'hard',
    sportLegsHeavy: true,
  });

  await expect(page.locator('#settings-schedule-react-root')).toBeVisible();

  await page.locator('#sport-name').fill('Padel');
  await page.locator('#sport-intensity').selectOption('moderate');
  await page.locator('#sport-legs-heavy').uncheck();
  await page
    .locator('#settings-schedule-react-root button')
    .filter({ hasText: /^m$/i })
    .first()
    .click();
  await page
    .locator('#settings-schedule-react-root')
    .getByRole('button', { name: /save/i })
    .click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        sportName: schedule.sportName,
        sportIntensity: schedule.sportIntensity,
        sportLegsHeavy: schedule.sportLegsHeavy,
        sportDays: [...schedule.sportDays].sort((a, b) => a - b),
      }))
    )
    .toEqual({
      sportName: 'Padel',
      sportIntensity: 'moderate',
      sportLegsHeavy: false,
      sportDays: [0, 2, 4],
    });
  await expect(page.locator('#sport-status-bar')).toContainText(/padel/i);
});

test('settings schedule page keeps sport name empty when the field is cleared and saved', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);
  await openScheduleTab(page, {
    sportName: 'Endurance',
    sportDays: [2, 4],
    sportIntensity: 'hard',
    sportLegsHeavy: true,
  });

  await page.locator('#sport-name').fill('');
  await page
    .locator('#settings-schedule-react-root')
    .getByRole('button', { name: /save/i })
    .click();

  await expect
    .poll(() => page.evaluate(() => schedule.sportName), { timeout: 15000 })
    .toBe('');
  await expect(page.locator('#sport-status-bar')).toContainText(/sport \/ cardio/i);
});

test('settings schedule status bar renders sport names as text, not HTML', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);
  await openScheduleTab(page, {
    sportName: '',
    sportDays: [1, 3],
    sportIntensity: 'moderate',
    sportLegsHeavy: false,
  });

  await page.evaluate(() => {
    window.__sportNameXssTriggered = false;
  });

  await page
    .locator('#sport-name')
    .fill('<img src=x onerror="window.__sportNameXssTriggered=true">');
  await page
    .locator('#settings-schedule-react-root')
    .getByRole('button', { name: /save/i })
    .click();

  await expect(page.locator('#sport-status-bar img')).toHaveCount(0);
  await expect(page.locator('#sport-status-bar')).toContainText(
    '<img src=x onerror="window.__sportNameXssTriggered=true">'
  );

  const triggered = await page.evaluate(
    () => window.__sportNameXssTriggered === true
  );
  expect(triggered).toBe(false);
});
