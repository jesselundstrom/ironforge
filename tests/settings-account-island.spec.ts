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
  await expect(page.locator('#settings-account-react-root')).toContainText(
    /account@example\.com/i
  );
  await expect(
    page.locator('#settings-account-react-root #backup-context')
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
    .locator('#settings-account-react-root input[type="file"]')
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
    .locator('#settings-account-react-root input[type="file"]')
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
