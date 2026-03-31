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

type AuthRuntime = {
  bootstrap: () => Promise<void>;
  loginWithEmail: (credentials?: {
    email?: string;
    password?: string;
  }) => Promise<void>;
  signUpWithEmail: (credentials?: {
    email?: string;
    password?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  showLoginScreen: () => void;
  hideLoginScreen: () => void;
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
  __IRONFORGE_APPLY_AUTH_SESSION__?: (
    session: Session | null,
    options?: Record<string, unknown>
  ) => Promise<void> | void;
  __IRONFORGE_REPORT_AUTH_SESSION_ERROR__?: (error: unknown) => void;
  __IRONFORGE_LOGIN_DEBUG__?: {
    trace?: (message: string, details?: Record<string, unknown>) => void;
  };
  __IRONFORGE_AUTH_RUNTIME__?: AuthRuntime;
  loginWithEmail?: (credentials?: {
    email?: string;
    password?: string;
  }) => Promise<void>;
  signUpWithEmail?: (credentials?: {
    email?: string;
    password?: string;
  }) => Promise<void>;
  logout?: () => Promise<void>;
  showLoginScreen?: () => void;
  hideLoginScreen?: () => void;
  navigator: Navigator & {
    standalone?: boolean;
  };
};

let bootstrapPromise: Promise<void> | null = null;
let authSubscriptionAttached = false;
const SESSION_BOOTSTRAP_TIMEOUT_MS = 4000;

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

function ensureSupabaseClient(): SupabaseClientLike {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) {
    throw new Error('Auth runtime is unavailable outside the browser.');
  }
  if (runtimeWindow.__IRONFORGE_SUPABASE__?.auth) {
    return runtimeWindow.__IRONFORGE_SUPABASE__;
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

  runtimeWindow.__IRONFORGE_SUPABASE__ = createClient(
    baseUrl,
    publishableKey,
    options
  ) as SupabaseClientLike;

  trace('auth runtime created supabase client', {
    standalone: isStandaloneDisplayMode(runtimeWindow),
  });

  return runtimeWindow.__IRONFORGE_SUPABASE__ as SupabaseClientLike;
}

async function applySessionWithSideEffects(
  session: Session | null,
  options?: Record<string, unknown>
) {
  const runtimeWindow = getRuntimeWindow();
  const sessionUser = (session?.user as unknown as MutableRecord | null) || null;
  useRuntimeStore.getState().setAuthState({
    phase: sessionUser ? 'signed_in' : 'signed_out',
    isLoggedIn: !!sessionUser,
    pendingAction: null,
  });
  await runtimeWindow?.__IRONFORGE_APPLY_AUTH_SESSION__?.(session, options);
}

function reportAuthError(error: unknown) {
  getRuntimeWindow()?.__IRONFORGE_REPORT_AUTH_SESSION_ERROR__?.(error);
}

function setSignedOutMessage(message: string) {
  useRuntimeStore.getState().setAuthState({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: null,
    message,
    messageTone: 'error',
  });
}

function readCredential(input?: { email?: string; password?: string }) {
  if (input?.email || input?.password) {
    return {
      email: String(input.email || '').trim(),
      password: String(input.password || ''),
    };
  }

  const runtimeWindow = getRuntimeWindow();
  const emailField = runtimeWindow?.document.getElementById('login-email');
  const passwordField = runtimeWindow?.document.getElementById('login-password');

  return {
    email:
      emailField instanceof HTMLInputElement
        ? emailField.value.trim()
        : '',
    password:
      passwordField instanceof HTMLInputElement ? passwordField.value : '',
  };
}

function clearSignedOutState() {
  useRuntimeStore.getState().setAuthState({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: null,
    message: '',
    messageTone: '',
  });
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
      window.setTimeout(() => resolve({ timedOut: true }), SESSION_BOOTSTRAP_TIMEOUT_MS);
    }),
  ]);
}

