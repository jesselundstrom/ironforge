import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('user can open settings from the bottom navigation', async ({ page }) => {
  await openAppShell(page);

  const settingsButton = page
    .locator('.bottom-nav')
    .getByRole('button', { name: /^settings$/i });

  await expect(settingsButton).toBeVisible();
  await settingsButton.evaluate((button: HTMLButtonElement) => button.click());

  await expect(page.locator('#page-settings')).toHaveClass(/active/);
  await expect(page.locator('#sport-name')).toBeVisible();
  await expect(page.locator('#settings-tab-schedule')).toBeVisible();
});

test('settings page stays usable after synced UI refresh', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.settings?.openTab?.('account');
  });

  await page.evaluate(() => {
    refreshSyncedUI({ toast: false });
  });

  await expect(page.locator('#page-settings')).toHaveClass(/active/);
  await expect(page.locator('#settings-tab-account')).toBeVisible();
});

test('program advanced setup sheet stays scrollable', async ({ page }) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.settings?.openTab?.('program');
    profile.activeProgram = 'forge';
    initSettings();
    openProgramSetupSheet();
    const sheet = document.querySelector('#program-setup-sheet .modal-sheet');
    if (!sheet) return null;
    const style = window.getComputedStyle(sheet);
    return {
      overflowY: style.overflowY,
      touchAction: style.touchAction,
      scrollHeight: sheet.scrollHeight,
      clientHeight: sheet.clientHeight,
    };
  });

  expect(result).not.toBeNull();
  expect(result?.overflowY).toBe('auto');
  expect(result?.touchAction).toContain('pan-y');
  expect(
    (result?.scrollHeight || 0) > (result?.clientHeight || 0)
  ).toBeTruthy();
});

test('forge advanced setup keeps only advanced controls', async ({ page }) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.settings?.openTab?.('program');
    profile.activeProgram = 'forge';
    initSettings();
    openProgramSetupSheet();
    return {
      hasMainLiftInput: !!document.getElementById('forge-advanced-main-tm-0'),
      hasBackWeightInput: !!document.getElementById(
        'forge-advanced-back-weight'
      ),
      hasAuxInput: !!document.getElementById('forge-advanced-aux-tm-0'),
      hasModeSelect: !!document.getElementById('prog-mode'),
      sheetText:
        document.getElementById('program-settings-container')?.textContent ||
        '',
    };
  });

  expect(result?.hasMainLiftInput).toBe(false);
  expect(result?.hasBackWeightInput).toBe(false);
  expect(result?.hasAuxInput).toBe(true);
  expect(result?.hasModeSelect).toBe(true);
  expect(result?.sheetText).toContain('Program Basics');
});

test('mobile forge program setup keeps the save action above the bottom nav', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAppShell(page);

  const result = await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.settings?.openTab?.('program');
    profile.activeProgram = 'forge';
    initSettings();
    openProgramSetupSheet();
    const sheet = document.querySelector('#program-setup-sheet .modal-sheet');
    const button = document.querySelector(
      '#program-setup-sheet .program-setup-save-btn'
    );
    const nav = document.querySelector('.bottom-nav');
    if (!sheet || !button || !nav) return null;
    sheet.scrollTop = sheet.scrollHeight;
    const buttonRect = button.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    return {
      buttonBottom: buttonRect.bottom,
      navTop: navRect.top,
    };
  });

  expect(result).not.toBeNull();
  expect((result?.buttonBottom || 0) < (result?.navTop || 0)).toBeTruthy();
});
