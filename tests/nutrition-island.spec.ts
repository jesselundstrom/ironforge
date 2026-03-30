import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openAppShell, reloadAppShell } from './helpers';

test.describe.configure({ mode: 'serial' });
const NUTRITION_FUNCTION_URL =
  'https://koreqcjrpzcbfgkptvfx.supabase.co/functions/v1/nutrition-coach';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnS6jQAAAAASUVORK5CYII=',
  'base64'
);

function buildNutritionFunctionResponse(
  body: Record<string, unknown>,
  usage?: { input_tokens: number; output_tokens: number }
) {
  return JSON.stringify({
    model: 'claude-haiku-4-5',
    usage: usage || null,
    ...body,
  });
}

async function seedNutritionHistory(page: Page, entries: unknown[]) {
  await page.evaluate((entries) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const key = `ic_nutrition_day::e2e-user::${stamp}`;
    localStorage.removeItem('ic_nutrition_history::e2e-user');
    localStorage.setItem(key, JSON.stringify(entries));
  }, entries);
}

async function clearTodayNutrition(page: Page) {
  await page.evaluate(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    const key = `ic_nutrition_day::e2e-user::${stamp}`;
    localStorage.removeItem('ic_nutrition_history::e2e-user');
    localStorage.removeItem(key);
  });
}

async function seedYesterdayOnly(page: Page) {
  await page.evaluate(() => {
    const todayStamp = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStamp = yesterday.toISOString().slice(0, 10);
    const todayKey = `ic_nutrition_day::e2e-user::${todayStamp}`;
    const yesterdayKey = `ic_nutrition_day::e2e-user::${yesterdayStamp}`;

    localStorage.removeItem(todayKey);
    localStorage.removeItem('ic_nutrition_history::e2e-user');
    localStorage.setItem(
      yesterdayKey,
      JSON.stringify([
        {
          role: 'user',
          text: 'Yesterday note',
          timestamp: Date.now() - 86_400_000,
        },
      ])
    );
  });
}

async function openNutrition(page: Page) {
  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('nutrition');
  });

  await expect(page.locator('#page-nutrition')).toHaveClass(/active/);
  await expect(
    page.locator('#app-shell-react-root .nav-btn[data-page="nutrition"]')
  ).toHaveClass(/active/);
  await expect
    .poll(() => page.locator('.content').getAttribute('class'), {
      timeout: 15000,
    })
    .toMatch(/nutrition-active/);
}

async function expectNutritionCoachResponse(
  page: Page,
  text: string | RegExp,
  timeout = 30000
) {
  await expect(page.locator('#nutrition-react-root')).toContainText(text, {
    timeout,
  });
}

async function openMealEntryPicker(page: Page) {
  await page.locator('#nutrition-react-root .nc-photo-cta').click();
  await expect(page.locator('.nc-photo-picker-sheet')).toBeVisible();
}

test('nutrition island renders the setup card when the user is signed out', async ({
  page,
}) => {
  await openAppShell(page);

  await clearTodayNutrition(page);
  await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      __IRONFORGE_SUPABASE__?: {
        auth?: {
          getSession?: () => Promise<unknown>;
        };
      };
    };
    window.__IRONFORGE_E2E__?.app?.setCurrentUser?.(null);
    if (runtimeWindow.__IRONFORGE_SUPABASE__?.auth) {
      runtimeWindow.__IRONFORGE_SUPABASE__.auth.getSession = async () => ({
        data: { session: null },
        error: null,
      });
    }
  });
  await openNutrition(page);

  await expect(page.locator('#nutrition-legacy-shell')).toHaveCount(0);
  await expect(
    page.locator('#nutrition-react-root .nutrition-setup-card')
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /sign in to continue/i })
  ).toBeVisible();
  await expect(page.locator('.header')).toBeHidden();
  await expect(
    page.locator('#nutrition-react-root .nutrition-composer')
  ).toBeHidden();
});

