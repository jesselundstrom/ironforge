import { LOCAL_CACHE_KEYS } from '../../domain/config';
import { normalizeWorkoutRecordsForPersistence } from '../../domain/profile-bootstrap';

type MutableRecord = Record<string, unknown>;

type SupabaseResultLike = {
  data?: unknown;
  error?: unknown;
};

type SupabaseTableLike = {
  upsert?: (values: unknown, options?: Record<string, unknown>) => Promise<unknown>;
  update?: (values: Record<string, unknown>) => SupabaseFilterLike;
  select?: (columns: string) => SupabaseFilterLike;
};

type SupabaseFilterLike = {
  eq?: (column: string, value: unknown) => SupabaseFilterLike;
  in?: (column: string, values: Array<unknown>) => Promise<unknown>;
  order?: (column: string, options?: Record<string, unknown>) => Promise<unknown>;
};

type SupabaseClientLike = {
  from?: (table: string) => SupabaseTableLike;
};

type WorkoutPersistenceDeps = {
  supabaseClient?: SupabaseClientLike | null;
  runSupabaseWrite?: (
    operationPromise: Promise<unknown>,
    context: string,
    options?: Record<string, unknown>
  ) => Promise<{ ok: boolean; error?: unknown; data?: unknown }>;
  logWarn?: (context: string, error: unknown) => void;
  markPendingWorkoutUpsertIds?: (ids: string[]) => void;
  markPendingWorkoutDeleteIds?: (ids: string[]) => void;
  clearPendingWorkoutUpsertIds?: (ids: string[]) => void;
  clearPendingWorkoutDeleteIds?: (ids: string[]) => void;
};

type WorkoutPersistenceInput = {
  userId?: string | null;
  currentUser?: Record<string, unknown> | null;
  cloudSyncEnabled?: boolean;
  workouts?: Array<Record<string, unknown>> | null;
  workout?: Record<string, unknown> | null;
  workoutId?: string | number | null;
  fallbackWorkouts?: Array<Record<string, unknown>> | null;
  options?: Record<string, unknown>;
};

type WorkoutTablePullResult = {
  usedTable: boolean;
  didBackfill: boolean;
  workouts: Array<Record<string, unknown>>;
  shouldMarkWorkoutTableReady: boolean;
};

type WorkoutPersistenceRuntimeApi = {
  persistLocalWorkoutsCache: (input?: WorkoutPersistenceInput | null) => boolean;
  saveWorkouts: (input?: WorkoutPersistenceInput | null) => boolean;
  upsertWorkoutRecord: (
    input?: WorkoutPersistenceInput | null,
    deps?: WorkoutPersistenceDeps
  ) => Promise<void>;
  upsertWorkoutRecords: (
    input?: WorkoutPersistenceInput | null,
    deps?: WorkoutPersistenceDeps
  ) => Promise<void>;
  softDeleteWorkoutRecord: (
    input?: WorkoutPersistenceInput | null,
    deps?: WorkoutPersistenceDeps
  ) => Promise<void>;
  replaceWorkoutTableSnapshot: (
    input?: WorkoutPersistenceInput | null,
    deps?: WorkoutPersistenceDeps
  ) => Promise<void>;
  pullWorkoutsFromTable: (
    input?: WorkoutPersistenceInput | null,
    deps?: WorkoutPersistenceDeps
  ) => Promise<WorkoutTablePullResult>;
};

type WorkoutPersistenceWindow = Window & {
  __IRONFORGE_WORKOUT_PERSISTENCE_RUNTIME__?: WorkoutPersistenceRuntimeApi;
  __IRONFORGE_SUPABASE__?: SupabaseClientLike;
  __IRONFORGE_GET_SUPABASE_CLIENT__?: () => SupabaseClientLike;
  getLocalCacheKey?: (baseKey: string, userId?: string) => string;
};

