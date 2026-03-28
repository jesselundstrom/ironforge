import { create } from 'zustand';
import {
  buildDashboardNutritionSummary,
  buildNutritionViewModel,
} from '../domain/nutrition-view';
import type {
  DashboardNutritionSummary,
  NutritionRuntimeState,
  NutritionViewModel,
} from '../domain/nutrition-view';
import { dataStore } from './data-store';
import { i18nStore } from './i18n-store';
import { profileStore } from './profile-store';
import { useRuntimeStore } from '../app/store/runtime-store';

type NutritionStoreState = {
  view: NutritionViewModel;
  dashboardSummary: DashboardNutritionSummary;
  recompute: () => NutritionViewModel;
};

type NutritionWindow = Window & {
  getNutritionRuntimeState?: () => NutritionRuntimeState;
  syncNutritionBridge?: () => void;
};

const NUTRITION_STATE_EVENT = 'ironforge:nutrition-state-changed';

let storeInstalled = false;
let unsubscribeDataStore: (() => void) | null = null;
let unsubscribeProfileStore: (() => void) | null = null;
let unsubscribeI18nStore: (() => void) | null = null;
let unsubscribeRuntimeStore: (() => void) | null = null;

function getNutritionWindow(): NutritionWindow | null {
  if (typeof window === 'undefined') return null;
  return window as NutritionWindow;
}

function getRuntimeState(): NutritionRuntimeState {
  const raw = getNutritionWindow()?.getNutritionRuntimeState?.();
  return {
    selectedActionId: String(raw?.selectedActionId || 'plan_today'),
    loading: raw?.loading === true,
    loadingContext: String(raw?.loadingContext || 'text'),
    streaming: raw?.streaming === true,
    snapshotVersion: Number(raw?.snapshotVersion || 0),
  };
}

function computeNutritionView() {
  return buildNutritionViewModel({
    currentUser: dataStore.getState().currentUser,
    profile: profileStore.getState().profile,
    t: i18nStore.getState().t,
    runtimeState: getRuntimeState(),
  });
}

function computeDashboardSummary() {
  return buildDashboardNutritionSummary({
    currentUser: dataStore.getState().currentUser,
    profile: profileStore.getState().profile,
    t: i18nStore.getState().t,
    runtimeState: getRuntimeState(),
  });
}

function recomputeNutritionStore() {
  const view = computeNutritionView();
  const dashboardSummary = computeDashboardSummary();
  useNutritionStore.setState((state) => ({
    ...state,
    view,
    dashboardSummary,
  }));
  return view;
}

export const useNutritionStore = create<NutritionStoreState>(() => ({
  view: computeNutritionView(),
  dashboardSummary: computeDashboardSummary(),
  recompute: () => recomputeNutritionStore(),
}));

function handleNutritionStateEvent() {
  recomputeNutritionStore();
}

export function installNutritionStore() {
  if (storeInstalled || typeof window === 'undefined') return;
  storeInstalled = true;

  recomputeNutritionStore();
  unsubscribeDataStore = dataStore.subscribe(() => {
    recomputeNutritionStore();
  });
  unsubscribeProfileStore = profileStore.subscribe(() => {
    recomputeNutritionStore();
  });
  unsubscribeI18nStore = i18nStore.subscribe(() => {
    recomputeNutritionStore();
  });
  unsubscribeRuntimeStore = useRuntimeStore.subscribe((state, previousState) => {
    const nextPage = state.navigation.activePage;
    const prevPage = previousState?.navigation.activePage;
    if (
      nextPage !== prevPage &&
      (nextPage === 'nutrition' || nextPage === 'dashboard')
    ) {
      recomputeNutritionStore();
    }
  });
  window.addEventListener(NUTRITION_STATE_EVENT, handleNutritionStateEvent);

  const runtimeWindow = getNutritionWindow();
  if (!runtimeWindow) return;
  delete runtimeWindow.syncNutritionBridge;
}

export const installLegacyNutritionStoreBridge = installNutritionStore;

export function disposeNutritionStore() {
  unsubscribeDataStore?.();
  unsubscribeProfileStore?.();
  unsubscribeI18nStore?.();
  unsubscribeRuntimeStore?.();
  unsubscribeDataStore = null;
  unsubscribeProfileStore = null;
  unsubscribeI18nStore = null;
  unsubscribeRuntimeStore = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener(
      NUTRITION_STATE_EVENT,
      handleNutritionStateEvent
    );
  }
  storeInstalled = false;
}

export const disposeLegacyNutritionStoreBridge = disposeNutritionStore;

export function getNutritionStoreSnapshot() {
  return useNutritionStore.getState().view;
}