test('nutrition island renders today session, guided actions, and can clear the day', async ({
  page,
}) => {
  await openAppShell(page);

  await seedNutritionHistory(page, [
    {
      role: 'user',
      text: 'Analyze this food photo',
      promptText: 'Primary task: Analyze this food photo.',
      actionId: 'analyze_photo',
      imageDataUrl: 'data:image/png;base64,abc123',
      timestamp: Date.now() - 60_000,
    },
    {
      role: 'assistant',
      text: 'Protein: 40g\nCarbs: 55g\nFat: 18g\nCalories: 520',
      timestamp: Date.now() - 30_000,
      model: 'claude-haiku-4-5-20251001',
    },
  ]);
  await openNutrition(page);

  await expect(page.locator('#nutrition-react-root')).toContainText(/protein/i);
  await expect(
    page.locator('#nutrition-react-root .nutrition-msg-photo-tag')
  ).toBeVisible();
  await expect(
    page.locator('#nutrition-react-root .nutrition-context-banner')
  ).toBeVisible();
  await expect(
    page.locator('#nutrition-react-root .nutrition-today-card')
  ).toBeVisible();
  await expect(
    page.locator('#nutrition-react-root .nutrition-composer')
  ).toBeVisible();
  await expect(
    page.locator('#nutrition-react-root .nutrition-action-grid')
  ).toBeVisible();

  await page.evaluate(() => {
    clearNutritionHistory();
    confirmOk();
  });

  await expect(
    page.locator('#nutrition-react-root .nutrition-today-card')
  ).toHaveCount(0);
});

test('nutrition today totals count logged photo meals but ignore suggestion-only replies', async ({
  page,
}) => {
  await openAppShell(page);

  await seedNutritionHistory(page, [
    {
      role: 'user',
      text: 'What should I eat next?',
      promptText: 'Primary task: What should I eat next?',
      actionId: 'next_meal',
      timestamp: Date.now() - 120_000,
    },
    {
      role: 'assistant',
      text: 'Protein: 20g\nCarbs: 30g\nFat: 10g\nCalories: 300',
      timestamp: Date.now() - 110_000,
      model: 'claude-haiku-4-5-20251001',
    },
    {
      role: 'user',
      text: 'Analyze this food photo',
      promptText: 'Primary task: Analyze this food photo.',
      actionId: 'analyze_photo',
      imageDataUrl: 'data:image/png;base64,abc123',
      timestamp: Date.now() - 60_000,
    },
    {
      role: 'assistant',
      text: 'Protein: 40g\nCarbs: 55g\nFat: 18g\nCalories: 520',
      timestamp: Date.now() - 30_000,
      model: 'claude-haiku-4-5-20251001',
    },
  ]);
  await openNutrition(page);

  await expect(page.locator('#nutrition-react-root')).toContainText(
    /what should i eat next/i
  );
  await expect(
    page.locator('#nutrition-react-root .nutrition-msg-coach')
  ).toHaveCount(2);
  await expect(
    page.locator('#nutrition-react-root .nutrition-today-card')
  ).toContainText('520');
  await expect(
    page.locator('#nutrition-react-root .nutrition-today-card')
  ).toContainText('40g');
  await expect(
    page.locator('#nutrition-react-root .nutrition-today-card')
  ).not.toContainText('820');
  await expect(
    page.locator('#nutrition-react-root .nutrition-today-card')
  ).not.toContainText('60g');
});

test("nutrition ignores yesterday's history and starts fresh for today", async ({
  page,
}) => {
  await openAppShell(page);

  await seedYesterdayOnly(page);
  await openNutrition(page);

  await expect(page.locator('#nutrition-react-root')).not.toContainText(
    /yesterday note/i
  );
  await expect(page.locator('#nutrition-react-root')).toContainText(
    /daily nutrition coach|p\u00e4ivitt\u00e4inen ravintocoachisi/i
  );
});

test('nutrition uses the updated Finnish meal logging label', async ({
  page,
}) => {
  await openAppShell(page);
  await page.evaluate(() => {
    window.I18N?.setLanguage?.('fi', { persist: false });
  });

  await clearTodayNutrition(page);
  await openNutrition(page);

  await expect(
    page.locator('#nutrition-react-root .nc-photo-cta')
  ).toContainText('Kirjaa ateriasi');
});

