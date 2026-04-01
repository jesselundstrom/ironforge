import { expect, test } from '@playwright/test';
import { openApp, openAppShell } from './helpers';

test('bootstrap keeps Supabase auth method context intact', async ({
  page,
}) => {
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

test('sign-in remains successful even if legacy auth hydration throws', async ({
  page,
}) => {
  await openApp(page);

  await page.waitForFunction(
    () => typeof window.__IRONFORGE_SET_AUTH_STATE__ === 'function'
  );

  await page.evaluate(() => {
    window.loadData = async () => {};
    window.__IRONFORGE_APPLY_AUTH_SESSION__ = async () => {
      throw new Error('Legacy hydration failed');
    };
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
  await expect(page.locator('#login-screen')).toHaveCount(0);
});

test('login stays usable while auth bootstrap is still running in the background', async ({
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

  await expect(page.locator('#login-error')).toHaveText('');
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

test('standalone sign-in uses the shared auth-owned Supabase client', async ({
  page,
}) => {
  await openApp(page, { standalone: true });

  await page.waitForFunction(
    () =>
      typeof window.__IRONFORGE_AUTH_RUNTIME__?.getSupabaseClient === 'function'
  );

  const usesSingleClient = await page.evaluate(() => {
    const runtimeClient =
      window.__IRONFORGE_AUTH_RUNTIME__?.getSupabaseClient?.() || null;
    return runtimeClient === (window.__IRONFORGE_SUPABASE__ || null);
  });

  expect(usesSingleClient).toBe(true);

  await page.evaluate(() => {
    window.loadData = async () => {};
    if (window.__IRONFORGE_SUPABASE__?.auth) {
      window.__IRONFORGE_SUPABASE__.auth.signInWithPassword = async ({
        email,
      }) => ({
        data: {
          session: {
            user: {
              id: 'standalone-user',
              email,
            },
          },
        },
        error: null,
      });
    }
  });

  await page.locator('#login-email').fill('standalone@example.com');
  await page.locator('#login-password').fill('hunter22');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.locator('#app-root')).toBeVisible();
});

test('legacy login capture yields once the auth runtime is ready', async ({
  page,
}) => {
  await openApp(page);

  await page.waitForFunction(
    () => window.__IRONFORGE_AUTH_RUNTIME_READY__ === true
  );

  const bubbled = await page.evaluate(async () => {
    const button = document.querySelector('[data-ui="auth-sign-in"]');
    if (!(button instanceof HTMLButtonElement)) return false;

    let didBubble = false;
    const listener = () => {
      didBubble = true;
    };

    document.body.addEventListener('click', listener, { once: true });
    button.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    document.body.removeEventListener('click', listener);

    return didBubble;
  });

  expect(bubbled).toBe(true);
});

test('legacy fallback creates a standalone Supabase client before auth runtime is ready', async ({
  page,
}) => {
  await openApp(page, { standalone: true });

  await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      __fallbackLoginCalled?: number;
      __IRONFORGE_AUTH_RUNTIME_READY__?: boolean;
      __IRONFORGE_AUTH_RUNTIME__?: Record<string, unknown>;
      __IRONFORGE_SUPABASE__?: unknown;
      loadData?: () => Promise<void>;
      supabase?: {
        createClient?: (...args: unknown[]) => {
          auth: {
            signInWithPassword: (credentials: {
              email: string;
              password: string;
            }) => Promise<unknown>;
          };
        };
      };
    };

    runtimeWindow.__fallbackLoginCalled = 0;
    runtimeWindow.__IRONFORGE_AUTH_RUNTIME_READY__ = false;
    delete runtimeWindow.__IRONFORGE_AUTH_RUNTIME__;
    delete runtimeWindow.__IRONFORGE_SUPABASE__;
    runtimeWindow.loadData = async () => {};
    runtimeWindow.supabase = {
      createClient: () => ({
        auth: {
          signInWithPassword: async () => {
            runtimeWindow.__fallbackLoginCalled =
              (runtimeWindow.__fallbackLoginCalled || 0) + 1;
            return {
              data: {
                session: {
                  user: {
                    id: 'fallback-user',
                    email: 'fallback@example.com',
                  },
                },
              },
              error: null,
            };
          },
        },
      }),
    };
  });

  await page.locator('#login-email').fill('fallback@example.com');
  await page.locator('#login-password').fill('hunter22');
  await page.locator('[data-ui="auth-sign-in"]').dispatchEvent('touchend');

  await page.waitForFunction(
    () =>
      (window as Window & { __fallbackLoginCalled?: number })
        .__fallbackLoginCalled === 1
  );
});

test('stale standalone bootstrap cannot overwrite an in-flight sign-in', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const runtimeWindow = window as Window & {
      __IRONFORGE_TEST_AUTH_HOOK__?: {
        resolveBootstrap?: (() => void) | null;
      };
      supabase?: {
        createClient?: (...args: unknown[]) => Record<string, unknown>;
      };
    };

    runtimeWindow.__IRONFORGE_TEST_AUTH_HOOK__ = {
      resolveBootstrap: null,
    };

    let interceptedSupabase:
      | { createClient?: (...args: unknown[]) => Record<string, unknown> }
      | undefined;

    Object.defineProperty(runtimeWindow, 'supabase', {
      configurable: true,
      get() {
        return interceptedSupabase;
      },
      set(value) {
        interceptedSupabase = value;
        if (!value || typeof value.createClient !== 'function') return;
        const originalCreateClient = value.createClient.bind(value);
        value.createClient = (...args: unknown[]) => {
          const client = originalCreateClient(...args);
          const auth = client?.auth as
            | {
                getSession?: () => Promise<unknown>;
                signInWithPassword?: (credentials: {
                  email: string;
                  password: string;
                }) => Promise<unknown>;
              }
            | undefined;
          if (!auth) return client;

          auth.getSession = async () =>
            await new Promise((resolve) => {
              runtimeWindow.__IRONFORGE_TEST_AUTH_HOOK__!.resolveBootstrap =
                () => {
                  resolve({
                    data: { session: null },
                    error: null,
                  });
                };
            });

          auth.signInWithPassword = async ({ email }) => ({
            data: {
              session: {
                user: {
                  id: 'stale-bootstrap-user',
                  email,
                },
              },
            },
            error: null,
          });

          return client;
        };
      },
    });
  });

  await openApp(page, { standalone: true });

  await page.evaluate(() => {
    window.loadData = async () => {};
  });

  await page.locator('#login-email').fill('race@example.com');
  await page.locator('#login-password').fill('hunter22');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.locator('#app-root')).toBeVisible();

  await page.evaluate(() => {
    (
      window as Window & {
        __IRONFORGE_TEST_AUTH_HOOK__?: {
          resolveBootstrap?: (() => void) | null;
        };
      }
    ).__IRONFORGE_TEST_AUTH_HOOK__?.resolveBootstrap?.();
  });

  await page.waitForTimeout(100);

  await expect(page.locator('#app-root')).toBeVisible();
  await expect(page.locator('#login-screen')).toHaveCount(0);
  await page.waitForFunction(() =>
    (
      window as Window & {
        __IRONFORGE_LOGIN_DEBUG__?: {
          getLines?: () => string[];
        };
      }
    ).__IRONFORGE_LOGIN_DEBUG__
      ?.getLines?.()
      ?.some((line) =>
        line.includes('auth runtime bootstrap ignored after newer mutation')
      )
  );
});

test('standalone sign-up keeps the success state on the login screen', async ({
  page,
}) => {
  await openApp(page, { standalone: true });

  await page.evaluate(() => {
    if (window.__IRONFORGE_SUPABASE__?.auth) {
      window.__IRONFORGE_SUPABASE__.auth.signUp = async () => ({
        data: { session: null },
        error: null,
      });
    }
  });

  await page.locator('#login-email').fill('new-user@example.com');
  await page.locator('#login-password').fill('hunter22');
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#login-error')).toHaveText(/account created/i);
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
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen instanceof HTMLElement) {
      loginScreen.style.display = '';
    }
  });

  await expect(page.locator('#app-root')).toHaveCount(0);
  await expect(page.locator('#login-screen')).toBeVisible();
});

test('pwa update auto-applies the waiting worker and requests a reload', async ({
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
