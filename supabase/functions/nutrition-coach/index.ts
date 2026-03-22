import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const MAX_MESSAGES = 12;
const MAX_TEXT_CHARS = 4000;
const MAX_TRAINING_CONTEXT_CHARS = 6000;
const MAX_TODAY_SUMMARY_CHARS = 400;
const MAX_TAGS = 6;
const MAX_TAG_LENGTH = 40;
const MAX_REQUESTS_PER_DAY = 25;
const MAX_PHOTO_REQUESTS_PER_DAY = 8;
const ANTHROPIC_TIMEOUT_MS = 20000;
const TEXT_MODEL = 'claude-haiku-4-5';
const PHOTO_MODEL = 'claude-sonnet-4-5';

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {}
) {
  return jsonResponse(status, {
    error: {
      code,
      message,
      ...extra,
    },
  });
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function sanitizeLocale(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'fi' ? 'fi' : 'en';
}

function sanitizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => String(tag || '').trim().slice(0, MAX_TAG_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

function normalizeNumber(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.round(num));
}

function normalizeEstimatedMacros(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const group = value as Record<string, unknown>;
  const calories = normalizeNumber(group.calories);
  const protein = normalizeNumber(group.protein_g);
  const carbs = normalizeNumber(group.carbs_g);
  const fat = normalizeNumber(group.fat_g);
  if (
    calories === null &&
    protein === null &&
    carbs === null &&
    fat === null
  ) {
    return null;
  }
  return {
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
  };
}

function normalizeRemainingToday(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const group = value as Record<string, unknown>;
  const calories = normalizeNumber(group.calories);
  const protein = normalizeNumber(group.protein_g);
  if (calories === null && protein === null) return null;
  return {
    calories,
    protein_g: protein,
  };
}

function normalizeCoachPayload(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const displayMarkdown = sanitizeText(payload.display_markdown, MAX_TEXT_CHARS);
  if (!displayMarkdown) return null;
  return {
    display_markdown: displayMarkdown,
    estimated_macros: normalizeEstimatedMacros(payload.estimated_macros),
    remaining_today: normalizeRemainingToday(payload.remaining_today),
    tags: sanitizeTags(payload.tags),
  };
}

function tryParseStructuredPayload(rawText: string) {
  const text = sanitizeText(rawText, MAX_TEXT_CHARS);
  if (!text) return null;
  const candidates = [text];
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const normalized = normalizeCoachPayload(parsed);
      if (normalized) return normalized;
    } catch (_) {}
  }
  return null;
}

function validateTargets(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const targets = value as Record<string, unknown>;
  return {
    calories: normalizeNumber(targets.calories),
    protein: normalizeNumber(targets.protein),
    carbs: normalizeNumber(targets.carbs),
    fat: normalizeNumber(targets.fat),
    tdee: normalizeNumber(targets.tdee),
  };
}

function validateMessages(value: unknown, requestKind: 'text' | 'photo') {
  if (!Array.isArray(value) || !value.length || value.length > MAX_MESSAGES) {
    return null;
  }
  let hasImage = false;
  const normalized = value.map((message) => {
    if (!message || typeof message !== 'object') return null;
    const next = message as Record<string, unknown>;
    const role = next.role === 'assistant' ? 'assistant' : next.role === 'user' ? 'user' : '';
    if (!role) return null;
    const content = next.content;
    if (typeof content === 'string') {
      return {
        role,
        content: sanitizeText(content, MAX_TEXT_CHARS),
      };
    }
    if (!Array.isArray(content) || !content.length) return null;
    const parts = content
      .map((part) => {
        if (!part || typeof part !== 'object') return null;
        const nextPart = part as Record<string, unknown>;
        if (nextPart.type === 'text') {
          const text = sanitizeText(nextPart.text, MAX_TEXT_CHARS);
          return text ? { type: 'text', text } : null;
        }
        if (nextPart.type === 'image') {
          const source =
            nextPart.source && typeof nextPart.source === 'object'
              ? (nextPart.source as Record<string, unknown>)
              : null;
          const mediaType = sanitizeText(source?.media_type, 80);
          const data = sanitizeText(source?.data, MAX_REQUEST_BYTES);
          if (
            source?.type !== 'base64' ||
            !mediaType.startsWith('image/') ||
            !data
          ) {
            return null;
          }
          hasImage = true;
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data,
            },
          };
        }
        return null;
      })
      .filter(Boolean);
    if (!parts.length) return null;
    return {
      role,
      content: parts,
    };
  });

  if (normalized.some((message) => !message)) return null;
  if (requestKind === 'photo' && !hasImage) return null;
  return normalized as Array<Record<string, unknown>>;
}

