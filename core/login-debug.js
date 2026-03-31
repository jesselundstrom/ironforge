(function () {
  var TRACE_STORAGE_KEY = 'ironforge:login-debug-trace';
  var DEBUG_FLAG_KEY = 'ironforge:login-debug';
  var MAX_LINES = 40;
  var traceLines = [];

  function isStandaloneDisplayMode() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isEnabled() {
    if (window.navigator.webdriver === true) return true;
    if (window.__IRONFORGE_TEST_USER_ID__ === 'e2e-user') return true;
    try {
      if (window.localStorage.getItem(DEBUG_FLAG_KEY) === '1') return true;
    } catch (_error) {}
    return isStandaloneDisplayMode();
  }

  function ensurePanel() {
    var panel = document.getElementById('login-debug');
    if (panel) return panel;
    var errEl = document.getElementById('login-error');
    var loginForm = errEl && errEl.parentElement ? errEl.parentElement : null;
    if (!loginForm) return null;
    panel = document.createElement('pre');
    panel.id = 'login-debug';
    panel.hidden = true;
    panel.setAttribute('aria-live', 'polite');
    panel.style.display = 'none';
    panel.style.margin = '10px 0 0';
    panel.style.padding = '10px 12px';
    panel.style.borderRadius = '14px';
    panel.style.background = 'rgba(7, 10, 14, 0.72)';
    panel.style.border = '1px solid rgba(148, 163, 184, 0.16)';
    panel.style.color = '#cbd5e1';
    panel.style.font =
      "12px/1.45 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
    panel.style.whiteSpace = 'pre-wrap';
    panel.style.textAlign = 'left';
    panel.style.maxHeight = '180px';
    panel.style.overflow = 'auto';
    loginForm.insertBefore(panel, errEl.nextSibling);
    return panel;
  }

  function render() {
    var panel = ensurePanel();
    if (!panel) return;
    if (!isEnabled() || !traceLines.length) {
      panel.hidden = true;
      panel.style.display = 'none';
      panel.textContent = '';
      return;
    }
    panel.hidden = false;
    panel.style.display = 'block';
    panel.textContent = traceLines.join('\n');
  }

  function persist() {
    try {
      window.localStorage.setItem(
        TRACE_STORAGE_KEY,
        JSON.stringify(traceLines.slice(-MAX_LINES))
      );
    } catch (_error) {}
  }

  function hydrate() {
    try {
      var stored = window.localStorage.getItem(TRACE_STORAGE_KEY);
      if (!stored) return;
      var parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      traceLines = parsed
        .filter(function (line) {
          return typeof line === 'string' && line;
        })
        .slice(-MAX_LINES);
    } catch (_error) {}
  }

  function formatDetails(details) {
    if (!details || typeof details !== 'object') return '';
    try {
      return JSON.stringify(details);
    } catch (_error) {
      return String(details);
    }
  }

  function trace(message, details) {
    var timestamp = new Date().toISOString().slice(11, 19);
    var suffix = formatDetails(details);
    var line = '[' + timestamp + '] ' + message;
    if (suffix) line += ' ' + suffix;
    traceLines.push(line);
    if (traceLines.length > MAX_LINES) {
      traceLines = traceLines.slice(-MAX_LINES);
    }
    persist();
    render();
  }

  function clear() {
    traceLines = [];
    persist();
    render();
  }

  hydrate();

  window.__IRONFORGE_LOGIN_DEBUG__ = {
    trace: trace,
    clear: clear,
    render: render,
    isEnabled: isEnabled,
    getSnapshot: function () {
      return {
        enabled: isEnabled(),
        standalone: isStandaloneDisplayMode(),
        path: window.location.pathname,
        lines: traceLines.slice(),
      };
    },
    getLines: function () {
      return traceLines.slice();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }

  trace('login debug ready', {
    standalone: isStandaloneDisplayMode(),
    path: window.location.pathname,
  });
})();
