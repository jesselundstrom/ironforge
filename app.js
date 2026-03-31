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
let restInterval = null,
  restSecondsLeft = 0,
  restTotal = 0,
  restDuration = 120,
  restEndsAt = 0,
  restHideTimeout = null,
  restBarActive = false;
let pendingRPECallback = null;
let pendingRPEPromptState = null;
let exerciseIndex = {};
let _appViewportSyncTimeout = null;
let _appViewportBurstTimeouts = [];
const IS_E2E_TEST_ENV =
  window.__IRONFORGE_TEST_USER_ID__ === 'e2e-user' ||
  window.navigator.webdriver === true;

if (IS_E2E_TEST_ENV) {
  document.documentElement.classList.add('test-env');
}

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

function getRuntimeBridge() {
  return window.__IRONFORGE_RUNTIME_BRIDGE__ || null;
}

function isStoreBackedSettingsSurfaceActive() {
  const bridge = getRuntimeBridge();
  return !!bridge && typeof bridge.setActiveSettingsTab === 'function';
}

function setRestBarActiveState(nextActive) {
  restBarActive = nextActive === true;
  document
    .getElementById('rest-timer-bar')
    ?.classList.toggle('active', restBarActive);
}

window.setRestBarActiveState = setRestBarActiveState;

function syncWorkoutSessionBridge() {
  const bridge = getRuntimeBridge();
  if (!bridge || typeof bridge.setWorkoutSessionState !== 'function') return;
  bridge.setWorkoutSessionState({
    activeWorkout,
    restDuration: Number(restDuration || 0),
    restEndsAt: Number(restEndsAt || 0),
    restSecondsLeft: Number(restSecondsLeft || 0),
    restTotal: Number(restTotal || 0),
    currentUser,
    restBarActive: restBarActive === true,
    rpeOpen: pendingRPEPromptState?.open === true,
    rpePrompt:
      pendingRPEPromptState && typeof pendingRPEPromptState === 'object'
        ? { ...pendingRPEPromptState }
        : null,
    summaryOpen:
      typeof window.getSessionSummaryPromptSnapshot === 'function' &&
      window.getSessionSummaryPromptSnapshot()?.open === true,
    summaryPrompt:
      typeof window.getSessionSummaryPromptSnapshot === 'function'
        ? window.getSessionSummaryPromptSnapshot()
        : null,
    sportCheckOpen:
      typeof window.getSportCheckPromptSnapshot === 'function' &&
      window.getSportCheckPromptSnapshot()?.open === true,
    sportCheckPrompt:
      typeof window.getSportCheckPromptSnapshot === 'function'
        ? window.getSportCheckPromptSnapshot()
        : null,
    exerciseGuideOpen:
      typeof window.getExerciseGuidePromptSnapshot === 'function' &&
      window.getExerciseGuidePromptSnapshot()?.open === true,
    exerciseGuidePrompt:
      typeof window.getExerciseGuidePromptSnapshot === 'function'
        ? window.getExerciseGuidePromptSnapshot()
        : null,
  });
}

window.getLiveWorkoutSessionSnapshot = function getLiveWorkoutSessionSnapshot() {
  return {
    activeWorkout,
    restDuration: Number(restDuration || 0),
    restEndsAt: Number(restEndsAt || 0),
    restSecondsLeft: Number(restSecondsLeft || 0),
    restTotal: Number(restTotal || 0),
    currentUser,
    restBarActive: restBarActive === true,
  };
};

window.syncWorkoutSessionBridge = syncWorkoutSessionBridge;

function notifyRpeOverlayShell() {
  syncWorkoutSessionBridge();
}

