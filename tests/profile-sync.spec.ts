import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

declare const PROFILE_CORE_DOC_KEY: string;

declare let profile: Record<string, any>;
declare let schedule: Record<string, any>;

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
  localSchedule: Record<string, any>
): {
  profile: Record<string, any>;
  schedule: Record<string, any>;
};
declare function applyLegacyProfileBlob(
  remoteProfile: Record<string, any>,
  remoteSchedule: Record<string, any>,
  options?: Record<string, any>
): void;
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
