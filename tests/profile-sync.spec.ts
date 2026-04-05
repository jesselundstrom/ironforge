import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

declare const PROFILE_CORE_DOC_KEY: string;

declare let profile: Record<string, any>;
declare let schedule: Record<string, any>;
declare let cloudSyncEnabled: boolean;

declare function clearDocKeysDirty(docKeys: string[]): void;
declare function getDirtyDocKeys(): string[];
declare function getAllProfileDocumentKeys(profileLike?: Record<string, any> | null): string[];
declare function getDefaultTrainingPreferences(): Record<string, any>;
declare function getDefaultCoachingProfile(): Record<string, any>;
declare function normalizeTrainingPreferences(
  profileLike?: Record<string, any> | null
): Record<string, any>;
declare function normalizeScheduleState(
  scheduleLike?: Record<string, any> | null
): Record<string, any> | null;
declare function buildStateFromProfileDocuments(
  rows: Array<Record<string, any>>,
  localProfile: Record<string, any>,
  localSchedule: Record<string, any>,
  workoutItems?: Array<Record<string, any>>
): {
  profile: Record<string, any>;
  schedule: Record<string, any>;
};
declare function applyLegacyProfileBlob(
  remoteProfile: Record<string, any>,
  remoteSchedule: Record<string, any>,
  options?: Record<string, any>
): void;
declare function applyRealtimeSync(reason?: string): Promise<void>;
declare let fetchLegacyProfileBlob: () => Promise<Record<string, any>>;
declare let pullProfileDocuments: (
  options?: Record<string, any>
 ) => Promise<Record<string, any>>;
declare let pullWorkoutsFromTable: (
  fallbackWorkouts?: Array<Record<string, any>>
) => Promise<Record<string, any>>;
declare function saveSchedule(nextValues?: Record<string, any>): void;

test('stale profile document does not overwrite newer local training frequency', async ({ page }) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
    const localProfile = {
      ...structuredClone(profile),
      preferences: normalizeTrainingPreferences({
        preferences: {
          ...getDefaultTrainingPreferences(),
          trainingDaysPerWeek: 2,
        },
      }),
      syncMeta: {
        ...(profile.syncMeta || {}),
        profileUpdatedAt: '2026-03-12T10:00:00.000Z',
      },
    };
    const rows = [
      {
        doc_key: PROFILE_CORE_DOC_KEY,
        payload: {
          defaultRest: 120,
          language: 'en',
          preferences: {
            ...getDefaultTrainingPreferences(),
            trainingDaysPerWeek: 3,
          },
          coaching: getDefaultCoachingProfile(),
          activeProgram: 'forge',
        },
        client_updated_at: '2026-03-12T09:00:00.000Z',
        updated_at: '2026-03-12T09:00:00.000Z',
      },
    ];
    const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
    return merged.profile.preferences.trainingDaysPerWeek;
  });

  expect(result).toBe(2);
});

test('stale legacy profile blob does not overwrite newer local training frequency', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
    profile.preferences = normalizeTrainingPreferences({
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 2,
      },
    });
    profile.syncMeta = {
      ...(profile.syncMeta || {}),
      profileUpdatedAt: '2026-03-12T10:00:00.000Z',
    };
    const remoteProfile = {
      defaultRest: 120,
      language: 'en',
      preferences: {
        ...getDefaultTrainingPreferences(),
        trainingDaysPerWeek: 3,
      },
      coaching: getDefaultCoachingProfile(),
      activeProgram: 'forge',
      syncMeta: {
        profileUpdatedAt: '2026-03-12T09:00:00.000Z',
      },
    };
    applyLegacyProfileBlob(remoteProfile, schedule, {});
    return profile.preferences.trainingDaysPerWeek;
  });

  expect(result).toBe(2);
});

test('newer remote profile document still updates local training frequency', async ({ page }) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
    const localProfile = {
      ...structuredClone(profile),
      preferences: normalizeTrainingPreferences({
        preferences: {
          ...getDefaultTrainingPreferences(),
          trainingDaysPerWeek: 2,
        },
      }),
      syncMeta: {
        ...(profile.syncMeta || {}),
        profileUpdatedAt: '2026-03-12T09:00:00.000Z',
      },
    };
    const rows = [
      {
        doc_key: PROFILE_CORE_DOC_KEY,
        payload: {
          defaultRest: 120,
          language: 'en',
          preferences: {
            ...getDefaultTrainingPreferences(),
            trainingDaysPerWeek: 3,
          },
          coaching: getDefaultCoachingProfile(),
          activeProgram: 'forge',
        },
        client_updated_at: '2026-03-12T10:00:00.000Z',
        updated_at: '2026-03-12T10:00:00.000Z',
      },
    ];
    const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
    return merged.profile.preferences.trainingDaysPerWeek;
  });

  expect(result).toBe(3);
});

