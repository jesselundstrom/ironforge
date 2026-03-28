import { create } from 'zustand';
import { computeFatigue } from '../domain/planning';
import { buildDashboardViewModel } from '../domain/dashboard-view';
import type { DashboardViewModel } from '../domain/dashboard-view';
import type { WorkoutRecord } from '../domain/types';
import { dataStore } from './data-store';
import { i18nStore } from './i18n-store';
import { profileStore } from './profile-store';
import { programStore } from './program-store';
import { useNutritionStore } from './nutrition-store';

type DashboardStoreState = {
  activeDayIndex: number | null;
  view: DashboardViewModel;
  recompute: () => DashboardViewModel;
  toggleDayDetail: (dayIndex: number) => DashboardViewModel;
};

type DashboardWindow = Window & {
  toggleDayDetail?: (dayIndex: number) => void;
  updateDashboard?: () => DashboardViewModel;
  syncDashboardBridge?: () => void;
};

let storeInstalled = false;
let unsubscribeDataStore: (() => void) | null = null;
let unsubscribeProfileStore: (() => void) | null = null;
let unsubscribeProgramStore: (() => void) | null = null;
let unsubscribeI18nStore: (() => void) | null = null;
let unsubscribeNutritionStore: (() => void) | null = null;
let suppressDashboardRecompute = false;

function getDashboardWindow(): DashboardWindow | null {
  if (typeof window === 'undefined') return null;
  return window as DashboardWindow;
}

function computeView(state: Pick<DashboardStoreState, 'activeDayIndex'>) {
  return buildDashboardViewModel({
    workouts: (dataStore.getState().workouts || []) as WorkoutRecord[],
    profile: profileStore.getState().profile,
    schedule: profileStore.getState().schedule,
    activeProgram:
      (programStore.getState().activeProgram as Record<string, unknown> | null) ||
      null,
    activeProgramState: programStore.getState().activeProgramState,
    fatigue: computeFatigue(),
    activeDayIndex: state.activeDayIndex,
    nutrition: useNutritionStore.getState().dashboardSummary,
  });
}

function recomputeDashboardStore() {
  const state = useDashboardStore.getState();
  const view = computeView(state);
  useDashboardStore.setState((current) => ({
    ...current,
    view,
  }));
  return view;
}

function maybeRecomputeDashboardStore() {
  if (suppressDashboardRecompute) return useDashboardStore.getState().view;
  return recomputeDashboardStore();
}

export function syncDashboardStoreWindowBindings() {
  const runtimeWindow = getDashboardWindow();
  if (!runtimeWindow) return;
  runtimeWindow.toggleDayDetail = (dayIndex) => {
    useDashboardStore.getState().toggleDayDetail(Number(dayIndex));
  };
  runtimeWindow.updateDashboard = () => {
    suppressDashboardRecompute = true;
    dataStore.getState().syncFromLegacy();
    profileStore.getState().syncFromDataStore();
    programStore.getState().syncFromLegacy();
    suppressDashboardRecompute = false;
    return recomputeDashboardStore();
  };
  delete runtimeWindow.syncDashboardBridge;
}

export const useDashboardStore = create<DashboardStoreState>((set, get) => {
  const initial = {
    activeDayIndex: null,
  };
  return {
    ...initial,
    view: computeView(initial),
    recompute: () => recomputeDashboardStore(),
    toggleDayDetail: (dayIndex) => {
      set((state) => {
        const next = {
          ...state,
          activeDayIndex: state.activeDayIndex === dayIndex ? null : dayIndex,
        };
        return {
          ...next,
          view: computeView(next),
        };
      });
      return get().view;
    },
  };
});

export function installDashboardStore() {
  if (typeof window === 'undefined') return;
  if (!storeInstalled) {
    storeInstalled = true;

    recomputeDashboardStore();
    unsubscribeDataStore = dataStore.subscribe(() => {
      maybeRecomputeDashboardStore();
    });
    unsubscribeProfileStore = profileStore.subscribe(() => {
      maybeRecomputeDashboardStore();
    });
    unsubscribeProgramStore = programStore.subscribe(() => {
      maybeRecomputeDashboardStore();
    });
    unsubscribeI18nStore = i18nStore.subscribe(() => {
      maybeRecomputeDashboardStore();
    });
    unsubscribeNutritionStore = useNutritionStore.subscribe(() => {
      maybeRecomputeDashboardStore();
    });
  }

  syncDashboardStoreWindowBindings();
}

export const installLegacyDashboardStoreBridge = installDashboardStore;

export function disposeDashboardStore() {
  unsubscribeDataStore?.();
  unsubscribeProfileStore?.();
  unsubscribeProgramStore?.();
  unsubscribeI18nStore?.();
  unsubscribeNutritionStore?.();
  unsubscribeDataStore = null;
  unsubscribeProfileStore = null;
  unsubscribeProgramStore = null;
  unsubscribeI18nStore = null;
  unsubscribeNutritionStore = null;
  storeInstalled = false;
}

export const disposeLegacyDashboardStoreBridge = disposeDashboardStore;

export function getDashboardStoreSnapshot() {
  return useDashboardStore.getState().view;
}
