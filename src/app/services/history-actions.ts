import { useHistoryStore } from '../../stores/history-store';
import { dataStore } from '../../stores/data-store';
import { profileStore } from '../../stores/profile-store';
import { programStore } from '../../stores/program-store';
import { useRuntimeStore } from '../store/runtime-store';
import { showConfirm } from './confirm-actions';
import { callLegacyWindowFunction } from './legacy-call';

type HistoryActionWindow = Window & {
  I18N?: {
    t?: (
      key: string,
      params?: Record<string, unknown> | null,
      fallback?: string
    ) => string;
  };
  workouts?: Array<Record<string, unknown>>;
  profile?: Record<string, unknown> | null;
  saveWorkouts?: () => Promise<unknown> | unknown;
  saveProfileData?: (options?: Record<string, unknown>) => Promise<unknown> | unknown;
  softDeleteWorkoutRecord?: (id: string) => Promise<unknown> | unknown;
  upsertWorkoutRecord?: (workout: Record<string, unknown>) => Promise<unknown> | unknown;
  buildExerciseIndex?: () => void;
  recomputeProgramStateFromWorkouts?: (programId: string) => void;
  updateStats?: () => void;
  updateDashboard?: () => void;
  updateProgramDisplay?: () => void;
  renderHistory?: () => void;
  getWorkoutProgramId?: (workout: Record<string, unknown> | null | undefined) => string | null;
  deleteWorkout?: (id: string) => void;
  __IRONFORGE_GET_LEGACY_RUNTIME_STATE__?: () => {
    profile?: Record<string, unknown> | null;
    workouts?: Array<Record<string, unknown>>;
  };
  __IRONFORGE_SET_LEGACY_RUNTIME_STATE__?: (
    partial: Record<string, unknown>
  ) => void;
};

function getHistoryActionWindow(): HistoryActionWindow | null {
  if (typeof window === 'undefined') return null;
  return window as HistoryActionWindow;
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return !!value && typeof (value as Promise<unknown>).then === 'function';
}

async function resolveMaybePromise(value: unknown) {
  if (isPromiseLike(value)) {
    await value;
  }
}

function interpolate(
  fallback: string,
  params?: Record<string, unknown> | null
) {
  let message = fallback;
  Object.entries(params || {}).forEach(([key, value]) => {
    message = message.replaceAll(`{${key}}`, String(value ?? ''));
  });
  return message;
}

function t(
  key: string,
  fallback: string,
  params?: Record<string, unknown> | null
) {
  const runtimeWindow = getHistoryActionWindow();
  if (runtimeWindow?.I18N?.t) {
    return runtimeWindow.I18N.t(key, params || null, fallback);
  }
  return interpolate(fallback, params);
}

function syncStoresFromLegacy() {
  dataStore.getState().syncFromLegacy();
  profileStore.getState().syncFromDataStore();
  programStore.getState().syncFromLegacy();
}

function writeLegacyState(
  key: 'workouts' | 'profile',
  value: Array<Record<string, unknown>> | Record<string, unknown> | null
) {
  const runtimeWindow = getHistoryActionWindow();
  if (!runtimeWindow) return;
  runtimeWindow.__IRONFORGE_SET_LEGACY_RUNTIME_STATE__?.({
    [key]: cloneJson(value ?? null),
  });
}

function getLegacyRuntimeSnapshot() {
  const runtimeWindow = getHistoryActionWindow();
  return runtimeWindow?.__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || null;
}

function getAuthoritativeLegacyProfile() {
  const runtimeWindow = getHistoryActionWindow();
  const runtimeSnapshot = getLegacyRuntimeSnapshot();
  return cloneJson(
    (runtimeSnapshot?.profile as Record<string, unknown> | null) ||
      runtimeWindow?.profile ||
      (dataStore.getState().profile as Record<string, unknown> | null) ||
      profileStore.getState().profile ||
      {}
  ) as Record<string, unknown>;
}

function getWorkoutProgramId(workout: Record<string, unknown>) {
  const runtimeWindow = getHistoryActionWindow();
  const resolved = runtimeWindow?.getWorkoutProgramId?.(workout);
  const fallback = String(workout.program || '').trim();
  return String(resolved || fallback || '').trim() || null;
}

