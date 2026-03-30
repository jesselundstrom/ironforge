import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

async function openScheduleTab(
  page: import('@playwright/test').Page,
  scheduleSnapshot: Record<string, unknown>
) {
  await page.evaluate((snapshot) => {
    window.__IRONFORGE_E2E__?.app?.setLegacyRuntimeState?.({
      schedule: snapshot,
    });
    window.__IRONFORGE_E2E__?.settings?.openTab?.('schedule');
  }, scheduleSnapshot);
}

test('settings schedule island renders from the legacy bridge and saves schedule changes', async ({
  page,
}) => {
  await openAppShell(page);
  await openScheduleTab(page, {
    sportName: 'Hockey',
    sportDays: [2, 4],
    sportIntensity: 'hard',
    sportLegsHeavy: true,
  });

  await expect(page.locator('#settings-schedule-legacy-shell')).toHaveCount(0);
  await expect(
    page.locator('#settings-schedule-react-root #sport-name')
  ).toHaveValue('Hockey');

  await page.evaluate(() => {
    const sportName = document.getElementById('sport-name');
    if (sportName instanceof HTMLInputElement) sportName.value = 'Padel';
    saveSchedule({
      sportName: 'Padel',
      sportIntensity: 'moderate',
      sportLegsHeavy: false,
      sportDays: [1, 2, 4],
    });
  });

  const saved = await page.evaluate(() => ({
    sportName: schedule.sportName,
    sportIntensity: schedule.sportIntensity,
    sportLegsHeavy: schedule.sportLegsHeavy,
    sportDays: [...schedule.sportDays].sort((a, b) => a - b),
  }));

  expect(saved?.sportName).toBe('Padel');
  expect(saved?.sportIntensity).toBe('moderate');
  expect(saved?.sportLegsHeavy).toBe(false);
  expect(saved?.sportDays).toEqual([1, 2, 4]);
  await expect(page.locator('#sport-status-bar')).toContainText(/padel/i);
});

test('settings schedule island autosaves sport name before blur', async ({ page }) => {
  await openAppShell(page);
  await openScheduleTab(page, {
    sportName: 'Hockey',
    sportDays: [2, 4],
    sportIntensity: 'hard',
    sportLegsHeavy: true,
  });

  const sportNameInput = page.locator('#settings-schedule-react-root #sport-name');
  await sportNameInput.fill('Padel');

  await expect
    .poll(() => page.evaluate(() => schedule.sportName), { timeout: 15000 })
    .toBe('Padel');
});

test('settings schedule island keeps sport name empty when the field is cleared', async ({
  page,
}) => {
  await openAppShell(page);
  await openScheduleTab(page, {
    sportName: 'Kestavyys',
    sportDays: [2, 4],
    sportIntensity: 'hard',
    sportLegsHeavy: true,
  });

  const sportNameInput = page.locator('#settings-schedule-react-root #sport-name');
  await sportNameInput.fill('');
  await sportNameInput.blur();

  await expect
    .poll(() => page.evaluate(() => schedule.sportName), { timeout: 15000 })
    .toBe('');
  await expect(sportNameInput).toHaveValue('');
  await expect(page.locator('#sport-status-bar')).toContainText(/sport \/ cardio/i);
});

test('settings schedule island updates sport name even when active program state is missing', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      profile: {
        ...(window.profile || {}),
        activeProgram: 'forge',
        programs: {},
      },
    });
  });
  await openScheduleTab(page, {
    sportName: 'Kestavyys',
    sportDays: [1, 3],
    sportIntensity: 'moderate',
    sportLegsHeavy: true,
  });

  const sportNameInput = page.locator('#settings-schedule-react-root #sport-name');
  await sportNameInput.fill('Padel');
  await sportNameInput.blur();

  await expect
    .poll(() => page.evaluate(() => schedule.sportName), { timeout: 15000 })
    .toBe('Padel');
  await expect(sportNameInput).toHaveValue('Padel');
  await expect(page.locator('#sport-status-bar')).toContainText(/padel/i);
});

test('settings schedule island refreshes translated labels after language changes', async ({
  page,
}) => {
  await openAppShell(page);
  await openScheduleTab(page, {
    sportName: 'Cardio',
    sportDays: [1, 3],
    sportIntensity: 'easy',
    sportLegsHeavy: true,
  });

  await expect(page.locator('#settings-schedule-react-root')).toContainText(
    /sport load/i
  );

  await page.evaluate(() => {
    I18N.setLanguage('fi', { persist: false });
  });

  await expect
    .poll(() => page.locator('#settings-schedule-react-root').textContent(), {
      timeout: 15000,
    })
    .toMatch(/lajikuorma/i);
  await expect
    .poll(() => page.locator('#settings-schedule-react-root').textContent(), {
      timeout: 15000,
    })
    .toMatch(/saannolliset urheilupaivat|säännölliset urheilupäivät/i);
});

test('settings schedule status bar renders sport names as text, not HTML', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.__sportNameXssTriggered = false;
    window.saveSchedule({
      sportName: '<img src=x onerror="window.__sportNameXssTriggered=true">',
      sportIntensity: 'moderate',
      sportLegsHeavy: false,
      sportDays: [1, 3],
    });
  });

  await expect(page.locator('#sport-status-bar img')).toHaveCount(0);
  await expect(page.locator('#sport-status-bar')).toContainText(
    '<img src=x onerror="window.__sportNameXssTriggered=true">'
  );

  const triggered = await page.evaluate(
    () => window.__sportNameXssTriggered === true
  );
  expect(triggered).toBe(false);
});
