import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installSyncRuntimeBridge } from './sync-runtime';

type MutableRecord = Record<string, unknown>;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDeps(overrides: Record<string, unknown> = {}) {
  let pendingBackfillDocKeys: string[] = [];
  const state = {
    currentUser: { id: 'user-1' } as MutableRecord | null,
    workouts: [] as Array<Record<string, unknown>>,
    schedule: { sportDays: [1, 3] } as MutableRecord | null,
    profile: {
      activeProgram: 'forge',
      preferences: { trainingDaysPerWeek: 3 },
      coaching: {},
      bodyMetrics: {},
      programs: { forge: { week: 1 } },
      syncMeta: {
        profileUpdatedAt: '2026-04-01T10:00:00.000Z',
      },
    } as MutableRecord | null,
    activeWorkout: null as MutableRecord | null,
    cloudSyncEnabled: true,
  };

  const deps = {
    readState: () => state,
    writeState: (partial: Record<string, unknown>) => Object.assign(state, partial),
    setCloudSyncEnabled: vi.fn(),
    setRestDuration: vi.fn(),
    loadLocalData: vi.fn(),
    pullWorkoutsFromTable: vi.fn().mockResolvedValue({
      usedTable: false,
      didBackfill: false,
      workouts: [],
    }),
    bootstrapProfileRuntimeState: vi.fn((input?: Record<string, unknown>) => ({
      profile: cloneJson((input?.profile as MutableRecord) || {}),
      schedule: cloneJson((input?.schedule as MutableRecord) || {}),
      workouts: cloneJson((input?.workouts as Array<Record<string, unknown>>) || []),
      changed: { profile: false, schedule: false, workouts: false },
    })),
    setLanguage: vi.fn((language?: string) => language || 'en'),
    getDefaultLanguage: vi.fn(() => 'en'),
    restoreActiveWorkoutDraft: vi.fn(),
    getActiveWorkoutDraftCache: vi.fn(() => null),
    clearActiveWorkoutDraft: vi.fn(),
    saveWorkouts: vi.fn().mockResolvedValue(undefined),
    upsertWorkoutRecords: vi.fn().mockResolvedValue(undefined),
    buildExerciseIndex: vi.fn(),
    applyTranslations: vi.fn(),
    renderSyncStatus: vi.fn(),
    updateDashboard: vi.fn(),
    maybeOpenOnboarding: vi.fn(),
    isCloudSyncEnabled: vi.fn(() => true),
    isBrowserOffline: vi.fn(() => false),
    setSyncStatus: vi.fn(),
    getProfileDocumentsSupported: vi.fn(() => null),
    setProfileDocumentsSupported: vi.fn(),
    persistLocalProfileCache: vi.fn(),
    persistLocalScheduleCache: vi.fn(),
    persistLocalWorkoutsCache: vi.fn(),
    refreshSyncedUI: vi.fn(),
    markDocKeysDirty: vi.fn(),
    clearDocKeysDirty: vi.fn(),
    getDirtyDocKeys: vi.fn(() => []),
    getPendingBackfillDocKeys: vi.fn(() => pendingBackfillDocKeys.slice()),
    markPendingBackfillDocKeys: vi.fn((docKeys: string[]) => {
      pendingBackfillDocKeys = [...new Set([...pendingBackfillDocKeys, ...docKeys])];
    }),
    clearPendingBackfillDocKeys: vi.fn((docKeys?: string[]) => {
      if (!Array.isArray(docKeys) || !docKeys.length) {
        pendingBackfillDocKeys = [];
        return;
      }
      const cleared = new Set(docKeys);
      pendingBackfillDocKeys = pendingBackfillDocKeys.filter(
        (docKey) => !cleared.has(docKey)
      );
    }),
    updateServerDocStamp: vi.fn(),
    isDocKeyDirty: vi.fn(() => false),
    runSupabaseWrite: vi.fn(),
    logWarn: vi.fn(),
    supabaseClient: {
      rpc: vi.fn(),
      from: vi.fn(),
      removeChannel: vi.fn(),
    },
    ...overrides,
  };

  return { state, deps };
}

beforeEach(() => {
  (globalThis as { window?: Window }).window = {} as Window;
});

afterEach(() => {
  delete (globalThis as { window?: Window }).window;
});