function getRuntimeWindow(): WorkoutPersistenceWindow | null {
  if (typeof window === 'undefined') return null;
  return window as WorkoutPersistenceWindow;
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function getSupabaseClient(deps?: WorkoutPersistenceDeps) {
  if (deps?.supabaseClient?.from) return deps.supabaseClient;
  const runtimeWindow = getRuntimeWindow();
  if (runtimeWindow?.__IRONFORGE_SUPABASE__?.from) {
    return runtimeWindow.__IRONFORGE_SUPABASE__ as SupabaseClientLike;
  }
  try {
    return (
      (runtimeWindow?.__IRONFORGE_GET_SUPABASE_CLIENT__?.() as SupabaseClientLike | null) ||
      null
    );
  } catch {
    return null;
  }
}

function getSupabaseError(result: unknown) {
  return result && typeof result === 'object' && 'error' in result
    ? (result as SupabaseResultLike).error || null
    : null;
}

async function runSupabaseWrite(
  operationPromise: Promise<unknown>,
  context: string,
  options: Record<string, unknown> | undefined,
  deps?: WorkoutPersistenceDeps
) {
  if (typeof deps?.runSupabaseWrite === 'function') {
    return deps.runSupabaseWrite(operationPromise, context, options);
  }
  try {
    const result = (await operationPromise) as SupabaseResultLike;
    const error = getSupabaseError(result);
    if (error) {
      deps?.logWarn?.(context, error);
      return { ok: false, error, data: result?.data };
    }
    return { ok: true, error: null, data: result?.data };
  } catch (error) {
    deps?.logWarn?.(context, error);
    return { ok: false, error, data: null };
  }
}

function getLocalCacheKey(baseKey: string, userId?: string | null) {
  const runtimeWindow = getRuntimeWindow();
  const scopedUserId = String(userId || '').trim();
  if (runtimeWindow?.getLocalCacheKey) {
    return runtimeWindow.getLocalCacheKey(baseKey, scopedUserId || undefined);
  }
  return scopedUserId ? `${baseKey}::${scopedUserId}` : baseKey;
}

function getCurrentUserId(input?: WorkoutPersistenceInput | null) {
  const userId = String(input?.userId || input?.currentUser?.id || '').trim();
  return userId || '';
}

function isCloudSyncEnabled(input?: WorkoutPersistenceInput | null) {
  return input?.cloudSyncEnabled !== false;
}

function workoutClientId(workout: Record<string, unknown> | null | undefined) {
  if (!workout || workout.id === undefined || workout.id === null) return '';
  return String(workout.id);
}

function uniqueIds(ids?: Array<string | null | undefined>) {
  return [...new Set((ids || []).filter(Boolean) as string[])];
}

function mergeWorkoutLists(
  primary: Array<Record<string, unknown>> | null | undefined,
  fallback: Array<Record<string, unknown>> | null | undefined,
  deletedIds: Set<string>
) {
  const seen = new Set<string>();
  const merged: Array<Record<string, unknown>> = [];

  const add = (items?: Array<Record<string, unknown>> | null) => {
    (items || []).forEach((workout) => {
      const id = workoutClientId(workout);
      if (!id || deletedIds.has(id) || seen.has(id)) return;
      seen.add(id);
      merged.push(cloneJson(workout));
    });
  };

  add(primary);
  add(fallback);
  merged.sort((left, right) => {
    return (
      new Date(String(left?.date || '')).getTime() -
      new Date(String(right?.date || '')).getTime()
    );
  });
  return merged;
}

function toWorkoutRow(
  workout: Record<string, unknown> | null | undefined,
  userId: string
) {
  if (!workout || !userId) return null;
  const clientWorkoutId = workoutClientId(workout);
  if (!clientWorkoutId) return null;
  return {
    user_id: userId,
    client_workout_id: clientWorkoutId,
    performed_at: workout.date,
    payload: cloneJson(workout),
    deleted_at: null,
  };
}

function persistLocalWorkoutsCache(input?: WorkoutPersistenceInput | null) {
  const userId = getCurrentUserId(input);
  if (!userId || typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(
      getLocalCacheKey(LOCAL_CACHE_KEYS.workouts, userId),
      JSON.stringify(Array.isArray(input?.workouts) ? input?.workouts : [])
    );
    return true;
  } catch {
    return false;
  }
}

function saveWorkouts(input?: WorkoutPersistenceInput | null) {
  return persistLocalWorkoutsCache(input);
}

async function upsertWorkoutRecords(
  input?: WorkoutPersistenceInput | null,
  deps?: WorkoutPersistenceDeps
) {
  const userId = getCurrentUserId(input);
  const items = Array.isArray(input?.workouts) ? input?.workouts : [];
  if (!userId || !items.length || !isCloudSyncEnabled(input)) return;
  const supabase = getSupabaseClient(deps);
  if (!supabase?.from) return;
  const rows = items.map((workout) => toWorkoutRow(workout, userId)).filter(Boolean);
  if (!rows.length) return;
  const pendingIds = uniqueIds(items.map(workoutClientId));
  deps?.markPendingWorkoutUpsertIds?.(pendingIds);
  const result = await runSupabaseWrite(
    supabase
      .from('workouts')
      .upsert?.(rows, { onConflict: 'user_id,client_workout_id' }) || Promise.resolve(),
    'Failed to upsert workout rows',
    {
      ...(input?.options || {}),
      pendingWorkoutUpsertIds: uniqueIds([
        ...((Array.isArray(input?.options?.pendingWorkoutUpsertIds)
          ? (input?.options?.pendingWorkoutUpsertIds as string[])
          : []) || []),
        ...pendingIds,
      ]),
    },
    deps
  );
  if (result.ok) deps?.clearPendingWorkoutUpsertIds?.(pendingIds);
}

async function upsertWorkoutRecord(
  input?: WorkoutPersistenceInput | null,
  deps?: WorkoutPersistenceDeps
) {
  const workout = input?.workout ? [input.workout] : [];
  await upsertWorkoutRecords(
    {
      ...input,
      workouts: workout,
    },
    deps
  );
}

async function softDeleteWorkoutRecord(
  input?: WorkoutPersistenceInput | null,
  deps?: WorkoutPersistenceDeps
) {
  const userId = getCurrentUserId(input);
  const workoutId =
    input?.workoutId === undefined || input?.workoutId === null
      ? ''
      : String(input.workoutId);
  if (!userId || !workoutId || !isCloudSyncEnabled(input)) return;
  const supabase = getSupabaseClient(deps);
  const table = supabase?.from?.('workouts');
  const operation = table
    ?.update?.({ deleted_at: new Date().toISOString() })
    ?.eq?.('user_id', userId)
    ?.eq?.('client_workout_id', workoutId);
  if (!operation || typeof (operation as Promise<unknown>).then !== 'function') return;
  const pendingIds = uniqueIds([workoutId]);
  deps?.markPendingWorkoutDeleteIds?.(pendingIds);
  const result = await runSupabaseWrite(
    operation as Promise<unknown>,
    'Failed to soft-delete workout row',
    {
      ...(input?.options || {}),
      pendingWorkoutDeleteIds: uniqueIds([
        ...((Array.isArray(input?.options?.pendingWorkoutDeleteIds)
          ? (input?.options?.pendingWorkoutDeleteIds as string[])
          : []) || []),
        ...pendingIds,
      ]),
    },
    deps
  );
  if (result.ok) deps?.clearPendingWorkoutDeleteIds?.(pendingIds);
}

async function replaceWorkoutTableSnapshot(
  input?: WorkoutPersistenceInput | null,
  deps?: WorkoutPersistenceDeps
) {
  const userId = getCurrentUserId(input);
  const items = Array.isArray(input?.workouts) ? input?.workouts : [];
  if (!userId || !isCloudSyncEnabled(input)) return;
  const supabase = getSupabaseClient(deps);
  if (!supabase?.from) return;

  await upsertWorkoutRecords(input, deps);

  try {
    const table = supabase.from('workouts');
    const result = (await table
      .select?.('client_workout_id,deleted_at')
      ?.eq?.('user_id', userId)) as SupabaseResultLike;
    if (result?.error) {
      deps?.logWarn?.('Failed to read workout rows for snapshot replace', result.error);
      return;
    }
    const rows = Array.isArray(result?.data)
      ? (result.data as Array<Record<string, unknown>>)
      : [];
    const nextIds = new Set(items.map((workout) => workoutClientId(workout)).filter(Boolean));
    const staleIds = rows
      .filter((row) => !row.deleted_at && !nextIds.has(String(row.client_workout_id || '')))
      .map((row) => String(row.client_workout_id || ''))
      .filter(Boolean);
    if (!staleIds.length) return;
    deps?.markPendingWorkoutDeleteIds?.(staleIds);
    const pruneOperation = supabase
      .from('workouts')
      .update?.({ deleted_at: new Date().toISOString() })
      ?.eq?.('user_id', userId)
      ?.in?.('client_workout_id', staleIds);
    if (!pruneOperation) return;
    const pruneResult = await runSupabaseWrite(
      pruneOperation,
      'Failed to prune workout rows during snapshot replace',
      {
        ...(input?.options || {}),
        pendingWorkoutDeleteIds: uniqueIds([
          ...((Array.isArray(input?.options?.pendingWorkoutDeleteIds)
            ? (input?.options?.pendingWorkoutDeleteIds as string[])
            : []) || []),
          ...staleIds,
        ]),
      },
      deps
    );
    if (pruneResult.ok) deps?.clearPendingWorkoutDeleteIds?.(staleIds);
  } catch (error) {
    deps?.logWarn?.('Failed to replace workout table snapshot', error);
  }
}

async function pullWorkoutsFromTable(
  input?: WorkoutPersistenceInput | null,
  deps?: WorkoutPersistenceDeps
): Promise<WorkoutTablePullResult> {
  const userId = getCurrentUserId(input);
  const fallbackWorkouts = Array.isArray(input?.fallbackWorkouts)
    ? input?.fallbackWorkouts
    : [];
  if (!userId || !isCloudSyncEnabled(input)) {
    return {
      usedTable: false,
      didBackfill: false,
      workouts: cloneJson(fallbackWorkouts),
      shouldMarkWorkoutTableReady: false,
    };
  }
  const supabase = getSupabaseClient(deps);
  if (!supabase?.from) {
    return {
      usedTable: false,
      didBackfill: false,
      workouts: cloneJson(fallbackWorkouts),
      shouldMarkWorkoutTableReady: false,
    };
  }

  try {
    const result = (await supabase
      .from('workouts')
      .select?.('client_workout_id,payload,deleted_at,performed_at')
      ?.eq?.('user_id', userId)
      ?.order?.('performed_at', { ascending: true })) as SupabaseResultLike;
    if (result?.error) {
      return {
        usedTable: false,
        didBackfill: false,
        workouts: cloneJson(fallbackWorkouts),
        shouldMarkWorkoutTableReady: false,
      };
    }

    const rows = Array.isArray(result?.data)
      ? (result.data as Array<Record<string, unknown>>)
      : [];
    const deletedIds = new Set(
      rows
        .filter((row) => row.deleted_at)
        .map((row) => String(row.client_workout_id || ''))
        .filter(Boolean)
    );
    const knownIds = new Set(
      rows.map((row) => String(row.client_workout_id || '')).filter(Boolean)
    );
    const activeRows = rows.filter(
      (row) => !row.deleted_at && row.payload && typeof row.payload === 'object'
    );
    const normalizedTableWorkouts = normalizeWorkoutRecordsForPersistence(
      activeRows.map((row) => row.payload as Record<string, unknown>)
    );
    const tableWorkouts = normalizedTableWorkouts.workouts;
    const merged = mergeWorkoutLists(tableWorkouts, fallbackWorkouts, deletedIds);
    const missingFromTable = merged.filter(
      (workout) => !knownIds.has(workoutClientId(workout))
    );

    if (missingFromTable.length) {
      await upsertWorkoutRecords(
        {
          ...input,
          workouts: missingFromTable,
          options: {
            ...(input?.options || {}),
            notifyUser: false,
          },
        },
        deps
      );
    } else if (normalizedTableWorkouts.changed) {
      await upsertWorkoutRecords(
        {
          ...input,
          workouts: tableWorkouts,
          options: {
            ...(input?.options || {}),
            notifyUser: false,
          },
        },
        deps
      );
    }

    return {
      usedTable: rows.length > 0,
      didBackfill: missingFromTable.length > 0,
      workouts: merged,
      shouldMarkWorkoutTableReady: rows.length > 0 || missingFromTable.length > 0,
    };
  } catch (error) {
    deps?.logWarn?.('Failed to pull workouts from table', error);
    return {
      usedTable: false,
      didBackfill: false,
      workouts: cloneJson(fallbackWorkouts),
      shouldMarkWorkoutTableReady: false,
    };
  }
}

export function installWorkoutPersistenceRuntimeBridge() {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  if (runtimeWindow.__IRONFORGE_WORKOUT_PERSISTENCE_RUNTIME__) {
    return runtimeWindow.__IRONFORGE_WORKOUT_PERSISTENCE_RUNTIME__;
  }

  const api: WorkoutPersistenceRuntimeApi = {
    persistLocalWorkoutsCache,
    saveWorkouts,
    upsertWorkoutRecord,
    upsertWorkoutRecords,
    softDeleteWorkoutRecord,
    replaceWorkoutTableSnapshot,
    pullWorkoutsFromTable,
  };

  runtimeWindow.__IRONFORGE_WORKOUT_PERSISTENCE_RUNTIME__ = api;
  return api;
}
