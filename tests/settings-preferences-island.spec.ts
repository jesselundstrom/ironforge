import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('settings preferences island renders from the legacy bridge and saves through existing handlers', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.settings?.openPreferencesTab?.({
      preferences: {
        goal: 'strength',
        trainingDaysPerWeek: 3,
        sessionMinutes: 60,
        equipmentAccess: 'full_gym',
        sportReadinessCheckEnabled: false,
        warmupSetsEnabled: true,
        notes: 'initial note',
      },
      defaultRest: 120,
    });
  });

  await expect(page.locator('#settings-preferences-legacy-shell')).toHaveCount(0);
  await expect(page.locator('#settings-preferences-react-root #training-goal')).toHaveValue(
    'strength'
  );

  await page.evaluate(() => {
    const goalSelect = document.getElementById('training-goal');
    const daysSelect = document.getElementById('training-days-per-week');
    const restSelect = document.getElementById('default-rest');
    const notesInput = document.getElementById('training-preferences-notes');
    if (goalSelect instanceof HTMLSelectElement) goalSelect.value = 'hypertrophy';
    if (daysSelect instanceof HTMLSelectElement) daysSelect.value = '4';
    if (restSelect instanceof HTMLSelectElement) restSelect.value = '180';
    if (notesInput instanceof HTMLTextAreaElement) notesInput.value = 'new note';
    window.saveTrainingPreferences?.();
    window.saveRestTimer?.();
  });

  const saved = await page.evaluate(() => ({
      goal: profile.preferences.goal,
      trainingDaysPerWeek: profile.preferences.trainingDaysPerWeek,
      defaultRest: profile.defaultRest,
      notes: profile.preferences.notes
    }));

  expect(saved?.goal).toBe('hypertrophy');
  expect(saved?.trainingDaysPerWeek).toBe(4);
  expect(saved?.defaultRest).toBe(180);
  expect(saved?.notes).toBe('new note');
  await expect(page.locator('#training-status-bar')).toContainText(/hypertrophy|4 sessions/i);
});

test('settings preferences island saves toggle changes immediately', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.settings?.openPreferencesTab?.({
      preferences: {
        goal: 'strength',
        trainingDaysPerWeek: 3,
        sessionMinutes: 60,
        equipmentAccess: 'full_gym',
        sportReadinessCheckEnabled: false,
        warmupSetsEnabled: false,
        notes: '',
      },
    });
  });

  await page
    .locator('#settings-preferences-react-root label[for="training-warmup-sets"]')
    .click();
  await page
    .locator('#settings-preferences-react-root label[for="training-sport-check"]')
    .click();

  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          warmupSetsEnabled: profile.preferences.warmupSetsEnabled,
          sportReadinessCheckEnabled: profile.preferences.sportReadinessCheckEnabled,
        })),
      { timeout: 15000 }
    )
    .toEqual({
      warmupSetsEnabled: true,
      sportReadinessCheckEnabled: true,
    });
});

test('settings preferences island refreshes labels and summary on language changes', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.settings?.openPreferencesTab?.({
      preferences: {
        goal: 'strength',
        trainingDaysPerWeek: 3,
        sessionMinutes: 60,
        equipmentAccess: 'full_gym',
      },
    });
  });

  await expect(page.locator('#settings-preferences-react-root')).toContainText(
    /training preferences/i
  );

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.i18n?.setLanguage?.('fi', { persist: false });
  });

  await expect
    .poll(() => page.locator('#settings-preferences-react-root').textContent(), {
      timeout: 15000,
    })
    .toMatch(/harjoituspreferenssit/i);
  await expect
    .poll(() => page.locator('#training-status-bar').textContent(), { timeout: 15000 })
    .toMatch(/treeniä \/ viikko/i);
});
