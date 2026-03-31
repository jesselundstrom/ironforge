import type { Profile } from './types';

export type NutritionActionView = {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  selected: boolean;
};

export type NutritionActionDefinition = {
  id: string;
  labelKey: string;
  fallbackLabel: string;
};

export type NutritionContextBanner =
  | {
      kind: 'personalized';
      text: string;
      details: string;
    }
  | {
      kind: 'setup_body';
      text: string;
      linkText: string;
    };

export type NutritionTodayCard = {
  calories: {
    value: number;
    target: number | null;
    progress: number;
  };
  protein: {
    value: number;
    target: number | null;
    progress: number;
  };
  carbs: number;
  fat: number;
};

export type NutritionMacroCard = {
  calories?: string | number;
  protein?: string | number;
  carbs?: string | number;
  fat?: string | number;
} | null;

export type NutritionMessageView =
  | {
      id: string;
      kind: 'photo';
      imageDataUrl: string;
    }
  | {
      id: string;
      kind: 'action';
      text: string;
    }
  | {
      id: string;
      kind: 'coach';
      text: string;
      isError: boolean;
      isStreaming: boolean;
      macros: NutritionMacroCard;
      timestamp: string;
      modelTag: string;
    };

export type NutritionViewModel = {
  values: {
    canUseNutrition: boolean;
    loading: {
      visible: boolean;
      text: string;
    };
    selectedActionId: string;
    actions: NutritionActionView[];
    contextBanner: NutritionContextBanner | null;
    todayCard: NutritionTodayCard | null;
    messagesState: 'setup' | 'empty' | 'thread';
    messages: NutritionMessageView[];
    showCorrectionInput: boolean;
    scrollVersion: number;
  };
};

export type DashboardNutritionSummary = {
  state: 'empty' | 'active';
  mealCount: number;
  calories: {
    value: number;
    target: number;
    percent: number;
  } | null;
  protein: {
    value: number;
    target: number;
    percent: number;
  } | null;
  labels: {
    title: string;
    calories: string;
    protein: string;
    empty: string;
    logMeal: string;
    meals: string;
    kcal: string;
    gram: string;
  };
} | null;

export type NutritionRuntimeState = {
  selectedActionId: string;
  loading: boolean;
  loadingContext: 'text' | 'photo' | string;
  streaming: boolean;
  snapshotVersion: number;
};

export type NutritionHistoryEntry = Record<string, any>;

export type BuildNutritionViewInput = {
  currentUser: Record<string, unknown> | null;
  profile: Profile | null;
  t: (
    key: string,
    params?: Record<string, unknown> | null,
    fallback?: string
  ) => string;
  history: NutritionHistoryEntry[];
  actions?: NutritionActionDefinition[];
  runtimeState: NutritionRuntimeState;
};
type StructuredNutritionResponse = {
  display_markdown: string;
  estimated_macros: Record<string, number> | null;
  remaining_today: Record<string, number> | null;
  tags: string[];
};

const DEFAULT_ACTIONS = [
  {
    id: 'plan_today',
    labelKey: 'nutrition.action.plan_today',
    fallbackLabel: 'Build my food plan for today',
  },
  {
    id: 'next_meal',
    labelKey: 'nutrition.action.next_meal',
    fallbackLabel: 'What should I eat next?',
  },
  {
    id: 'review_today',
    labelKey: 'nutrition.action.review_today',
    fallbackLabel: 'Review today so far',
  },
];

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

function todaySessionDate() {
  return new Date().toISOString().slice(0, 10);
}

function todayStartTimestamp() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

function normalizeNutritionNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function normalizeStructuredMacroGroup(rawGroup: any) {
  if (!rawGroup || typeof rawGroup !== 'object') return null;
  const next: Record<string, number> = {};
  const calories = normalizeNutritionNumber(rawGroup.calories);
  const protein = normalizeNutritionNumber(rawGroup.protein_g);
  const carbs = normalizeNutritionNumber(rawGroup.carbs_g);
  const fat = normalizeNutritionNumber(rawGroup.fat_g);
  if (calories !== null) next.calories = calories;
  if (protein !== null) next.protein_g = protein;
  if (carbs !== null) next.carbs_g = carbs;
  if (fat !== null) next.fat_g = fat;
  return Object.keys(next).length ? next : null;
}