function getWorkoutOverlaySnapshot() {
  return {
    rpePrompt:
      pendingRPEPromptState && typeof pendingRPEPromptState === 'object'
        ? { ...pendingRPEPromptState }
        : null,
    summaryPrompt:
      typeof window.getSessionSummaryPromptSnapshot === 'function'
        ? window.getSessionSummaryPromptSnapshot()
        : null,
    sportCheckPrompt:
      typeof window.getSportCheckPromptSnapshot === 'function'
        ? window.getSportCheckPromptSnapshot()
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
  const max = Math.max(...previousSets.map((set) => parseFloat(set.weight) || 0));
  return previousSets.every((set) => set.done) ? Math.round((max + 2.5) * 2) / 2 : max;
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

function bindLegacyShellActions() {
  if (document.body?.dataset.ironforgeShellActionsBound === '1') return;
  if (document.body) {
    document.body.dataset.ironforgeShellActionsBound = '1';
  }
  document.addEventListener('click', (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest('[data-shell-action]')
        : null;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.shellAction || '';
    if (!action) return;
    switch (action) {
      case 'skip-rest':
        event.preventDefault();
        if (typeof window.skipRest === 'function') window.skipRest();
        break;
      case 'skip-rpe':
        event.preventDefault();
        if (typeof window.skipRPE === 'function') window.skipRPE();
        break;
      case 'confirm-cancel':
        event.preventDefault();
        if (typeof window.confirmCancel === 'function') window.confirmCancel();
        break;
      case 'confirm-ok':
        event.preventDefault();
        if (typeof window.confirmOk === 'function') window.confirmOk();
        break;
      case 'clear-exercise-catalog-filters':
        event.preventDefault();
        if (typeof window.clearExerciseCatalogFilters === 'function') {
          window.clearExerciseCatalogFilters();
        }
        break;
      case 'close-name-modal':
        event.preventDefault();
        if (typeof window.closeNameModal === 'function')
          window.closeNameModal();
        break;
      case 'sport-readiness': {
        event.preventDefault();
        const readiness = target.dataset.sportReadiness || '';
        if (readiness && typeof window.selectSportReadiness === 'function') {
          window.selectSportReadiness(readiness);
        }
        break;
      }
      case 'cancel-sport-readiness':
        event.preventDefault();
        if (typeof window.cancelSportReadinessCheck === 'function') {
          window.cancelSportReadinessCheck();
        }
        break;
      case 'close-exercise-guide':
        if (typeof window.closeExerciseGuide === 'function') {
          window.closeExerciseGuide(event);
        }
        break;
      case 'show-settings-tab': {
        event.preventDefault();
        const tab = target.dataset.settingsTab || '';
        if (tab && typeof window.showSettingsTab === 'function') {
          window.showSettingsTab(tab, target);
        }
        break;
      }
      case 'show-page': {
        event.preventDefault();
        const page = target.dataset.page || '';
        if (page && typeof window.showPage === 'function') {
          window.showPage(page, target);
        }
        break;
      }
      default:
        break;
    }
  });
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
bindLegacyShellActions();
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
const loginSparks =
  typeof window.createLoginSparksController === 'function'
    ? window.createLoginSparksController()
    : { start() {}, stop() {} };

window.startLoginSparks = () => loginSparks.start();
window.stopLoginSparks = () => loginSparks.stop();

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
window.FATIGUE_CONFIG = FATIGUE_CONFIG;
window.MUSCLE_LOAD_CONFIG = MUSCLE_LOAD_CONFIG;

const SPORT_RECENT_HOURS = {
  easy: 18,
  moderate: 24,
  hard: 30,
};
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
function getSelectedRestDuration() {
  const inputValue = parseInt(
    document.getElementById('rest-duration')?.value,
    10
  );
  if (Number.isFinite(inputValue)) return inputValue;
  return parseInt(restDuration, 10) || profile.defaultRest || 120;
}

function updateRestDuration(nextValue) {
  const parsedValue =
    nextValue !== undefined && nextValue !== null
      ? parseInt(nextValue, 10)
      : getSelectedRestDuration();
  restDuration = Number.isFinite(parsedValue) ? parsedValue : 0;
  const restSelect = document.getElementById('rest-duration');
  if (restSelect) restSelect.value = String(restDuration);
  if (activeWorkout && typeof persistActiveWorkoutDraft === 'function')
    persistActiveWorkoutDraft();
  if (
    typeof isLogActiveIslandActive === 'function' &&
    isLogActiveIslandActive()
  )
    notifyLogActiveIsland();
  syncWorkoutSessionBridge();
}
window.getSelectedRestDuration = getSelectedRestDuration;
function clearRestInterval() {
  if (restInterval) {
    clearInterval(restInterval);
    restInterval = null;
  }
}
function clearRestHideTimer() {
  if (restHideTimeout) {
    clearTimeout(restHideTimeout);
    restHideTimeout = null;
  }
}
function syncRestTimer() {
  if (!restEndsAt) return;
  restSecondsLeft = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
  if (restSecondsLeft <= 0) {
    restDone();
    return;
  }
  updateRestDisplay();
}
function startRestTimer() {
  if (!restDuration) {
    skipRest();
    return;
  }
  clearRestInterval();
  clearRestHideTimer();
  restTotal = restDuration;
  restEndsAt = Date.now() + restDuration * 1000;
  setRestBarActiveState(true);
  syncRestTimer();
  if (activeWorkout && typeof persistActiveWorkoutDraft === 'function')
    persistActiveWorkoutDraft();
  restInterval = setInterval(syncRestTimer, 250);
  syncWorkoutSessionBridge();
}
function updateRestDisplay() {
  const m = Math.floor(restSecondsLeft / 60),
    s = restSecondsLeft % 60;
  const el = document.getElementById('rest-timer-count');
  if (!el) return;
  el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  el.className = 'rest-timer-count' + (restSecondsLeft <= 10 ? ' warning' : '');
  const offset = restTotal ? 119.4 * (1 - restSecondsLeft / restTotal) : 119.4;
  document
    .getElementById('timer-arc')
    .setAttribute('stroke-dashoffset', offset);
  syncWorkoutSessionBridge();
}
function restDone() {
  clearRestInterval();
  clearRestHideTimer();
  restEndsAt = 0;
  restSecondsLeft = 0;
  const el = document.getElementById('rest-timer-count');
  el.className = 'rest-timer-count done';
  el.textContent = tr('dashboard.badge.go', 'GO');
  playBeep();
  if (activeWorkout && typeof persistActiveWorkoutDraft === 'function')
    persistActiveWorkoutDraft();
  restHideTimeout = setTimeout(
    () => {
      setRestBarActiveState(false);
      syncWorkoutSessionBridge();
    },
    3000
  );
  syncWorkoutSessionBridge();
}
function skipRest() {
  clearRestInterval();
  clearRestHideTimer();
  restEndsAt = 0;
  restSecondsLeft = 0;
  setRestBarActiveState(false);
  if (activeWorkout && typeof persistActiveWorkoutDraft === 'function')
    persistActiveWorkoutDraft();
  syncWorkoutSessionBridge();
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncRestTimer();
});
window.addEventListener('pageshow', syncRestTimer);
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 150, 300].forEach((d) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      o.type = 'sine';
      g.gain.setValueAtTime(0.3, ctx.currentTime + d / 1000);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + d / 1000 + 0.2
      );
      o.start(ctx.currentTime + d / 1000);
      o.stop(ctx.currentTime + d / 1000 + 0.25);
    });
  } catch (e) {}
}

