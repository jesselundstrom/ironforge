import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('settings body island renders from the legacy bridge and saves through the existing handler', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      profile.bodyMetrics = {
        sex: 'male',
        activityLevel: 'moderate',
        weight: 82.5,
        height: 178,
        age: 28,
        targetWeight: 85,
        bodyGoal: 'gain_muscle'
      };
      initSettings();
      showPage('settings', document.querySelectorAll('.nav-btn')[3]);
      showSettingsTab('body');
    `);
  });

  await expect(page.locator('#settings-body-legacy-shell')).toHaveCount(0);
  await expect
    .poll(() => page.locator('#settings-body-react-root #body-weight').inputValue(), {
      timeout: 15000,
    })
    .toBe('82.5');
  await expect(page.locator('#settings-body-react-root')).toContainText(/body metrics/i);

  await page.evaluate(() => {
    const weightInput = document.getElementById('body-weight');
    const goalSelect = document.getElementById('body-goal');
    if (weightInput instanceof HTMLInputElement) weightInput.value = '84';
    if (goalSelect instanceof HTMLSelectElement) goalSelect.value = 'maintain';
    window.eval('saveBodyMetrics()');
  });

  const savedMetrics = await page.evaluate(() =>
    window.eval(`({
      weight: profile.bodyMetrics.weight,
      bodyGoal: profile.bodyMetrics.bodyGoal
    })`)
  );

  expect(savedMetrics?.weight).toBe(84);
  expect(savedMetrics?.bodyGoal).toBe('maintain');
});

test('settings body island refreshes translated labels after language changes', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      initSettings();
      showPage('settings', document.querySelectorAll('.nav-btn')[3]);
      showSettingsTab('body');
    `);
  });

  await expect(page.locator('#settings-body-react-root')).toContainText(/body metrics/i);

  await page.evaluate(() => {
    window.eval(`I18N.setLanguage('fi', { persist: false });`);
  });

  await expect
    .poll(() => page.locator('#settings-body-react-root').textContent(), { timeout: 15000 })
    .toMatch(/kehon mittasuhteet/i);
  await expect(page.getByRole('button', { name: /tallenna/i })).toBeVisible();
});
