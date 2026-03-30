import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('dashboard island renders from store-owned data and removes the fallback shell', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    const forgeState = window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge');
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [{
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
      }],
      profile: {
        ...(window.profile || {}),
        activeProgram: 'forge',
        programs: { ...((window.profile?.programs as Record<string, unknown>) || {}), forge: forgeState },
      },
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('dashboard');
  });

  await expect(page.locator('#dashboard-legacy-shell')).toHaveCount(0);
  await expect(page.locator('#dashboard-react-root .dashboard-section')).toHaveCount(4);
  await expect(page.locator('#today-status')).toContainText(/treeni kirjattu|workout/i);
  await expect(page.locator('.dashboard-plan-stack')).toBeVisible();
  await expect(page.locator('.dashboard-maxes-card')).toBeVisible();
});

test('dashboard rhythm card shows summary, featured metric, and supporting signals', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    const forgeState = window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge');
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

    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: seeds,
      profile: {
        ...(window.profile || {}),
        activeProgram: 'forge',
        preferences: { ...((window.profile?.preferences as Record<string, unknown>) || {}), trainingDaysPerWeek: 4 },
        programs: { ...((window.profile?.programs as Record<string, unknown>) || {}), forge: forgeState },
      },
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('dashboard');
  });

  await expect(page.locator('.dashboard-plan-summary-title')).not.toBeEmpty();
  await expect(page.locator('.dashboard-plan-summary-body')).not.toBeEmpty();
  await expect(page.locator('.dashboard-plan-support-chip')).toHaveCount(2);
  await expect(page.locator('.dashboard-plan-insight-row')).toHaveCount(2);
});

test('dashboard rhythm card keeps sparse states compact', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    const forgeState = window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge');
    const date = new Date();
    date.setDate(date.getDate() - 20);

    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [{
        id: 610,
        date: date.toISOString(),
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
      }],
      profile: {
        ...(window.profile || {}),
        activeProgram: 'forge',
        preferences: { ...((window.profile?.preferences as Record<string, unknown>) || {}), trainingDaysPerWeek: 3 },
        programs: { ...((window.profile?.programs as Record<string, unknown>) || {}), forge: forgeState },
      },
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('dashboard');
  });

  await expect(page.locator('.dashboard-plan-primary-metric-value')).toContainText('%');
  await expect(page.locator('.dashboard-plan-support-chip')).toHaveCount(1);
  await expect(page.locator('.dashboard-plan-insight-row')).toHaveCount(1);
});

test('dashboard island keeps week strip detail toggling working', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [],
      profile: window.profile || null,
      schedule: {
        ...(window.schedule || {}),
        sportDays: [new Date().getDay()],
      },
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('dashboard');
  });

  await page.waitForFunction(
    () => document.querySelectorAll('#week-strip .day-pill').length > 0
  );
  await page.evaluate(() => {
    const firstDayPill = document.querySelector('#week-strip .day-pill');
    if (firstDayPill instanceof HTMLButtonElement) {
      firstDayPill.click();
    }
  });

  await expect(page.locator('#day-detail-panel')).toBeVisible();
  await expect(page.locator('#day-detail-panel')).toContainText(
    /pÃ¤ivÃ¤|treeni|sport|no session logged/i
  );
});

test('dashboard coach card shows a rotating rest-day tip when the week is complete', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    const forgeState = window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge');
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

    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [],
      profile: {
        ...(window.profile || {}),
        activeProgram: 'forge',
        preferences: {
          ...((window.profile?.preferences as Record<string, unknown>) || {}),
          trainingDaysPerWeek: completedCount,
        },
        programs: { ...((window.profile?.programs as Record<string, unknown>) || {}), forge: forgeState },
      },
      schedule: window.schedule || null,
    });

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

    const originalGetTodayTrainingDecision = window.getTodayTrainingDecision;
    window.getTodayTrainingDecision = function patchedRestDecision(
      context?: Record<string, unknown> | null
    ) {
      const base = typeof originalGetTodayTrainingDecision === 'function'
        ? (originalGetTodayTrainingDecision(context) || {})
        : {};
      return {
        ...base,
        action: 'rest',
        reasonCodes: ['week_complete'],
        restrictionFlags: base.restrictionFlags || [],
        timeBudgetMinutes: base.timeBudgetMinutes || 60
      };
    };

    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: seededWorkouts,
      profile: window.profile || null,
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('dashboard');
  });

  await expect(page.locator('.dashboard-plan-section-coach')).toBeVisible();
  await expect(page.locator('.dashboard-plan-card-head-coach')).toContainText(
    /Recovery|Palautuminen/i
  );
  await expect(page.locator('.dashboard-plan-coach-copy')).not.toContainText(
    /Today, prioritize crisp top sets|TÃ¤mÃ¤n pÃ¤ivÃ¤n pÃ¤Ã¤tyÃ¶/
  );
});

test('dashboard fatigue delegate stays wired to typed stores after the legacy owner extraction', async ({
  page,
}) => {
  await openAppShell(page);

  const fatigue = await page.evaluate(async () => {
    const runtimeWindow = window as Window & {
      computeFatigue?: () => Record<string, unknown> | null;
    };
    const forgeState = window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge');
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [
        {
          id: 510,
          date: today.toISOString(),
          program: 'forge',
          type: 'forge',
          programDayNum: 1,
          programMeta: { week: 1 },
          programLabel: 'Forge Day 1',
          duration: 1800,
          rpe: 8,
          exercises: [
            {
              name: 'Bench Press',
              sets: [{ weight: 82.5, reps: 5, done: true }],
            },
          ],
        },
      ],
      profile: {
        ...(window.profile || {}),
        activeProgram: 'forge',
        programs: {
          ...((window.profile?.programs as Record<string, unknown>) || {}),
          forge: forgeState,
        },
      },
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('dashboard');
    return runtimeWindow.computeFatigue?.() || null;
  });

  expect(fatigue).not.toBeNull();
  expect(typeof fatigue?.overall).toBe('number');
  expect(typeof fatigue?.muscular).toBe('number');
  expect(typeof fatigue?.cns).toBe('number');
  await expect(page.locator('#dashboard-react-root .dashboard-section')).toHaveCount(4);
});