test('remote profile document does not win solely because updated_at is newer', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
    const localProfile = {
      ...structuredClone(profile),
      preferences: normalizeTrainingPreferences({
        preferences: {
          ...getDefaultTrainingPreferences(),
          trainingDaysPerWeek: 2,
        },
      }),
      syncMeta: {
        ...(profile.syncMeta || {}),
        profileUpdatedAt: '2026-03-12T10:00:00.000Z',
      },
    };
    const rows = [
      {
        doc_key: PROFILE_CORE_DOC_KEY,
        payload: {
          defaultRest: 120,
          language: 'en',
          preferences: {
            ...getDefaultTrainingPreferences(),
            trainingDaysPerWeek: 5,
          },
          coaching: getDefaultCoachingProfile(),
          activeProgram: 'forge',
        },
        client_updated_at: '2026-03-12T09:00:00.000Z',
        updated_at: '2026-03-12T11:00:00.000Z',
      },
    ];
    const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
    return merged.profile.preferences.trainingDaysPerWeek;
  });

  expect(result).toBe(2);
});

test('remote profile document still wins when client_updated_at is newer but updated_at is older', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
    const localProfile = {
      ...structuredClone(profile),
      preferences: normalizeTrainingPreferences({
        preferences: {
          ...getDefaultTrainingPreferences(),
          trainingDaysPerWeek: 2,
        },
      }),
      syncMeta: {
        ...(profile.syncMeta || {}),
        profileUpdatedAt: '2026-03-12T09:30:00.000Z',
      },
    };
    const rows = [
      {
        doc_key: PROFILE_CORE_DOC_KEY,
        payload: {
          defaultRest: 120,
          language: 'en',
          preferences: {
            ...getDefaultTrainingPreferences(),
            trainingDaysPerWeek: 4,
          },
          coaching: getDefaultCoachingProfile(),
          activeProgram: 'forge',
        },
        client_updated_at: '2026-03-12T10:00:00.000Z',
        updated_at: '2026-03-12T09:00:00.000Z',
      },
    ];
    const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
    return merged.profile.preferences.trainingDaysPerWeek;
  });

  expect(result).toBe(4);
});

test('saveSchedule marks only the schedule document as dirty', async ({ page }) => {
  await openAppShell(page);

  const dirtyDocKeys = await page.evaluate(() => {
    clearDocKeysDirty(getAllProfileDocumentKeys(profile));
    saveSchedule({
      sportName: 'Padel',
      sportIntensity: 'moderate',
      sportLegsHeavy: false,
      sportDays: [1, 3],
    });
    return getDirtyDocKeys().slice().sort();
  });

  expect(dirtyDocKeys).toEqual(['schedule']);
});

test('profile document merge helper stays pure and does not publish intermediate store state', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    const liveBefore =
      (window as any).__IRONFORGE_STORES__?.profile?.getState?.().profile
        ?.activeProgram || null;
    clearDocKeysDirty([PROFILE_CORE_DOC_KEY, 'program:wendler531']);
    const merged = buildStateFromProfileDocuments(
      [
        {
          doc_key: PROFILE_CORE_DOC_KEY,
          payload: {
            defaultRest: 120,
            language: 'en',
            activeProgram: 'wendler531',
            preferences: getDefaultTrainingPreferences(),
            coaching: getDefaultCoachingProfile(),
          },
          client_updated_at: '2026-03-12T10:00:00.000Z',
          updated_at: '2026-03-12T10:00:00.000Z',
        },
      ],
      structuredClone(profile),
      schedule,
      []
    );
    const liveAfter =
      (window as any).__IRONFORGE_STORES__?.profile?.getState?.().profile
        ?.activeProgram || null;
    const runtimeSnapshot =
      (window as any).__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || {};

    return {
      liveBefore,
      liveAfter,
      runtimeActiveProgram: runtimeSnapshot.profile?.activeProgram ?? null,
      mergedActiveProgram: merged.profile?.activeProgram ?? null,
    };
  });

  expect(result.liveBefore).toBe('forge');
  expect(result.liveAfter).toBe('forge');
  expect(result.runtimeActiveProgram).toBe('forge');
  expect(typeof result.mergedActiveProgram).toBe('string');
});

