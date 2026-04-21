const APP_VERSION = '1.0.0';
window.__IRONFORGE_APP_VERSION__ = APP_VERSION;
let DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function refreshDayNames() {
  DAY_NAMES = [
    tr('day.sun.short', 'Sun'),
    tr('day.mon.short', 'Mon'),
    tr('day.tue.short', 'Tue'),
    tr('day.wed.short', 'Wed'),
    tr('day.thu.short', 'Thu'),
    tr('day.fri.short', 'Fri'),
    tr('day.sat.short', 'Sat'),
  ];
}

// SUPABASE
const SUPABASE_URL = 'https://koreqcjrpzcbfgkptvfx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_Ccuq9Bwyxmyy4JfrWqXlhg_qiWmCYpn';

function isStandaloneDisplayMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

window.__IRONFORGE_SUPABASE_URL__ = SUPABASE_URL;
window.__IRONFORGE_SUPABASE_PUBLISHABLE_KEY__ = SUPABASE_PUBLISHABLE_KEY;
window.__IRONFORGE_LOGIN_DEBUG__?.trace?.('supabase config ready', {
  standalone: isStandaloneDisplayMode(),
});
function getSharedSupabaseClient() {
  if (window.__IRONFORGE_SUPABASE__?.auth) {
    return window.__IRONFORGE_SUPABASE__;
  }
  if (typeof window.__IRONFORGE_GET_SUPABASE_CLIENT__ === 'function') {
    try {
      return window.__IRONFORGE_GET_SUPABASE_CLIENT__();
    } catch (_error) {
      return null;
    }
  }
  return null;
}

const _SB = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSharedSupabaseClient();
      if (!client) return undefined;
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }
);
let currentUser = null;

// STATE (persisted via localStorage)
let workouts = [];
let schedule = {
  sportName: '',
  sportDays: [],
  sportIntensity: 'hard',
  sportLegsHeavy: true,
};
let profile = {
  defaultRest: 120,
  language: window.I18N && I18N.getLanguage ? I18N.getLanguage() : 'en',
  preferences: getDefaultTrainingPreferences(),
  coaching: getDefaultCoachingProfile(),
};
let activeWorkout = null,
  workoutTimer = null,
  workoutSeconds = 0;
let restSecondsLeft = 0,
  restTotal = 0,
  restDuration = 120,
  restEndsAt = 0,
  restBarActive = false;
let exerciseIndex = {};
let _appViewportSyncTimeout = null;
let _appViewportBurstTimeouts = [];
const IS_E2E_TEST_ENV =
  window.__IRONFORGE_TEST_USER_ID__ === 'e2e-user' ||
  window.navigator.webdriver === true;

if (IS_E2E_TEST_ENV) {
  document.documentElement.classList.add('test-env');
}

Object.defineProperties(window, {
  restDuration: {
    configurable: true,
    get() {
      return restDuration;
    },
    set(value) {
      restDuration = Number(value) || 0;
    },
  },
  restTotal: {
    configurable: true,
    get() {
      return restTotal;
    },
    set(value) {
      restTotal = Number(value) || 0;
    },
  },
  restEndsAt: {
    configurable: true,
    get() {
      return restEndsAt;
    },
    set(value) {
      restEndsAt = Number(value) || 0;
    },
  },
  restSecondsLeft: {
    configurable: true,
    get() {
      return restSecondsLeft;
    },
    set(value) {
      restSecondsLeft = Number(value) || 0;
    },
  },
  restBarActive: {
    configurable: true,
    get() {
      return restBarActive;
    },
    set(value) {
      restBarActive = value === true;
    },
  },
});

function cloneLegacyRuntimeStateValue(value) {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return value;
  }
}

function readLegacyRuntimeField(name) {
  switch (name) {
    case 'currentUser':
      return cloneLegacyRuntimeStateValue(currentUser);
    case 'workouts':
      return cloneLegacyRuntimeStateValue(workouts);
    case 'schedule':
      return cloneLegacyRuntimeStateValue(schedule);
    case 'profile':
      return cloneLegacyRuntimeStateValue(profile);
    case 'activeWorkout':
      return cloneLegacyRuntimeStateValue(activeWorkout);
    case 'restDuration':
      return restDuration;
    case 'restTotal':
      return restTotal;
    case 'restEndsAt':
      return restEndsAt;
    case 'restSecondsLeft':
      return restSecondsLeft;
    case 'restBarActive':
      return restBarActive;
    default:
      return undefined;
  }
}

function writeLegacyRuntimeField(name, value) {
  const nextValue = cloneLegacyRuntimeStateValue(value);
  switch (name) {
    case 'currentUser':
      currentUser = nextValue || null;
      window.currentUser = cloneLegacyRuntimeStateValue(currentUser);
      break;
    case 'workouts':
      workouts = Array.isArray(nextValue) ? nextValue : [];
      window.workouts = cloneLegacyRuntimeStateValue(workouts);
      break;
    case 'schedule':
      schedule = nextValue || null;
      window.schedule = cloneLegacyRuntimeStateValue(schedule);
      break;
    case 'profile':
      profile = nextValue || null;
      window.profile = cloneLegacyRuntimeStateValue(profile);
      break;
    case 'activeWorkout':
      activeWorkout = nextValue || null;
      window.activeWorkout = cloneLegacyRuntimeStateValue(activeWorkout);
      break;
    case 'restDuration':
      restDuration = Number(nextValue) || 0;
      window.restDuration = restDuration;
      break;
    case 'restTotal':
      restTotal = Number(nextValue) || 0;
      window.restTotal = restTotal;
      break;
    case 'restEndsAt':
      restEndsAt = Number(nextValue) || 0;
      window.restEndsAt = restEndsAt;
      break;
    case 'restSecondsLeft':
      restSecondsLeft = Number(nextValue) || 0;
      window.restSecondsLeft = restSecondsLeft;
      break;
    case 'restBarActive':
      restBarActive = nextValue === true;
      window.restBarActive = restBarActive;
      break;
    default:
      break;
  }
}

