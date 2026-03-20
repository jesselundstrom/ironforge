import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('offline shell boots after the service worker is installed', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForFunction(
    () => typeof window.showPage === 'function' && typeof window.loadData === 'function'
  );

  await page.evaluate(() => {
    const suppressLoginUi = () => {
      document.body.classList.remove('login-active');
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) loginScreen.style.display = 'none';
    };

    window.showLoginScreen = suppressLoginUi;
    window.hideLoginScreen = suppressLoginUi;
    window.maybeOpenOnboarding = () => {};
    window.eval("currentUser = { id: window.__IRONFORGE_TEST_USER_ID__ || 'e2e-user', email: 'e2e@example.com' };");

    suppressLoginUi();
    document.getElementById('onboarding-modal')?.classList.remove('active');
  });

  await page.evaluate(async () => {
    await window.eval(
      "loadData({ allowCloudSync: false, userId: window.__IRONFORGE_TEST_USER_ID__ || 'e2e-user' })"
    );
  });

  await expect(page.locator('#app-root')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('#sync-status')).toContainText(/offline/i);
});
