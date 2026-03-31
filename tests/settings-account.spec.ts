import { expect, test } from '@playwright/test';
import { confirmModal, openAppShell } from './helpers';

test.describe.configure({ mode: 'serial' });

async function openAccountTab(
  page: import('@playwright/test').Page,
  options?: {
    workouts?: Array<Record<string, unknown>>;
    profile?: Record<string, unknown> | null;
    schedule?: Record<string, unknown> | null;
  }
) {
  const next = options || {};
  await page.evaluate(async (seed) => {
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
    await window.__IRONFORGE_E2E__?.profile?.update?.({
      coaching: {
        ...((window.profile?.coaching as Record<string, unknown>) || {}),
        onboardingSeen: true,
        onboardingCompleted: true,
      },
    });
    if (seed.workouts || seed.profile || seed.schedule) {
      await window.__IRONFORGE_E2E__?.app?.seedData?.({
        workouts: seed.workouts,
        profile: seed.profile,
        schedule: seed.schedule,
      });
    }
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  }, next);
}

test('settings account page shows account, sync, backup, and sign-out controls', async ({
  page,
}) => {
  await openAppShell(page);
  await openAccountTab(page, {
    workouts: [
      {
        id: 'backup-ctx-1',
        date: '2026-03-10T09:00:00.000Z',
        program: 'forge',
        type: 'forge',
        exercises: [],
      },
    ],
  });

  await expect(page.locator('#settings-account-react-root')).toBeVisible();
  await expect(page.locator('[data-ui="settings-account-card"]')).toContainText(
    'e2e@example.com'
  );
  await expect(page.locator('[data-ui="settings-account-card"]')).toContainText(
    /sync/i
  );
  await expect(page.locator('#backup-context')).toContainText(/workouts? since/i);
  await expect(
    page.getByRole('button', { name: /sign out/i })
  ).toBeVisible();
  await expect(
    page.locator('#settings-account-react-root #nutrition-api-key-input')
  ).toHaveCount(0);
});

test('settings account language selector updates the store and persisted locale', async ({
  page,
}) => {
  await openAppShell(page);
  await openAccountTab(page);

  await page.locator('#settings-language').selectOption('fi');

  await expect
    .poll(() =>
      page.evaluate(() => ({
        language: window.__IRONFORGE_E2E__?.app
          ? (window as Window & { I18N?: { getLanguage?: () => string } }).I18N?.getLanguage?.() ||
            null
          : null,
        stored: localStorage.getItem('if2_language'),
      }))
    )
    .toEqual({
      language: 'fi',
      stored: 'fi',
    });
});

test('settings account sign out returns the shell to the signed-out state', async ({
  page,
}) => {
  await openAppShell(page);
  await openAccountTab(page);

  await page.getByRole('button', { name: /sign out/i }).click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        phase:
          window.__IRONFORGE_STORES__?.runtime?.getState?.().auth?.phase || null,
        currentUser:
          window.__IRONFORGE_STORES__?.data?.getState?.().currentUser || null,
      }))
    )
    .toEqual({
      phase: 'signed_out',
      currentUser: null,
    });
});

test('settings account import keeps hostile workout labels inert after reload', async ({
  page,
}) => {
  await openAppShell(page);
  await openAccountTab(page);

  await page.evaluate(() => {
    window.__importWorkoutXssTriggered = false;
  });

  const backup = JSON.stringify({
    version: 1,
    exported: '2026-03-20T10:00:00.000Z',
    workouts: [
      {
        id: 'import-xss-1',
        date: '2026-03-10T09:00:00.000Z',
        program: 'forge',
        type: 'forge',
        programDayNum: 1,
        programMeta: { week: 1 },
        programLabel:
          '<img src=x onerror="window.__importWorkoutXssTriggered=true">',
        sessionDescription:
          '<svg onload="window.__importWorkoutXssTriggered=true"></svg>',
        sessionNotes:
          '<script>window.__importWorkoutXssTriggered=true</script>',
        duration: 1800,
        rpe: 7,
        exercises: [
          {
            name: '<img src=x onerror="window.__importWorkoutXssTriggered=true">',
            sets: [{ weight: 80, reps: 5, done: true }],
          },
        ],
      },
    ],
  });

  await page
    .locator('[data-ui="settings-backup-import"]')
    .setInputFiles({
      name: 'ironforge-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backup, 'utf8'),
    });

  await confirmModal(page);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('if2_workouts::e2e-user');
        if (!raw) return 0;
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          return 0;
        }
      })
    )
    .toBe(1);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
    window.renderHistory?.();
  });

  await expect(page.locator('.hist-card img, .hist-card svg, .hist-card script')).toHaveCount(0);
  await expect(page.locator('.hist-card')).toContainText(
    /<img src=x onerror="window\.__importWorkoutXssTriggered=true">/i
  );

  const triggered = await page.evaluate(
    () => window.__importWorkoutXssTriggered === true
  );
  expect(triggered).toBe(false);
});

