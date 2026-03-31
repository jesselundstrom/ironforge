import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

type OpenAppOptions = {
  standalone?: boolean;
};

export async function openApp(page: Page, options: OpenAppOptions = {}) {
  await page.addInitScript(({ standalone }) => {
    if (window.name !== 'ironforge-e2e-initialized') {
      localStorage.clear();
      sessionStorage.clear();
      window.name = 'ironforge-e2e-initialized';
    }

    window.__IRONFORGE_TEST_USER_ID__ = 'e2e-user';
    if (!standalone) return;

    const nativeMatchMedia =
      typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : null;

    const standaloneQuery = '(display-mode: standalone)';
    window.matchMedia = (query: string) => {
      if (query === standaloneQuery) {
        return {
          matches: true,
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() {
            return false;
          },
        } as MediaQueryList;
      }
      if (nativeMatchMedia) {
        return nativeMatchMedia(query);
      }
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        },
      } as MediaQueryList;
    };

    try {
      Object.defineProperty(window.navigator, 'standalone', {
        configurable: true,
        get: () => true,
      });
    } catch (_error) {}
  }, { standalone: options.standalone === true });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

async function waitForAppHarness(page: Page) {
  const isHarnessReady = () =>
    typeof window.__IRONFORGE_E2E__?.app?.loadData === 'function' &&
    typeof window.__IRONFORGE_E2E__?.app?.navigateToPage === 'function' &&
    typeof window.__IRONFORGE_E2E__?.app?.setCurrentUser === 'function' &&
    typeof window.__IRONFORGE_STORES__?.workout?.getState === 'function' &&
    typeof window.__IRONFORGE_STORES__?.data?.getActiveWorkoutDraftCache ===
      'function';

  try {
    await page.waitForFunction(isHarnessReady, { timeout: 15000 });
  } catch (error) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(isHarnessReady, { timeout: 15000 });
  }
}

export async function bootstrapAppShell(page: Page) {
  await waitForAppHarness(page);

  await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      __IRONFORGE_SUPABASE__?: {
        auth?: {
          getSession?: () => Promise<unknown>;
        };
      };
    };
    const suppressLoginUi = () => {
      document.body.classList.remove('login-active');
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) loginScreen.style.display = 'none';
    };

    window.showLoginScreen = suppressLoginUi;
    window.hideLoginScreen = suppressLoginUi;
    window.maybeOpenOnboarding = () => {};
    const seededUser = {
      id: window.__IRONFORGE_TEST_USER_ID__ || 'e2e-user',
      email: 'e2e@example.com',
    };
    window.__IRONFORGE_E2E__?.app?.setCurrentUser?.(seededUser);
    window.__IRONFORGE_SET_AUTH_STATE__?.({
      phase: 'signed_in',
      isLoggedIn: true,
      pendingAction: null,
      message: '',
      messageTone: '',
    });
    if (runtimeWindow.__IRONFORGE_SUPABASE__?.auth) {
      runtimeWindow.__IRONFORGE_SUPABASE__.auth.getSession = async () => ({
        data: {
          session: {
            access_token: 'test-access-token',
            user:
              window.__IRONFORGE_STORES__?.data?.getState?.().currentUser || null,
          },
        },
        error: null,
      });
    }

    suppressLoginUi();
    document.getElementById('onboarding-modal')?.classList.remove('active');
  });

  await page.evaluate(async () => {
    const loadData = window.__IRONFORGE_E2E__?.app?.loadData;
    if (typeof loadData !== 'function') {
      throw new Error('loadData is not available on the e2e harness');
    }

    await loadData({
      allowCloudSync: false,
      userId: window.__IRONFORGE_TEST_USER_ID__ || 'e2e-user',
    });
  });

  await page.waitForFunction(() => {
    if (window.__IRONFORGE_APP_SHELL_READY__ === true) return true;
    const root = document.getElementById('app-shell-react-root');
    return !!root && root.children.length > 0;
  });
}

export async function openAppShell(page: Page, options: OpenAppOptions = {}) {
  await openApp(page, options);
  await bootstrapAppShell(page);
}

export async function reloadAppShell(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await bootstrapAppShell(page);
}

export async function confirmModal(page: Page) {
  const modal = page.locator('#confirm-modal');
  const confirmButton = page.locator('#confirm-ok');

  await expect(modal).toHaveClass(/active/);
  await expect(confirmButton).toBeVisible();
  await page.evaluate(() => {
    const button = document.getElementById('confirm-ok');
    if (button instanceof HTMLButtonElement) {
      button.click();
      return;
    }
    if (typeof window.confirmOk === 'function') {
      window.confirmOk();
    }
  });
}
