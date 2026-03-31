// Standalone login button handler loaded before app.js so login taps still
// work even if the shell action bridge fails later in startup.
(function () {
  function trace(message, details) {
    try {
      window.__IRONFORGE_LOGIN_DEBUG__ &&
        window.__IRONFORGE_LOGIN_DEBUG__.trace &&
        window.__IRONFORGE_LOGIN_DEBUG__.trace(message, details);
    } catch (_error) {}
  }

  function getErrorElement() {
    return document.getElementById('login-error');
  }

  function showError(message) {
    var errEl = getErrorElement();
    if (!errEl) return;
    errEl.style.color = '#f87171';
    errEl.textContent = message;
  }

  function showInfo(message) {
    var errEl = getErrorElement();
    if (!errEl) return;
    errEl.style.color = 'var(--accent)';
    errEl.textContent = message;
  }

  function runAction(handler) {
    try {
      return Promise.resolve(handler());
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function fallbackSignIn(email, password) {
    var sb = window.__IRONFORGE_SUPABASE__;
    if (!sb || !sb.auth || typeof sb.auth.signInWithPassword !== 'function') {
      var keys = [];
      try {
        keys = Object.keys(window).filter(function (key) {
          return key.indexOf('IRONFORGE') !== -1;
        });
      } catch (_error) {}
      trace('supabase missing in fallback sign in', { keys: keys });
      showError('SB not ready. Keys: ' + (keys.join(',') || 'none'));
      return Promise.resolve();
    }
    trace('fallback sign in start', { hasEmail: !!email, hasPassword: !!password });
    return sb.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (result) {
        trace('fallback sign in resolved', {
          hasError: !!(result && result.error),
          error: result && result.error ? result.error.message : '',
        });
        if (result && result.error) showError(result.error.message);
      })
      .catch(function (error) {
        trace('fallback sign in threw', {
          message: error && error.message ? error.message : String(error),
        });
        showError(error && error.message ? error.message : 'Sign in failed.');
      });
  }

  function fallbackSignUp(email, password) {
    var sb = window.__IRONFORGE_SUPABASE__;
    if (!sb || !sb.auth || typeof sb.auth.signUp !== 'function') {
      trace('supabase missing in fallback sign up');
      showError('SB not ready.');
      return Promise.resolve();
    }
    trace('fallback sign up start', { hasEmail: !!email, hasPassword: !!password });
    return sb.auth
      .signUp({ email: email, password: password })
      .then(function (result) {
        trace('fallback sign up resolved', {
          hasError: !!(result && result.error),
          error: result && result.error ? result.error.message : '',
        });
        if (result && result.error) {
          showError(result.error.message);
        } else {
          showInfo('Account created! Check your email to confirm, then sign in.');
        }
      })
      .catch(function (error) {
        trace('fallback sign up threw', {
          message: error && error.message ? error.message : String(error),
        });
        showError(error && error.message ? error.message : 'Sign up failed.');
      });
  }

  function handleLoginClick(event) {
    var btn =
      event.target && event.target.closest
        ? event.target.closest('[data-shell-action]')
        : null;
    if (!btn) return;
    var action = btn.dataset && btn.dataset.shellAction;
    if (action !== 'login-with-email' && action !== 'signup-with-email') return;

    trace('capture click', { action: action });
    event.preventDefault();
    event.stopImmediatePropagation();

    var email = (document.getElementById('login-email') || {}).value || '';
    var password = (document.getElementById('login-password') || {}).value || '';
    email = String(email).trim();
    password = String(password);

    if (!email || !password) {
      trace('missing credentials', { hasEmail: !!email, hasPassword: !!password });
      showError('Enter your email and password.');
      return;
    }

    if (action === 'login-with-email') {
      showInfo('Signing in...');
      if (typeof window.loginWithEmail === 'function') {
        trace('delegating to window.loginWithEmail');
        runAction(function () {
          return window.loginWithEmail({ email: email, password: password });
        }).catch(function (error) {
          trace('window.loginWithEmail threw', {
            message: error && error.message ? error.message : String(error),
          });
          showError(
            error && error.message ? error.message : 'Unable to sign in right now.'
          );
        });
        return;
      }
      fallbackSignIn(email, password);
      return;
    }

    if (password.length < 6) {
      trace('signup password too short', { length: password.length });
      showError('Password must be at least 6 characters.');
      return;
    }

    showInfo('Creating account...');
    if (typeof window.signUpWithEmail === 'function') {
      trace('delegating to window.signUpWithEmail');
      runAction(function () {
        return window.signUpWithEmail({ email: email, password: password });
      }).catch(function (error) {
        trace('window.signUpWithEmail threw', {
          message: error && error.message ? error.message : String(error),
        });
        showError(error && error.message ? error.message : 'Sign up failed.');
      });
      return;
    }

    fallbackSignUp(email, password);
  }

  function handleLoginTouch(event) {
    handleLoginClick(event);
  }

  document.addEventListener('click', handleLoginClick, true);
  document.addEventListener('touchend', handleLoginTouch, true);
  trace('login handler loaded');
})();
