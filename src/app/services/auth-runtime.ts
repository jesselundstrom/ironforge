import type { Session } from '@supabase/supabase-js';
import { useRuntimeStore } from '../store/runtime-store';
import { t } from './i18n';

type MutableRecord = Record<string, unknown>;

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
    signUp?: (credentials: {
      email: string;
      password: string;
    }) => Promise<{
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

type BootstrapSessionResult =
  | SupabaseSessionResult
  | {
      timedOut: true;
    };

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
  __IRONFORGE_APPLY_AUTH_SESSION__?: (
    session: Session | null,
    options?: Record<string, unknown>
  ) => Promise<void> | void;
  __IRONFORGE_REPORT_AUTH_SESSION_ERROR__?: (error: unknown) => void;
  __IRONFORGE_LOGIN_DEBUG__?: {
    trace?: (message: string, details?: Record<string, unknown>) => void;
  };
  __IRONFORGE_AUTH_RUNTIME__?: AuthRuntime;
  loginWithEmail?: (credentials?: AuthCredentials) => Promise<void>;
  signUpWithEmail?: (credentials?: AuthCredentials) => Promise<void>;
  logout?: () => Promise<void>;
  showLoginScreen?: () => void;
  hideLoginScreen?: () => void;
  navigator: Navigator & {
    standalone?: boolean;
  };
};

const SESSION_BOOTSTRAP_TIMEOUT_MS = 4000;

let sharedSupabaseClient: SupabaseClientLike | null = null;
let authRuntimeInstance: AuthRuntime | null = null;
let bootstrapPromise: Promise<void> | null = null;
let authSubscriptionAttached = false;
let activeMutationId = 0;
let lastAppliedSessionSignature = 'uninitialized';

function getRuntimeWindow(): RuntimeWindow | null {
  if (typeof window === 'undefined') return null;
  return window as RuntimeWindow;
}

function trace(message: string, details?: Record<string, unknown>) {
  try {
    getRuntimeWindow()?.__IRONFORGE_LOGIN_DEBUG__?.trace?.(message, details);
  } catch (_error) {}
}

