import { useEffect, useRef, useState } from 'react';
import { t } from './services/i18n.ts';
import { useRuntimeStore } from './store/runtime-store.ts';
import {
  loginWithEmailPassword,
  signUpWithEmailPassword,
} from './services/auth-runtime.ts';
import loginHeroImage from '../../assets/ironforge_bg.webp';

const START_RETRY_LIMIT = 24;

function getBuildLabel() {
  if (typeof window === 'undefined') return '';
  return String(window.__IRONFORGE_APP_VERSION__ || '').trim();
}

const MIN_EMBERS = 18;
const MAX_EMBERS = 34;
const COLOR_A = [255, 122, 58];
const COLOR_B = [255, 158, 82];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function emberColor(t, alpha) {
  const r = Math.round(lerp(COLOR_A[0], COLOR_B[0], t));
  const g = Math.round(lerp(COLOR_A[1], COLOR_B[1], t));
  const b = Math.round(lerp(COLOR_A[2], COLOR_B[2], t));
  return `rgba(${r},${g},${b},${alpha})`;
}

function resetEmber(ember, initial, width, height) {
  const fromForge = Math.random() < 0.82;
  const originX = width * 0.5;
  const spread = fromForge ? width * 0.32 : width * 0.72;

  ember.size = fromForge
    ? 0.8 + Math.random() * 1.8
    : 0.6 + Math.random() * 1.2;
  ember.x = fromForge
    ? originX + (Math.random() - 0.5) * spread
    : Math.random() * width;
  ember.y = initial
    ? fromForge
      ? height * 0.64 + Math.random() * height * 0.22
      : height * 0.4 + Math.random() * height * 0.36
    : fromForge
      ? height * 0.8 + Math.random() * height * 0.12
      : height * 0.58 + Math.random() * height * 0.24;
  ember.speed = fromForge ? 8 + Math.random() * 16 : 6 + Math.random() * 10;
  ember.drift = (Math.random() - 0.5) * (fromForge ? 8 : 4);
  ember.phase = Math.random() * Math.PI * 2;
  ember.wiggle = 0.35 + Math.random() * 0.95;
  ember.life = 0.55 + Math.random() * 0.95;
  ember.alpha = fromForge
    ? 0.14 + Math.random() * 0.2
    : 0.08 + Math.random() * 0.14;
  ember.t = Math.random();
}

function useForgeSparkEngine(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect prefers-reduced-motion
    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );
    if (reducedMotionQuery.matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let embers = [];
    let animationId = 0;
    let retryAnimationId = 0;
    let retryTimeoutId = 0;
    let startAttempts = 0;
    let lastTs = 0;
    let isRunning = false;
    let isMounted = true;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width || window.innerWidth || 1));
      height = Math.max(1, Math.floor(rect.height || window.innerHeight || 1));
      dpr = clamp(window.devicePixelRatio || 1, 1, 1.75);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!embers.length) {
        const total = Math.floor(lerp(MIN_EMBERS, MAX_EMBERS, Math.random()));
        embers = Array.from({ length: total }, () => {
          const ember = {};
          resetEmber(ember, true, width, height);
          return ember;
        });
      }
    }

    function draw(ts) {
      if (!isRunning || !ctx) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.033);
      lastTs = ts;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < embers.length; i++) {
        const ember = embers[i];
        ember.y -= ember.speed * dt;
        ember.x +=
          (ember.drift +
            Math.sin(ts * 0.0012 + ember.phase) * ember.wiggle * 3.8) *
          dt;
        ember.life -= dt * 0.22;
        ember.alpha = Math.max(0, ember.alpha - dt * 0.024);

        if (ember.y < -10 || ember.life <= 0 || ember.alpha <= 0) {
          resetEmber(ember, false, width, height);
        }

        const fadeTop = clamp((height - ember.y) / (height * 0.9), 0, 1);
        const alpha = ember.alpha * (1 - fadeTop * 0.88);
        if (alpha <= 0.01) continue;

        ctx.beginPath();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = emberColor(ember.t, alpha);
        ctx.shadowColor = emberColor(ember.t, alpha * 0.38);
        ctx.shadowBlur = 2;
        ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Forge glow at base of anvil
      const forgeGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.82,
        8,
        width * 0.5,
        height * 0.82,
        height * 0.2
      );
      forgeGlow.addColorStop(0, 'rgba(255,132,46,0.1)');
      forgeGlow.addColorStop(0.52, 'rgba(255,120,40,0.045)');
      forgeGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = forgeGlow;
      ctx.fillRect(0, 0, width, height);

      ctx.shadowBlur = 0;
      animationId = requestAnimationFrame(draw);
    }

    function start() {
      if (!isMounted || isRunning) return;
      resize();
      lastTs = 0;
      isRunning = true;
      window.addEventListener('resize', resize);
      animationId = requestAnimationFrame(draw);
    }

    function clearPendingStartRetry() {
      if (retryAnimationId) cancelAnimationFrame(retryAnimationId);
      if (retryTimeoutId) window.clearTimeout(retryTimeoutId);
      retryAnimationId = 0;
      retryTimeoutId = 0;
    }

    // Retry until canvas has real dimensions and layout has settled.
    function tryStart() {
      if (!isMounted || isRunning) return;
      const rect = canvas.getBoundingClientRect();
      if ((rect.width || 0) > 1 && (rect.height || 0) > 1) {
        clearPendingStartRetry();
        startAttempts = 0;
        start();
        return;
      }

      startAttempts += 1;
      if (startAttempts >= START_RETRY_LIMIT) return;

      clearPendingStartRetry();
      retryAnimationId = requestAnimationFrame(tryStart);
      retryTimeoutId = window.setTimeout(() => {
        retryAnimationId = 0;
        tryStart();
      }, 120);
    }

    requestAnimationFrame(tryStart);

    function onVisibilityChange() {
      if (document.hidden) {
        if (isRunning) {
          isRunning = false;
          cancelAnimationFrame(animationId);
          animationId = 0;
        }
        return;
      }
      if (!isRunning) {
        lastTs = 0;
        tryStart();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      isMounted = false;
      isRunning = false;
      cancelAnimationFrame(animationId);
      clearPendingStartRetry();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
      if (ctx) ctx.clearRect(0, 0, width, height);
    };
  }, [canvasRef]);
}