window.__IRONFORGE_LEGACY_RUNTIME_ACCESS__ = {
  read(name) {
    return readLegacyRuntimeField(name);
  },
  write(name, value) {
    writeLegacyRuntimeField(name, value);
  },
};

window.__IRONFORGE_GET_LEGACY_RUNTIME_STATE__ = function () {
  return (
    window.__IRONFORGE_APP_RUNTIME__?.getLegacyRuntimeState?.() || {
      currentUser: cloneLegacyRuntimeStateValue(currentUser),
      workouts: cloneLegacyRuntimeStateValue(workouts),
      schedule: cloneLegacyRuntimeStateValue(schedule),
      profile: cloneLegacyRuntimeStateValue(profile),
      activeWorkout: cloneLegacyRuntimeStateValue(activeWorkout),
    }
  );
};

window.__IRONFORGE_SET_LEGACY_RUNTIME_STATE__ = function (partial) {
  if (window.__IRONFORGE_APP_RUNTIME__?.setLegacyRuntimeState) {
    window.__IRONFORGE_APP_RUNTIME__.setLegacyRuntimeState(partial);
    return;
  }
  if (!partial || typeof partial !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(partial, 'currentUser')) {
    writeLegacyRuntimeField('currentUser', partial.currentUser);
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'workouts')) {
    writeLegacyRuntimeField('workouts', partial.workouts);
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'schedule')) {
    writeLegacyRuntimeField('schedule', partial.schedule);
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'profile')) {
    writeLegacyRuntimeField('profile', partial.profile);
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'activeWorkout')) {
    writeLegacyRuntimeField('activeWorkout', partial.activeWorkout);
  }
};

function getProfileStoreBridge() {
  return window.__IRONFORGE_PROFILE_STORE__ || null;
}

function requireProfileStoreBridgeMethod(methodName) {
  const bridge = getProfileStoreBridge();
  const method = bridge?.[methodName];
  if (typeof method === 'function') {
    return method.bind(bridge);
  }
  throw new Error(
    '[Ironforge] Profile store bridge is required before legacy profile/program writes.'
  );
}

function setStoreOwnedProfile(nextProfile) {
  return requireProfileStoreBridgeMethod('setProfile')(nextProfile);
}

function updateStoreOwnedProfile(patch) {
  return requireProfileStoreBridgeMethod('updateProfile')(patch || {});
}

function setStoreOwnedSchedule(nextSchedule) {
  return requireProfileStoreBridgeMethod('setSchedule')(nextSchedule);
}

function updateStoreOwnedSchedule(patch) {
  return requireProfileStoreBridgeMethod('updateSchedule')(patch || {});
}

function setStoreOwnedActiveProgram(programId) {
  return requireProfileStoreBridgeMethod('setActiveProgram')(programId);
}

function setStoreOwnedProgramState(programId, state) {
  return requireProfileStoreBridgeMethod('setProgramState')(programId, state);
}

function getRuntimeBridge() {
  return window.__IRONFORGE_RUNTIME_BRIDGE__ || null;
}

function isStoreBackedSettingsSurfaceActive() {
  const bridge = getRuntimeBridge();
  return !!bridge && typeof bridge.setActiveSettingsTab === 'function';
}

function setRestBarActiveState(nextActive) {
  restBarActive = nextActive === true;
  window.restBarActive = restBarActive;
  if (typeof window.syncWorkoutSessionBridge === 'function') {
    window.syncWorkoutSessionBridge();
  }
}

window.setRestBarActiveState = setRestBarActiveState;

function buildLiveWorkoutSessionSnapshot() {
  const overlaySnapshot =
    typeof window.getWorkoutOverlaySnapshot === 'function'
      ? window.getWorkoutOverlaySnapshot()
      : null;
  return (
    getWorkoutRestRuntime()?.buildWorkoutSessionSnapshot?.({
      activeWorkout,
      restDuration,
      restEndsAt,
      restSecondsLeft,
      restTotal,
      currentUser,
      restBarActive,
      rpePrompt:
        overlaySnapshot && typeof overlaySnapshot === 'object'
          ? overlaySnapshot.rpePrompt || null
          : null,
      summaryPrompt:
        overlaySnapshot && typeof overlaySnapshot === 'object'
          ? overlaySnapshot.summaryPrompt || null
          : null,
      sportCheckPrompt:
        overlaySnapshot && typeof overlaySnapshot === 'object'
          ? overlaySnapshot.sportCheckPrompt || null
          : typeof window.getSportCheckPromptSnapshot === 'function'
            ? window.getSportCheckPromptSnapshot()
            : null,
      exerciseGuidePrompt:
        overlaySnapshot && typeof overlaySnapshot === 'object'
          ? overlaySnapshot.exerciseGuidePrompt || null
          : typeof window.getExerciseGuidePromptSnapshot === 'function'
            ? window.getExerciseGuidePromptSnapshot()
            : null,
    }) || null
  );
}

function syncWorkoutSessionBridge() {
  const bridge = getRuntimeBridge();
  if (!bridge || typeof bridge.setWorkoutSessionState !== 'function') return;
  const snapshot = buildLiveWorkoutSessionSnapshot();
  if (!snapshot) return;
  bridge.setWorkoutSessionState(snapshot);
}

window.syncWorkoutSessionBridge = syncWorkoutSessionBridge;

function getWorkoutOverlaySnapshot() {
  return {
    rpePrompt: null,
    summaryPrompt: null,
    sportCheckPrompt:
      typeof window.getSportCheckPromptSnapshot === 'function'
        ? window.getSportCheckPromptSnapshot()
        : null,
    exerciseGuidePrompt:
      typeof window.getExerciseGuidePromptSnapshot === 'function'
        ? window.getExerciseGuidePromptSnapshot()
        : null,
  };
}