test('profile store writes publish legacy snapshots without re-importing stray legacy fields', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    const runtimeAccess = (window as any).__IRONFORGE_LEGACY_RUNTIME_ACCESS__;
    const profileBridge = (window as any).__IRONFORGE_STORES__?.profile;
    const dataBridge = (window as any).__IRONFORGE_STORES__?.data;
    const currentProfile = structuredClone(profileBridge?.getState?.().profile || {});

    runtimeAccess?.write?.('profile', {
      ...currentProfile,
      legacyOnlyBridgeField: 'stale-legacy-value',
      preferences: normalizeTrainingPreferences({
        preferences: {
          ...getDefaultTrainingPreferences(),
          trainingDaysPerWeek: 5,
        },
      }),
    });

    const nextProfile = profileBridge?.updateProfile?.({
      preferences: normalizeTrainingPreferences({
        preferences: {
          ...getDefaultTrainingPreferences(),
          trainingDaysPerWeek: 4,
        },
      }),
    });
    const canonicalProfile = profileBridge?.getState?.().profile || null;
    const runtimeSnapshot =
      (window as any).__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || {};
    const mirroredProfile = dataBridge?.getState?.().profile || null;

    return {
      returnedDays: nextProfile?.preferences?.trainingDaysPerWeek ?? null,
      canonicalDays: canonicalProfile?.preferences?.trainingDaysPerWeek ?? null,
      mirroredDays: mirroredProfile?.preferences?.trainingDaysPerWeek ?? null,
      legacyDays: runtimeSnapshot.profile?.preferences?.trainingDaysPerWeek ?? null,
      canonicalHasLegacyOnly:
        Object.prototype.hasOwnProperty.call(canonicalProfile || {}, 'legacyOnlyBridgeField'),
      mirroredHasLegacyOnly:
        Object.prototype.hasOwnProperty.call(mirroredProfile || {}, 'legacyOnlyBridgeField'),
      legacyHasLegacyOnly:
        Object.prototype.hasOwnProperty.call(
          runtimeSnapshot.profile || {},
          'legacyOnlyBridgeField'
        ),
    };
  });

  expect(result.returnedDays).toBe(4);
  expect(result.canonicalDays).toBe(4);
  expect(result.mirroredDays).toBe(4);
  expect(result.legacyDays).toBe(4);
  expect(result.canonicalHasLegacyOnly).toBe(false);
  expect(result.mirroredHasLegacyOnly).toBe(false);
  expect(result.legacyHasLegacyOnly).toBe(false);
});

test('legacy runtime profile updates route through the typed owner and refresh the compatibility snapshot', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    const nextProfile = {
      ...(profile || {}),
      activeProgram: 'stronglifts5x5',
      preferences: normalizeTrainingPreferences({
        preferences: {
          ...getDefaultTrainingPreferences(),
          trainingDaysPerWeek: 4,
        },
      }),
      programs: {
        ...(((profile || {}) as Record<string, any>).programs || {}),
        stronglifts5x5: {
          ...(window as any).__IRONFORGE_E2E__?.program?.getInitialState?.('stronglifts5x5'),
          testMarker: 'slice-3',
        },
      },
    };

    (window as any).__IRONFORGE_SET_LEGACY_RUNTIME_STATE__?.({
      profile: nextProfile,
    });

    const canonicalProfile =
      (window as any).__IRONFORGE_STORES__?.profile?.getState?.().profile || null;
    const programState =
      (window as any).__IRONFORGE_STORES__?.program?.getState?.() || null;
    const runtimeSnapshot =
      (window as any).__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || {};

    return {
      canonicalActiveProgram: canonicalProfile?.activeProgram ?? null,
      canonicalDays: canonicalProfile?.preferences?.trainingDaysPerWeek ?? null,
      canonicalMarker:
        canonicalProfile?.programs?.stronglifts5x5?.testMarker ?? null,
      programStoreActiveProgram: programState?.activeProgramId ?? null,
      programStoreMarker:
        programState?.activeProgramState?.testMarker ?? null,
      legacyActiveProgram: runtimeSnapshot.profile?.activeProgram ?? null,
      legacyMarker:
        runtimeSnapshot.profile?.programs?.stronglifts5x5?.testMarker ?? null,
    };
  });

  expect(result.canonicalActiveProgram).toBe('stronglifts5x5');
  expect(result.canonicalDays).toBe(4);
  expect(result.canonicalMarker).toBe('slice-3');
  expect(result.programStoreActiveProgram).toBe('stronglifts5x5');
  expect(result.programStoreMarker).toBe('slice-3');
  expect(result.legacyActiveProgram).toBe('stronglifts5x5');
  expect(result.legacyMarker).toBe('slice-3');
});

