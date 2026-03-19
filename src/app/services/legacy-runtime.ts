import { startTransition } from 'react';
import {
  type AppPage,
  type ConfirmSnapshot,
  type SessionSnapshot,
  isAppPage,
} from '../constants';
import { useRuntimeStore } from '../store/runtime-store';

const APP_SHELL_EVENT =
  window.__IRONFORGE_APP_SHELL_EVENT__ || 'ironforge:app-shell-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';
const LOG_ACTIVE_EVENT =
  window.__IRONFORGE_LOG_ACTIVE_ISLAND_EVENT__ || 'ironforge:log-active-updated';
const LOG_START_EVENT =
  window.__IRONFORGE_LOG_START_ISLAND_EVENT__ || 'ironforge:log-start-updated';

let sessionPollTimer: number | null = null;

function getActivePageSnapshot(): AppPage {
  const page =
    typeof window.getActivePageName === 'function'
      ? window.getActivePageName()
      : 'dashboard';
  return isAppPage(page) ? page : 'dashboard';
}

function getConfirmSnapshot(): ConfirmSnapshot {
  if (typeof window.getConfirmReactSnapshot === 'function') {
    const snapshot = window.getConfirmReactSnapshot();
    return {
      open: snapshot?.open === true,
      title: String(snapshot?.title || 'Confirm'),
      message: String(snapshot?.message || 'Are you sure?'),
      confirmLabel: String(snapshot?.confirmLabel || 'Confirm'),
      cancelLabel: String(snapshot?.cancelLabel || 'Cancel'),
    };
  }
  return {
    open: false,
    title: 'Confirm',
    message: 'Are you sure?',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  };
}

function getSessionSnapshot(): SessionSnapshot {
  const state =
    typeof window.getIronforgeState === 'function'
      ? window.getIronforgeState()
      : null;
  const readOpen = (id: string) =>
    document.getElementById(id)?.classList.contains('active') === true;
  const restBar = document.getElementById('rest-timer-bar');

  return {
    activeWorkout: state?.activeWorkout ?? null,
    restDuration: Number(state?.restDuration || 0),
    restEndsAt: Number(state?.restEndsAt || 0),
    restSecondsLeft: Number(state?.restSecondsLeft || 0),
    restTotal: Number(state?.restTotal || 0),
    currentUser: state?.currentUser ?? null,
    restBarActive: restBar?.classList.contains('active') === true,
    rpeOpen: readOpen('rpe-modal'),
    summaryOpen: readOpen('summary-modal'),
    sportCheckOpen: readOpen('sport-check-modal'),
  };
}

export function syncRuntimeStoreFromLegacy() {
  const store = useRuntimeStore.getState();
  store.setActivePage(getActivePageSnapshot());
  store.setConfirmSnapshot(getConfirmSnapshot());
  store.syncSessionSnapshot(getSessionSnapshot());
}

function syncWithTransition() {
  startTransition(() => {
    syncRuntimeStoreFromLegacy();
  });
}

function updateSessionPolling() {
  const {
    session: { activeWorkout, restEndsAt },
  } = useRuntimeStore.getState();
  const shouldPoll = Boolean(activeWorkout) || Number(restEndsAt) > 0;

  if (!shouldPoll) {
    if (sessionPollTimer != null) {
      window.clearInterval(sessionPollTimer);
      sessionPollTimer = null;
    }
    return;
  }

  if (sessionPollTimer != null) return;
  sessionPollTimer = window.setInterval(() => {
    syncRuntimeStoreFromLegacy();
  }, 1000);
}

export function startLegacyRuntimeBridge() {
  syncRuntimeStoreFromLegacy();
  updateSessionPolling();

  const onAppShell = () => {
    syncWithTransition();
    updateSessionPolling();
  };
  const onLanguage = () => {
    startTransition(() => {
      useRuntimeStore.getState().bumpLanguageVersion();
    });
  };
  const onSession = () => {
    syncWithTransition();
    updateSessionPolling();
  };

  window.addEventListener(APP_SHELL_EVENT, onAppShell);
  window.addEventListener(LANGUAGE_EVENT, onLanguage);
  window.addEventListener(LOG_ACTIVE_EVENT, onSession);
  window.addEventListener(LOG_START_EVENT, onSession);
  window.addEventListener('pageshow', onSession);
  document.addEventListener('visibilitychange', onSession);

  return () => {
    window.removeEventListener(APP_SHELL_EVENT, onAppShell);
    window.removeEventListener(LANGUAGE_EVENT, onLanguage);
    window.removeEventListener(LOG_ACTIVE_EVENT, onSession);
    window.removeEventListener(LOG_START_EVENT, onSession);
    window.removeEventListener('pageshow', onSession);
    document.removeEventListener('visibilitychange', onSession);
    if (sessionPollTimer != null) {
      window.clearInterval(sessionPollTimer);
      sessionPollTimer = null;
    }
  };
}

export function prepareLegacyShellMount() {
  [
    'toast',
    'name-modal',
    'confirm-modal',
    'rpe-modal',
    'summary-modal',
    'sport-check-modal',
    'onboarding-modal',
    'exercise-guide-modal',
    'program-setup-sheet',
    'legacy-bottom-nav',
  ].forEach((id) => document.getElementById(id)?.remove());

  window.__IRONFORGE_APP_SHELL_MOUNTED__ = true;
  window.dispatchEvent(new CustomEvent(APP_SHELL_EVENT));
}
