import { expect, test } from '@playwright/test';

test('signup shows a validation error for a short password', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.locator('#login-screen')).toBeVisible();

  await page.locator('#login-email').fill('test@example.com');
  await page.locator('#login-password').fill('12345');
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page.locator('#login-error')).toHaveText(
    /password must be at least 6 characters\./i
  );
});
