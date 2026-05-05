import { expect, test } from '@playwright/test';
import { confirmModal, openAppShell, reloadAppShell } from './helpers';

test.describe.configure({ mode: 'serial' });

test('settings account island renders the signed-in nutrition coach state without key controls', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.setLegacyRuntimeState?.({
      currentUser: { id: 'e2e-user', email: 'account@example.com' },
      profile: {
        ...(window.profile || {}),
        language: 'en',
      },
      workouts: [
        {
          id: 901,
          date: '2026-03-10T09:00:00.000Z',
          type: 'forge',
          exercises: [],
        },
      ],
    });
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  await expect(page.locator('#settings-account-legacy-shell')).toHaveCount(0);
  await expect(page.locator('[data-ui="settings-account-card"]')).toContainText(
    /account@example\.com/i
  );
  await expect(
    page.locator('[data-ui="settings-backup-card"] #backup-context')
  ).toContainText(/workouts? since/i);

  await page.evaluate(() => {
    saveLanguageSetting('fi');
  });

  await expect(page.locator('#settings-account-react-root')).toContainText(
    /ravintocoach on valmis|nutrition coach is ready/i
  );
  await expect(page.locator('#settings-account-react-root')).toContainText(
    /tili/i
  );
  await expect(
    page.locator('#settings-account-react-root #nutrition-api-key-input')
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /save key|tallenna avain/i })
  ).toHaveCount(0);
});

test('settings account island shows signed-out nutrition coach copy without key controls', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.setCurrentUser?.(null);
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  await expect(page.locator('#settings-account-react-root')).toContainText(
    /kirjaudu sisään|sign in to use nutrition coach/i
  );
  await expect(
    page.locator('#settings-account-react-root #nutrition-api-key-input')
  ).toHaveCount(0);
});

test('settings account retry sync button replays the recovery path', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    let retryCalls = 0;
    window.__IRONFORGE_E2E__?.app?.setLegacyRuntimeState?.({
      currentUser: { id: 'e2e-user', email: 'account@example.com' },
    });
    window.getLastSyncDiagnostics = () => ({
      lastSyncError: {
        context: 'Failed to upsert workout rows',
        code: '42501',
        message: 'permission denied',
        at: '2026-04-01T10:00:00.000Z',
      },
      lastCloudSyncAt: null,
      pendingDocKeys: ['profile_core'],
      pendingWorkoutUpsertIds: ['workout-1'],
      pendingWorkoutDeleteIds: [],
    });
    window.retryCloudSync = async () => {
      retryCalls += 1;
      window.__IRONFORGE_SYNC_RETRY_CALLS__ = retryCalls;
      window.setSyncStatus?.('synced');
      window.__IRONFORGE_APP_RUNTIME__?.syncSettingsAccountView?.();
      return { ok: true, reason: 'synced' };
    };
    window.setSyncStatus?.('error');
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  await expect(page.locator('[data-ui="retry-sync"]')).toBeVisible();
  await expect(page.locator('[data-ui="sync-detail"]')).toContainText(
    /permission denied/i
  );

  await page.locator('[data-ui="retry-sync"]').click();

  await expect(page.locator('#sync-status')).toContainText(/synced/i);
  await expect(page.locator('[data-ui="retry-sync"]')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => Number(window.__IRONFORGE_SYNC_RETRY_CALLS__ || 0))
    )
    .toBe(1);
});

