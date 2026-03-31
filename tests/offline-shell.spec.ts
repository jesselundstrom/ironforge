import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('offline shell boots after the service worker is installed', async ({ page }) => {
  await openAppShell(page);

  // Wait for the app-managed SW registration to settle online before switching offline.
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker.getRegistration('./');
      return !!registration?.active;
    },
    { timeout: 15000 }
  );

  // Full online reload with the active SW in place — waitUntil:'networkidle' lets
  // module fetches and their cache.put operations complete before we go offline.
  await page.reload({ waitUntil: 'networkidle' });

  // Wait for the React app shell root to exist before switching offline
  // (confirms main.tsx loaded and was cached by the SW while online).
  await page.waitForFunction(() => {
    const shellRoot = document.getElementById('app-shell-react-root');
    return !!shellRoot && shellRoot.children.length > 0;
  });

  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForFunction(
    () =>
      typeof window.showPage === 'function' &&
      typeof window.loadData === 'function' &&
      typeof window.__IRONFORGE_SET_AUTH_STATE__ === 'function'
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
    window.__IRONFORGE_SET_AUTH_STATE__?.({
      phase: 'signed_in',
      isLoggedIn: true,
      pendingAction: null,
      message: '',
      messageTone: '',
    });
    window.__IRONFORGE_E2E__?.app?.setCurrentUser?.({
      id: window.__IRONFORGE_TEST_USER_ID__ || 'e2e-user',
      email: 'e2e@example.com',
    });

    suppressLoginUi();
    document.getElementById('onboarding-modal')?.classList.remove('active');
  });

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.app?.loadData?.({
      allowCloudSync: false,
      userId: window.__IRONFORGE_TEST_USER_ID__ || 'e2e-user',
    });
    window.__IRONFORGE_SET_AUTH_STATE__?.({
      phase: 'signed_in',
      isLoggedIn: true,
      pendingAction: null,
      message: '',
      messageTone: '',
    });
  });

  // Wait for the React shell to mount offline (proves the SW served all cached modules).
  await page.waitForFunction(
    () => {
      const shellRoot = document.getElementById('app-shell-react-root');
      return !!shellRoot && shellRoot.children.length > 0;
    }
  );

  await expect(page.locator('#app-root')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('#sync-status')).toContainText(/offline/i);
});
