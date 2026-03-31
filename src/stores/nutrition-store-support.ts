import { LOCAL_CACHE_KEYS } from '../domain/config';
import {
  normalizeHistoryEntry,
  type NutritionActionDefinition,
  type NutritionHistoryEntry,
} from '../domain/nutrition-view';

export type NutritionSessionContext = {
  durationMinutes: number | null;
  exerciseCount: number | null;
  tonnageKg: number | null;
  rpe: number | null;
  expiresAt: number | null;
};

export type NutritionActionConfig = NutritionActionDefinition & {
  prompt?: string;
  responseHint?: string;
};

export type NutritionRequestPayload = {
  actionId?: string | null;
  displayText?: string;
  promptText?: string;
  imageDataUrl?: string | null;
  imageFileSize?: number | null;
  isCorrection?: boolean;
  trace?: Record<string, any>;
};

export const NUTRITION_REQUEST_TIMEOUT_MS = 20000;
export const NUTRITION_MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const NUTRITION_MAX_COMPRESSED_BYTES = 5 * 1024 * 1024;
export const NUTRITION_MAX_TRAINING_CONTEXT_CHARS = 6000;
export const NUTRITION_MAX_TODAY_SUMMARY_CHARS = 400;
export const NUTRITION_HISTORY_LIMIT = 60;

export const NUTRITION_ACTIONS: NutritionActionConfig[] = [
  {
    id: 'plan_today',
    labelKey: 'nutrition.action.plan_today',
    fallbackLabel: 'Build my food plan for today',
    prompt:
      'Build a practical food plan for the rest of today based on my targets, training context, and what I have likely eaten so far. Give a simple meal-by-meal plan.',
    responseHint:
      'Give a structured meal-by-meal plan with bullet points. This response can be longer than usual.',
  },
  {
    id: 'next_meal',
    labelKey: 'nutrition.action.next_meal',
    fallbackLabel: 'What should I eat next?',
    prompt:
      'Recommend the best next meal or snack for today based on my targets, training context, and what I have eaten so far. Keep it practical.',
    responseHint:
      'Keep it to 2-3 sentences - one clear recommendation with estimated macros.',
  },
  {
    id: 'review_today',
    labelKey: 'nutrition.action.review_today',
    fallbackLabel: 'Review today so far',
    prompt:
      'Review my nutrition so far today. Summarize what looks good, what is missing, and the clearest next step. Always include protein progress vs target - flag if I am falling behind and suggest quick protein sources if needed.',
    responseHint:
      'Summarize in 3-5 sentences. Always include protein progress vs target.',
  },
];

export const NUTRITION_ACTION_DEFINITIONS: NutritionActionDefinition[] =
  NUTRITION_ACTIONS.map(({ id, labelKey, fallbackLabel }) => ({
    id,
    labelKey,
    fallbackLabel,
  }));

export function buildNutritionActionRequest(
  action: NutritionActionConfig,
  label: string
): NutritionRequestPayload {
  const promptParts = [`Primary task: ${label}`, action.prompt || ''];
  if (action.responseHint) {
    promptParts.push(`Response format: ${action.responseHint}`);
  }
  return {
    actionId: action.id,
    displayText: label,
    promptText: promptParts.filter(Boolean).join('\n\n'),
    imageDataUrl: null,
  };
}

export function getNutritionHistoryKey(userId: string, dateStamp: string) {
  return userId
    ? `${LOCAL_CACHE_KEYS.nutritionDayPrefix}::${userId}::${dateStamp}`
    : `${LOCAL_CACHE_KEYS.nutritionDayPrefix}::${dateStamp}`;
}

export function readNutritionHistoryFromStorage(historyKey: string) {
  try {
    const raw = localStorage.getItem(historyKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeHistoryEntry(entry))
      .filter((entry): entry is NutritionHistoryEntry => !!entry);
  } catch {
    return [];
  }
}

export function trimNutritionHistory(history: NutritionHistoryEntry[]) {
  return history.slice(-NUTRITION_HISTORY_LIMIT);
}

