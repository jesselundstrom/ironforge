import { useEffect, useRef } from 'react';
import { t } from './services/i18n.ts';

export default function LoginScreen() {
  const controllerRef = useRef(null);

  useEffect(() => {
    if (typeof window.createLoginSparksController !== 'function') return;
    const controller = window.createLoginSparksController();
    controller.start();
    controllerRef.current = controller;
    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, []);

  function handleSignIn(event) {
    event.preventDefault();
    if (typeof window.loginWithEmail === 'function') {
      window.loginWithEmail();
    }
  }

  function handleSignUp(event) {
    event.preventDefault();
    if (typeof window.signUpWithEmail === 'function') {
      window.signUpWithEmail();
    }
  }

  return (
    <div className="login-page" id="login-screen">
      <canvas id="sparks" aria-hidden="true" />
      <div className="login-hero" aria-hidden="true" />
      <div className="login-wrap">
        <div className="login-form">
          <input
            className="login-input"
            type="email"
            id="login-email"
            placeholder={t('login.email', 'Email')}
            autoComplete="email"
          />
          <input
            className="login-input"
            type="password"
            id="login-password"
            placeholder={t('login.password', 'Password')}
            autoComplete="current-password"
          />
          <div id="login-error" />
          <pre
            id="login-debug"
            hidden
            aria-live="polite"
            style={{
              display: 'none',
              margin: '10px 0 0',
              padding: '10px 12px',
              borderRadius: 14,
              background: 'rgba(7,10,14,0.72)',
              border: '1px solid rgba(148,163,184,0.16)',
              color: '#cbd5e1',
              font: "12px/1.45 'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
              whiteSpace: 'pre-wrap',
              textAlign: 'left',
              maxHeight: 180,
              overflow: 'auto',
            }}
          />
          <button className="btn-primary" type="button" onClick={handleSignIn}>
            {t('login.sign_in', 'Sign In')}
          </button>
          <button className="btn-secondary" type="button" onClick={handleSignUp}>
            {t('login.create_account', 'Create Account')}
          </button>
        </div>
      </div>
    </div>
  );
}
