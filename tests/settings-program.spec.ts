import { expect, test } from '@playwright/test';
import {
  completeOnboardingForTests,
  openAppShell,
} from './helpers';

test('settings program page renders the program switcher and active summary', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.settings?.openProgramTab?.('forge');
  });

  await expect(page.locator('#settings-program-react-root')).toBeVisible();
  await expect(page.locator('#training-program-summary')).not.toBeEmpty();
  await expect(page.locator('[data-ui="program-card"]')).not.toHaveCount(0);
  await expect(
    page.locator('[data-ui="program-card"][data-state="active"]')
  ).toHaveCount(1);
});

test('settings program page switches the active program and persists it', async ({
  page,
}) => {
  await openAppShell(page);
  await completeOnboardingForTests(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.settings?.openProgramTab?.('forge');
  });

  const strongliftsCard = page
    .locator('[data-ui="program-card"]')
    .filter({ hasText: /stronglifts/i })
    .first();

  await strongliftsCard.click();
  await page
    .locator('#settings-program-react-root')
    .getByRole('button', { name: /use program/i })
    .click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        activeProgram: profile.activeProgram,
        storedProfile: localStorage.getItem('if2_profile::e2e-user'),
      }))
    )
    .toEqual({
      activeProgram: 'stronglifts5x5',
      storedProfile: expect.stringContaining('stronglifts5x5'),
    });
});
