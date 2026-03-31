import { create } from 'zustand';
import { LOCAL_CACHE_KEYS } from '../domain/config';
import {
  buildDashboardNutritionSummary,
  buildNutritionViewModel,
  calculateTargets,
  getTodayTrackedMacroTotals,
  normalizeStructuredNutritionResponse,
  parseStructuredNutritionResponse,
  type DashboardNutritionSummary,
  type NutritionHistoryEntry,
  type NutritionRuntimeState,
  type NutritionViewModel,
} from '../domain/nutrition-view';
import { buildPlanningContext, computeFatigue, getTodayTrainingDecision } from '../domain/planning';
import type { Profile, SportSchedule, WorkoutRecord } from '../domain/types';
import { dataStore } from './data-store';
import { i18nStore } from './i18n-store';
import { profileStore } from './profile-store';
import { programStore } from './program-store';
import { useRuntimeStore } from '../app/store/runtime-store';
import {
  buildNutritionActionRequest as buildNutritionActionRequestSupport,
  buildNutritionSessionContextLine as buildNutritionSessionContextLineSupport,
  compressImageDataUrl as compressImageDataUrlSupport,
  createNutritionTrace as createNutritionTraceSupport,
  estimateDataUrlBytes as estimateDataUrlBytesSupport,
  finalizeNutritionTrace as finalizeNutritionTraceSupport,
  getNutritionHistoryKey as getNutritionHistoryKeySupport,
  NUTRITION_ACTION_DEFINITIONS,
  NUTRITION_ACTIONS,
  NUTRITION_HISTORY_LIMIT,
  NUTRITION_MAX_COMPRESSED_BYTES,
  NUTRITION_MAX_PHOTO_BYTES,
  NUTRITION_MAX_TODAY_SUMMARY_CHARS,
  NUTRITION_MAX_TRAINING_CONTEXT_CHARS,
  NUTRITION_REQUEST_TIMEOUT_MS,
  normalizeNutritionSessionContext as normalizeNutritionSessionContextSupport,
  readNutritionHistoryFromStorage as readNutritionHistoryFromStorageSupport,
  trimNutritionHistory as trimNutritionHistorySupport,
  type NutritionActionConfig,
  type NutritionRequestPayload,
  type NutritionSessionContext,
} from './nutrition-store-support';

type NutritionStoreState = {
  history: NutritionHistoryEntry[];
  activeHistoryKey: string;
  selectedActionId: string;
  loading: boolean;
  loadingContext: string;
  streaming: boolean;
  scrollVersion: number;
  sessionContext: NutritionSessionContext | null;
  view: NutritionViewModel;
  dashboardSummary: DashboardNutritionSummary;
  recompute: () => NutritionViewModel;
  refreshFromStorage: () => NutritionViewModel;
  selectAction: (actionId: string) => Promise<void>;
  submitSelectedAction: () => Promise<void>;
  submitTextMessage: (text: string, isCorrection?: boolean) => Promise<void>;
  handlePhoto: (event: Event) => void;
  retryLastMessage: () => Promise<void>;
  clearHistory: () => void;
  clearLocalData: (options?: Record<string, unknown>) => void;
  setSessionContext: (ctx: Record<string, unknown> | null) => void;
};

type NutritionWindow = Window &
  Record<string, unknown> & {
    showLoginScreen?: () => void;
    showToast?: (
      message: string,
      color?: string,
      undoFn?: (() => void) | null
    ) => void;
    showConfirm?: (
      title: string,
      message: string,
      onConfirm?: (() => void) | null
    ) => void;
    __IRONFORGE_SUPABASE_URL__?: string;
    __IRONFORGE_SUPABASE_PUBLISHABLE_KEY__?: string;
    __IRONFORGE_SUPABASE__?: {
      auth?: {
        getSession?: () => Promise<{
          data?: { session?: { access_token?: string | null } | null };
        } | null>;
      };
    };
    __IRONFORGE_NUTRITION_LAST_TRACE__?: unknown;
    __IRONFORGE_NUTRITION_DEBUG__?: boolean;
    setSelectedNutritionAction?: (actionId: string) => void;
    submitNutritionMessage?: () => Promise<void>;
    submitNutritionTextMessage?: (
      text: string,
      isCorrection?: boolean
    ) => Promise<void>;
    handleNutritionPhoto?: (event: Event) => void;
    retryLastNutritionMessage?: () => Promise<void>;
    clearNutritionHistory?: () => void;
    clearNutritionLocalData?: (options?: Record<string, unknown>) => void;
    openNutritionLogin?: () => void;
    isNutritionCoachAvailable?: () => boolean;
    setNutritionSessionContext?: (ctx: Record<string, unknown> | null) => void;
    getDashboardNutritionSnapshot?: () => DashboardNutritionSummary;
  };

let storeInstalled = false;
let unsubscribeDataStore: (() => void) | null = null;
let unsubscribeProfileStore: (() => void) | null = null;
let unsubscribeI18nStore: (() => void) | null = null;
let unsubscribeRuntimeStore: (() => void) | null = null;
let sessionContextTimeoutId: ReturnType<typeof setTimeout> | null = null;

