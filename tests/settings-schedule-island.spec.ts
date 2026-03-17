import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('settings schedule island renders from the legacy bridge and saves schedule changes', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      schedule = {
        sportName: 'Hockey',
        sportDays: [2, 4],
        sportIntensity: 'hard',
        sportLegsHeavy: true
      };
      initSettings();
      showPage('settings', document.querySelectorAll('.nav-btn')[3]);
      showSettingsTab('schedule');
    `);
  });

  await expect(page.locator('#settings-schedule-legacy-shell')).toHaveCount(0);
  await expect(page.locator('#settings-schedule-react-root #sport-name')).toHaveValue('Hockey');

  await page.locator('#settings-schedule-react-root #sport-name').fill('Padel');
  await page.locator('#settings-schedule-react-root #sport-name').blur();
  await page
    .locator('#settings-schedule-react-root button[data-intensity="moderate"]')
    .click();
  await page
    .locator('#settings-schedule-react-root label[for="sport-legs-heavy"] .toggle-track')
    .click();
  await page.evaluate(() => {
    window.eval(`saveSchedule({ sportDays: [1, 2, 4] })`);
  });

  const saved = await page.evaluate(() =>
    window.eval(`({
      sportName: schedule.sportName,
      sportIntensity: schedule.sportIntensity,
      sportLegsHeavy: schedule.sportLegsHeavy,
      sportDays: [...schedule.sportDays].sort((a, b) => a - b)
    })`)
  );

  expect(saved?.sportName).toBe('Padel');
  expect(saved?.sportIntensity).toBe('moderate');
  expect(saved?.sportLegsHeavy).toBe(false);
  expect(saved?.sportDays).toEqual([1, 2, 4]);
  await expect(page.locator('#sport-status-bar')).toContainText(/padel/i);
});

test('settings schedule island refreshes translated labels after language changes', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      schedule = {
        sportName: 'Cardio',
        sportDays: [1, 3],
        sportIntensity: 'easy',
        sportLegsHeavy: true
      };
      initSettings();
      showPage('settings', document.querySelectorAll('.nav-btn')[3]);
      showSettingsTab('schedule');
    `);
  });

  await expect(page.locator('#settings-schedule-react-root')).toContainText(/sport load/i);

  await page.evaluate(() => {
    window.eval(`I18N.setLanguage('fi', { persist: false });`);
  });

  await expect(page.locator('#settings-schedule-react-root')).toContainText(/lajikuorma/i);
  await expect(page.locator('#settings-schedule-react-root')).toContainText(
    /säännölliset urheilupäivät/i
  );
});
