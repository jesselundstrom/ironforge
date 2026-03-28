import { useHistoryStore } from '../../stores/history-store';
import { callLegacyWindowFunction } from './legacy-call';

export function toggleHeatmap() {
  useHistoryStore.getState().toggleHeatmap();
}

export function deleteWorkout(workoutId: string) {
  callLegacyWindowFunction('deleteWorkout', workoutId);
}

export function switchHistoryStatsRange(rangeId: string) {
  useHistoryStore.getState().setStatsRange(rangeId);
}

export function switchHistoryTab(tabId: string) {
  useHistoryStore.getState().setTab(tabId);
}
