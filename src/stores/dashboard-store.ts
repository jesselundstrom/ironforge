import { create } from 'zustand';
import { computeFatigue } from '../domain/planning';
import { buildDashboardViewModel } from '../domain/dashboard-view';
import {
  buildDashboardPlanStructuredSnapshot,
  getDashboardDayDetailData,
  getDashboardLabels,
  getDashboardRecoverySnapshot,
  getDashboardTrainingMaxData,
  getDashboardWeekLegendItems,
  wasSportRecently,
} from '../domain/dashboard-runtime';
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
  wasSportRecently?: (hours?: number) => boolean;
  wasHockeyRecently?: (hours?: number) => boolean;
  getDashboardLabels?: () => Record<string, string>;
  getDashboardWeekLegendItems?: () => Array<Record<string, unknown>>;
  getDashboardDayDetailData?: (dayIndex: number) => Array<Record<string, unknown>>;
  getDashboardRecoverySnapshot?: (fatigue: Record<string, any>) => Record<string, unknown>;
  getDashboardTrainingMaxData?: (
    prog: Record<string, unknown>,
    ps: Record<string, unknown>
  ) => Record<string, unknown>;
  buildDashboardPlanStructuredSnapshot?: (
    prog: Record<string, unknown>,
    ps: Record<string, unknown>,
    fatigue: Record<string, unknown>
  ) => Record<string, unknown>;
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
    fatigue: computeFatigue({
      workouts: (dataStore.getState().workouts || []) as WorkoutRecord[],
      schedule: profileStore.getState().schedule,
    }),
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
  runtimeWindow.wasSportRecently = (hours) =>
    wasSportRecently((dataStore.getState().workouts || []) as WorkoutRecord[], hours);
  runtimeWindow.wasHockeyRecently = runtimeWindow.wasSportRecently;
  runtimeWindow.getDashboardLabels = () => getDashboardLabels();
  runtimeWindow.getDashboardWeekLegendItems = () => getDashboardWeekLegendItems();
  runtimeWindow.getDashboardDayDetailData = (dayIndex) => {
    const weekStart = new Date();
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diff + Number(dayIndex || 0));
    weekStart.setHours(0, 0, 0, 0);
    return getDashboardDayDetailData(
      (dataStore.getState().workouts || []) as WorkoutRecord[],
      profileStore.getState().schedule,
      weekStart
    );
  };
  runtimeWindow.getDashboardRecoverySnapshot = (fatigue) =>
    getDashboardRecoverySnapshot(
      (fatigue || {}) as Record<string, any>,
      profileStore.getState().profile
    );
  runtimeWindow.getDashboardTrainingMaxData = (prog, ps) =>
    getDashboardTrainingMaxData(
      (prog || {}) as Record<string, any>,
      (ps || {}) as Record<string, any>
    );
  runtimeWindow.buildDashboardPlanStructuredSnapshot = (prog, ps, fatigue) =>
    buildDashboardPlanStructuredSnapshot({
      activeProgram: (prog || {}) as Record<string, any>,
      activeProgramState: (ps || {}) as Record<string, any>,
      fatigue: (fatigue || {}) as Record<string, any>,
      profile: profileStore.getState().profile,
      schedule: profileStore.getState().schedule,
      workouts: (dataStore.getState().workouts || []) as WorkoutRecord[],
      status: useDashboardStore.getState().view.week.status,
    });
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