test('nutrition logout clears local nutrition data and leaves the signed-out setup state', async ({
  page,
}) => {
  await openAppShell(page);

  await seedNutritionHistory(page, [
    {
      role: 'assistant',
      text: 'Protein: 40g',
      timestamp: Date.now() - 30_000,
    },
  ]);
  await page.evaluate(async () => {
    const runtimeWindow = window as Window & {
      logout?: () => Promise<void>;
      __IRONFORGE_SUPABASE__?: {
        auth?: {
          getSession?: () => Promise<unknown>;
          signOut?: () => Promise<unknown>;
        };
      };
    };
    localStorage.setItem('ic_nutrition_trace', '1');
    if (runtimeWindow.__IRONFORGE_SUPABASE__?.auth) {
      runtimeWindow.__IRONFORGE_SUPABASE__.auth.getSession = async () => ({
        data: { session: null },
        error: null,
      });
      runtimeWindow.__IRONFORGE_SUPABASE__.auth.signOut = async () => ({
        error: null,
      });
    }
    await runtimeWindow.logout?.();
  });

  const storageState = await page.evaluate(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      trace: localStorage.getItem('ic_nutrition_trace'),
      history: localStorage.getItem('ic_nutrition_history::e2e-user'),
      dayHistory: localStorage.getItem(`ic_nutrition_day::e2e-user::${stamp}`),
      currentUserId: currentUser?.id ?? null,
    };
  });

  expect(storageState).toEqual({
    trace: null,
    history: null,
    dayHistory: null,
    currentUserId: null,
  });

  await openNutrition(page);
  await expect(
    page.locator('#nutrition-react-root .nutrition-setup-card')
  ).toBeVisible();
});

test('nutrition clear all data removes nutrition local keys too', async ({
  page,
}) => {
  await openAppShell(page);

  await seedNutritionHistory(page, [
    {
      role: 'assistant',
      text: 'Protein: 40g',
      timestamp: Date.now() - 30_000,
    },
  ]);
  await page.evaluate(async () => {
    const runtimeWindow = window as Window & {
      clearAllData?: () => Promise<void>;
    };
    localStorage.setItem('ic_nutrition_trace', '1');
    await runtimeWindow.clearAllData?.();
  });

  const storageState = await page.evaluate(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      trace: localStorage.getItem('ic_nutrition_trace'),
      history: localStorage.getItem('ic_nutrition_history::e2e-user'),
      dayHistory: localStorage.getItem(`ic_nutrition_day::e2e-user::${stamp}`),
    };
  });

  expect(storageState).toEqual({
    trace: null,
    history: null,
    dayHistory: null,
  });
});

test('nutrition layout keeps the action tray inside the shell when app viewport height shrinks', async ({
  page,
}) => {
  await openAppShell(page);

  await seedNutritionHistory(page, [
    {
      role: 'user',
      text: 'Build my food plan for today',
      promptText: 'Primary task: Build my food plan for today',
      actionId: 'plan_today',
      timestamp: Date.now() - 60_000,
    },
    {
      role: 'assistant',
      text: 'Protein: 40g\nCarbs: 55g\nFat: 18g\nCalories: 520',
      timestamp: Date.now() - 30_000,
      model: 'claude-haiku-4-5-20251001',
    },
  ]);
  await openNutrition(page);

  const layout = await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-vh', '430px');

    const pageRect = document
      .getElementById('page-nutrition')
      ?.getBoundingClientRect();
    const shellRect = document
      .getElementById('nutrition-shell')
      ?.getBoundingClientRect();
    const composerRect = document
      .querySelector('.nutrition-composer')
      ?.getBoundingClientRect();
    const messagesRect = document
      .getElementById('nutrition-messages')
      ?.getBoundingClientRect();

    return {
      shellFits:
        !!pageRect &&
        !!shellRect &&
        shellRect.top >= pageRect.top - 0.5 &&
        shellRect.bottom <= pageRect.bottom + 0.5,
      composerFits:
        !!shellRect &&
        !!composerRect &&
        composerRect.top >= shellRect.top - 0.5 &&
        composerRect.bottom <= shellRect.bottom + 0.5,
      messagesPositiveHeight: !!messagesRect && messagesRect.height > 10,
    };
  });

  expect(layout.shellFits).toBe(true);
  expect(layout.composerFits).toBe(true);
  expect(layout.messagesPositiveHeight).toBe(true);
});

