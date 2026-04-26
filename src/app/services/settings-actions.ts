import { callLegacyWindowFunction } from './legacy-call';
import { dataStore } from '../../stores/data-store';

function getAppRuntime() {
  if (typeof window === 'undefined') return null;
  return window.__IRONFORGE_APP_RUNTIME__ || null;
}

export function saveTrainingPreferences(options?: Record<string, unknown>) {
  if (typeof getAppRuntime()?.saveTrainingPreferences === 'function') {
    getAppRuntime()?.saveTrainingPreferences?.(options);
    return;
  }
  callLegacyWindowFunction('saveTrainingPreferences', options);
}

export function saveRestTimer() {
  if (typeof getAppRuntime()?.saveRestTimer === 'function') {
    getAppRuntime()?.saveRestTimer?.();
    return;
  }
  callLegacyWindowFunction('saveRestTimer');
}

export function restartOnboarding() {
  callLegacyWindowFunction('restartOnboarding');
}

export function saveBodyMetrics() {
  if (typeof getAppRuntime()?.saveBodyMetrics === 'function') {
    getAppRuntime()?.saveBodyMetrics?.();
    return;
  }
  callLegacyWindowFunction('saveBodyMetrics');
}

export function saveSchedule(nextValues?: Record<string, unknown>) {
  if (typeof getAppRuntime()?.saveSchedule === 'function') {
    return getAppRuntime()?.saveSchedule?.(nextValues);
  }
  return callLegacyWindowFunction('saveSchedule', nextValues);
}

export function saveLanguageSetting(nextLanguage: string) {
  if (typeof getAppRuntime()?.saveLanguageSetting === 'function') {
    getAppRuntime()?.saveLanguageSetting?.(nextLanguage);
    return;
  }
  callLegacyWindowFunction('saveLanguageSetting', nextLanguage);
}

export function logout() {
  return dataStore.getState().logout();
}

export function exportData() {
  if (typeof getAppRuntime()?.exportData === 'function') {
    getAppRuntime()?.exportData?.();
    return;
  }
  callLegacyWindowFunction('exportData');
}

export function importData(event: Event) {
  if (typeof getAppRuntime()?.importData === 'function') {
    getAppRuntime()?.importData?.(event);
    return;
  }
  callLegacyWindowFunction('importData', event);
}

export function checkDangerConfirm(nextValue: string) {
  if (typeof getAppRuntime()?.checkDangerConfirm === 'function') {
    getAppRuntime()?.checkDangerConfirm?.(nextValue);
    return;
  }
  callLegacyWindowFunction('checkDangerConfirm', nextValue);
}

export function clearAllData() {
  if (typeof getAppRuntime()?.clearAllData === 'function') {
    return getAppRuntime()?.clearAllData?.();
  }
  return callLegacyWindowFunction('clearAllData');
}

export function showDangerConfirm() {
  if (typeof getAppRuntime()?.showDangerConfirm === 'function') {
    getAppRuntime()?.showDangerConfirm?.();
    return;
  }
  callLegacyWindowFunction('showDangerConfirm');
}

export function saveSimpleProgramSettings() {
  if (typeof getAppRuntime()?.saveSimpleProgramSettings === 'function') {
    getAppRuntime()?.saveSimpleProgramSettings?.();
    return;
  }
  callLegacyWindowFunction('saveSimpleProgramSettings');
}

export function switchProgram(programId: string) {
  if (typeof getAppRuntime()?.switchProgram === 'function') {
    getAppRuntime()?.switchProgram?.(programId);
    return;
  }
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