function normalizeNutritionTags(rawTags: unknown) {
  if (!Array.isArray(rawTags)) return [];
  return rawTags
    .map((tag) => String(tag || '').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 6);
}

export function normalizeStructuredNutritionResponse(
  rawResponse: any,
  depth = 0
): StructuredNutritionResponse | null {
  if (!rawResponse || typeof rawResponse !== 'object') return null;
  const displayMarkdown = String(rawResponse.display_markdown || '').trim();
  const estimatedMacros = normalizeStructuredMacroGroup(
    rawResponse.estimated_macros
  );
  const remainingToday = normalizeStructuredMacroGroup(rawResponse.remaining_today);
  const tags = normalizeNutritionTags(rawResponse.tags);
  if (!displayMarkdown) return null;

  if (depth < 2) {
    const nested: StructuredNutritionResponse | null =
      parseStructuredNutritionResponse(displayMarkdown, depth + 1);
    if (nested && nested.display_markdown !== displayMarkdown) {
      return {
        display_markdown: nested.display_markdown,
        estimated_macros: nested.estimated_macros || estimatedMacros,
        remaining_today: nested.remaining_today || remainingToday,
        tags: nested.tags?.length ? nested.tags : tags,
      };
    }
  }

  return {
    display_markdown: displayMarkdown,
    estimated_macros: estimatedMacros,
    remaining_today: remainingToday,
    tags,
  };
}

export function parseStructuredNutritionResponse(
  rawText: unknown,
  depth = 0
): StructuredNutritionResponse | null {
  const text = String(rawText || '').trim();
  if (!text) return null;

  function tryParse(candidate: string) {
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  let parsed = tryParse(text);
  if (!parsed) {
    const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenceMatch) parsed = tryParse(fenceMatch[1].trim());
  }
  if (!parsed) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      parsed = tryParse(text.slice(firstBrace, lastBrace + 1));
    }
  }

  return normalizeStructuredNutritionResponse(parsed, depth);
}

export function normalizeHistoryEntry(entry: any): NutritionHistoryEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const next: NutritionHistoryEntry = { ...entry };
  next.role = next.role === 'assistant' ? 'assistant' : 'user';
  next.text = String(next.text || '');
  if (next.promptText !== undefined) next.promptText = String(next.promptText || '');
  if (next.rawText !== undefined) next.rawText = String(next.rawText || '');
  let structured = normalizeStructuredNutritionResponse(next.structured);
  if (!structured && next.role === 'assistant') {
    structured =
      parseStructuredNutritionResponse(next.text) ||
      parseStructuredNutritionResponse(next.rawText);
  }
  if (structured) next.structured = structured;
  else delete next.structured;
  if (structured?.display_markdown) next.text = structured.display_markdown;
  return next;
}

function getStructuredMessageMacros(structured: any) {
  const estimated = structured?.estimated_macros;
  if (!estimated || typeof estimated !== 'object') return null;
  const next: Record<string, number> = {};
  if (estimated.calories != null) next.calories = estimated.calories;
  if (estimated.protein_g != null) next.protein = estimated.protein_g;
  if (estimated.carbs_g != null) next.carbs = estimated.carbs_g;
  if (estimated.fat_g != null) next.fat = estimated.fat_g;
  return Object.keys(next).length ? next : null;
}

function extractMacros(text: string) {
  const result: Record<string, string> = {};
  const calMatch =
    text.match(/(?:calories|kcal|cal)[:\s~]*(\d[\d,.]*)/i) ||
    text.match(/(\d[\d,.]*)\s*(?:kcal|calories|cal)\b/i);
  const proMatch = text.match(/protein[:\s~]*(\d[\d,.]*)\s*g/i);
  const carbMatch = text.match(/carb(?:s|ohydrate)?[:\s~]*(\d[\d,.]*)\s*g/i);
  const fatMatch = text.match(/fat[:\s~]*(\d[\d,.]*)\s*g/i);

  if (calMatch) result.calories = calMatch[1].replace(',', '');
  if (proMatch) result.protein = proMatch[1].replace(',', '');
  if (carbMatch) result.carbs = carbMatch[1].replace(',', '');
  if (fatMatch) result.fat = fatMatch[1].replace(',', '');
  return Object.keys(result).length >= 2 ? result : null;
}

