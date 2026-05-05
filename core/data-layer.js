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
    pendingBackfillDocKeys: [],
    pendingWorkoutUpsertIds: [],
    pendingWorkoutDeleteIds: [],
    lastSyncError: null,
    lastCloudSyncAt: null,
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
  next.pendingBackfillDocKeys = uniqueDocKeys(next.pendingBackfillDocKeys);
  next.pendingWorkoutUpsertIds = uniqueDocKeys(next.pendingWorkoutUpsertIds);
  next.pendingWorkoutDeleteIds = uniqueDocKeys(next.pendingWorkoutDeleteIds);
  next.lastSyncError =
    next.lastSyncError && typeof next.lastSyncError === 'object'
      ? {
          context: sanitizeSyncDiagnosticText(next.lastSyncError.context, 120),
          code: sanitizeSyncDiagnosticText(next.lastSyncError.code, 64),
          message: sanitizeSyncDiagnosticText(next.lastSyncError.message, 180),
          at: sanitizeSyncDiagnosticText(next.lastSyncError.at, 40),
        }
      : null;
  next.lastCloudSyncAt = sanitizeSyncDiagnosticText(next.lastCloudSyncAt, 40);
  return next;
}

function sanitizeSyncDiagnosticText(value, maxLength) {
  const text = String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, maxLength || 160);
}

function getSyncStateCache() {
  return (syncStateCache = normalizeSyncStateCache(syncStateCache));
}

function getLocalCacheUserId(explicitUserId) {
  const raw = explicitUserId || currentUser?.id || window.__IRONFORGE_TEST_USER_ID__ || '';
  return String(raw || '').trim();
}

function isCloudSyncEnabled() { return cloudSyncEnabled !== false; }

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
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

function bootstrapProfileRuntimeState(input) {
  const opts = input || {};
  const runtime = window.__IRONFORGE_APP_RUNTIME__;
  if (typeof runtime?.bootstrapProfileRuntime === 'function') {
    return runtime.bootstrapProfileRuntime(opts);
  }
  const nextProfile = cloneJson(opts.profile || {}) || {};
  const nextSchedule = cloneJson(opts.schedule || {}) || {};
  const nextWorkouts = Array.isArray(opts.workouts)
    ? cloneJson(opts.workouts)
    : [];
  return {
    profile: nextProfile,
    schedule: nextSchedule,
    workouts: nextWorkouts,
    changed: {
      profile: false,
      schedule: false,
      workouts: false,
    },
  };
}

function getWorkoutPersistenceRuntime() { return window.__IRONFORGE_WORKOUT_PERSISTENCE_RUNTIME__ || null; }
function getSyncRuntime() { return window.__IRONFORGE_SYNC_RUNTIME__ || null; }

function reportMissingSyncRuntime(methodName, options) {
  const opts = options || {};
  const message = `[Ironforge] Sync runtime is not ready for ${methodName}.`;
  const error = new Error(message);
  if (typeof logWarn === 'function') logWarn(message, error);
  else console.error(message, error);
  if (opts.toast !== false && typeof showToast === 'function') {
    showToast(
      i18nText(
        'settings.sync.runtime_not_ready',
        'Sync is still starting. Please try again in a moment.'
      ),
      'var(--orange)'
    );
  }
  return error;
}

function requireSyncRuntimeMethod(methodName, options) {
  const runtime = getSyncRuntime();
  const method = runtime?.[methodName];
  if (typeof method === 'function') {
    return method.bind(runtime);
  }
  throw reportMissingSyncRuntime(methodName, options);
}