test('nutrition sends coaching context, renders structured JSON responses, and persists them after reload', async ({
  page,
}) => {
  let capturedTrainingContext = '';

  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    const body = route.request().postDataJSON();
    capturedTrainingContext = String(body?.trainingContext || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildNutritionFunctionResponse({
        display_markdown:
          '## Next move\n- **Protein** is on pace.\n- Add fruit and oats around training.',
        estimated_macros: {
          calories: 640,
          protein_g: 42,
          carbs_g: 68,
          fat_g: 18,
        },
        remaining_today: {
          calories: 1800,
          protein_g: 118,
        },
        tags: ['sport_day', 'training_fuel'],
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await page.evaluate(async () => {
    const nextProfile = {
      ...(window.profile || {}),
      bodyMetrics: {
        ...((window.profile?.bodyMetrics as Record<string, unknown>) || {}),
        weight: 82,
        height: 180,
        age: 30,
        sex: 'male',
        activityLevel: 'moderate',
        bodyGoal: 'maintain',
      },
    };
    nextProfile.preferences = normalizeTrainingPreferences({
      ...nextProfile,
      preferences: {
        ...((nextProfile.preferences as Record<string, unknown>) || {}),
        goal: 'sport_support',
        trainingDaysPerWeek: 4,
        sessionMinutes: 60,
        equipmentAccess: 'full_gym',
        notes: 'Avoid huge dinners before evening sport.',
      },
    });
    nextProfile.coaching = normalizeCoachingProfile({
      ...nextProfile,
      coaching: {
        ...((nextProfile.coaching as Record<string, unknown>) || {}),
        guidanceMode: 'guided',
        experienceLevel: 'returning',
        sportProfile: {
          ...(((nextProfile.coaching as Record<string, unknown>)?.sportProfile as Record<
            string,
            unknown
          >) || {}),
          inSeason: true,
        },
      },
    });

    window.__IRONFORGE_E2E__?.profile?.update?.(nextProfile);
    await window.__IRONFORGE_E2E__?.app?.seedData?.({
      workouts: [],
      profile: window.profile || null,
      schedule: {
        ...(window.schedule || {}),
        sportName: 'Hockey',
        sportDays: [new Date().getDay()],
      },
    });
  });

  await openNutrition(page);
  await page
    .locator(
      '#nutrition-react-root .nutrition-action-card[data-nc-action="plan_today"]'
    )
    .click();

  await expectNutritionCoachResponse(page, 'Next move');
  await expectNutritionCoachResponse(page, 'Protein is on pace.');
  await expect(page.locator('#nutrition-react-root')).not.toContainText(
    '"display_markdown"'
  );
  await expect(
    page.locator('#nutrition-react-root .nutrition-macro-card')
  ).toContainText('640');
  await expect(
    page.locator('#nutrition-react-root .nutrition-today-card')
  ).toHaveCount(0);
  expect(capturedTrainingContext).toContain('Daily coaching snapshot:');
  expect(capturedTrainingContext).toContain('"guidance_mode":"guided"');
  expect(capturedTrainingContext).toContain('"in_season":true');
  expect(capturedTrainingContext).toContain(
    '"user_notes":"Avoid huge dinners before evening sport."'
  );

  await reloadAppShell(page);
  await page.evaluate(() => {
    window.__IRONFORGE_E2E__?.app?.navigateToPage?.('nutrition');
  });
  await expect(page.locator('#page-nutrition')).toHaveClass(/active/);
  await expect(
    page.locator('#app-shell-react-root .nav-btn[data-page="nutrition"]')
  ).toHaveClass(/active/);

  await expectNutritionCoachResponse(page, 'Next move');
  await expect(page.locator('#nutrition-react-root')).not.toContainText(
    '"display_markdown"'
  );
  await expect(
    page.locator('#nutrition-react-root .nutrition-today-card')
  ).toHaveCount(0);
});

test('nutrition consumes post-workout session context on the first send only', async ({
  page,
}) => {
  const capturedTrainingContexts: string[] = [];

  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    const body = route.request().postDataJSON();
    capturedTrainingContexts.push(String(body?.trainingContext || ''));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildNutritionFunctionResponse({
        display_markdown: '## Next move\n- Protein first.',
        estimated_macros: {
          calories: 420,
          protein_g: 35,
          carbs_g: 38,
          fat_g: 14,
        },
        remaining_today: {
          calories: 1600,
          protein_g: 100,
        },
        tags: ['post_workout'],
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await page.evaluate(() => {
    window.setNutritionSessionContext?.({
      duration: 3600,
      exerciseCount: 4,
      tonnage: 12500,
      rpe: 8,
    });
  });

  await openNutrition(page);
  await page
    .locator(
      '#nutrition-react-root .nutrition-action-card[data-nc-action="plan_today"]'
    )
    .click();
  await expectNutritionCoachResponse(page, 'Next move');

  await page
    .locator(
      '#nutrition-react-root .nutrition-action-card[data-nc-action="review_today"]'
    )
    .click();
  await expect(
    page.locator('#nutrition-react-root .nutrition-msg-coach')
  ).toHaveCount(2);

  expect(capturedTrainingContexts[0]).toContain(
    'The user just finished a training session (duration: 60 min, 4 exercises, 12500 kg total volume, RPE: 8).'
  );
  expect(capturedTrainingContexts[1]).not.toContain(
    'The user just finished a training session'
  );
});

test('nutrition records request trace metrics and token usage without changing the rendered response', async ({
  page,
}) => {
  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildNutritionFunctionResponse(
        {
          display_markdown:
            '## Next move\n- **Protein** is on pace.\n- Add fruit and oats around training.',
          estimated_macros: {
            calories: 640,
            protein_g: 42,
            carbs_g: 68,
            fat_g: 18,
          },
          remaining_today: {
            calories: 1800,
            protein_g: 118,
          },
          tags: ['sport_day', 'training_fuel'],
        },
        {
          input_tokens: 812,
          output_tokens: 96,
        }
      ),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);
  await page
    .locator(
      '#nutrition-react-root .nutrition-action-card[data-nc-action="plan_today"]'
    )
    .click();

  await expectNutritionCoachResponse(page, 'Next move');

  const trace = (await page.evaluate(
    () =>
      (
        window as Window & {
          __IRONFORGE_NUTRITION_LAST_TRACE__?: unknown;
        }
      ).__IRONFORGE_NUTRITION_LAST_TRACE__
  )) as {
    actionId?: string | null;
    hasImage?: boolean;
    model?: string | null;
    parseSource?: string;
    success?: boolean;
    usage?: { input_tokens?: number; output_tokens?: number };
    stages?: Record<string, number>;
    requestPayloadChars?: number;
  } | null;

  expect(trace).toMatchObject({
    actionId: 'plan_today',
    hasImage: false,
    model: 'claude-haiku-4-5',
    parseSource: 'structured',
    success: true,
    usage: {
      input_tokens: 812,
      output_tokens: 96,
    },
  });
  expect(trace?.stages?.preflightMs).toBeGreaterThanOrEqual(0);
  expect(trace?.stages?.requestMs).toBeGreaterThanOrEqual(0);
  expect(trace?.stages?.modelMs).toBeGreaterThanOrEqual(0);
  expect(trace?.stages?.parseMs).toBeGreaterThanOrEqual(0);
  expect(trace?.stages?.renderMs).toBeGreaterThanOrEqual(0);
  expect(trace?.requestPayloadChars).toBeGreaterThan(0);
});

test('nutrition shows a stable error when the daily backend rate limit is reached', async ({
  page,
}) => {
  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'rate_limit',
          message: 'Rate limit reached - wait a moment and try again.',
        },
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);
  await page
    .locator(
      '#nutrition-react-root .nutrition-action-card[data-nc-action="plan_today"]'
    )
    .click();

  await expectNutritionCoachResponse(
    page,
    /rate limit reached|pyyntöraja saavutettu/i
  );
  await expect(
    page.locator('#nutrition-react-root .nutrition-retry-btn')
  ).toBeVisible();
});

test('nutrition shows the oversized photo error when the backend rejects a photo upload', async ({
  page,
}) => {
  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    await route.fulfill({
      status: 413,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'request_too_large',
          message:
            'That photo is too large. Choose a smaller image and try again.',
        },
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);

  await openMealEntryPicker(page);
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Picture food' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'camera-meal.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });

  await expectNutritionCoachResponse(
    page,
    /photo is too large|kuva on liian suuri/i
  );
});