test('cloud sync health check distinguishes missing session from healthy cloud', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(async () => {
    window.__IRONFORGE_E2E__?.app?.setLegacyRuntimeState?.({
      currentUser: { id: 'e2e-user', email: 'account@example.com' },
    });

    window.__IRONFORGE_SUPABASE__ = {
      auth: {
        getSession: async () => ({
          data: { session: null },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
      rpc: async () => ({ data: [], error: null }),
    };
    const missingSession = await window.runCloudSyncHealthCheck?.({
      notifyUser: false,
    });

    window.__IRONFORGE_SUPABASE__.auth!.getSession = async () => ({
      data: { session: { user: { id: 'e2e-user' } } },
      error: null,
    });
    const healthy = await window.runCloudSyncHealthCheck?.({
      notifyUser: false,
    });

    return {
      missingSession,
      healthy,
      diagnostics: window.getLastSyncDiagnostics?.(),
    };
  });

  expect(result.missingSession?.ok).toBe(false);
  expect(result.missingSession?.reason).toBe('missing_session');
  expect(result.healthy?.ok).toBe(true);
  const healthyChecks = Array.isArray(result.healthy?.checks)
    ? (result.healthy.checks as Array<{ name: string }>)
    : [];
  expect(healthyChecks.map((check) => check.name)).toEqual(
    expect.arrayContaining([
      'session',
      'profile_documents',
      'workouts',
      'upsert_profile_documents_if_newer',
    ])
  );
  expect(result.diagnostics?.lastSyncError).toBeNull();
});

test('settings account island keeps the danger-zone confirmation flow working', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  await page.locator('#danger-zone-trigger').click();

  await expect(page.locator('#danger-zone-confirm')).toBeVisible();
  await expect(page.locator('#danger-zone-delete-btn')).toBeDisabled();

  await page.locator('#danger-zone-input').fill('DEL');
  await expect(page.locator('#danger-zone-delete-btn')).toBeDisabled();

  await page.locator('#danger-zone-input').fill('DELETE');
  await expect(page.locator('#danger-zone-delete-btn')).toBeEnabled();
});

test('settings account clear all resets workouts and core profile state', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.setLegacyRuntimeState?.({
      currentUser: { id: 'e2e-user', email: 'account@example.com' },
      workouts: [
        {
          id: 'clear-me',
          date: '2026-03-10T09:00:00.000Z',
          type: 'forge',
          program: 'forge',
          exercises: [],
        },
      ],
      schedule: {
        sportName: 'Padel',
        sportDays: [1, 3],
        sportIntensity: 'moderate',
        sportLegsHeavy: false,
      },
      profile: {
        ...(window.profile || {}),
        language: 'fi',
        defaultRest: 180,
        preferences: {
          ...(window.profile?.preferences || {}),
          goal: 'hypertrophy',
        },
      },
    });
    localStorage.setItem(
      'ic_workouts::e2e-user',
      JSON.stringify(window.workouts || [])
    );
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  await page.locator('#danger-zone-trigger').click();
  await page.locator('#danger-zone-input').fill('DELETE');
  await page.locator('#danger-zone-delete-btn').click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        workouts: Array.isArray(window.workouts) ? window.workouts.length : -1,
        localWorkouts: localStorage.getItem('ic_workouts::e2e-user'),
        sportName: window.schedule?.sportName || '',
        sportIntensity: window.schedule?.sportIntensity || '',
        activeProgram: window.profile?.activeProgram || '',
        defaultRest: window.profile?.defaultRest || 0,
        language: window.profile?.language || '',
      }))
    )
    .toEqual({
      workouts: 0,
      localWorkouts: '[]',
      sportName: '',
      sportIntensity: 'hard',
      activeProgram: 'forge',
      defaultRest: 120,
      language: 'en',
    });
});

