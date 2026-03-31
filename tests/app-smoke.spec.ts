import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('app loads the shell', async ({ page }) => {
  await openApp(page);

  await expect(page).toHaveTitle(/Ironforge/i);
  await expect(page.locator('#app-shell-react-root')).toBeVisible();
  await expect(page.locator('#login-screen')).toBeVisible();
});