function getSyncRuntimeDeps() {
  return {
    readState: () => ({
      currentUser,
      workouts,
      schedule,
      profile,
      activeWorkout,
      cloudSyncEnabled: isCloudSyncEnabled(),
    }),
    writeState: (partial) => {
      if (!partial || typeof partial !== 'object') return;
      if (Object.prototype.hasOwnProperty.call(partial, 'currentUser')) {
        currentUser = partial.currentUser || null;
        window.currentUser = currentUser || null;
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'workouts')) {
        workouts = Array.isArray(partial.workouts) ? partial.workouts : [];
        window.workouts = cloneJson(workouts);
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'schedule')) {
        schedule = partial.schedule || null;
        window.schedule = cloneJson(schedule);
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'profile')) {
        profile = partial.profile || null;
        window.profile = cloneJson(profile);
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'activeWorkout')) {
        activeWorkout = partial.activeWorkout || null;
        window.activeWorkout = cloneJson(activeWorkout);
      }
    },
    setCloudSyncEnabled: (value) => {
      cloudSyncEnabled = value !== false;
    },
    setRestDuration: (value) => {
      restDuration = Number(value) || 120;
    },
    loadLocalData,
    pullWorkoutsFromTable,
    bootstrapProfileRuntimeState,
    setLanguage: (language) => {
      if (window.I18N && I18N.setLanguage) {
        I18N.setLanguage(language, { persist: true, notify: false });
        return I18N.getLanguage();
      }
      return String(language || '');
    },
    restoreActiveWorkoutDraft:
      typeof restoreActiveWorkoutDraft === 'function'
        ? restoreActiveWorkoutDraft
        : null,
    getActiveWorkoutDraftCache,
    clearActiveWorkoutDraft:
      typeof clearActiveWorkoutDraft === 'function'
        ? clearActiveWorkoutDraft
        : () => {},
    saveWorkouts,
    upsertWorkoutRecords,
    buildExerciseIndex,
    applyTranslations:
      window.I18N && I18N.applyTranslations
        ? () => I18N.applyTranslations(document)
        : null,
    renderSyncStatus,
    updateDashboard,
    maybeOpenOnboarding:
      typeof maybeOpenOnboarding === 'function' ? maybeOpenOnboarding : null,
    isCloudSyncEnabled,
    isBrowserOffline,
    setSyncStatus,
    getDefaultLanguage:
      window.I18N && I18N.getLanguage ? () => I18N.getLanguage() : null,
    getProfileDocumentsSupported: () => profileDocumentsSupported,
    setProfileDocumentsSupported: (value) => {
      profileDocumentsSupported = value === null ? null : value === true;
    },
    persistLocalProfileCache,
    persistLocalScheduleCache,
    persistLocalWorkoutsCache,
    refreshSyncedUI,
    markDocKeysDirty,
    clearDocKeysDirty,
    getDirtyDocKeys,
    getPendingBackfillDocKeys,
    markPendingBackfillDocKeys,
    clearPendingBackfillDocKeys,
    getPendingWorkoutUpsertIds,
    getPendingWorkoutDeleteIds,
    markPendingWorkoutUpsertIds,
    markPendingWorkoutDeleteIds,
    clearPendingWorkoutUpsertIds,
    clearPendingWorkoutDeleteIds,
    replayPendingWorkoutSync,
    recordCloudSyncSuccess,
    runCloudSyncHealthCheck,
    updateServerDocStamp,
    isDocKeyDirty,
    runSupabaseWrite,
    logWarn,
    supabaseClient: _SB,
  };
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
    state: isBrowserOffline() ? 'offline' : 'idle',
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

function getSyncStatusState() {
  return { ...syncStatusState };
}

