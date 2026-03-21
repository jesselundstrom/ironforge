import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('dashboard island renders from the legacy bridge and removes the fallback shell', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));
    window.eval(`
      workouts = [{
        id: 301,
        date: new Date().toISOString(),
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
      profile.activeProgram = 'forge';
      profile.programs = { ...(profile.programs || {}), forge: ${JSON.stringify(forgeState)} };
      updateDashboard();
      showPage('dashboard', document.querySelectorAll('.nav-btn')[0]);
    `);
  });

  await expect(page.locator('#dashboard-legacy-shell')).toHaveCount(0);
  await expect(page.locator('#dashboard-react-root .dashboard-section')).toHaveCount(4);
  await expect(page.locator('#dashboard-react-root .lift-stat').first()).toBeVisible();
  await expect(page.locator('#today-status')).toContainText(/treeni kirjattu|workout/i);
  await expect(page.locator('.dashboard-plan-summary-title')).toBeVisible();
  await expect(page.locator('.dashboard-plan-primary-metric-value')).toBeVisible();
});

test('dashboard rhythm card shows summary, featured metric, and supporting signals', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));
    const today = new Date();
    const seeds = Array.from({ length: 5 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - index * 2);
      return {
        id: 520 + index,
        date: date.toISOString(),
        program: 'forge',
        type: 'forge',
        programDayNum: (index % 3) + 1,
        programMeta: { week: 2 },
        programLabel: `Forge Day ${(index % 3) + 1}`,
        duration: 1800,
        rpe: 7,
        exercises: [
          {
            name: 'Bench Press',
            sets: [{ weight: 80 + index * 2.5, reps: 5, done: true }],
          },
        ],
      };
    });

    window.eval(`
      workouts = ${JSON.stringify(seeds)};
      profile.activeProgram = 'forge';
      profile.preferences = { ...(profile.preferences || {}), trainingDaysPerWeek: 4 };
      profile.programs = { ...(profile.programs || {}), forge: ${JSON.stringify(forgeState)} };
      updateDashboard();
      showPage('dashboard', document.querySelectorAll('.nav-btn')[0]);
    `);
  });

  await expect(page.locator('.dashboard-plan-summary-title')).not.toBeEmpty();
  await expect(page.locator('.dashboard-plan-summary-body')).not.toBeEmpty();
  await expect(page.locator('.dashboard-plan-primary-metric-value')).toContainText('%');
  await expect(page.locator('.dashboard-plan-support-chip')).toHaveCount(2);
  await expect(page.locator('.dashboard-plan-insight-row')).toHaveCount(2);
});

test('dashboard rhythm card keeps sparse states compact', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));
    const date = new Date();
    date.setDate(date.getDate() - 20);

    window.eval(`
      workouts = [{
        id: 610,
        date: '${date.toISOString()}',
        program: 'forge',
        type: 'forge',
        programDayNum: 1,
        programMeta: { week: 1 },
        programLabel: 'Forge Day 1',
        duration: 1800,
        rpe: 7,
        exercises: [{
          name: 'Bench Press',
          sets: [{ weight: 60, reps: 5, done: true }]
        }]
      }];
      profile.activeProgram = 'forge';
      profile.preferences = { ...(profile.preferences || {}), trainingDaysPerWeek: 3 };
      profile.programs = { ...(profile.programs || {}), forge: ${JSON.stringify(forgeState)} };
      updateDashboard();
      showPage('dashboard', document.querySelectorAll('.nav-btn')[0]);
    `);
  });

  await expect(page.locator('.dashboard-plan-primary-metric-value')).toContainText('%');
  await expect(page.locator('.dashboard-plan-support-chip')).toHaveCount(1);
  await expect(page.locator('.dashboard-plan-insight-row')).toHaveCount(1);
});

test('dashboard island keeps week strip detail toggling working', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.eval(`
      schedule.sportDays = [new Date().getDay()];
      workouts = [];
      updateDashboard();
      showPage('dashboard', document.querySelectorAll('.nav-btn')[0]);
    `);
  });

  const firstDayPill = page.locator('#week-strip .day-pill').first();
  await firstDayPill.click();

  await expect(page.locator('#day-detail-panel')).toBeVisible();
  await expect(page.locator('#day-detail-panel')).toContainText(
    /päivä|treeni|sport|no session logged/i
  );
});

test('dashboard coach card shows a rotating rest-day tip when the week is complete', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    const forgeState = JSON.parse(JSON.stringify(window.eval('PROGRAMS.forge.getInitialState()')));
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    weekStart.setHours(12, 0, 0, 0);

    const pastDates = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const candidate = new Date(weekStart);
      candidate.setDate(weekStart.getDate() + offset);
      candidate.setHours(12, 0, 0, 0);
      if (candidate.getTime() < today.getTime()) pastDates.push(candidate);
    }

    const completedCount = pastDates.length ? Math.min(3, pastDates.length) : 1;

    window.eval(`
      profile.activeProgram = 'forge';
      profile.preferences = { ...(profile.preferences || {}), trainingDaysPerWeek: ${completedCount} };
      profile.programs = { ...(profile.programs || {}), forge: ${JSON.stringify(forgeState)} };
      workouts = [];
    `);

    const seededWorkouts = pastDates.slice(0, completedCount).map((date, index) => ({
      id: 400 + index,
      date: date.toISOString(),
      program: 'forge',
      type: 'forge',
      programDayNum: index + 1,
      programMeta: { week: 1 },
      programLabel: `Forge Day ${index + 1}`,
      duration: 1800,
      rpe: 7,
      exercises: [
        {
          name: 'Bench Press',
          sets: [{ weight: 80 + index * 2.5, reps: 5, done: true }],
        },
      ],
    }));

    if (!pastDates.length) {
      window.eval(`
        const __originalGetTodayTrainingDecision = window.getTodayTrainingDecision;
        window.getTodayTrainingDecision = function patchedRestDecision(context) {
          const base = typeof __originalGetTodayTrainingDecision === 'function'
            ? (__originalGetTodayTrainingDecision(context) || {})
            : {};
          return {
            ...base,
            action: 'rest',
            reasonCodes: ['week_complete'],
            restrictionFlags: base.restrictionFlags || [],
            timeBudgetMinutes: base.timeBudgetMinutes || 60
          };
        };
      `);
    }

    window.eval(`
      workouts = ${JSON.stringify(seededWorkouts)};
      updateDashboard();
      showPage('dashboard', document.querySelectorAll('.nav-btn')[0]);
    `);
  });

  await expect(page.locator('.dashboard-plan-card-head-coach')).toContainText(
    /Recovery|Palautuminen/i
  );
  await expect(page.locator('.dashboard-plan-coach-copy')).not.toContainText(
    /Today, prioritize crisp top sets|Tämän päivän päätyö/
  );
});
