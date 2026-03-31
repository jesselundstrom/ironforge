import { workoutStore } from '../../stores/workout-store';
import { callLegacyWindowFunction, readLegacyWindowValue } from './legacy-call';

type EventLike = Event | { nativeEvent?: Event } | null | undefined;

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
  const getter = readLegacyWindowValue<() => string>('getSelectedBonusDuration');
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
  callLegacyWindowFunction('applyQuickWorkoutAdjustment', mode);
}

export function undoQuickWorkoutAdjustment() {
  callLegacyWindowFunction('undoQuickWorkoutAdjustment');
}

export function showRPEPicker(
  exerciseName: string,
  setNumber: number,
  callback: (value: number | null) => void
) {
  return callLegacyWindowFunction(
    'showRPEPicker',
    exerciseName,
    setNumber,
    callback
  );
}

export function selectRPE(value: number) {
  callLegacyWindowFunction('selectRPE', value);
}

export function skipRPE() {
  callLegacyWindowFunction('skipRPE');
}

export function showSportReadinessCheck(
  callback: (context: Record<string, unknown> | null) => void
) {
  return callLegacyWindowFunction('showSportReadinessCheck', callback);
}

export function selectSportReadiness(signal: string) {
  callLegacyWindowFunction('selectSportReadiness', signal);
}

export function cancelSportReadinessCheck() {
  callLegacyWindowFunction('cancelSportReadinessCheck');
}

export function showSessionSummary(summaryData: Record<string, unknown>) {
  return callLegacyWindowFunction<Promise<unknown> | unknown>(
    'showSessionSummary',
    summaryData
  );
}

export function updateSummaryNotes(value: string) {
  callLegacyWindowFunction('updateSummaryNotes', value);
}

export function setSummaryFeedback(value: string) {
  callLegacyWindowFunction('setSummaryFeedback', value);
}

export function closeSummaryModal(goToNutrition?: boolean) {
  callLegacyWindowFunction('closeSummaryModal', goToNutrition);
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
  callLegacyWindowFunction('startSessionSummaryCelebration', modal, summaryData);
}

export function startWorkout() {
  workoutStore.getState().startWorkout();
}

export function updateRestDuration(nextValue?: string | number | null) {
  workoutStore.getState().updateRestDuration(nextValue);
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