test('nutrition falls back to plain text when Claude returns malformed JSON and still extracts macros', async ({
  page,
}) => {
  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        usage: null,
        raw_text:
          'Protein: 31g\nCarbs: 47g\nFat: 12g\nCalories: 410\n\nGood quick meal. Add vegetables later.',
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);
  await page
    .locator(
      '#nutrition-react-root .nutrition-action-card[data-nc-action="plan_today"]'
    )
    .click();

  await expect(page.locator('#nutrition-react-root')).toContainText(
    'Good quick meal. Add vegetables later.'
  );
  await expect(
    page.locator('#nutrition-react-root .nutrition-macro-card')
  ).toContainText('31g');
  await expect(
    page.locator('#nutrition-react-root .nutrition-today-card')
  ).toHaveCount(0);
});

test('nutrition action card submits immediately on tap without send button', async ({
  page,
}) => {
  let requestCount = 0;

  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    requestCount++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildNutritionFunctionResponse({
        display_markdown: 'Here is your meal plan.',
        estimated_macros: null,
        remaining_today: null,
        tags: [],
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);

  // Tap action card directly — no send button click needed
  await page
    .locator('#nutrition-react-root .nutrition-action-card')
    .first()
    .click();

  await expectNutritionCoachResponse(page, 'Here is your meal plan.');
  expect(requestCount).toBe(1);
});

test('nutrition meal entry picker opens from the composer CTA and shows all options', async ({
  page,
}) => {
  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);

  await openMealEntryPicker(page);

  await expect(page.locator('.nc-photo-picker-sheet')).toContainText(
    'Picture food'
  );
  await expect(page.locator('.nc-photo-picker-sheet')).toContainText(
    'Use photo from library'
  );
  await expect(page.locator('.nc-photo-picker-sheet')).toContainText(
    'Type the food'
  );
});