window.getWorkoutOverlaySnapshot = getWorkoutOverlaySnapshot;

function getDefaultSportName() {
  const locale = window.I18N && I18N.getLanguage ? I18N.getLanguage() : 'en';
  return locale === 'fi' ? 'Kestävyys' : 'Cardio';
}

function isLegacyDefaultSportName(name) {
  const raw = String(name || '')
    .trim()
    .toLowerCase();
  return (
    raw === 'hockey' ||
    raw === 'jääkiekko' ||
    raw === 'cardio' ||
    raw === 'sport' ||
    raw === 'urheilu' ||
    raw === 'kestävyys'
  );
}

function exerciseLookupKeys(exercise) {
  if (!exercise) return [];
  const src = typeof exercise === 'string' ? { name: exercise } : exercise;
  const keys = [];
  const id =
    src.exerciseId ||
    (typeof window.resolveRegisteredExerciseId === 'function'
      ? window.resolveRegisteredExerciseId(src.name)
      : null);
  if (id) keys.push('id:' + id);
  if (src.name) keys.push('name:' + String(src.name).trim().toLowerCase());
  return keys;
}

function buildExerciseIndex() {
  exerciseIndex = {};
  workouts.forEach((workout) => {
    (workout.exercises || []).forEach((exercise) => {
      const ts = new Date(workout.date).getTime();
      exerciseLookupKeys(exercise).forEach((key) => {
        const prev = exerciseIndex[key];
        if (!prev || ts > prev.ts) {
          exerciseIndex[key] = { sets: exercise.sets, date: workout.date, ts };
        }
      });
    });
  });
}

function getPreviousSets(exercise) {
  const keys = exerciseLookupKeys(exercise);
  for (let index = 0; index < keys.length; index += 1) {
    const hit = exerciseIndex[keys[index]];
    if (hit?.sets) return hit.sets;
  }
  return null;
}

function getSuggested(exercise) {
  const previousSets = getPreviousSets(exercise);
  if (!previousSets?.length) return null;
  const max = Math.max(
    ...previousSets.map((set) => parseFloat(set.weight) || 0)
  );
  return previousSets.every((set) => set.done)
    ? Math.round((max + 2.5) * 2) / 2
    : max;
}

function getScheduleSportNameValue(scheduleLike) {
  if (!scheduleLike || typeof scheduleLike !== 'object') return '';
  return String(scheduleLike.sportName || '').trim();
}

function getScheduleStatusName(scheduleLike) {
  return (
    getScheduleSportNameValue(scheduleLike) ||
    tr('settings.status.generic_sport', 'Sport / cardio')
  );
}

function applyStandaloneViewportLock() {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (!isStandalone) return;
  const viewport = document.getElementById('app-viewport');
  if (!viewport) return;
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
  );
}

function syncAppViewportHeight() {
  const viewport = window.visualViewport;
  const height = Math.round(
    (viewport && viewport.height) || window.innerHeight || 0
  );
  if (height > 0)
    document.documentElement.style.setProperty('--app-vh', height + 'px');
}

function scheduleAppViewportHeightSync(delay = 0) {
  clearTimeout(_appViewportSyncTimeout);
  _appViewportSyncTimeout = setTimeout(syncAppViewportHeight, delay);
}

function clearAppViewportBurstSync() {
  while (_appViewportBurstTimeouts.length) {
    clearTimeout(_appViewportBurstTimeouts.pop());
  }
}

function scheduleAppViewportHeightBurstSync(delays) {
  const steps =
    Array.isArray(delays) && delays.length ? delays : [0, 80, 180, 320, 480];
  clearAppViewportBurstSync();
  steps.forEach((delay) => {
    const handle = setTimeout(syncAppViewportHeight, delay);
    _appViewportBurstTimeouts.push(handle);
  });
}

function isViewportSensitiveTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.matches('input,textarea,select,[contenteditable="true"]'))
    return true;
  return !!target.closest('[contenteditable="true"]');
}

applyStandaloneViewportLock();
syncAppViewportHeight();
window.addEventListener('resize', () => scheduleAppViewportHeightSync());
window.addEventListener('orientationchange', () =>
  scheduleAppViewportHeightSync(120)
);
window.addEventListener('pageshow', () => scheduleAppViewportHeightSync());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleAppViewportHeightSync();
});
document.addEventListener('focusin', (event) => {
  if (isViewportSensitiveTarget(event.target)) {
    scheduleAppViewportHeightBurstSync();
  }
});
document.addEventListener('focusout', () =>
  scheduleAppViewportHeightBurstSync([0, 120, 240, 360])
);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () =>
    scheduleAppViewportHeightSync()
  );
  window.visualViewport.addEventListener('scroll', () =>
    scheduleAppViewportHeightSync()
  );
}

const RPE_FEELS = {
  6: 'Easy',
  7: 'Moderate',
  8: 'Hard',
  9: 'Very Hard',
  10: 'Max',
};
const RPE_DESCS = {
  6: ['rpe.desc.6', 'Could keep going easily'],
  7: ['rpe.desc.7', 'Comfortable effort'],
  8: ['rpe.desc.8', 'Challenging but controlled'],
  9: ['rpe.desc.9', 'Maybe 1 rep left'],
  10: ['rpe.desc.10', 'Nothing left'],
};
function logWarn(context, error) {
  console.warn('[Ironforge]', context, error);
}
function tr(key, fallback, params) {
  if (window.I18N) return I18N.t(key, params, fallback);
  return fallback;
}

refreshDayNames();

// LOGIN SPARKS CANVAS
let loginSparks = null;

