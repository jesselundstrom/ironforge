import { expect, test } from '@playwright/test';
import { completeOnboardingForTests, confirmModal, openAppShell } from './helpers';

test('history page renders read-only cards and refreshes from store-owned data', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [{
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
      }],
      profile: window.profile || null,
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
  });

  await expect
    .poll(() => page.locator('.hist-card').count(), { timeout: 15000 })
    .toBe(1);
  await expect(page.locator('.hist-delete-btn')).toHaveCount(1);

  await page.evaluate(async () => {
    const runtimeWindow = window as Window & {
      switchHistoryStatsRange?: (range: string) => void;
      toggleHeatmap?: () => void;
    };
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [
        {
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
        },
        {
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
        }
      ],
      profile: window.profile || null,
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
  });

  await expect
    .poll(() => page.locator('.hist-card').count(), { timeout: 15000 })
    .toBe(2);
});

test('history page switches to stats without leaving the shared shell', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [{
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
      }],
      profile: window.profile || null,
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
  });

  await page.waitForFunction(() => (window as any).getActivePageName?.() === 'history');
  await page.evaluate(() => (window as any).switchHistoryTab?.('stats'));
  await page.waitForFunction(() => {
    const stats = document.getElementById('history-stats');
    const log = document.getElementById('history-log');
    return stats?.style.display === 'block' && log?.style.display === 'none';
  });
  await expect(page.locator('#stats-numbers-grid .stats-num-card')).toHaveCount(4);
});

test('history log uses the main page scroller on narrow screens when weeks are expanded', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAppShell(page);

  await page.evaluate(async () => {
    const workouts = Array.from({ length: 12 }, (_, index) => {
      const weekOffset = Math.floor(index / 2);
      const dayOffset = index % 2 === 0 ? 1 : 4;
      const date = new Date(Date.UTC(2026, 2, 30 - weekOffset * 7 - dayOffset, 9));
      const workoutId = 500 + index;
      const dayNum = (index % 4) + 1;

      return {
        id: workoutId,
        date: date.toISOString(),
        program: 'forge',
        type: 'forge',
        programDayNum: dayNum,
        programMeta: { week: weekOffset + 1 },
        programLabel: `Forge Day ${dayNum}`,
        duration: 1800,
        rpe: 7 + (index % 3),
        exercises: [
          {
            name: index % 2 === 0 ? 'Bench Press' : 'Squat',
            sets: [{ weight: 70 + index * 2.5, reps: 5, done: true }],
          },
        ],
      };
    });

    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts,
      profile: window.profile || null,
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
  });

  await page.waitForFunction(() => (window as any).getActivePageName?.() === 'history');
  await page.evaluate(() => {
    document.querySelectorAll('.hist-week-details').forEach((details) => {
      if (details instanceof HTMLDetailsElement) {
        details.open = true;
      }
    });
  });

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const content = document.querySelector('.content');
        const historyLog = document.getElementById('history-log');
        if (!(content instanceof HTMLElement) || !(historyLog instanceof HTMLElement)) {
          return null;
        }

        const historyOverflowY = getComputedStyle(historyLog).overflowY;
        const contentScrollable = content.scrollHeight > content.clientHeight;
        return { historyOverflowY, contentScrollable };
      })
    )
    .toEqual({ historyOverflowY: 'visible', contentScrollable: true });

  await page.evaluate(() => {
    const content = document.querySelector('.content');
    if (content instanceof HTMLElement) {
      content.scrollTop = content.scrollHeight;
    }
  });

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const content = document.querySelector('.content');
        const lastCard = document.querySelector('#history-list .hist-card:last-of-type');
        if (!(content instanceof HTMLElement) || !(lastCard instanceof HTMLElement)) {
          return null;
        }

        const contentRect = content.getBoundingClientRect();
        const lastRect = lastCard.getBoundingClientRect();
        return {
          contentScrollTop: content.scrollTop,
          lastCardReachedViewport: lastRect.bottom <= contentRect.bottom,
        };
      })
    )
    .toEqual({ contentScrollTop: expect.any(Number), lastCardReachedViewport: true });
});

test('history stats show range controls, extra charts, and milestones for progressive lifting data', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);

  await page.evaluate(async () => {
    const forgeState = (window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge') || {
      lifts: { main: [] },
    }) as Record<string, unknown> & {
      lifts: { main: Array<Record<string, unknown>> };
    };
    const makeState = (
      bench: number,
      squat: number,
      deadlift: number,
      ohp: number
    ) => ({
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

    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: seed,
      profile: {
        ...(window.profile || {}),
        bodyMetrics: { ...((window.profile?.bodyMetrics as Record<string, unknown>) || {}), weight: 80 },
      },
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
  });

  await page.waitForFunction(() => (window as any).getActivePageName?.() === 'history');
  await page.evaluate(() => {
    (window as any).switchHistoryTab?.('stats');
    (window as any).renderHistory?.();
  });
  await page.waitForFunction(() => {
    const stats = document.getElementById('history-stats');
    return stats?.style.display === 'block';
  });

  await expect(page.locator('.stats-range-btn')).toHaveCount(3);
  await expect(page.locator('#stats-e1rm-wrap')).toContainText(/Estimated 1RM|Arvioitu 1RM/i);
  await expect(page.locator('#stats-tm-wrap')).toContainText(/Training Max Trend|Treenimaksimin trendi/i);
  await expect(page.locator('#stats-strength-wrap')).toHaveCount(1);

  await page.click('.stats-range-btn[data-range="all"]');
  await expect(page.locator('.stats-range-btn.active')).toContainText(/All|Kaikki/i);
});