test('nutrition meal entry camera option opens the camera input and sends the photo flow', async ({
  page,
}) => {
  let capturedInputId = '';
  let hasImagePart = false;

  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    const body = route.request().postDataJSON();
    const lastMsg = body?.messages?.[body.messages.length - 1];
    const content = Array.isArray(lastMsg?.content) ? lastMsg.content : [];
    hasImagePart = content.some((part: { type?: string }) => part?.type === 'image');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildNutritionFunctionResponse({
        display_markdown: 'Photo logged from camera.',
        estimated_macros: {
          calories: 420,
          protein_g: 28,
          carbs_g: 31,
          fat_g: 15,
        },
        remaining_today: {
          calories: 1580,
          protein_g: 132,
        },
        tags: [],
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);

  await openMealEntryPicker(page);
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Picture food' }).click();
  const chooser = await chooserPromise;
  capturedInputId = await chooser
    .element()
    .evaluate((el) => (el instanceof HTMLElement ? el.id : ''));
  await chooser.setFiles({
    name: 'camera-meal.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });

  await expectNutritionCoachResponse(page, 'Photo logged from camera.');
  expect(capturedInputId).toBe('nutrition-photo-camera-input');
  expect(hasImagePart).toBe(true);
});

test('nutrition meal entry library option opens the library input and sends the same photo flow', async ({
  page,
}) => {
  let capturedInputId = '';
  let hasImagePart = false;

  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    const body = route.request().postDataJSON();
    const lastMsg = body?.messages?.[body.messages.length - 1];
    const content = Array.isArray(lastMsg?.content) ? lastMsg.content : [];
    hasImagePart = content.some((part: { type?: string }) => part?.type === 'image');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildNutritionFunctionResponse({
        display_markdown: 'Photo logged from library.',
        estimated_macros: {
          calories: 390,
          protein_g: 24,
          carbs_g: 42,
          fat_g: 10,
        },
        remaining_today: {
          calories: 1610,
          protein_g: 136,
        },
        tags: [],
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);

  await openMealEntryPicker(page);
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Use photo from library' }).click();
  const chooser = await chooserPromise;
  capturedInputId = await chooser
    .element()
    .evaluate((el) => (el instanceof HTMLElement ? el.id : ''));
  await chooser.setFiles({
    name: 'library-meal.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });

  await expectNutritionCoachResponse(page, 'Photo logged from library.');
  expect(capturedInputId).toBe('nutrition-photo-library-input');
  expect(hasImagePart).toBe(true);
});

test('nutrition meal entry text option opens the shared sheet and sends typed food', async ({
  page,
}) => {
  let capturedUserText = '';

  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    const body = route.request().postDataJSON();
    const lastMsg = body?.messages?.[body.messages.length - 1];
    const content = lastMsg?.content;
    capturedUserText =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? (content.find((c: { type: string }) => c.type === 'text')?.text ??
            '')
          : '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildNutritionFunctionResponse({
        display_markdown: 'Typed meal logged.',
        estimated_macros: {
          calories: 510,
          protein_g: 36,
          carbs_g: 48,
          fat_g: 18,
        },
        remaining_today: {
          calories: 1490,
          protein_g: 124,
        },
        tags: [],
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);

  await openMealEntryPicker(page);
  await page.getByRole('button', { name: 'Type the food' }).click();
  await expect(page.locator('#nutrition-food-text-input')).toBeVisible();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url() === NUTRITION_FUNCTION_URL &&
      response.request().method() === 'POST',
    { timeout: 45000 }
  );
  await page
    .locator('#nutrition-food-text-input')
    .fill('Chicken rice bowl and a protein yogurt');
  await page.locator('#nutrition-food-text-input').press('Enter');

  await responsePromise;
  await expectNutritionCoachResponse(page, 'Typed meal logged.', 45000);
  expect(capturedUserText).toContain('Chicken rice bowl and a protein yogurt');
});

test('nutrition correction row appears inline after photo analysis and sends typed correction', async ({
  page,
}) => {
  let capturedUserText = '';

  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    const body = route.request().postDataJSON();
    const lastMsg = body?.messages?.[body.messages.length - 1];
    const content = lastMsg?.content;
    capturedUserText =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? (content.find((c: { type: string }) => c.type === 'text')?.text ??
            '')
          : '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildNutritionFunctionResponse({
          display_markdown: 'Updated — noted.',
          estimated_macros: null,
          remaining_today: null,
          tags: [],
        }),
    });
  });

  // Seed history: a photo user message followed by an assistant response
  // so that showCorrectionInput is true on load
  await openAppShell(page);
  await seedNutritionHistory(page, [
    {
      id: 'u1',
      role: 'user',
      text: 'Analyze this food photo',
      promptText: 'Analyze this food photo',
      actionId: 'analyze_photo',
      imageDataUrl: 'data:image/png;base64,abc',
      timestamp: Date.now() - 60000,
    },
    {
      id: 'a1',
      role: 'assistant',
      text: 'Looks like 400 kcal.',
      timestamp: Date.now() - 30000,
      model: 'claude-sonnet-4-6',
    },
  ]);
  await openNutrition(page);

  // Open the correction sheet from the trigger in the message list.
  await expect(page.locator('.nc-correction-trigger')).toBeVisible();
  await page.locator('.nc-correction-trigger').click();
  await expect(page.locator('#nutrition-text-input')).toBeVisible();
  const correctionResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === NUTRITION_FUNCTION_URL &&
      response.request().method() === 'POST',
    { timeout: 45000 }
  );

  // Type the correction and send
  await page
    .locator('#nutrition-text-input')
    .fill('Actually that was 2 portions');
  await page.locator('#nutrition-text-input').press('Enter');
  await correctionResponsePromise;

  await expectNutritionCoachResponse(page, 'Updated — noted.');
  expect(capturedUserText).toContain('Actually that was 2 portions');
});