function getAssistantMessageMacros(message: NutritionHistoryEntry) {
  if (!message || message.role !== 'assistant' || message.isError) return null;
  return getStructuredMessageMacros(message.structured) || extractMacros(message.text);
}

function findTrackedMealAnchorIndex(history: NutritionHistoryEntry[], assistantIndex: number) {
  if (assistantIndex < 1) return -1;
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (!entry) continue;
    if (entry.role === 'assistant') continue;
    if (entry.imageDataUrl) return index;
    if (entry.isCorrection) continue;
    return -1;
  }
  return -1;
}

function shouldCountAssistantMessageTowardsToday(
  history: NutritionHistoryEntry[],
  message: NutritionHistoryEntry,
  index: number
) {
  if (!message || message.role !== 'assistant' || message.isError) return false;
  return findTrackedMealAnchorIndex(history, index) !== -1;
}

export function getTodayTrackedMacroTotals(history: NutritionHistoryEntry[]) {
  const todayTs = todayStartTimestamp();
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let mealCount = 0;

  for (let index = 0; index < history.length; index += 1) {
    const message = history[index];
    if (
      message.role !== 'assistant' ||
      message.isError ||
      !message.timestamp ||
      message.timestamp < todayTs
    ) {
      continue;
    }
    if (!shouldCountAssistantMessageTowardsToday(history, message, index)) {
      continue;
    }
    const nextUser = history[index + 1];
    const nextAssistant = history[index + 2];
    if (
      nextUser &&
      nextUser.role === 'user' &&
      nextUser.isCorrection &&
      nextAssistant &&
      nextAssistant.role === 'assistant' &&
      !nextAssistant.isError
    ) {
      continue;
    }
    const macros = getAssistantMessageMacros(message);
    if (!macros) continue;
    mealCount += 1;
    if (macros.calories !== undefined) totals.calories += parseFloat(String(macros.calories)) || 0;
    if (macros.protein !== undefined) totals.protein += parseFloat(String(macros.protein)) || 0;
    if (macros.carbs !== undefined) totals.carbs += parseFloat(String(macros.carbs)) || 0;
    if (macros.fat !== undefined) totals.fat += parseFloat(String(macros.fat)) || 0;
  }

  return { totals, mealCount };
}

export function calculateTargets(profile: Profile | null) {
  const bm = profile?.bodyMetrics || {};
  if (!bm.weight || !bm.height || !bm.age || !bm.sex) return null;

  let bmr = 10 * bm.weight + 6.25 * bm.height - 5 * bm.age;
  bmr += bm.sex === 'male' ? 5 : -161;

  const multiplier = ACTIVITY_MULTIPLIERS[String(bm.activityLevel || '')] || 1.375;
  const tdee = Math.round(bmr * multiplier);
  const goalAdjust: Record<string, number> = {
    lose_fat: -500,
    gain_muscle: 300,
    recomp: 0,
    maintain: 0,
  };
  const targetCal = tdee + (goalAdjust[String(bm.bodyGoal || '')] || 0);
  const proteinPerKg: Record<string, number> = {
    lose_fat: 2.2,
    gain_muscle: 2.0,
    recomp: 2.0,
    maintain: 1.8,
  };
  const protein = Math.round(bm.weight * (proteinPerKg[String(bm.bodyGoal || '')] || 1.8));
  const fat = Math.round((targetCal * 0.27) / 9);
  let carbs = Math.round((targetCal - protein * 4 - fat * 9) / 4);
  if (carbs < 0) carbs = 0;
  return {
    tdee,
    calories: targetCal,
    protein,
    carbs,
    fat,
  };
}