export function normalizeNutritionSessionContext(
  ctx: Record<string, unknown> | null | undefined
): NutritionSessionContext | null {
  if (!ctx || typeof ctx !== 'object') return null;
  const durationMinutesRaw = Number(ctx.duration || 0) / 60;
  const durationMinutes = Number.isFinite(durationMinutesRaw)
    ? Math.max(0, Math.round(durationMinutesRaw))
    : null;
  const exerciseCountRaw = Number(ctx.exerciseCount);
  const exerciseCount = Number.isFinite(exerciseCountRaw)
    ? Math.max(0, Math.round(exerciseCountRaw))
    : null;
  const tonnageRaw = Number(ctx.tonnage);
  const tonnageKg = Number.isFinite(tonnageRaw)
    ? Math.max(0, Math.round(tonnageRaw))
    : null;
  const rpeRaw = Number(ctx.rpe);
  const rpe = Number.isFinite(rpeRaw) ? Math.max(0, Math.round(rpeRaw * 10) / 10) : null;
  if (
    durationMinutes === null &&
    exerciseCount === null &&
    tonnageKg === null &&
    rpe === null
  ) {
    return null;
  }
  return {
    durationMinutes,
    exerciseCount,
    tonnageKg,
    rpe,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
}

export function buildNutritionSessionContextLine(
  sessionContext: NutritionSessionContext | null
) {
  if (!sessionContext) return '';
  if (sessionContext.expiresAt && Date.now() >= sessionContext.expiresAt) return '';
  const parts: string[] = [];
  if (sessionContext.durationMinutes != null) parts.push(`duration: ${sessionContext.durationMinutes} min`);
  if (sessionContext.exerciseCount != null) parts.push(`${sessionContext.exerciseCount} exercises`);
  if (sessionContext.tonnageKg != null) parts.push(`${sessionContext.tonnageKg} kg total volume`);
  if (sessionContext.rpe != null) parts.push(`RPE: ${sessionContext.rpe}`);
  return parts.length ? `The user just finished a training session (${parts.join(', ')}).` : '';
}

export function createNutritionTrace(payload: NutritionRequestPayload) {
  return {
    requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt:
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now(),
    actionId: payload.actionId || null,
    hasImage: !!payload.imageDataUrl,
    input: {
      displayTextChars: String(payload.displayText || '').length,
      promptChars: String(payload.promptText || payload.displayText || '').length,
      imageDataUrlChars: payload.imageDataUrl ? String(payload.imageDataUrl).length : 0,
      originalImageBytes: payload.imageFileSize || null,
    },
    stages: {} as Record<string, number>,
    model: null as string | null,
    usage: null as Record<string, unknown> | null,
    parseSource: 'none',
    success: false,
    error: null as string | null,
  };
}

export function finalizeNutritionTrace(
  trace: Record<string, any>,
  runtimeWindow?: Record<string, any> | null
) {
  const finishedAt =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  trace.finishedAt = finishedAt;
  trace.totalMs = Math.max(0, Math.round(finishedAt - trace.startedAt));
  if (runtimeWindow) {
    runtimeWindow.__IRONFORGE_NUTRITION_LAST_TRACE__ = trace;
  }
  let debugEnabled = false;
  try {
    debugEnabled =
      runtimeWindow?.__IRONFORGE_NUTRITION_DEBUG__ === true ||
      localStorage.getItem(LOCAL_CACHE_KEYS.nutritionTrace) === '1';
  } catch {}
  if (debugEnabled) {
    try {
      console.debug('[Ironforge][nutrition]', trace);
    } catch {}
  }
}

export function estimateDataUrlBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',');
  const base64 = commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
  if (!base64) return 0;
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function compressImageDataUrl(
  dataUrl: string,
  maxPx = 1024,
  quality = 0.82,
  trace?: Record<string, any>
) {
  return new Promise<string>((resolve) => {
    const startedAt =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      const originalWidth = img.width;
      const originalHeight = img.height;
      if (width > maxPx || height > maxPx) {
        if (width > height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      let output = dataUrl;
      try {
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          output = canvas.toDataURL('image/jpeg', quality);
        }
      } catch {
        output = dataUrl;
      }
      if (trace) {
        trace.image = {
          originalWidth,
          originalHeight,
          width,
          height,
          originalDataUrlChars: String(dataUrl || '').length,
          compressedDataUrlChars: String(output || '').length,
          maxPx,
          quality,
        };
        trace.stages.compressMs = Math.max(
          0,
          Math.round(
            (typeof performance !== 'undefined' && performance.now
              ? performance.now()
              : Date.now()) - startedAt
          )
        );
      }
      resolve(output);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
