import { callLegacyWindowFunction } from './legacy-call';
import { dataStore } from '../../stores/data-store';

export function saveTrainingPreferences(options?: Record<string, unknown>) {
  callLegacyWindowFunction('saveTrainingPreferences', options);
}

export function saveRestTimer() {
  callLegacyWindowFunction('saveRestTimer');
}

export function restartOnboarding() {
  callLegacyWindowFunction('restartOnboarding');
}

export function saveBodyMetrics() {
  callLegacyWindowFunction('saveBodyMetrics');
}

export function saveSchedule(nextValues?: Record<string, unknown>) {
  callLegacyWindowFunction('saveSchedule', nextValues);
}

export function saveLanguageSetting(nextLanguage: string) {
  callLegacyWindowFunction('saveLanguageSetting', nextLanguage);
}

export function logout() {
  return dataStore.getState().logout();
}

export function exportData() {
  callLegacyWindowFunction('exportData');
}

export function importData(event: Event) {
  callLegacyWindowFunction('importData', event);
}

export function checkDangerConfirm(nextValue: string) {
  callLegacyWindowFunction('checkDangerConfirm', nextValue);
}

export function clearAllData() {
  return callLegacyWindowFunction('clearAllData');
}

export function showDangerConfirm() {
  callLegacyWindowFunction('showDangerConfirm');
}

export function saveSimpleProgramSettings() {
  callLegacyWindowFunction('saveSimpleProgramSettings');
}

export function switchProgram(programId: string) {
  callLegacyWindowFunction('switchProgram', programId);
}

export function openProgramSetupSheet() {
  callLegacyWindowFunction('openProgramSetupSheet');
}

export function closeProgramSetupSheet(event?: EventLike) {
  callLegacyWindowFunction(
    'closeProgramSetupSheet',
    event && 'nativeEvent' in event ? event.nativeEvent : event
  );
}
type EventLike = Event | { nativeEvent?: Event } | null | undefined;
