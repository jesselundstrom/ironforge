import { workoutStore } from '../../stores/workout-store';
import { useRuntimeStore } from '../store/runtime-store';
import { buildSessionSummaryPromptState } from './workout-runtime';
import { t } from './i18n';
import { callLegacyWindowFunction, readLegacyWindowValue } from './legacy-call';
import { playForgeBurst } from './forge-burst';

type EventLike = Event | { nativeEvent?: Event } | null | undefined;

type WorkoutOverlaySnapshot = {
  rpePrompt?: Record<string, unknown> | null;
  summaryPrompt?: Record<string, unknown> | null;
  sportCheckPrompt?: Record<string, unknown> | null;
  exerciseGuidePrompt?: Record<string, unknown> | null;
};

type SummaryResult = {
  feedback: string | null;
  notes: string;
  goToNutrition: boolean;
};

const RPE_FEEL_KEYS: Record<number, [string, string]> = {
  6: ['rpe.feel.6', 'Easy'],
  7: ['rpe.feel.7', 'Moderate'],
  8: ['rpe.feel.8', 'Hard'],
  9: ['rpe.feel.9', 'Very Hard'],
  10: ['rpe.feel.10', 'Max'],
};

const RPE_DESC_KEYS: Record<number, [string, string]> = {
  6: ['rpe.desc.6', 'Could keep going easily'],
  7: ['rpe.desc.7', 'Comfortable effort'],
  8: ['rpe.desc.8', 'Challenging but controlled'],
  9: ['rpe.desc.9', 'Maybe 1 rep left'],
  10: ['rpe.desc.10', 'Nothing left'],
};

let pendingRpeCallback: ((value: number | null) => void) | null = null;
let pendingSportReadinessCallback:
  | ((context: Record<string, unknown> | null) => void)
  | null = null;
let pendingSummaryResolve: ((result: SummaryResult | null) => void) | null =
  null;

function setWorkoutSessionState(partial: Record<string, unknown>) {
  const current = useRuntimeStore.getState().workoutSession.session;
  useRuntimeStore.getState().syncWorkoutSession({
    ...current,
    ...partial,
  });
}

function getRpePromptSnapshot() {
  const prompt = useRuntimeStore.getState().workoutSession.session.rpePrompt;
  return prompt && typeof prompt === 'object' ? { ...prompt } : null;
}

function getSportCheckPromptSnapshot() {
  const prompt =
    useRuntimeStore.getState().workoutSession.session.sportCheckPrompt;
  return prompt && typeof prompt === 'object' ? { ...prompt } : null;
}

function getSummaryPromptSnapshot() {
  const prompt =
    useRuntimeStore.getState().workoutSession.session.summaryPrompt;
  return prompt && typeof prompt === 'object' ? { ...prompt } : null;
}

function readSportReadinessContext() {
  const getter = readLegacyWindowValue<() => Record<string, unknown> | null>(
    'getPendingSportReadinessContext'
  );
  return getter?.() || null;
}

export function getWorkoutOverlaySnapshot() {
  return {
    rpePrompt: getRpePromptSnapshot(),
    summaryPrompt: getSummaryPromptSnapshot(),
    sportCheckPrompt: getSportCheckPromptSnapshot(),
  };
}

export function installWorkoutOverlayBridge() {
  if (typeof window === 'undefined') return;
  const runtimeWindow = window as Window & {
    getWorkoutOverlaySnapshot?: () => WorkoutOverlaySnapshot;
    showRPEPicker?: typeof showRPEPicker;
    selectRPE?: typeof selectRPE;
    skipRPE?: typeof skipRPE;
    showSportReadinessCheck?: typeof showSportReadinessCheck;
    selectSportReadiness?: typeof selectSportReadiness;
    cancelSportReadinessCheck?: typeof cancelSportReadinessCheck;
    showSessionSummary?: typeof showSessionSummary;
    closeSummaryModal?: typeof closeSummaryModal;
    setSummaryFeedback?: typeof setSummaryFeedback;
    updateSummaryNotes?: typeof updateSummaryNotes;
    _summaryCleanup?: (() => void) | null;
  };
  const legacyGetWorkoutOverlaySnapshot =
    typeof runtimeWindow.getWorkoutOverlaySnapshot === 'function'
      ? runtimeWindow.getWorkoutOverlaySnapshot.bind(runtimeWindow)
      : null;

  runtimeWindow.getWorkoutOverlaySnapshot = () => ({
    ...(legacyGetWorkoutOverlaySnapshot?.() || {}),
    rpePrompt: getRpePromptSnapshot(),
    sportCheckPrompt:
      getSportCheckPromptSnapshot() ||
      legacyGetWorkoutOverlaySnapshot?.()?.sportCheckPrompt ||
      null,
  });
  runtimeWindow.showRPEPicker = showRPEPicker;
  runtimeWindow.selectRPE = selectRPE;
  runtimeWindow.skipRPE = skipRPE;
  runtimeWindow.showSportReadinessCheck = showSportReadinessCheck;
  runtimeWindow.selectSportReadiness = selectSportReadiness;
  runtimeWindow.cancelSportReadinessCheck = cancelSportReadinessCheck;
  runtimeWindow.showSessionSummary = showSessionSummary;
  runtimeWindow.closeSummaryModal = closeSummaryModal;
  runtimeWindow.setSummaryFeedback = setSummaryFeedback;
  runtimeWindow.updateSummaryNotes = updateSummaryNotes;
}