function isStandaloneDisplayMode(runtimeWindow: RuntimeWindow) {
  return (
    runtimeWindow.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    runtimeWindow.navigator.standalone === true
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

function reportAuthError(error: unknown) {
  getRuntimeWindow()?.__IRONFORGE_REPORT_AUTH_SESSION_ERROR__?.(error);
}

function beginMutation(kind: 'sign_in' | 'sign_up' | 'sign_out') {
  activeMutationId += 1;
  trace('auth runtime mutation start', {
    kind,
    mutationId: activeMutationId,
  });
  return activeMutationId;
}

function isCurrentMutation(mutationId: number) {
  return mutationId === activeMutationId;
}

function normalizeCredentials(input?: AuthCredentials) {
  return {
    email: String(input?.email || '').trim(),
    password: String(input?.password || ''),
  };
}

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

async function applySessionWithSideEffects(
  session: Session | null,
  options?: {
    wasLoggedIn?: boolean;
    source?: string;
    mutationId?: number;
  }
) {
  const runtimeWindow = getRuntimeWindow();
  const source = String(options?.source || 'unknown');
  const mutationId = options?.mutationId;
  const sessionSignature = getSessionSignature(session);

  if (mutationId != null && !isCurrentMutation(mutationId)) {
    trace('auth runtime skipped stale session apply', {
      source,
      mutationId,
      activeMutationId,
      ...describeSession(session),
    });
    return false;
  }

  const sessionUser = (session?.user as unknown as MutableRecord | null) || null;
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
  trace('auth runtime apply session start', {
    source,
    mutationId: mutationId ?? null,
    ...describeSession(session),
  });

  setAuthState({
    phase: sessionUser ? 'signed_in' : 'signed_out',
    isLoggedIn: !!sessionUser,
    pendingAction: null,
  });

  await runtimeWindow?.__IRONFORGE_APPLY_AUTH_SESSION__?.(session, {
    wasLoggedIn: options?.wasLoggedIn,
    source,
  });
  lastAppliedSessionSignature = sessionSignature;

  trace('auth runtime apply session done', {
    source,
    mutationId: mutationId ?? null,
    ...describeSession(session),
  });

  return true;
}

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

function attachAuthStateSubscription(authApi: NonNullable<SupabaseClientLike['auth']>) {
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
      void applySessionWithSideEffects(session, {
        wasLoggedIn,
        source: `auth-state:${event}`,
        mutationId: observedMutationId,
      })
        .then((applied) => {
          if (!applied) return;
          setAuthState({
            message: '',
            messageTone: '',
          });
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
          reportAuthError(error);
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
    trace('auth runtime bootstrap start', {
      observedMutationId,
    });
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

      const applied = await applySessionWithSideEffects(session, {
        wasLoggedIn: false,
        source: 'bootstrap',
        mutationId: observedMutationId,
      });

      if (!applied) return;

      setAuthState({
        message: '',
        messageTone: '',
      });
    } catch (error) {
      if (observedMutationId !== activeMutationId) {
        trace('auth runtime ignored stale bootstrap error', {
          observedMutationId,
          activeMutationId,
        });
        return;
      }
      reportAuthError(error);
      setSignedOutMessage(
        error instanceof Error
          ? error.message
          : t(
              'login.finish_error',
              'Unable to finish signing in right now.'
            )
      );
    }
  })();

  return bootstrapPromise;
}

export async function loginWithEmailPassword(credentials?: AuthCredentials) {
  const mutationId = beginMutation('sign_in');
  const supabaseClient = ensureSupabaseClient();
  const authApi = supabaseClient.auth;
  const { email, password } = normalizeCredentials(credentials);

  if (!authApi?.signInWithPassword) {
    throw new Error('Supabase auth is not available.');
  }

  trace('auth runtime submit start', {
    action: 'sign_in',
    mutationId,
    hasEmail: !!email,
    hasPassword: !!password,
  });

  useRuntimeStore.getState().setAuthState({
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
      trace('auth runtime ignored stale submit result', {
        action: 'sign_in',
        mutationId,
        activeMutationId,
      });
      return;
    }

    trace('auth runtime submit resolved', {
      action: 'sign_in',
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

    const applied = await applySessionWithSideEffects(result.data.session, {
      wasLoggedIn: false,
      source: 'sign-in-result',
      mutationId,
    });

    if (!applied) return;

    setAuthState({
      message: '',
      messageTone: '',
    });
  } catch (error) {
    if (!isCurrentMutation(mutationId)) {
      trace('auth runtime ignored stale submit error', {
        action: 'sign_in',
        mutationId,
        activeMutationId,
      });
      return;
    }
    trace('auth runtime submit threw', {
      action: 'sign_in',
      mutationId,
      message: error instanceof Error ? error.message : String(error),
    });
    reportAuthError(error);
    setSignedOutMessage(
      error instanceof Error
        ? error.message
        : t('login.sign_in_error', 'Unable to sign in right now.')
    );
  }
}

export async function signUpWithEmailPassword(credentials?: AuthCredentials) {
  const mutationId = beginMutation('sign_up');
  const supabaseClient = ensureSupabaseClient();
  const authApi = supabaseClient.auth;
  const { email, password } = normalizeCredentials(credentials);

  if (!authApi?.signUp) {
    throw new Error('Supabase auth is not available.');
  }

  trace('auth runtime submit start', {
    action: 'sign_up',
    mutationId,
    hasEmail: !!email,
    passwordLength: password.length,
  });

  useRuntimeStore.getState().setAuthState({
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
    const result = (await authApi.signUp({ email, password })) as SupabaseSessionResult;

    if (!isCurrentMutation(mutationId)) {
      trace('auth runtime ignored stale submit result', {
        action: 'sign_up',
        mutationId,
        activeMutationId,
      });
      return;
    }

    trace('auth runtime submit resolved', {
      action: 'sign_up',
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
      trace('auth runtime ignored stale submit error', {
        action: 'sign_up',
        mutationId,
        activeMutationId,
      });
      return;
    }
    trace('auth runtime submit threw', {
      action: 'sign_up',
      mutationId,
      message: error instanceof Error ? error.message : String(error),
    });
    reportAuthError(error);
    setSignedOutMessage(
      error instanceof Error
        ? error.message
        : t('login.sign_up_error', 'Unable to create account right now.')
    );
  }
}

export async function logoutFromAuthRuntime() {
  const mutationId = beginMutation('sign_out');
  const supabaseClient = ensureSupabaseClient();
  const authApi = supabaseClient.auth;
  const wasLoggedIn = useRuntimeStore.getState().auth.isLoggedIn;

  if (!authApi?.signOut) {
    throw new Error('Supabase auth is not available.');
  }

  trace('auth runtime submit start', {
    action: 'sign_out',
    mutationId,
    wasLoggedIn,
  });

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
      trace('auth runtime ignored stale submit result', {
        action: 'sign_out',
        mutationId,
        activeMutationId,
      });
      return;
    }

    if (result?.error) {
      throw result.error;
    }

    trace('auth runtime submit resolved', {
      action: 'sign_out',
      mutationId,
      hasError: false,
    });

    await applySessionWithSideEffects(null, {
      wasLoggedIn,
      source: 'sign-out-result',
      mutationId,
    });
  } catch (error) {
    if (!isCurrentMutation(mutationId)) {
      trace('auth runtime ignored stale submit error', {
        action: 'sign_out',
        mutationId,
        activeMutationId,
      });
      return;
    }
    trace('auth runtime submit threw', {
      action: 'sign_out',
      mutationId,
      message: error instanceof Error ? error.message : String(error),
    });
    reportAuthError(error);
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
