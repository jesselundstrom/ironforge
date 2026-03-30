// Standalone login button handler — loaded before app.js so it does not
// depend on the shell action bridge or any other runtime being ready.
(function () {
  function handleLoginClick(event) {
    var btn = event.target && event.target.closest
      ? event.target.closest('[data-shell-action]')
      : null;
    if (!btn) return;
    var action = btn.dataset && btn.dataset.shellAction;
    if (action !== 'login-with-email' && action !== 'signup-with-email') return;

    event.preventDefault();
    event.stopImmediatePropagation();

    var errEl = document.getElementById('login-error');
    function showErr(msg) {
      if (!errEl) return;
      errEl.style.color = '#f87171';
      errEl.textContent = msg;
    }
    function showInfo(msg) {
      if (!errEl) return;
      errEl.style.color = 'var(--accent)';
      errEl.textContent = msg;
    }

    var sb = window.__IRONFORGE_SUPABASE__;
    if (!sb) {
      var keys = [];
      try { keys = Object.keys(window).filter(function(k){ return k.indexOf('IRONFORGE') !== -1; }); } catch(e){}
      showErr('SB not ready. Keys: ' + (keys.join(',') || 'none'));
      return;
    }

    var email = (document.getElementById('login-email') || {}).value;
    var password = (document.getElementById('login-password') || {}).value;
    if (!email || !password) {
      showErr('Enter your email and password.');
      return;
    }

    if (action === 'login-with-email') {
      showInfo('Signing in\u2026');
      sb.auth.signInWithPassword({ email: email, password: password })
        .then(function (result) {
          if (result.error) showErr(result.error.message);
        })
        .catch(function (err) {
          showErr(err && err.message ? err.message : 'Sign in failed.');
        });
    } else {
      if (!password || password.length < 6) {
        showErr('Password must be at least 6 characters.');
        return;
      }
      showInfo('Creating account\u2026');
      sb.auth.signUp({ email: email, password: password })
        .then(function (result) {
          if (result.error) {
            showErr(result.error.message);
          } else {
            showInfo('Account created! Check your email to confirm, then sign in.');
          }
        })
        .catch(function (err) {
          showErr(err && err.message ? err.message : 'Sign up failed.');
        });
    }
  }

  document.addEventListener('click', handleLoginClick, true);

  // DEBUG: confirm this script loaded and listeners are active
  var errEl = document.getElementById('login-error');
  if (errEl) errEl.textContent = 'handler ready';
})();