function refreshDependentViews() {
  const runtimeWindow = getHistoryActionWindow();
  syncStoresFromLegacy();
  runtimeWindow?.renderHistory?.();
  runtimeWindow?.updateStats?.();
  runtimeWindow?.updateDashboard?.();
  runtimeWindow?.updateProgramDisplay?.();
}

async function restoreDeletedWorkout(
  backupWorkout: Record<string, unknown>,
  programsBackup: Record<string, unknown>,
  affectedProgramId: string | null
) {
  const runtimeWindow = getHistoryActionWindow();
  const restoredWorkouts = [
    ...cloneJson(dataStore.getState().workouts || []),
    cloneJson(backupWorkout),
  ].sort((left, right) => {
    return (
      new Date(String(left?.date || '')).getTime() -
      new Date(String(right?.date || '')).getTime()
    );
  });
  const nextProfile = getAuthoritativeLegacyProfile();
  nextProfile.programs = cloneJson(programsBackup);

  writeLegacyState('workouts', restoredWorkouts);
  writeLegacyState('profile', nextProfile);
  runtimeWindow?.buildExerciseIndex?.();

  await resolveMaybePromise(runtimeWindow?.upsertWorkoutRecord?.(backupWorkout));
  await resolveMaybePromise(runtimeWindow?.saveWorkouts?.());
  if (affectedProgramId) {
    await resolveMaybePromise(
      runtimeWindow?.saveProfileData?.({ programIds: [affectedProgramId] })
    );
  }

  refreshDependentViews();
  useRuntimeStore.getState().showToast({
    message: t('history.session_restored', 'Session restored!'),
    background: 'var(--green)',
  });
}

async function commitWorkoutDelete(
  workoutId: string,
  backupWorkout: Record<string, unknown>,
  programsBackup: Record<string, unknown>,
  affectedProgramId: string | null
) {
  const runtimeWindow = getHistoryActionWindow();
  const nextWorkouts = cloneJson(dataStore.getState().workouts || []).filter(
    (workout) => String(workout?.id || '') !== workoutId
  );

  writeLegacyState('workouts', nextWorkouts);
  runtimeWindow?.buildExerciseIndex?.();
  if (affectedProgramId) {
    runtimeWindow?.recomputeProgramStateFromWorkouts?.(affectedProgramId);
  }

  await resolveMaybePromise(runtimeWindow?.softDeleteWorkoutRecord?.(workoutId));
  await resolveMaybePromise(runtimeWindow?.saveWorkouts?.());
  if (affectedProgramId) {
    await resolveMaybePromise(
      runtimeWindow?.saveProfileData?.({ programIds: [affectedProgramId] })
    );
  }

  refreshDependentViews();
  useRuntimeStore.getState().showToast({
    message: t('history.session_deleted', 'Session deleted'),
    background: 'var(--muted)',
    undoAction: () => {
      void restoreDeletedWorkout(backupWorkout, programsBackup, affectedProgramId);
    },
  });
}

export function toggleHeatmap() {
  useHistoryStore.getState().toggleHeatmap();
}

export function deleteWorkout(workoutId: string) {
  const runtimeWindow = getHistoryActionWindow();
  if (runtimeWindow?.deleteWorkout) {
    callLegacyWindowFunction('deleteWorkout', workoutId);
    return;
  }

  const normalizedId = String(workoutId || '').trim();
  if (!normalizedId) return;

  const workouts = cloneJson(dataStore.getState().workouts || []);
  const workout = workouts.find(
    (entry) => String(entry?.id || '') === normalizedId
  );
  if (!workout) return;

  const dateStr = new Date(String(workout.date || '')).toLocaleDateString(
    undefined,
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }
  );
  const profile = getAuthoritativeLegacyProfile();
  const programsBackup = cloneJson(
    (profile.programs as Record<string, unknown>) || {}
  );
  const affectedProgramId = getWorkoutProgramId(workout);

  showConfirm(
    t('history.delete_workout', 'Delete Workout'),
    t('history.remove_workout_from', 'Remove workout from {date}?', {
      date: dateStr,
    }),
    () => {
      void commitWorkoutDelete(
        normalizedId,
        cloneJson(workout),
        programsBackup,
        affectedProgramId
      );
    }
  );
}

export function switchHistoryStatsRange(rangeId: string) {
  useHistoryStore.getState().setStatsRange(rangeId);
}

export function switchHistoryTab(tabId: string) {
  useHistoryStore.getState().setTab(tabId);
}
