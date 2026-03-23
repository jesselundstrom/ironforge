import { expect, test } from '@playwright/test';
import { openAppShell } from './helpers';

test('stale profile document does not overwrite newer local training frequency', async ({ page }) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    return window.eval(`
      (() => {
        clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
        const localProfile = {
          ...cloneJson(profile),
          preferences: normalizeTrainingPreferences({
            preferences: {
              ...getDefaultTrainingPreferences(),
              trainingDaysPerWeek: 2
            }
          }),
          syncMeta: {
            ...(profile.syncMeta || {}),
            profileUpdatedAt: '2026-03-12T10:00:00.000Z'
          }
        };
        const rows = [{
          doc_key: PROFILE_CORE_DOC_KEY,
          payload: {
            defaultRest: 120,
            language: 'en',
            preferences: {
              ...getDefaultTrainingPreferences(),
              trainingDaysPerWeek: 3
            },
            coaching: getDefaultCoachingProfile(),
            activeProgram: 'forge'
          },
          client_updated_at: '2026-03-12T09:00:00.000Z',
          updated_at: '2026-03-12T09:00:00.000Z'
        }];
        const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
        return merged.profile.preferences.trainingDaysPerWeek;
      })()
    `);
  });

  expect(result).toBe(2);
});

test('stale legacy profile blob does not overwrite newer local training frequency', async ({ page }) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    return window.eval(`
      (() => {
        clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
        profile.preferences = normalizeTrainingPreferences({
          preferences: {
            ...getDefaultTrainingPreferences(),
            trainingDaysPerWeek: 2
          }
        });
        profile.syncMeta = {
          ...(profile.syncMeta || {}),
          profileUpdatedAt: '2026-03-12T10:00:00.000Z'
        };
        const remoteProfile = {
          defaultRest: 120,
          language: 'en',
          preferences: {
            ...getDefaultTrainingPreferences(),
            trainingDaysPerWeek: 3
          },
          coaching: getDefaultCoachingProfile(),
          activeProgram: 'forge',
          syncMeta: {
            profileUpdatedAt: '2026-03-12T09:00:00.000Z'
          }
        };
        applyLegacyProfileBlob(remoteProfile, schedule, {});
        return profile.preferences.trainingDaysPerWeek;
      })()
    `);
  });

  expect(result).toBe(2);
});

test('newer remote profile document still updates local training frequency', async ({ page }) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    return window.eval(`
      (() => {
        clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
        const localProfile = {
          ...cloneJson(profile),
          preferences: normalizeTrainingPreferences({
            preferences: {
              ...getDefaultTrainingPreferences(),
              trainingDaysPerWeek: 2
            }
          }),
          syncMeta: {
            ...(profile.syncMeta || {}),
            profileUpdatedAt: '2026-03-12T09:00:00.000Z'
          }
        };
        const rows = [{
          doc_key: PROFILE_CORE_DOC_KEY,
          payload: {
            defaultRest: 120,
            language: 'en',
            preferences: {
              ...getDefaultTrainingPreferences(),
              trainingDaysPerWeek: 3
            },
            coaching: getDefaultCoachingProfile(),
            activeProgram: 'forge'
          },
          client_updated_at: '2026-03-12T10:00:00.000Z',
          updated_at: '2026-03-12T10:00:00.000Z'
        }];
        const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
        return merged.profile.preferences.trainingDaysPerWeek;
      })()
    `);
  });

  expect(result).toBe(3);
});

test('remote profile document does not win solely because updated_at is newer', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    return window.eval(`
      (() => {
        clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
        const localProfile = {
          ...cloneJson(profile),
          preferences: normalizeTrainingPreferences({
            preferences: {
              ...getDefaultTrainingPreferences(),
              trainingDaysPerWeek: 2
            }
          }),
          syncMeta: {
            ...(profile.syncMeta || {}),
            profileUpdatedAt: '2026-03-12T10:00:00.000Z'
          }
        };
        const rows = [{
          doc_key: PROFILE_CORE_DOC_KEY,
          payload: {
            defaultRest: 120,
            language: 'en',
            preferences: {
              ...getDefaultTrainingPreferences(),
              trainingDaysPerWeek: 5
            },
            coaching: getDefaultCoachingProfile(),
            activeProgram: 'forge'
          },
          client_updated_at: '2026-03-12T09:00:00.000Z',
          updated_at: '2026-03-12T11:00:00.000Z'
        }];
        const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
        return merged.profile.preferences.trainingDaysPerWeek;
      })()
    `);
  });

  expect(result).toBe(2);
});

test('remote profile document still wins when client_updated_at is newer but updated_at is older', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    return window.eval(`
      (() => {
        clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
        const localProfile = {
          ...cloneJson(profile),
          preferences: normalizeTrainingPreferences({
            preferences: {
              ...getDefaultTrainingPreferences(),
              trainingDaysPerWeek: 2
            }
          }),
          syncMeta: {
            ...(profile.syncMeta || {}),
            profileUpdatedAt: '2026-03-12T09:30:00.000Z'
          }
        };
        const rows = [{
          doc_key: PROFILE_CORE_DOC_KEY,
          payload: {
            defaultRest: 120,
            language: 'en',
            preferences: {
              ...getDefaultTrainingPreferences(),
              trainingDaysPerWeek: 4
            },
            coaching: getDefaultCoachingProfile(),
            activeProgram: 'forge'
          },
          client_updated_at: '2026-03-12T10:00:00.000Z',
          updated_at: '2026-03-12T09:00:00.000Z'
        }];
        const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
        return merged.profile.preferences.trainingDaysPerWeek;
      })()
    `);
  });

  expect(result).toBe(4);
});

test('saveSchedule marks only the schedule document as dirty', async ({ page }) => {
  await openAppShell(page);

  const dirtyDocKeys = await page.evaluate(() => {
    return window.eval(`
      (() => {
        clearDocKeysDirty(getAllProfileDocumentKeys(profile));
        saveSchedule({
          sportName: 'Padel',
          sportIntensity: 'moderate',
          sportLegsHeavy: false,
          sportDays: [1, 3]
        });
        return getDirtyDocKeys().slice().sort();
      })()
    `);
  });

  expect(dirtyDocKeys).toEqual(['schedule']);
});

test('remote profile document normalizes malformed body metrics before applying them', async ({
  page,
}) => {
  await openAppShell(page);

  const result = await page.evaluate(() => {
    return window.eval(`
      (() => {
        clearDocKeysDirty([PROFILE_CORE_DOC_KEY]);
        const localProfile = {
          ...cloneJson(profile),
          syncMeta: {
            ...(profile.syncMeta || {}),
            profileUpdatedAt: '2026-03-12T09:00:00.000Z'
          }
        };
        const rows = [{
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
              bodyGoal: 'bulk_forever'
            },
            preferences: getDefaultTrainingPreferences(),
            coaching: getDefaultCoachingProfile(),
            activeProgram: 'forge'
          },
          client_updated_at: '2026-03-12T10:00:00.000Z',
          updated_at: '2026-03-12T09:00:00.000Z'
        }];
        const merged = buildStateFromProfileDocuments(rows, localProfile, schedule);
        return merged.profile.bodyMetrics;
      })()
    `);
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
