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

  function isAuthRuntimeReady() {
    return window.__IRONFORGE_AUTH_RUNTIME_READY__ === true;
  }

  function isStandaloneDisplayMode() {
    return (
      window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches
    ) || window.navigator.standalone === true;
  }

  function noOpSupabaseLock(_name, _acquireTimeout, handler) {
    return Promise.resolve().then(handler);
  }

  function getFallbackSupabaseClient() {
    if (window.__IRONFORGE_SUPABASE__?.auth) {
      return window.__IRONFORGE_SUPABASE__;
    }

    var createClient = window.supabase && window.supabase.createClient;
    var baseUrl = String(window.__IRONFORGE_SUPABASE_URL__ || '').trim();
    var publishableKey = String(
      window.__IRONFORGE_SUPABASE_PUBLISHABLE_KEY__ || ''
    ).trim();

    if (typeof createClient !== 'function' || !baseUrl || !publishableKey) {
      return null;
    }

    try {
      var options = isStandaloneDisplayMode()
        ? { auth: { lock: noOpSupabaseLock } }
        : undefined;
      var client = createClient(baseUrl, publishableKey, options);
      if (client && client.auth) {
        window.__IRONFORGE_SUPABASE__ = client;
        trace('created fallback supabase client', {
          standalone: isStandaloneDisplayMode(),
        });
        return client;
      }
    } catch (error) {
      trace('failed to create fallback supabase client', {
        message: error && error.message ? error.message : String(error),
      });
    }

    return null;
  }

  function finalizeFallbackSession(result) {
    var session = result && result.data ? result.data.session : null;
    if (!session) return Promise.resolve();

    if (window.__IRONFORGE_APPLY_AUTH_SESSION__) {
      trace('applying fallback auth session');
      return Promise.resolve(
        window.__IRONFORGE_APPLY_AUTH_SESSION__(session, {
          wasLoggedIn: false,
          source: 'legacy-fallback-sign-in',
        })
      );
    }

    if (window.__IRONFORGE_AUTH_RUNTIME__ && window.__IRONFORGE_AUTH_RUNTIME__.bootstrap) {
      trace('bootstrapping auth runtime after fallback sign in');
      return Promise.resolve(window.__IRONFORGE_AUTH_RUNTIME__.bootstrap());
    }

    return Promise.resolve();
  }

  function fallbackSignIn(email, password) {
    var sb = getFallbackSupabaseClient();
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
        if (result && result.error) {
          showError(result.error.message);
          return;
        }
        return finalizeFallbackSession(result);
      })
      .catch(function (error) {
        trace('fallback sign in threw', {
          message: error && error.message ? error.message : String(error),
        });
        showError(error && error.message ? error.message : 'Sign in failed.');
      });
  }

  function fallbackSignUp(email, password) {
    var sb = getFallbackSupabaseClient();
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

    if (isAuthRuntimeReady()) {
      trace('yielding to auth runtime', { action: action });
      return;
    }

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
      fallbackSignIn(email, password);
      return;
    }

    if (password.length < 6) {
      trace('signup password too short', { length: password.length });
      showError('Password must be at least 6 characters.');
      return;
    }

    showInfo('Creating account...');
    fallbackSignUp(email, password);
  }

  var lastTouchHandledAt = 0;

  function handleLoginTouch(event) {
    lastTouchHandledAt = Date.now();
    handleLoginClick(event);
  }

  function handleLoginClickGuarded(event) {
    if (
      event.type === 'click' &&
      lastTouchHandledAt &&
      Date.now() - lastTouchHandledAt < 700
    ) {
      return;
    }
    handleLoginClick(event);
  }

  document.addEventListener('click', handleLoginClickGuarded, true);
  document.addEventListener('touchend', handleLoginTouch, true);
  trace('login handler loaded');
})();