function getNutritionWindow(): NutritionWindow | null {
  if (typeof window === 'undefined') return null;
  return window as unknown as NutritionWindow;
}

function tr(key: string, fallback: string, params?: Record<string, unknown> | null) {
  return i18nStore.getState().t(key, params || null, fallback);
}

function currentUserId() {
  return String(dataStore.getState().currentUser?.id || '').trim();
}

function todaySessionDate() {
  return new Date().toISOString().slice(0, 10);
}

function getHistoryKey(dateStamp = todaySessionDate()) {
  return getNutritionHistoryKeySupport(currentUserId(), dateStamp);
}

function readHistoryFromStorage() {
  return readNutritionHistoryFromStorageSupport(getHistoryKey());
}

function getActionById(actionId?: string | null) {
  return (
    NUTRITION_ACTIONS.find((action) => action.id === String(actionId || '').trim()) ||
    NUTRITION_ACTIONS[0]
  );
}

function getRuntimeState(
  state: Pick<
    NutritionStoreState,
    'selectedActionId' | 'loading' | 'loadingContext' | 'streaming' | 'scrollVersion'
  >
): NutritionRuntimeState {
  return {
    selectedActionId: state.selectedActionId || 'plan_today',
    loading: state.loading === true,
    loadingContext: state.loadingContext || 'text',
    streaming: state.streaming === true,
    snapshotVersion: state.scrollVersion || 0,
  };
}

function computeNutritionView(
  state: Pick<
    NutritionStoreState,
    | 'history'
    | 'selectedActionId'
    | 'loading'
    | 'loadingContext'
    | 'streaming'
    | 'scrollVersion'
  >
) {
  return buildNutritionViewModel({
    currentUser: dataStore.getState().currentUser,
    profile: profileStore.getState().profile,
    t: i18nStore.getState().t,
    history: state.history,
    actions: NUTRITION_ACTION_DEFINITIONS,
    runtimeState: getRuntimeState(state),
  });
}

function computeDashboardSummary(
  state: Pick<
    NutritionStoreState,
    | 'history'
    | 'selectedActionId'
    | 'loading'
    | 'loadingContext'
    | 'streaming'
    | 'scrollVersion'
  >
) {
  return buildDashboardNutritionSummary({
    currentUser: dataStore.getState().currentUser,
    profile: profileStore.getState().profile,
    t: i18nStore.getState().t,
    history: state.history,
    actions: NUTRITION_ACTION_DEFINITIONS,
    runtimeState: getRuntimeState(state),
  });
}

function recomputeNutritionStore() {
  const state = useNutritionStore.getState();
  const view = computeNutritionView(state);
  const dashboardSummary = computeDashboardSummary(state);
  useNutritionStore.setState((current) => ({
    ...current,
    view,
    dashboardSummary,
  }));
  return view;
}

function syncHistoryFromStorage(force = false) {
  const nextKey = getHistoryKey();
  const state = useNutritionStore.getState();
  if (!force && state.activeHistoryKey === nextKey) return false;
  useNutritionStore.setState((current) => ({
    ...current,
    history: readHistoryFromStorage(),
    activeHistoryKey: nextKey,
  }));
  return true;
}

function refreshNutritionStore(force = false) {
  syncHistoryFromStorage(force);
  return recomputeNutritionStore();
}

function syncNutritionInputsFromLegacy() {
  dataStore.getState().syncFromLegacy();
  profileStore.getState().syncFromDataStore();
  programStore.getState().syncFromLegacy();
}

function writeHistory(nextHistory: NutritionHistoryEntry[], incrementScroll = true) {
  const trimmedHistory = trimNutritionHistorySupport(nextHistory);
  const nextKey = getHistoryKey();
  try {
    localStorage.setItem(nextKey, JSON.stringify(trimmedHistory));
  } catch {}
  useNutritionStore.setState((current) => ({
    ...current,
    history: trimmedHistory,
    activeHistoryKey: nextKey,
    scrollVersion: incrementScroll ? current.scrollVersion + 1 : current.scrollVersion,
  }));
  recomputeNutritionStore();
}

function clearSessionContextTimer() {
  if (sessionContextTimeoutId) {
    clearTimeout(sessionContextTimeoutId);
    sessionContextTimeoutId = null;
  }
}

function removeHistoryKey() {
  try {
    localStorage.removeItem(getHistoryKey());
  } catch {}
}

function normalizeSessionContext(
  ctx: Record<string, unknown> | null | undefined
): NutritionSessionContext | null {
  return normalizeNutritionSessionContextSupport(ctx);
}

function setSessionContextState(nextContext: NutritionSessionContext | null) {
  clearSessionContextTimer();
  useNutritionStore.setState((current) => ({
    ...current,
    sessionContext: nextContext,
  }));
  if (nextContext?.expiresAt) {
    sessionContextTimeoutId = setTimeout(() => {
      setSessionContextState(null);
      recomputeNutritionStore();
    }, Math.max(0, nextContext.expiresAt - Date.now()));
  }
  recomputeNutritionStore();
}