function getContextBanner(
  profile: Profile | null,
  targets: ReturnType<typeof calculateTargets>,
  t: BuildNutritionViewInput['t']
): NutritionContextBanner {
  const bm = profile?.bodyMetrics || {};
  const parts: string[] = [];
  const goalKeys: Record<string, string> = {
    lose_fat: 'nutrition.goal.lose_fat',
    gain_muscle: 'nutrition.goal.gain_muscle',
    recomp: 'nutrition.goal.recomp',
    maintain: 'nutrition.goal.maintain',
  };
  const goalFallbacks: Record<string, string> = {
    lose_fat: 'fat loss',
    gain_muscle: 'muscle gain',
    recomp: 'recomp',
    maintain: 'maintain',
  };
  if (bm.weight) parts.push(`${bm.weight} kg`);
  if (bm.bodyGoal && goalKeys[String(bm.bodyGoal)]) {
    parts.push(
      t(goalKeys[String(bm.bodyGoal)], null, goalFallbacks[String(bm.bodyGoal)])
    );
  }
  if (targets) parts.push(`${targets.calories} kcal/day`);
  if (parts.length) {
    return {
      kind: 'personalized',
      text: t('nutrition.banner.personalized', null, 'Personalised'),
      details: parts.join(', '),
    };
  }
  return {
    kind: 'setup_body',
    text: t(
      'nutrition.banner.setup_body',
      null,
      'Set up your body profile for personalised advice'
    ),
    linkText: t('nutrition.banner.settings_link', null, 'Settings'),
  };
}

function getTodayCard(
  tracked: ReturnType<typeof getTodayTrackedMacroTotals>,
  targets: ReturnType<typeof calculateTargets>
) {
  const totals = tracked.totals;
  if (!tracked.mealCount) return null;
  return {
    calories: {
      value: Math.round(totals.calories),
      target: targets ? targets.calories : null,
      progress: targets
        ? Math.min(100, Math.round((totals.calories / targets.calories) * 100))
        : 0,
    },
    protein: {
      value: Math.round(totals.protein),
      target: targets ? targets.protein : null,
      progress: targets
        ? Math.min(100, Math.round((totals.protein / targets.protein) * 100))
        : 0,
    },
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
  };
}

function formatTimestamp(ts: unknown, t: BuildNutritionViewInput['t']) {
  if (!ts) return '';
  const date = new Date(ts as string | number);
  const now = new Date();
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
  if (date.toDateString() === now.toDateString()) return hm;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `${t('nutrition.time.yesterday', null, 'Yesterday')} ${hm}`;
  }
  return `${date.getDate()}.${date.getMonth() + 1}. ${hm}`;
}

function getMessageSnapshot(
  history: NutritionHistoryEntry[],
  message: NutritionHistoryEntry,
  index: number,
  runtimeState: NutritionRuntimeState,
  t: BuildNutritionViewInput['t']
): NutritionMessageView {
  if (message.role === 'user') {
    if (message.imageDataUrl) {
      return {
        id: message.id || `nutrition-user-photo-${index}`,
        kind: 'photo',
        imageDataUrl: message.imageDataUrl,
      };
    }
    return {
      id: message.id || `nutrition-user-action-${index}`,
      kind: 'action',
      text: message.text || '',
    };
  }

  const isLast = index === history.length - 1;
  const isStreaming = isLast && runtimeState.streaming;
  const macros =
    !message.isError && !isStreaming ? getAssistantMessageMacros(message) : null;
  const modelTag = message.model
    ? ` · ${String(message.model)
        .replace(/^claude-/, '')
        .replace(/-\d{8}$/, '')
        .replace(/-\d+$/, '')}`
    : '';

  return {
    id: message.id || `nutrition-coach-${index}`,
    kind: 'coach',
    text: message.structured?.display_markdown || message.text || '',
    isError: message.isError === true,
    isStreaming,
    macros,
    timestamp: formatTimestamp(message.timestamp, t),
    modelTag,
  };
}

function shouldShowCorrectionInput(history: NutritionHistoryEntry[]) {
  if (!history.length) return false;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === 'assistant' && !history[index].isError) {
      const previous = history[index - 1];
      return !!(previous && previous.role === 'user' && previous.imageDataUrl);
    }
  }
  return false;
}