function getLoginSparksController() {
  if (loginSparks) return loginSparks;
  if (typeof window.createLoginSparksController !== 'function') return null;
  const canvas = document.getElementById('sparks');
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  loginSparks = window.createLoginSparksController();
  return loginSparks;
}

window.startLoginSparks = () => getLoginSparksController()?.start?.();
window.stopLoginSparks = () => loginSparks?.stop?.();

function playForgeBurst(canvas, options) {
  const target = canvas instanceof HTMLCanvasElement ? canvas : null;
  if (!target) return () => {};
  const ctx = target.getContext('2d');
  if (!ctx) return () => {};

  const prefersReducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('test-env');
  if (prefersReducedMotion) {
    const rect = target.getBoundingClientRect();
    const width = Math.max(
      1,
      Math.floor(rect.width || target.clientWidth || 1)
    );
    const height = Math.max(
      1,
      Math.floor(rect.height || target.clientHeight || 1)
    );
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.75));
    target.width = Math.floor(width * dpr);
    target.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return () => ctx.clearRect(0, 0, width, height);
  }

  const COLOR_A = [255, 122, 58];
  const COLOR_B = [255, 176, 103];
  const config = {
    densityMultiplier: 1,
    duration: 980,
    originX: 0.5,
    originY: 0.84,
    glowFrom: 0.18,
    glowTo: 0.4,
    palette: null,
    ...(options || {}),
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const emberColor = (t, alpha) => {
    const palette =
      Array.isArray(config.palette) && config.palette.length >= 2
        ? config.palette
        : [COLOR_A, COLOR_B];
    const start = palette[0];
    const end = palette[Math.min(1, palette.length - 1)] || palette[0];
    const r = Math.round(lerp(start[0], end[0], t));
    const g = Math.round(lerp(start[1], end[1], t));
    const b = Math.round(lerp(start[2], end[2], t));
    return `rgba(${r},${g},${b},${alpha})`;
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let rafId = 0;
  let startTs = 0;
  let lastTs = 0;
  let embers = [];

  function resize() {
    const rect = target.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width || target.clientWidth || 1));
    height = Math.max(1, Math.floor(rect.height || target.clientHeight || 1));
    dpr = clamp(window.devicePixelRatio || 1, 1, 1.75);
    target.width = Math.floor(width * dpr);
    target.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildEmbers() {
    const total = Math.max(
      18,
      Math.round(32 * (parseFloat(config.densityMultiplier) || 1))
    );
    const originX = width * (parseFloat(config.originX) || 0.5);
    const originY = height * (parseFloat(config.originY) || 0.84);
    embers = Array.from({ length: total }, (_, index) => {
      const spread = Math.PI * (0.65 + Math.random() * 0.4);
      const baseAngle =
        -Math.PI / 2 + (index / Math.max(1, total - 1) - 0.5) * spread;
      const angle = baseAngle + (Math.random() - 0.5) * 0.32;
      const speed = 190 + Math.random() * 210;
      const lift = 0.72 + Math.random() * 0.4;
      return {
        x: originX + (Math.random() - 0.5) * 28,
        y: originY + Math.random() * 18,
        vx: Math.cos(angle) * speed * 0.55,
        vy: Math.sin(angle) * speed * lift,
        gravity: 140 + Math.random() * 70,
        drag: 0.9 + Math.random() * 0.06,
        size: 1.6 + Math.random() * 3,
        alpha: 0.42 + Math.random() * 0.42,
        life: 0.62 + Math.random() * 0.38,
        age: 0,
        t: Math.random(),
      };
    });
  }

  function cleanup() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    ctx.clearRect(0, 0, width, height);
  }

  function draw(ts) {
    if (!startTs) {
      startTs = ts;
      lastTs = ts;
    }
    const dt = Math.min((ts - lastTs) / 1000, 0.033);
    lastTs = ts;
    const elapsed = ts - startTs;
    const progress = clamp(
      elapsed / (parseFloat(config.duration) || 980),
      0,
      1
    );
    const glowStrength = lerp(
      config.glowFrom,
      config.glowTo,
      easeOutCubic(Math.min(1, elapsed / 600))
    );

    ctx.clearRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(
      width * (parseFloat(config.originX) || 0.5),
      height * (parseFloat(config.originY) || 0.84),
      10,
      width * (parseFloat(config.originX) || 0.5),
      height * (parseFloat(config.originY) || 0.84),
      height * 0.26
    );
    glow.addColorStop(
      0,
      `rgba(255,132,46,${(glowStrength * (1 - progress * 0.3)).toFixed(3)})`
    );
    glow.addColorStop(
      0.45,
      `rgba(255,120,40,${(glowStrength * 0.52).toFixed(3)})`
    );
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    let alive = 0;
    for (let i = 0; i < embers.length; i++) {
      const ember = embers[i];
      ember.age += dt;
      const lifeProgress = clamp(ember.age / ember.life, 0, 1);
      if (lifeProgress >= 1) continue;
      alive++;
      ember.vx *= ember.drag;
      ember.vy += ember.gravity * dt;
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      const alpha = ember.alpha * (1 - lifeProgress) * (1 - progress * 0.16);
      if (alpha <= 0.01) continue;
      ctx.beginPath();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = emberColor(ember.t, alpha);
      ctx.shadowColor = emberColor(ember.t, alpha * 0.8);
      ctx.shadowBlur = 6;
      ctx.arc(
        ember.x,
        ember.y,
        ember.size * (1 - lifeProgress * 0.2),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (progress < 1 && alive > 0) {
      rafId = requestAnimationFrame(draw);
      return;
    }
    cleanup();
  }

  resize();
  buildEmbers();
  rafId = requestAnimationFrame(draw);
  window.addEventListener('resize', resize, { once: true });
  return cleanup;
}

window.playForgeBurst = playForgeBurst;

// PROGRAM REGISTRY
// Programs (loaded via <script> tags after this file) call registerProgram() to self-register.
// Program registry/state helpers moved to core/program-layer.js.

// FATIGUE + MUSCLE LOAD CONFIG
// Separate from program definitions - these are app-wide constants
const FATIGUE_CONFIG = {
  lookbackDays: 10,
  muscularHalfLifeDays: 4.5,
  cnsHalfLifeDays: 3.25,
  lift: {
    muscularBase: 8,
    muscularSetWeight: 1.9,
    muscularRpeWeight: 4,
    cnsBase: 10,
    cnsSetWeight: 1.05,
    cnsRpeWeight: 7,
    loadFactorDivisor: 200,
    loadFactorMaxBonus: 0.35,
    repFactorPerRepFromFive: 0.05,
    repFactorMin: 0.9,
    repFactorMax: 1.25,
    sessionCap: 70,
  },
  sport: {
    easy: { muscular: 6, cns: 5 },
    moderate: { muscular: 11, cns: 9 },
    hard: { muscular: 17, cns: 14 },
    durationMin: 0.75,
    durationMax: 1.5,
    effortBase: 0.85,
    effortPerRpeAboveSix: 0.12,
    effortMax: 1.33,
    extraSubtypeCnsMultiplier: 1.15,
  },
};
const MUSCLE_LOAD_CONFIG = {
  lookbackDays: 7,
  halfLifeDays: 3.5,
  displayLimit: 3,
  thresholds: { high: 8, moderate: 4, light: 1.5 },
  liftPrimaryWeight: 1,
  liftSecondaryWeight: 0.5,
  liftRpeScaleBase: 0.8,
  liftRpeScalePerPoint: 0.16,
  liftRpeScaleMax: 1.6,
};
const SPORT_RECENT_HOURS = {
  easy: 18,
  moderate: 24,
  hard: 30,
};
window.FATIGUE_CONFIG = FATIGUE_CONFIG;
window.MUSCLE_LOAD_CONFIG = MUSCLE_LOAD_CONFIG;

function getAppRuntime() {
  return window.__IRONFORGE_APP_RUNTIME__ || null;
}

function getSportConfig() {
  return (
    FATIGUE_CONFIG.sport[schedule.sportIntensity || 'hard'] ||
    FATIGUE_CONFIG.sport.hard
  );
}
function getSportRecentHours() {
  return (
    SPORT_RECENT_HOURS[schedule.sportIntensity || 'hard'] ||
    SPORT_RECENT_HOURS.hard
  );
}

// Data/auth lifecycle functions moved to core/data-layer.js.

// REST TIMER
// Typed owner: src/stores/workout-store.ts (startRestTimer, skipRest, syncRestTimer,
// updateRestDuration, playWorkoutRestBeep). Delegates installed by
// installLegacyWorkoutStoreBridge() at boot via main.tsx.
//
// getSelectedRestDuration is kept here because core/workout-layer.js calls it as a
// plain local function (not via window.*), so it cannot be replaced by a bridge delegate.
// All other rest-timer functions below are pure compatibility guards — the typed store
// implementation runs in every case.

function getWorkoutRestRuntime() {
  return window.__IRONFORGE_WORKOUT_RUNTIME__ || null;
}

function getSelectedRestDuration() {
  const inputValue = parseInt(
    document.getElementById('rest-duration')?.value,
    10
  );
  if (Number.isFinite(inputValue)) return inputValue;
  return parseInt(restDuration, 10) || profile.defaultRest || 120;
}

function updateRestDuration(nextValue) {
  if (
    typeof window.updateRestDuration === 'function' &&
    window.updateRestDuration !== updateRestDuration
  ) {
    return window.updateRestDuration(nextValue);
  }
}
window.getSelectedRestDuration = getSelectedRestDuration;

function syncRestTimer() {
  if (
    typeof window.syncRestTimer === 'function' &&
    window.syncRestTimer !== syncRestTimer
  ) {
    return window.syncRestTimer();
  }
}

function startRestTimer() {
  if (
    typeof window.startRestTimer === 'function' &&
    window.startRestTimer !== startRestTimer
  ) {
    return window.startRestTimer();
  }
}

function skipRest() {
  if (typeof window.skipRest === 'function' && window.skipRest !== skipRest) {
    return window.skipRest();
  }
}
// playBeep removed — typed equivalent is playWorkoutRestBeep() in workout-store.ts.

// FATIGUE ENGINE
// Dashboard/fatigue/data helpers moved to core/dashboard-layer.js.

// Workout/session engine moved to core/workout-layer.js.

// HISTORY
// History/analytics helpers moved to core/history-layer.js.

// SETTINGS
// renderSportDayToggles, setSportIntensity, renderProgramBasics, renderTrainingProgramSummary,
// renderSportStatusBar, renderTrainingStatusBar, renderProgramStatusBar, initSettings, toggleDay,
// openProgramSetupSheet, runProgramSetupInlineAction, bindProgramSetupSheetActions, closeProgramSetupSheet
// are legacy DOM render helpers still called by app-runtime.ts via callLegacyWindowFunction().
// They remain here until the settings islands fully own their own rendering without DOM helpers.
function renderSportDayToggles() {
  const grid = document.getElementById('sport-day-toggles');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const dow = (i + 1) % 7,
      active = schedule.sportDays.includes(dow);
    grid.innerHTML += `<div class="day-toggle ${active ? 'sport-day' : ''}" onclick="toggleDay('sport',${dow},this)">${DAY_NAMES[dow]}</div>`;
  }
  if (
    typeof isSettingsScheduleIslandActive === 'function' &&
    isSettingsScheduleIslandActive()
  )
    notifySettingsScheduleIsland();
}
function setSportIntensity(val, el) {
  schedule = updateStoreOwnedSchedule({ sportIntensity: val });
  document
    .querySelectorAll('#sport-intensity-btns button')
    .forEach((b) => b.classList.remove('active'));
  if (el) el.classList.add('active');
  saveSchedule({ sportIntensity: val });
}
function showSettingsTab(name, el) {
  const nextTab = [
    'schedule',
    'preferences',
    'program',
    'account',
    'body',
  ].includes(name)
    ? name
    : 'schedule';
  getAppRuntime()?.showSettingsTab?.(nextTab);
}
function isSettingsAccountIslandActive() {
  return typeof getAppRuntime()?.syncSettingsAccountView === 'function';
}
function notifySettingsAccountIsland() {
  getAppRuntime()?.syncSettingsAccountView?.();
}
function isSettingsScheduleIslandActive() {
  return typeof getAppRuntime()?.syncSettingsScheduleView === 'function';
}
function notifySettingsScheduleIsland() {
  getAppRuntime()?.syncSettingsScheduleView?.();
}
function isSettingsProgramIslandActive() {
  return typeof getAppRuntime()?.syncSettingsProgramView === 'function';
}
function notifySettingsProgramIsland() {
  getAppRuntime()?.syncSettingsProgramView?.();
}
function isSettingsPreferencesIslandActive() {
  return typeof getAppRuntime()?.syncSettingsPreferencesView === 'function';
}
function notifySettingsPreferencesIsland() {
  getAppRuntime()?.syncSettingsPreferencesView?.();
}
function isSettingsBodyIslandActive() {
  return typeof getAppRuntime()?.syncSettingsBodyView === 'function';
}
function notifySettingsBodyIsland() {
  getAppRuntime()?.syncSettingsBodyView?.();
}
function openProgramSetupSheet() {
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  const container = document.getElementById('program-settings-container');
  if (container && prog.renderSettings) {
    bindProgramSetupSheetActions(container);
    prog.renderSettings(state, container);
  }
  const title = document.getElementById('program-setup-sheet-title');
  if (title) {
    const progName =
      window.I18N && I18N.t
        ? I18N.t('program.' + prog.id + '.name', null, prog.name)
        : prog.name;
    title.textContent =
      progName + ' ' + tr('settings.program_setup_suffix', 'Setup');
  }
  document.getElementById('program-setup-sheet').classList.add('active');
}
function runProgramSetupInlineAction(code, event) {
  const handler =
    window.__IRONFORGE_RUN_PROGRAM_SETTINGS_INLINE_ACTION__ || null;
  if (typeof handler !== 'function') return false;
  return handler(code, event);
}
function bindProgramSetupSheetActions(container) {
  if (!container || container.dataset.inlineActionBound === 'true') return;
  container.dataset.inlineActionBound = 'true';
  container.addEventListener('click', (event) => {
    const actionTarget = event.target?.closest?.('[onclick]');
    if (!actionTarget || !container.contains(actionTarget)) return;
    const code = actionTarget.getAttribute('onclick');
    if (!code) return;
    event.preventDefault();
    runProgramSetupInlineAction(code, event);
  });
  container.addEventListener('change', (event) => {
    const actionTarget = event.target?.closest?.('[onchange]');
    if (!actionTarget || !container.contains(actionTarget)) return;
    const code = actionTarget.getAttribute('onchange');
    if (!code) return;
    runProgramSetupInlineAction(code, event);
  });
}
let _programBasicsAutoSaveBound = false;
function renderProgramBasics(options) {
  const opts = options || {};
  const card = opts.card || document.getElementById('program-basics-panel');
  const container =
    opts.container || document.getElementById('program-basics-container');
  const summaryEl =
    opts.summaryEl || document.getElementById('program-basics-summary');
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  if (!card || !container) return;
  if (!opts.container && isSettingsProgramIslandActive()) {
    notifySettingsProgramIsland();
    return;
  }
  if (prog && prog.renderSimpleSettings) {
    card.style.display = '';
    prog.renderSimpleSettings(state, container);
    if (typeof getProgramFrequencyNoticeHTML === 'function') {
      const noticeHtml = getProgramFrequencyNoticeHTML(prog.id, profile);
      if (noticeHtml) container.insertAdjacentHTML('afterbegin', noticeHtml);
    }
    if (summaryEl)
      summaryEl.textContent = prog.getSimpleSettingsSummary
        ? prog.getSimpleSettingsSummary(state)
        : '';
    if (window.I18N && I18N.applyTranslations) I18N.applyTranslations(card);
    // Auto-save: delegate change events from program basics fields
    if (
      opts.bindAutoSave !== false &&
      container.isConnected &&
      !_programBasicsAutoSaveBound
    ) {
      _programBasicsAutoSaveBound = true;
      container.addEventListener('change', function (e) {
        if (
          e.target.matches(
            'select,input[type="number"],input[type="text"],input[type="checkbox"],input[type="hidden"]'
          )
        ) {
          saveSimpleProgramSettings();
        }
      });
    }
    if (opts.notifyIsland !== false && isSettingsProgramIslandActive())
      notifySettingsProgramIsland();
    return;
  }
  card.style.display = 'none';
  container.innerHTML = '';
  if (summaryEl) summaryEl.textContent = '';
  if (opts.notifyIsland !== false && isSettingsProgramIslandActive())
    notifySettingsProgramIsland();
}
function renderTrainingProgramSummary() {
  const summaryEl = document.getElementById('training-program-summary');
  const prog = getActiveProgram();
  if (isSettingsProgramIslandActive()) {
    notifySettingsProgramIsland();
    return;
  }
  if (!summaryEl || !prog) return;
  const progName =
    window.I18N && I18N.t
      ? I18N.t('program.' + prog.id + '.name', null, prog.name)
      : prog.name;
  const progDesc =
    window.I18N && I18N.t
      ? I18N.t(
          'program.' + prog.id + '.description',
          null,
          prog.description || ''
        )
      : prog.description || '';
  summaryEl.textContent = progDesc ? `${progName} · ${progDesc}` : progName;
  if (isSettingsProgramIslandActive()) notifySettingsProgramIsland();
}
function renderTrainingPreferencesSummary() {
  const summaryEl = document.getElementById('training-preferences-summary');
  if (summaryEl) summaryEl.textContent = getTrainingPreferencesSummary(profile);
  renderTrainingStatusBar();
  if (isSettingsPreferencesIslandActive()) notifySettingsPreferencesIsland();
}
function renderSportStatusBar() {
  const bar = document.getElementById('sport-status-bar');
  if (!bar) {
    if (isSettingsScheduleIslandActive()) notifySettingsScheduleIsland();
    return;
  }
  const name = getScheduleStatusName(schedule);
  const intensity = schedule.sportIntensity || 'hard';
  const intensityLabel = tr(
    'settings.intensity.' + intensity,
    intensity.charAt(0).toUpperCase() + intensity.slice(1)
  );
  const days = schedule.sportDays || [];
  const dayStr = days.length
    ? days
        .sort((a, b) => a - b)
        .map((d) => DAY_NAMES[d])
        .join(', ')
    : tr('settings.status.no_days', 'No days set');
  const segments = [name, intensityLabel, dayStr].filter(Boolean);
  bar.replaceChildren();
  segments.forEach((segment, index) => {
    if (index > 0) {
      const sep = document.createElement('span');
      sep.className = 'status-sep';
      sep.textContent = '·';
      bar.appendChild(sep);
    }
    bar.appendChild(document.createTextNode(segment));
  });
  if (isSettingsScheduleIslandActive()) notifySettingsScheduleIsland();
}
function renderTrainingStatusBar() {
  const bar = document.getElementById('training-status-bar');
  if (!bar) return;
  bar.textContent = getTrainingPreferencesSummary(profile);
}
function renderProgramStatusBar() {
  const bar = document.getElementById('program-status-bar');
  if (isSettingsProgramIslandActive()) {
    notifySettingsProgramIsland();
    return;
  }
  if (!bar) {
    if (isSettingsProgramIslandActive()) notifySettingsProgramIsland();
    return;
  }
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  if (!prog) {
    bar.textContent = '';
    return;
  }
  const progName =
    window.I18N && I18N.t
      ? I18N.t('program.' + prog.id + '.name', null, prog.name)
      : prog.name;
  const summary = prog.getSimpleSettingsSummary
    ? prog.getSimpleSettingsSummary(state)
    : '';
  const segments = summary ? [progName, summary] : [progName];
  bar.replaceChildren();
  segments.filter(Boolean).forEach((segment, index) => {
    if (index > 0) {
      const sep = document.createElement('span');
      sep.className = 'status-sep';
      sep.textContent = '·';
      bar.appendChild(sep);
    }
    bar.appendChild(document.createTextNode(segment));
  });
  if (isSettingsProgramIslandActive()) notifySettingsProgramIsland();
}