export function openExerciseCatalogForAdd() {
  callLegacyWindowFunction('openExerciseCatalogForAdd');
}

export function quickLogSport() {
  callLegacyWindowFunction('quickLogSport');
}

export function setPendingSportReadinessLevel(value: string) {
  callLegacyWindowFunction('setPendingSportReadinessLevel', value);
}

export function setPendingSportReadinessTiming(value: string) {
  callLegacyWindowFunction('setPendingSportReadinessTiming', value);
}

export function setPendingEnergyLevel(value: string) {
  callLegacyWindowFunction('setPendingEnergyLevel', value);
}

export function setPendingSessionMode(
  value: string,
  options?: Record<string, unknown>
) {
  callLegacyWindowFunction('setPendingSessionMode', value, options);
}

export function getSelectedBonusDuration() {
  const getter = readLegacyWindowValue<() => string>(
    'getSelectedBonusDuration'
  );
  return getter?.();
}

export function setSelectedWorkoutStartOption(value: string) {
  callLegacyWindowFunction('setSelectedWorkoutStartOption', value);
}

export function setProgramDayOption(value: string) {
  callLegacyWindowFunction('setProgramDayOption', value);
}

export function setSelectedBonusDuration(value: string) {
  callLegacyWindowFunction('setSelectedBonusDuration', value);
}

export function swapAuxExercise(exerciseIndex: number) {
  callLegacyWindowFunction('swapAuxExercise', exerciseIndex);
}

export function swapBackExercise(exerciseIndex: number) {
  callLegacyWindowFunction('swapBackExercise', exerciseIndex);
}

export function collapseCompletedExercise(exerciseUiKey: string) {
  callLegacyWindowFunction('collapseCompletedExercise', exerciseUiKey);
}

export function expandCompletedExercise(exerciseUiKey: string) {
  callLegacyWindowFunction('expandCompletedExercise', exerciseUiKey);
}

export function openExerciseGuide(exerciseRef: string) {
  callLegacyWindowFunction('openExerciseGuide', exerciseRef);
}

export function closeExerciseGuide(event?: EventLike) {
  callLegacyWindowFunction(
    'closeExerciseGuide',
    event && 'nativeEvent' in event ? event.nativeEvent : event
  );
}

export function handleSetInputKey(
  event: KeyboardEvent,
  exerciseUiKey: string,
  setIndex: number,
  field: string
) {
  callLegacyWindowFunction(
    'handleSetInputKey',
    event,
    exerciseUiKey,
    setIndex,
    field
  );
}

export function clearLogActiveFocusTarget(token: number) {
  callLegacyWindowFunction('clearLogActiveFocusTarget', token);
}

export function clearLogActiveSetSignal(token: number) {
  callLegacyWindowFunction('clearLogActiveSetSignal', token);
}

export function clearLogActiveCollapseSignal(token: number) {
  callLegacyWindowFunction('clearLogActiveCollapseSignal', token);
}

export function applyQuickWorkoutAdjustment(mode: string) {
  workoutStore.getState().applyQuickWorkoutAdjustment(mode);
}

export function undoQuickWorkoutAdjustment() {
  workoutStore.getState().undoQuickWorkoutAdjustment();
}