export default function LoginScreen() {
  const auth = useRuntimeStore((state) => state.auth);
  const setAuthState = useRuntimeStore((state) => state.setAuthState);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [buildLabel] = useState(() => getBuildLabel());
  const canvasRef = useRef(null);

  useEffect(() => {
    window.__IRONFORGE_LOGIN_DEBUG__?.render?.();
  }, []);

  useForgeSparkEngine(canvasRef);

  function clearAuthMessage() {
    if (!auth.message) return;
    setAuthState({ message: '', messageTone: '' });
  }

  // iOS autofill sometimes fills the DOM without triggering React's onChange.
  // Reading directly from the DOM ensures we catch autofilled values.
  function resolveCredentials() {
    const emailEl = document.getElementById('login-email');
    const passwordEl = document.getElementById('login-password');
    return {
      resolvedEmail: (email || emailEl?.value || '').trim(),
      resolvedPassword: password || passwordEl?.value || '',
    };
  }

  async function runSignIn() {
    const { resolvedEmail, resolvedPassword } = resolveCredentials();
    if (!resolvedEmail || !resolvedPassword) {
      setAuthState({
        message: t('login.enter_credentials', 'Enter your email and password.'),
        messageTone: 'error',
      });
      return;
    }
    try {
      await loginWithEmailPassword({
        email: resolvedEmail,
        password: resolvedPassword,
      });
    } catch (err) {
      setAuthState({
        message:
          err instanceof Error
            ? err.message
            : t('login.sign_in_error', 'Unable to sign in right now.'),
        messageTone: 'error',
        pendingAction: null,
      });
    }
  }

  async function runSignUp() {
    const { resolvedEmail, resolvedPassword } = resolveCredentials();
    if (!resolvedEmail || !resolvedPassword) {
      setAuthState({
        message: t('login.enter_credentials', 'Enter your email and password.'),
        messageTone: 'error',
      });
      return;
    }
    if (resolvedPassword.length < 6) {
      setAuthState({
        message: t(
          'login.password_short',
          'Password must be at least 6 characters.'
        ),
        messageTone: 'error',
      });
      return;
    }
    try {
      await signUpWithEmailPassword({
        email: resolvedEmail,
        password: resolvedPassword,
      });
    } catch (err) {
      setAuthState({
        message:
          err instanceof Error
            ? err.message
            : t('login.sign_up_error', 'Unable to create account right now.'),
        messageTone: 'error',
        pendingAction: null,
      });
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    await runSignIn();
  }

  async function handleSignUp(event) {
    event.preventDefault();
    await runSignUp();
  }

  const isBusy = auth.pendingAction !== null || auth.phase === 'loading';
  const statusMessage = auth.message || '';
  const statusToneClass =
    auth.messageTone === 'error' ? 'text-red-300' : 'text-[#ffb07a]';
  const signInLabel =
    auth.pendingAction === 'sign_in'
      ? t('login.signing_in', 'Signing in...')
      : t('login.sign_in', 'Sign In');
  const signUpLabel =
    auth.pendingAction === 'sign_up'
      ? t('login.creating_account', 'Creating account...')
      : t('login.create_account', 'Create Account');
  const credentialInputClass =
    'login-credential-input h-[52px] w-full rounded-[15px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,13,20,0.18)_0%,rgba(12,13,20,0.1)_100%)] px-4 text-center text-[14px] text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.9)] placeholder:text-[rgba(235,239,248,0.42)] placeholder:[text-shadow:none] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_18px_rgba(0,0,0,0.14)] outline-none backdrop-blur-[6px] transition-[border-color,box-shadow,background-color] focus:border-[#ff7a3a]/75 focus:bg-[linear-gradient(180deg,rgba(14,16,24,0.24)_0%,rgba(14,16,24,0.14)_100%)] focus:shadow-[0_0_0_3px_rgba(255,122,58,0.14),0_12px_28px_rgba(0,0,0,0.22)] focus:ring-0 disabled:opacity-60';

  return (
    <div
      id="login-screen"
      data-ui="auth-screen"
      className="relative min-h-[100dvh] overflow-hidden bg-[#110d0a] text-white"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(15,10,7,0.03) 0%, rgba(13,9,7,0.34) 54%, rgba(10,8,7,0.56) 100%), url(${loginHeroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <style>{`
        #login-screen .login-credential-input:-webkit-autofill,
        #login-screen .login-credential-input:-webkit-autofill:hover,
        #login-screen .login-credential-input:-webkit-autofill:focus {
          -webkit-box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 0 0 1000px rgba(12, 13, 20, 0.16) inset,
            0 8px 18px rgba(0, 0, 0, 0.14);
          -webkit-text-fill-color: rgba(255, 255, 255, 0.92);
          caret-color: rgba(255, 255, 255, 0.92);
          text-shadow: 0 1px 10px rgba(0, 0, 0, 0.9);
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* Spark particle canvas */}
      <canvas
        ref={canvasRef}
        id="sparks"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[55%] bg-[radial-gradient(ellipse_60%_45%_at_50%_22%,rgba(255,130,40,0.1),transparent_70%)]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[55%] bg-[linear-gradient(0deg,rgba(11,8,7,0.66)_0%,rgba(11,8,7,0.4)_36%,transparent_100%)]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-[8%] z-0 h-[30%] bg-[radial-gradient(ellipse_58%_42%_at_50%_68%,rgba(255,131,47,0.2),rgba(255,131,47,0.07)_34%,transparent_72%)]" />

      <div className="pointer-events-none absolute inset-0 z-20" />
      <div
        className="absolute z-20 w-full px-5 sm:px-6"
        style={{
          top: '42%',
          bottom: '33%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="w-full max-w-xs pointer-events-auto">
          <form className="space-y-[10px]" onSubmit={handleSignIn}>
            <input
              className={credentialInputClass}
              type="email"
              id="login-email"
              placeholder={t('login.email', 'Email')}
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.currentTarget.value);
                clearAuthMessage();
              }}
              disabled={isBusy}
            />

            <input
              className={credentialInputClass}
              type="password"
              id="login-password"
              placeholder={t('login.password', 'Password')}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.currentTarget.value);
                clearAuthMessage();
              }}
              disabled={isBusy}
            />

            <div
              id="login-error"
              className={`min-h-[16px] text-center text-[12px] ${statusToneClass}`}
            >
              {statusMessage}
            </div>

            <pre
              id="login-debug"
              hidden
              aria-live="polite"
              className="hidden max-h-44 overflow-auto rounded-xl border border-white/10 bg-black/45 p-3 text-left font-mono text-[11px] leading-5 text-slate-200"
            />

            <button
              type="submit"
              disabled={isBusy}
              data-ui="auth-sign-in"
              className="mt-2 h-14 w-full rounded-[18px] bg-[linear-gradient(90deg,#e36a2c_0%,#ff8a3d_100%)] text-[16px] font-bold tracking-[0.04em] text-white shadow-[0_14px_36px_rgba(255,122,58,0.2),0_0_24px_rgba(255,122,58,0.16)] transition active:scale-[0.96] disabled:opacity-60"
            >
              {signInLabel}
            </button>

            <button
              type="button"
              onClick={handleSignUp}
              disabled={isBusy}
              data-ui="auth-sign-up"
              className="mt-2 h-14 w-full rounded-[18px] border border-[#ff7a3a]/60 bg-[rgba(0,0,0,0.18)] text-[16px] font-bold tracking-[0.04em] text-[#ff8b3f] transition active:scale-[0.96] disabled:opacity-60"
            >
              {signUpLabel}
            </button>
          </form>

          <div className="mt-3 flex items-center justify-center gap-4 text-[9px] uppercase tracking-[0.2em] text-white/25">
            <span>{t('login.stack_label', 'React Auth')}</span>
            {buildLabel ? <span>{buildLabel}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
