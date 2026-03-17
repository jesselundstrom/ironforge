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

  await page.locator('#settings-account-react-root #nutrition-api-key-input').fill('sk-ant-test-key');
  await page.getByRole('button', { name: /save key/i }).click();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('ic_nutrition_key')))
    .toBe('sk-ant-test-key');

  await page.locator('#settings-account-react-root #app-language').selectOption('fi');

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

  const trigger = page.locator('#settings-account-react-root #danger-zone-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const confirmInput = page.locator('#settings-account-react-root #danger-zone-input');
  const confirmButton = page.locator('#settings-account-react-root #danger-zone-delete-btn');

  await expect(confirmInput).toBeVisible();
  await expect(confirmButton).toBeDisabled();

  await confirmInput.fill('DEL');
  await expect(confirmButton).toBeDisabled();

  await confirmInput.fill('DELETE');
  await expect(confirmButton).toBeEnabled();
});