test('history stats keep front squat and sumo deadlift out of the main lift trend lines', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    const runtimeWindow = window as Window & {
      switchHistoryStatsRange?: (range: string) => void;
      toggleHeatmap?: () => void;
    };
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [
        {
          id: 401,
          date: '2026-02-01T09:00:00.000Z',
          program: 'forge',
          type: 'forge',
          programDayNum: 1,
          programMeta: { week: 1 },
          programLabel: 'Forge Day 1',
          exercises: [
            { name: 'Front Squat', sets: [{ weight: 90, reps: 5, done: true }] },
            { name: 'Bench Press', sets: [{ weight: 80, reps: 5, done: true }] }
          ]
        },
        {
          id: 402,
          date: '2026-02-08T09:00:00.000Z',
          program: 'forge',
          type: 'forge',
          programDayNum: 2,
          programMeta: { week: 2 },
          programLabel: 'Forge Day 2',
          exercises: [
            { name: 'Sumo Deadlift', sets: [{ weight: 140, reps: 5, done: true }] },
            { name: 'OHP', sets: [{ weight: 50, reps: 5, done: true }] }
          ]
        },
        {
          id: 403,
          date: '2026-02-15T09:00:00.000Z',
          program: 'forge',
          type: 'forge',
          programDayNum: 3,
          programMeta: { week: 3 },
          programLabel: 'Forge Day 3',
          exercises: [
            { name: 'Squat', sets: [{ weight: 100, reps: 5, done: true }] },
            { name: 'Deadlift', sets: [{ weight: 160, reps: 5, done: true }] }
          ]
        }
      ],
      profile: window.profile || null,
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
    window.switchHistoryTab?.('stats');
  });

  await page.waitForFunction(() => {
    const stats = document.getElementById('history-stats');
    return stats?.style.display === 'block';
  });

  const liftCounts = await page.evaluate(() => {
    return Object.fromEntries(
      Array.from(document.querySelectorAll('.stats-legend-item')).map((node) => [
        node.getAttribute('data-lift-key'),
        Number(node.getAttribute('data-point-count') || '0'),
      ])
    );
  });

  expect(liftCounts.squat).toBe(1);
  expect(liftCounts.deadlift).toBe(1);
  expect(liftCounts.bench).toBe(1);
  expect(liftCounts.ohp).toBe(1);
});

test('history compatibility helpers still delegate to the typed store view', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(async () => {
    const runtimeWindow = window as Window & {
      switchHistoryStatsRange?: (range: string) => void;
      toggleHeatmap?: () => void;
    };
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [
        {
          id: 501,
          date: '2026-03-01T09:00:00.000Z',
          program: 'forge',
          type: 'forge',
          programDayNum: 1,
          programMeta: { week: 1 },
          programLabel: 'Forge Day 1',
          duration: 1800,
          rpe: 7,
          exercises: [
            { name: 'Bench Press', sets: [{ weight: 80, reps: 5, done: true }] },
          ],
        },
      ],
      profile: window.profile || null,
      schedule: window.schedule || null,
    });
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
    window.switchHistoryTab?.('stats');
    runtimeWindow.switchHistoryStatsRange?.('all');
    runtimeWindow.toggleHeatmap?.();
    window.renderHistory?.();
  });

  await page.waitForFunction(() => {
    const stats = document.getElementById('history-stats');
    const activeRange = document
      .querySelector('.stats-range-btn.active')
      ?.getAttribute('data-range');
    const heatmap = document.querySelector('.heatmap-wrap');
    return (
      stats?.style.display === 'block' &&
      activeRange === 'all' &&
      heatmap?.classList.contains('open') === true
    );
  });

  await expect(page.locator('.heatmap-wrap')).toHaveClass(/open/);
  await expect(page.locator('.stats-range-btn.active')).toContainText(/All|Kaikki/i);
});

test('history delete removes the workout through the current typed runtime', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);

  await page.evaluate(async () => {
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [
        {
          id: 601,
          date: '2026-03-10T09:00:00.000Z',
          program: 'forge',
          type: 'forge',
          programDayNum: 1,
          programMeta: { week: 1 },
          programLabel: 'Forge Day 1',
          duration: 1800,
          rpe: 7,
          exercises: [
            {
              name: 'Bench Press',
              sets: [{ weight: 80, reps: 5, done: true }],
            },
          ],
        },
      ],
      profile: {
        ...(window.profile || {}),
        activeProgram: 'forge',
        programs: {
          forge: {
            week: 1,
            lastCompletedDay: 1,
          },
        },
      },
      schedule: window.schedule || null,
    });

    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('history');
  });

  await expect(page.locator('.hist-card')).toHaveCount(1);

  await page.locator('.hist-delete-btn').first().click({ force: true });
  await confirmModal(page);

  await expect(page.locator('#toast')).toContainText(/workout deleted|treeni poistettu/i);

  await expect
    .poll(() =>
      page.evaluate(() => ({
        workoutIds: Array.isArray(window.workouts)
          ? window.workouts.map((workout) => String(workout?.id || ''))
          : [],
      })),
      { timeout: 15000 }
    )
    .toEqual({
      workoutIds: [],
    });
});
