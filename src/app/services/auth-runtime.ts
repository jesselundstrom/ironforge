import type { Session } from '@supabase/supabase-js';
import { useRuntimeStore } from '../store/runtime-store';
import { t } from './i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupabaseClientLike = {
  auth?: {
    getSession?: () => Promise<{
      data?: { session?: Session | null };
      error?: Error | null;
    }>;
    onAuthStateChange?: (
      callback: (event: string, session: Session | null) => void
    ) => { data?: { subscription?: { unsubscribe?: () => void } } };
    signInWithPassword?: (credentials: {
      email: string;
      password: string;
    }) => Promise<{
      data?: { session?: Session | null };
      error?: Error | null;
    }>;
    signUp?: (credentials: { email: string; password: string }) => Promise<{
      data?: { session?: Session | null };
      error?: Error | null;
    }>;
    signOut?: () => Promise<{ error?: Error | null }>;
  };
};

type SupabaseSessionResult = {
  data?: { session?: Session | null } | null;
  error?: { message?: string } | null;
};

type BootstrapSessionResult = SupabaseSessionResult | { timedOut: true };

type AuthCredentials = {
  email?: string;
  password?: string;
};

type AuthRuntime = {
  bootstrap: () => Promise<void>;
  loginWithEmail: (credentials?: AuthCredentials) => Promise<void>;
  signUpWithEmail: (credentials?: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  showLoginScreen: () => void;
  hideLoginScreen: () => void;
  getSupabaseClient: () => SupabaseClientLike;
};

type RuntimeWindow = Window & {
  supabase?: {
    createClient?: (
      url: string,
      key: string,
      options?: Record<string, unknown>
    ) => SupabaseClientLike;
  };
  __IRONFORGE_SUPABASE__?: SupabaseClientLike;
  __IRONFORGE_SUPABASE_URL__?: string;
  __IRONFORGE_SUPABASE_PUBLISHABLE_KEY__?: string;
  __IRONFORGE_GET_SUPABASE_CLIENT__?: () => SupabaseClientLike;
  __IRONFORGE_SET_LEGACY_RUNTIME_STATE__?: (
    partial: Record<string, unknown>
  ) => void;
  __IRONFORGE_LOGIN_DEBUG__?: {
    trace?: (message: string, details?: Record<string, unknown>) => void;
  };
  __IRONFORGE_AUTH_RUNTIME__?: AuthRuntime;
  __IRONFORGE_SET_AUTH_STATE__?: (partial: Record<string, unknown>) => void;
  __IRONFORGE_SET_AUTH_LOGGED_IN__?: (isLoggedIn: boolean) => void;
  loginWithEmail?: (credentials?: AuthCredentials) => Promise<void>;
  signUpWithEmail?: (credentials?: AuthCredentials) => Promise<void>;
  logout?: () => Promise<void>;
  showLoginScreen?: () => void;
  hideLoginScreen?: () => void;
  // Legacy data functions called directly by auth-runtime
  loadData?: (options?: { allowCloudSync?: boolean }) => Promise<void>;
  setupRealtimeSync?: () => void;
  teardownRealtimeSync?: () => void;
  resetRuntimeState?: () => void;
  clearNutritionLocalData?: (options?: {
    includeScoped?: boolean;
    includeLegacy?: boolean;
  }) => void;
  renderSyncStatus?: () => void;
  updateDashboard?: () => void;
  notifySettingsAccountIsland?: () => void;
  currentUser?: Record<string, unknown> | null;
  navigator: Navigator & {
    standalone?: boolean;
  };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_BOOTSTRAP_TIMEOUT_MS = 4000;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let sharedSupabaseClient: SupabaseClientLike | null = null;
let authRuntimeInstance: AuthRuntime | null = null;
let bootstrapPromise: Promise<void> | null = null;
let authSubscriptionAttached = false;
let activeMutationId = 0;
let lastAppliedSessionSignature = 'uninitialized';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRuntimeWindow(): RuntimeWindow | null {
  if (typeof window === 'undefined') return null;
  return window as RuntimeWindow;
}

function trace(message: string, details?: Record<string, unknown>) {
  try {
    getRuntimeWindow()?.__IRONFORGE_LOGIN_DEBUG__?.trace?.(message, details);
  } catch (_error) {
    /* diagnostic only */
  }
}

function isStandaloneDisplayMode(runtimeWindow: RuntimeWindow) {
  return (
    runtimeWindow.matchMedia?.('(display-mode: standalone)')?.matches ===
      true || runtimeWindow.navigator.standalone === true
  );
}

async function noOpSupabaseLock(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<unknown>
) {
  return await fn();
}

function setAuthState(
  partial: Partial<ReturnType<typeof useRuntimeStore.getState>['auth']>
) {
  useRuntimeStore.getState().setAuthState(partial);
}

function describeSession(session: Session | null | undefined) {
  return {
    hasSession: !!session,
    userId: session?.user?.id || '',
    hasUser: !!session?.user,
  };
}

function getSessionSignature(session: Session | null | undefined) {
  return session?.user?.id ? `user:${session.user.id}` : 'signed_out';
}

// ---------------------------------------------------------------------------
// Supabase client — single creation point
// ---------------------------------------------------------------------------

function ensureSupabaseClient(): SupabaseClientLike {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) {
    throw new Error('Auth runtime is unavailable outside the browser.');
  }
  if (sharedSupabaseClient?.auth) {
    return sharedSupabaseClient;
  }
  if (runtimeWindow.__IRONFORGE_SUPABASE__?.auth) {
    sharedSupabaseClient = runtimeWindow.__IRONFORGE_SUPABASE__;
    trace('auth runtime reused existing supabase client', {
      standalone: isStandaloneDisplayMode(runtimeWindow),
    });
    return sharedSupabaseClient;
  }

  const createClient = runtimeWindow.supabase?.createClient;
  const baseUrl = String(runtimeWindow.__IRONFORGE_SUPABASE_URL__ || '').trim();
  const publishableKey = String(
    runtimeWindow.__IRONFORGE_SUPABASE_PUBLISHABLE_KEY__ || ''
  ).trim();

  if (!createClient || !baseUrl || !publishableKey) {
    throw new Error('Supabase auth is not ready.');
  }

  const options = isStandaloneDisplayMode(runtimeWindow)
    ? { auth: { lock: noOpSupabaseLock } }
    : {};

  sharedSupabaseClient = createClient(
    baseUrl,
    publishableKey,
    options
  ) as SupabaseClientLike;
  runtimeWindow.__IRONFORGE_SUPABASE__ = sharedSupabaseClient;

  trace('auth runtime created supabase client', {
    standalone: isStandaloneDisplayMode(runtimeWindow),
  });

  return sharedSupabaseClient;
}

// ---------------------------------------------------------------------------
// Legacy runtime calls — direct, no bridge
// ---------------------------------------------------------------------------

function syncLegacyCurrentUser(session: Session | null) {
  const runtimeWindow = getRuntimeWindow();
  const user = session?.user || null;
  runtimeWindow?.__IRONFORGE_SET_LEGACY_RUNTIME_STATE__?.({
    currentUser: user,
  });
  if (runtimeWindow) {
    runtimeWindow.currentUser = user as RuntimeWindow['currentUser'];
  }
}

async function loadUserData() {
  const runtimeWindow = getRuntimeWindow();
  if (typeof runtimeWindow?.loadData === 'function') {
    await runtimeWindow.loadData({ allowCloudSync: true });
  }
}

function startRealtimeSync() {
  const runtimeWindow = getRuntimeWindow();
  if (typeof runtimeWindow?.setupRealtimeSync === 'function') {
    runtimeWindow.setupRealtimeSync();
  }
}

function stopRealtimeSync() {
  const runtimeWindow = getRuntimeWindow();
  if (typeof runtimeWindow?.teardownRealtimeSync === 'function') {
    runtimeWindow.teardownRealtimeSync();
  }
}

function resetLegacyRuntimeState() {
  const runtimeWindow = getRuntimeWindow();
  if (typeof runtimeWindow?.resetRuntimeState === 'function') {
    runtimeWindow.resetRuntimeState();
  }
}

function clearNutritionData() {
  const runtimeWindow = getRuntimeWindow();
  if (typeof runtimeWindow?.clearNutritionLocalData === 'function') {
    runtimeWindow.clearNutritionLocalData({
      includeScoped: true,
      includeLegacy: true,
    });
  }
}

function notifyLegacySignedIn() {
  const runtimeWindow = getRuntimeWindow();
  runtimeWindow?.renderSyncStatus?.();
  if (typeof runtimeWindow?.notifySettingsAccountIsland === 'function') {
    runtimeWindow.notifySettingsAccountIsland();
  }
}

function notifyLegacySignedOut() {
  const runtimeWindow = getRuntimeWindow();
  runtimeWindow?.renderSyncStatus?.();
  if (typeof runtimeWindow?.notifySettingsAccountIsland === 'function') {
    runtimeWindow.notifySettingsAccountIsland();
  }
  if (typeof runtimeWindow?.updateDashboard === 'function') {
    runtimeWindow.updateDashboard();
  }
}

// ---------------------------------------------------------------------------
// Mutation guards
// ---------------------------------------------------------------------------

function beginMutation(kind: 'sign_in' | 'sign_up' | 'sign_out') {
  activeMutationId += 1;
  trace('auth runtime mutation start', { kind, mutationId: activeMutationId });
  return activeMutationId;
}

function isCurrentMutation(mutationId: number) {
  return mutationId === activeMutationId;
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function setBootingState() {
  setAuthState({
    phase: 'booting',
    isLoggedIn: false,
    pendingAction: null,
    message: '',
    messageTone: '',
  });
}

function clearSignedOutState() {
  setAuthState({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: null,
    message: '',
    messageTone: '',
  });
}

function setSignedOutMessage(message: string) {
  setAuthState({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: null,
    message,
    messageTone: 'error',
  });
}

function normalizeCredentials(input?: AuthCredentials) {
  return {
    email: String(input?.email || '').trim(),
    password: String(input?.password || ''),
  };
}

// ---------------------------------------------------------------------------
// Session application — single owner, no bridge
// ---------------------------------------------------------------------------

async function applySignedInSession(
  session: Session,
  options?: { source?: string; mutationId?: number }
) {
  const source = String(options?.source || 'unknown');
  const mutationId = options?.mutationId;
  const sessionSignature = getSessionSignature(session);

  trace('auth runtime apply signed-in start', {
    source,
    mutationId: mutationId ?? null,
    ...describeSession(session),
  });

  // 1. Update React store to loading phase
  setAuthState({
    phase: 'loading',
    isLoggedIn: true,
    pendingAction: null,
  });

  // 2. Sync legacy current user
  syncLegacyCurrentUser(session);

  // 3. Load user data (AWAIT — not fire-and-forget)
  try {
    await loadUserData();
  } catch (error) {
    trace('auth runtime loadData failed', {
      source,
      message: error instanceof Error ? error.message : String(error),
    });
    // Data load failed, but auth succeeded — show app with error toast
    // Don't block the user from seeing the signed-in state
  }

  // 4. Stale check after async work
  if (mutationId != null && !isCurrentMutation(mutationId)) {
    trace('auth runtime stale after loadData', {
      source,
      mutationId,
      activeMutationId,
    });
    return false;
  }

  // 5. Start realtime sync
  startRealtimeSync();

  // 6. Commit signed-in state
  setAuthState({
    phase: 'signed_in',
    isLoggedIn: true,
    pendingAction: null,
    message: '',
    messageTone: '',
  });

  lastAppliedSessionSignature = sessionSignature;
  notifyLegacySignedIn();

  trace('auth runtime apply signed-in done', {
    source,
    mutationId: mutationId ?? null,
    ...describeSession(session),
  });

  return true;
}

async function applySignedOutSession(options?: {
  wasLoggedIn?: boolean;
  source?: string;
  mutationId?: number;
}) {
  const source = String(options?.source || 'unknown');
  const mutationId = options?.mutationId;
  const wasLoggedIn = options?.wasLoggedIn ?? false;

  trace('auth runtime apply signed-out start', {
    source,
    mutationId: mutationId ?? null,
    wasLoggedIn,
  });

  // 1. Update React store
  setAuthState({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: null,
  });

  // 2. Sync legacy state
  syncLegacyCurrentUser(null);

  // 3. Always clear signed-in runtime residue on a null session.
  stopRealtimeSync();
  resetLegacyRuntimeState();
  if (wasLoggedIn) {
    clearNutritionData();
  }
  notifyLegacySignedOut();

  lastAppliedSessionSignature = 'signed_out';

  trace('auth runtime apply signed-out done', { source });

  return true;
}

async function applySession(
  session: Session | null,
  options?: {
    wasLoggedIn?: boolean;
    source?: string;
    mutationId?: number;
  }
) {
  const source = String(options?.source || 'unknown');
  const mutationId = options?.mutationId;
  const sessionSignature = getSessionSignature(session);

  // Stale mutation guard
  if (mutationId != null && !isCurrentMutation(mutationId)) {
    trace('auth runtime skipped stale session apply', {
      source,
      mutationId,
      activeMutationId,
      ...describeSession(session),
    });
    return false;
  }

  // Duplicate guard — skip if same session already applied
  if (
    lastAppliedSessionSignature === sessionSignature &&
    useRuntimeStore.getState().auth.pendingAction === null &&
    (source === 'bootstrap' || source.indexOf('auth-state:') === 0)
  ) {
    trace('auth runtime skipped duplicate session apply', {
      source,
      sessionSignature,
    });
    return true;
  }

  if (session?.user) {
    return await applySignedInSession(session as Session, {
      source,
      mutationId,
    });
  } else {
    return await applySignedOutSession({
      wasLoggedIn: options?.wasLoggedIn,
      source,
      mutationId,
    });
  }
}

// ---------------------------------------------------------------------------
// Auth state subscription
// ---------------------------------------------------------------------------

function attachAuthStateSubscription(
  authApi: NonNullable<SupabaseClientLike['auth']>
) {
  if (authSubscriptionAttached || !authApi.onAuthStateChange) return;

  authSubscriptionAttached = true;
  authApi.onAuthStateChange((event, session) => {
    const observedMutationId = activeMutationId;
    const wasLoggedIn = useRuntimeStore.getState().auth.isLoggedIn;
    trace('auth runtime auth-state event', {
      event,
      observedMutationId,
      wasLoggedIn,
      ...describeSession(session),
    });

    window.setTimeout(() => {
      void applySession(session, {
        wasLoggedIn,
        source: `auth-state:${event}`,
        mutationId: observedMutationId,
      })
        .then((applied) => {
          if (!applied) return;
          setAuthState({ message: '', messageTone: '' });
        })
        .catch((error) => {
          if (!isCurrentMutation(observedMutationId)) {
            trace('auth runtime ignored stale auth-state error', {
              event,
              observedMutationId,
              activeMutationId,
            });
            return;
          }
          trace('auth runtime auth-state error', {
            event,
            message: error instanceof Error ? error.message : String(error),
          });
          setSignedOutMessage(
            error instanceof Error
              ? error.message
              : t(
                  'login.finish_error',
                  'Unable to finish signing in right now.'
                )
          );
        });
    }, 0);
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function resolveBootstrapSession(
  getSession: () => Promise<{
    data?: { session?: Session | null };
    error?: Error | null;
  }>
): Promise<BootstrapSessionResult> {
  return await Promise.race([
    getSession() as Promise<SupabaseSessionResult>,
    new Promise<BootstrapSessionResult>((resolve) => {
      window.setTimeout(
        () => resolve({ timedOut: true }),
        SESSION_BOOTSTRAP_TIMEOUT_MS
      );
    }),
  ]);
}

export async function bootstrapAuthRuntime() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const supabaseClient = ensureSupabaseClient();
    const authApi = supabaseClient.auth;
    if (!authApi?.getSession || !authApi.onAuthStateChange) {
      throw new Error('Supabase auth is not available.');
    }
    const getSession = authApi.getSession.bind(authApi);
    const observedMutationId = activeMutationId;

    setBootingState();
    trace('auth runtime bootstrap start', { observedMutationId });
    attachAuthStateSubscription(authApi);

    try {
      const sessionResult = await resolveBootstrapSession(getSession);

      if (observedMutationId !== activeMutationId) {
        trace('auth runtime bootstrap ignored after newer mutation', {
          observedMutationId,
          activeMutationId,
        });
        return;
      }

      if ('timedOut' in sessionResult) {
        trace('auth runtime bootstrap timed out', {
          timeoutMs: SESSION_BOOTSTRAP_TIMEOUT_MS,
        });
        clearSignedOutState();
        return;
      }

      const session = sessionResult?.data?.session || null;
      trace('auth runtime bootstrap resolved', describeSession(session));

      const applied = await applySession(session, {
        wasLoggedIn: false,
        source: 'bootstrap',
        mutationId: observedMutationId,
      });

      if (!applied) return;
      setAuthState({ message: '', messageTone: '' });
    } catch (error) {
      if (observedMutationId !== activeMutationId) {
        trace('auth runtime ignored stale bootstrap error', {
          observedMutationId,
          activeMutationId,
        });
        return;
      }
      trace('auth runtime bootstrap error', {
        message: error instanceof Error ? error.message : String(error),
      });
      setSignedOutMessage(
        error instanceof Error
          ? error.message
          : t('login.finish_error', 'Unable to finish signing in right now.')
      );
    }
  })();

  return bootstrapPromise;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function loginWithEmailPassword(credentials?: AuthCredentials) {
  const mutationId = beginMutation('sign_in');
  const supabaseClient = ensureSupabaseClient();
  const authApi = supabaseClient.auth;
  const { email, password } = normalizeCredentials(credentials);

  if (!authApi?.signInWithPassword) {
    throw new Error('Supabase auth is not available.');
  }

  trace('auth runtime sign-in start', {
    mutationId,
    hasEmail: !!email,
    hasPassword: !!password,
  });

  setAuthState({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: 'sign_in',
    message: '',
    messageTone: '',
  });

  if (!email || !password) {
    setSignedOutMessage(
      t('login.enter_credentials', 'Enter your email and password.')
    );
    return;
  }

  try {
    const result = (await authApi.signInWithPassword({
      email,
      password,
    })) as SupabaseSessionResult;

    if (!isCurrentMutation(mutationId)) {
      trace('auth runtime ignored stale sign-in result', {
        mutationId,
        activeMutationId,
      });
      return;
    }

    trace('auth runtime sign-in resolved', {
      mutationId,
      hasError: !!result?.error,
      ...describeSession(result?.data?.session || null),
    });

    if (result?.error) {
      setSignedOutMessage(
        result.error.message ||
          t('login.sign_in_error', 'Unable to sign in right now.')
      );
      return;
    }

    if (!result?.data?.session) {
      setSignedOutMessage(
        t('login.finish_error', 'Unable to finish signing in right now.')
      );
      return;
    }

    const applied = await applySession(result.data.session, {
      wasLoggedIn: false,
      source: 'sign-in-result',
      mutationId,
    });

    if (!applied) return;
    setAuthState({ message: '', messageTone: '' });
  } catch (error) {
    if (!isCurrentMutation(mutationId)) {
      trace('auth runtime ignored stale sign-in error', {
        mutationId,
        activeMutationId,
      });
      return;
    }
    trace('auth runtime sign-in threw', {
      mutationId,
      message: error instanceof Error ? error.message : String(error),
    });
    setSignedOutMessage(
      error instanceof Error
        ? error.message
        : t('login.sign_in_error', 'Unable to sign in right now.')
    );
  }
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

export async function signUpWithEmailPassword(credentials?: AuthCredentials) {
  const mutationId = beginMutation('sign_up');
  const supabaseClient = ensureSupabaseClient();
  const authApi = supabaseClient.auth;
  const { email, password } = normalizeCredentials(credentials);

  if (!authApi?.signUp) {
    throw new Error('Supabase auth is not available.');
  }

  trace('auth runtime sign-up start', {
    mutationId,
    hasEmail: !!email,
    passwordLength: password.length,
  });

  setAuthState({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: 'sign_up',
    message: '',
    messageTone: '',
  });

  if (!email || !password) {
    setSignedOutMessage(
      t('login.enter_credentials', 'Enter your email and password.')
    );
    return;
  }

  try {
    const result = (await authApi.signUp({
      email,
      password,
    })) as SupabaseSessionResult;

    if (!isCurrentMutation(mutationId)) {
      trace('auth runtime ignored stale sign-up result', {
        mutationId,
        activeMutationId,
      });
      return;
    }

    trace('auth runtime sign-up resolved', {
      mutationId,
      hasError: !!result?.error,
      ...describeSession(result?.data?.session || null),
    });

    if (result?.error) {
      setSignedOutMessage(
        result.error.message ||
          t('login.sign_up_error', 'Unable to create account right now.')
      );
      return;
    }

    setAuthState({
      phase: 'signed_out',
      isLoggedIn: false,
      pendingAction: null,
      message: t(
        'login.account_created',
        'Account created! Check your email to confirm, then sign in.'
      ),
      messageTone: 'info',
    });
  } catch (error) {
    if (!isCurrentMutation(mutationId)) {
      trace('auth runtime ignored stale sign-up error', {
        mutationId,
        activeMutationId,
      });
      return;
    }
    trace('auth runtime sign-up threw', {
      mutationId,
      message: error instanceof Error ? error.message : String(error),
    });
    setSignedOutMessage(
      error instanceof Error
        ? error.message
        : t('login.sign_up_error', 'Unable to create account right now.')
    );
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logoutFromAuthRuntime() {
  const mutationId = beginMutation('sign_out');
  const supabaseClient = ensureSupabaseClient();
  const authApi = supabaseClient.auth;
  const wasLoggedIn = useRuntimeStore.getState().auth.isLoggedIn;

  if (!authApi?.signOut) {
    throw new Error('Supabase auth is not available.');
  }

  trace('auth runtime sign-out start', { mutationId, wasLoggedIn });

  setAuthState({
    pendingAction: 'sign_out',
    message: '',
    messageTone: '',
  });

  try {
    const result = (await authApi.signOut()) as {
      error?: Error | { message?: string } | null;
    };

    if (!isCurrentMutation(mutationId)) {
      trace('auth runtime ignored stale sign-out result', {
        mutationId,
        activeMutationId,
      });
      return;
    }

    if (result?.error) {
      throw result.error;
    }

    trace('auth runtime sign-out resolved', { mutationId });

    await applySession(null, {
      wasLoggedIn,
      source: 'sign-out-result',
      mutationId,
    });
  } catch (error) {
    if (!isCurrentMutation(mutationId)) {
      trace('auth runtime ignored stale sign-out error', {
        mutationId,
        activeMutationId,
      });
      return;
    }
    trace('auth runtime sign-out threw', {
      mutationId,
      message: error instanceof Error ? error.message : String(error),
    });
    setAuthState({
      pendingAction: null,
      message:
        error instanceof Error
          ? error.message
          : t('login.sign_out_error', 'Unable to sign out right now.'),
      messageTone: 'error',
    });
  }
}

// ---------------------------------------------------------------------------
// Login screen helpers
// ---------------------------------------------------------------------------

export function showLoginScreen() {
  setAuthState({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: null,
  });
}

export function hideLoginScreen() {
  setAuthState({
    phase: 'signed_in',
    isLoggedIn: true,
    pendingAction: null,
  });
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export function installAuthRuntime() {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;

  if (authRuntimeInstance) {
    runtimeWindow.__IRONFORGE_AUTH_RUNTIME__ = authRuntimeInstance;
    runtimeWindow.__IRONFORGE_GET_SUPABASE_CLIENT__ =
      authRuntimeInstance.getSupabaseClient;
    runtimeWindow.loginWithEmail = authRuntimeInstance.loginWithEmail;
    runtimeWindow.signUpWithEmail = authRuntimeInstance.signUpWithEmail;
    runtimeWindow.logout = authRuntimeInstance.logout;
    runtimeWindow.showLoginScreen = authRuntimeInstance.showLoginScreen;
    runtimeWindow.hideLoginScreen = authRuntimeInstance.hideLoginScreen;
    void authRuntimeInstance.bootstrap();
    return authRuntimeInstance;
  }

  authRuntimeInstance = {
    bootstrap: bootstrapAuthRuntime,
    loginWithEmail: loginWithEmailPassword,
    signUpWithEmail: signUpWithEmailPassword,
    logout: logoutFromAuthRuntime,
    showLoginScreen,
    hideLoginScreen,
    getSupabaseClient: ensureSupabaseClient,
  };

  runtimeWindow.__IRONFORGE_AUTH_RUNTIME__ = authRuntimeInstance;
  runtimeWindow.__IRONFORGE_GET_SUPABASE_CLIENT__ =
    authRuntimeInstance.getSupabaseClient;
  runtimeWindow.loginWithEmail = authRuntimeInstance.loginWithEmail;
  runtimeWindow.signUpWithEmail = authRuntimeInstance.signUpWithEmail;
  runtimeWindow.logout = authRuntimeInstance.logout;
  runtimeWindow.showLoginScreen = authRuntimeInstance.showLoginScreen;
  runtimeWindow.hideLoginScreen = authRuntimeInstance.hideLoginScreen;

  void authRuntimeInstance.bootstrap();
  return authRuntimeInstance;
}
