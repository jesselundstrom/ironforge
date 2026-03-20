import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test.describe.configure({ mode: 'serial' });

async function openActiveWorkout(page: Page) {
  await page.evaluate(() => {
    window.showPage('log', document.querySelectorAll('.nav-btn')[1]);
    (window as any).startWorkout();
  });

  await page.waitForFunction(() => (window as any).getActivePageName?.() === 'log');
  await page.waitForFunction(() => {
    const shell = document.querySelector('#log-active-react-root #workout-active');
    return (
      shell instanceof HTMLElement &&
      shell.style.display !== 'none' &&
      shell.querySelectorAll('.exercise-block').length > 0
    );
  });
}

test('log active island renders the active workout editor through the legacy bridge', async ({
  page,
}) => {
  await openAppShell(page);
  await openActiveWorkout(page);

  const snapshot = await page.evaluate(() => window.eval('getLogActiveReactSnapshot()'));
  expect(String(snapshot?.values?.title || '')).toMatch(/\S/);
  expect(Array.isArray(snapshot?.values?.exercises) ? snapshot.values.exercises.length : 0).toBeGreaterThan(0);
});

test('log active island keeps set completion and rest timer controls working', async ({ page }) => {
  await openAppShell(page);
  await openActiveWorkout(page);

  const interactionResult = await page.evaluate(() => {
    const restSelect = document.getElementById('rest-duration');
    if (restSelect instanceof HTMLSelectElement) restSelect.value = '180';
    return window.eval(`(
      updateRestDuration(),
      toggleSet(0,0),
      {
        restDuration,
        done: activeWorkout.exercises[0].sets[0].done
      }
    )`);
  });

  expect(interactionResult.restDuration).toBe(180);
  expect(interactionResult.done).toBe(true);
});
