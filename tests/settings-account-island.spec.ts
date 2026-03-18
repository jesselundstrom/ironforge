import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('settings account island renders from the legacy bridge and persists language plus API key changes', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    localStorage.removeItem('ic_nutrition_key');
    window.eval(`
      currentUser = { id: 'e2e-user', email: 'account@example.com' };
      profile.language = 'en';
      workouts = [{
        id: 901,
        date: '2026-03-10T09:00:00.000Z',
        type: 'forge',
        exercises: []
      }];
      initSettings();
      showPage('settings', document.querySelectorAll('.nav-btn')[3]);
      showSettingsTab('account');
    `);
  });

  await expect(page.locator('#settings-account-legacy-shell')).toHaveCount(0);
  await expect(page.locator('#settings-account-react-root')).toContainText(/account@example\.com/i);
  await expect(page.locator('#settings-account-react-root #backup-context')).toContainText(/workouts? since/i);

  await page.evaluate(() => {
    const keyInput = document.getElementById('nutrition-api-key-input');
    if (keyInput instanceof HTMLInputElement) keyInput.value = 'sk-ant-test-key';
    window.eval("saveNutritionApiKey('sk-ant-test-key'); saveLanguageSetting('fi');");
  });

  await expect.poll(() => page.evaluate(() => localStorage.getItem('ic_nutrition_key'))).toBe(
    'sk-ant-test-key'
  );

  await expect(page.locator('#settings-account-react-root')).toContainText(/tili/i);
  await expect(page.getByRole('button', { name: /tallenna avain/i })).toBeVisible();
});

test('settings account island keeps the danger-zone confirmation flow working', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      initSettings();
      showPage('settings', document.querySelectorAll('.nav-btn')[3]);
      showSettingsTab('account');
    `);
  });

  await page.evaluate(() => {
    window.eval("settingsAccountUiState = { dangerOpen: true, dangerInput: '' };");
    window.eval('notifySettingsAccountIsland()');
  });

  expect(
    await page.evaluate(() => window.eval('getSettingsAccountReactSnapshot().values.dangerOpen'))
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      window.eval('getSettingsAccountReactSnapshot().values.dangerDeleteDisabled')
    )
  ).toBe(true);

  await page.evaluate(() => {
    const input = document.getElementById('danger-zone-input');
    if (!(input instanceof HTMLInputElement)) return;
    input.value = 'DEL';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    window.eval("checkDangerConfirm('DEL')");
  });
  expect(
    await page.evaluate(() =>
      window.eval('getSettingsAccountReactSnapshot().values.dangerDeleteDisabled')
    )
  ).toBe(true);

  await page.evaluate(() => {
    const input = document.getElementById('danger-zone-input');
    if (!(input instanceof HTMLInputElement)) return;
    input.value = 'DELETE';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    window.eval("checkDangerConfirm('DELETE')");
  });
  expect(
    await page.evaluate(() =>
      window.eval('getSettingsAccountReactSnapshot().values.dangerDeleteDisabled')
    )
  ).toBe(false);
});