function getSyncStatusLabel() {
  const state = isBrowserOffline()
    ? 'offline'
    : syncStatusState.state || 'idle';
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
  if (currentUser) {
    setupRealtimeSync();
    void flushPendingCloudSync();
    scheduleRealtimeSync('online');
  }
});
window.addEventListener('offline', () => {
  teardownRealtimeSync();
  setSyncStatus('offline');
});

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
      recordCloudSyncError(context, error);
      notifyCloudSyncError(opts);
      return { ok: false, error, data: result?.data };
    }
    recordCloudSyncSuccess();
    if (Array.isArray(opts.pendingWorkoutUpsertIds)) {
      clearPendingWorkoutUpsertIds(opts.pendingWorkoutUpsertIds);
    }
    if (Array.isArray(opts.pendingWorkoutDeleteIds)) {
      clearPendingWorkoutDeleteIds(opts.pendingWorkoutDeleteIds);
    }
    return { ok: true, error: null, data: result?.data };
  } catch (error) {
    logWarn(context, error);
    recordCloudSyncError(context, error);
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

function getDirtyDocKeys() {
  return uniqueDocKeys(getSyncStateCache().dirtyDocKeys || []);
}

function getPendingBackfillDocKeys() {
  return uniqueDocKeys(getSyncStateCache().pendingBackfillDocKeys || []);
}

function markPendingBackfillDocKeys(docKeys) {
  const state = getSyncStateCache();
  const pending = new Set(state.pendingBackfillDocKeys || []);
  uniqueDocKeys(docKeys).forEach((docKey) => pending.add(docKey));
  state.pendingBackfillDocKeys = [...pending];
  syncStateCache = state;
  persistSyncStateCache();
}

function clearPendingBackfillDocKeys(docKeys) {
  const state = getSyncStateCache();
  if (!Array.isArray(docKeys) || !docKeys.length) {
    state.pendingBackfillDocKeys = [];
  } else {
    const cleared = new Set(uniqueDocKeys(docKeys));
    state.pendingBackfillDocKeys = (state.pendingBackfillDocKeys || []).filter(
      (docKey) => !cleared.has(docKey)
    );
  }
  syncStateCache = state;
  persistSyncStateCache();
}

function getPendingWorkoutUpsertIds() {
  return uniqueDocKeys(getSyncStateCache().pendingWorkoutUpsertIds || []);
}

function getPendingWorkoutDeleteIds() {
  return uniqueDocKeys(getSyncStateCache().pendingWorkoutDeleteIds || []);
}

function markPendingWorkoutUpsertIds(ids) {
  const nextIds = uniqueDocKeys(ids);
  if (!nextIds.length) return;
  const state = getSyncStateCache();
  const pending = new Set(state.pendingWorkoutUpsertIds || []);
  nextIds.forEach((id) => pending.add(id));
  state.pendingWorkoutUpsertIds = [...pending];
  syncStateCache = state;
  persistSyncStateCache();
}

function markPendingWorkoutDeleteIds(ids) {
  const nextIds = uniqueDocKeys(ids);
  if (!nextIds.length) return;
  const state = getSyncStateCache();
  const pending = new Set(state.pendingWorkoutDeleteIds || []);
  nextIds.forEach((id) => pending.add(id));
  state.pendingWorkoutDeleteIds = [...pending];
  syncStateCache = state;
  persistSyncStateCache();
}

function clearPendingWorkoutUpsertIds(ids) {
  const state = getSyncStateCache();
  if (!Array.isArray(ids) || !ids.length) {
    state.pendingWorkoutUpsertIds = [];
  } else {
    const cleared = new Set(uniqueDocKeys(ids));
    state.pendingWorkoutUpsertIds = (state.pendingWorkoutUpsertIds || []).filter(
      (id) => !cleared.has(id)
    );
  }
  syncStateCache = state;
  persistSyncStateCache();
}

function clearPendingWorkoutDeleteIds(ids) {
  const state = getSyncStateCache();
  if (!Array.isArray(ids) || !ids.length) {
    state.pendingWorkoutDeleteIds = [];
  } else {
    const cleared = new Set(uniqueDocKeys(ids));
    state.pendingWorkoutDeleteIds = (state.pendingWorkoutDeleteIds || []).filter(
      (id) => !cleared.has(id)
    );
  }
  syncStateCache = state;
  persistSyncStateCache();
}

function getLastSyncDiagnostics() {
  const state = getSyncStateCache();
  return {
    lastSyncError: state.lastSyncError ? { ...state.lastSyncError } : null,
    lastCloudSyncAt: state.lastCloudSyncAt || null,
    pendingDocKeys: getDirtyDocKeys(),
    pendingBackfillDocKeys: getPendingBackfillDocKeys(),
    pendingWorkoutUpsertIds: getPendingWorkoutUpsertIds(),
    pendingWorkoutDeleteIds: getPendingWorkoutDeleteIds(),
  };
}

function recordCloudSyncSuccess() {
  const state = getSyncStateCache();
  state.lastCloudSyncAt = new Date().toISOString();
  state.lastSyncError = null;
  syncStateCache = state;
  persistSyncStateCache();
}

function recordCloudSyncError(context, error) {
  const state = getSyncStateCache();
  const rawCode =
    error && typeof error === 'object'
      ? error.code || error.status || error.name
      : '';
  const rawMessage =
    error && typeof error === 'object'
      ? error.message || error.error_description || error.error || ''
      : error;
  state.lastSyncError = {
    context: sanitizeSyncDiagnosticText(context, 120),
    code: sanitizeSyncDiagnosticText(rawCode, 64),
    message:
      sanitizeSyncDiagnosticText(rawMessage, 180) ||
      i18nText('settings.sync.unknown_error', 'Unknown sync error'),
    at: new Date().toISOString(),
  };
  syncStateCache = state;
  persistSyncStateCache();
}

function parseSyncStamp(value) {
  const ts = Date.parse(String(value || ''));
  return Number.isFinite(ts) ? ts : 0;
}

function laterIso(a, b) {
  const at = parseSyncStamp(a);
  const bt = parseSyncStamp(b);
  if (at === 0 && bt === 0) return undefined;
  return at >= bt
    ? a || new Date(at).toISOString()
    : b || new Date(bt).toISOString();
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
  const programs =
    profileLike &&
    typeof profileLike.programs === 'object' &&
    profileLike.programs
      ? profileLike.programs
      : {};
  return uniqueDocKeys([
    PROFILE_CORE_DOC_KEY,
    SCHEDULE_DOC_KEY,
    ...Object.keys(programs).sort().map(programDocKey),
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
  if ('isLastHeavySet' in set)
    next.isLastHeavySet = set.isLastHeavySet === true;
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
  if ('isAccessory' in exercise)
    next.isAccessory = exercise.isAccessory === true;
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
      if (field in workout)
        next[field] = sanitizeWorkoutTextValue(workout[field], 64);
    }
  );
  if ('isDraft' in workout) next.isDraft = workout.isDraft === true;
  if (workout.programMeta && typeof workout.programMeta === 'object') {
    next.programMeta = {};
    Object.keys(workout.programMeta).forEach((key) => {
      next.programMeta[key] = sanitizeWorkoutMetaValue(
        workout.programMeta[key]
      );
    });
  }
  const commentaryResult = normalizeWorkoutCommentaryValue({
    commentary: workout.commentary,
    adaptationReasons: workout.adaptationReasons,
  });
  if (commentaryResult.commentary)
    next.commentary = commentaryResult.commentary;
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
  if (!('workouts' in data) && !('schedule' in data) && !('profile' in data)) {
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
    if (
      !data.schedule ||
      typeof data.schedule !== 'object' ||
      Array.isArray(data.schedule)
    ) {
      return {
        ok: false,
        errorKey: 'import.invalid_schedule_data',
        fallback: 'Backup file has invalid schedule data',
      };
    }
  }
  if ('profile' in data) {
    if (
      !data.profile ||
      typeof data.profile !== 'object' ||
      Array.isArray(data.profile)
    ) {
      return {
        ok: false,
        errorKey: 'import.invalid_profile_data',
        fallback: 'Backup file has invalid profile data',
      };
    }
  }
  if ('profile' in data || 'schedule' in data || next.workouts) {
    const bootstrapResult = bootstrapProfileRuntimeState({
      profile: 'profile' in data ? data.profile : profile,
      schedule: 'schedule' in data ? data.schedule : schedule,
      workouts: next.workouts || [],
      applyToStore: false,
      applyProgramCatchUp: false,
    });
    if ('profile' in data) next.profile = bootstrapResult.profile;
    if ('schedule' in data) next.schedule = bootstrapResult.schedule;
    if (next.workouts) next.workouts = bootstrapResult.workouts;
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
  const runtime = getWorkoutPersistenceRuntime();
  if (typeof runtime?.persistLocalWorkoutsCache === 'function') {
    runtime.persistLocalWorkoutsCache({
      userId,
      currentUser,
      workouts,
    });
    return;
  }
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

async function loadData(options) {
  return await requireSyncRuntimeMethod('loadData')(
    options,
    getSyncRuntimeDeps()
  );
}

async function saveWorkouts() {
  const runtime = getWorkoutPersistenceRuntime();
  if (typeof runtime?.saveWorkouts === 'function') {
    runtime.saveWorkouts({
      userId: getLocalCacheUserId(),
      currentUser,
      workouts,
    });
    return;
  }
  persistLocalWorkoutsCache();
}
async function saveScheduleData(options) {
  return await requireSyncRuntimeMethod('saveScheduleData')(
    options,
    getSyncRuntimeDeps()
  );
}
async function saveProfileData(options) {
  return await requireSyncRuntimeMethod('saveProfileData')(
    options,
    getSyncRuntimeDeps()
  );
}

async function upsertProfileDocuments(
  docKeys,
  profileLike,
  scheduleLike,
  options
) {
  const runtime = getSyncRuntime();
  if (typeof runtime?.upsertProfileDocuments === 'function')
    return await runtime.upsertProfileDocuments(
      docKeys,
      profileLike,
      scheduleLike,
      options,
      getSyncRuntimeDeps()
    );
  return { ok: false, appliedDocKeys: [], staleDocKeys: [], rows: [] };
}

function buildStateFromProfileDocuments(
  rows,
  fallbackProfile,
  fallbackSchedule,
  workoutItems
) {
  const runtime = getSyncRuntime();
  if (typeof runtime?.buildStateFromProfileDocuments === 'function')
    return runtime.buildStateFromProfileDocuments(
      {
        rows,
        fallbackProfile,
        fallbackSchedule,
        workoutItems,
      },
      getSyncRuntimeDeps()
    );
  return {
    profile: cloneJson(fallbackProfile || {}) || {},
    schedule: cloneJson(fallbackSchedule || schedule || {}) || {},
    rowsByKey: new Map(),
  };
}

async function pullProfileDocuments(options) {
  const runtime = getSyncRuntime();
  if (typeof runtime?.pullProfileDocuments === 'function')
    return await runtime.pullProfileDocuments(options, getSyncRuntimeDeps());
  return { usedDocs: false, supported: false };
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
  const pendingIds = uniqueDocKeys([workoutClientId(workout)]);
  if (pendingIds.length) markPendingWorkoutUpsertIds(pendingIds);
  const opts = {
    ...(options || {}),
    pendingWorkoutUpsertIds: uniqueDocKeys([
      ...((options || {}).pendingWorkoutUpsertIds || []),
      ...pendingIds,
    ]),
  };
  const runtime = getWorkoutPersistenceRuntime();
  if (typeof runtime?.upsertWorkoutRecord === 'function') {
    await runtime.upsertWorkoutRecord(
      {
        workout,
        currentUser,
        cloudSyncEnabled: isCloudSyncEnabled(),
        options: opts,
      },
      {
        supabaseClient: _SB,
        runSupabaseWrite,
        logWarn,
        markPendingWorkoutUpsertIds,
        clearPendingWorkoutUpsertIds,
      }
    );
    return;
  }
  if (!currentUser || !workout || !isCloudSyncEnabled()) return;
  await runSupabaseWrite(
    _SB.from('workouts').upsert(toWorkoutRow(workout), {
      onConflict: 'user_id,client_workout_id',
    }),
    'Failed to upsert workout row',
    opts
  );
}

async function upsertWorkoutRecords(items, options) {
  const pendingIds = uniqueDocKeys(
    (Array.isArray(items) ? items : []).map(workoutClientId)
  );
  if (pendingIds.length) markPendingWorkoutUpsertIds(pendingIds);
  const opts = {
    ...(options || {}),
    pendingWorkoutUpsertIds: uniqueDocKeys([
      ...((options || {}).pendingWorkoutUpsertIds || []),
      ...pendingIds,
    ]),
  };
  const runtime = getWorkoutPersistenceRuntime();
  if (typeof runtime?.upsertWorkoutRecords === 'function') {
    await runtime.upsertWorkoutRecords(
      {
        workouts: items,
        currentUser,
        cloudSyncEnabled: isCloudSyncEnabled(),
        options: opts,
      },
      {
        supabaseClient: _SB,
        runSupabaseWrite,
        logWarn,
        markPendingWorkoutUpsertIds,
        clearPendingWorkoutUpsertIds,
      }
    );
    return;
  }
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
    opts
  );
}

async function softDeleteWorkoutRecord(workoutId, options) {
  const pendingIds = uniqueDocKeys([workoutId]);
  if (pendingIds.length) markPendingWorkoutDeleteIds(pendingIds);
  const opts = {
    ...(options || {}),
    pendingWorkoutDeleteIds: uniqueDocKeys([
      ...((options || {}).pendingWorkoutDeleteIds || []),
      ...pendingIds,
    ]),
  };
  const runtime = getWorkoutPersistenceRuntime();
  if (typeof runtime?.softDeleteWorkoutRecord === 'function') {
    await runtime.softDeleteWorkoutRecord(
      {
        workoutId,
        currentUser,
        cloudSyncEnabled: isCloudSyncEnabled(),
        options: opts,
      },
      {
        supabaseClient: _SB,
        runSupabaseWrite,
        logWarn,
        markPendingWorkoutDeleteIds,
        clearPendingWorkoutDeleteIds,
      }
    );
    return;
  }
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
    opts
  );
}

async function replaceWorkoutTableSnapshot(items, options) {
  const runtime = getWorkoutPersistenceRuntime();
  if (typeof runtime?.replaceWorkoutTableSnapshot === 'function') {
    await runtime.replaceWorkoutTableSnapshot(
      {
        workouts: items,
        currentUser,
        cloudSyncEnabled: isCloudSyncEnabled(),
        options,
      },
      {
        supabaseClient: _SB,
        runSupabaseWrite,
        logWarn,
        markPendingWorkoutUpsertIds,
        markPendingWorkoutDeleteIds,
        clearPendingWorkoutUpsertIds,
        clearPendingWorkoutDeleteIds,
      }
    );
    return;
  }
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
    markPendingWorkoutDeleteIds(staleIds);
    await runSupabaseWrite(
      _SB
        .from('workouts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .in('client_workout_id', staleIds),
      'Failed to prune workout rows during snapshot replace',
      {
        ...opts,
        pendingWorkoutDeleteIds: uniqueDocKeys([
          ...(opts.pendingWorkoutDeleteIds || []),
          ...staleIds,
        ]),
      }
    );
  } catch (e) {
    logWarn('Failed to replace workout table snapshot', e);
  }
}

async function pullWorkoutsFromTable(fallbackWorkouts) {
  const runtime = getWorkoutPersistenceRuntime();
  if (typeof runtime?.pullWorkoutsFromTable === 'function') {
    const result = await runtime.pullWorkoutsFromTable(
      {
        fallbackWorkouts,
        currentUser,
        cloudSyncEnabled: isCloudSyncEnabled(),
      },
      {
        supabaseClient: _SB,
        runSupabaseWrite,
        logWarn,
      }
    );
    if (
      result.shouldMarkWorkoutTableReady &&
      !isWorkoutTableReady(profile)
    ) {
      profile.syncMeta = {
        ...(profile.syncMeta || {}),
        workoutsTableReady: true,
      };
      await saveProfileData({ docKeys: [PROFILE_CORE_DOC_KEY] });
    }
    return {
      usedTable: result.usedTable === true,
      didBackfill: result.didBackfill === true,
      workouts: Array.isArray(result.workouts)
        ? result.workouts
        : fallbackWorkouts,
    };
  }
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

async function pushToCloud(options) {
  try {
    return await requireSyncRuntimeMethod('pushToCloud', { toast: false })(
      options,
      getSyncRuntimeDeps()
    );
  } catch (_error) {
    return false;
  }
}

async function flushPendingCloudSync() {
  try {
    return await requireSyncRuntimeMethod('flushPendingCloudSync', {
      toast: false,
    })(getSyncRuntimeDeps());
  } catch (_error) {
    return false;
  }
}

async function pullFromCloud(options) {
  try {
    return await requireSyncRuntimeMethod('pullFromCloud', { toast: false })(
      options,
      getSyncRuntimeDeps()
    );
  } catch (_error) {
    return { usedCloud: false, usedDocs: false, requiresBootstrapFinalize: false };
  }
}

async function runCloudSyncHealthCheck(options) {
  const opts = options || {};
  const checkedAt = new Date().toISOString();
  const checks = [];
  function done(name, ok, error) {
    const entry = {
      name,
      ok: ok === true,
      code:
        error && typeof error === 'object'
          ? sanitizeSyncDiagnosticText(error.code || error.status || error.name, 64)
          : '',
      message:
        error === undefined || error === null
          ? ''
          : sanitizeSyncDiagnosticText(
              error && typeof error === 'object'
                ? error.message || error.error_description || error.error || error
                : error,
              160
            ),
    };
    checks.push(entry);
    return entry;
  }
  function finish(ok, reason) {
    const result = {
      ok: ok === true,
      reason: sanitizeSyncDiagnosticText(reason, 80),
      checkedAt,
      checks,
    };
    if (result.ok) recordCloudSyncSuccess();
    else recordCloudSyncError('Cloud sync health check', {
      code: result.reason,
      message:
        checks.find((check) => check.ok === false)?.message ||
        result.reason ||
        'Cloud health check failed',
    });
    return result;
  }

  if (!currentUser || !currentUser.id) {
    done('session', false, { code: 'missing_user', message: 'No signed-in user' });
    return finish(false, 'missing_user');
  }

  try {
    const sessionResult =
      typeof _SB.auth?.getSession === 'function'
        ? await _SB.auth.getSession()
        : { data: { session: null }, error: null };
    if (sessionResult?.error) {
      done('session', false, sessionResult.error);
      return finish(false, 'session_error');
    }
    const sessionUserId = sessionResult?.data?.session?.user?.id || '';
    if (!sessionUserId) {
      done('session', false, {
        code: 'missing_session',
        message: 'No active Supabase session',
      });
      return finish(false, 'missing_session');
    }
    done('session', true);
  } catch (error) {
    done('session', false, error);
    return finish(false, 'session_error');
  }

  async function readTable(tableName, columns) {
    try {
      let query = _SB.from(tableName).select(columns).eq('user_id', currentUser.id);
      if (typeof query.limit === 'function') query = query.limit(1);
      const result = await query;
      if (result?.error) {
        done(tableName, false, result.error);
        return false;
      }
      done(tableName, true);
      return true;
    } catch (error) {
      done(tableName, false, error);
      return false;
    }
  }

  const docsOk = await readTable('profile_documents', 'doc_key');
  const workoutsOk = await readTable('workouts', 'client_workout_id');

  let rpcOk = false;
  try {
    const result =
      typeof _SB.rpc === 'function'
        ? await _SB.rpc('upsert_profile_documents_if_newer', { _docs: [] })
        : { error: { code: 'missing_rpc', message: 'Supabase RPC is unavailable' } };
    if (result?.error) {
      done('upsert_profile_documents_if_newer', false, result.error);
    } else {
      done('upsert_profile_documents_if_newer', true);
      rpcOk = true;
    }
  } catch (error) {
    done('upsert_profile_documents_if_newer', false, error);
  }

  if (opts.notifyUser !== false && typeof showToast === 'function') {
    showToast(
      docsOk && workoutsOk && rpcOk
        ? i18nText('settings.sync.health_ok', 'Cloud connection looks healthy.')
        : i18nText(
            'settings.sync.health_failed',
            'Cloud sync still needs attention.'
          ),
      docsOk && workoutsOk && rpcOk ? 'var(--blue)' : 'var(--orange)'
    );
  }

  return finish(docsOk && workoutsOk && rpcOk, 'checked');
}

async function replayPendingWorkoutSync(options) {
  const opts = { ...(options || {}), notifyUser: false };
  if (!currentUser || !isCloudSyncEnabled() || isBrowserOffline()) return false;
  const upsertIds = getPendingWorkoutUpsertIds();
  const deleteIds = getPendingWorkoutDeleteIds();
  let ok = true;

  if (upsertIds.length) {
    const wanted = new Set(upsertIds);
    const pendingWorkouts = (Array.isArray(workouts) ? workouts : []).filter(
      (workout) => wanted.has(workoutClientId(workout))
    );
    const foundIds = new Set(pendingWorkouts.map(workoutClientId));
    const missingIds = upsertIds.filter((id) => !foundIds.has(id));
    if (missingIds.length) clearPendingWorkoutUpsertIds(missingIds);
    if (pendingWorkouts.length) {
      await upsertWorkoutRecords(pendingWorkouts, {
        ...opts,
        pendingWorkoutUpsertIds: pendingWorkouts.map(workoutClientId),
      });
      ok = getPendingWorkoutUpsertIds().length === 0 && ok;
    }
  }

  for (const workoutId of deleteIds) {
    await softDeleteWorkoutRecord(workoutId, {
      ...opts,
      pendingWorkoutDeleteIds: [workoutId],
    });
  }
  ok = getPendingWorkoutDeleteIds().length === 0 && ok;
  return ok;
}

async function retryCloudSync(options) {
  const opts = options || {};
  if (!currentUser || !isCloudSyncEnabled()) {
    setSyncStatus(isBrowserOffline() ? 'offline' : 'idle');
    return { ok: false, reason: 'not_signed_in' };
  }
  if (isBrowserOffline()) {
    setSyncStatus('offline');
    return { ok: false, reason: 'offline' };
  }
  setSyncStatus('syncing');
  const health = await runCloudSyncHealthCheck({ notifyUser: false });
  if (!health.ok) {
    setSyncStatus('error');
    if (opts.notifyUser !== false && typeof showToast === 'function') {
      showToast(
        i18nText(
          'settings.sync.retry_failed',
          'Cloud sync is still failing. Local changes are safe on this device.'
        ),
        'var(--orange)'
      );
    }
    return { ok: false, reason: health.reason || 'health_failed', health };
  }
  const flushed = await flushPendingCloudSync();
  if (!flushed) {
    setSyncStatus('error');
    return { ok: false, reason: 'flush_failed', health };
  }
  setSyncStatus('synced');
  recordCloudSyncSuccess();
  refreshSyncedUI({ toast: false });
  if (opts.notifyUser !== false && typeof showToast === 'function') {
    showToast(
      i18nText('settings.sync.retry_ok', 'Cloud sync is back up to date.'),
      'var(--blue)'
    );
  }
  return { ok: true, reason: 'synced', health };
}

async function resolveStaleProfileDocumentRejects(staleDocKeys) {
  try {
    return await requireSyncRuntimeMethod(
      'resolveStaleProfileDocumentRejects',
      { toast: false }
    )(staleDocKeys, getSyncRuntimeDeps());
  } catch (_error) {
    return false;
  }
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
  try {
    return requireSyncRuntimeMethod('teardownRealtimeSync', { toast: false })(
      getSyncRuntimeDeps()
    );
  } catch (_error) {}
}

async function applyRealtimeSync(reason) {
  try {
    return await requireSyncRuntimeMethod('applyRealtimeSync', { toast: false })(
      reason,
      getSyncRuntimeDeps()
    );
  } catch (_error) {}
}

function scheduleRealtimeSync(reason) {
  try {
    return requireSyncRuntimeMethod('scheduleRealtimeSync', { toast: false })(
      reason,
      getSyncRuntimeDeps()
    );
  } catch (_error) {}
}

function setupRealtimeSync() {
  try {
    return requireSyncRuntimeMethod('setupRealtimeSync', { toast: false })(
      getSyncRuntimeDeps()
    );
  } catch (_error) {}
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
  if (document.hidden) {
    void flushPendingCloudSync();
    return;
  }
  if (currentUser && !isBrowserOffline()) {
    void flushPendingCloudSync();
  }
});
window.addEventListener('pagehide', () => {
  void flushPendingCloudSync();
});

// Auth-runtime now owns login/signup/logout directly.
// Expose lifecycle helpers that auth-runtime calls via window.*:
window.setupRealtimeSync = setupRealtimeSync;
window.teardownRealtimeSync = teardownRealtimeSync;
window.resetRuntimeState = resetRuntimeState;
window.retryCloudSync = retryCloudSync;
window.runCloudSyncHealthCheck = runCloudSyncHealthCheck;
window.getLastSyncDiagnostics = getLastSyncDiagnostics;
window.getSyncStatusState = getSyncStatusState;