function consumeSessionContextLine() {
  const sessionContext = useNutritionStore.getState().sessionContext;
  if (!sessionContext) return '';
  if (sessionContext.expiresAt && Date.now() >= sessionContext.expiresAt) {
    setSessionContextState(null);
    return '';
  }
  const line = buildNutritionSessionContextLineSupport(sessionContext);
  setSessionContextState(null);
  return line;
}

function createNutritionTrace(payload: NutritionRequestPayload) {
  return createNutritionTraceSupport(payload);
}

function finalizeNutritionTrace(trace: Record<string, any>) {
  finalizeNutritionTraceSupport(trace, getNutritionWindow());
}

function estimateDataUrlBytes(dataUrl: string) {
  return estimateDataUrlBytesSupport(String(dataUrl || ''));
}

function compressImage(
  dataUrl: string,
  maxPx = 1024,
  quality = 0.82,
  trace?: Record<string, any>
) {
  return compressImageDataUrlSupport(dataUrl, maxPx, quality, trace);
}

function buildTargetsPayload(targets: Record<string, unknown> | null) {
  if (!targets || typeof targets !== 'object') return null;
  return {
    calories: Number.isFinite(Number(targets.calories))
      ? Math.max(0, Math.round(Number(targets.calories)))
      : null,
    protein: Number.isFinite(Number(targets.protein))
      ? Math.max(0, Math.round(Number(targets.protein)))
      : null,
    carbs: Number.isFinite(Number(targets.carbs))
      ? Math.max(0, Math.round(Number(targets.carbs)))
      : null,
    fat: Number.isFinite(Number(targets.fat))
      ? Math.max(0, Math.round(Number(targets.fat)))
      : null,
    tdee: Number.isFinite(Number(targets.tdee))
      ? Math.max(0, Math.round(Number(targets.tdee)))
      : null,
  };
}

function sanitizeTrainingContext(context: string) {
  return String(context || '').trim().slice(0, NUTRITION_MAX_TRAINING_CONTEXT_CHARS);
}

function sanitizeTodayIntakeSummary(summary: string) {
  return String(summary || '').trim().slice(0, NUTRITION_MAX_TODAY_SUMMARY_CHARS);
}

function getSportContextLines(
  workouts: WorkoutRecord[],
  scheduleLike: SportSchedule | null
) {
  if (!scheduleLike?.sportName || !Array.isArray(scheduleLike.sportDays) || !scheduleLike.sportDays.length) {
    return [];
  }
  const now = new Date();
  const todayDow = now.getDay();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sportDays = scheduleLike.sportDays
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  if (!sportDays.length) return [];

  const sportDayStr = sportDays.map((day) => dayNames[day]).join(', ');
  const lines = [
    `Today: ${dayNames[todayDow]}`,
    `Sport: ${scheduleLike.sportName} on ${sportDayStr} (${scheduleLike.sportIntensity || 'hard'} intensity${scheduleLike.sportLegsHeavy ? ', leg-heavy' : ''})`,
    `Scheduled sport today: ${sportDays.includes(todayDow) ? 'yes' : 'no'}`,
  ];

  let nextSportDay: string | null = null;
  let daysUntilNext: number | null = null;
  for (let offset = 1; offset <= 7; offset += 1) {
    const dow = (todayDow + offset) % 7;
    if (!sportDays.includes(dow)) continue;
    nextSportDay = dayNames[dow];
    daysUntilNext = offset;
    break;
  }
  if (nextSportDay && daysUntilNext !== null) {
    lines.push(
      `Next scheduled sport: ${nextSportDay}${daysUntilNext === 1 ? ' (tomorrow)' : ` (in ${daysUntilNext} days)`}`
    );
  }

  const recentSport = workouts
    .filter((workout) => workout && (workout.type === 'sport' || workout.type === 'hockey'))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  if (!recentSport) return lines;

  const daysAgo = Math.round((Date.now() - new Date(recentSport.date).getTime()) / 86400000);
  const when =
    daysAgo <= 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
  const sportParts = [when];
  const durationMin = Math.round((parseFloat(String(recentSport.duration || 0)) || 0) / 60);
  if (durationMin > 0) sportParts.push(`${durationMin} min`);
  if (recentSport.rpe) sportParts.push(`RPE ${recentSport.rpe}`);
  if (recentSport.subtype === 'extra') sportParts.push('extra session');
  lines.push(`Most recent sport session: ${sportParts.join(', ')}`);
  return lines;
}

