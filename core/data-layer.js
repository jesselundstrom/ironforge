// Data and auth layer extracted from app.js.
// Keeps runtime behavior the same while reducing app.js size/responsibility.

const PROFILE_CORE_DOC_KEY = 'profile_core';
const SCHEDULE_DOC_KEY = 'schedule';
const PROGRAM_DOC_PREFIX = 'program:';
const LOCAL_CACHE_KEYS = {
  workouts: 'ic_workouts',
  schedule: 'ic_schedule',
  profile: 'ic_profile',
  activeWorkout: 'ic_active_workout',
  syncState: 'ic_sync_state',
};
let profileDocumentsSupported = null;
let syncRealtimeChannel = null;
let realtimeSyncTimer = null;
let isApplyingRemoteSync = false;
let lastCloudSyncErrorToastAt = 0;
let syncStateCache = createDefaultSyncStateCache();
let activeWorkoutDraftCache = null;
let syncStatusState = { state: 'idle', updatedAt: null };
let cloudSyncEnabled = true;

function createDefaultSyncStateCache() {
  return {
    dirtyDocKeys: [],
    serverUpdatedAtByDocKey: {},
    legacyProfileUpdatedAt: null,
  };
}

function normalizeSyncStateCache(value) {
  const next = {
    ...createDefaultSyncStateCache(),
    ...(value && typeof value === 'object' ? value : {}),
  };
  next.dirtyDocKeys = uniqueDocKeys(next.dirtyDocKeys);
  next.serverUpdatedAtByDocKey =
    next.serverUpdatedAtByDocKey &&
    typeof next.serverUpdatedAtByDocKey === 'object'
      ? { ...next.serverUpdatedAtByDocKey }
      : {};
  next.legacyProfileUpdatedAt = next.legacyProfileUpdatedAt || null;
  return next;
}

function getSyncStateCache() {
  syncStateCache = normalizeSyncStateCache(syncStateCache);
  return syncStateCache;
}

function getLocalCacheUserId(explicitUserId) {
  const raw =
    explicitUserId ||
    currentUser?.id ||
    window.__IRONFORGE_TEST_USER_ID__ ||
    '';
  return String(raw || '').trim();
}

function isCloudSyncEnabled() {
  return cloudSyncEnabled !== false;
}

function getLocalCacheKey(baseKey, userId) {
  const scopedUserId = getLocalCacheUserId(userId);
  return scopedUserId ? baseKey + '::' + scopedUserId : baseKey;
}

function readLocalCacheJson(key, label) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch (e) {
    logWarn('Failed to load ' + label + ' from localStorage', e);
    return undefined;
  }
}

function writeLocalCacheJson(key, value, label) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    logWarn('Failed to persist ' + label + ' locally', e);
  }
}

function removeLocalCacheKeys(keys) {
  try {
    (keys || []).forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    logWarn('Failed to clear local cache keys', e);
  }
}

function clearLegacyLocalCache() {
  removeLocalCacheKeys(Object.values(LOCAL_CACHE_KEYS));
}

function clearScopedLocalCache(userId) {
  const scopedUserId = getLocalCacheUserId(userId);
  if (!scopedUserId) return;
  removeLocalCacheKeys(
    Object.values(LOCAL_CACHE_KEYS).map((key) =>
      getLocalCacheKey(key, scopedUserId)
    )
  );
}

function clearLocalDataCache(options) {
  const opts = options || {};
  if (opts.includeScoped !== false) clearScopedLocalCache(opts.userId);
  if (opts.includeLegacy !== false) clearLegacyLocalCache();
  if (typeof clearNutritionLocalData === 'function') {
    clearNutritionLocalData(opts);
  }
}

function resetRuntimeState() {
  workouts = [];
  schedule = {
    sportName: '',
    sportDays: [],
    sportIntensity: 'hard',
    sportLegsHeavy: true,
  };
  profile = {
    defaultRest: 120,
    language: window.I18N && I18N.getLanguage ? I18N.getLanguage() : 'en',
    preferences: getDefaultTrainingPreferences(),
    coaching: getDefaultCoachingProfile(),
  };
  syncStateCache = createDefaultSyncStateCache();
  activeWorkoutDraftCache = null;
  syncStatusState = {
    state: navigator.onLine ? 'idle' : 'offline',
    updatedAt: null,
  };
  cloudSyncEnabled = true;
  if (typeof clearWorkoutTimer === 'function') clearWorkoutTimer();
  if (typeof clearRestInterval === 'function') clearRestInterval();
  if (typeof clearRestHideTimer === 'function') clearRestHideTimer();
  if (typeof clearWorkoutStartSnapshot === 'function')
    clearWorkoutStartSnapshot();
  activeWorkout = null;
  workoutSeconds = 0;
  restSecondsLeft = 0;
  restTotal = 0;
  restEndsAt = 0;
}

function setSyncStatus(state) {
  syncStatusState = { state, updatedAt: new Date().toISOString() };
  renderSyncStatus();
}

function getSyncStatusLabel() {
  const state = !navigator.onLine ? 'offline' : syncStatusState.state || 'idle';
  if (state === 'syncing')
    return {
      label: i18nText('settings.sync.syncing', 'Syncing changes...'),
      className: 'sync-status syncing',
    };
  if (state === 'synced' || state === 'idle')
    return {
      label: i18nText('settings.sync.synced', 'Synced to cloud'),
      className: 'sync-status synced',
    };
  if (state === 'error')
    return {
      label: i18nText(
        'settings.sync.error',
        'Cloud sync issue. Local changes are kept on this device.'
      ),
      className: 'sync-status error',
    };
  return {
    label: i18nText(
      'settings.sync.offline',
      'Offline. Changes will sync when you reconnect.'
    ),
    className: 'sync-status offline',
  };
}

function renderSyncStatus() {
  const el = document.getElementById('sync-status');
  if (!el) {
    if (typeof notifySettingsAccountIsland === 'function')
      notifySettingsAccountIsland();
    return;
  }
  const next = getSyncStatusLabel();
  el.className = next.className;
  el.textContent = next.label;
  if (typeof notifySettingsAccountIsland === 'function')
    notifySettingsAccountIsland();
}

window.addEventListener('online', () => {
  setSyncStatus('synced');
  if (currentUser) scheduleRealtimeSync('online');
});
window.addEventListener('offline', () => setSyncStatus('offline'));

function notifyCloudSyncError(options) {
  const opts = options || {};
  if (opts.notifyUser === false || typeof showToast !== 'function') return;
  const now = Date.now();
  if (now - lastCloudSyncErrorToastAt < 4000) return;
  lastCloudSyncErrorToastAt = now;
  setSyncStatus('error');
  showToast(
    i18nText(
      'toast.sync_issue',
      'Cloud sync failed. Changes stay on this device for now.'
    ),
    'var(--orange)'
  );
}

function getSupabaseError(result) {
  return result && typeof result === 'object' && 'error' in result
    ? result.error
    : null;
}

async function runSupabaseWrite(operationPromise, context, options) {
  const opts = options || {};
  try {
    const result = await operationPromise;
    const error = getSupabaseError(result);
    if (error) {
      logWarn(context, error);
      notifyCloudSyncError(opts);
      return { ok: false, error, data: result?.data };
    }
    return { ok: true, error: null, data: result?.data };
  } catch (error) {
    logWarn(context, error);
    notifyCloudSyncError(opts);
    return { ok: false, error, data: null };
  }
}

function loadLocalData(options) {
  const opts = options || {};
  const userId = getLocalCacheUserId(opts.userId);
  if (!userId) return false;
  loadSyncStateCache({ userId });
  loadActiveWorkoutDraftCache({ userId });

  const scopedWorkouts = readLocalCacheJson(
    getLocalCacheKey(LOCAL_CACHE_KEYS.workouts, userId),
    'workouts'
  );
  const scopedSchedule = readLocalCacheJson(
    getLocalCacheKey(LOCAL_CACHE_KEYS.schedule, userId),
    'schedule'
  );
  const scopedProfile = readLocalCacheJson(
    getLocalCacheKey(LOCAL_CACHE_KEYS.profile, userId),
    'profile'
  );
  const hasScoped =
    scopedWorkouts !== undefined ||
    scopedSchedule !== undefined ||
    scopedProfile !== undefined;

  if (hasScoped) {
    if (scopedWorkouts !== undefined) workouts = scopedWorkouts;
    if (scopedSchedule !== undefined) schedule = scopedSchedule;
    if (scopedProfile !== undefined) profile = scopedProfile;
    return true;
  }

  if (opts.allowLegacyFallback === false) return false;

  const legacyWorkouts = readLocalCacheJson(
    LOCAL_CACHE_KEYS.workouts,
    'workouts'
  );
  const legacySchedule = readLocalCacheJson(
    LOCAL_CACHE_KEYS.schedule,
    'schedule'
  );
  const legacyProfile = readLocalCacheJson(LOCAL_CACHE_KEYS.profile, 'profile');
  const hasLegacy =
    legacyWorkouts !== undefined ||
    legacySchedule !== undefined ||
    legacyProfile !== undefined;
  if (!hasLegacy) return false;

  if (legacyWorkouts !== undefined) workouts = legacyWorkouts;
  if (legacySchedule !== undefined) schedule = legacySchedule;
  if (legacyProfile !== undefined) profile = legacyProfile;
  persistLocalWorkoutsCache();
  persistLocalScheduleCache();
  persistLocalProfileCache();
  clearLegacyLocalCache();
  return true;
}

function workoutClientId(workout) {
  if (!workout || workout.id === undefined || workout.id === null) return '';
  return String(workout.id);
}

