(function () {
  function showError(message) {
    var el = document.getElementById('login-error');
    if (!el) return;
    el.style.color = '#f87171';
    el.textContent = message;
  }

  function trace(type, details) {
    try {
      window.__IRONFORGE_LOGIN_DEBUG__ &&
        window.__IRONFORGE_LOGIN_DEBUG__.trace &&
        window.__IRONFORGE_LOGIN_DEBUG__.trace(type, details);
    } catch (_error) {}
  }

  window.addEventListener('error', function (event) {
    var file = (event.filename || '').split('/').pop();
    var message =
      'Error: ' +
      (event.message || String(event.error || event)) +
      (file ? ' (' + file + ':' + event.lineno + ')' : '');
    trace('window error', {
      message: event.message || String(event.error || event),
      file: file || '',
      line: event.lineno || 0,
    });
    showError(message);
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var message =
      reason && reason.message ? reason.message : String(reason || 'Promise rejected');
    trace('unhandled rejection', { message: message });
    showError('Promise error: ' + message);
  });

  trace('error display ready');
})();