function buildCoachingContext(
  profileLike: Profile | null,
  scheduleLike: SportSchedule | null,
  workouts: WorkoutRecord[]
) {
  try {
    const preferences = (profileLike?.preferences || {}) as Record<string, unknown>;
    const coaching = (profileLike?.coaching || {}) as Record<string, any>;
    const activeProgram = programStore.getState().activeProgram;
    const activeProgramState = programStore.getState().activeProgramState;
    const fatigue = computeFatigue({ workouts, schedule: scheduleLike });
    const planningContext = buildPlanningContext({
      profile: profileLike,
      schedule: scheduleLike,
      workouts,
      activeProgram,
      activeProgramState,
      fatigue,
    });
    const decision = getTodayTrainingDecision(planningContext || {});
    const snapshot: Record<string, unknown> = {};

    if (decision?.action) snapshot.today_training_recommendation = decision.action;
    if (Array.isArray(decision?.restrictionFlags) && decision.restrictionFlags.length) {
      snapshot.restriction_flags = decision.restrictionFlags.slice(0, 4);
    }
    if (Number.isFinite(parseInt(String(planningContext?.recoveryScore), 10))) {
      snapshot.recovery_score = parseInt(String(planningContext?.recoveryScore), 10);
    }
    if (Number.isFinite(parseInt(String(planningContext?.sessionsRemaining), 10))) {
      snapshot.sessions_remaining_this_week = parseInt(
        String(planningContext?.sessionsRemaining),
        10
      );
    }
    const timeBudget = parseInt(
      String(
        decision?.timeBudgetMinutes ||
          planningContext?.timeBudgetMinutes ||
          preferences.sessionMinutes ||
          ''
      ),
      10
    );
    if (Number.isFinite(timeBudget) && timeBudget > 0) {
      snapshot.time_budget_minutes = timeBudget;
    }
    if (coaching.guidanceMode) snapshot.guidance_mode = coaching.guidanceMode;
    if (coaching.experienceLevel) snapshot.experience_level = coaching.experienceLevel;
    if (coaching.sportProfile) snapshot.in_season = coaching.sportProfile.inSeason === true;
    if (Number.isFinite(parseInt(String(preferences.sessionMinutes || ''), 10))) {
      snapshot.session_minutes = parseInt(String(preferences.sessionMinutes), 10);
    }
    if (preferences.equipmentAccess) snapshot.equipment_access = preferences.equipmentAccess;
    if (preferences.notes) {
      snapshot.user_notes = String(preferences.notes).trim().slice(0, 240);
    }
    return Object.keys(snapshot).length
      ? `Daily coaching snapshot: ${JSON.stringify(snapshot)}`
      : '';
  } catch {
    return '';
  }
}

function buildTrainingContext() {
  const profileLike = profileStore.getState().profile;
  const scheduleLike = profileStore.getState().schedule;
  const workouts = (dataStore.getState().workouts || []) as WorkoutRecord[];
  const lines: string[] = [];
  const bodyMetrics = profileLike?.bodyMetrics || {};
  const activityLabels: Record<string, string> = {
    sedentary: 'Sedentary (desk job, little exercise)',
    light: 'Lightly active (light exercise 1-3 days/week)',
    moderate: 'Active (moderate exercise 3-5 days/week)',
    very_active: 'Very active (hard exercise 6-7 days/week)',
  };
  const bodyGoalLabels: Record<string, string> = {
    lose_fat: 'Lose fat',
    gain_muscle: 'Gain muscle',
    recomp: 'Body recomposition (lose fat and gain muscle simultaneously)',
    maintain: 'Maintain current weight',
  };
  const trainingGoalLabels: Record<string, string> = {
    strength: 'Strength',
    hypertrophy: 'Hypertrophy (muscle growth)',
    general_fitness: 'General fitness',
    sport_support: 'Sport performance support',
  };

  if (bodyMetrics.sex) {
    lines.push(`Sex: ${bodyMetrics.sex === 'male' ? 'Male' : 'Female'}`);
  }
  const bodyParts: string[] = [];
  if (bodyMetrics.weight) bodyParts.push(`weight ${bodyMetrics.weight} kg`);
  if (bodyMetrics.height) bodyParts.push(`height ${bodyMetrics.height} cm`);
  if (bodyMetrics.age) bodyParts.push(`age ${bodyMetrics.age}`);
  if (bodyParts.length) lines.push(`Body: ${bodyParts.join(', ')}`);
  if (bodyMetrics.activityLevel) {
    lines.push(
      `Activity level: ${activityLabels[String(bodyMetrics.activityLevel)] || bodyMetrics.activityLevel}`
    );
  }
  if (bodyMetrics.targetWeight) lines.push(`Target weight: ${bodyMetrics.targetWeight} kg`);
  if (bodyMetrics.bodyGoal) {
    lines.push(`Body goal: ${bodyGoalLabels[String(bodyMetrics.bodyGoal)] || bodyMetrics.bodyGoal}`);
  }

  const preferences = (profileLike?.preferences || {}) as Record<string, unknown>;
  if (preferences.goal) {
    lines.push(
      `Training goal: ${trainingGoalLabels[String(preferences.goal)] || preferences.goal}`
    );
  }
  if (preferences.trainingDaysPerWeek) {
    lines.push(`Trains: ${preferences.trainingDaysPerWeek} days/week`);
  }

  const activeProgram = programStore.getState().activeProgram;
  const activeProgramState = programStore.getState().activeProgramState;
  if (activeProgram?.name) {
    let programLine = `Program: ${activeProgram.name}`;
    if (activeProgramState?.week) programLine += `, Week ${activeProgramState.week}`;
    if (typeof activeProgram.getBlockInfo === 'function') {
      try {
        const blockInfo = activeProgram.getBlockInfo(activeProgramState || {});
        if (blockInfo?.name) programLine += ` (${blockInfo.name} block)`;
      } catch {}
    }
    lines.push(programLine);
  }

  const fatigue = computeFatigue({ workouts, schedule: scheduleLike });
  const recovery = Math.round(100 - (fatigue?.overall || 0));
  const recoveryLabel =
    recovery >= 80 ? 'well recovered' : recovery >= 60 ? 'moderate fatigue' : 'high fatigue';
  lines.push(`Recovery: ${recovery}% (${recoveryLabel})`);
  lines.push(...getSportContextLines(workouts, scheduleLike));
  const coachingContext = buildCoachingContext(profileLike, scheduleLike, workouts);
  if (coachingContext) lines.push(coachingContext);
  const sessionContextLine = consumeSessionContextLine();
  if (sessionContextLine) lines.push(sessionContextLine);
  return lines.join('\n');
}

