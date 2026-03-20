import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function openApp(page: Page) {
  await page.addInitScript(() => {
    if (window.name !== 'ironforge-e2e-initialized') {
      localStorage.clear();
      sessionStorage.clear();
      window.name = 'ironforge-e2e-initialized';
    }

    window.__IRONFORGE_TEST_USER_ID__ = 'e2e-user';
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

export async function bootstrapAppShell(page: Page) {
  await page.waitForFunction(() => typeof window.showPage === 'function');
  await page.waitForFunction(() => typeof window.loadData === 'function');
  await page.waitForFunction(() => window.eval('Object.keys(PROGRAMS || {}).length > 0'));
  await page.waitForFunction(() => window.eval("typeof window.initNutritionPage === 'function'"));

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
    await window.eval("loadData({ allowCloudSync: false, userId: window.__IRONFORGE_TEST_USER_ID__ || 'e2e-user' })");
  });

  await page.waitForFunction(() => {
    if (window.__IRONFORGE_APP_SHELL_READY__ === true) return true;
    const root = document.getElementById('app-shell-react-root');
    return !!root && root.children.length > 0;
  });
}

export async function openAppShell(page: Page) {
  await openApp(page);
  await bootstrapAppShell(page);
}

export async function reloadAppShell(page: Page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await bootstrapAppShell(page);
}

export async function confirmModal(page: Page) {
  const modal = page.locator('#confirm-modal');
  const confirmButton = page.locator('#confirm-ok');

  await expect(modal).toHaveClass(/active/);
  await expect(confirmButton).toBeVisible();
  await confirmButton.click({ force: true });
}
