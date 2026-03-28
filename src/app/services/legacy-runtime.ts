import { startTransition } from 'react';
import {
  type AppPage,
  type ConfirmSnapshot,
  type ExerciseCatalogView,
  type LogActiveView,
  type LogStartView,
  type SessionSnapshot,
  type SettingsTab,
  type SettingsAccountView,
  type SettingsBodyView,
  type SettingsPreferencesView,
  type SettingsProgramView,
  type SettingsScheduleView,
  isAppPage,
  isSettingsTab,
} from '../constants';
import { useRuntimeStore } from '../store/runtime-store';
import { syncDashboardStoreWindowBindings } from '../../stores/dashboard-store';
import { syncHistoryStoreWindowBindings } from '../../stores/history-store';
import { casualFullBodyProgram } from '../../programs/casualfullbody';
import { forgeProgram } from '../../programs/forge';
import { hypertrophySplitProgram } from '../../programs/hypertrophysplit';
import { strongLifts5x5Program } from '../../programs/stronglifts5x5';
import { wendler531Program } from '../../programs/wendler531';

const LANGUAGE_EVENT = 'ironforge:language-changed';

const TYPED_PROGRAM_OVERRIDES = [
  casualFullBodyProgram,
  forgeProgram,
  hypertrophySplitProgram,
  strongLifts5x5Program,
  wendler531Program,
];

type RuntimeBridge = {
  navigateToPage: (page: string) => void;
  setActiveSettingsTab: (tab: string) => void;
  openConfirm: (confirm: Partial<ConfirmSnapshot>) => void;
  closeConfirm: () => void;
  showToast: (toast: {
    message: string;
    color?: string;
    variant?: string;
    undoLabel?: string;
    undoAction?: (() => void) | null;
    durationMs?: number;
  }) => void;
  hideToast: () => void;
  setWorkoutSessionState: (partial: Partial<SessionSnapshot>) => void;
  setLogStartView: (view: LogStartView | null) => void;
  setLogActiveView: (view: LogActiveView | null) => void;
  setSettingsAccountView: (view: SettingsAccountView | null) => void;
  setSettingsBodyView: (view: SettingsBodyView | null) => void;
  setSettingsPreferencesView: (view: SettingsPreferencesView | null) => void;
  setSettingsProgramView: (view: SettingsProgramView | null) => void;
  setSettingsScheduleView: (view: SettingsScheduleView | null) => void;
  setExerciseCatalogView: (view: ExerciseCatalogView | null) => void;
};

function detectInitialActivePage(): AppPage {
  const hashPage = window.location.hash
    ? window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]?.trim()
    : '';
  if (isAppPage(hashPage)) return hashPage;
  const activePage = document.querySelector('.page.active[id^="page-"]');
  const pageName = activePage?.id?.replace(/^page-/, '') || 'dashboard';
  return isAppPage(pageName) ? pageName : 'dashboard';
}

function detectInitialSettingsTab(): SettingsTab {
  const selectedTab = document.querySelector(
    '#settings-tabs .tab[aria-selected="true"]'
  );
  const selectedValue = selectedTab?.getAttribute('data-settings-tab') || '';
  if (isSettingsTab(selectedValue)) return selectedValue;

  const visibleTab = Array.from(
    document.querySelectorAll('#page-settings > div[id^="settings-tab-"]')
  ).find((panel) => panel instanceof HTMLElement && panel.style.display !== 'none');
  const visibleValue = visibleTab?.id?.replace(/^settings-tab-/, '') || '';
  return isSettingsTab(visibleValue) ? visibleValue : 'schedule';
}

function createDefaultConfirm(confirm?: Partial<ConfirmSnapshot>): ConfirmSnapshot {
  return {
    open: confirm?.open !== false,
    title: String(confirm?.title || 'Confirm'),
    message: String(confirm?.message || 'Are you sure?'),
    confirmLabel: String(confirm?.confirmLabel || 'Confirm'),
    cancelLabel: String(confirm?.cancelLabel || 'Cancel'),
  };
}