// RPE MODAL
function showRPEPicker(exName, setNum, cb) {
  pendingRPECallback = cb;
  pendingRPEPromptState = {
    open: true,
    title: tr('rpe.session_title', 'How hard was this session?'),
    subtitle:
      setNum < 0
        ? tr(
            'rpe.session_prompt',
            'Rate overall session effort (6 = easy, 10 = max)'
          )
        : exName + ' - ' + tr('rpe.set', 'Set') + ' ' + (setNum + 1),
    options: [6, 7, 8, 9, 10].map((value) => ({
      value,
      feel: RPE_FEELS[value] || '',
      description: RPE_DESCS[value]
        ? tr(RPE_DESCS[value][0], RPE_DESCS[value][1])
        : '',
    })),
  };
  notifyRpeOverlayShell();
}
function selectRPE(val) {
  pendingRPEPromptState = null;
  notifyRpeOverlayShell();
  if (pendingRPECallback) pendingRPECallback(val);
  pendingRPECallback = null;
}
function skipRPE() {
  pendingRPEPromptState = null;
  notifyRpeOverlayShell();
  if (pendingRPECallback) pendingRPECallback(null);
  pendingRPECallback = null;
}

// FATIGUE ENGINE
// Dashboard/fatigue/data helpers moved to core/dashboard-layer.js.

// Workout/session engine moved to core/workout-layer.js.

// HISTORY
// History/analytics helpers moved to core/history-layer.js.

