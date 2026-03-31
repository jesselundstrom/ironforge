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
const COLOR_B = [255, 176, 103];

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

  ember.size = fromForge ? 0.8 + Math.random() * 1.8 : 0.6 + Math.random() * 1.2;
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
  ember.alpha = fromForge ? 0.24 + Math.random() * 0.36 : 0.16 + Math.random() * 0.22;
  ember.t = Math.random();
}

function useForgeSparkEngine(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect prefers-reduced-motion
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
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
        ember.x += (ember.drift + Math.sin(ts * 0.0012 + ember.phase) * ember.wiggle * 3.8) * dt;
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
        ctx.shadowColor = emberColor(ember.t, alpha * 0.6);
        ctx.shadowBlur = 3;
        ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Forge glow at base of anvil
      const forgeGlow = ctx.createRadialGradient(
        width * 0.5, height * 0.82, 8,
        width * 0.5, height * 0.82, height * 0.2
      );
      forgeGlow.addColorStop(0, 'rgba(255,132,46,0.18)');
      forgeGlow.addColorStop(0.52, 'rgba(255,120,40,0.09)');
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

  async function runSignIn() {
    if (!email.trim() || !password) {
      setAuthState({
        message: t(
          'login.enter_credentials',
          'Enter your email and password.'
        ),
        messageTone: 'error',
      });
      return;
    }
    await loginWithEmailPassword({ email, password });
  }

  async function runSignUp() {
    if (!email.trim() || !password) {
      setAuthState({
        message: t(
          'login.enter_credentials',
          'Enter your email and password.'
        ),
        messageTone: 'error',
      });
      return;
    }
    if (password.length < 6) {
      setAuthState({
        message: t(
          'login.password_short',
          'Password must be at least 6 characters.'
        ),
        messageTone: 'error',
      });
      return;
    }
    await signUpWithEmailPassword({ email, password });
  }

  async function handleSignIn(event) {
    event.preventDefault();
    await runSignIn();
  }

  async function handleSignUp(event) {
    event.preventDefault();
    await runSignUp();
  }

  const isBusy = auth.pendingAction !== null;
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

  return (
    <div
      id="login-screen"
      data-ui="auth-screen"
      className="relative min-h-[100dvh] overflow-hidden bg-[#090b10] text-white"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(8,11,16,0.05) 0%, rgba(5,7,11,0.55) 60%, rgba(4,6,10,0.88) 100%), url(${loginHeroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Spark particle canvas */}
      <canvas
        ref={canvasRef}
        id="sparks"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[55%] bg-[radial-gradient(ellipse_60%_45%_at_50%_22%,rgba(255,130,40,0.13),transparent_70%)]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[55%] bg-[linear-gradient(0deg,rgba(4,6,10,0.92)_0%,rgba(4,6,10,0.68)_40%,transparent_100%)]" />

      <div className="pointer-events-none absolute inset-0 z-20" />
      <div className="absolute z-20 w-full px-5 sm:px-6" style={{ top: '42%', bottom: '33%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-full max-w-xs pointer-events-auto">

          <form className="space-y-2" onSubmit={handleSignIn}>
            <input
              className="h-11 w-full rounded-xl border border-white/12 bg-black/40 px-4 text-center text-[14px] text-white placeholder:text-white/35 outline-none backdrop-blur-sm transition-colors focus:border-[#ff8a3d]/60 focus:bg-black/50 focus:ring-0 disabled:opacity-60"
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
              className="h-11 w-full rounded-xl border border-white/12 bg-black/40 px-4 text-center text-[14px] text-white placeholder:text-white/35 outline-none backdrop-blur-sm transition-colors focus:border-[#ff8a3d]/60 focus:bg-black/50 focus:ring-0 disabled:opacity-60"
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
              data-shell-action="login-with-email"
              className="h-11 w-full rounded-xl bg-[linear-gradient(90deg,#d45f20_0%,#ff8c3a_100%)] text-[14px] font-semibold tracking-wide text-white shadow-[0_8px_28px_rgba(220,100,30,0.35)] transition active:scale-[0.985] disabled:opacity-60"
            >
              {signInLabel}
            </button>

            <button
              type="button"
              onClick={handleSignUp}
              disabled={isBusy}
              data-ui="auth-sign-up"
              data-shell-action="signup-with-email"
              className="h-11 w-full rounded-xl border border-white/15 bg-transparent text-[14px] font-semibold tracking-wide text-white/75 transition hover:border-white/25 hover:text-white active:scale-[0.985] disabled:opacity-60"
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
