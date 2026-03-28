import { useDashboardStore } from '../../stores/dashboard-store';
import { callLegacyWindowFunction } from './legacy-call';

export function toggleDayDetail(dayIndex: number) {
  useDashboardStore.getState().toggleDayDetail(dayIndex);
}

export function animateDashboardPlanMuscleBars() {
  callLegacyWindowFunction('animateDashboardPlanMuscleBars');
}