function mergeWorkoutLists(primary, fallback, deletedIds) {
  const removed = deletedIds || new Set();
  const seen = new Set();
  const merged = [];

  function add(items) {
    (items || []).forEach((workout) => {
      const id = workoutClientId(workout);
      if (!id || removed.has(id) || seen.has(id)) return;
      seen.add(id);
      merged.push(workout);
    });
  }

  add(primary);
  add(fallback);
  merged.sort((a, b) => new Date(a.date) - new Date(b.date));
  return merged;
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function arrayifyProfileValue(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function uniqueDocKeys(keys) {
  return [...new Set((keys || []).filter(Boolean))];
}

function programDocKey(programId) {
  const canonicalId =
    typeof getCanonicalProgramId === 'function'
      ? getCanonicalProgramId(programId)
      : String(programId || '');
  return PROGRAM_DOC_PREFIX + String(canonicalId || '');
}

function programIdFromDocKey(docKey) {
  const key = String(docKey || '');
  const programId = key.startsWith(PROGRAM_DOC_PREFIX)
    ? key.slice(PROGRAM_DOC_PREFIX.length)
    : '';
  return typeof getCanonicalProgramId === 'function'
    ? getCanonicalProgramId(programId)
    : programId;
}

function isProgramDocKey(docKey) {
  return !!programIdFromDocKey(docKey);
}

function getProfilePrograms(profileLike) {
  return profileLike &&
    typeof profileLike.programs === 'object' &&
    profileLike.programs
    ? profileLike.programs
    : {};
}

function listProgramIds(profileLike) {
  return Object.keys(getProfilePrograms(profileLike)).sort();
}

function filterCoreSyncMeta(syncMetaLike) {
  if (!syncMetaLike || typeof syncMetaLike !== 'object') return undefined;
  const next = { ...syncMetaLike };
  delete next.profileUpdatedAt;
  delete next.scheduleUpdatedAt;
  delete next.programUpdatedAt;
  return Object.keys(next).length ? next : undefined;
}

function normalizeImportedRestDuration(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 120;
  return Math.max(0, Math.min(3600, Math.round(parsed)));
}

function normalizeImportedLanguage(value) {
  return String(value || '').trim().toLowerCase() === 'fi' ? 'fi' : 'en';
}

function getRegisteredProgramDefinition(programId) {
  const canonicalId = getCanonicalProgramId(programId);
  return (
    (typeof getRegisteredPrograms === 'function'
      ? getRegisteredPrograms()
      : []
    ).find((program) => program.id === canonicalId) || null
  );
}

function getImportedLegacyProgramMap(profileLike) {
  const source = cloneJson(profileLike || {}) || {};
  if (source.atsLifts && !source.forgeLifts) {
    source.forgeLifts = source.atsLifts;
    source.forgeWeek = source.atsWeek || 1;
    source.forgeRounding = source.atsRounding || 2.5;
    source.forgeDaysPerWeek = source.atsDaysPerWeek || 3;
    source.forgeDayNum = source.atsDayNum || 1;
    source.forgeBackExercise = source.atsBackExercise || 'Barbell Rows';
    source.forgeBackWeight = source.atsBackWeight || 0;
    source.forgeMode = source.atsMode || 'sets';
    source.forgeWeekStartDate =
      source.atsWeekStartDate || new Date().toISOString();
  }
  if (!source.programs && source.forgeLifts) {
    return {
      forge: {
        week: source.forgeWeek || 1,
        dayNum: source.forgeDayNum || 1,
        daysPerWeek: source.forgeDaysPerWeek || 3,
        mode: source.forgeMode || 'sets',
        rounding: source.forgeRounding || 2.5,
        weekStartDate: source.forgeWeekStartDate || new Date().toISOString(),
        backExercise: source.forgeBackExercise || 'Barbell Rows',
        backWeight: source.forgeBackWeight || 0,
        lifts: source.forgeLifts,
      },
    };
  }
  return {};
}

function getNormalizedProgramStateMap(profileLike) {
  const sourcePrograms = {
    ...getImportedLegacyProgramMap(profileLike),
    ...(cloneJson(getProfilePrograms(profileLike)) || {}),
  };
  const normalizedProfile = { programs: sourcePrograms };
  normalizeProfileProgramStateMap(normalizedProfile);
  const nextPrograms = {};
  Object.entries(normalizedProfile.programs || {}).forEach(
    ([programId, state]) => {
      const definition = getRegisteredProgramDefinition(programId);
      if (!definition) return;
      let nextState =
        state && typeof state === 'object'
          ? cloneJson(state) || {}
          : cloneJson(
              typeof definition.getInitialState === 'function'
                ? definition.getInitialState()
                : {}
            ) || {};
      if (typeof definition.migrateState === 'function') {
        nextState = definition.migrateState(nextState);
      }
      nextPrograms[definition.id] = nextState;
    }
  );
  return nextPrograms;
}

function createNormalizedProfileCore(profileLike, options) {
  const source =
    profileLike && typeof profileLike === 'object' ? profileLike : {};
  const next = {
    defaultRest: normalizeImportedRestDuration(source.defaultRest),
    language: normalizeImportedLanguage(
      source.language ||
        (window.I18N && I18N.getLanguage ? I18N.getLanguage() : 'en')
    ),
    activeProgram: getCanonicalProgramId(source.activeProgram) || 'forge',
  };
  const preferencesHolder = {
    preferences: cloneJson(source.preferences || {}) || {},
  };
  const coachingHolder = { coaching: cloneJson(source.coaching || {}) || {} };
  const bodyMetricsHolder = {
    bodyMetrics: cloneJson(source.bodyMetrics || {}) || {},
  };
  next.preferences = normalizeTrainingPreferences(preferencesHolder);
  next.coaching = normalizeCoachingProfile(coachingHolder);
  next.bodyMetrics = normalizeBodyMetrics(bodyMetricsHolder);
  if (options?.includeSyncMeta && source.syncMeta) {
    const filteredSyncMeta = filterCoreSyncMeta(cloneJson(source.syncMeta));
    if (filteredSyncMeta) next.syncMeta = filteredSyncMeta;
  }
  return next;
}

function createNormalizedProfileImport(profileLike) {
  const next = createNormalizedProfileCore(profileLike);
  next.programs = getNormalizedProgramStateMap(profileLike);
  const activeProgramDefinition = getRegisteredProgramDefinition(next.activeProgram);
  if (activeProgramDefinition && next.programs[next.activeProgram] === undefined) {
    next.programs[next.activeProgram] =
      cloneJson(
        typeof activeProgramDefinition.getInitialState === 'function'
          ? activeProgramDefinition.getInitialState()
          : {}
      ) || {};
  }
  if (!activeProgramDefinition) {
    const fallbackProgramId = Object.keys(next.programs)[0] || 'forge';
    next.activeProgram = getCanonicalProgramId(fallbackProgramId) || 'forge';
  }
  cleanupLegacyProfileFields(next);
  return next;
}

function createNormalizedSchedulePayload(scheduleLike) {
  const source =
    scheduleLike && typeof scheduleLike === 'object' ? scheduleLike : {};
  const next = {
    sportName: source.sportName,
    sportDays: Array.isArray(source.sportDays)
      ? [...source.sportDays]
      : Array.isArray(source.hockeyDays)
        ? [...source.hockeyDays]
        : [],
    sportIntensity: source.sportIntensity,
    sportLegsHeavy: source.sportLegsHeavy,
  };
  normalizeScheduleState(next);
  return next;
}

function getProfileCorePayload(profileLike) {
  return createNormalizedProfileCore(profileLike, { includeSyncMeta: true });
}

function getDocumentPayload(docKey, profileLike, scheduleLike) {
  if (docKey === PROFILE_CORE_DOC_KEY)
    return getProfileCorePayload(profileLike);
  if (docKey === SCHEDULE_DOC_KEY)
    return createNormalizedSchedulePayload(scheduleLike);
  const programId = programIdFromDocKey(docKey);
  if (programId) {
    const state = getNormalizedProgramStateMap(profileLike)[programId];
    return state === undefined ? undefined : cloneJson(state) || {};
  }
  return undefined;
}

function loadSyncStateCache(options) {
  const userId = getLocalCacheUserId(options?.userId);
  if (!userId) {
    syncStateCache = createDefaultSyncStateCache();
    return syncStateCache;
  }
  syncStateCache = normalizeSyncStateCache(
    readLocalCacheJson(
      getLocalCacheKey(LOCAL_CACHE_KEYS.syncState, userId),
      'sync state'
    )
  );
  return syncStateCache;
}

function persistSyncStateCache() {
  const userId = getLocalCacheUserId();
  if (!userId) return;
  syncStateCache = normalizeSyncStateCache(syncStateCache);
  writeLocalCacheJson(
    getLocalCacheKey(LOCAL_CACHE_KEYS.syncState, userId),
    syncStateCache,
    'sync state'
  );
}

function loadActiveWorkoutDraftCache(options) {
  const userId = getLocalCacheUserId(options?.userId);
  if (!userId) {
    activeWorkoutDraftCache = null;
    return null;
  }
  const draft = readLocalCacheJson(
    getLocalCacheKey(LOCAL_CACHE_KEYS.activeWorkout, userId),
    'active workout draft'
  );
  activeWorkoutDraftCache = draft && typeof draft === 'object' ? draft : null;
  return activeWorkoutDraftCache;
}

function getActiveWorkoutDraftCache() {
  return activeWorkoutDraftCache && typeof activeWorkoutDraftCache === 'object'
    ? cloneJson(activeWorkoutDraftCache)
    : null;
}

function persistActiveWorkoutDraft() {
  const userId = getLocalCacheUserId();
  if (!userId) return;
  if (!activeWorkout || typeof activeWorkout !== 'object') {
    clearActiveWorkoutDraft();
    return;
  }
  activeWorkoutDraftCache = {
    activeWorkout: cloneJson(activeWorkout),
    startTime: activeWorkout.startTime || Date.now(),
    restDuration: restDuration || 0,
    restTotal: restTotal || 0,
    restEndsAt: restEndsAt || 0,
  };
  writeLocalCacheJson(
    getLocalCacheKey(LOCAL_CACHE_KEYS.activeWorkout, userId),
    activeWorkoutDraftCache,
    'active workout draft'
  );
}

function clearActiveWorkoutDraft(options) {
  activeWorkoutDraftCache = null;
  const userId = getLocalCacheUserId(options?.userId);
  if (!userId) return;
  removeLocalCacheKeys([
    getLocalCacheKey(LOCAL_CACHE_KEYS.activeWorkout, userId),
  ]);
}

function markDocKeysDirty(docKeys) {
  const state = getSyncStateCache();
  const dirty = new Set(state.dirtyDocKeys || []);
  uniqueDocKeys(docKeys).forEach((docKey) => dirty.add(docKey));
  state.dirtyDocKeys = [...dirty];
  syncStateCache = state;
  persistSyncStateCache();
}

function clearDocKeysDirty(docKeys) {
  const state = getSyncStateCache();
  const cleared = new Set(uniqueDocKeys(docKeys));
  state.dirtyDocKeys = (state.dirtyDocKeys || []).filter(
    (docKey) => !cleared.has(docKey)
  );
  syncStateCache = state;
  persistSyncStateCache();
}

function isDocKeyDirty(docKey) {
  return getSyncStateCache().dirtyDocKeys.includes(String(docKey || ''));
}

function isProfileSectionDirty() {
  return getSyncStateCache().dirtyDocKeys.some(
    (docKey) => docKey === PROFILE_CORE_DOC_KEY || isProgramDocKey(docKey)
  );
}

function isScheduleSectionDirty() {
  return isDocKeyDirty(SCHEDULE_DOC_KEY);
}

function getDirtyDocKeys() {
  return uniqueDocKeys(getSyncStateCache().dirtyDocKeys || []);
}

function updateServerDocStamp(docKey, updatedAt) {
  if (!docKey) return;
  const nextStamp = laterIso(
    getSyncStateCache().serverUpdatedAtByDocKey?.[docKey],
    updatedAt
  );
  if (!nextStamp) return;
  const state = getSyncStateCache();
  state.serverUpdatedAtByDocKey[docKey] = nextStamp;
  syncStateCache = state;
  persistSyncStateCache();
}

function updateLegacyProfileStamp(updatedAt) {
  const nextStamp = laterIso(
    getSyncStateCache().legacyProfileUpdatedAt,
    updatedAt
  );
  if (!nextStamp) return;
  const state = getSyncStateCache();
  state.legacyProfileUpdatedAt = nextStamp;
  syncStateCache = state;
  persistSyncStateCache();
}

function recordPulledDocumentServerStamps(rows) {
  (rows || []).forEach((row) => {
    const docKey = String(row?.doc_key || '');
    if (!docKey || isDocKeyDirty(docKey)) return;
    updateServerDocStamp(docKey, row?.updated_at || undefined);
  });
}

function normalizeWorkoutCommentaryValue(workout) {
  if (!workout || typeof workout !== 'object')
    return { commentary: null, changed: false };
  const planningDecision =
    workout.planningDecision && typeof workout.planningDecision === 'object'
      ? workout.planningDecision
      : {};
  const source =
    workout.commentary && typeof workout.commentary === 'object'
      ? workout.commentary
      : null;
  const normalizeEvent = (event) => {
    if (!event) return null;
    if (typeof event === 'string') {
      const text = String(event || '').trim();
      return text ? { code: 'legacy_text', text, params: {} } : null;
    }
    if (typeof event !== 'object') return null;
    const code = String(event.code || '').trim();
    if (!code) return null;
    if (code === 'legacy_text') {
      const text = String(event.text || '').trim();
      return text ? { code, text, params: {} } : null;
    }
    const params =
      event.params && typeof event.params === 'object'
        ? cloneJson(event.params) || {}
        : {};
    return { code, params };
  };
  const normalizeEvents = (list) => {
    const seen = new Set();
    const next = [];
    const items = Array.isArray(list) ? list : list ? [list] : [];
    items.forEach((item) => {
      const normalized = normalizeEvent(item);
      if (!normalized) return;
      const key =
        normalized.code === 'legacy_text'
          ? `legacy:${normalized.text}`
          : `${normalized.code}:${JSON.stringify(normalized.params || {})}`;
      if (seen.has(key)) return;
      seen.add(key);
      next.push(normalized);
    });
    return next;
  };
  const legacyReasons = Array.isArray(workout.adaptationReasons)
    ? workout.adaptationReasons
    : [];
  const decisionCode = String(
    source?.decisionCode ||
      (planningDecision.action === 'rest'
        ? 'rest'
        : planningDecision.action === 'deload'
          ? 'deload'
          : planningDecision.action === 'train_light'
            ? 'train_light'
            : planningDecision.action === 'shorten'
              ? 'shorten'
              : (planningDecision.restrictionFlags || []).includes(
                    'avoid_heavy_legs'
                  )
                ? 'sport_aware'
                : 'train')
  );
  const commentary = {
    version: 1,
    decisionCode,
    reasonCodes: [
      ...new Set(
        [
          ...(Array.isArray(source?.reasonCodes) ? source.reasonCodes : []),
          ...(planningDecision.reasonCodes || []),
        ].filter(Boolean)
      ),
    ],
    restrictionFlags: [
      ...new Set(
        [
          ...(Array.isArray(source?.restrictionFlags)
            ? source.restrictionFlags
            : []),
          ...(planningDecision.restrictionFlags || []),
        ].filter(Boolean)
      ),
    ],
    adaptationEvents: normalizeEvents(
      source?.adaptationEvents || (legacyReasons.length ? legacyReasons : [])
    ),
    equipmentHint: normalizeEvent(source?.equipmentHint),
    runnerEvents: normalizeEvents(source?.runnerEvents || []),
  };
  const changed =
    JSON.stringify(commentary) !== JSON.stringify(source || null) ||
    'adaptationReasons' in workout;
  return { commentary, changed };
}

function getAllProfileDocumentKeys(profileLike) {
  return uniqueDocKeys([
    PROFILE_CORE_DOC_KEY,
    SCHEDULE_DOC_KEY,
    ...listProgramIds(profileLike).map(programDocKey),
  ]);
}

function getDefaultTrainingPreferences() {
  return {
    goal: 'strength',
    trainingDaysPerWeek: 3,
    sessionMinutes: 60,
    equipmentAccess: 'full_gym',
    sportReadinessCheckEnabled: false,
    warmupSetsEnabled: false,
    notes: '',
  };
}

function normalizeTrainingPreferences(profileLike) {
  if (!profileLike || typeof profileLike !== 'object')
    return getDefaultTrainingPreferences();
  const defaults = getDefaultTrainingPreferences();
  const next = { ...defaults, ...(profileLike.preferences || {}) };
  const allowedGoals = new Set([
    'strength',
    'hypertrophy',
    'general_fitness',
    'sport_support',
  ]);
  const allowedEquipment = new Set([
    'full_gym',
    'basic_gym',
    'home_gym',
    'minimal',
  ]);
  const allowedTrainingDays = new Set([2, 3, 4, 5, 6]);
  const allowedMinutes = new Set([30, 45, 60, 75, 90]);
  if (!allowedGoals.has(next.goal)) next.goal = defaults.goal;
  if (!allowedEquipment.has(next.equipmentAccess))
    next.equipmentAccess = defaults.equipmentAccess;
  const trainingDays = parseInt(next.trainingDaysPerWeek, 10);
  next.trainingDaysPerWeek = allowedTrainingDays.has(trainingDays)
    ? trainingDays
    : defaults.trainingDaysPerWeek;
  const minutes = parseInt(next.sessionMinutes, 10);
  next.sessionMinutes = allowedMinutes.has(minutes)
    ? minutes
    : defaults.sessionMinutes;
  next.sportReadinessCheckEnabled = next.sportReadinessCheckEnabled === true;
  next.warmupSetsEnabled = next.warmupSetsEnabled === true;
  if (next.detailedView === true || next.detailedView === false) {
    next.detailedView = next.detailedView;
  } else {
    delete next.detailedView;
  }
  next.notes = String(next.notes || '')
    .trim()
    .slice(0, 500);
  profileLike.preferences = next;
  return next;
}

function getDefaultBodyMetrics() {
  return {
    sex: null,
    activityLevel: null,
    weight: null,
    height: null,
    age: null,
    targetWeight: null,
    bodyGoal: null,
  };
}

function normalizeBodyMetricNumber(value, min, max, options) {
  const opts = options || {};
  if (value === undefined || value === null || value === '') return null;
  const cleaned = String(value)
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  if (!/[0-9]/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  const clamped = Math.max(min, Math.min(max, parsed));
  return opts.integer === true ? Math.round(clamped) : clamped;
}

function normalizeBodyMetrics(profileLike) {
  if (!profileLike || typeof profileLike !== 'object')
    return getDefaultBodyMetrics();
  const defaults = getDefaultBodyMetrics();
  const incoming =
    profileLike.bodyMetrics && typeof profileLike.bodyMetrics === 'object'
      ? profileLike.bodyMetrics
      : {};
  const next = { ...defaults, ...incoming };
  const allowedSex = new Set(['male', 'female']);
  const allowedActivityLevels = new Set([
    'sedentary',
    'light',
    'moderate',
    'very_active',
  ]);
  const allowedGoals = new Set([
    'lose_fat',
    'gain_muscle',
    'recomp',
    'maintain',
  ]);
  next.sex = allowedSex.has(String(next.sex || '')) ? String(next.sex) : null;
  next.activityLevel = allowedActivityLevels.has(
    String(next.activityLevel || '')
  )
    ? String(next.activityLevel)
    : null;
  next.weight = normalizeBodyMetricNumber(next.weight, 30, 300);
  next.height = normalizeBodyMetricNumber(next.height, 100, 250);
  next.age = normalizeBodyMetricNumber(next.age, 10, 100, { integer: true });
  next.targetWeight = normalizeBodyMetricNumber(next.targetWeight, 30, 300);
  next.bodyGoal = allowedGoals.has(String(next.bodyGoal || ''))
    ? String(next.bodyGoal)
    : null;
  profileLike.bodyMetrics = next;
  return next;
}

function getDefaultCoachingProfile() {
  return {
    experienceLevel: 'returning',
    guidanceMode: 'balanced',
    sportProfile: {
      name: '',
      inSeason: false,
      sessionsPerWeek: 0,
    },
    limitations: {
      jointFlags: [],
      avoidMovementTags: [],
      avoidExerciseIds: [],
    },
    exercisePreferences: {
      preferredExerciseIds: [],
      excludedExerciseIds: [],
    },
    behaviorSignals: {
      avoidedExerciseIds: [],
      skippedAccessoryExerciseIds: [],
      preferredSwapExerciseIds: [],
    },
    onboardingCompleted: false,
    onboardingSeen: false,
  };
}

function normalizeCoachingProfile(profileLike) {
  if (!profileLike || typeof profileLike !== 'object')
    return getDefaultCoachingProfile();
  const defaults = getDefaultCoachingProfile();
  const incoming =
    profileLike.coaching && typeof profileLike.coaching === 'object'
      ? profileLike.coaching
      : {};
  const next = {
    ...defaults,
    ...incoming,
    sportProfile: {
      ...defaults.sportProfile,
      ...(incoming.sportProfile || {}),
    },
    limitations: {
      ...defaults.limitations,
      ...(incoming.limitations || {}),
    },
    exercisePreferences: {
      ...defaults.exercisePreferences,
      ...(incoming.exercisePreferences || {}),
    },
    behaviorSignals: {
      ...defaults.behaviorSignals,
      ...(incoming.behaviorSignals || {}),
    },
  };
  const allowedExperience = new Set([
    'beginner',
    'returning',
    'intermediate',
    'advanced',
  ]);
  const allowedGuidance = new Set(['guided', 'balanced', 'self_directed']);
  if (!allowedExperience.has(next.experienceLevel))
    next.experienceLevel = defaults.experienceLevel;
  if (!allowedGuidance.has(next.guidanceMode))
    next.guidanceMode = defaults.guidanceMode;
  next.sportProfile.name = String(next.sportProfile.name || '')
    .trim()
    .slice(0, 60);
  next.sportProfile.inSeason = next.sportProfile.inSeason === true;
  const sportSessions = parseInt(next.sportProfile.sessionsPerWeek, 10);
  next.sportProfile.sessionsPerWeek = Number.isFinite(sportSessions)
    ? Math.max(0, Math.min(7, sportSessions))
    : 0;
  next.limitations.jointFlags = [
    ...new Set(
      arrayifyProfileValue(next.limitations.jointFlags)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.limitations.avoidMovementTags = [
    ...new Set(
      arrayifyProfileValue(next.limitations.avoidMovementTags)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.limitations.avoidExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.limitations.avoidExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.exercisePreferences.preferredExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.exercisePreferences.preferredExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.exercisePreferences.excludedExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.exercisePreferences.excludedExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.behaviorSignals.avoidedExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.behaviorSignals.avoidedExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.behaviorSignals.skippedAccessoryExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.behaviorSignals.skippedAccessoryExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.behaviorSignals.preferredSwapExerciseIds = [
    ...new Set(
      arrayifyProfileValue(next.behaviorSignals.preferredSwapExerciseIds)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
  next.onboardingCompleted = next.onboardingCompleted === true;
  next.onboardingSeen =
    next.onboardingSeen === true || incoming.onboardingDismissed === true;
  if ('onboardingDismissed' in next) delete next.onboardingDismissed;
  profileLike.coaching = next;
  return next;
}

/**
 * Returns true when the UI should show a simplified, less jargon-heavy view.
 * Driven by onboarding answers (guidanceMode + experienceLevel) with an
 * explicit override via profile.preferences.detailedView.
 */
function isSimpleMode(profileLike) {
  if (!profileLike || typeof profileLike !== 'object') return false;
  const prefs = profileLike.preferences || {};
  if (prefs.detailedView === true) return false;
  if (prefs.detailedView === false) return true;
  const coaching = profileLike.coaching || {};
  const mode = coaching.guidanceMode || 'balanced';
  const level = coaching.experienceLevel || 'returning';
  return mode === 'guided' || (mode === 'balanced' && level === 'beginner');
}

function getTrainingGoalLabel(goal) {
  const map = {
    strength: ['settings.preferences.goal.strength', 'Strength'],
    hypertrophy: ['settings.preferences.goal.hypertrophy', 'Hypertrophy'],
    general_fitness: [
      'settings.preferences.goal.general_fitness',
      'General Fitness',
    ],
    sport_support: ['settings.preferences.goal.sport_support', 'Sport Support'],
  };
  const [key, fallback] = map[goal] || map.strength;
  return window.I18N && I18N.t ? I18N.t(key, null, fallback) : fallback;
}

function getEquipmentAccessLabel(value) {
  const map = {
    full_gym: ['settings.preferences.equipment.full_gym', 'Full Gym'],
    basic_gym: ['settings.preferences.equipment.basic_gym', 'Basic Gym'],
    home_gym: ['settings.preferences.equipment.home_gym', 'Home Gym'],
    minimal: ['settings.preferences.equipment.minimal', 'Minimal Equipment'],
  };
  const [key, fallback] = map[value] || map.full_gym;
  return window.I18N && I18N.t ? I18N.t(key, null, fallback) : fallback;
}

function getTrainingPreferencesSummary(profileLike) {
  const prefs = normalizeTrainingPreferences(profileLike || profile || {});
  const goal = getTrainingGoalLabel(prefs.goal);
  const days = getTrainingDaysPerWeekLabel(prefs.trainingDaysPerWeek);
  const minutes =
    window.I18N && I18N.t
      ? I18N.t(
          'settings.preferences.duration_value',
          { minutes: prefs.sessionMinutes },
          '{minutes} min'
        )
      : prefs.sessionMinutes + ' min';
  const equipment = getEquipmentAccessLabel(prefs.equipmentAccess);
  const fallback =
    'Goal: ' + goal + ' · ' + days + ' · ' + minutes + ' · ' + equipment;
  return window.I18N && I18N.t
    ? I18N.t(
        'dashboard.preferences_context',
        { goal, days, minutes, equipment },
        fallback
      )
    : fallback;
}

function getTrainingDaysPerWeekLabel(value) {
  const count = parseInt(value, 10) || 3;
  return window.I18N && I18N.t
    ? I18N.t(
        'settings.preferences.training_days_value',
        { count },
        '{count} sessions / week'
      )
    : count + ' sessions / week';
}

function getPreferredTrainingDaysPerWeek(profileLike) {
  return normalizeTrainingPreferences(profileLike || profile || {})
    .trainingDaysPerWeek;
}

const PROGRAM_CAPABILITIES = {
  forge: {
    id: 'forge',
    aliases: [],
    difficulty: 'advanced',
    frequencyRange: { min: 2, max: 6 },
    recommendationScore(days, prefs) {
      let score = prefs.goal === 'strength' ? 6 : 2;
      score += days >= 4 ? 2 : 1;
      return score;
    },
  },
  hypertrophysplit: {
    id: 'hypertrophysplit',
    aliases: [],
    difficulty: 'intermediate',
    frequencyRange: { min: 2, max: 6 },
    recommendationScore(days, prefs) {
      let score = prefs.goal === 'hypertrophy' ? 7 : 2;
      score += days >= 4 ? 3 : 1;
      return score;
    },
  },
  wendler531: {
    id: 'wendler531',
    aliases: ['w531'],
    difficulty: 'advanced',
    frequencyRange: { min: 2, max: 4 },
    recommendationScore(days, prefs) {
      let score = prefs.goal === 'strength' ? 7 : 1;
      score += days <= 4 ? 2 : -4;
      return score;
    },
  },
  casualfullbody: {
    id: 'casualfullbody',
    aliases: [],
    difficulty: 'beginner',
    frequencyRange: { min: 2, max: 3 },
    recommendationScore(days, prefs) {
      let score = prefs.goal === 'general_fitness' ? 7 : 0;
      score += prefs.goal === 'sport_support' ? 4 : 0;
      score += days <= 3 ? 3 : -6;
      return score;
    },
  },
  stronglifts5x5: {
    id: 'stronglifts5x5',
    aliases: [],
    difficulty: 'beginner',
    frequencyRange: { min: 3, max: 3 },
    recommendationScore(days, prefs) {
      let score = prefs.goal === 'strength' ? 5 : 1;
      score += days === 3 ? 3 : -8;
      return score;
    },
  },
};

function getCanonicalProgramId(programId) {
  const raw = String(programId || '').trim();
  if (!raw) return raw;
  const direct = PROGRAM_CAPABILITIES[raw];
  if (direct) return direct.id;
  const match = Object.values(PROGRAM_CAPABILITIES).find((cap) =>
    (cap.aliases || []).includes(raw)
  );
  return match ? match.id : raw;
}

function getProgramCapabilities(programId) {
  const canonicalId = getCanonicalProgramId(programId);
  return (
    PROGRAM_CAPABILITIES[canonicalId] || {
      id: canonicalId || String(programId || '').trim(),
      aliases: [],
      difficulty: 'intermediate',
      frequencyRange: { min: 2, max: 6 },
      recommendationScore() {
        return 0;
      },
    }
  );
}

function getProgramDifficultyMeta(programId) {
  const difficultyKey = String(
    getProgramCapabilities(programId).difficulty || 'intermediate'
  );
  const normalizedKey = ['beginner', 'intermediate', 'advanced'].includes(
    difficultyKey
  )
    ? difficultyKey
    : 'intermediate';
  return {
    key: normalizedKey,
    labelKey: 'program.difficulty.' + normalizedKey,
    fallback:
      normalizedKey === 'beginner'
        ? 'Beginner-friendly'
        : normalizedKey === 'intermediate'
          ? 'Intermediate'
          : 'Advanced',
  };
}

function getProgramTrainingDaysRange(programId) {
  const range = getProgramCapabilities(programId).frequencyRange || {
    min: 2,
    max: 6,
  };
  return { min: range.min, max: range.max };
}

function getEffectiveProgramFrequency(programId, profileLike) {
  const preferred = getPreferredTrainingDaysPerWeek(profileLike);
  const { min, max } = getProgramTrainingDaysRange(programId);
  return Math.max(min, Math.min(max, preferred));
}

function getProgramTrainingDaysPerWeek(programId, profileLike) {
  return getEffectiveProgramFrequency(programId, profileLike);
}

function normalizeProfileProgramStateMap(profileLike) {
  if (!profileLike || typeof profileLike !== 'object') return profileLike;
  if (!profileLike.programs || typeof profileLike.programs !== 'object')
    return profileLike;
  const normalized = {};
  Object.entries(profileLike.programs).forEach(([programId, state]) => {
    const canonicalId = getCanonicalProgramId(programId);
    const isCanonicalKey = canonicalId === programId;
    if (normalized[canonicalId] === undefined) {
      normalized[canonicalId] = state;
      return;
    }
    if (
      normalized[canonicalId] &&
      typeof normalized[canonicalId] === 'object' &&
      state &&
      typeof state === 'object'
    ) {
      normalized[canonicalId] = isCanonicalKey
        ? { ...normalized[canonicalId], ...state }
        : { ...state, ...normalized[canonicalId] };
      return;
    }
    if (isCanonicalKey) normalized[canonicalId] = state;
  });
  profileLike.programs = normalized;
  return profileLike;
}

function sanitizeWorkoutTextValue(value, maxLength) {
  if (value === undefined || value === null) return '';
  const limit = Math.max(0, parseInt(maxLength, 10) || 0);
  const cleaned = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim();
  return limit > 0 ? cleaned.slice(0, limit) : cleaned;
}

const MAX_IMPORTED_BACKUP_BYTES = 5 * 1024 * 1024;

function getImportedBackupMaxBytes() {
  return MAX_IMPORTED_BACKUP_BYTES;
}

function isValidImportedWorkoutDate(value) {
  const normalized = sanitizeWorkoutTextValue(value, 64);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}T/.test(normalized)) return false;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed);
}

function sanitizeWorkoutIdValue(value) {
  const normalized = sanitizeWorkoutTextValue(value, 120).replace(
    /[^a-zA-Z0-9:_-]/g,
    '_'
  );
  return normalized || 'workout';
}

function sanitizeWorkoutMetaValue(value) {
  if (value === undefined || value === null) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return sanitizeWorkoutTextValue(value, 120);
}

function sanitizeOptionalWorkoutNumber(value, options) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const min = Number.isFinite(options?.min) ? options.min : parsed;
  const max = Number.isFinite(options?.max) ? options.max : parsed;
  const clamped = Math.max(min, Math.min(max, parsed));
  return options?.integer === true ? Math.round(clamped) : clamped;
}

function createImportedWorkoutSetRecord(set) {
  if (!set || typeof set !== 'object') return null;
  const next = {};
  if ('weight' in set) next.weight = set.weight;
  if ('reps' in set) next.reps = set.reps;
  if ('done' in set) next.done = set.done === true;
  if ('isWarmup' in set) next.isWarmup = set.isWarmup === true;
  if ('isAmrap' in set) next.isAmrap = set.isAmrap === true;
  if ('isPr' in set) next.isPr = set.isPr === true;
  if ('isLastHeavySet' in set) next.isLastHeavySet = set.isLastHeavySet === true;
  if ('rir' in set) next.rir = sanitizeWorkoutTextValue(set.rir, 12);
  if ('rirTarget' in set) next.rirTarget = set.rirTarget;
  return sanitizeWorkoutSetRecord(next);
}

function createImportedWorkoutExerciseRecord(exercise) {
  if (!exercise || typeof exercise !== 'object') return null;
  const sets = Array.isArray(exercise.sets)
    ? exercise.sets.map(createImportedWorkoutSetRecord)
    : [];
  if (sets.some((set) => !set)) return null;
  const next = {
    name: exercise.name,
    sets,
  };
  if ('exerciseId' in exercise) next.exerciseId = exercise.exerciseId;
  if ('notes' in exercise) next.notes = exercise.notes;
  if ('isAux' in exercise) next.isAux = exercise.isAux === true;
  if ('isAccessory' in exercise) next.isAccessory = exercise.isAccessory === true;
  return sanitizeWorkoutExerciseRecord(next);
}

function createImportedWorkoutRecord(workout) {
  if (
    !workout ||
    typeof workout !== 'object' ||
    !('id' in workout) ||
    !('date' in workout) ||
    !('type' in workout) ||
    !Array.isArray(workout.exercises)
  ) {
    return null;
  }
  const exercises = workout.exercises.map(createImportedWorkoutExerciseRecord);
  if (exercises.some((exercise) => !exercise)) return null;
  const next = {
    id: workout.id,
    date: workout.date,
    type: workout.type,
    exercises,
  };
  if ('subtype' in workout) next.subtype = workout.subtype;
  if ('program' in workout) next.program = workout.program;
  if ('name' in workout) next.name = workout.name;
  if ('programLabel' in workout) next.programLabel = workout.programLabel;
  if ('sessionDescription' in workout)
    next.sessionDescription = workout.sessionDescription;
  if ('sessionNotes' in workout) next.sessionNotes = workout.sessionNotes;
  if ('programDayNum' in workout) {
    const programDayNum = sanitizeOptionalWorkoutNumber(workout.programDayNum, {
      min: 0,
      max: 365,
      integer: true,
    });
    if (programDayNum !== undefined) next.programDayNum = programDayNum;
  }
  if ('duration' in workout) {
    const duration = sanitizeOptionalWorkoutNumber(workout.duration, {
      min: 0,
      max: 86400,
      integer: true,
    });
    if (duration !== undefined) next.duration = duration;
  }
  if ('rpe' in workout) {
    const rpe = sanitizeOptionalWorkoutNumber(workout.rpe, {
      min: 0,
      max: 10,
    });
    if (rpe !== undefined) next.rpe = rpe;
  }
  ['completedAt', 'startedAt', 'createdAt', 'updatedAt', 'deletedAt'].forEach(
    (field) => {
      if (field in workout) next[field] = sanitizeWorkoutTextValue(workout[field], 64);
    }
  );
  if ('isDraft' in workout) next.isDraft = workout.isDraft === true;
  if (workout.programMeta && typeof workout.programMeta === 'object') {
    next.programMeta = {};
    Object.keys(workout.programMeta).forEach((key) => {
      next.programMeta[key] = sanitizeWorkoutMetaValue(workout.programMeta[key]);
    });
  }
  const commentaryResult = normalizeWorkoutCommentaryValue({
    commentary: workout.commentary,
    adaptationReasons: workout.adaptationReasons,
  });
  if (commentaryResult.commentary) next.commentary = commentaryResult.commentary;
  const normalized = normalizeWorkoutRecord(next);
  if (!isValidImportedWorkoutDate(normalized?.date)) return null;
  return normalized;
}

function sanitizeWorkoutSetRecord(set) {
  if (!set || typeof set !== 'object') return set;
  if ('weight' in set) set.weight = sanitizeWorkoutTextValue(set.weight, 24);
  if ('reps' in set) set.reps = sanitizeWorkoutTextValue(set.reps, 24);
  if ('done' in set) set.done = set.done === true;
  if ('isWarmup' in set) set.isWarmup = set.isWarmup === true;
  if ('isAmrap' in set) set.isAmrap = set.isAmrap === true;
  if ('isPr' in set) set.isPr = set.isPr === true;
  if ('isLastHeavySet' in set) set.isLastHeavySet = set.isLastHeavySet === true;
  if (
    'rirTarget' in set &&
    set.rirTarget !== undefined &&
    set.rirTarget !== null
  ) {
    const rirTarget = parseFloat(set.rirTarget);
    set.rirTarget = Number.isFinite(rirTarget) ? rirTarget : null;
  }
  return set;
}

function sanitizeWorkoutExerciseRecord(exercise) {
  if (!exercise || typeof exercise !== 'object') return exercise;
  if ('name' in exercise)
    exercise.name = sanitizeWorkoutTextValue(exercise.name, 160);
  if (
    'exerciseId' in exercise &&
    exercise.exerciseId !== undefined &&
    exercise.exerciseId !== null
  ) {
    exercise.exerciseId = sanitizeWorkoutTextValue(exercise.exerciseId, 120);
  }
  if ('notes' in exercise)
    exercise.notes = sanitizeWorkoutTextValue(exercise.notes, 500);
  if ('isAux' in exercise) exercise.isAux = exercise.isAux === true;
  if ('isAccessory' in exercise)
    exercise.isAccessory = exercise.isAccessory === true;
  if (Array.isArray(exercise.sets))
    exercise.sets = exercise.sets.map(sanitizeWorkoutSetRecord);
  else exercise.sets = [];
  return exercise;
}

function normalizeWorkoutRecord(workout) {
  if (!workout || typeof workout !== 'object') return workout;
  let changed = false;
  const sanitizeStringField = (field, maxLength) => {
    if (!(field in workout)) return;
    const nextValue = sanitizeWorkoutTextValue(workout[field], maxLength);
    if (workout[field] !== nextValue) {
      workout[field] = nextValue;
      changed = true;
    }
  };
  sanitizeStringField('type', 48);
  sanitizeStringField('subtype', 48);
  sanitizeStringField('program', 48);
  sanitizeStringField('name', 160);
  sanitizeStringField('programLabel', 160);
  sanitizeStringField('sessionDescription', 280);
  sanitizeStringField('sessionNotes', 1000);
  if ('id' in workout) {
    const nextId = sanitizeWorkoutIdValue(workout.id);
    if (String(workout.id) !== nextId) {
      workout.id = nextId;
      changed = true;
    }
  }
  if ('date' in workout) {
    const nextDate = sanitizeWorkoutTextValue(workout.date, 64);
    if (workout.date !== nextDate) {
      workout.date = nextDate;
      changed = true;
    }
  }
  if (Array.isArray(workout.exercises)) {
    const beforeExercises = JSON.stringify(workout.exercises);
    workout.exercises = workout.exercises.map(sanitizeWorkoutExerciseRecord);
    if (JSON.stringify(workout.exercises) !== beforeExercises) changed = true;
  } else if (workout.exercises !== undefined) {
    workout.exercises = [];
    changed = true;
  }
  if (workout.programMeta && typeof workout.programMeta === 'object') {
    const beforeMeta = JSON.stringify(workout.programMeta);
    Object.keys(workout.programMeta).forEach((key) => {
      workout.programMeta[key] = sanitizeWorkoutMetaValue(
        workout.programMeta[key]
      );
    });
    if (JSON.stringify(workout.programMeta) !== beforeMeta) changed = true;
  }
  if (
    !workout.program &&
    workout.type &&
    workout.type !== 'hockey' &&
    workout.type !== 'sport'
  ) {
    workout.program = workout.type;
    changed = true;
  }
  if (
    (workout.forgeWeek !== undefined && workout.forgeWeek !== null) ||
    workout.programMeta
  ) {
    const beforeMeta = JSON.stringify(workout.programMeta || {});
    const meta = { ...(workout.programMeta || {}) };
    if (
      meta.week === undefined &&
      workout.forgeWeek !== undefined &&
      workout.forgeWeek !== null
    ) {
      meta.week = workout.forgeWeek;
    }
    workout.programMeta = meta;
    if (JSON.stringify(meta) !== beforeMeta) changed = true;
  }
  if (
    (workout.programDayNum === undefined || workout.programDayNum === null) &&
    workout.forgeDayNum !== undefined &&
    workout.forgeDayNum !== null
  ) {
    workout.programDayNum = workout.forgeDayNum;
    changed = true;
  }
  const canonicalProgramId = getCanonicalProgramId(workout.program);
  if (canonicalProgramId && canonicalProgramId !== workout.program) {
    workout.program = canonicalProgramId;
    changed = true;
  }
  if (workout.type && workout.type !== 'hockey' && workout.type !== 'sport') {
    const canonicalTypeId = getCanonicalProgramId(workout.type);
    if (canonicalTypeId && canonicalTypeId !== workout.type) {
      workout.type = canonicalTypeId;
      changed = true;
    }
  }
  const commentaryResult = normalizeWorkoutCommentaryValue(workout);
  if (commentaryResult.commentary) {
    workout.commentary = commentaryResult.commentary;
    if (commentaryResult.changed) changed = true;
  }
  if ('forgeWeek' in workout) {
    delete workout.forgeWeek;
    changed = true;
  }
  if ('forgeDayNum' in workout) {
    delete workout.forgeDayNum;
    changed = true;
  }
  if ('adaptationReasons' in workout) {
    delete workout.adaptationReasons;
    changed = true;
  }
  return changed ? workout : workout;
}

function normalizeWorkoutRecords(items) {
  let changed = false;
  const normalized = (items || []).map((workout) => {
    const before = JSON.stringify(workout);
    const next = normalizeWorkoutRecord(workout);
    if (JSON.stringify(next) !== before) changed = true;
    return next;
  });
  return { items: normalized, changed };
}

function validateImportedBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      errorKey: 'import.invalid_file',
      fallback: 'Invalid backup file',
    };
  }
  const allowedTopLevelKeys = new Set([
    'version',
    'exported',
    'workouts',
    'schedule',
    'profile',
  ]);
  const unknownKeys = Object.keys(data).filter(
    (key) => !allowedTopLevelKeys.has(key)
  );
  if (unknownKeys.length) {
    return {
      ok: false,
      errorKey: 'import.unsupported_sections',
      fallback: 'Backup file contains unsupported sections',
    };
  }
  if (
    !('workouts' in data) &&
    !('schedule' in data) &&
    !('profile' in data)
  ) {
    return {
      ok: false,
      errorKey: 'import.invalid_file',
      fallback: 'Invalid backup file',
    };
  }
  const next = {
    version:
      typeof data.version === 'number' && Number.isFinite(data.version)
        ? data.version
        : 1,
    exported: sanitizeWorkoutTextValue(data.exported, 64),
  };
  if ('workouts' in data) {
    if (!Array.isArray(data.workouts)) {
      return {
        ok: false,
        errorKey: 'import.invalid_workout_data',
        fallback: 'Backup file has invalid workout data',
      };
    }
    const workouts = data.workouts.map(createImportedWorkoutRecord);
    if (workouts.some((workout) => !workout)) {
      return {
        ok: false,
        errorKey: 'import.malformed_entries',
        fallback: 'Backup file has malformed workout entries',
      };
    }
    const seenWorkoutIds = new Set();
    for (const workout of workouts) {
      if (!isValidImportedWorkoutDate(workout.date)) {
        return {
          ok: false,
          errorKey: 'import.invalid_workout_dates',
          fallback: 'Backup file has invalid workout dates',
        };
      }
      if (seenWorkoutIds.has(workout.id)) {
        return {
          ok: false,
          errorKey: 'import.duplicate_workout_ids',
          fallback: 'Backup file contains duplicate workout IDs',
        };
      }
      seenWorkoutIds.add(workout.id);
    }
    next.workouts = workouts;
  }
  if ('schedule' in data) {
    if (!data.schedule || typeof data.schedule !== 'object' || Array.isArray(data.schedule)) {
      return {
        ok: false,
        errorKey: 'import.invalid_schedule_data',
        fallback: 'Backup file has invalid schedule data',
      };
    }
    next.schedule = createNormalizedSchedulePayload(data.schedule);
  }
  if ('profile' in data) {
    if (!data.profile || typeof data.profile !== 'object' || Array.isArray(data.profile)) {
      return {
        ok: false,
        errorKey: 'import.invalid_profile_data',
        fallback: 'Backup file has invalid profile data',
      };
    }
    next.profile = createNormalizedProfileImport(data.profile);
  }
  return { ok: true, value: next };
}

function normalizeScheduleState(scheduleLike) {
  if (!scheduleLike || typeof scheduleLike !== 'object') return scheduleLike;
  if (isLegacyDefaultSportName(scheduleLike.sportName))
    scheduleLike.sportName = getDefaultSportName();
  scheduleLike.sportName =
    sanitizeWorkoutTextValue(scheduleLike.sportName || '', 60) || '';
  scheduleLike.sportDays = Array.isArray(scheduleLike.sportDays)
    ? [
        ...new Set(
          scheduleLike.sportDays
            .map((day) => parseInt(day, 10))
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        ),
      ]
    : [];
  if (
    !['easy', 'moderate', 'hard'].includes(
      String(scheduleLike.sportIntensity || '')
    )
  ) {
    scheduleLike.sportIntensity = 'hard';
  }
  scheduleLike.sportLegsHeavy = scheduleLike.sportLegsHeavy !== false;
  return scheduleLike;
}

function isWorkoutTableReady(profileLike) {
  return !!(
    profileLike &&
    profileLike.syncMeta &&
    profileLike.syncMeta.workoutsTableReady
  );
}

function cleanupLegacyProfileFields(profileLike) {
  if (!profileLike || typeof profileLike !== 'object') return profileLike;
  const legacyKeys = [
    'atsLifts',
    'atsWeek',
    'atsRounding',
    'atsDaysPerWeek',
    'atsDayNum',
    'atsBackExercise',
    'atsBackWeight',
    'atsMode',
    'atsWeekStartDate',
    'forgeLifts',
    'forgeWeek',
    'forgeRounding',
    'forgeDaysPerWeek',
    'forgeDayNum',
    'forgeBackExercise',
    'forgeBackWeight',
    'forgeMode',
    'forgeWeekStartDate',
  ];
  legacyKeys.forEach((key) => {
    if (key in profileLike) delete profileLike[key];
  });
  return profileLike;
}

function persistLocalWorkoutsCache() {
  const userId = getLocalCacheUserId();
  if (!userId) return;
  writeLocalCacheJson(
    getLocalCacheKey(LOCAL_CACHE_KEYS.workouts, userId),
    workouts,
    'workouts'
  );
}

function persistLocalScheduleCache() {
  const userId = getLocalCacheUserId();
  if (!userId) return;
  writeLocalCacheJson(
    getLocalCacheKey(LOCAL_CACHE_KEYS.schedule, userId),
    schedule,
    'schedule'
  );
}

function persistLocalProfileCache() {
  const userId = getLocalCacheUserId();
  if (!userId) return;
  writeLocalCacheJson(
    getLocalCacheKey(LOCAL_CACHE_KEYS.profile, userId),
    profile,
    'profile'
  );
}

function ensureProfileSyncMeta() {
  if (!profile || typeof profile !== 'object') profile = {};
  if (!profile.syncMeta || typeof profile.syncMeta !== 'object')
    profile.syncMeta = {};
  return profile.syncMeta;
}

function ensureProgramSyncMeta(profileLike) {
  const target =
    profileLike && typeof profileLike === 'object' ? profileLike : profile;
  if (!target || typeof target !== 'object') return {};
  if (!target.syncMeta || typeof target.syncMeta !== 'object')
    target.syncMeta = {};
  if (
    !target.syncMeta.programUpdatedAt ||
    typeof target.syncMeta.programUpdatedAt !== 'object'
  )
    target.syncMeta.programUpdatedAt = {};
  return target.syncMeta.programUpdatedAt;
}

function parseSyncStamp(value) {
  const ts = Date.parse(String(value || ''));
  return Number.isFinite(ts) ? ts : 0;
}

function laterIso(a, b) {
  const at = parseSyncStamp(a),
    bt = parseSyncStamp(b);
  if (at === 0 && bt === 0) return undefined;
  return at >= bt
    ? a || new Date(at).toISOString()
    : b || new Date(bt).toISOString();
}

function getDocumentUpdatedAt(row) {
  if (!row || typeof row !== 'object') return undefined;
  return row.client_updated_at || row.updated_at || undefined;
}

function mergeSyncMeta(localMeta, remoteMeta) {
  const merged = { ...(remoteMeta || {}), ...(localMeta || {}) };
  const profileUpdatedAt = laterIso(
    localMeta?.profileUpdatedAt,
    remoteMeta?.profileUpdatedAt
  );
  const scheduleUpdatedAt = laterIso(
    localMeta?.scheduleUpdatedAt,
    remoteMeta?.scheduleUpdatedAt
  );
  if (profileUpdatedAt) merged.profileUpdatedAt = profileUpdatedAt;
  if (scheduleUpdatedAt) merged.scheduleUpdatedAt = scheduleUpdatedAt;
  const programIds = new Set([
    ...Object.keys(localMeta?.programUpdatedAt || {}),
    ...Object.keys(remoteMeta?.programUpdatedAt || {}),
  ]);
  if (programIds.size) {
    merged.programUpdatedAt = {};
    programIds.forEach((programId) => {
      const next = laterIso(
        localMeta?.programUpdatedAt?.[programId],
        remoteMeta?.programUpdatedAt?.[programId]
      );
      if (next) merged.programUpdatedAt[programId] = next;
    });
    if (!Object.keys(merged.programUpdatedAt).length)
      delete merged.programUpdatedAt;
  }
  if (
    (localMeta && 'workoutsTableReady' in localMeta) ||
    (remoteMeta && 'workoutsTableReady' in remoteMeta)
  ) {
    merged.workoutsTableReady = !!(
      localMeta?.workoutsTableReady || remoteMeta?.workoutsTableReady
    );
  }
  return merged;
}

function shouldUseRemoteSection(localUpdatedAt, remoteUpdatedAt, options) {
  const opts = options || {};
  const localStamp = parseSyncStamp(localUpdatedAt);
  const remoteStamp = parseSyncStamp(remoteUpdatedAt);
  if (remoteStamp === 0 && localStamp === 0)
    return opts.preferRemoteWhenUnset === true;
  if (remoteStamp === 0) return false;
  if (localStamp === 0) return true;
  return remoteStamp >= localStamp;
}

function chooseNewerSection(
  localValue,
  remoteValue,
  localProfileLike,
  remoteProfileLike,
  syncKey,
  options
) {
  const opts = options || {};
  if (remoteValue === undefined) return localValue;
  if (syncKey === 'profileUpdatedAt' && isProfileSectionDirty())
    return localValue;
  if (syncKey === 'scheduleUpdatedAt' && isScheduleSectionDirty())
    return localValue;
  if (opts.preferRemoteWhenUnset && localValue === undefined)
    return remoteValue;
  const localUpdatedAt = localProfileLike?.syncMeta?.[syncKey];
  const remoteUpdatedAt = remoteProfileLike?.syncMeta?.[syncKey];
  return shouldUseRemoteSection(localUpdatedAt, remoteUpdatedAt, opts)
    ? remoteValue
    : localValue;
}

function touchSectionSync(syncKey) {
  ensureProfileSyncMeta()[syncKey] = new Date().toISOString();
}

function touchProgramSync(programId) {
  if (!programId) return;
  ensureProgramSyncMeta()[programId] = new Date().toISOString();
}

function resolveProfileSaveDocKeys(options) {
  const opts = options || {};
  if (Array.isArray(opts.docKeys) && opts.docKeys.length)
    return uniqueDocKeys(opts.docKeys);
  if (Array.isArray(opts.programIds) && opts.programIds.length)
    return uniqueDocKeys(opts.programIds.map(programDocKey));
  return uniqueDocKeys([
    PROFILE_CORE_DOC_KEY,
    ...listProgramIds(profile).map(programDocKey),
  ]);
}

async function loadData(options) {
  const opts = options || {};
  const allowCloudSync = opts.allowCloudSync !== false;
  cloudSyncEnabled = allowCloudSync;
  loadLocalData({
    userId: opts.userId || currentUser?.id,
    allowLegacyFallback: true,
  });
  // Pull profile/schedule from cloud and workouts from the dedicated workouts table.
  const cloudResult = allowCloudSync
    ? await pullFromCloud()
    : { usedCloud: false };
  const tableResult = allowCloudSync
    ? await pullWorkoutsFromTable(workouts)
    : { usedTable: false, didBackfill: false };
  const gotCloud = !!cloudResult.usedCloud;
  const gotWorkoutTable = !!tableResult.usedTable || !!tableResult.didBackfill;
  if (gotWorkoutTable && Array.isArray(tableResult.workouts))
    workouts = tableResult.workouts;
  if (gotCloud || gotWorkoutTable) {
    persistLocalWorkoutsCache();
    persistLocalScheduleCache();
    persistLocalProfileCache();
  }
  const profileBeforeNormalization = JSON.stringify(profile || {});
  const scheduleBeforeNormalization = JSON.stringify(schedule || {});
  // Migrate legacy hockeyDays -> sportDays (one-time migration)
  if (schedule.hockeyDays && !schedule.sportDays) {
    schedule.sportDays = schedule.hockeyDays;
    delete schedule.hockeyDays;
  }
  normalizeScheduleState(schedule);
  // Migrate legacy ats* keys to forge* (one-time migration)
  if (profile.atsLifts && !profile.forgeLifts) {
    profile.forgeLifts = profile.atsLifts;
    profile.forgeWeek = profile.atsWeek || 1;
    profile.forgeRounding = profile.atsRounding || 2.5;
    profile.forgeDaysPerWeek = profile.atsDaysPerWeek || 3;
    profile.forgeDayNum = profile.atsDayNum || 1;
    profile.forgeBackExercise = profile.atsBackExercise || 'Barbell Rows';
    profile.forgeBackWeight = profile.atsBackWeight || 0;
    profile.forgeMode = profile.atsMode || 'sets';
    profile.forgeWeekStartDate =
      profile.atsWeekStartDate || new Date().toISOString();
  }
  workouts.forEach((w) => {
    if (w.type !== 'ats') return;
    w.type = 'forge';
    w.program = 'forge';
    if (w.atsWeek) {
      w.programMeta = { ...(w.programMeta || {}), week: w.atsWeek };
    }
    if (w.atsDayNum && w.programDayNum === undefined) {
      w.programDayNum = w.atsDayNum;
    }
    if ('atsWeek' in w) delete w.atsWeek;
    if ('atsDayNum' in w) delete w.atsDayNum;
  });
  // Migrate forge* flat fields -> profile.programs.forge (one-time migration)
  if (profile.forgeLifts && !profile.programs) {
    profile.programs = {
      forge: {
        week: profile.forgeWeek || 1,
        dayNum: profile.forgeDayNum || 1,
        daysPerWeek: profile.forgeDaysPerWeek || 3,
        mode: profile.forgeMode || 'sets',
        rounding: profile.forgeRounding || 2.5,
        weekStartDate: profile.forgeWeekStartDate || new Date().toISOString(),
        backExercise: profile.forgeBackExercise || 'Barbell Rows',
        backWeight: profile.forgeBackWeight || 0,
        lifts: profile.forgeLifts,
      },
    };
    profile.activeProgram = 'forge';
  }
  cleanupLegacyProfileFields(profile);
  normalizeBodyMetrics(profile);
  normalizeTrainingPreferences(profile);
  normalizeCoachingProfile(profile);
  normalizeProfileProgramStateMap(profile);
  const normalizedWorkouts = normalizeWorkoutRecords(workouts);
  workouts = normalizedWorkouts.items;
  // Ensure activeProgram is set
  if (!profile.activeProgram) profile.activeProgram = 'forge';
  profile.activeProgram =
    getCanonicalProgramId(profile.activeProgram) || 'forge';
  if (!profile.language)
    profile.language =
      window.I18N && I18N.getLanguage ? I18N.getLanguage() : 'en';
  if (window.I18N && I18N.setLanguage) {
    I18N.setLanguage(profile.language, { persist: true, notify: false });
    profile.language = I18N.getLanguage();
  }
  // Initialize program states for all registered programs (fills in defaults for new programs)
  if (!profile.programs) profile.programs = {};
  (typeof getRegisteredPrograms === 'function' ? getRegisteredPrograms() : []).forEach((prog) => {
    if (!profile.programs[prog.id])
      profile.programs[prog.id] = prog.getInitialState();
  });
  // Backfill new fields for programs that carry existing state (missing keys get safe defaults)
  (typeof getRegisteredPrograms === 'function' ? getRegisteredPrograms() : []).forEach((prog) => {
    if (prog.migrateState && profile.programs[prog.id])
      profile.programs[prog.id] = prog.migrateState(profile.programs[prog.id]);
  });
  // Apply date-based catch-up for the active program
  const activeProg = getActiveProgram();
  if (typeof applyProgramDateCatchUp === 'function')
    applyProgramDateCatchUp(activeProg.id);
  else if (activeProg.dateCatchUp && profile.programs[activeProg.id]) {
    const caught = activeProg.dateCatchUp(profile.programs[activeProg.id]);
    if (caught !== profile.programs[activeProg.id])
      profile.programs[activeProg.id] = caught;
  }
  if (!activeWorkout && typeof restoreActiveWorkoutDraft === 'function') {
    const restored = restoreActiveWorkoutDraft(getActiveWorkoutDraftCache(), {
      toast: false,
    });
    if (!restored) clearActiveWorkoutDraft();
  }
  const profileChangedDuringLoad =
    JSON.stringify(profile || {}) !== profileBeforeNormalization;
  const scheduleChangedDuringLoad =
    JSON.stringify(schedule || {}) !== scheduleBeforeNormalization;
  if (normalizedWorkouts.changed) {
    await saveWorkouts();
    if (currentUser && isCloudSyncEnabled())
      await upsertWorkoutRecords(workouts);
  }
  if (scheduleChangedDuringLoad) {
    await saveScheduleData({ touchSync: true, push: false });
  }
  if (profileChangedDuringLoad) {
    await saveProfileData({ touchSync: true, push: false });
  }
  restDuration = profile.defaultRest || 120;
  buildExerciseIndex();
  if (window.I18N && I18N.applyTranslations) I18N.applyTranslations(document);
  renderSyncStatus();
  updateDashboard();
  if (typeof maybeOpenOnboarding === 'function') maybeOpenOnboarding();
}

async function saveWorkouts() {
  persistLocalWorkoutsCache();
}
async function saveScheduleData(options) {
  const opts = options || {};
  if (opts.touchSync !== false) touchSectionSync('scheduleUpdatedAt');
  markDocKeysDirty([SCHEDULE_DOC_KEY]);
  persistLocalScheduleCache();
  persistLocalProfileCache();
  if (opts.push !== false && isCloudSyncEnabled())
    await pushToCloud({ docKeys: [SCHEDULE_DOC_KEY] });
}
async function saveProfileData(options) {
  const opts = options || {};
  const docKeys = resolveProfileSaveDocKeys(opts);
  if (opts.touchSync !== false) {
    if (Array.isArray(opts.programIds) && opts.programIds.length) {
      opts.programIds.forEach(touchProgramSync);
      touchSectionSync('profileUpdatedAt');
    } else touchSectionSync('profileUpdatedAt');
  }
  markDocKeysDirty(docKeys);
  persistLocalProfileCache();
  if (opts.push !== false && isCloudSyncEnabled())
    await pushToCloud({ docKeys });
}

function toProfileDocumentRows(docKeys, profileLike, scheduleLike) {
  if (!currentUser) return [];
  return uniqueDocKeys(docKeys)
    .map((docKey) => {
      const payload = getDocumentPayload(docKey, profileLike, scheduleLike);
      if (payload === undefined) return null;
      let clientUpdatedAt = new Date().toISOString();
      if (docKey === PROFILE_CORE_DOC_KEY)
        clientUpdatedAt =
          profileLike?.syncMeta?.profileUpdatedAt || clientUpdatedAt;
      else if (docKey === SCHEDULE_DOC_KEY)
        clientUpdatedAt =
          profileLike?.syncMeta?.scheduleUpdatedAt || clientUpdatedAt;
      else {
        const programId = programIdFromDocKey(docKey);
        clientUpdatedAt =
          profileLike?.syncMeta?.programUpdatedAt?.[programId] ||
          clientUpdatedAt;
      }
      return {
        doc_key: docKey,
        payload,
        client_updated_at: clientUpdatedAt,
      };
    })
    .filter(Boolean);
}

async function upsertProfileDocuments(
  docKeys,
  profileLike,
  scheduleLike,
  options
) {
  if (!currentUser || !isCloudSyncEnabled()) {
    return { ok: false, appliedDocKeys: [], staleDocKeys: [], rows: [] };
  }
  const rows = toProfileDocumentRows(docKeys, profileLike, scheduleLike);
  if (!rows.length) {
    return { ok: true, appliedDocKeys: [], staleDocKeys: [], rows: [] };
  }
  const opts = options || {};
  const result = await runSupabaseWrite(
    _SB.rpc('upsert_profile_documents_if_newer', {
      _docs: rows,
    }),
    'Failed to upsert profile documents',
    opts
  );
  profileDocumentsSupported = result.ok;
  if (!result.ok) {
    return { ok: false, appliedDocKeys: [], staleDocKeys: [], rows: [] };
  }
  const returnedRows = Array.isArray(result.data) ? result.data : [];
  const rowsByKey = new Map(
    returnedRows.map((row) => [String(row?.doc_key || ''), row])
  );
  const appliedDocKeys = [];
  const staleDocKeys = [];
  rows.forEach((row) => {
    const serverRow = rowsByKey.get(String(row.doc_key || ''));
    if (serverRow) {
      updateServerDocStamp(serverRow.doc_key, serverRow.updated_at || undefined);
    }
    if (!serverRow || serverRow.applied === false) {
      staleDocKeys.push(row.doc_key);
      return;
    }
    appliedDocKeys.push(row.doc_key);
  });
  clearDocKeysDirty(appliedDocKeys);
  return { ok: true, appliedDocKeys, staleDocKeys, rows: returnedRows };
}

function buildStateFromProfileDocuments(
  rows,
  fallbackProfile,
  fallbackSchedule
) {
  const baseProfile = cloneJson(fallbackProfile || {}) || {};
  const nextProfile = {
    ...baseProfile,
    programs: { ...cloneJson(getProfilePrograms(baseProfile)) },
  };
  const nextSchedule = cloneJson(fallbackSchedule || schedule || {}) || {};
  const rowsByKey = new Map((rows || []).map((row) => [row.doc_key, row]));
  const coreRow = rowsByKey.get(PROFILE_CORE_DOC_KEY);
  const corePayload = coreRow?.payload;
  if (corePayload && typeof corePayload === 'object') {
    const existingPrograms = nextProfile.programs || {};
    const existingSyncMeta = { ...(nextProfile.syncMeta || {}) };
    const incomingSyncMeta = { ...(corePayload.syncMeta || {}) };
    const remoteUpdatedAt = getDocumentUpdatedAt(coreRow);
    const localUpdatedAt = baseProfile?.syncMeta?.profileUpdatedAt;
    const shouldApplyRemoteCore =
      !isDocKeyDirty(PROFILE_CORE_DOC_KEY) &&
      shouldUseRemoteSection(localUpdatedAt, remoteUpdatedAt, {
        preferRemoteWhenUnset: true,
      });
    if (shouldApplyRemoteCore) {
      Object.assign(nextProfile, corePayload);
      nextProfile.programs = existingPrograms;
    }
    nextProfile.syncMeta = { ...existingSyncMeta, ...incomingSyncMeta };
    const mergedProfileUpdatedAt = laterIso(localUpdatedAt, remoteUpdatedAt);
    if (mergedProfileUpdatedAt)
      nextProfile.syncMeta.profileUpdatedAt = mergedProfileUpdatedAt;
  }
  const scheduleRow = rowsByKey.get(SCHEDULE_DOC_KEY);
  const schedulePayload = scheduleRow?.payload;
  let resolvedSchedule = nextSchedule;
  if (schedulePayload && typeof schedulePayload === 'object') {
    const remoteUpdatedAt = getDocumentUpdatedAt(scheduleRow);
    const localUpdatedAt = baseProfile?.syncMeta?.scheduleUpdatedAt;
    const shouldApplyRemoteSchedule =
      !isDocKeyDirty(SCHEDULE_DOC_KEY) &&
      shouldUseRemoteSection(localUpdatedAt, remoteUpdatedAt, {
        preferRemoteWhenUnset: true,
      });
    if (shouldApplyRemoteSchedule) resolvedSchedule = schedulePayload;
    const mergedScheduleUpdatedAt = laterIso(localUpdatedAt, remoteUpdatedAt);
    if (mergedScheduleUpdatedAt) {
      if (!nextProfile.syncMeta || typeof nextProfile.syncMeta !== 'object')
        nextProfile.syncMeta = {};
      nextProfile.syncMeta.scheduleUpdatedAt = mergedScheduleUpdatedAt;
    }
  }
  const programIds = new Set([
    ...Object.keys(nextProfile.programs || {}),
    ...Array.from(rowsByKey.keys())
      .filter(isProgramDocKey)
      .map(programIdFromDocKey),
  ]);
  programIds.forEach((programId) => {
    const row = rowsByKey.get(programDocKey(programId));
    const payload = row?.payload;
    if (payload && typeof payload === 'object') {
      const remoteUpdatedAt = getDocumentUpdatedAt(row);
      const localUpdatedAt =
        baseProfile?.syncMeta?.programUpdatedAt?.[programId];
      const shouldApplyRemoteProgram =
        !isDocKeyDirty(programDocKey(programId)) &&
        shouldUseRemoteSection(localUpdatedAt, remoteUpdatedAt, {
          preferRemoteWhenUnset: true,
        });
      if (shouldApplyRemoteProgram) nextProfile.programs[programId] = payload;
      const mergedProgramUpdatedAt = laterIso(localUpdatedAt, remoteUpdatedAt);
      if (mergedProgramUpdatedAt) {
        if (!nextProfile.syncMeta || typeof nextProfile.syncMeta !== 'object')
          nextProfile.syncMeta = {};
        if (
          !nextProfile.syncMeta.programUpdatedAt ||
          typeof nextProfile.syncMeta.programUpdatedAt !== 'object'
        )
          nextProfile.syncMeta.programUpdatedAt = {};
        nextProfile.syncMeta.programUpdatedAt[programId] =
          mergedProgramUpdatedAt;
      }
    }
  });
  cleanupLegacyProfileFields(nextProfile);
  normalizeBodyMetrics(nextProfile);
  normalizeCoachingProfile(nextProfile);
  return { profile: nextProfile, schedule: resolvedSchedule, rowsByKey };
}

async function pullProfileDocuments(options) {
  if (!currentUser || !isCloudSyncEnabled())
    return { usedDocs: false, supported: false };
  try {
    const { data, error } = await _SB
      .from('profile_documents')
      .select('doc_key,payload,client_updated_at,updated_at')
      .eq('user_id', currentUser.id);
    if (error) {
      if (profileDocumentsSupported !== false)
        logWarn('Failed to pull profile documents', error);
      profileDocumentsSupported = false;
      return { usedDocs: false, supported: false };
    }
    profileDocumentsSupported = true;
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return { usedDocs: false, supported: true };

    const fallbackProfile = options?.legacyProfile || profile;
    const fallbackSchedule = options?.legacySchedule || schedule;
    const next = buildStateFromProfileDocuments(
      rows,
      fallbackProfile,
      fallbackSchedule
    );
    profile = next.profile;
    schedule = next.schedule;
    recordPulledDocumentServerStamps(rows);

    const desiredDocKeys = getAllProfileDocumentKeys(profile);
    const missingDocKeys = desiredDocKeys.filter(
      (docKey) => !next.rowsByKey.has(docKey)
    );
    if (missingDocKeys.length)
      await upsertProfileDocuments(missingDocKeys, profile, schedule, {
        notifyUser: false,
      });

    return { usedDocs: true, supported: true };
  } catch (e) {
    if (profileDocumentsSupported !== false)
      logWarn('Failed to pull profile documents', e);
    profileDocumentsSupported = false;
    return { usedDocs: false, supported: false };
  }
}

function toWorkoutRow(workout) {
  if (!workout) return null;
  return {
    user_id: currentUser.id,
    client_workout_id: String(workout.id),
    program: workout.program || null,
    type: workout.type,
    subtype: workout.subtype || null,
    performed_at: workout.date,
    payload: workout,
    deleted_at: null,
  };
}

async function upsertWorkoutRecord(workout, options) {
  if (!currentUser || !workout || !isCloudSyncEnabled()) return;
  await runSupabaseWrite(
    _SB.from('workouts').upsert(toWorkoutRow(workout), {
      onConflict: 'user_id,client_workout_id',
    }),
    'Failed to upsert workout row',
    options
  );
}

async function upsertWorkoutRecords(items, options) {
  if (
    !currentUser ||
    !Array.isArray(items) ||
    !items.length ||
    !isCloudSyncEnabled()
  )
    return;
  const rows = items.map(toWorkoutRow).filter(Boolean);
  if (!rows.length) return;
  await runSupabaseWrite(
    _SB
      .from('workouts')
      .upsert(rows, { onConflict: 'user_id,client_workout_id' }),
    'Failed to upsert workout rows',
    options
  );
}

async function softDeleteWorkoutRecord(workoutId, options) {
  if (
    !currentUser ||
    workoutId === undefined ||
    workoutId === null ||
    !isCloudSyncEnabled()
  )
    return;
  await runSupabaseWrite(
    _SB
      .from('workouts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', currentUser.id)
      .eq('client_workout_id', String(workoutId)),
    'Failed to soft-delete workout row',
    options
  );
}

async function replaceWorkoutTableSnapshot(items, options) {
  if (!currentUser || !isCloudSyncEnabled()) return;
  const opts = options || {};
  const nextItems = Array.isArray(items) ? items : [];
  const nextIds = new Set(nextItems.map(workoutClientId).filter(Boolean));
  await upsertWorkoutRecords(nextItems, opts);
  try {
    const { data, error } = await _SB
      .from('workouts')
      .select('client_workout_id,deleted_at')
      .eq('user_id', currentUser.id);
    if (error) {
      logWarn('Failed to read workout rows for snapshot replace', error);
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    const staleIds = rows
      .filter(
        (row) => !row.deleted_at && !nextIds.has(String(row.client_workout_id))
      )
      .map((row) => String(row.client_workout_id));
    if (!staleIds.length) return;
    await runSupabaseWrite(
      _SB
        .from('workouts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .in('client_workout_id', staleIds),
      'Failed to prune workout rows during snapshot replace',
      opts
    );
  } catch (e) {
    logWarn('Failed to replace workout table snapshot', e);
  }
}

async function pullWorkoutsFromTable(fallbackWorkouts) {
  if (!currentUser || !isCloudSyncEnabled())
    return { usedTable: false, didBackfill: false };
  try {
    const { data, error } = await _SB
      .from('workouts')
      .select('client_workout_id,payload,deleted_at,performed_at')
      .eq('user_id', currentUser.id)
      .order('performed_at', { ascending: true });
    if (error) return { usedTable: false, didBackfill: false };

    const rows = Array.isArray(data) ? data : [];
    const deletedIds = new Set(
      rows
        .filter((row) => row.deleted_at)
        .map((row) => String(row.client_workout_id))
    );
    const knownIds = new Set(rows.map((row) => String(row.client_workout_id)));
    const activeRows = rows.filter(
      (row) => !row.deleted_at && row.payload && typeof row.payload === 'object'
    );
    const normalizedTableWorkouts = normalizeWorkoutRecords(
      activeRows.map((row) => row.payload)
    );
    const tableWorkouts = normalizedTableWorkouts.items;
    const merged = mergeWorkoutLists(
      tableWorkouts,
      fallbackWorkouts,
      deletedIds
    );
    const missingFromTable = merged.filter(
      (workout) => !knownIds.has(workoutClientId(workout))
    );

    if (missingFromTable.length)
      await upsertWorkoutRecords(missingFromTable, { notifyUser: false });
    else if (normalizedTableWorkouts.changed)
      await upsertWorkoutRecords(tableWorkouts, { notifyUser: false });
    if (
      (rows.length > 0 || missingFromTable.length > 0) &&
      !isWorkoutTableReady(profile)
    ) {
      profile.syncMeta = {
        ...(profile.syncMeta || {}),
        workoutsTableReady: true,
      };
      await saveProfileData({ docKeys: [PROFILE_CORE_DOC_KEY] });
    }

    return {
      usedTable: rows.length > 0,
      didBackfill: missingFromTable.length > 0,
      workouts: merged,
    };
  } catch (e) {
    logWarn('Failed to pull workouts from table', e);
    return { usedTable: false, didBackfill: false };
  }
}

async function fetchLegacyProfileBlob() {
  if (!currentUser || !isCloudSyncEnabled()) return { usedCloud: false };
  try {
    const { data, error } = await _SB
      .from('profiles')
      .select('data,updated_at')
      .eq('id', currentUser.id)
      .single();
    if (error || !data?.data) return { usedCloud: false };
    return {
      usedCloud: true,
      profile: data.data.profile || {},
      schedule: data.data.schedule,
      updatedAt: data.updated_at || null,
    };
  } catch (e) {
    return { usedCloud: false };
  }
}

function applyLegacyProfileBlob(remoteProfile, remoteSchedule, options) {
  const localProfile = profile;
  const localSchedule = schedule;
  const nextProfile = chooseNewerSection(
    localProfile,
    remoteProfile,
    localProfile,
    remoteProfile,
    'profileUpdatedAt',
    options
  );
  const nextSchedule = chooseNewerSection(
    localSchedule,
    remoteSchedule,
    localProfile,
    remoteProfile,
    'scheduleUpdatedAt',
    options
  );
  profile = {
    ...nextProfile,
    syncMeta: mergeSyncMeta(localProfile?.syncMeta, remoteProfile?.syncMeta),
  };
  if (nextSchedule !== undefined) schedule = nextSchedule;
}

async function pushLegacyProfileBlob() {
  try {
    setSyncStatus('syncing');
    const { data, error } = await _SB
      .from('profiles')
      .select('data')
      .eq('id', currentUser.id)
      .single();
    if (error && error.code !== 'PGRST116') {
      logWarn('Failed to read cloud profile before legacy push', error);
      notifyCloudSyncError({ notifyUser: true });
      return false;
    }
    const remoteData = data?.data || {};
    const remoteProfile = remoteData.profile || {};
    const remoteSchedule = remoteData.schedule;
    const mergedProfile = chooseNewerSection(
      profile,
      remoteProfile,
      profile,
      remoteProfile,
      'profileUpdatedAt'
    );
    const mergedSchedule = chooseNewerSection(
      schedule,
      remoteSchedule,
      profile,
      remoteProfile,
      'scheduleUpdatedAt'
    );
    profile = {
      ...mergedProfile,
      syncMeta: mergeSyncMeta(profile?.syncMeta, remoteProfile?.syncMeta),
    };
    if (mergedSchedule !== undefined) schedule = mergedSchedule;
    persistLocalProfileCache();
    persistLocalScheduleCache();
    const result = await runSupabaseWrite(
      _SB
        .from('profiles')
        .upsert({
          id: currentUser.id,
          data: { profile, schedule },
          updated_at: new Date().toISOString(),
        })
        .select('updated_at'),
      'Failed to push legacy profile blob',
      { notifyUser: true }
    );
    if (result.ok) {
      const updatedAt = Array.isArray(result.data)
        ? result.data[0]?.updated_at
        : result.data?.updated_at;
      updateLegacyProfileStamp(updatedAt || new Date().toISOString());
      clearDocKeysDirty(getAllProfileDocumentKeys(profile));
      setSyncStatus('synced');
    }
    return result.ok;
  } catch (e) {
    logWarn('Failed to push legacy profile blob', e);
    notifyCloudSyncError({ notifyUser: true });
    return false;
  }
}

async function pushToCloud(options) {
  if (!currentUser || !isCloudSyncEnabled() || isApplyingRemoteSync)
    return false;
  const opts = options || {};
  const docKeys = opts.docKeys || getAllProfileDocumentKeys(profile);
  setSyncStatus('syncing');
  const writeResult = await upsertProfileDocuments(docKeys, profile, schedule, {
    notifyUser: false,
  });
  if (writeResult.ok) {
    let resolvedStaleRejects = true;
    if (writeResult.staleDocKeys.length) {
      resolvedStaleRejects = await resolveStaleProfileDocumentRejects(
        writeResult.staleDocKeys
      );
    }
    setSyncStatus(resolvedStaleRejects ? 'synced' : 'error');
    return true;
  }
  return pushLegacyProfileBlob();
}

async function flushPendingCloudSync() {
  if (!currentUser || !isCloudSyncEnabled() || isApplyingRemoteSync)
    return false;
  const dirtyDocKeys = getDirtyDocKeys();
  if (!dirtyDocKeys.length) return true;
  return pushToCloud({ docKeys: dirtyDocKeys });
}

async function pullFromCloud() {
  if (!currentUser || !isCloudSyncEnabled()) return { usedCloud: false };
  setSyncStatus('syncing');
  const legacySnapshot = await fetchLegacyProfileBlob();
  const docsResult = await pullProfileDocuments({
    legacyProfile: legacySnapshot.profile,
    legacySchedule: legacySnapshot.schedule,
  });
  if (docsResult.usedDocs) {
    setSyncStatus('synced');
    return { usedCloud: true, usedDocs: true };
  }
  if (legacySnapshot.usedCloud) {
    applyLegacyProfileBlob(legacySnapshot.profile, legacySnapshot.schedule, {
      preferRemoteWhenUnset: true,
    });
    updateLegacyProfileStamp(legacySnapshot.updatedAt || null);
    if (profileDocumentsSupported !== false) {
      await upsertProfileDocuments(
        getAllProfileDocumentKeys(profile),
        profile,
        schedule,
        { notifyUser: false }
      );
    }
    setSyncStatus('synced');
    return { usedCloud: true, usedDocs: false };
  }
  setSyncStatus(navigator.onLine ? 'synced' : 'offline');
  return { usedCloud: false, usedDocs: false };
}

async function resolveStaleProfileDocumentRejects(staleDocKeys) {
  const nextStaleDocKeys = uniqueDocKeys(staleDocKeys);
  if (
    !nextStaleDocKeys.length ||
    !currentUser ||
    !isCloudSyncEnabled() ||
    isApplyingRemoteSync
  ) {
    return false;
  }
  clearDocKeysDirty(nextStaleDocKeys);
  const beforeProfile = JSON.stringify(profile || {});
  const beforeSchedule = JSON.stringify(schedule || {});
  const pullResult = await pullFromCloud();
  const changed =
    beforeProfile !== JSON.stringify(profile || {}) ||
    beforeSchedule !== JSON.stringify(schedule || {});
  if (pullResult.usedCloud && changed) {
    persistLocalProfileCache();
    persistLocalScheduleCache();
    refreshSyncedUI({ toast: false });
  }
  return pullResult.usedCloud === true;
}

function refreshSyncedUI(options) {
  const opts = options || {};
  restDuration = profile.defaultRest || 120;
  buildExerciseIndex();
  if (
    typeof initSettings === 'function' &&
    (document.getElementById('page-settings')?.classList.contains('active') ||
      document
        .getElementById('program-setup-sheet')
        ?.classList.contains('active'))
  )
    initSettings();
  if (typeof updateProgramDisplay === 'function') updateProgramDisplay();
  if (typeof updateDashboard === 'function') updateDashboard();
  if (
    typeof renderHistory === 'function' &&
    document.getElementById('page-history')?.classList.contains('active')
  ) {
    renderHistory();
    if (typeof updateStats === 'function') updateStats();
  }
  if (
    !activeWorkout &&
    document.getElementById('page-log')?.classList.contains('active') &&
    typeof resetNotStartedView === 'function'
  ) {
    resetNotStartedView();
  }
  if (
    activeWorkout &&
    document.getElementById('page-log')?.classList.contains('active') &&
    typeof resumeActiveWorkoutUI === 'function'
  ) {
    resumeActiveWorkoutUI({ toast: false });
  }
  if (typeof maybeOpenOnboarding === 'function') maybeOpenOnboarding();
  renderSyncStatus();
  if (opts.toast && typeof showToast === 'function') {
    showToast(
      i18nText(
        'toast.synced_other_device',
        'Synced latest changes from another device'
      ),
      'var(--blue)'
    );
  }
}

function teardownRealtimeSync() {
  if (realtimeSyncTimer) {
    clearTimeout(realtimeSyncTimer);
    realtimeSyncTimer = null;
  }
  if (syncRealtimeChannel && _SB?.removeChannel) {
    _SB.removeChannel(syncRealtimeChannel);
  }
  syncRealtimeChannel = null;
}

async function applyRealtimeSync(reason) {
  if (!currentUser || !isCloudSyncEnabled() || isApplyingRemoteSync) return;
  isApplyingRemoteSync = true;
  try {
    const beforeProfile = JSON.stringify(profile || {});
    const beforeSchedule = JSON.stringify(schedule || {});
    const beforeWorkouts = JSON.stringify(workouts || []);
    await pullFromCloud();
    const tableResult = await pullWorkoutsFromTable(workouts);
    if (tableResult.usedTable || tableResult.didBackfill)
      workouts = tableResult.workouts || workouts;
    const changed =
      beforeProfile !== JSON.stringify(profile || {}) ||
      beforeSchedule !== JSON.stringify(schedule || {}) ||
      beforeWorkouts !== JSON.stringify(workouts || []);
    if (changed) {
      persistLocalProfileCache();
      persistLocalScheduleCache();
      persistLocalWorkoutsCache();
      refreshSyncedUI({ toast: reason !== 'auth-load' });
    }
  } finally {
    isApplyingRemoteSync = false;
  }
}

function scheduleRealtimeSync(reason) {
  if (!currentUser || !isCloudSyncEnabled()) return;
  if (realtimeSyncTimer) clearTimeout(realtimeSyncTimer);
  realtimeSyncTimer = setTimeout(() => {
    applyRealtimeSync(reason);
  }, 150);
}

function setupRealtimeSync() {
  teardownRealtimeSync();
  if (!currentUser || !isCloudSyncEnabled() || !_SB?.channel) return;
  syncRealtimeChannel = _SB
    .channel('ironforge-sync-' + currentUser.id)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'workouts',
        filter: `user_id=eq.${currentUser.id}`,
      },
      () => scheduleRealtimeSync('workouts')
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profile_documents',
        filter: `user_id=eq.${currentUser.id}`,
      },
      () => scheduleRealtimeSync('profile-documents')
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${currentUser.id}`,
      },
      () => scheduleRealtimeSync('legacy-profile')
    )
    .subscribe();
}

async function applyAuthSession(session, options) {
  const opts = options || {};
  const sessionUser = session?.user ?? null;
  const wasLoggedIn = opts.wasLoggedIn ?? !!currentUser;
  logAuthTrace('applyAuthSession start', {
    hasSession: !!session,
    hasUser: !!sessionUser,
    userId: sessionUser?.id || '',
    wasLoggedIn,
  });
  currentUser = sessionUser;
  window.currentUser = currentUser || null;
  if (currentUser && !wasLoggedIn) {
    logAuthTrace('applyAuthSession loading user data', {
      userId: currentUser.id || '',
    });
    hideLoginScreen();
    await loadData({ allowCloudSync: true });
    logAuthTrace('applyAuthSession data loaded', {
      userId: currentUser.id || '',
    });
    setupRealtimeSync();
    logAuthTrace('applyAuthSession realtime ready', {
      userId: currentUser.id || '',
    });
    return;
  }
  if (!currentUser && wasLoggedIn) {
    logAuthTrace('applyAuthSession logout branch');
    teardownRealtimeSync();
    if (typeof clearNutritionLocalData === 'function') {
      clearNutritionLocalData({ includeScoped: true, includeLegacy: true });
    }
    resetRuntimeState();
    showLoginScreen();
    if (typeof notifySettingsAccountIsland === 'function')
      notifySettingsAccountIsland();
    updateDashboard();
    return;
  }
  if (!currentUser) {
    logAuthTrace('applyAuthSession no current user');
    teardownRealtimeSync();
    resetRuntimeState();
    showLoginScreen();
  }
}

function logAuthTrace(message, details) {
  try {
    window.__IRONFORGE_LOGIN_DEBUG__?.trace?.(message, details);
  } catch (_error) {}
}

function reportAuthSessionError(error) {
  console.error('Failed to apply auth session change.', error);
  const message =
    error instanceof Error
      ? error.message
      : 'Unable to finish signing in right now.';
  logAuthTrace('auth session error', { message });
  if (typeof window.showToast === 'function') {
    window.showToast(message, '#f87171');
  }
  const errEl = document.getElementById('login-error');
  if (errEl) {
    errEl.style.color = '#f87171';
    errEl.textContent = message;
  }
}

async function initAuth() {
  logAuthTrace('initAuth delegated to auth runtime');
  if (window.__IRONFORGE_AUTH_RUNTIME__?.bootstrap) {
    await window.__IRONFORGE_AUTH_RUNTIME__.bootstrap();
  }
}

function showLoginScreen() {
  logAuthTrace('showLoginScreen');
  window.__IRONFORGE_SET_AUTH_STATE__?.({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: null,
  });
  window.__IRONFORGE_SET_AUTH_LOGGED_IN__?.(false);
  renderSyncStatus();
}

function hideLoginScreen() {
  logAuthTrace('hideLoginScreen', { userId: currentUser?.id || '' });
  window.__IRONFORGE_SET_AUTH_STATE__?.({
    phase: 'signed_in',
    isLoggedIn: true,
    pendingAction: null,
  });
  window.__IRONFORGE_SET_AUTH_LOGGED_IN__?.(true);
  const el = document.getElementById('account-email');
  if (el) el.textContent = currentUser?.email ?? '';
  renderSyncStatus();
  if (typeof notifySettingsAccountIsland === 'function')
    notifySettingsAccountIsland();
}

async function loginWithEmail() {
  logAuthTrace('legacy loginWithEmail delegate');
  if (window.__IRONFORGE_AUTH_RUNTIME__?.loginWithEmail) {
    return await window.__IRONFORGE_AUTH_RUNTIME__.loginWithEmail();
  }
  throw new Error('Auth runtime is not ready.');
}

async function signUpWithEmail() {
  logAuthTrace('legacy signUpWithEmail delegate');
  if (window.__IRONFORGE_AUTH_RUNTIME__?.signUpWithEmail) {
    return await window.__IRONFORGE_AUTH_RUNTIME__.signUpWithEmail();
  }
  throw new Error('Auth runtime is not ready.');
}

async function logout() {
  logAuthTrace('legacy logout delegate');
  if (window.__IRONFORGE_AUTH_RUNTIME__?.logout) {
    return await window.__IRONFORGE_AUTH_RUNTIME__.logout();
  }
  throw new Error('Auth runtime is not ready.');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) void flushPendingCloudSync();
});
window.addEventListener('pagehide', () => {
  void flushPendingCloudSync();
});

window.__IRONFORGE_APPLY_AUTH_SESSION__ = applyAuthSession;
window.__IRONFORGE_REPORT_AUTH_SESSION_ERROR__ = reportAuthSessionError;
window.loginWithEmail = loginWithEmail;
window.signUpWithEmail = signUpWithEmail;
window.logout = logout;