export function showRPEPicker(
  exerciseName: string,
  setNumber: number,
  callback: (value: number | null) => void
) {
  pendingRpeCallback = callback;
  setWorkoutSessionState({
    rpeOpen: true,
    rpePrompt: {
      open: true,
      title: t('rpe.session_title', 'How hard was this session?'),
      subtitle:
        setNumber < 0
          ? t(
              'rpe.session_prompt',
              'Rate overall session effort (6 = easy, 10 = max)'
            )
          : `${exerciseName} - ${t('rpe.set', 'Set')} ${setNumber + 1}`,
      options: [6, 7, 8, 9, 10].map((value) => ({
        value,
        feel: t(RPE_FEEL_KEYS[value][0], RPE_FEEL_KEYS[value][1]),
        description: t(RPE_DESC_KEYS[value][0], RPE_DESC_KEYS[value][1]),
      })),
    },
  });
}

export function selectRPE(value: number) {
  const callback = pendingRpeCallback;
  pendingRpeCallback = null;
  setWorkoutSessionState({
    rpeOpen: false,
    rpePrompt: null,
  });
  callback?.(value);
}

export function skipRPE() {
  const callback = pendingRpeCallback;
  pendingRpeCallback = null;
  setWorkoutSessionState({
    rpeOpen: false,
    rpePrompt: null,
  });
  callback?.(null);
}

export function showSportReadinessCheck(
  callback: (context: Record<string, unknown> | null) => void
) {
  pendingSportReadinessCallback = callback;
  const schedule = readLegacyWindowValue<Record<string, unknown>>('schedule');
  const rawSportName = String(schedule?.sportName || '').trim();
  const sportLabel = rawSportName || t('settings.sport_name_default', 'sport');
  setWorkoutSessionState({
    sportCheckOpen: true,
    sportCheckPrompt: {
      open: true,
      title: t('workout.sport_check.title', 'Sport check-in'),
      subtitle: t(
        'workout.sport_check.sub',
        'Have you had a leg-heavy {sport} session yesterday, or do you have one tomorrow?',
        { sport: sportLabel.toLowerCase() }
      ),
    },
  });
}

export function selectSportReadiness(signal: string) {
  const callback = pendingSportReadinessCallback;
  pendingSportReadinessCallback = null;
  setWorkoutSessionState({
    sportCheckOpen: false,
    sportCheckPrompt: null,
  });
  callLegacyWindowFunction('setPendingSportReadiness', signal);
  callback?.(readSportReadinessContext());
}

export function cancelSportReadinessCheck() {
  pendingSportReadinessCallback = null;
  setWorkoutSessionState({
    sportCheckOpen: false,
    sportCheckPrompt: null,
  });
}

export function showSessionSummary(
  summaryData: Record<string, unknown>
): Promise<SummaryResult | null> {
  return new Promise((resolve) => {
    pendingSummaryResolve = resolve;
    const isNutritionAvailable = readLegacyWindowValue<() => boolean>(
      'isNutritionCoachAvailable'
    );
    const canLogNutrition =
      typeof isNutritionAvailable === 'function'
        ? isNutritionAvailable() === true
        : !!readLegacyWindowValue('currentUser');
    const promptState = buildSessionSummaryPromptState(
      { summaryData, canLogNutrition, seed: Date.now() },
      { t }
    );
    setWorkoutSessionState({
      summaryOpen: true,
      summaryPrompt: promptState,
    });
  });
}

export function updateSummaryNotes(value: string) {
  const prompt =
    useRuntimeStore.getState().workoutSession.session.summaryPrompt;
  if (!prompt || typeof prompt !== 'object') return;
  setWorkoutSessionState({
    summaryPrompt: {
      ...(prompt as Record<string, unknown>),
      notes: String(value || '').slice(0, 500),
    },
  });
}

export function setSummaryFeedback(value: string) {
  const prompt =
    useRuntimeStore.getState().workoutSession.session.summaryPrompt;
  if (!prompt || typeof prompt !== 'object') return;
  setWorkoutSessionState({
    summaryPrompt: {
      ...(prompt as Record<string, unknown>),
      feedback: value,
    },
  });
}