/* ── Onboarding bridge (UI is in src/app/OnboardingFlow.jsx) ── */
// Typed owner: src/app/services/app-runtime.ts (completeOnboarding, maybeOpenOnboarding, restartOnboarding, etc.)
// The functions below are thin compatibility delegates; the typed implementations are installed
// by installAppRuntimeBridge() at boot before any caller can reach these fallback paths.

let _onboardingRetryTimer = null;

function notifyOnboardingIsland() {
  if (
    typeof window.notifyOnboardingIsland === 'function' &&
    window.notifyOnboardingIsland !== notifyOnboardingIsland
  ) {
    return window.notifyOnboardingIsland();
  }
  window.dispatchEvent(new CustomEvent('ironforge:onboarding-updated'));
}

function closeOnboardingModal() {
  if (
    typeof window.closeOnboardingModal === 'function' &&
    window.closeOnboardingModal !== closeOnboardingModal
  ) {
    return window.closeOnboardingModal();
  }
}

function dismissOnboardingModal() {
  if (
    typeof window.dismissOnboardingModal === 'function' &&
    window.dismissOnboardingModal !== dismissOnboardingModal
  ) {
    return window.dismissOnboardingModal();
  }
}

async function completeOnboarding(draft) {
  if (
    typeof window.completeOnboarding === 'function' &&
    window.completeOnboarding !== completeOnboarding
  ) {
    return window.completeOnboarding(draft);
  }
}