test('nutrition correction input stays visible when the viewport shrinks after focus', async ({
  page,
}) => {
  await openAppShell(page);
  await seedNutritionHistory(page, [
    {
      id: 'u1',
      role: 'user',
      text: 'Analyze this food photo',
      promptText: 'Analyze this food photo',
      actionId: 'analyze_photo',
      imageDataUrl: 'data:image/png;base64,abc',
      timestamp: Date.now() - 60000,
    },
    {
      id: 'a1',
      role: 'assistant',
      text: 'Looks like 400 kcal.',
      timestamp: Date.now() - 30000,
      model: 'claude-sonnet-4-6',
    },
  ]);
  await openNutrition(page);

  await expect(page.locator('.nc-correction-trigger')).toBeVisible();
  await page.locator('.nc-correction-trigger').click();
  await expect(page.locator('#nutrition-text-input')).toBeVisible();
  await page.locator('#nutrition-text-input').focus();
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-vh', '430px');
    window.dispatchEvent(new Event('resize'));
  });

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const input = document.getElementById('nutrition-text-input');
          const sheet = document.querySelector('.nc-correction-sheet');
          if (
            !(input instanceof HTMLElement) ||
            !(sheet instanceof HTMLElement)
          ) {
            return {
              inputVisibleInViewport: false,
              sheetVisibleInViewport: false,
            };
          }

          const inputRect = input.getBoundingClientRect();
          const sheetRect = sheet.getBoundingClientRect();

          return {
            inputVisibleInViewport:
              inputRect.top >= -0.5 &&
              inputRect.bottom <= window.innerHeight + 0.5,
            sheetVisibleInViewport:
              sheetRect.top >= -0.5 &&
              sheetRect.bottom <= window.innerHeight + 0.5,
          };
        }),
      { timeout: 1500 }
    )
    .toEqual({
      inputVisibleInViewport: true,
      sheetVisibleInViewport: true,
    });
});

