import { expect, test } from '@playwright/test';
import { openApp, openAppShell } from './helpers';

test('bootstrap keeps Supabase auth method context intact', async ({ page }) => {
  await openApp(page);

  await page.waitForFunction(
    () => typeof window.__IRONFORGE_AUTH_RUNTIME__?.bootstrap === 'function'
  );

  await page.evaluate(() => {
    if (!window.__IRONFORGE_SUPABASE__?.auth) return;

    window.__IRONFORGE_SUPABASE__.auth.getSession = async function () {
      const state = this as { initializePromise?: Promise<unknown> };
      if (!state || typeof state !== 'object') {
        throw new Error('Missing auth context');
      }
      state.initializePromise = Promise.resolve('ok');
      return {
        data: { session: null },
        error: null,
      };
    };
  });

  await page.evaluate(async () => {
    await window.__IRONFORGE_AUTH_RUNTIME__?.bootstrap?.();
  });

  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#login-error')).toHaveText('');
});

test('successful sign-in enters the app from the returned session', async ({
  page,
}) => {
  await openApp(page);

  await page.waitForFunction(
    () => typeof window.__IRONFORGE_SET_AUTH_STATE__ === 'function'
  );

  await page.evaluate(() => {
    window.loadData = async () => {};
    if (window.__IRONFORGE_SUPABASE__?.auth) {
      window.__IRONFORGE_SUPABASE__.auth.signInWithPassword = async ({
        email,
      }) => ({
        data: {
          session: {
            user: {
              id: 'e2e-user',
              email,
            },
          },
        },
        error: null,
      });
    }
  });

  await page.locator('#login-email').fill('e2e@example.com');
  await page.locator('#login-password').fill('hunter22');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.locator('#app-root')).toBeVisible();
});

test('failed sign-in keeps the login screen visible', async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => {
    window.loadData = async () => {};
    if (window.__IRONFORGE_SUPABASE__?.auth) {
      window.__IRONFORGE_SUPABASE__.auth.signInWithPassword = async () => ({
        data: { session: null },
        error: {
          message: 'Invalid login credentials',
        },
      });
    }
  });

  await page.locator('#login-email').fill('e2e@example.com');
  await page.locator('#login-password').fill('wrongpass');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#login-error')).toHaveText(
    /invalid login credentials/i
  );
});

test('login stays usable while auth bootstrap is still checking the session', async ({
  page,
}) => {
  await openApp(page);

  await page.waitForFunction(
    () => typeof window.__IRONFORGE_SET_AUTH_STATE__ === 'function'
  );

  await page.evaluate(() => {
    window.__IRONFORGE_SET_AUTH_STATE__?.({
      phase: 'booting',
      isLoggedIn: false,
      pendingAction: null,
      message: '',
      messageTone: '',
    });
  });

  await expect(page.locator('#login-error')).toHaveText(
    /checking your session/i
  );
  await expect(page.locator('#login-email')).toBeEnabled();
  await expect(page.locator('#login-password')).toBeEnabled();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
  await expect(page.locator('#login-screen img')).toHaveCount(0);
  await page.waitForFunction(() => {
    const screen = document.getElementById('login-screen');
    if (!(screen instanceof HTMLElement)) return false;
    return getComputedStyle(screen).backgroundImage !== 'none';
  });
  await page.waitForFunction(() => {
    const canvas = document.getElementById('sparks');
    return (
      canvas instanceof HTMLCanvasElement &&
      canvas.width > 0 &&
      canvas.height > 0
    );
  });
});

test('logout returns to the login screen', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    if (window.__IRONFORGE_SUPABASE__?.auth) {
      window.__IRONFORGE_SUPABASE__.auth.signOut = async () => ({
        error: null,
      });
    }
  });

  await page.evaluate(async () => {
    await window.__IRONFORGE_AUTH_RUNTIME__?.logout?.();
  });

  await expect(page.locator('#login-screen')).toBeVisible();
});

test('pwa update prompt applies the waiting worker and requests a reload', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const testWindow = window as Window & {
      __testSwMessages?: Array<Record<string, unknown>>;
      __reloadRequested?: boolean;
    };
    testWindow.__testSwMessages = [];
    testWindow.__reloadRequested = false;

    try {
      Object.defineProperty(window.location, 'reload', {
        configurable: true,
        value: () => {
          testWindow.__reloadRequested = true;
        },
      });
    } catch (_error) {}

    window.__IRONFORGE_PWA_UPDATE_RUNTIME__?.setWaitingWorkerForTest?.({
      postMessage: (message) => {
        testWindow.__testSwMessages?.push(message as Record<string, unknown>);
      },
    });
  });

  await expect(page.locator('#app-update-toast')).toContainText(
    /new version of ironforge is ready/i
  );
  await page.getByRole('button', { name: /refresh/i }).click();

  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __testSwMessages?: Array<Record<string, unknown>>;
        }
      ).__testSwMessages?.[0]?.type === 'SKIP_WAITING'
  );
  await page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  });

  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toContainText(/sign in|dashboard/i);
});