export function closeSummaryModal(goToNutrition?: boolean) {
  const rw = window as Window & {
    _summaryCleanup?: (() => void) | null;
  };
  if (typeof rw._summaryCleanup === 'function') rw._summaryCleanup();
  rw._summaryCleanup = null;
  const prompt =
    useRuntimeStore.getState().workoutSession.session.summaryPrompt;
  const feedback =
    prompt && typeof prompt === 'object'
      ? ((prompt as Record<string, unknown>).feedback as string | null) || null
      : null;
  const notes = String(
    prompt && typeof prompt === 'object'
      ? (prompt as Record<string, unknown>).notes || ''
      : ''
  )
    .trim()
    .slice(0, 500);
  const resolve = pendingSummaryResolve;
  pendingSummaryResolve = null;
  setWorkoutSessionState({
    summaryOpen: false,
    summaryPrompt: null,
  });
  resolve?.({ feedback, notes, goToNutrition: goToNutrition === true });
}

export function runPageActivationSideEffects(page: string) {
  callLegacyWindowFunction('runPageActivationSideEffects', page);
}

export function prefersReducedMotionUI() {
  return callLegacyWindowFunction<boolean>('prefersReducedMotionUI') === true;
}

export function startSessionSummaryCelebration(
  modal: HTMLElement | null,
  summaryData: Record<string, unknown> | null
) {
  const canvas = modal?.querySelector('canvas');
  const rw = window as Window & {
    _summaryCleanup?: (() => void) | null;
  };
  if (typeof rw._summaryCleanup === 'function') rw._summaryCleanup();
  rw._summaryCleanup = null;
  if (!modal) return;
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const totalSets = Number(summaryData?.totalSets || 0);
  const prCount = Number(summaryData?.prCount || 0);
  rw._summaryCleanup = playForgeBurst(canvas, {
    densityMultiplier: Math.min(1.9, 1 + totalSets / 18 + prCount * 0.18),
    duration: prCount ? 1250 : 980,
    glowFrom: prCount ? 0.28 : 0.18,
    glowTo: prCount ? 0.58 : 0.4,
    palette: prCount
      ? [
          [255, 214, 94],
          [255, 245, 184],
        ]
      : null,
  });
  animateSummaryStats(modal, summaryData || {});
}

function animateSummaryStats(
  modal: HTMLElement,
  summaryData: Record<string, unknown>
) {
  const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds) || 0);
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return minutes > 0 ? `${minutes}m${rest > 0 ? ` ${rest}s` : ''}` : `${rest}s`;
  };
  const formatTonnage = (tonnage: number) => {
    const safe = Math.max(0, Number(tonnage) || 0);
    return safe >= 1000 ? `${(safe / 1000).toFixed(1)} t` : `${Math.round(safe)} kg`;
  };
  const values: Record<string, string> = {
    duration: formatDuration(Number(summaryData.duration || 0)),
    sets: `${Math.round(Number(summaryData.completedSets || 0))}/${Math.round(
      Number(summaryData.totalSets || 0)
    )}`,
    volume: formatTonnage(Number(summaryData.tonnage || 0)),
    rpe:
      Number(summaryData.rpe || 0) > 0
        ? String(Math.round(Number(summaryData.rpe || 0) * 10) / 10)
        : '--',
    prs: String(Math.round(Number(summaryData.prCount || 0))),
  };
  Object.entries(values).forEach(([key, value], index) => {
    const valueEl = modal.querySelector<HTMLElement>(`[data-stat-key="${key}"]`);
    const card = valueEl?.closest<HTMLElement>('.summary-stat');
    if (!valueEl || !card) return;
    window.setTimeout(() => {
      card.classList.add('is-visible');
      valueEl.dataset.statValue = value;
      valueEl.textContent = value;
    }, index * 100);
  });
}

export function startWorkout() {
  workoutStore.getState().startWorkout();
}

export function updateRestDuration(nextValue?: string | number | null) {
  workoutStore.getState().updateRestDuration(nextValue);
}

export function skipRest() {
  workoutStore.getState().skipRest();
}

export function addSet(exerciseIndex: number) {
  workoutStore.getState().addSet(exerciseIndex);
}

export function removeExercise(exerciseIndex: number) {
  workoutStore.getState().removeExercise(exerciseIndex);
}

export function toggleSet(exerciseIndex: number, setIndex: number) {
  workoutStore.getState().toggleSet(exerciseIndex, setIndex);
}

export function updateSet(
  exerciseIndex: number,
  setIndex: number,
  field: string,
  value: string | number
) {
  workoutStore.getState().updateSet(exerciseIndex, setIndex, field, value);
}

export function finishWorkout() {
  return workoutStore.getState().finishWorkout();
}

export function cancelWorkout() {
  workoutStore.getState().cancelWorkout();
}