describe('sync-runtime profile document ownership', () => {
  it('owns profile document upsert sequencing and stale detection', async () => {
    const runtime = installSyncRuntimeBridge();
    expect(runtime).toBeTruthy();

    const { state, deps } = createDeps();
    (deps.supabaseClient.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (deps.runSupabaseWrite as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: [
        {
          doc_key: 'profile_core',
          applied: true,
          updated_at: '2026-04-01T12:00:00.000Z',
        },
        {
          doc_key: 'program:forge',
          applied: false,
          updated_at: '2026-04-01T12:00:00.000Z',
        },
      ],
    });

    const result = await runtime!.upsertProfileDocuments?.(
      ['profile_core', 'program:forge'],
      state.profile,
      state.schedule,
      { notifyUser: false },
      deps as never
    );

    expect(result).toEqual({
      ok: true,
      appliedDocKeys: ['profile_core'],
      staleDocKeys: ['program:forge'],
      rows: [
        {
          doc_key: 'profile_core',
          applied: true,
          updated_at: '2026-04-01T12:00:00.000Z',
        },
        {
          doc_key: 'program:forge',
          applied: false,
          updated_at: '2026-04-01T12:00:00.000Z',
        },
      ],
    });
    expect(deps.setProfileDocumentsSupported).toHaveBeenCalledWith(true);
    expect(deps.clearDocKeysDirty).toHaveBeenCalledWith(['profile_core']);
    expect(deps.updateServerDocStamp).toHaveBeenCalledTimes(2);
  });

  it('pulls and reconstructs profile state from profile_documents only', async () => {
    const runtime = installSyncRuntimeBridge();
    expect(runtime).toBeTruthy();

    const { state, deps } = createDeps({
      supabaseClient: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  doc_key: 'profile_core',
                  payload: {
                    defaultRest: 120,
                    language: 'en',
                    activeProgram: 'forge',
                    preferences: { trainingDaysPerWeek: 4 },
                    coaching: {},
                    bodyMetrics: {},
                  },
                  client_updated_at: '2026-04-01T12:00:00.000Z',
                  updated_at: '2026-04-01T12:00:00.000Z',
                },
              ],
              error: null,
            }),
          })),
        })),
        removeChannel: vi.fn(),
      },
    });

    const result = await runtime!.pullProfileDocuments?.(
      undefined,
      deps as never
    );

    expect(result).toEqual({ usedDocs: true, supported: true });
    expect((deps.supabaseClient.from as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'profile_documents'
    );
    expect(state.profile?.preferences).toEqual({ trainingDaysPerWeek: 4 });
    expect(deps.updateServerDocStamp).toHaveBeenCalledWith(
      'profile_core',
      '2026-04-01T12:00:00.000Z'
    );
  });

  it('queues a one-time document backfill after bootstrap normalization and flushes it online', async () => {
    const runtime = installSyncRuntimeBridge();
    expect(runtime).toBeTruthy();

    const { deps } = createDeps({
      loadLocalData: vi.fn(() => true),
      bootstrapProfileRuntimeState: vi.fn(() => ({
        profile: {
          activeProgram: 'forge',
          preferences: { trainingDaysPerWeek: 3 },
          coaching: {},
          bodyMetrics: {},
          programs: { forge: { week: 2 } },
          syncMeta: {},
        },
        schedule: { sportDays: [1, 3] },
        workouts: [],
        changed: { profile: true, schedule: false, workouts: false },
      })),
      runSupabaseWrite: vi.fn().mockResolvedValue({
        ok: true,
        data: [
          {
            doc_key: 'profile_core',
            applied: true,
            updated_at: '2026-04-01T12:00:00.000Z',
          },
          {
            doc_key: 'program:forge',
            applied: true,
            updated_at: '2026-04-01T12:00:00.000Z',
          },
        ],
      }),
    });
    (deps.supabaseClient.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await runtime!.loadData?.({ allowCloudSync: true }, deps as never);

    expect(deps.markPendingBackfillDocKeys).toHaveBeenCalledWith([
      'profile_core',
      'program:forge',
    ]);
    expect(deps.clearPendingBackfillDocKeys).toHaveBeenCalledWith([
      'profile_core',
      'program:forge',
    ]);
    expect(deps.runSupabaseWrite).toHaveBeenCalled();
  });

  it('keeps a pending backfill marker when normalized bootstrap data cannot sync yet', async () => {
    const runtime = installSyncRuntimeBridge();
    expect(runtime).toBeTruthy();

    const { deps } = createDeps({
      currentUser: null,
      readState: () => ({
        currentUser: null,
        workouts: [],
        schedule: { sportDays: [1, 3] },
        profile: {
          activeProgram: 'forge',
          preferences: { trainingDaysPerWeek: 3 },
          coaching: {},
          bodyMetrics: {},
          programs: {},
          syncMeta: {},
        },
        activeWorkout: null,
        cloudSyncEnabled: false,
      }),
      setCloudSyncEnabled: vi.fn(),
      loadLocalData: vi.fn(() => true),
      bootstrapProfileRuntimeState: vi.fn(() => ({
        profile: {
          activeProgram: 'forge',
          preferences: { trainingDaysPerWeek: 3 },
          coaching: {},
          bodyMetrics: {},
          programs: { forge: { week: 1 } },
          syncMeta: {},
        },
        schedule: { sportDays: [1, 3] },
        workouts: [],
        changed: { profile: true, schedule: false, workouts: false },
      })),
    });

    await runtime!.loadData?.({ allowCloudSync: false }, deps as never);

    expect(deps.markPendingBackfillDocKeys).toHaveBeenCalledWith([
      'profile_core',
      'program:forge',
    ]);
    expect(deps.runSupabaseWrite).not.toHaveBeenCalled();
  });

  it('flushes pending workout replay markers even when profile docs are clean', async () => {
    const runtime = installSyncRuntimeBridge();
    expect(runtime).toBeTruthy();

    const replayPendingWorkoutSync = vi.fn().mockResolvedValue(true);
    const recordCloudSyncSuccess = vi.fn();
    const { deps } = createDeps({
      getDirtyDocKeys: vi.fn(() => []),
      getPendingBackfillDocKeys: vi.fn(() => []),
      getPendingWorkoutUpsertIds: vi.fn(() => ['workout-1']),
      getPendingWorkoutDeleteIds: vi.fn(() => []),
      replayPendingWorkoutSync,
      recordCloudSyncSuccess,
    });

    const result = await runtime!.flushPendingCloudSync?.(deps as never);

    expect(result).toBe(true);
    expect(replayPendingWorkoutSync).toHaveBeenCalledWith({ notifyUser: false });
    expect(recordCloudSyncSuccess).toHaveBeenCalled();
  });
});