// SETTINGS
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
  schedule.sportIntensity = val;
  document
    .querySelectorAll('#sport-intensity-btns button')
    .forEach((b) => b.classList.remove('active'));
  if (el) el.classList.add('active');
  saveSchedule({ sportIntensity: val });
}
let _settingsTab = 'schedule';
let settingsAccountUiState = { dangerOpen: false, dangerInput: '' };
window.__IRONFORGE_ACTIVE_SETTINGS_TAB__ = _settingsTab;
function getSettingsAccountUiStateSnapshot() {
  return {
    dangerOpen: settingsAccountUiState.dangerOpen === true,
    dangerInput: settingsAccountUiState.dangerInput || '',
  };
}
window.getSettingsAccountUiStateSnapshot = getSettingsAccountUiStateSnapshot;
function showSettingsTab(name, el) {
  const nextTab = ['schedule', 'preferences', 'program', 'account', 'body'].includes(
    name
  )
    ? name
    : 'schedule';
  _settingsTab = nextTab;
  window.__IRONFORGE_ACTIVE_SETTINGS_TAB__ = nextTab;
  const bridge = getRuntimeBridge();
  if (bridge && typeof bridge.setActiveSettingsTab === 'function') {
    bridge.setActiveSettingsTab(nextTab);
    return;
  }
  ['schedule', 'preferences', 'program', 'account', 'body'].forEach((t) => {
    const d = document.getElementById('settings-tab-' + t);
    if (d) d.style.display = t === nextTab ? '' : 'none';
  });
  document.querySelectorAll('#settings-tabs .tab').forEach((tab) => {
    const isActive = tab.dataset.settingsTab === nextTab;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}
function isSettingsAccountIslandActive() {
  const bridge = getRuntimeBridge();
  return !!bridge && typeof bridge.setSettingsAccountView === 'function';
}
function notifySettingsAccountIsland() {
  window.__IRONFORGE_APP_RUNTIME__?.syncSettingsAccountView?.();
}
function getAccountBackupContextText() {
  const count = workouts ? workouts.length : 0;
  if (!count) return tr('settings.backup_empty', 'No workouts recorded yet.');
  const dates = workouts
    .map((w) => w.date)
    .filter(Boolean)
    .sort();
  const first = dates[0] || '';
  const firstFormatted = first
    ? new Date(first).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
  return tr('settings.backup_context', '{count} workouts since {date}', {
    count,
    date: firstFormatted,
  });
}
function isDangerDeleteConfirmed() {
  return (
    String(settingsAccountUiState.dangerInput || '')
      .trim()
      .toUpperCase() === 'DELETE'
  );
}
function buildSettingsAccountView() {
  return (
    window.__IRONFORGE_APP_RUNTIME__?.buildSettingsAccountView?.() || {
      labels: {},
      values: {},
    }
  );
}
function isSettingsScheduleIslandActive() {
  const bridge = getRuntimeBridge();
  return !!bridge && typeof bridge.setSettingsScheduleView === 'function';
}
function notifySettingsScheduleIsland() {
  window.__IRONFORGE_APP_RUNTIME__?.syncSettingsScheduleView?.();
}
function getSettingsScheduleStatusText() {
  const sep = ' · ';
  const name = getScheduleStatusName(schedule);
  const intensity = schedule.sportIntensity || 'hard';
  const intensityLabel = tr(
    'settings.intensity.' + intensity,
    intensity.charAt(0).toUpperCase() + intensity.slice(1)
  );
  const days = schedule.sportDays || [];
  const dayStr = days.length
    ? days
        .slice()
        .sort((a, b) => a - b)
        .map((d) => DAY_NAMES[d])
        .join(', ')
    : tr('settings.status.no_days', 'No days set');
  return name + sep + intensityLabel + sep + dayStr;
}
function buildSettingsScheduleView() {
  return (
    window.__IRONFORGE_APP_RUNTIME__?.buildSettingsScheduleView?.() || {
      labels: {},
      values: {},
    }
  );
}
function isSettingsProgramIslandActive() {
  const bridge = getRuntimeBridge();
  return !!bridge && typeof bridge.setSettingsProgramView === 'function';
}
function notifySettingsProgramIsland() {
  window.__IRONFORGE_APP_RUNTIME__?.syncSettingsProgramView?.();
}
function parseInlineStyle(styleText) {
  return String(styleText || '')
    .split(';')
    .reduce((acc, entry) => {
      const [rawKey, rawValue] = entry.split(':');
      const key = String(rawKey || '').trim();
      const value = String(rawValue || '').trim();
      if (!key || !value) return acc;
      const camelKey = key.replace(/-([a-z])/g, (_, char) =>
        char.toUpperCase()
      );
      acc[camelKey] = value;
      return acc;
    }, {});
}
function serializeSettingsNode(node) {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? { type: 'text', text: node.textContent } : null;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node;
  const attrs = {};
  Array.from(el.attributes || []).forEach((attr) => {
    if (attr.name === 'class') attrs.className = attr.value;
    else if (attr.name === 'for') attrs.htmlFor = attr.value;
    else if (attr.name === 'style') attrs.style = parseInlineStyle(attr.value);
    else if (attr.name === 'onclick') attrs.onClickCode = attr.value;
    else if (attr.name === 'onchange') attrs.onChangeCode = attr.value;
    else if (attr.name === 'checked') attrs.defaultChecked = true;
    else attrs[attr.name] = attr.value === '' ? true : attr.value;
  });
  if (el.tagName === 'INPUT' && el.type === 'checkbox') {
    attrs.defaultChecked = el.checked === true;
  } else if (el.tagName === 'TEXTAREA') {
    attrs.defaultValue = el.value || '';
  } else if (el.tagName === 'SELECT') {
    attrs.defaultValue = el.value || '';
  } else if (el.tagName === 'INPUT') {
    if (attrs.value !== undefined) {
      attrs.defaultValue = attrs.value;
      delete attrs.value;
    } else if (el.value !== '') {
      attrs.defaultValue = el.value;
    }
  }
  return {
    type: 'element',
    tag: el.tagName.toLowerCase(),
    attrs,
    children: Array.from(el.childNodes || [])
      .map(serializeSettingsNode)
      .filter(Boolean),
  };
}
function getProgramBasicsSnapshotData() {
  const card = document.createElement('details');
  const container = document.createElement('div');
  const summaryEl = document.createElement('div');
  renderProgramBasics({
    card,
    container,
    summaryEl,
    bindAutoSave: false,
    notifyIsland: false,
  });
  return {
    visible: card.style.display !== 'none',
    summary: summaryEl.textContent || '',
    tree: Array.from(container.childNodes)
      .map(serializeSettingsNode)
      .filter(Boolean),
  };
}
function getProgramSwitcherSnapshotData() {
  const active = getActiveProgramId();
  const requested =
    typeof getPreferredTrainingDaysPerWeek === 'function'
      ? getPreferredTrainingDaysPerWeek(profile)
      : 3;
  const requestedLabel =
    typeof getTrainingDaysPerWeekLabel === 'function'
      ? getTrainingDaysPerWeekLabel(requested)
      : requested + ' sessions / week';
  const exactPrograms = getSuggestedProgramsForTrainingDays(requested, profile);
  const visible = exactPrograms.slice();
  if (
    active &&
    !visible.some((program) => program.id === active) &&
    typeof getProgramById === 'function' &&
    getProgramById(active)
  ) {
    visible.push(getProgramById(active));
  }
  const cards = (
    visible.length
      ? visible
      : typeof getRegisteredPrograms === 'function'
        ? getRegisteredPrograms()
        : []
  ).map(
    (program) => {
      const compatibility = getProgramFrequencyCompatibility(
        program.id,
        profile
      );
      const difficulty =
        typeof getProgramDifficultyMeta === 'function'
          ? getProgramDifficultyMeta(program.id)
          : {
              key: 'intermediate',
              labelKey: 'program.difficulty.intermediate',
              fallback: 'Intermediate',
            };
      const effectiveLabel =
        typeof getTrainingDaysPerWeekLabel === 'function'
          ? getTrainingDaysPerWeekLabel(compatibility.effective)
          : compatibility.effective + ' sessions / week';
      return {
        id: program.id,
        icon: program.icon || '🏋️',
        name:
          window.I18N && I18N.t
            ? I18N.t('program.' + program.id + '.name', null, program.name)
            : program.name,
        description:
          window.I18N && I18N.t
            ? I18N.t(
                'program.' + program.id + '.description',
                null,
                program.description || ''
              )
            : program.description || '',
        fitLabel: compatibility.supportsExact
          ? tr('program.frequency_card.fit', 'Fits {value}', {
              value: requestedLabel,
            })
          : tr('program.frequency_card.fallback', 'Uses {value}', {
              value: effectiveLabel,
            }),
        fitTone: compatibility.supportsExact ? 'ok' : 'fallback',
        difficultyKey: difficulty.key,
        difficultyTone: difficulty.key,
        difficultyLabel:
          window.I18N && I18N.t
            ? I18N.t(difficulty.labelKey, null, difficulty.fallback)
            : difficulty.fallback,
        active: program.id === active,
        activeLabel: tr('program.active', 'Active'),
      };
    }
  );
  return {
    helper: tr(
      'program.frequency_filter.showing',
      'Showing programs that fit {value}. Your current program stays visible if it needs a fallback.',
      { value: requestedLabel }
    ),
    cards,
  };
}
function buildSettingsProgramView() {
  return (
    window.__IRONFORGE_APP_RUNTIME__?.buildSettingsProgramView?.() || {
      labels: {},
      values: {},
    }
  );
}
function isSettingsPreferencesIslandActive() {
  const bridge = getRuntimeBridge();
  return !!bridge && typeof bridge.setSettingsPreferencesView === 'function';
}
function notifySettingsPreferencesIsland() {
  window.__IRONFORGE_APP_RUNTIME__?.syncSettingsPreferencesView?.();
}
function buildSettingsPreferencesView() {
  return (
    window.__IRONFORGE_APP_RUNTIME__?.buildSettingsPreferencesView?.() || {
      labels: {},
      values: {},
    }
  );
}
function isSettingsBodyIslandActive() {
  const bridge = getRuntimeBridge();
  return !!bridge && typeof bridge.setSettingsBodyView === 'function';
}
function notifySettingsBodyIsland() {
  window.__IRONFORGE_APP_RUNTIME__?.syncSettingsBodyView?.();
}
function buildSettingsBodyView() {
  return (
    window.__IRONFORGE_APP_RUNTIME__?.buildSettingsBodyView?.() || {
      labels: {},
      values: {},
    }
  );
}
window.syncSettingsBridge = function syncSettingsBridge() {
  window.__IRONFORGE_APP_RUNTIME__?.syncSettingsBridge?.();
};
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

let _onboardingRetryTimer = null;

function parseOnboardingExerciseIds(text) {
  return String(text || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((name) => window.resolveRegisteredExerciseId?.(name) || name)
    .filter(Boolean);
}

function getOnboardingDefaultDraft() {
  return window.__IRONFORGE_APP_RUNTIME__?.getOnboardingDefaultDraft?.() || null;
}
window.getOnboardingDefaultDraft = getOnboardingDefaultDraft;

function notifyOnboardingIsland() {
  window.dispatchEvent(new CustomEvent('ironforge:onboarding-updated'));
}

function buildOnboardingRecommendation(draft) {
  return (
    window.__IRONFORGE_APP_RUNTIME__?.buildOnboardingRecommendation?.(draft) ||
    null
  );
}

function closeOnboardingModal() {
  document.getElementById('onboarding-modal')?.classList.remove('active');
}

function dismissOnboardingModal() {
  closeOnboardingModal();
}

async function completeOnboarding(draft) {
  const d = draft || getOnboardingDefaultDraft();
  const recommendation = buildOnboardingRecommendation(d);
  const nextPreferences = normalizeTrainingPreferences({
    preferences: {
      ...(profile.preferences || getDefaultTrainingPreferences()),
      goal: d.goal,
      trainingDaysPerWeek: parseInt(d.trainingDaysPerWeek, 10) || 3,
      sessionMinutes: parseInt(d.sessionMinutes, 10) || 60,
      equipmentAccess: d.equipmentAccess,
      detailedView: undefined,
    },
  });
  const nextCoaching = normalizeCoachingProfile({
    coaching: {
      ...(profile.coaching || getDefaultCoachingProfile()),
      experienceLevel: d.experienceLevel,
      guidanceMode: d.guidanceMode,
      sportProfile: {
        name: String(d.sportName || '').trim(),
        inSeason: d.inSeason === true,
        sessionsPerWeek: parseInt(d.sportSessionsPerWeek, 10) || 0,
      },
      limitations: {
        jointFlags: [...(d.jointFlags || [])],
        avoidMovementTags: [...(d.avoidMovementTags || [])],
        avoidExerciseIds: parseOnboardingExerciseIds(d.avoidExercisesText),
      },
      exercisePreferences: {
        preferredExerciseIds: [],
        excludedExerciseIds: parseOnboardingExerciseIds(d.avoidExercisesText),
      },
      onboardingCompleted: true,
      onboardingSeen: true,
    },
  });
  const nextPrograms = { ...(profile.programs || {}) };
  const recommendedProgramInitialState =
    typeof getProgramInitialState === 'function'
      ? getProgramInitialState(recommendation.programId)
      : null;
  if (
    !nextPrograms[recommendation.programId] &&
    recommendedProgramInitialState
  ) {
    nextPrograms[recommendation.programId] = recommendedProgramInitialState;
  }
  profile = {
    ...profile,
    preferences: nextPreferences,
    coaching: nextCoaching,
    activeProgram: recommendation.programId,
    programs: nextPrograms,
  };
  normalizeProfileProgramStateMap(profile);
  if (String(d.sportName || '').trim())
    schedule.sportName = String(d.sportName || '').trim();
  closeOnboardingModal();
  await saveProfileData({ docKeys: getAllProfileDocumentKeys(profile) });
  await saveScheduleData();
  initSettings();
  if (!activeWorkout) resetNotStartedView();
  updateProgramDisplay();
  updateDashboard();
  const msg =
    window.I18N && I18N.t
      ? I18N.t(
          'onboarding.complete_toast',
          null,
          'Plan created and onboarding completed'
        )
      : 'Plan created and onboarding completed';
  showToast(msg, 'var(--green)');
  goToLog();
}

function maybeOpenOnboarding(options) {
  const opts = options || {};
  clearTimeout(_onboardingRetryTimer);
  if (document.body.classList.contains('login-active')) return;
  if (activeWorkout) return;
  const coaching = normalizeCoachingProfile(profile);
  if (
    !opts.force &&
    (coaching.onboardingCompleted === true ||
      coaching.onboardingSeen === true)
  ) {
    closeOnboardingModal();
    return;
  }
  if (
    typeof hasRegisteredPrograms === 'function' && !hasRegisteredPrograms()
  ) {
    _onboardingRetryTimer = setTimeout(() => maybeOpenOnboarding(opts), 120);
    return;
  }
  if (!opts.force && coaching.onboardingSeen !== true) {
    profile = {
      ...profile,
      coaching: normalizeCoachingProfile({
        ...profile,
        coaching: {
          ...coaching,
          onboardingSeen: true,
        },
      }),
    };
    saveProfileData({ docKeys: ['profile_core'] });
  }
  document.getElementById('onboarding-modal')?.classList.add('active');
  notifyOnboardingIsland();
}

function restartOnboarding() {
  if (activeWorkout) {
    showToast(
      window.I18N && I18N.t
        ? I18N.t(
            'settings.preferences.restart_onboarding_active',
            null,
            'Finish or discard the active workout before reopening guided setup.'
          )
        : 'Finish or discard the active workout before reopening guided setup.',
      'var(--muted)'
    );
    return;
  }
  const modal = document.getElementById('onboarding-modal');
  if (!modal) return;
  modal.classList.add('active');
  notifyOnboardingIsland();
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
  document.getElementById('default-rest').value = profile.defaultRest || 120;
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
  // Reset danger zone confirm state
  settingsAccountUiState = { dangerOpen: false, dangerInput: '' };
  {
    const dzt = document.getElementById('danger-zone-trigger');
    if (dzt) dzt.style.display = '';
    const dzc = document.getElementById('danger-zone-confirm');
    if (dzc) dzc.style.display = 'none';
    const dzi = document.getElementById('danger-zone-input');
    if (dzi) dzi.value = '';
    const dzb = document.getElementById('danger-zone-delete-btn');
    if (dzb) dzb.disabled = true;
  }
  showSettingsTab(_settingsTab);
  if (window.I18N && I18N.applyTranslations) I18N.applyTranslations(document);
  if (isStoreBackedSettingsSurfaceActive()) window.syncSettingsBridge?.();
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
  profile.defaultRest =
    parseInt(document.getElementById('default-rest').value) || 120;
  restDuration = profile.defaultRest;
  saveProfileData({ docKeys: ['profile_core'] });
  notifySettingsPreferencesIsland();
  _showAutoSaveToast(tr('toast.rest_updated', 'Saved'), 'var(--blue)');
}
function saveBodyMetrics() {
  const toNum = (id, parse) => {
    const v = document.getElementById(id)?.value;
    return v ? parse(v) : null;
  };
  if (!profile.bodyMetrics) profile.bodyMetrics = {};
  profile.bodyMetrics = {
    sex: document.getElementById('body-sex')?.value || null,
    activityLevel: document.getElementById('body-activity')?.value || null,
    weight: toNum('body-weight', parseFloat),
    height: toNum('body-height', parseFloat),
    age: toNum('body-age', parseInt),
    targetWeight: toNum('body-target-weight', parseFloat),
    bodyGoal: document.getElementById('body-goal')?.value || null,
  };
  if (typeof normalizeBodyMetrics === 'function') normalizeBodyMetrics(profile);
  saveProfileData({ docKeys: ['profile_core'] });
  notifySettingsBodyIsland();
  showToast(tr('settings.body.saved', 'Saved'), 'var(--green)');
}
function saveTrainingPreferences(options) {
  const opts = options || {};
  const prefs = normalizeTrainingPreferences(profile);
  const goal = document.getElementById('training-goal')?.value || prefs.goal;
  const trainingDaysPerWeek =
    parseInt(document.getElementById('training-days-per-week')?.value, 10) ||
    prefs.trainingDaysPerWeek;
  const sessionMinutes =
    parseInt(document.getElementById('training-session-minutes')?.value, 10) ||
    prefs.sessionMinutes;
  const equipmentAccess =
    document.getElementById('training-equipment')?.value ||
    prefs.equipmentAccess;
  const sportReadinessCheckEnabled =
    Object.prototype.hasOwnProperty.call(opts, 'sportReadinessCheckEnabledOverride')
      ? opts.sportReadinessCheckEnabledOverride === true
      : document.getElementById('training-sport-check')?.checked === true;
  const warmupSetsEnabled =
    Object.prototype.hasOwnProperty.call(opts, 'warmupSetsEnabledOverride')
      ? opts.warmupSetsEnabledOverride === true
      : document.getElementById('training-warmup-sets')?.checked === true;
  const detailedView = Object.prototype.hasOwnProperty.call(
    opts,
    'detailedViewOverride'
  )
    ? opts.detailedViewOverride === true
    : prefs.detailedView;
  const notes =
    document.getElementById('training-preferences-notes')?.value || '';
  profile.preferences = normalizeTrainingPreferences({
    ...profile,
    preferences: {
      ...prefs,
      goal,
      trainingDaysPerWeek,
      sessionMinutes,
      equipmentAccess,
      sportReadinessCheckEnabled,
      warmupSetsEnabled,
      detailedView,
      notes,
    },
  });
  saveProfileData({ docKeys: ['profile_core'] });
  renderTrainingPreferencesSummary();
  notifySettingsPreferencesIsland();
  renderProgramBasics();
  updateDashboard();
  updateProgramDisplay();
  if (typeof getActiveProgramFrequencyMismatch === 'function') {
    const mismatch = getActiveProgramFrequencyMismatch(profile);
    if (mismatch) {
      showToast(
        tr(
          'program.frequency_notice.toast',
          '{name} now uses {effective}. Open Program to switch for {requested}.',
          {
            name:
              window.I18N && I18N.t
                ? I18N.t(
                    'program.' + mismatch.prog.id + '.name',
                    null,
                    mismatch.prog.name
                  )
                : mismatch.prog.name,
            effective: mismatch.effectiveLabel,
            requested: mismatch.requestedLabel,
          }
        ),
        'var(--orange)'
      );
      return;
    }
  }
  _showAutoSaveToast(tr('toast.preferences_saved', 'Saved'), 'var(--purple)');
}
function saveSimpleProgramSettings() {
  const prog = getActiveProgram(),
    state = getActiveProgramState();
  if (!prog || !prog.saveSimpleSettings) return;
  const newState = prog.saveSimpleSettings(state);
  setProgramState(prog.id, newState);
  saveProfileData({ programIds: [prog.id] });
  renderProgramBasics();
  notifySettingsProgramIsland();
  updateProgramDisplay();
  updateDashboard();
  renderProgramStatusBar();
  _showAutoSaveToast(tr('program.setup_saved', 'Saved'), 'var(--purple)');
}
function saveLanguageSetting() {
  const lang =
    arguments.length && typeof arguments[0] === 'string'
      ? arguments[0]
      : document.getElementById('app-language')?.value || 'en';
  if (window.I18N && I18N.setLanguage)
    I18N.setLanguage(lang, { persist: true });
  profile.language = lang;
  saveProfileData({ docKeys: ['profile_core'] });
  notifySettingsAccountIsland();
  notifySettingsBodyIsland();
  const msg =
    window.I18N && I18N.t
      ? I18N.t('settings.language.saved')
      : 'Language updated';
  showToast(msg, 'var(--blue)');
}
let _autoSaveToastTimer = null;
function _showAutoSaveToast(msg, color) {
  clearTimeout(_autoSaveToastTimer);
  _autoSaveToastTimer = setTimeout(() => showToast(msg, color), 600);
}
function saveSchedule(nextValues) {
  if (nextValues && typeof nextValues === 'object') {
    if ('sportName' in nextValues)
      schedule.sportName = String(nextValues.sportName || '').trim();
    if ('sportLegsHeavy' in nextValues)
      schedule.sportLegsHeavy = nextValues.sportLegsHeavy !== false;
    if ('sportIntensity' in nextValues)
      schedule.sportIntensity = nextValues.sportIntensity || 'hard';
    if ('sportDays' in nextValues)
      schedule.sportDays = Array.isArray(nextValues.sportDays)
        ? [...nextValues.sportDays]
        : [];
  } else {
    const nameInp = document.getElementById('sport-name');
    if (nameInp) schedule.sportName = nameInp.value.trim();
    const cb = document.getElementById('sport-legs-heavy');
    if (cb) schedule.sportLegsHeavy = cb.checked;
  }
  if (typeof normalizeScheduleState === 'function') normalizeScheduleState(schedule);
  if (!activeWorkout) resetNotStartedView();
  saveScheduleData();
  if (isSettingsScheduleIslandActive()) notifySettingsScheduleIsland();
  updateProgramDisplay();
  updateDashboard();
  renderSportStatusBar();
  _showAutoSaveToast(tr('toast.schedule_saved', 'Saved'), 'var(--blue)');
}

function renderBackupContext() {
  const el = document.getElementById('backup-context');
  const text = getAccountBackupContextText();
  if (isSettingsAccountIslandActive()) {
    notifySettingsAccountIsland();
    return text;
  }
  if (!el) return text;
  el.textContent = text;
  return text;
}
function exportData() {
  const data = {
    version: 1,
    exported: new Date().toISOString(),
    workouts,
    schedule,
    profile,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    'ironforge-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast(tr('toast.backup_exported', 'Backup exported!'), 'var(--green)');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const maxBackupBytes =
    typeof getImportedBackupMaxBytes === 'function'
      ? getImportedBackupMaxBytes()
      : 5 * 1024 * 1024;
  if (Number(file.size) > maxBackupBytes) {
    showToast(
      tr(
        'import.file_too_large',
        'Backup file is too large to import safely'
      ),
      'var(--orange)'
    );
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (typeof data !== 'object' || !data) {
        showToast(
          tr('import.invalid_file', 'Invalid backup file'),
          'var(--orange)'
        );
        return;
      }
      const validation =
        typeof validateImportedBackup === 'function'
          ? validateImportedBackup(data)
          : {
              ok: false,
              errorKey: 'import.invalid_file',
              fallback: 'Invalid backup file',
            };
      if (!validation?.ok) {
        showToast(
          tr(validation?.errorKey || 'import.invalid_file', validation?.fallback || 'Invalid backup file'),
          'var(--orange)'
        );
        return;
      }
      const validated = validation.value;
      showConfirm(
        tr('import.title', 'Import Data'),
        tr(
          'import.replace_with_backup',
          'Replace all data with backup from {date}?',
          {
            date: validated.exported
              ? new Date(validated.exported).toLocaleDateString()
              : 'unknown',
          }
        ),
        async () => {
          if (validated.workouts) workouts = validated.workouts;
          if (validated.schedule) schedule = validated.schedule;
          if (validated.profile) profile = validated.profile;
          if (typeof normalizeScheduleState === 'function') {
            normalizeScheduleState(schedule);
          }
          cleanupLegacyProfileFields(profile);
          if (typeof normalizeBodyMetrics === 'function')
            normalizeBodyMetrics(profile);
          normalizeTrainingPreferences(profile);
          normalizeCoachingProfile(profile);
          await replaceWorkoutTableSnapshot(workouts);
          await saveWorkouts();
          await saveScheduleData();
          await saveProfileData({
            docKeys: getAllProfileDocumentKeys(profile),
          });
          notifySettingsAccountIsland();
          notifySettingsBodyIsland();
          showToast(
            tr('toast.data_imported', 'Data imported! Reloading...'),
            'var(--green)'
          );
          setTimeout(() => location.reload(), 1000);
        }
      );
    } catch (err) {
      showToast(
        tr('toast.could_not_read_file', 'Could not read file'),
        'var(--orange)'
      );
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function showDangerConfirm() {
  settingsAccountUiState = { dangerOpen: true, dangerInput: '' };
  if (isSettingsAccountIslandActive()) {
    notifySettingsAccountIsland();
    return;
  }
  document.getElementById('danger-zone-trigger').style.display = 'none';
  const panel = document.getElementById('danger-zone-confirm');
  panel.style.display = '';
  const inp = document.getElementById('danger-zone-input');
  inp.value = '';
  document.getElementById('danger-zone-delete-btn').disabled = true;
  inp.focus();
}
function checkDangerConfirm() {
  const nextValue =
    arguments.length && typeof arguments[0] === 'string'
      ? arguments[0]
      : document.getElementById('danger-zone-input')?.value || '';
  settingsAccountUiState = {
    ...settingsAccountUiState,
    dangerInput: nextValue,
  };
  if (isSettingsAccountIslandActive()) {
    notifySettingsAccountIsland();
    return;
  }
  document.getElementById('danger-zone-delete-btn').disabled =
    nextValue.trim().toUpperCase() !== 'DELETE';
}
async function clearAllData() {
  if (typeof clearLocalDataCache === 'function')
    clearLocalDataCache({ includeScoped: true, includeLegacy: true });
  else {
    try {
      localStorage.removeItem('ic_workouts');
      localStorage.removeItem('ic_schedule');
      localStorage.removeItem('ic_profile');
    } catch (e) {}
  }
  workouts = [];
  schedule = {
    sportName: '',
    sportDays: [],
    sportIntensity: 'hard',
    sportLegsHeavy: true,
  };
  profile = {
    defaultRest: 120,
    activeProgram: 'forge',
    programs: {},
    language: window.I18N && I18N.getLanguage ? I18N.getLanguage() : 'en',
    preferences: getDefaultTrainingPreferences(),
    coaching: getDefaultCoachingProfile(),
  };
  settingsAccountUiState = { dangerOpen: false, dangerInput: '' };
  (
    typeof getRegisteredPrograms === 'function'
      ? getRegisteredPrograms()
      : []
  ).forEach((prog) => {
    profile.programs[prog.id] = prog.getInitialState();
  });
  await replaceWorkoutTableSnapshot([]);
  await saveWorkouts();
  await saveScheduleData();
  await saveProfileData({ docKeys: getAllProfileDocumentKeys(profile) });
  notifySettingsAccountIsland();
  notifySettingsBodyIsland();
  updateDashboard();
  if (typeof maybeOpenOnboarding === 'function')
    maybeOpenOnboarding({ force: true });
  showToast(tr('toast.all_data_cleared', 'All data cleared'), 'var(--accent)');
}

function updateLanguageDependentUI() {
  refreshDayNames();
  window.__IRONFORGE_APP_RUNTIME__?.updateLanguageDependentUI?.();
}
window.updateLanguageDependentUI = updateLanguageDependentUI;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (window.__IRONFORGE_DISABLE_LEGACY_SW__ === true) {
      window.__IRONFORGE_LOGIN_DEBUG__?.trace?.(
        'service worker register delegated to app shell'
      );
      return;
    }
    window.__IRONFORGE_LOGIN_DEBUG__?.trace?.('service worker register start', {
      scope: './',
    });
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then(() => {
        window.__IRONFORGE_LOGIN_DEBUG__?.trace?.(
          'service worker register done',
          { scope: './' }
        );
      })
      .catch((error) => {
        window.__IRONFORGE_LOGIN_DEBUG__?.trace?.(
          'service worker register failed',
          {
            message:
              error instanceof Error ? error.message : String(error || ''),
          }
        );
      });
  });
}