export function buildNutritionViewModel(
  input: BuildNutritionViewInput
): NutritionViewModel {
  const canUseNutrition = !!String(input.currentUser?.id || '').trim();
  const history = canUseNutrition ? input.history || [] : [];
  const actions = input.actions?.length ? input.actions : DEFAULT_ACTIONS;
  const targets = canUseNutrition ? calculateTargets(input.profile) : null;
  const tracked = canUseNutrition
    ? getTodayTrackedMacroTotals(history)
    : { totals: { calories: 0, protein: 0, carbs: 0, fat: 0 }, mealCount: 0 };
  const loadingText = input.runtimeState.loading
    ? input.runtimeState.loadingContext === 'photo'
      ? input.t('nutrition.loading.analyzing', null, 'Analyzing your meal...')
      : input.t('nutrition.loading.thinking', null, 'Thinking...')
    : '';

  return {
    values: {
      canUseNutrition,
      loading: {
        visible: input.runtimeState.loading,
        text: loadingText,
      },
      selectedActionId: input.runtimeState.selectedActionId || 'plan_today',
      actions: actions.map((action) => ({
        ...action,
        selected: action.id === (input.runtimeState.selectedActionId || 'plan_today'),
      })),
      contextBanner: canUseNutrition
        ? getContextBanner(input.profile, targets, input.t)
        : null,
      todayCard: canUseNutrition ? getTodayCard(tracked, targets) : null,
      messagesState: !canUseNutrition ? 'setup' : !history.length ? 'empty' : 'thread',
      messages: canUseNutrition
        ? history.map((message, index) =>
            getMessageSnapshot(history, message, index, input.runtimeState, input.t)
          )
        : [],
      showCorrectionInput: canUseNutrition ? shouldShowCorrectionInput(history) : false,
      scrollVersion: input.runtimeState.snapshotVersion || 0,
    },
  };
}

export function buildDashboardNutritionSummary(
  input: BuildNutritionViewInput
): DashboardNutritionSummary {
  const canUseNutrition = !!String(input.currentUser?.id || '').trim();
  if (!canUseNutrition) return null;
  const history = input.history || [];
  const targets = calculateTargets(input.profile);
  if (!targets) return null;
  const tracked = getTodayTrackedMacroTotals(history);
  if (!tracked.mealCount) {
    return {
      state: 'empty',
      mealCount: 0,
      calories: null,
      protein: null,
      labels: {
        title: input.t('dashboard.nutrition', null, 'Nutrition'),
        calories: input.t('dashboard.nutrition.calories', null, 'Calories'),
        protein: input.t('dashboard.nutrition.protein', null, 'Protein'),
        empty: input.t(
          'dashboard.nutrition.empty',
          null,
          'No meals logged today'
        ),
        logMeal: input.t('dashboard.nutrition.log_meal', null, 'Log meal'),
        meals: input.t('dashboard.nutrition.meals', { count: 0 }, '{count} meals logged'),
        kcal: 'kcal',
        gram: 'g',
      },
    };
  }
  return {
    state: 'active',
    mealCount: tracked.mealCount,
    calories: {
      value: Math.round(tracked.totals.calories),
      target: targets.calories,
      percent: Math.min(100, Math.round((tracked.totals.calories / targets.calories) * 100)),
    },
    protein: {
      value: Math.round(tracked.totals.protein),
      target: targets.protein,
      percent: Math.min(100, Math.round((tracked.totals.protein / targets.protein) * 100)),
    },
    labels: {
      title: input.t('dashboard.nutrition', null, 'Nutrition'),
      calories: input.t('dashboard.nutrition.calories', null, 'Calories'),
      protein: input.t('dashboard.nutrition.protein', null, 'Protein'),
      empty: input.t('dashboard.nutrition.empty', null, 'No meals logged today'),
      logMeal: input.t('dashboard.nutrition.log_meal', null, 'Log meal'),
      meals: input.t(
        'dashboard.nutrition.meals',
        { count: tracked.mealCount },
        '{count} meals logged'
      ),
      kcal: 'kcal',
      gram: 'g',
    },
  };
}
