import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('offline shell boots after the service worker is installed', async ({ page }) => {
  await openAppShell(page);

  // Force the latest SW to take over: unregister old, re-register current sw.js,
  // then do a full online reload so the active SW caches all assets.
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
    await caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
    // Register fresh and wait for it to activate before we reload.
    await navigator.serviceWorker.register('/ironforge/sw.js', { scope: '/ironforge/' });
    await navigator.serviceWorker.ready;
  });

  // Full online reload with the new SW active — waitUntil:'networkidle' lets all
  // module fetches and their (now-awaited) cache.put operations complete.
  await page.reload({ waitUntil: 'networkidle' });

  // Wait for the React app shell to be mounted (confirms main.tsx loaded and
  // was cached by the SW while online).
  await page.waitForFunction(() => (window as any).__IRONFORGE_APP_SHELL_MOUNTED__ === true);

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
