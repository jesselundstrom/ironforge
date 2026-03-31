import { create } from 'zustand';
import { buildHistoryViewModel } from '../domain/history-view';
import type {
  HistoryStatsRangeId,
  HistoryTab,
  HistoryViewModel,
} from '../domain/history-view';
import type { WorkoutRecord } from '../domain/types';
import { dataStore } from './data-store';
import { i18nStore } from './i18n-store';
import { profileStore } from './profile-store';
import { programStore } from './program-store';

type HistoryStoreState = {
  tab: HistoryTab;
  statsRange: HistoryStatsRangeId;
  heatmapOpen: boolean;
  view: HistoryViewModel;
  recompute: () => HistoryViewModel;
  setTab: (tab: string) => HistoryViewModel;
  setStatsRange: (range: string) => HistoryViewModel;
  toggleHeatmap: () => HistoryViewModel;
};

type HistoryWindow = Window & {
  switchHistoryTab?: (tab: string) => void;
  switchHistoryStatsRange?: (range: string) => void;
  toggleHeatmap?: () => void;
  renderHistory?: () => void;
  syncHistoryBridge?: () => void;
};

let storeInstalled = false;
let unsubscribeDataStore: (() => void) | null = null;
let unsubscribeProfileStore: (() => void) | null = null;
let unsubscribeProgramStore: (() => void) | null = null;
let unsubscribeI18nStore: (() => void) | null = null;

function getHistoryWindow(): HistoryWindow | null {
  if (typeof window === 'undefined') return null;
  return window as unknown as HistoryWindow;
}

function normalizeTab(value?: string): HistoryTab {
  return value === 'stats' ? 'stats' : 'log';
}

function normalizeStatsRange(value?: string): HistoryStatsRangeId {
  return value === '8w' || value === 'all' ? value : '16w';
}

function computeView(
  state: Pick<HistoryStoreState, 'tab' | 'statsRange' | 'heatmapOpen'>
) {
  return buildHistoryViewModel({
    workouts: (dataStore.getState().workouts || []) as WorkoutRecord[],
    profile: profileStore.getState().profile,
    schedule: profileStore.getState().schedule,
    activeProgram:
      (programStore.getState().activeProgram as Record<string, unknown> | null) ||
      null,
    activeProgramState: programStore.getState().activeProgramState,
    tab: state.tab,
    statsRange: state.statsRange,
    heatmapOpen: state.heatmapOpen,
    t: i18nStore.getState().t,
    language: i18nStore.getState().language,
  });
}

function recomputeStoreView() {
  const state = useHistoryStore.getState();
  const view = computeView(state);
  useHistoryStore.setState((current) => ({
    ...current,
    view,
  }));
  return view;
}

export function syncHistoryStoreWindowBindings() {
  const runtimeWindow = getHistoryWindow();
  if (!runtimeWindow) return;
  runtimeWindow.switchHistoryTab = (tab) => {
    useHistoryStore.getState().setTab(tab);
  };
  runtimeWindow.switchHistoryStatsRange = (range) => {
    useHistoryStore.getState().setStatsRange(range);
  };
  runtimeWindow.toggleHeatmap = () => {
    useHistoryStore.getState().toggleHeatmap();
  };
  runtimeWindow.renderHistory = () => {
    dataStore.getState().refreshSnapshot();
    profileStore.getState().refreshSnapshot();
    programStore.getState().refreshSnapshot();
    recomputeStoreView();
  };
  delete runtimeWindow.syncHistoryBridge;
}

export const useHistoryStore = create<HistoryStoreState>((set, get) => {
  const initial = {
    tab: 'log' as HistoryTab,
    statsRange: '16w' as HistoryStatsRangeId,
    heatmapOpen: false,
  };
  return {
    ...initial,
    view: computeView(initial),
    recompute: () => recomputeStoreView(),
    setTab: (tab) => {
      const nextTab = normalizeTab(tab);
      set((state) => {
        const next = { ...state, tab: nextTab };
        return {
          ...next,
          view: computeView(next),
        };
      });
      return get().view;
    },
    setStatsRange: (range) => {
      const nextRange = normalizeStatsRange(range);
      set((state) => {
        const next = { ...state, statsRange: nextRange };
        return {
          ...next,
          view: computeView(next),
        };
      });
      return get().view;
    },
    toggleHeatmap: () => {
      set((state) => {
        const next = { ...state, heatmapOpen: !state.heatmapOpen };
        return {
          ...next,
          view: computeView(next),
        };
      });
      return get().view;
    },
  };
});

export function installHistoryStore() {
  if (!storeInstalled) {
    storeInstalled = true;

    recomputeStoreView();
    unsubscribeDataStore = dataStore.subscribe(() => {
      recomputeStoreView();
    });
    unsubscribeProfileStore = profileStore.subscribe(() => {
      recomputeStoreView();
    });
    unsubscribeProgramStore = programStore.subscribe(() => {
      recomputeStoreView();
    });
    unsubscribeI18nStore = i18nStore.subscribe(() => {
      recomputeStoreView();
    });
  }

  syncHistoryStoreWindowBindings();
}

export function disposeHistoryStore() {
  unsubscribeDataStore?.();
  unsubscribeProfileStore?.();
  unsubscribeProgramStore?.();
  unsubscribeI18nStore?.();
  unsubscribeDataStore = null;
  unsubscribeProfileStore = null;
  unsubscribeProgramStore = null;
  unsubscribeI18nStore = null;
  storeInstalled = false;
}

export function getHistoryStoreSnapshot() {
  return useHistoryStore.getState().view;
}
