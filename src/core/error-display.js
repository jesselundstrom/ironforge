// Shows JS errors in the login screen so we can debug on mobile without devtools.
window.addEventListener('error', function (e) {
  var el = document.getElementById('login-error');
  if (!el) return;
  var file = (e.filename || '').split('/').pop();
  el.style.color = '#f87171';
  el.textContent = 'Error: ' + (e.message || String(e)) + ' (' + file + ':' + e.lineno + ')';
});
