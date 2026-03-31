import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('login debug handler loads and captures empty sign-in attempts', async ({
  page,
}) => {
  await openApp(page);

  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#login-debug')).toContainText(
    /auth runtime bootstrap start|auth runtime created supabase client/i
  );

  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.locator('#login-error')).toHaveText(
    /enter your email and password\./i
  );
  await expect(page.locator('#login-debug')).toContainText(
    /auth runtime bootstrap start/i
  );
});