function buildTodayIntakeSummary(history: NutritionHistoryEntry[]) {
  const tracked = getTodayTrackedMacroTotals(history);
  if (!tracked.mealCount) return '';
  return `Today's tracked intake so far: ~${Math.round(tracked.totals.calories)} kcal, ${Math.round(tracked.totals.protein)}g protein, ${Math.round(tracked.totals.carbs)}g carbs, ${Math.round(tracked.totals.fat)}g fat (${tracked.mealCount}${tracked.mealCount === 1 ? ' meal' : ' meals'} logged today)`;
}

function buildActionRequest(action: NutritionActionConfig): NutritionRequestPayload {
  return buildNutritionActionRequestSupport(
    action,
    tr(action.labelKey, action.fallbackLabel)
  );
}

function buildApiMessages(
  history: NutritionHistoryEntry[],
  userEntry: NutritionHistoryEntry,
  trace: Record<string, any>
) {
  const contextEntries = history.slice(-11, -1);
  trace.contextMessageCount = contextEntries.length;
  const apiMessages = contextEntries.map((message) => {
    if (message.role === 'user') {
      const text =
        message.promptText || message.text || (message.imageDataUrl ? '[food photo]' : '');
      return { role: 'user', content: text };
    }
    return { role: 'assistant', content: message.text || '' };
  });

  const content: Array<Record<string, unknown>> = [];
  if (userEntry.imageDataUrl) {
    const parts = String(userEntry.imageDataUrl).split(',');
    const base64 = parts[1] || '';
    const mediaMatch = parts[0]?.match(/data:([^;]+)/);
    const mediaType = mediaMatch?.[1] || 'image/jpeg';
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    });
  }
  if (userEntry.promptText) {
    content.push({ type: 'text', text: userEntry.promptText });
  }
  if (!content.length) {
    content.push({
      type: 'text',
      text: tr('nutrition.default_prompt', 'What can you tell me about this food?'),
    });
  }
  apiMessages.push({ role: 'user', content });
  trace.apiMessageCount = apiMessages.length;
  return apiMessages;
}

function setLoadingState(loading: boolean, loadingContext = 'text') {
  useNutritionStore.setState((current) => ({
    ...current,
    loading,
    loadingContext,
    streaming: false,
  }));
  recomputeNutritionStore();
}

function showToast(message: string, color = 'var(--orange)') {
  getNutritionWindow()?.showToast?.(message, color);
}

function openNutritionLoginWindow() {
  getNutritionWindow()?.showLoginScreen?.();
}

