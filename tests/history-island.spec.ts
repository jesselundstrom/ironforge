import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('history island renders read-only cards and refreshes from the legacy bridge', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      workouts = [{
        id: 101,
        date: '2026-03-10T09:00:00.000Z',
        program: 'forge',
        type: 'forge',
        programDayNum: 1,
        programMeta: { week: 1 },
        programLabel: 'Forge · Day 1',
        duration: 1800,
        rpe: 7,
        exercises: [{
          name: 'Bench Press',
          sets: [{ weight: 80, reps: 5, done: true }]
        }]
      }];
      renderHistory();
      showPage('history', document.querySelectorAll('.nav-btn')[2]);
    `);
  });

  await expect(page.locator('.hist-card')).toHaveCount(1);
  await expect(page.locator('.hist-delete-btn')).toHaveCount(0);

  await page.evaluate(() => {
    window.eval(`
      workouts = workouts.concat([{
        id: 102,
        date: '2026-03-11T09:00:00.000Z',
        program: 'forge',
        type: 'forge',
        programDayNum: 2,
        programMeta: { week: 1 },
        programLabel: 'Forge · Day 2',
        duration: 1500,
        rpe: 8,
        exercises: [{
          name: 'Squat',
          sets: [{ weight: 100, reps: 5, done: true }]
        }]
      }]);
      renderHistory();
    `);
  });

  await expect(page.locator('.hist-card')).toHaveCount(2);
});

test('history island switches to stats without leaving the legacy shell', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      workouts = [{
        id: 201,
        date: '2026-03-12T09:00:00.000Z',
        program: 'forge',
        type: 'forge',
        programDayNum: 1,
        programMeta: { week: 2 },
        programLabel: 'Forge · Day 1',
        duration: 1800,
        rpe: 7,
        exercises: [{
          name: 'Bench Press',
          sets: [{ weight: 82.5, reps: 5, done: true }]
        }]
      }];
      renderHistory();
      showPage('history', document.querySelectorAll('.nav-btn')[2]);
    `);
  });

  await page.getByRole('tab', { name: /^stats$/i }).click();

  await expect(page.locator('#history-stats')).toBeVisible();
  await expect(page.locator('#history-log')).toBeHidden();
  await expect(page.locator('#stats-numbers-grid')).toContainText(/total sessions/i);
});
