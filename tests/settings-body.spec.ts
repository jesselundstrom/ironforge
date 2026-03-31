import { expect, test } from '@playwright/test';
import { completeOnboardingForTests, openAppShell } from './helpers';

test('settings body page renders from the runtime store and saves body metrics', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.settings?.openBodyTab?.({
      sex: 'male',
      activityLevel: 'moderate',
      weight: 82.5,
      height: 178,
      age: 28,
      targetWeight: 85,
      bodyGoal: 'gain_muscle',
    });
  });

  await expect(page.locator('#settings-body-react-root')).toBeVisible();
  await expect(page.locator('[data-ui="settings-body-metrics-card"]')).toBeVisible();

  await page.locator('#body-weight').fill('84');
  await page.locator('#body-goal').selectOption('maintain');
  await page
    .locator('#settings-body-react-root')
    .getByRole('button', { name: /save/i })
    .last()
    .click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        weight: profile.bodyMetrics.weight,
        bodyGoal: profile.bodyMetrics.bodyGoal,
      }))
    )
    .toEqual({
      weight: 84,
      bodyGoal: 'maintain',
    });
});

test('settings body page keeps entered values stable across a language change', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.settings?.openBodyTab?.({
      weight: 82.5,
      targetWeight: 85,
    });
  });

  await page.locator('#body-goal').selectOption('gain_muscle');
  await page.locator('#body-weight').fill('83');
  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.i18n?.setLanguage?.('fi', { persist: false });
  });

  await expect(page.locator('#body-weight')).toHaveValue('83');
  await expect(page.locator('#body-goal')).toHaveValue('gain_muscle');
});