test('settings account import normalizes malformed body metrics before persisting them', async ({
  page,
}) => {
  await openAppShell(page);
  await openAccountTab(page);

  const backup = JSON.stringify({
    version: 1,
    exported: '2026-03-20T10:00:00.000Z',
    workouts: [],
    schedule: {
      sportName: 'Padel',
      sportDays: [1, 3],
      sportIntensity: 'moderate',
      sportLegsHeavy: true,
    },
    profile: {
      language: 'en',
      defaultRest: 120,
      activeProgram: 'forge',
      preferences: {
        goal: 'strength',
        trainingDaysPerWeek: 3,
        sessionMinutes: 60,
        equipmentAccess: 'full_gym',
        sportReadinessCheckEnabled: false,
      },
      coaching: {
        experienceLevel: 'returning',
        guidanceMode: 'balanced',
        onboardingCompleted: true,
      },
      bodyMetrics: {
        sex: 'robot',
        activityLevel: 'sprint',
        weight: 999,
        height: 20,
        age: 3,
        targetWeight: 'nope',
        bodyGoal: 'forever_bulk',
      },
    },
  });

  await page
    .locator('[data-ui="settings-backup-import"]')
    .setInputFiles({
      name: 'ironforge-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backup, 'utf8'),
    });

  await confirmModal(page);

  await expect
    .poll(() => page.evaluate(() => profile.bodyMetrics), { timeout: 15000 })
    .toEqual({
      sex: null,
      activityLevel: null,
      weight: 300,
      height: 100,
      age: 10,
      targetWeight: null,
      bodyGoal: null,
    });
});

test('settings account rejects invalid backup files without partial writes', async ({
  page,
}) => {
  await openAppShell(page);
  await openAccountTab(page, {
    workouts: [
      {
        id: 'existing-workout',
        date: '2026-03-18T09:00:00.000Z',
        type: 'forge',
        program: 'forge',
        exercises: [],
      },
    ],
  });

  const backup = JSON.stringify({
    version: 1,
    exported: '2026-03-20T10:00:00.000Z',
    workouts: 'definitely-not-an-array',
  });

  await page.locator('[data-ui="settings-backup-import"]').setInputFiles({
    name: 'ironforge-backup-invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf8'),
  });

  await expect(page.locator('#confirm-modal')).not.toHaveClass(/active/);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        localWorkoutCount: (() => {
          const raw = localStorage.getItem('if2_workouts::e2e-user');
          if (!raw) return 0;
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            return 0;
          }
        })(),
        workoutIds: (workouts || []).map((workout) => workout.id),
      }))
    )
    .toEqual({
      localWorkoutCount: 1,
      workoutIds: ['existing-workout'],
    });
});

test('settings account clear-data flow keeps the danger-zone confirmation working', async ({
  page,
}) => {
  await openAppShell(page);
  await openAccountTab(page, {
    workouts: [
      {
        id: 'clear-1',
        date: '2026-03-18T09:00:00.000Z',
        type: 'forge',
        program: 'forge',
        exercises: [],
      },
    ],
    schedule: {
      sportName: 'Padel',
      sportDays: [1, 3],
      sportIntensity: 'moderate',
      sportLegsHeavy: true,
    },
  });

  await page.locator('#danger-zone-trigger').click();
  await expect(page.locator('#danger-zone-confirm')).toBeVisible();
  await expect(page.locator('#danger-zone-delete-btn')).toBeDisabled();

  await page.locator('#danger-zone-input').fill('DELETE');
  await expect(page.locator('#danger-zone-delete-btn')).toBeEnabled();

  await page.locator('#danger-zone-delete-btn').click();
  await confirmModal(page);

  await expect
    .poll(() =>
      page.evaluate(() => ({
        workoutCount: workouts.length,
        sportName: schedule?.sportName || '',
      }))
    )
    .toEqual({
      workoutCount: 0,
      sportName: '',
    });
});

test('app shell ships the local Supabase bundle under the tightened script CSP', async ({
  page,
}) => {
  await openAppShell(page);

  const shellSecurity = await page.evaluate(() => {
    const csp = document
      .querySelector('meta[http-equiv="Content-Security-Policy"]')
      ?.getAttribute('content');
    const scriptSrcDirective = (csp || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('script-src'));
    const scripts = Array.from(document.scripts)
      .map((script) => script.getAttribute('src'))
      .filter(Boolean);
    return { csp, scriptSrcDirective, scripts };
  });

  expect(shellSecurity.csp).toContain("script-src 'self'");
  expect(shellSecurity.scriptSrcDirective).not.toContain("'unsafe-inline'");
  expect(shellSecurity.csp).not.toContain('jsdelivr');
  expect(shellSecurity.scripts.some((src) => /^https?:\/\//.test(src || ''))).toBe(
    false
  );
  expect(shellSecurity.scripts.some((src) => src?.includes('jsdelivr'))).toBe(
    false
  );
});
