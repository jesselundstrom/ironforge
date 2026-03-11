import { expect, test } from '@playwright/test';

test('app loads the shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Ironforge/i);
  await expect(page.locator('#app-root')).toBeVisible();
  await expect(page.locator('#toast')).toBeVisible();
});