function maybeOpenOnboarding(options) {
  if (
    typeof window.maybeOpenOnboarding === 'function' &&
    window.maybeOpenOnboarding !== maybeOpenOnboarding
  ) {
    return window.maybeOpenOnboarding(options);
  }
}

function restartOnboarding() {
  if (
    typeof window.restartOnboarding === 'function' &&
    window.restartOnboarding !== restartOnboarding
  ) {
    return window.restartOnboarding();
  }
}
function closeProgramSetupSheet(e) {
  if (!e || e.target.id === 'program-setup-sheet') {
    document.getElementById('program-setup-sheet').classList.remove('active');
  }
}
function initSettings() {
  refreshDayNames();
  {
    const inp = document.getElementById('sport-name');
    if (inp) inp.value = getScheduleSportNameValue(schedule);
  }
  {
    const btns = document.querySelectorAll('#sport-intensity-btns button');
    btns.forEach((b) => {
      b.classList.toggle(
        'active',
        b.dataset.intensity === (schedule.sportIntensity || 'hard')
      );
    });
  }
  {
    const cb = document.getElementById('sport-legs-heavy');
    if (cb) cb.checked = schedule.sportLegsHeavy !== false;
  }
  {
    const langSel = document.getElementById('app-language');
    if (langSel)
      langSel.value =
        profile.language ||
        (window.I18N && I18N.getLanguage ? I18N.getLanguage() : 'en');
  }
  {
    const prefs = normalizeTrainingPreferences(profile);
    const goalSel = document.getElementById('training-goal');
    if (goalSel) goalSel.value = prefs.goal;
    const trainingDaysSel = document.getElementById('training-days-per-week');
    if (trainingDaysSel)
      trainingDaysSel.value = String(prefs.trainingDaysPerWeek);
    const minutesSel = document.getElementById('training-session-minutes');
    if (minutesSel) minutesSel.value = String(prefs.sessionMinutes);
    const equipmentSel = document.getElementById('training-equipment');
    if (equipmentSel) equipmentSel.value = prefs.equipmentAccess;
    const sportCheckEl = document.getElementById('training-sport-check');
    if (sportCheckEl)
      sportCheckEl.checked = prefs.sportReadinessCheckEnabled === true;
    const warmupEl = document.getElementById('training-warmup-sets');
    if (warmupEl) warmupEl.checked = prefs.warmupSetsEnabled === true;
    const notesEl = document.getElementById('training-preferences-notes');
    if (notesEl) notesEl.value = prefs.notes || '';
  }
  renderSportDayToggles();
  {
    const defaultRestEl = document.getElementById('default-rest');
    if (defaultRestEl) defaultRestEl.value = profile.defaultRest || 120;
  }
  renderProgramSwitcher();
  renderTrainingProgramSummary();
  renderProgramBasics();
  renderTrainingPreferencesSummary();
  renderSportStatusBar();
  renderProgramStatusBar();
  renderBackupContext();
  // Body metrics
  {
    const bm = profile.bodyMetrics || {};
    const sx = document.getElementById('body-sex');
    if (sx) sx.value = bm.sex || '';
    const al = document.getElementById('body-activity');
    if (al) al.value = bm.activityLevel || '';
    const w = document.getElementById('body-weight');
    if (w) w.value = bm.weight || '';
    const h = document.getElementById('body-height');
    if (h) h.value = bm.height || '';
    const a = document.getElementById('body-age');
    if (a) a.value = bm.age || '';
    const tw = document.getElementById('body-target-weight');
    if (tw) tw.value = bm.targetWeight || '';
    const bg = document.getElementById('body-goal');
    if (bg) bg.value = bm.bodyGoal || '';
  }
  // Version display
  {
    const vEl = document.getElementById('app-version');
    if (vEl) vEl.textContent = 'Ironforge v' + APP_VERSION;
  }
  window.__IRONFORGE_APP_RUNTIME__?.resetSettingsAccountUiState?.();
  if (window.I18N && I18N.applyTranslations) I18N.applyTranslations(document);
  if (isStoreBackedSettingsSurfaceActive()) {
    window.__IRONFORGE_APP_RUNTIME__?.syncSettingsBridge?.();
  }
}

