import { expect, test } from '@playwright/test';
import { completeOnboardingForTests, openAppShell } from './helpers';

test('user can open settings from the bottom navigation', async ({ page }) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);

  const settingsButton = page
    .locator('.bottom-nav')
    .getByRole('button', { name: /settings/i });

  await expect(settingsButton).toBeVisible();
  await settingsButton.click();

  await expect(page.locator('#page-settings')).toHaveClass(/active/);
  await expect(page.locator('#settings-tab-schedule')).toBeVisible();
});

test('settings tabs switch between schedule, program, body, preferences, and account', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);
  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('settings');
  });

  await page.locator('#settings-tab-program').click();
  await expect(page.locator('#settings-program-react-root')).toBeVisible();

  await page.locator('#settings-tab-body').click();
  await expect(page.locator('#settings-body-react-root')).toBeVisible();

  await page.locator('#settings-tab-preferences').click();
  await expect(page.locator('#settings-preferences-react-root')).toBeVisible();

  await page.locator('#settings-tab-account').click();
  await expect(page.locator('#settings-account-react-root')).toBeVisible();
});