async function callNutritionCoach(
  apiMessages: Array<Record<string, unknown>>,
  hasImage: boolean,
  trace: Record<string, any>,
  history: NutritionHistoryEntry[]
) {
  const requestStartedAt =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  const runtimeWindow = getNutritionWindow();
  const currentUser = dataStore.getState().currentUser;
  if (!String(currentUser?.id || '').trim()) {
    throw new Error(tr('nutrition.error.auth_required', 'Sign in to use Nutrition Coach.'));
  }

  const baseUrl = String(runtimeWindow?.__IRONFORGE_SUPABASE_URL__ || '').trim();
  const functionUrl = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/functions/v1/nutrition-coach` : '';
  if (!functionUrl) {
    throw new Error(
      tr('nutrition.error.server', 'Nutrition Coach is temporarily unavailable.')
    );
  }

  const sessionResult = (await runtimeWindow?.__IRONFORGE_SUPABASE__?.auth?.getSession?.()) as {
    data?: {
      session?: {
        access_token?: string;
      } | null;
    } | null;
  } | null;
  const accessToken = sessionResult?.data?.session?.access_token || '';
  if (!accessToken) {
    throw new Error(tr('nutrition.error.auth_required', 'Sign in to use Nutrition Coach.'));
  }

  const targets = buildTargetsPayload(calculateTargets(profileStore.getState().profile));
  const requestBody = JSON.stringify({
    messages: apiMessages,
    locale: i18nStore.getState().language === 'fi' ? 'fi' : 'en',
    requestKind: hasImage ? 'photo' : 'text',
    trainingContext: sanitizeTrainingContext(buildTrainingContext()),
    todayIntakeSummary: sanitizeTodayIntakeSummary(buildTodayIntakeSummary(history)),
    targets,
    actionId: trace.actionId || null,
  });
  trace.requestPayloadChars = requestBody.length;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NUTRITION_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        apikey: String(runtimeWindow?.__IRONFORGE_SUPABASE_PUBLISHABLE_KEY__ || ''),
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: requestBody,
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          tr('nutrition.error.auth_required', 'Sign in to use Nutrition Coach.')
        );
      }
      if (response.status === 413) {
        throw new Error(
          tr(
            'nutrition.error.photo_too_large',
            'That photo is too large. Choose a smaller image and try again.'
          )
        );
      }
      if (response.status === 429) {
        throw new Error(
          tr(
            'nutrition.error.rate_limit',
            'Rate limit reached - wait a moment and try again.'
          )
        );
      }
      if (response.status >= 500) {
        throw new Error(
          tr(
            'nutrition.error.server',
            'Nutrition Coach is temporarily unavailable.'
          )
        );
      }
      throw new Error(
        String(errorData?.error?.message || '') ||
          tr('nutrition.error.api', 'Something went wrong. Try again in a moment.')
      );
    }
    const responseJson = await response.json();
    const requestFinishedAt =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    const requestDuration = Math.max(
      0,
      Math.round(requestFinishedAt - requestStartedAt)
    );
    trace.stages.requestMs = requestDuration;
    trace.stages.modelMs = requestDuration;
    return responseJson;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new Error(
        tr(
          'nutrition.error.timeout',
          'Nutrition Coach took too long to respond. Try again.'
        )
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sendNutritionMessage(payload: NutritionRequestPayload) {
  if (useNutritionStore.getState().loading) return;
  const operationStartedAt =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  syncNutritionInputsFromLegacy();
  refreshNutritionStore();
  const trace: Record<string, any> = payload.trace || createNutritionTrace(payload);
  trace.stages.preflightMs = Math.max(
    0,
    Math.round(
      (typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now()) - operationStartedAt
    )
  );

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    writeHistory([
      ...useNutritionStore.getState().history,
      {
        id: `${Date.now()}-a`,
        role: 'assistant',
        text: tr(
          'nutrition.error.offline',
          'You are offline. Connect to the internet and try again.'
        ),
        timestamp: Date.now(),
        isError: true,
      },
    ]);
    trace.error = 'offline';
    finalizeNutritionTrace(trace);
    return;
  }

  const userEntry: NutritionHistoryEntry = {
    id: `${Date.now()}-u`,
    role: 'user',
    text: payload.displayText || '',
    promptText: payload.promptText || payload.displayText || '',
    imageDataUrl: payload.imageDataUrl || null,
    actionId: payload.actionId || null,
    imageFileSize: payload.imageFileSize || null,
    isCorrection: payload.isCorrection === true,
    timestamp: Date.now(),
  };
  const historyWithUser = [...useNutritionStore.getState().history, userEntry];
  writeHistory(historyWithUser);
  setLoadingState(true, userEntry.imageDataUrl ? 'photo' : 'text');

  try {
    const apiMessages = buildApiMessages(historyWithUser, userEntry, trace);
    const result = await callNutritionCoach(
      apiMessages,
      !!userEntry.imageDataUrl,
      trace,
      historyWithUser
    );
    const parseStartedAt =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    let structured = normalizeStructuredNutritionResponse(result);
    let fallbackText = '';
    if (!structured && typeof result?.raw_text === 'string') {
      fallbackText = String(result.raw_text || '').trim();
      structured = parseStructuredNutritionResponse(result.raw_text);
    }
    trace.stages.parseMs = Math.max(
      0,
      Math.round(
        (typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now()) - parseStartedAt
      )
    );
    trace.model = result?.model ? String(result.model) : null;
    trace.usage = result?.usage || null;
    const assistantEntry: NutritionHistoryEntry = {
      id: `${Date.now()}-a`,
      role: 'assistant',
      text: structured ? structured.display_markdown : fallbackText,
      timestamp: Date.now(),
      model: trace.model,
      actionId: userEntry.actionId || null,
    };
    if (structured) assistantEntry.structured = structured;
    if (!assistantEntry.text) {
      assistantEntry.text = tr(
        'nutrition.error.api',
        'Something went wrong. Try again in a moment.'
      );
      assistantEntry.isError = true;
      trace.parseSource = 'empty';
    } else if (structured) {
      trace.parseSource = 'structured';
    } else if (fallbackText) {
      trace.parseSource = 'plain_text';
    }
    const renderStartedAt =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    writeHistory([...historyWithUser, assistantEntry]);
    trace.stages.renderMs = Math.max(
      0,
      Math.round(
        (typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now()) - renderStartedAt
      )
    );
    trace.success = assistantEntry.isError !== true;
    trace.outputChars = String(assistantEntry.text || '').length;
  } catch (error) {
    const errorText =
      (error as Error)?.message ||
      tr('nutrition.error.api', 'Something went wrong. Try again in a moment.');
    const renderStartedAt =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    writeHistory([
      ...historyWithUser,
      {
        id: `${Date.now()}-a`,
        role: 'assistant',
        text: errorText,
        timestamp: Date.now(),
        isError: true,
      },
    ]);
    trace.stages.parseMs = trace.stages.parseMs ?? 0;
    trace.stages.renderMs = Math.max(
      0,
      Math.round(
        (typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now()) - renderStartedAt
      )
    );
    trace.success = false;
    trace.error = errorText;
    trace.outputChars = String(errorText || '').length;
  } finally {
    setLoadingState(false);
    trace.messageCount = useNutritionStore.getState().history.length;
    finalizeNutritionTrace(trace);
  }
}

export const useNutritionStore = create<NutritionStoreState>(() => ({
  history: [],
  activeHistoryKey: '',
  selectedActionId: 'plan_today',
  loading: false,
  loadingContext: 'text',
  streaming: false,
  scrollVersion: 0,
  sessionContext: null,
  view: {
    values: {
      canUseNutrition: false,
      loading: { visible: false, text: '' },
      selectedActionId: 'plan_today',
      actions: [],
      contextBanner: null,
      todayCard: null,
      messagesState: 'setup',
      messages: [],
      showCorrectionInput: false,
      scrollVersion: 0,
    },
  },
  dashboardSummary: null,
  recompute: () => recomputeNutritionStore(),
  refreshFromStorage: () => refreshNutritionStore(true),
  selectAction: async (actionId) => {
    useNutritionStore.setState((current) => ({
      ...current,
      selectedActionId: getActionById(actionId).id,
    }));
    recomputeNutritionStore();
  },
  submitSelectedAction: async () => {
    await sendNutritionMessage(
      buildActionRequest(getActionById(useNutritionStore.getState().selectedActionId))
    );
  },
  submitTextMessage: async (text, isCorrection = false) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    await sendNutritionMessage({
      actionId: null,
      displayText: trimmed,
      promptText: trimmed,
      imageDataUrl: null,
      isCorrection,
    });
  },
  handlePhoto: (event) => {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0];
    if (!file) return;
    if (target) target.value = '';

    if (!currentUserId()) {
      showToast(tr('nutrition.error.auth_required', 'Sign in to use Nutrition Coach.'));
      openNutritionLoginWindow();
      return;
    }
    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      showToast(
        tr(
          'nutrition.error.invalid_photo',
          'Please choose an image file for meal analysis.'
        )
      );
      return;
    }
    if (file.size > NUTRITION_MAX_PHOTO_BYTES) {
      showToast(
        tr(
          'nutrition.error.photo_too_large',
          'That photo is too large. Choose a smaller image and try again.'
        )
      );
      return;
    }

    const trace = createNutritionTrace({
      actionId: 'analyze_photo',
      displayText: '',
      promptText: '',
      imageDataUrl: '',
      imageFileSize: file.size,
    });
    const reader = new FileReader();
    reader.onerror = () => {
      trace.error = 'file_read_error';
      finalizeNutritionTrace(trace);
      showToast(
        tr(
          'nutrition.error.invalid_photo',
          'Please choose an image file for meal analysis.'
        )
      );
    };
    reader.onload = (loadEvent) => {
      void compressImage(String(loadEvent.target?.result || ''), 1024, 0.82, trace).then(
        async (compressed) => {
          if (estimateDataUrlBytes(compressed) > NUTRITION_MAX_COMPRESSED_BYTES) {
            trace.error = 'photo_too_large';
            finalizeNutritionTrace(trace);
            showToast(
              tr(
                'nutrition.error.photo_too_large',
                'That photo is too large. Choose a smaller image and try again.'
              )
            );
            return;
          }
          await sendNutritionMessage({
            actionId: 'analyze_photo',
            displayText: tr(
              'nutrition.action.analyze_photo',
              'Analyze this food photo'
            ),
            promptText: [
              'Primary task: Analyze this food photo.',
              'Analyze the attached food photo, estimate macros when possible, and explain how this meal fits my goals today.',
              'Response format: Estimate macros first, then 1-2 sentences of coaching. End with remaining calories and protein for today.',
              'A food photo is attached.',
            ].join('\n\n'),
            imageDataUrl: compressed,
            imageFileSize: file.size,
            trace,
          });
        }
      );
    };
    reader.readAsDataURL(file);
  },
  retryLastMessage: async () => {
    const history = [...useNutritionStore.getState().history];
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index]?.role !== 'user') continue;
      const entry = history[index];
      writeHistory(history.slice(0, index));
      await sendNutritionMessage({
        actionId: entry.actionId || null,
        displayText: entry.text || '',
        promptText: entry.promptText || entry.text || '',
        imageDataUrl: entry.imageDataUrl || null,
      });
      return;
    }
  },
  clearHistory: () => {
    const runtimeWindow = getNutritionWindow();
    const clear = () => {
      removeHistoryKey();
      useNutritionStore.setState((current) => ({
        ...current,
        history: [],
        activeHistoryKey: getHistoryKey(),
        scrollVersion: current.scrollVersion + 1,
      }));
      recomputeNutritionStore();
    };
    if (typeof runtimeWindow?.showConfirm === 'function') {
      runtimeWindow.showConfirm(
        tr('nutrition.clear.title', 'Clear conversation'),
        tr(
          'nutrition.clear.body',
          'This will delete your entire nutrition conversation history.'
        ),
        clear
      );
      return;
    }
    clear();
  },
  clearLocalData: (options) => {
    const opts = options || {};
    const includeScoped = opts.includeScoped !== false;
    const includeLegacy = opts.includeLegacy !== false;
    const scopedUserId = String(opts.userId || currentUserId()).trim();
    try {
      const keysToRemove: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;
        if (key === LOCAL_CACHE_KEYS.nutritionTrace) {
          keysToRemove.push(key);
          continue;
        }
        if (
          includeLegacy &&
          (key === LOCAL_CACHE_KEYS.nutritionHistory ||
            key === 'ic_nutrition_key' ||
            key.startsWith(`${LOCAL_CACHE_KEYS.nutritionHistory}::`) ||
            key.startsWith(`${LOCAL_CACHE_KEYS.nutritionDayPrefix}::`))
        ) {
          keysToRemove.push(key);
          continue;
        }
        if (
          includeScoped &&
          scopedUserId &&
          (key === `${LOCAL_CACHE_KEYS.nutritionHistory}::${scopedUserId}` ||
            key.startsWith(`${LOCAL_CACHE_KEYS.nutritionDayPrefix}::${scopedUserId}::`))
        ) {
          keysToRemove.push(key);
        }
      }
      Array.from(new Set(keysToRemove)).forEach((key) => localStorage.removeItem(key));
    } catch {}
    useNutritionStore.setState((current) => ({
      ...current,
      history: [],
      activeHistoryKey: getHistoryKey(),
      scrollVersion: current.scrollVersion + 1,
    }));
    recomputeNutritionStore();
  },
  setSessionContext: (ctx) => {
    setSessionContextState(normalizeSessionContext(ctx));
  },
}));

export const installLegacyNutritionStoreBridge = installNutritionStore;
export const disposeLegacyNutritionStoreBridge = disposeNutritionStore;

function syncNutritionStoreWindowBindings() {
  const runtimeWindow = getNutritionWindow();
  if (!runtimeWindow) return;
  runtimeWindow.setSelectedNutritionAction = (actionId) => {
    void useNutritionStore.getState().selectAction(String(actionId || ''));
  };
  runtimeWindow.submitNutritionMessage = () =>
    useNutritionStore.getState().submitSelectedAction();
  runtimeWindow.submitNutritionTextMessage = ((
    text: string,
    isCorrection?: boolean
  ) =>
    useNutritionStore.getState().submitTextMessage(
      String(text || ''),
      isCorrection === true
    )) as NutritionWindow['submitNutritionTextMessage'];
  runtimeWindow.handleNutritionPhoto = (event) => {
    useNutritionStore.getState().handlePhoto(event);
  };
  runtimeWindow.retryLastNutritionMessage = () =>
    useNutritionStore.getState().retryLastMessage();
  runtimeWindow.clearNutritionHistory = () => useNutritionStore.getState().clearHistory();
  runtimeWindow.clearNutritionLocalData = (options) =>
    useNutritionStore.getState().clearLocalData(options);
  runtimeWindow.openNutritionLogin = () => openNutritionLoginWindow();
  runtimeWindow.isNutritionCoachAvailable = () => !!currentUserId();
  runtimeWindow.setNutritionSessionContext = (ctx) =>
    useNutritionStore.getState().setSessionContext(
      (ctx as Record<string, unknown> | null) || null
    );
  runtimeWindow.getDashboardNutritionSnapshot = () =>
    useNutritionStore.getState().dashboardSummary;
  delete runtimeWindow.syncNutritionBridge;
}

export function installNutritionStore() {
  if (!storeInstalled && typeof window !== 'undefined') {
    storeInstalled = true;
    refreshNutritionStore(true);
    unsubscribeDataStore = dataStore.subscribe(() => {
      refreshNutritionStore(true);
    });
    unsubscribeProfileStore = profileStore.subscribe(() => {
      recomputeNutritionStore();
    });
    unsubscribeI18nStore = i18nStore.subscribe(() => {
      recomputeNutritionStore();
    });
    unsubscribeRuntimeStore = useRuntimeStore.subscribe((state, previousState) => {
      const nextPage = state.navigation.activePage;
      const prevPage = previousState?.navigation.activePage;
      if (
        nextPage !== prevPage &&
        (nextPage === 'nutrition' || nextPage === 'dashboard')
      ) {
        syncNutritionInputsFromLegacy();
        refreshNutritionStore(true);
      }
    });
  }
  syncNutritionStoreWindowBindings();
}

export function disposeNutritionStore() {
  unsubscribeDataStore?.();
  unsubscribeProfileStore?.();
  unsubscribeI18nStore?.();
  unsubscribeRuntimeStore?.();
  unsubscribeDataStore = null;
  unsubscribeProfileStore = null;
  unsubscribeI18nStore = null;
  unsubscribeRuntimeStore = null;
  clearSessionContextTimer();
  storeInstalled = false;
}

export function getNutritionStoreSnapshot() {
  return useNutritionStore.getState().view;
}