function buildSystemPrompt(payload: {
  locale: 'en' | 'fi';
  requestKind: 'text' | 'photo';
  trainingContext: string;
  todayIntakeSummary: string;
  actionId: string;
  targets: ReturnType<typeof validateTargets>;
}) {
  const languageInstruction =
    payload.locale === 'fi'
      ? 'Write display_markdown in Finnish.'
      : 'Write display_markdown in English.';
  const targetParts = [];
  if (payload.targets?.calories !== null) {
    targetParts.push(`calories: ${payload.targets?.calories}`);
  }
  if (payload.targets?.protein !== null) {
    targetParts.push(`protein_g: ${payload.targets?.protein}`);
  }
  if (payload.targets?.carbs !== null) {
    targetParts.push(`carbs_g: ${payload.targets?.carbs}`);
  }
  if (payload.targets?.fat !== null) {
    targetParts.push(`fat_g: ${payload.targets?.fat}`);
  }
  if (payload.targets?.tdee !== null) {
    targetParts.push(`tdee: ${payload.targets?.tdee}`);
  }

  const contextSections = [
    'You are Ironforge Nutrition Coach.',
    languageInstruction,
    'Respond with valid JSON only. Do not wrap the response in markdown fences.',
    'JSON schema: {"display_markdown": string, "estimated_macros": {"calories": number|null, "protein_g": number|null, "carbs_g": number|null, "fat_g": number|null} | null, "remaining_today": {"calories": number|null, "protein_g": number|null} | null, "tags": string[]}.',
    'Keep tags short snake_case labels.',
    'display_markdown should be concise, practical coaching with markdown bullets/headings when useful.',
    `Request kind: ${payload.requestKind}.`,
    `Guided action id: ${payload.actionId || 'none'}.`,
    payload.trainingContext
      ? `Training context:\n${payload.trainingContext}`
      : 'Training context: unavailable.',
    payload.todayIntakeSummary
      ? `Today intake summary:\n${payload.todayIntakeSummary}`
      : 'Today intake summary: unavailable.',
    targetParts.length
      ? `Targets: ${targetParts.join(', ')}`
      : 'Targets: unavailable.',
  ];

  return contextSections.join('\n\n');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Only POST is supported.');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey || !anthropicApiKey) {
    return errorResponse(
      503,
      'server_unavailable',
      'Nutrition Coach is temporarily unavailable.'
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch?.[1]) {
    return errorResponse(401, 'auth_required', 'Sign in to use Nutrition Coach.');
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse(
      413,
      'request_too_large',
      'That photo is too large. Choose a smaller image and try again.'
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(tokenMatch[1]);
  if (userError || !user?.id) {
    return errorResponse(401, 'auth_required', 'Sign in to use Nutrition Coach.');
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
    return errorResponse(
      413,
      'request_too_large',
      'That photo is too large. Choose a smaller image and try again.'
    );
  }

  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch (_) {
    return errorResponse(400, 'invalid_json', 'Invalid request body.');
  }

  const locale = sanitizeLocale(parsedBody.locale);
  const requestKind = parsedBody.requestKind === 'photo' ? 'photo' : 'text';
  const trainingContext = sanitizeText(
    parsedBody.trainingContext,
    MAX_TRAINING_CONTEXT_CHARS
  );
  const todayIntakeSummary = sanitizeText(
    parsedBody.todayIntakeSummary,
    MAX_TODAY_SUMMARY_CHARS
  );
  const actionId = sanitizeText(parsedBody.actionId, 80);
  const targets = validateTargets(parsedBody.targets);
  const messages = validateMessages(parsedBody.messages, requestKind);
  if (!messages) {
    return errorResponse(400, 'invalid_request', 'Invalid Nutrition Coach payload.');
  }

  const usageDate = new Date().toISOString().slice(0, 10);
  const { data: quotaRows, error: quotaError } = await supabase.rpc(
    'claim_nutrition_usage_quota',
    {
      p_user_id: user.id,
      p_usage_date: usageDate,
      p_is_photo: requestKind === 'photo',
      p_max_requests: MAX_REQUESTS_PER_DAY,
      p_max_photo_requests: MAX_PHOTO_REQUESTS_PER_DAY,
    }
  );
  if (quotaError) {
    return errorResponse(
      503,
      'quota_unavailable',
      'Nutrition Coach is temporarily unavailable.'
    );
  }

  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    return errorResponse(
      429,
      'rate_limit',
      'Rate limit reached - wait a moment and try again.',
      {
        request_count: quota?.request_count ?? null,
        photo_request_count: quota?.photo_request_count ?? null,
      }
    );
  }

  const model = requestKind === 'photo' ? PHOTO_MODEL : TEXT_MODEL;
  const system = buildSystemPrompt({
    locale,
    requestKind,
    trainingContext,
    todayIntakeSummary,
    actionId,
    targets,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: requestKind === 'photo' ? 900 : 700,
          system,
          messages,
        }),
        signal: controller.signal,
      });
    clearTimeout(timeoutId);

    const anthropicJson = await anthropicResponse.json().catch(() => ({}));
    if (!anthropicResponse.ok) {
      if (anthropicResponse.status >= 500) {
        await supabase.rpc('release_nutrition_usage_claim', {
          p_user_id: user.id,
          p_usage_date: usageDate,
          p_is_photo: requestKind === 'photo',
        });
      }
      if (anthropicResponse.status === 413) {
        return errorResponse(
          413,
          'request_too_large',
          'That photo is too large. Choose a smaller image and try again.'
        );
      }
      if (anthropicResponse.status === 429) {
        return errorResponse(
          429,
          'rate_limit',
          'Rate limit reached - wait a moment and try again.'
        );
      }
      return errorResponse(
        anthropicResponse.status >= 500 ? 503 : 502,
        'upstream_error',
        'Nutrition Coach is temporarily unavailable.'
      );
    }

    const contentParts = Array.isArray(anthropicJson.content)
      ? anthropicJson.content
      : [];
    const rawText = contentParts
      .filter((part: Record<string, unknown>) => part?.type === 'text')
      .map((part: Record<string, unknown>) => String(part.text || ''))
      .join('\n')
      .trim();
    const normalizedPayload =
      normalizeCoachPayload(anthropicJson) ||
      tryParseStructuredPayload(rawText) || {
        display_markdown: sanitizeText(rawText, MAX_TEXT_CHARS),
        estimated_macros: null,
        remaining_today: null,
        tags: [],
      };

    if (!normalizedPayload.display_markdown) {
      await supabase.rpc('release_nutrition_usage_claim', {
        p_user_id: user.id,
        p_usage_date: usageDate,
        p_is_photo: requestKind === 'photo',
      });
      return errorResponse(
        502,
        'invalid_upstream_payload',
        'Nutrition Coach is temporarily unavailable.'
      );
    }

    const usage =
      anthropicJson.usage && typeof anthropicJson.usage === 'object'
        ? {
            input_tokens: normalizeNumber(
              (anthropicJson.usage as Record<string, unknown>).input_tokens
            ),
            output_tokens: normalizeNumber(
              (anthropicJson.usage as Record<string, unknown>).output_tokens
            ),
          }
        : null;

    await supabase.rpc('finalize_nutrition_usage', {
      p_user_id: user.id,
      p_usage_date: usageDate,
      p_input_tokens: usage?.input_tokens ?? 0,
      p_output_tokens: usage?.output_tokens ?? 0,
    });

    return jsonResponse(200, {
      ...normalizedPayload,
      model,
      usage,
      raw_text: rawText || null,
    });
  } catch (error) {
    await supabase.rpc('release_nutrition_usage_claim', {
      p_user_id: user.id,
      p_usage_date: usageDate,
      p_is_photo: requestKind === 'photo',
    });
    if (error instanceof DOMException && error.name === 'AbortError') {
      return errorResponse(
        503,
        'server_timeout',
        'Nutrition Coach is temporarily unavailable.'
      );
    }
    return errorResponse(
      503,
      'server_unavailable',
      'Nutrition Coach is temporarily unavailable.'
    );
  } finally {
    clearTimeout(timeoutId);
  }
});
