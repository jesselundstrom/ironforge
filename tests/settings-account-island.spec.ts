import { expect, test } from '@playwright/test';
import { confirmModal, openAppShell, reloadAppShell } from './helpers';

test.describe.configure({ mode: 'serial' });

test('settings account island renders the signed-in nutrition coach state without key controls', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    currentUser = { id: 'e2e-user', email: 'account@example.com' };
    profile.language = 'en';
    workouts = [
      {
        id: 901,
        date: '2026-03-10T09:00:00.000Z',
        type: 'forge',
        exercises: [],
      },
    ];
    initSettings();
    window.showPage('settings', document.querySelectorAll('.nav-btn')[3]);
    showSettingsTab('account');
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
    currentUser = null;
    initSettings();
    window.showPage('settings', document.querySelectorAll('.nav-btn')[3]);
    showSettingsTab('account');
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
    initSettings();
    window.showPage('settings', document.querySelectorAll('.nav-btn')[3]);
    showSettingsTab('account');
  });

  await page.evaluate(() => {
    settingsAccountUiState = { dangerOpen: true, dangerInput: '' };
    notifySettingsAccountIsland();
  });

  expect(
    await page.evaluate(
      () => getSettingsAccountReactSnapshot().values.dangerOpen
    )
  ).toBe(true);
  expect(
    await page.evaluate(
      () => getSettingsAccountReactSnapshot().values.dangerDeleteDisabled
    )
  ).toBe(true);

  await page.evaluate(() => {
    const input = document.getElementById('danger-zone-input');
    if (!(input instanceof HTMLInputElement)) return;
    input.value = 'DEL';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    checkDangerConfirm('DEL');
  });
  expect(
    await page.evaluate(
      () => getSettingsAccountReactSnapshot().values.dangerDeleteDisabled
    )
  ).toBe(true);

  await page.evaluate(() => {
    const input = document.getElementById('danger-zone-input');
    if (!(input instanceof HTMLInputElement)) return;
    input.value = 'DELETE';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    checkDangerConfirm('DELETE');
  });
  expect(
    await page.evaluate(
      () => getSettingsAccountReactSnapshot().values.dangerDeleteDisabled
    )
  ).toBe(false);
});

test('settings account import keeps hostile workout labels inert after reload', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.__importWorkoutXssTriggered = false;
    initSettings();
    window.showPage('settings', document.querySelectorAll('.nav-btn')[3]);
    showSettingsTab('account');
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
    window.showPage('history', document.querySelectorAll('.nav-btn')[2]);
    renderHistory();
  });

  await expect(
    page.locator('.hist-card img, .hist-card svg, .hist-card script')
  ).toHaveCount(0);
  await expect(page.locator('.hist-card')).toContainText(
    '<img src=x onerror="window.__importWorkoutXssTriggered=true">'
  );
  await page.locator('.hist-delete-btn').click();
  await expect(page.locator('#confirm-modal')).toHaveClass(/active/);

  const triggered = await page.evaluate(
    () => window.__importWorkoutXssTriggered === true
  );
  expect(triggered).toBe(false);
});