test('legacy runtime rejects profile-owned writes when the profile store bridge is unavailable', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    const previousBridge = (window as any).__IRONFORGE_PROFILE_STORE__;
    let errorMessage = '';

    try {
      delete (window as any).__IRONFORGE_PROFILE_STORE__;
      (window as any).__IRONFORGE_SET_LEGACY_RUNTIME_STATE__?.({
        profile: {
          ...(profile || {}),
          activeProgram: 'forge',
        },
      });
    } catch (error) {
      errorMessage = String((error as Error)?.message || error || '');
    } finally {
      (window as any).__IRONFORGE_PROFILE_STORE__ = previousBridge;
    }

    return {
      errorMessage,
      canonicalActiveProgram:
        (window as any).__IRONFORGE_STORES__?.profile?.getState?.().profile
          ?.activeProgram || null,
    };
  });

  expect(result.errorMessage).toContain('Profile store bridge is required');
  expect(result.canonicalActiveProgram).toBe('forge');
});

test('blank schedule sport name survives normalization instead of reverting to the locale default', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    const nextSchedule = {
      sportName: '',
      sportDays: [1, '3', 3, 9],
      sportIntensity: 'moderate',
      sportLegsHeavy: false,
    };
    normalizeScheduleState(nextSchedule);
    return nextSchedule;
  });

  expect(result).toEqual({
    sportName: '',
    sportDays: [1, 3],
    sportIntensity: 'moderate',
    sportLegsHeavy: false,
  });
});

test('bootstrap leaves plain legacy workouts untouched when no commentary migration is needed', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    return (window as any).__IRONFORGE_APP_RUNTIME__?.bootstrapProfileRuntime?.({
      profile: structuredClone(profile),
      schedule: structuredClone(schedule),
      workouts: [
        {
          id: 'plain-legacy-workout',
          date: '2026-03-12T10:00:00.000Z',
          type: 'forge',
          program: 'forge',
          exercises: [],
        },
      ],
      applyToStore: false,
    });
  });

  expect(result.changed.workouts).toBe(false);
  expect(result.workouts[0].commentary ?? null).toBe(null);
});

test('realtime legacy blob fallback finalizes active-program catch-up once', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(async () => {
    const daysAgo = (count: number) =>
      new Date(Date.now() - count * 24 * 60 * 60 * 1000).toISOString();
    const originalFetchLegacyProfileBlob = fetchLegacyProfileBlob;
    const originalPullProfileDocuments = pullProfileDocuments;
    const originalPullWorkoutsFromTable = pullWorkoutsFromTable;
    const originalCloudSyncEnabled = cloudSyncEnabled;
    let fetchCalls = 0;
    let docsCalls = 0;

    try {
      cloudSyncEnabled = true;
      clearDocKeysDirty(getAllProfileDocumentKeys(profile));
      profile.syncMeta = {
        ...(profile.syncMeta || {}),
        profileUpdatedAt: '2026-03-10T09:00:00.000Z',
      };
      const remoteProfile = {
        ...structuredClone(profile),
        activeProgram: 'forge',
        programs: {
          ...(structuredClone(profile.programs || {}) as Record<string, any>),
          forge: {
            ...window.__IRONFORGE_E2E__?.program?.getInitialState?.('forge'),
            week: 1,
            weekStartDate: daysAgo(15),
          },
        },
        syncMeta: {
          ...(profile.syncMeta || {}),
          profileUpdatedAt: '2026-03-12T10:00:00.000Z',
        },
      };

      fetchLegacyProfileBlob = async () => {
        fetchCalls += 1;
        return {
        usedCloud: true,
        profile: remoteProfile,
        schedule: structuredClone(schedule),
        updatedAt: '2026-03-12T10:00:00.000Z',
        };
      };
      pullProfileDocuments = async () => {
        docsCalls += 1;
        return {
        usedDocs: false,
        supported: false,
        };
      };
      pullWorkoutsFromTable = async (items?: Array<Record<string, any>>) => ({
        usedTable: false,
        didBackfill: false,
        workouts: items || [],
      });

      await applyRealtimeSync('test');

      return {
        fetchCalls,
        docsCalls,
        activeProgram: profile?.activeProgram ?? null,
        legacyWeek: profile?.programs?.forge?.week ?? null,
        storeWeek:
          (window as any).__IRONFORGE_STORES__?.profile?.getState?.().profile?.programs
            ?.forge?.week ?? null,
      };
    } finally {
      cloudSyncEnabled = originalCloudSyncEnabled;
      fetchLegacyProfileBlob = originalFetchLegacyProfileBlob;
      pullProfileDocuments = originalPullProfileDocuments;
      pullWorkoutsFromTable = originalPullWorkoutsFromTable;
    }
  });

  expect(result.fetchCalls).toBe(1);
  expect(result.docsCalls).toBe(1);
  expect(result.activeProgram).toBe('forge');
  expect(result.legacyWeek).toBeGreaterThan(1);
  expect(result.storeWeek).toBe(result.legacyWeek);
});