test('settings account import keeps hostile workout labels inert after reload', async ({
  page,
}) => {
  test.slow();
  await openAppShell(page);

  await page.evaluate(() => {
    window.__importWorkoutXssTriggered = false;
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  const backup = JSON.stringify({
    version: 1,
    exported: '2026-03-20T10:00:00.000Z',
    workouts: [
      {
        id: 'import-xss-1" onclick="window.__importWorkoutXssTriggered=true',
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
    .poll(async () => {
      const raw = await page.evaluate(() =>
        localStorage.getItem('ic_workouts::e2e-user')
      );
      if (!raw) return 0;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    })
    .toBe(1);

  await reloadAppShell(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
    renderHistory();
  });

  await expect(
    page.locator('.hist-card img, .hist-card svg, .hist-card script')
  ).toHaveCount(0);
  await expect(page.locator('.hist-card')).toContainText(
    '<img src=x onerror="window.__importWorkoutXssTriggered=true">'
  );
  await page.locator('.hist-delete-btn').first().click({ force: true });
  await expect(page.locator('#confirm-modal')).toHaveClass(/active/);

  const triggered = await page.evaluate(
    () => window.__importWorkoutXssTriggered === true
  );
  expect(triggered).toBe(false);
});

test('settings account import normalizes malformed body metrics before persisting them', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      __importReloadBlocked?: boolean;
      __originalSetTimeoutForImportTest__?: typeof window.setTimeout;
    };

    runtimeWindow.__importReloadBlocked = false;
    runtimeWindow.__originalSetTimeoutForImportTest__ =
      window.setTimeout.bind(window);
    const originalSetTimeout = runtimeWindow.__originalSetTimeoutForImportTest__;
    const patchedSetTimeout = (
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ): number => {
      if (
        timeout === 1000 &&
        typeof handler === 'function' &&
        String(handler).includes('location.reload')
      ) {
        runtimeWindow.__importReloadBlocked = true;
        return 0;
      }
      return originalSetTimeout(
        handler,
        timeout,
        ...args
      );
    };
    window.setTimeout = patchedSetTimeout as typeof window.setTimeout;
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

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
        warmupSetsEnabled: false,
        notes: '',
      },
      coaching: {
        experienceLevel: 'returning',
        guidanceMode: 'balanced',
        sportProfile: {
          name: '',
          inSeason: false,
          sessionsPerWeek: 0,
        },
        limitations: {
          jointFlags: [],
          avoidMovementTags: [],
          avoidExerciseIds: [],
        },
        exercisePreferences: {
          preferredExerciseIds: [],
          excludedExerciseIds: [],
        },
        behaviorSignals: {
          avoidedExerciseIds: [],
          skippedAccessoryExerciseIds: [],
          preferredSwapExerciseIds: [],
        },
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
    .poll(
      () =>
        page.evaluate(() => ({
          bodyMetrics: profile.bodyMetrics,
          reloadBlocked:
            (window as Window & { __importReloadBlocked?: boolean })
              .__importReloadBlocked === true,
        })),
      { timeout: 15000 }
    )
    .toEqual({
      bodyMetrics: {
        sex: null,
        activityLevel: null,
        weight: 300,
        height: 100,
        age: 10,
        targetWeight: null,
        bodyGoal: null,
      },
      reloadBlocked: true,
    });
});

test('settings account rejects invalid workout backup files without partial writes', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const existing = [
      {
        id: 'existing-workout',
        date: '2026-03-18T09:00:00.000Z',
        type: 'forge',
        program: 'forge',
        exercises: [],
      },
    ];
    workouts = existing;
    localStorage.setItem('ic_workouts::e2e-user', JSON.stringify(existing));
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
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
        local: localStorage.getItem('ic_workouts::e2e-user'),
        workoutIds: (workouts || []).map((workout) => workout.id),
      }))
    )
    .toEqual({
      local: JSON.stringify([
        {
          id: 'existing-workout',
          date: '2026-03-18T09:00:00.000Z',
          type: 'forge',
          program: 'forge',
          exercises: [],
        },
      ]),
      workoutIds: ['existing-workout'],
    });
});

test('settings account rejects unknown backup sections before showing the confirm flow', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    localStorage.removeItem('ic_workouts::e2e-user');
    workouts = [];
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  const backup = JSON.stringify({
    version: 1,
    exported: '2026-03-20T10:00:00.000Z',
    workouts: [],
    profile: {
      language: 'en',
      defaultRest: 120,
    },
    rogueSection: {
      injected: true,
    },
  });

  await page.locator('[data-ui="settings-backup-import"]').setInputFiles({
    name: 'ironforge-backup-unknown-section.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf8'),
  });

  await expect(page.locator('#confirm-modal')).not.toHaveClass(/active/);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        local: localStorage.getItem('ic_workouts::e2e-user'),
        workoutCount: (workouts || []).length,
      }))
    )
    .toEqual({
      local: null,
      workoutCount: 0,
    });
});

test('settings account rejects a malformed workout entry and leaves the whole backup unapplied', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    localStorage.removeItem('ic_workouts::e2e-user');
    workouts = [];
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  const backup = JSON.stringify({
    version: 1,
    exported: '2026-03-20T10:00:00.000Z',
    workouts: [
      {
        id: 'valid-workout',
        date: '2026-03-10T09:00:00.000Z',
        type: 'forge',
        program: 'forge',
        exercises: [],
      },
      {
        id: 'broken-workout',
        date: '2026-03-11T09:00:00.000Z',
        type: 'forge',
      },
    ],
  });

  await page.locator('[data-ui="settings-backup-import"]').setInputFiles({
    name: 'ironforge-backup-malformed-entry.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf8'),
  });

  await expect(page.locator('#confirm-modal')).not.toHaveClass(/active/);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        local: localStorage.getItem('ic_workouts::e2e-user'),
        workoutCount: (workouts || []).length,
      }))
    )
    .toEqual({
      local: null,
      workoutCount: 0,
    });
});

