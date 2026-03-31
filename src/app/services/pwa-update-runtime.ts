import { useRuntimeStore } from '../store/runtime-store';

type WaitingWorkerLike = {
  postMessage: (message: unknown) => void;
};

type PwaUpdateRuntime = {
  register: () => Promise<void>;
  applyUpdate: () => void;
  setWaitingWorkerForTest: (worker: WaitingWorkerLike | null) => void;
};

type RuntimeWindow = Window & {
  __IRONFORGE_DISABLE_LEGACY_SW__?: boolean;
  __IRONFORGE_LOGIN_DEBUG__?: {
    trace?: (message: string, details?: Record<string, unknown>) => void;
  };
  __IRONFORGE_PWA_UPDATE_RUNTIME__?: PwaUpdateRuntime;
};

const RELOAD_MARKER_KEY = 'ironforge:pwa-update-reload';

let waitingWorker: WaitingWorkerLike | null = null;
let registerPromise: Promise<void> | null = null;
let controllerChangeAttached = false;

function applyWaitingWorker(worker: WaitingWorkerLike | null) {
  if (!worker) return;
  useRuntimeStore.getState().setServiceWorkerState({
    updateReady: false,
    applyingUpdate: true,
  });
  sessionStorage.setItem(RELOAD_MARKER_KEY, '1');
  trace('pwa update auto-apply requested');
  worker.postMessage({ type: 'SKIP_WAITING' });
}

function getRuntimeWindow(): RuntimeWindow | null {
  if (typeof window === 'undefined') return null;
  return window as RuntimeWindow;
}

function trace(message: string, details?: Record<string, unknown>) {
  try {
    getRuntimeWindow()?.__IRONFORGE_LOGIN_DEBUG__?.trace?.(message, details);
  } catch (_error) {}
}

function setWaitingWorker(worker: WaitingWorkerLike | null) {
  waitingWorker = worker;
  useRuntimeStore.getState().setServiceWorkerState({
    updateReady: false,
    applyingUpdate: false,
  });
}

function handleWaitingRegistration(
  registration: ServiceWorkerRegistration | null | undefined
) {
  if (registration?.waiting) {
    trace('pwa update waiting worker ready');
    setWaitingWorker(registration.waiting);
    applyWaitingWorker(registration.waiting);
  }
}

function attachControllerChangeListener() {
  if (controllerChangeAttached || !('serviceWorker' in navigator)) return;
  controllerChangeAttached = true;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem(RELOAD_MARKER_KEY) !== '1') return;
    sessionStorage.removeItem(RELOAD_MARKER_KEY);
    trace('pwa update controller changed, reloading');
    window.location.reload();
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (registerPromise) return registerPromise;

  registerPromise = (async () => {
    const runtimeWindow = getRuntimeWindow();
    if (!runtimeWindow) return;

    runtimeWindow.__IRONFORGE_DISABLE_LEGACY_SW__ = true;
    sessionStorage.removeItem(RELOAD_MARKER_KEY);
    attachControllerChangeListener();

    trace('pwa update register start', { scope: './' });

    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: './',
      updateViaCache: 'none',
    });

    await registration.update();

    handleWaitingRegistration(registration);

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;
      trace('pwa update found');

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state !== 'installed') return;
        if (!navigator.serviceWorker.controller) return;
        trace('pwa update installed and waiting');
        setWaitingWorker(registration.waiting || installingWorker);
        applyWaitingWorker(registration.waiting || installingWorker);
      });
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'IRONFORGE_SW_READY') {
        trace('pwa update worker ready');
        handleWaitingRegistration(registration);
      }
    });

    trace('pwa update register done', { scope: './' });
  })().catch((error: unknown) => {
    trace('pwa update register failed', {
      message: error instanceof Error ? error.message : String(error || ''),
    });
    useRuntimeStore.getState().setServiceWorkerState({
      updateReady: false,
      applyingUpdate: false,
    });
  });

  return registerPromise;
}

function applyPendingUpdate() {
  if (!waitingWorker) return;
  applyWaitingWorker(waitingWorker);
}

export function installPwaUpdateRuntime() {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  if (runtimeWindow.__IRONFORGE_PWA_UPDATE_RUNTIME__) {
    void runtimeWindow.__IRONFORGE_PWA_UPDATE_RUNTIME__.register();
    return runtimeWindow.__IRONFORGE_PWA_UPDATE_RUNTIME__;
  }

  const runtime: PwaUpdateRuntime = {
    register: registerServiceWorker,
    applyUpdate: applyPendingUpdate,
    setWaitingWorkerForTest: (worker) => {
      setWaitingWorker(worker);
      applyWaitingWorker(worker);
    },
  };

  runtimeWindow.__IRONFORGE_PWA_UPDATE_RUNTIME__ = runtime;
  void runtime.register();
  return runtime;
}

export function applyPendingPwaUpdate() {
  applyPendingUpdate();
}