test('loadData bootstraps legacy ats and flat forge state through the typed runtime', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(async () => {
    await (window as any).__IRONFORGE_E2E__?.app?.seedData?.({
      profile: {
        defaultRest: 150,
        language: 'en',
        activeProgram: 'w531',
        atsLifts: {
          squat: { tm: 120 },
        },
        atsWeek: 3,
        atsDayNum: 2,
        atsRounding: 2.5,
        atsDaysPerWeek: 3,
        atsMode: 'sets',
        atsWeekStartDate: '2026-03-01T00:00:00.000Z',
      },
      schedule: {
        sportName: 'Hockey',
        hockeyDays: [1, 3],
        sportIntensity: 'moderate',
        sportLegsHeavy: false,
      },
      workouts: [
        {
          id: 'legacy-ats-1',
          date: '2026-03-12T10:00:00.000Z',
          type: 'ats',
          atsWeek: 3,
          atsDayNum: 2,
          exercises: [],
        },
      ],
    });

    const profileState =
      (window as any).__IRONFORGE_STORES__?.profile?.getState?.() || {};
    const dataState = (window as any).__IRONFORGE_STORES__?.data?.getState?.() || {};
    const runtimeSnapshot =
      (window as any).__IRONFORGE_GET_LEGACY_RUNTIME_STATE__?.() || {};

    return {
      activeProgram: profileState.profile?.activeProgram ?? null,
      programKeys: Object.keys(profileState.profile?.programs || {}).sort(),
      forgeWeek: profileState.profile?.programs?.forge?.week ?? null,
      forgeDayNum: profileState.profile?.programs?.forge?.dayNum ?? null,
      schedule: profileState.schedule || null,
      workout: dataState.workouts?.[0] || null,
      runtimeActiveProgram: runtimeSnapshot.profile?.activeProgram ?? null,
    };
  });

  expect(result.activeProgram).toBe('forge');
  expect(result.runtimeActiveProgram).toBe('forge');
  expect(result.programKeys).toEqual(
    expect.arrayContaining(['forge', 'stronglifts5x5', 'wendler531'])
  );
  expect(typeof result.forgeWeek).toBe('number');
  expect(result.schedule).toEqual({
    sportName: 'Cardio',
    sportDays: [1, 3],
    sportIntensity: 'moderate',
    sportLegsHeavy: false,
  });
  expect(result.workout).toEqual(
    expect.objectContaining({
      type: 'forge',
      program: 'forge',
      programDayNum: 2,
      programMeta: expect.objectContaining({ week: 3 }),
    })
  );
});

