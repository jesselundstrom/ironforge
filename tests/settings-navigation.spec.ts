import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('user can open settings from the bottom navigation', async ({ page }) => {
  await openAppShell(page);

  const settingsButton = page
    .locator('.bottom-nav')
    .getByRole('button', { name: /^settings$/i });

  await expect(settingsButton).toBeVisible();
  await settingsButton.click({ force: true });

  await expect(page.locator('#page-settings')).toHaveClass(/active/);
  await expect(page.locator('#sport-name')).toBeVisible();
  await expect(page.locator('#settings-tab-schedule')).toBeVisible();
});

test('settings page stays usable after synced UI refresh', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval("showPage('settings')");
    window.eval("showSettingsTab('account')");
  });

  await page.evaluate(() => {
    window.eval('refreshSyncedUI({ toast: false })');
  });

  await expect(page.locator('#page-settings')).toHaveClass(/active/);
  await expect(page.locator('#settings-tab-account')).toBeVisible();
  await expect(page.locator('#sync-status')).toBeVisible();
});
