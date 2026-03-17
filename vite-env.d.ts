/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    __IRONFORGE_TEST_USER_ID__?: string;
    showPage: (name: string, btn?: Element | null) => void;
    showLoginScreen?: () => void;
    hideLoginScreen?: () => void;
    maybeOpenOnboarding?: (options?: unknown) => void;
    showRPEPicker: (
      exerciseName: string,
      setNumber: number,
      callback: (value: number | null) => void
    ) => void;
    resumeActiveWorkoutUI: (options?: { toast?: boolean }) => boolean;
    finishWorkout: () => Promise<void>;
  }
}
