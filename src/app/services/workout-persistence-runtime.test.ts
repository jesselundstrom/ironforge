import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installWorkoutPersistenceRuntimeBridge } from './workout-persistence-runtime';

beforeEach(() => {
  (globalThis as { window?: Window }).window = {} as Window;
});

afterEach(() => {
  delete (globalThis as { window?: Window }).window;
});

function createSupabase(result: Record<string, unknown>) {
  return {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue(result),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue(result),
        })),
      })),
    })),
  };
}

describe('workout persistence pending sync markers', () => {
  it('clears pending workout upserts only after a successful write', async () => {
    const runtime = installWorkoutPersistenceRuntimeBridge();
    expect(runtime).toBeTruthy();
    const markPendingWorkoutUpsertIds = vi.fn();
    const clearPendingWorkoutUpsertIds = vi.fn();

    await runtime!.upsertWorkoutRecords?.(
      {
        currentUser: { id: 'user-1' },
        cloudSyncEnabled: true,
        workouts: [
          {
            id: 'workout-1',
            date: '2026-04-01T10:00:00.000Z',
            type: 'forge',
          },
        ],
      },
      {
        supabaseClient: createSupabase({ data: [], error: null }),
        markPendingWorkoutUpsertIds,
        clearPendingWorkoutUpsertIds,
      }
    );

    expect(markPendingWorkoutUpsertIds).toHaveBeenCalledWith(['workout-1']);
    expect(clearPendingWorkoutUpsertIds).toHaveBeenCalledWith(['workout-1']);
  });

  it('retains pending workout deletes when Supabase rejects the write', async () => {
    const runtime = installWorkoutPersistenceRuntimeBridge();
    expect(runtime).toBeTruthy();
    const markPendingWorkoutDeleteIds = vi.fn();
    const clearPendingWorkoutDeleteIds = vi.fn();

    await runtime!.softDeleteWorkoutRecord?.(
      {
        currentUser: { id: 'user-1' },
        cloudSyncEnabled: true,
        workoutId: 'workout-2',
      },
      {
        supabaseClient: createSupabase({
          data: null,
          error: { code: '42501', message: 'permission denied' },
        }),
        markPendingWorkoutDeleteIds,
        clearPendingWorkoutDeleteIds,
      }
    );

    expect(markPendingWorkoutDeleteIds).toHaveBeenCalledWith(['workout-2']);
    expect(clearPendingWorkoutDeleteIds).not.toHaveBeenCalled();
  });
});