test('profile document merge canonicalizes program ids and fills typed defaults', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    clearDocKeysDirty([PROFILE_CORE_DOC_KEY, 'program:wendler531']);
    const merged = buildStateFromProfileDocuments(
      [
        {
          doc_key: PROFILE_CORE_DOC_KEY,
          payload: {
            defaultRest: 120,
            language: 'en',
            activeProgram: 'w531',
            preferences: getDefaultTrainingPreferences(),
            coaching: getDefaultCoachingProfile(),
          },
          client_updated_at: '2026-03-12T10:00:00.000Z',
          updated_at: '2026-03-12T10:00:00.000Z',
        },
        {
          doc_key: 'program:wendler531',
          payload: {
            cycle: 2,
            week: 3,
            daysPerWeek: 4,
          },
          client_updated_at: '2026-03-12T10:00:00.000Z',
          updated_at: '2026-03-12T10:00:00.000Z',
        },
      ],
      {
        ...structuredClone(profile),
        syncMeta: {
          ...(profile.syncMeta || {}),
          profileUpdatedAt: '2026-03-12T09:00:00.000Z',
        },
      },
      schedule
    );
    return {
      activeProgram: merged.profile.activeProgram,
      programKeys: Object.keys(merged.profile.programs || {}).sort(),
      wendlerState: merged.profile.programs?.wendler531 || null,
      hasLegacyAlias: Object.prototype.hasOwnProperty.call(
        merged.profile.programs || {},
        'w531'
      ),
    };
  });

  expect(result.activeProgram).toBe('wendler531');
  expect(result.programKeys).toEqual(
    expect.arrayContaining(['forge', 'stronglifts5x5', 'wendler531'])
  );
  expect(result.wendlerState).toEqual(
    expect.objectContaining({ cycle: 2, week: 3 })
  );
  expect(result.hasLegacyAlias).toBe(false);
});

test('legacy profile blob apply uses the typed bootstrap rules for program ownership', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    clearDocKeysDirty(getAllProfileDocumentKeys(profile));
    profile.syncMeta = {
      ...(profile.syncMeta || {}),
      profileUpdatedAt: '2026-03-12T09:00:00.000Z',
    };
    applyLegacyProfileBlob(
      {
        defaultRest: 120,
        language: 'en',
        activeProgram: 'wendler531',
        programs: {
          wendler531: { cycle: 3, week: 2, daysPerWeek: 4 },
        },
        preferences: getDefaultTrainingPreferences(),
        coaching: getDefaultCoachingProfile(),
        syncMeta: {
          profileUpdatedAt: '2026-03-12T10:00:00.000Z',
          scheduleUpdatedAt: '2026-03-12T10:00:00.000Z',
        },
      },
      {
        sportName: 'Hockey',
        hockeyDays: [2, 4],
        sportIntensity: 'easy',
        sportLegsHeavy: true,
      },
      {}
    );

    return {
      activeProgram: profile.activeProgram,
      wendlerState: profile.programs?.wendler531 || null,
      hasLegacyAlias: Object.prototype.hasOwnProperty.call(
        profile.programs || {},
        'w531'
      ),
      normalizedSchedule: structuredClone(schedule),
    };
  });

  expect(result.activeProgram).toBe('wendler531');
  expect(result.wendlerState).toEqual(
    expect.objectContaining({ cycle: 3, week: 2 })
  );
  expect(result.hasLegacyAlias).toBe(false);
  expect(result.normalizedSchedule).toEqual({
    sportName: 'Cardio',
    sportDays: [2, 4],
    sportIntensity: 'easy',
    sportLegsHeavy: true,
  });
});

test('remote profile document normalizes malformed body metrics before applying them', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
    const localProfile = {
      ...structuredClone(profile),
      syncMeta: {
        ...(profile.syncMeta || {}),
        profileUpdatedAt: '2026-03-12T09:00:00.000Z',
      },
    };
    const rows = [
      {
        doc_key: PROFILE_CORE_DOC_KEY,
        payload: {
          defaultRest: 120,
          language: 'en',
          bodyMetrics: {
            sex: 'robot',
            activityLevel: 'extreme',
            weight: 500,
            height: 95,
            age: 200,
            targetWeight: 'oops',
            bodyGoal: 'bulk_forever',
          },
          preferences: getDefaultTrainingPreferences(),
          coaching: getDefaultCoachingProfile(),
          activeProgram: 'forge',
        },
        client_updated_at: '2026-03-12T10:00:00.000Z',
        updated_at: '2026-03-12T09:00:00.000Z',
      },
    ];
    const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
    return merged.profile.bodyMetrics;
  });

  expect(result).toEqual({
    sex: null,
    activityLevel: null,
    weight: 300,
    height: 100,
    age: 100,
    targetWeight: null,
    bodyGoal: null,
  });
});
