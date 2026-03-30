import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('settings body island renders from the legacy bridge and saves through the existing handler', async ({
  page,
}) => {
  await openAppShell(page);

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

  await expect(page.locator('#settings-body-legacy-shell')).toHaveCount(0);
  await expect(page.locator('[data-ui="settings-body-metrics-card"]')).toBeVisible();
  await expect(page.locator('[data-ui="settings-body-goal-card"]')).toBeVisible();
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
    window.saveBodyMetrics?.();
  });

  const savedMetrics = await page.evaluate(() => ({
      weight: profile.bodyMetrics.weight,
      bodyGoal: profile.bodyMetrics.bodyGoal
    }));

  expect(savedMetrics?.weight).toBe(84);
  expect(savedMetrics?.bodyGoal).toBe('maintain');
});

test('settings body island refreshes translated labels after language changes', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.settings?.openBodyTab?.();
  });

  await expect(page.locator('#settings-body-react-root')).toContainText(/body metrics/i);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.i18n?.setLanguage?.('fi', { persist: false });
  });

  await expect
    .poll(() => page.locator('#settings-body-react-root').textContent(), { timeout: 15000 })
    .toMatch(/kehon mittasuhteet/i);
  await expect(page.getByRole('button', { name: /tallenna/i })).toBeVisible();
});
