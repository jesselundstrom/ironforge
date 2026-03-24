declare module './AppShell.jsx' {
  import type { ComponentType } from 'react';

  const AppShell: ComponentType;
  export default AppShell;
}

declare module './OnboardingFlow.jsx' {
  import type { ComponentType } from 'react';

  const OnboardingFlow: ComponentType;
  export default OnboardingFlow;
}

declare global {
  interface Window {
    __IRONFORGE_APP_SHELL_READY__?: boolean;
    __IRONFORGE_RUNTIME_BRIDGE__?: {
      navigateToPage?: (page: string) => void;
      setActiveSettingsTab?: (tab: string) => void;
      openConfirm?: (confirm: {
        open?: boolean;
        title?: string;
        message?: string;
        confirmLabel?: string;
        cancelLabel?: string;
      }) => void;
      closeConfirm?: () => void;
      showToast?: (toast: {
        message: string;
        color?: string;
        variant?: string;
        undoLabel?: string;
        undoAction?: (() => void) | null;
        durationMs?: number;
      }) => void;
      hideToast?: () => void;
      setWorkoutSessionState?: (partial: Record<string, unknown>) => void;
      setLogStartView?: (view: Record<string, unknown> | null) => void;
      setLogActiveView?: (view: Record<string, unknown> | null) => void;
      setHistoryView?: (view: Record<string, unknown> | null) => void;
      setDashboardView?: (view: Record<string, unknown> | null) => void;
      setNutritionView?: (view: Record<string, unknown> | null) => void;
      setSettingsAccountView?: (view: Record<string, unknown> | null) => void;
      setSettingsBodyView?: (view: Record<string, unknown> | null) => void;
      setSettingsPreferencesView?: (view: Record<string, unknown> | null) => void;
      setSettingsProgramView?: (view: Record<string, unknown> | null) => void;
      setSettingsScheduleView?: (view: Record<string, unknown> | null) => void;
    };
    syncRuntimeStoreFromLegacy?: () => void;
    syncWorkoutSessionBridge?: () => void;
    syncHistoryBridge?: () => void;
    syncDashboardBridge?: () => void;
    syncSettingsBridge?: () => void;
    syncNutritionBridge?: () => void;
    getProgramRegistry?: () => Record<string, unknown>;
    getRegisteredPrograms?: () => Array<Record<string, unknown>>;
    hasRegisteredPrograms?: () => boolean;
    getProgramById?: (programId: string) => Record<string, unknown> | null;
    getProgramInitialState?: (programId: string) => Record<string, unknown> | null;
    setRestBarActiveState?: (active: boolean) => void;
    loadData?: (options?: {
      allowCloudSync?: boolean;
      userId?: string;
    }) => Promise<void> | void;
  }
}