test('settings account rejects oversized backup files before parsing them', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const existing = [
      {
        id: 'existing-workout',
        date: '2026-03-18T09:00:00.000Z',
        type: 'forge',
        program: 'forge',
        exercises: [],
      },
    ];
    workouts = existing;
    localStorage.setItem('ic_workouts::e2e-user', JSON.stringify(existing));
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  await page.locator('[data-ui="settings-backup-import"]').setInputFiles({
    name: 'ironforge-backup-too-large.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 64, 'a'),
  });

  await expect(page.locator('#confirm-modal')).not.toHaveClass(/active/);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        local: localStorage.getItem('ic_workouts::e2e-user'),
        workoutIds: (workouts || []).map((workout) => workout.id),
      }))
    )
    .toEqual({
      local: JSON.stringify([
        {
          id: 'existing-workout',
          date: '2026-03-18T09:00:00.000Z',
          type: 'forge',
          program: 'forge',
          exercises: [],
        },
      ]),
      workoutIds: ['existing-workout'],
    });
});

test('settings account rejects duplicate workout ids without partial writes', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    localStorage.removeItem('ic_workouts::e2e-user');
    workouts = [];
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  const backup = JSON.stringify({
    version: 1,
    exported: '2026-03-20T10:00:00.000Z',
    workouts: [
      {
        id: 'duplicate-workout',
        date: '2026-03-10T09:00:00.000Z',
        type: 'forge',
        program: 'forge',
        exercises: [],
      },
      {
        id: 'duplicate-workout',
        date: '2026-03-11T09:00:00.000Z',
        type: 'forge',
        program: 'forge',
        exercises: [],
      },
    ],
  });

  await page.locator('[data-ui="settings-backup-import"]').setInputFiles({
    name: 'ironforge-backup-duplicate-id.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf8'),
  });

  await expect(page.locator('#confirm-modal')).not.toHaveClass(/active/);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        local: localStorage.getItem('ic_workouts::e2e-user'),
        workoutCount: (workouts || []).length,
      }))
    )
    .toEqual({
      local: null,
      workoutCount: 0,
    });
});

test('settings account rejects invalid workout dates without partial writes', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    localStorage.removeItem('ic_workouts::e2e-user');
    workouts = [];
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  const backup = JSON.stringify({
    version: 1,
    exported: '2026-03-20T10:00:00.000Z',
    workouts: [
      {
        id: 'bad-date-workout',
        date: 'not-a-real-date',
        type: 'forge',
        program: 'forge',
        exercises: [],
      },
    ],
  });

  await page.locator('[data-ui="settings-backup-import"]').setInputFiles({
    name: 'ironforge-backup-invalid-date.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf8'),
  });

  await expect(page.locator('#confirm-modal')).not.toHaveClass(/active/);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        local: localStorage.getItem('ic_workouts::e2e-user'),
        workoutCount: (workouts || []).length,
      }))
    )
    .toEqual({
      local: null,
      workoutCount: 0,
    });
});

test('legacy toast undo keeps hostile message content inert', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      __toastUndoTriggered?: false | 'undo-clicked' | true;
      showToast?: (
        msg: string,
        color: string,
        undoFn?: () => void
      ) => void;
    };
    runtimeWindow.__toastUndoTriggered = false;
    runtimeWindow.showToast?.(
      '<img src=x onerror="window.__toastUndoTriggered=true"> inert',
      'var(--green)',
      () => {
        runtimeWindow.__toastUndoTriggered = 'undo-clicked';
      }
    );
  });

  await expect(page.locator('#toast img')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText(
    '<img src=x onerror="window.__toastUndoTriggered=true"> inert'
  );
  await page.locator('#t-undo').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const runtimeWindow = window as Window & {
          __toastUndoTriggered?: false | 'undo-clicked' | true;
        };
        return runtimeWindow.__toastUndoTriggered;
      })
    )
    .toBe('undo-clicked');
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
  expect(
    shellSecurity.scripts.some((src) => src?.endsWith('/vendor/supabase.js'))
  ).toBe(true);
  expect(shellSecurity.scripts.some((src) => src?.includes('jsdelivr'))).toBe(
    false
  );
});

test('clearAllData resets the schedule sport name to blank and keeps it blank after reload', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    const runtimeWindow = window as Window & {
      saveScheduleData?: (options?: { push?: boolean }) => Promise<void>;
      clearAllData?: () => Promise<void>;
    };

    schedule = {
      sportName: 'Padel',
      sportDays: [1, 3],
      sportIntensity: 'moderate',
      sportLegsHeavy: true,
    };
    await runtimeWindow.saveScheduleData?.({ push: false });
    await runtimeWindow.clearAllData?.();
  });

  await expect
    .poll(() => page.evaluate(() => schedule.sportName), { timeout: 15000 })
    .toBe('');

  await reloadAppShell(page);

  await expect
    .poll(() => page.evaluate(() => schedule.sportName), { timeout: 15000 })
    .toBe('');
});