function attachAuthStateSubscription(authApi: NonNullable<SupabaseClientLike['auth']>) {
  if (authSubscriptionAttached || !authApi.onAuthStateChange) return;

  authSubscriptionAttached = true;
  authApi.onAuthStateChange((event, session) => {
    const wasLoggedIn = useRuntimeStore.getState().auth.isLoggedIn;
    trace('auth runtime onAuthStateChange', {
      event,
      hasSession: !!session,
      userId: session?.user?.id || '',
      wasLoggedIn,
    });

    window.setTimeout(() => {
      void applySessionWithSideEffects(session, { wasLoggedIn }).catch(
        (error) => {
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
      );
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

    useRuntimeStore.getState().setAuthState({
      phase: 'booting',
      isLoggedIn: false,
      pendingAction: null,
      message: '',
      messageTone: '',
    });

    trace('auth runtime bootstrap start');
    attachAuthStateSubscription(authApi);

    try {
      const sessionResult = await resolveBootstrapSession(authApi.getSession);
      if ('timedOut' in sessionResult) {
        trace('auth runtime bootstrap timed out', {
          timeoutMs: SESSION_BOOTSTRAP_TIMEOUT_MS,
        });
        clearSignedOutState();
        return;
      }
      const session = sessionResult?.data?.session || null;

      trace('auth runtime bootstrap resolved', {
        hasSession: !!session,
        userId: session?.user?.id || '',
      });

      await applySessionWithSideEffects(session, { wasLoggedIn: false });
      useRuntimeStore.getState().setAuthState({
        message: '',
        messageTone: '',
      });
    } catch (error) {
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

export async function loginWithEmailPassword(credentials?: {
  email?: string;
  password?: string;
}) {
  const supabaseClient = ensureSupabaseClient();
  const authApi = supabaseClient.auth;
  const { email, password } = readCredential(credentials);

  if (!authApi?.signInWithPassword) {
    throw new Error('Supabase auth is not available.');
  }

  trace('auth runtime login start', {
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

  try {
    const result = (await authApi.signInWithPassword({
      email,
      password,
    })) as SupabaseSessionResult;
    if (result?.error) {
      trace('auth runtime login failed', {
        message: result.error.message || '',
      });
      setSignedOutMessage(
        result.error.message ||
          t('login.sign_in_error', 'Unable to sign in right now.')
      );
      return;
    }

    if (result?.data?.session) {
      await applySessionWithSideEffects(result.data.session, {
        wasLoggedIn: false,
      });
    } else {
      setSignedOutMessage(
        t('login.finish_error', 'Unable to finish signing in right now.')
      );
      return;
    }

    useRuntimeStore.getState().setAuthState({
      message: '',
      messageTone: '',
    });
  } catch (error) {
    trace('auth runtime login threw', {
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

export async function signUpWithEmailPassword(credentials?: {
  email?: string;
  password?: string;
}) {
  const supabaseClient = ensureSupabaseClient();
  const authApi = supabaseClient.auth;
  const { email, password } = readCredential(credentials);

  if (!authApi?.signUp) {
    throw new Error('Supabase auth is not available.');
  }

  trace('auth runtime signup start', {
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

  try {
    const result = (await authApi.signUp({ email, password })) as SupabaseSessionResult;
    if (result?.error) {
      trace('auth runtime signup failed', {
        message: result.error.message || '',
      });
      setSignedOutMessage(
        result.error.message ||
          t('login.sign_up_error', 'Unable to create account right now.')
      );
      return;
    }

    useRuntimeStore.getState().setAuthState({
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
    trace('auth runtime signup threw', {
      message: error instanceof Error ? error.message : String(error),
    });
    reportAuthError(error);
    setSignedOutMessage(
      error instanceof Error
        ? error.message
        : t(
            'login.sign_up_error',
            'Unable to create account right now.'
          )
    );
  }
}

export async function logoutFromAuthRuntime() {
  const supabaseClient = ensureSupabaseClient();
  const authApi = supabaseClient.auth;
  const wasLoggedIn = useRuntimeStore.getState().auth.isLoggedIn;

  if (!authApi?.signOut) {
    throw new Error('Supabase auth is not available.');
  }

  trace('auth runtime logout start', { wasLoggedIn });

  useRuntimeStore.getState().setAuthState({
    pendingAction: 'sign_out',
    message: '',
    messageTone: '',
  });

  try {
    const result = (await authApi.signOut()) as {
      error?: Error | { message?: string } | null;
    };
    if (result?.error) {
      throw result.error;
    }
    await applySessionWithSideEffects(null, { wasLoggedIn });
  } catch (error) {
    trace('auth runtime logout threw', {
      message: error instanceof Error ? error.message : String(error),
    });
    reportAuthError(error);
    useRuntimeStore.getState().setAuthState({
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
  useRuntimeStore.getState().setAuthState({
    phase: 'signed_out',
    isLoggedIn: false,
    pendingAction: null,
  });
}

export function hideLoginScreen() {
  useRuntimeStore.getState().setAuthState({
    phase: 'signed_in',
    isLoggedIn: true,
    pendingAction: null,
  });
}

export function installAuthRuntime() {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  if (runtimeWindow.__IRONFORGE_AUTH_RUNTIME__) {
    void runtimeWindow.__IRONFORGE_AUTH_RUNTIME__.bootstrap();
    return runtimeWindow.__IRONFORGE_AUTH_RUNTIME__;
  }

  const runtime: AuthRuntime = {
    bootstrap: bootstrapAuthRuntime,
    loginWithEmail: loginWithEmailPassword,
    signUpWithEmail: signUpWithEmailPassword,
    logout: logoutFromAuthRuntime,
    showLoginScreen,
    hideLoginScreen,
  };

  runtimeWindow.__IRONFORGE_AUTH_RUNTIME__ = runtime;
  runtimeWindow.loginWithEmail = runtime.loginWithEmail;
  runtimeWindow.signUpWithEmail = runtime.signUpWithEmail;
  runtimeWindow.logout = runtime.logout;
  runtimeWindow.showLoginScreen = runtime.showLoginScreen;
  runtimeWindow.hideLoginScreen = runtime.hideLoginScreen;

  void runtime.bootstrap();
  return runtime;
}