// Program UI/state helpers moved to core/program-layer.js.

function toggleDay(kind, dow, el) {
  const key = kind === 'sport' ? 'sportDays' : kind + 'Days';
  const cls = kind + '-day';
  if (el.classList.contains(cls)) {
    el.classList.remove(cls);
    schedule[key] = schedule[key].filter((d) => d !== dow);
  } else {
    el.classList.add(cls);
    if (!schedule[key]) schedule[key] = [];
    if (!schedule[key].includes(dow)) schedule[key].push(dow);
  }
  if (kind === 'sport') saveSchedule();
}

function saveRestTimer() {
  if (typeof getAppRuntime()?.saveRestTimer === 'function') {
    return getAppRuntime().saveRestTimer();
  }
}
function saveBodyMetrics() {
  if (typeof getAppRuntime()?.saveBodyMetrics === 'function') {
    return getAppRuntime().saveBodyMetrics();
  }
}
function saveTrainingPreferences(options) {
  if (typeof getAppRuntime()?.saveTrainingPreferences === 'function') {
    return getAppRuntime().saveTrainingPreferences(options);
  }
}
function saveSimpleProgramSettings() {
  if (typeof getAppRuntime()?.saveSimpleProgramSettings === 'function') {
    return getAppRuntime().saveSimpleProgramSettings();
  }
}
function saveLanguageSetting() {
  if (typeof getAppRuntime()?.saveLanguageSetting === 'function') {
    return getAppRuntime().saveLanguageSetting(
      arguments.length && typeof arguments[0] === 'string'
        ? arguments[0]
        : undefined
    );
  }
}
let _autoSaveToastTimer = null;
function _showAutoSaveToast(msg, color) {
  clearTimeout(_autoSaveToastTimer);
  _autoSaveToastTimer = setTimeout(() => showToast(msg, color), 600);
}
function saveSchedule(nextValues) {
  if (typeof getAppRuntime()?.saveSchedule === 'function') {
    return getAppRuntime().saveSchedule(nextValues);
  }
}

function renderBackupContext() {
  notifySettingsAccountIsland();
  return '';
}
function exportData() {
  if (typeof getAppRuntime()?.exportData === 'function') {
    return getAppRuntime().exportData();
  }
}

function importData(event) {
  if (typeof getAppRuntime()?.importData === 'function') {
    return getAppRuntime().importData(event);
  }
}

function showDangerConfirm() {
  window.__IRONFORGE_APP_RUNTIME__?.showDangerConfirm?.();
}
function checkDangerConfirm() {
  const nextValue =
    arguments.length && typeof arguments[0] === 'string'
      ? arguments[0]
      : document.getElementById('danger-zone-input')?.value || '';
  window.__IRONFORGE_APP_RUNTIME__?.checkDangerConfirm?.(nextValue);
}
async function clearAllData() {
  if (typeof getAppRuntime()?.clearAllData === 'function') {
    return getAppRuntime().clearAllData();
  }
}
