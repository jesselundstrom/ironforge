import { expect, test } from '@playwright/test';
import { confirmModal, openAppShell } from './helpers';

test('settings program island renders program basics and switcher through the legacy bridge', async ({
  page,
}) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.settings?.openProgramTab?.('forge');
  });

  await expect(page.locator('#settings-program-legacy-shell')).toHaveCount(0);
  await expect(
    page.locator('#settings-program-react-root [data-ui="program-card"]').first()
  ).toBeVisible();
  await expect(
    page.locator('#settings-program-react-root [data-ui="program-card"][data-state="active"]')
  ).toHaveCount(1);
  await expect(
    page.locator('#settings-program-react-root [data-ui="program-advanced-trigger"]')
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page
          .locator('#settings-program-react-root #training-program-summary')
          .textContent(),
      { timeout: 15000 }
    )
    .not.toEqual('');
});

test('settings program island still opens the advanced setup sheet', async ({ page }) => {
  await openAppShell(page);

  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.settings?.openProgramTab?.('forge');
  });

  await page.locator('#settings-program-react-root [data-ui="program-advanced-trigger"]').click();

  await expect(page.locator('#program-setup-sheet')).toHaveClass(/active/);
  await expect(page.locator('#program-settings-container')).not.toBeEmpty();
});

test('settings program advanced forge controls keep working under strict CSP', async ({
  page,
}) => {
  await openAppShell(page);

  const forgeWasActive = await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      getActiveProgramId?: () => string;
      switchProgram?: (programId: string) => void;
    };
    window.__IRONFORGE_E2E__?.settings?.openProgramTab?.('forge');
    const activeProgramId = runtimeWindow.getActiveProgramId?.() || '';
    if (activeProgramId !== 'forge') {
      runtimeWindow.switchProgram?.('forge');
      return false;
    }
    return true;
  });
  if (!forgeWasActive) {
    await confirmModal(page);
  }
  await expect
    .poll(() =>
      page.evaluate(() => {
        const runtimeWindow = window as Window & {
          getActiveProgramId?: () => string;
        };
        return runtimeWindow.getActiveProgramId?.() || '';
      })
    )
    .toBe('forge');

  await page.locator('#settings-program-react-root [data-ui="program-advanced-trigger"]').click();
  await expect(page.locator('#program-setup-sheet')).toHaveClass(/active/);

  await page.locator('#prog-week').fill('7');
  await page.locator('#prog-mode').selectOption('rir');
  await page.locator('#program-settings-container .program-setup-save-btn').click();

  await expect(page.locator('#program-setup-sheet')).not.toHaveClass(/active/);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            getActiveProgramState?: () => unknown;
          }
        ).getActiveProgramState?.() as any;
        return {
          mode: state?.mode || '',
          week: state?.week || 0,
        };
      })
    )
    .toEqual({
      mode: 'rir',
      week: 7,
    });
});

test('settings program advanced stronglifts controls keep working under strict CSP', async ({
  page,
}) => {
  await openAppShell(page);

  const strongliftsWasActive = await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      getActiveProgramId?: () => string;
      switchProgram?: (programId: string) => void;
    };
    window.__IRONFORGE_E2E__?.settings?.openProgramTab?.('stronglifts5x5');
    const activeProgramId = runtimeWindow.getActiveProgramId?.() || '';
    if (activeProgramId !== 'stronglifts5x5') {
      runtimeWindow.switchProgram?.('stronglifts5x5');
      return false;
    }
    return true;
  });
  if (!strongliftsWasActive) {
    await confirmModal(page);
  }
  await expect
    .poll(() =>
      page.evaluate(() => {
        const runtimeWindow = window as Window & {
          getActiveProgramId?: () => string;
        };
        return runtimeWindow.getActiveProgramId?.() || '';
      })
    )
    .toBe('stronglifts5x5');
  await page.locator('#settings-program-react-root [data-ui="program-advanced-trigger"]').click();
  await expect(page.locator('#program-setup-sheet')).toHaveClass(/active/);

  const firstWeightInput = page.locator('#program-settings-container input[type="number"]').first();
  await firstWeightInput.fill('92.5');
  await firstWeightInput.blur();
  await page.locator('#program-settings-container').getByRole('button', { name: /save program setup/i }).click();

  await expect(page.locator('#program-setup-sheet')).not.toHaveClass(/active/);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            getActiveProgramState?: () => unknown;
          }
        ).getActiveProgramState?.() as any;
        return {
          squatWeight: state?.lifts?.squat?.weight || 0,
        };
      })
    )
    .toEqual({
      squatWeight: 92.5,
    });
});
