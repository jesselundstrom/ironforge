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
        programLabel: 'Forge Day 1',
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

  await page.waitForFunction(() => document.querySelectorAll('.hist-card').length === 1);
  await expect(page.locator('.hist-card')).toHaveCount(1);
  await expect(page.locator('.hist-delete-btn')).toHaveCount(1);

  await page.evaluate(() => {
    window.eval(`
      workouts = workouts.concat([{
        id: 102,
        date: '2026-03-11T09:00:00.000Z',
        program: 'forge',
        type: 'forge',
        programDayNum: 2,
        programMeta: { week: 1 },
        programLabel: 'Forge Day 2',
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

  await page.waitForFunction(() => document.querySelectorAll('.hist-card').length === 2);
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
        programLabel: 'Forge Day 1',
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

  await page.waitForFunction(() => (window as any).getActivePageName?.() === 'history');
  await page.evaluate(() => (window as any).switchHistoryTab?.('stats'));
  await page.waitForFunction(() => {
    const stats = document.getElementById('history-stats');
    const log = document.getElementById('history-log');
    return stats?.style.display === 'block' && log?.style.display === 'none';
  });
  await expect(page.locator('#stats-numbers-grid .stats-num-card')).toHaveCount(4);
  await expect(page.locator('#stats-numbers-grid')).not.toBeEmpty();
});

test('history stats show range controls, extra charts, and milestones for progressive lifting data', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));
    const makeState = (bench, squat, deadlift, ohp) => ({
      ...forgeState,
      lifts: {
        ...forgeState.lifts,
        main: [
          { name: 'Squat', tm: squat },
          { name: 'Bench Press', tm: bench },
          { name: 'Deadlift', tm: deadlift },
          { name: 'OHP', tm: ohp },
        ],
      },
    });

    const seed = [
      {
        id: 301,
        date: '2026-01-10T09:00:00.000Z',
        programDayNum: 1,
        bench: { weight: 72.5, reps: 6 },
        squat: { weight: 95, reps: 5 },
        state: makeState(75, 100, 120, 50),
      },
      {
        id: 302,
        date: '2026-02-07T09:00:00.000Z',
        programDayNum: 2,
        bench: { weight: 77.5, reps: 6 },
        squat: { weight: 102.5, reps: 5 },
        state: makeState(80, 105, 127.5, 52.5),
      },
      {
        id: 303,
        date: '2026-03-07T09:00:00.000Z',
        programDayNum: 3,
        bench: { weight: 85, reps: 6 },
        squat: { weight: 115, reps: 5 },
        state: makeState(87.5, 115, 140, 57.5),
      },
    ].map((item) => ({
      id: item.id,
      date: item.date,
      program: 'forge',
      type: 'forge',
      programDayNum: item.programDayNum,
      programMeta: { week: item.programDayNum },
      programLabel: `Forge Day ${item.programDayNum}`,
      duration: 2100,
      rpe: 8,
      programStateBefore: item.state,
      exercises: [
        {
          name: 'Bench Press',
          sets: [{ weight: item.bench.weight, reps: item.bench.reps, done: true }],
        },
        {
          name: 'Squat',
          sets: [{ weight: item.squat.weight, reps: item.squat.reps, done: true }],
        },
      ],
    }));

    window.eval(`
      profile.bodyMetrics = { ...(profile.bodyMetrics || {}), weight: 80 };
      workouts = ${JSON.stringify(seed)};
      renderHistory();
      showPage('history', document.querySelectorAll('.nav-btn')[2]);
    `);
  });

  await page.waitForFunction(() => (window as any).getActivePageName?.() === 'history');
  await page.evaluate(() => (window as any).switchHistoryTab?.('stats'));

  await expect(page.locator('.stats-range-btn')).toHaveCount(3);
  await expect(page.locator('#stats-strength-wrap')).toContainText(/Strength Progress|Voimakehitys/i);
  await expect(page.locator('#stats-e1rm-wrap')).toContainText(/Estimated 1RM|Arvioitu 1RM/i);
  await expect(page.locator('#stats-tm-wrap')).toContainText(/Training Max Trend|Treenimaksimin trendi/i);
  await expect(page.locator('.stats-milestone-badge')).toHaveCount(2);

  await page.click('.stats-range-btn[data-range="all"]');
  await expect(page.locator('.stats-range-btn.active')).toContainText(/All|Kaikki/i);
});
