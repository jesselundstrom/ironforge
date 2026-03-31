import { expect, test } from '@playwright/test';
import { completeOnboardingForTests, openAppShell } from './helpers';

test('settings preferences page renders seeded data and saves changes', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.settings?.openPreferencesTab?.({
      preferences: {
        goal: 'strength',
        trainingDaysPerWeek: 3,
        sessionMinutes: 60,
        equipmentAccess: 'full_gym',
        sportReadinessCheckEnabled: false,
      },
      defaultRest: 120,
    });
  });

  await expect(page.locator('#settings-preferences-react-root')).toBeVisible();
  await expect(page.locator('#training-goal')).toHaveValue('strength');

  await page.locator('#training-goal').selectOption('hypertrophy');
  await page.locator('#training-days-per-week').selectOption('4');
  await page.locator('#training-session-minutes').selectOption('75');
  await page.locator('#training-equipment').selectOption('home_gym');
  await page.locator('#default-rest').fill('180');
  await page
    .locator('#settings-preferences-react-root')
    .getByRole('button', { name: /save/i })
    .click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        goal: profile.preferences.goal,
        trainingDaysPerWeek: profile.preferences.trainingDaysPerWeek,
        sessionMinutes: profile.preferences.sessionMinutes,
        equipmentAccess: profile.preferences.equipmentAccess,
        defaultRest: profile.defaultRest,
      }))
    )
    .toEqual({
      goal: 'hypertrophy',
      trainingDaysPerWeek: 4,
      sessionMinutes: 75,
      equipmentAccess: 'home_gym',
      defaultRest: 180,
    });
  await expect(page.locator('#training-status-bar')).toContainText(/hypertrophy/i);
});

test('settings preferences page keeps selected values stable across a language change', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.settings?.openPreferencesTab?.({
      preferences: {
        goal: 'strength',
        trainingDaysPerWeek: 3,
        sessionMinutes: 60,
        equipmentAccess: 'full_gym',
      },
      defaultRest: 120,
    });
  });

  await page.locator('#training-goal').selectOption('hypertrophy');
  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.i18n?.setLanguage?.('fi', { persist: false });
  });

  await expect(page.locator('#training-goal')).toHaveValue('hypertrophy');
  await expect(page.locator('#training-days-per-week')).toHaveValue('3');
});
