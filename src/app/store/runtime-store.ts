import { create } from 'zustand';
import type {
  AppPage,
  ConfirmSnapshot,
  ExerciseCatalogView,
  LogActiveView,
  LogStartView,
  SessionSnapshot,
  SettingsTab,
  SettingsAccountView,
  SettingsBodyView,
  SettingsPreferencesView,
  SettingsProgramView,
  SettingsScheduleView,
  ToastSnapshot,
} from '../constants';

type RuntimeStore = {
  auth: {
    phase: 'booting' | 'signed_out' | 'signed_in';
    isLoggedIn: boolean;
    pendingAction: 'sign_in' | 'sign_up' | 'sign_out' | null;
    message: string;
    messageTone: '' | 'info' | 'error';
  };
  serviceWorker: {
    updateReady: boolean;
    applyingUpdate: boolean;
  };
  navigation: {
    activePage: AppPage;
    activeSettingsTab: SettingsTab;
  };
  ui: {
    confirm: ConfirmSnapshot;
    toast: ToastSnapshot;
    languageVersion: number;
  };
  workoutSession: {
    session: SessionSnapshot;
    logStartView: LogStartView | null;
    logActiveView: LogActiveView | null;
  };
  pages: {
    settingsAccountView: SettingsAccountView | null;
    settingsBodyView: SettingsBodyView | null;
    settingsPreferencesView: SettingsPreferencesView | null;
    settingsProgramView: SettingsProgramView | null;
    settingsScheduleView: SettingsScheduleView | null;
  };
  exerciseCatalog: {
    view: ExerciseCatalogView | null;
  };
  navigateToPage: (page: AppPage) => void;
  setActiveSettingsTab: (tab: SettingsTab) => void;
  openConfirm: (confirm: ConfirmSnapshot) => void;
  closeConfirm: () => void;
  showToast: (toast: Partial<ToastSnapshot> & { message: string }) => void;
  hideToast: () => void;
  syncWorkoutSession: (session: SessionSnapshot) => void;
  setLogStartView: (view: LogStartView | null) => void;
  setLogActiveView: (view: LogActiveView | null) => void;
  setSettingsAccountView: (view: SettingsAccountView | null) => void;
  setSettingsBodyView: (view: SettingsBodyView | null) => void;
  setSettingsPreferencesView: (view: SettingsPreferencesView | null) => void;
  setSettingsProgramView: (view: SettingsProgramView | null) => void;
  setSettingsScheduleView: (view: SettingsScheduleView | null) => void;
  setExerciseCatalogView: (view: ExerciseCatalogView | null) => void;
  setAuthState: (partial: Partial<RuntimeStore['auth']>) => void;
  setAuthLoggedIn: (isLoggedIn: boolean) => void;
  setServiceWorkerState: (
    partial: Partial<RuntimeStore['serviceWorker']>
  ) => void;
  bumpLanguageVersion: () => void;
};

const defaultConfirm: ConfirmSnapshot = {
  open: false,
  title: 'Confirm',
  message: 'Are you sure?',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
};

const defaultSession: SessionSnapshot = {
  activeWorkout: null,
  restDuration: 0,
  restEndsAt: 0,
  restSecondsLeft: 0,
  restTotal: 0,
  currentUser: null,
  restBarActive: false,
  rpeOpen: false,
  rpePrompt: null,
  summaryOpen: false,
  summaryPrompt: null,
  sportCheckOpen: false,
  sportCheckPrompt: null,
  exerciseGuideOpen: false,
  exerciseGuidePrompt: null,
};

const defaultToast: ToastSnapshot = {
  visible: false,
  message: '',
  variant: '',
  background: '',
  undoLabel: 'Undo',
  durationMs: 2800,
  token: 0,
  undoAction: null,
};

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  auth: {
    phase: 'booting',
    isLoggedIn: false,
    pendingAction: null,
    message: '',
    messageTone: '',
  },
  serviceWorker: {
    updateReady: false,
    applyingUpdate: false,
  },
  navigation: {
    activePage: 'dashboard',
    activeSettingsTab: 'schedule',
  },
  ui: {
    confirm: defaultConfirm,
    toast: defaultToast,
    languageVersion: 0,
  },
  workoutSession: {
    session: defaultSession,
    logStartView: null,
    logActiveView: null,
  },
  pages: {
    settingsAccountView: null,
    settingsBodyView: null,
    settingsPreferencesView: null,
    settingsProgramView: null,
    settingsScheduleView: null,
  },
  exerciseCatalog: {
    view: null,
  },
  navigateToPage: (page) =>
    set((state) => ({
      navigation: {
        ...state.navigation,
        activePage: page,
      },
    })),
  setActiveSettingsTab: (tab) =>
    set((state) => ({
      navigation: {
        ...state.navigation,
        activeSettingsTab: tab,
      },
    })),
  openConfirm: (confirm) =>
    set((state) => ({
      ui: {
        ...state.ui,
        confirm,
      },
    })),
  closeConfirm: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        confirm: {
          ...state.ui.confirm,
          open: false,
        },
      },
    })),
  showToast: (toast) =>
    set((state) => ({
      ui: {
        ...state.ui,
        toast: {
          ...defaultToast,
          ...toast,
          visible: true,
          token: state.ui.toast.token + 1,
        },
      },
    })),
  hideToast: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        toast: {
          ...state.ui.toast,
          visible: false,
          undoAction: null,
        },
      },
    })),
  syncWorkoutSession: (session) =>
    set((state) => ({
      workoutSession: {
        ...state.workoutSession,
        session,
      },
    })),
  setLogStartView: (logStartView) =>
    set((state) => ({
      workoutSession: {
        ...state.workoutSession,
        logStartView,
      },
    })),
  setLogActiveView: (logActiveView) =>
    set((state) => ({
      workoutSession: {
        ...state.workoutSession,
        logActiveView,
      },
    })),
  setSettingsAccountView: (settingsAccountView) =>
    set((state) => ({
      pages: {
        ...state.pages,
        settingsAccountView,
      },
    })),
  setSettingsBodyView: (settingsBodyView) =>
    set((state) => ({
      pages: {
        ...state.pages,
        settingsBodyView,
      },
    })),
  setSettingsPreferencesView: (settingsPreferencesView) =>
    set((state) => ({
      pages: {
        ...state.pages,
        settingsPreferencesView,
      },
    })),
  setSettingsProgramView: (settingsProgramView) =>
    set((state) => ({
      pages: {
        ...state.pages,
        settingsProgramView,
      },
    })),
  setSettingsScheduleView: (settingsScheduleView) =>
    set((state) => ({
      pages: {
        ...state.pages,
        settingsScheduleView,
      },
    })),
  setExerciseCatalogView: (view) =>
    set(() => ({
      exerciseCatalog: {
        view,
      },
    })),
  setAuthState: (partial) =>
    set((state) => ({
      auth: {
        ...state.auth,
        ...partial,
      },
    })),
  setAuthLoggedIn: (isLoggedIn) =>
    set((state) => ({
      auth: {
        ...state.auth,
        phase: isLoggedIn ? 'signed_in' : 'signed_out',
        isLoggedIn,
        pendingAction: null,
        message: '',
        messageTone: '',
      },
    })),
  setServiceWorkerState: (partial) =>
    set((state) => ({
      serviceWorker: {
        ...state.serviceWorker,
        ...partial,
      },
    })),
  bumpLanguageVersion: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        languageVersion: state.ui.languageVersion + 1,
      },
    })),
}));