test('nutrition compatibility globals delegate to the typed store runtime', async ({
  page,
}) => {
  let capturedTrainingContext = '';

  await page.route(NUTRITION_FUNCTION_URL, async (route) => {
    const body = route.request().postDataJSON();
    capturedTrainingContext = String(body?.trainingContext || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: buildNutritionFunctionResponse({
        display_markdown: '## Legacy delegate response\n- Protein first.',
        estimated_macros: {
          calories: 420,
          protein_g: 35,
          carbs_g: 32,
          fat_g: 14,
        },
        remaining_today: {
          calories: 1600,
          protein_g: 95,
        },
        tags: ['post_workout'],
      }),
    });
  });

  await openAppShell(page);
  await clearTodayNutrition(page);
  await openNutrition(page);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url() === NUTRITION_FUNCTION_URL &&
      response.request().method() === 'POST',
    { timeout: 45000 }
  );

  await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      submitNutritionMessage?: () => Promise<unknown> | unknown;
    };
    window.setNutritionSessionContext?.({
      duration: 2700,
      exerciseCount: 5,
      tonnage: 9800,
      rpe: 7,
    });
    window.setSelectedNutritionAction?.('plan_today');
    return runtimeWindow.submitNutritionMessage?.();
  });

  await responsePromise;

  await expectNutritionCoachResponse(page, 'Legacy delegate response');
  expect(capturedTrainingContext).toContain(
    'The user just finished a training session (duration: 45 min, 5 exercises, 9800 kg total volume, RPE: 7).'
  );
});