function syncHashToPage(page: AppPage) {
  const nextHash = `#/${page}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = `/${page}`;
  }
}

function installTypedProgramOverrides() {
  const runtimeWindow = window as Window & {
    registerProgram?: (program: Record<string, unknown>) => void;
  };
  if (typeof runtimeWindow.registerProgram !== 'function') return;
  TYPED_PROGRAM_OVERRIDES.forEach((program) => {
    runtimeWindow.registerProgram?.(program as unknown as Record<string, unknown>);
  });
}

function registerRuntimeBridge(): RuntimeBridge {
  const bridge: RuntimeBridge = {
    navigateToPage: (page) => {
      if (!isAppPage(page)) return;
      useRuntimeStore.getState().navigateToPage(page);
      syncHashToPage(page);
    },
    setActiveSettingsTab: (tab) => {
      if (!isSettingsTab(tab)) return;
      useRuntimeStore.getState().setActiveSettingsTab(tab);
    },
    openConfirm: (confirm) => {
      useRuntimeStore.getState().openConfirm(createDefaultConfirm(confirm));
    },
    closeConfirm: () => {
      useRuntimeStore.getState().closeConfirm();
    },
    showToast: (toast) => {
      useRuntimeStore.getState().showToast({
        message: String(toast?.message || ''),
        variant: String(toast?.variant || ''),
        background: String(toast?.color || ''),
        undoLabel: String(toast?.undoLabel || 'Undo'),
        undoAction:
          typeof toast?.undoAction === 'function' ? toast.undoAction : null,
        durationMs:
          Number.isFinite(toast?.durationMs) && Number(toast.durationMs) > 0
            ? Number(toast.durationMs)
            : typeof toast?.undoAction === 'function'
              ? 5000
              : 2800,
      });
    },
    hideToast: () => {
      useRuntimeStore.getState().hideToast();
    },
    setWorkoutSessionState: (partial) => {
      const current = useRuntimeStore.getState().workoutSession.session;
      useRuntimeStore.getState().syncWorkoutSession({
        ...current,
        ...partial,
      });
    },
    setLogStartView: (view) => {
      useRuntimeStore.getState().setLogStartView(view);
    },
    setLogActiveView: (view) => {
      useRuntimeStore.getState().setLogActiveView(view);
    },
    setSettingsAccountView: (view) => {
      useRuntimeStore.getState().setSettingsAccountView(view);
    },
    setSettingsBodyView: (view) => {
      useRuntimeStore.getState().setSettingsBodyView(view);
    },
    setSettingsPreferencesView: (view) => {
      useRuntimeStore.getState().setSettingsPreferencesView(view);
    },
    setSettingsProgramView: (view) => {
      useRuntimeStore.getState().setSettingsProgramView(view);
    },
    setSettingsScheduleView: (view) => {
      useRuntimeStore.getState().setSettingsScheduleView(view);
    },
    setExerciseCatalogView: (view) => {
      useRuntimeStore.getState().setExerciseCatalogView(view);
    },
  };

  (
    window as Window & {
      __IRONFORGE_RUNTIME_BRIDGE__?: Window['__IRONFORGE_RUNTIME_BRIDGE__'];
    }
  ).__IRONFORGE_RUNTIME_BRIDGE__ =
    bridge as unknown as Window['__IRONFORGE_RUNTIME_BRIDGE__'];
  return bridge;
}

export function syncRuntimeStoreFromLegacy() {
  useRuntimeStore.getState().navigateToPage(detectInitialActivePage());
  useRuntimeStore.getState().setActiveSettingsTab(detectInitialSettingsTab());
  const runtimeWindow = window as Window & {
    syncWorkoutSessionBridge?: () => void;
    syncSettingsBridge?: () => void;
  };
  if (typeof runtimeWindow.syncWorkoutSessionBridge === 'function') {
    runtimeWindow.syncWorkoutSessionBridge();
  }
  if (typeof runtimeWindow.syncSettingsBridge === 'function') {
    runtimeWindow.syncSettingsBridge();
  }
}

export function startLegacyRuntimeBridge() {
  installTypedProgramOverrides();
  registerRuntimeBridge();
  syncRuntimeStoreFromLegacy();
  syncDashboardStoreWindowBindings();
  syncHistoryStoreWindowBindings();

  const onLanguage = () => {
    startTransition(() => {
      useRuntimeStore.getState().bumpLanguageVersion();
      const runtimeWindow = window as Window & {
        syncWorkoutSessionBridge?: () => void;
        syncSettingsBridge?: () => void;
      };
      if (typeof runtimeWindow.syncWorkoutSessionBridge === 'function') {
        runtimeWindow.syncWorkoutSessionBridge();
      }
      if (typeof runtimeWindow.syncSettingsBridge === 'function') {
        runtimeWindow.syncSettingsBridge();
      }
    });
  };

  window.addEventListener(LANGUAGE_EVENT, onLanguage);
  window.__IRONFORGE_APP_SHELL_READY__ = true;

  return () => {
    window.removeEventListener(LANGUAGE_EVENT, onLanguage);
    const runtimeWindow = window as Window & {
      __IRONFORGE_RUNTIME_BRIDGE__?: RuntimeBridge;
    };
    delete runtimeWindow.__IRONFORGE_RUNTIME_BRIDGE__;
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

  window.__IRONFORGE_APP_SHELL_READY__ = false;
}

window.syncRuntimeStoreFromLegacy = syncRuntimeStoreFromLegacy;
