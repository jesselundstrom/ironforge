/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    __IRONFORGE_TEST_USER_ID__?: string;
    __IRONFORGE_APP_SHELL_EVENT__?: string;
    __IRONFORGE_APP_SHELL_MOUNTED__?: boolean;
    __IRONFORGE_LOG_ACTIVE_ISLAND_EVENT__?: string;
    __IRONFORGE_LOG_START_ISLAND_EVENT__?: string;
    showPage: (name: string, btn?: Element | null) => void;
    showLoginScreen?: () => void;
    hideLoginScreen?: () => void;
    maybeOpenOnboarding?: (options?: unknown) => void;
    getIronforgeState?: () => {
      activeWorkout?: unknown;
      restDuration?: number;
      restEndsAt?: number;
      restSecondsLeft?: number;
      restTotal?: number;
      currentUser?: unknown;
    };
    getActivePageName?: () => string;
    getConfirmReactSnapshot?: () => {
      open?: boolean;
      title?: string;
      message?: string;
      confirmLabel?: string;
      cancelLabel?: string;
    };
    showRPEPicker: (
      exerciseName: string,
      setNumber: number,
      callback: (value: number | null) => void
    ) => void;
    resumeActiveWorkoutUI: (options?: { toast?: boolean }) => boolean;
    finishWorkout: () => Promise<void>;
  }
}

declare module '*.jsx';
