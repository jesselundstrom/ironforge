import { create } from 'zustand';
import type { AppPage, ConfirmSnapshot, SessionSnapshot } from '../constants';

type RuntimeStore = {
  ui: {
    activePage: AppPage;
    confirm: ConfirmSnapshot;
    languageVersion: number;
  };
  session: SessionSnapshot;
  setActivePage: (page: AppPage) => void;
  setConfirmSnapshot: (confirm: ConfirmSnapshot) => void;
  syncSessionSnapshot: (session: SessionSnapshot) => void;
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
  summaryOpen: false,
  sportCheckOpen: false,
};

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  ui: {
    activePage: 'dashboard',
    confirm: defaultConfirm,
    languageVersion: 0,
  },
  session: defaultSession,
  setActivePage: (page) =>
    set((state) => ({
      ui: {
        ...state.ui,
        activePage: page,
      },
    })),
  setConfirmSnapshot: (confirm) =>
    set((state) => ({
      ui: {
        ...state.ui,
        confirm,
      },
    })),
  syncSessionSnapshot: (session) => set(() => ({ session })),
  bumpLanguageVersion: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        languageVersion: state.ui.languageVersion + 1,
      },
    })),
}));
