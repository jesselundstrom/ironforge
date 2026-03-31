let _toastTimeout = null;
let confirmCallback = null;
let confirmPreviousFocus = null;
let nameModalCallback = null;
const APP_SHELL_PAGES = ['dashboard', 'log', 'history', 'settings', 'nutrition'];
let activePageName = detectInitialActivePage();
let confirmState = createDefaultConfirmState();

function getRuntimeBridge() {
  return window.__IRONFORGE_RUNTIME_BRIDGE__ || null;
}

function createDefaultConfirmState() {
  return {
    open: false,
    title: 'Confirm',
    message: 'Are you sure?',
  };
}

function detectInitialActivePage() {
  const hashPage = getPageFromHash();
  if (hashPage) return hashPage;
  const activePage = document.querySelector('.page.active[id^="page-"]');
  const pageName = activePage?.id?.replace(/^page-/, '') || 'dashboard';
  return APP_SHELL_PAGES.includes(pageName) ? pageName : 'dashboard';
}

function getPageFromHash(hash) {
  const normalized = String(hash || window.location.hash || '')
    .replace(/^#\/?/, '')
    .split(/[/?]/)[0]
    .trim();
  return APP_SHELL_PAGES.includes(normalized) ? normalized : null;
}

function syncHashToPage(name) {
  const nextHash = `#/${name}`;
  if (window.location.hash === nextHash) return;
  window.location.hash = `/${name}`;
}

function getNavButtonForPage(name) {
  return (
    document.querySelector(`.nav-btn[data-page="${name}"]`) ||
    document.querySelector(`.nav-btn[onclick*="showPage('${name}'"]`)
  );
}

function syncLegacyShellDom(name, btn) {
  document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((navBtn) => navBtn.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');
  const resolvedButton = btn || getNavButtonForPage(name);
  if (resolvedButton) resolvedButton.classList.add('active');

  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.setProperty('--nav-indicator-x', APP_SHELL_PAGES.indexOf(name));

  return resolvedButton;
}

function runPageActivationSideEffects(name) {
  if (name === 'dashboard') updateDashboard();
  if (name === 'history') window.renderHistory?.();
  if (name === 'settings') initSettings();
  if (name === 'log') {
    if (activeWorkout && typeof resumeActiveWorkoutUI === 'function') resumeActiveWorkoutUI({ toast: false });
    else resetNotStartedView();
  }
}

function isAppShellActive() {
  return window.__IRONFORGE_APP_SHELL_READY__ === true || !!getRuntimeBridge();
}

function getConfirmReactSnapshot() {
  return {
    open: confirmState.open === true,
    title: confirmState.title || tr('modal.confirm.title', 'Confirm'),
    message: confirmState.message || 'Are you sure?',
    confirmLabel: tr('modal.confirm.ok', 'Confirm'),
    cancelLabel: tr('modal.confirm.cancel', 'Cancel'),
  };
}

function showPage(name, btn) {
  const nextPage = APP_SHELL_PAGES.includes(name) ? name : 'dashboard';
  const previousPage = activePageName;
  activePageName = nextPage;
  syncHashToPage(nextPage);
  const resolvedButton = syncLegacyShellDom(nextPage, btn);
  const bridge = getRuntimeBridge();
  if (bridge && typeof bridge.navigateToPage === 'function') {
    bridge.navigateToPage(nextPage);
  }
  if (isAppShellActive()) {
    if (previousPage === nextPage) runPageActivationSideEffects(nextPage);
    return resolvedButton;
  }
  runPageActivationSideEffects(nextPage);
  return resolvedButton;
}

function goToLog() {
  showPage('log', getNavButtonForPage('log'));
}

function getToastVariant(color) {
  const raw = String(color || '').toLowerCase();
  if (!raw) return 'success';
  if (raw.includes('--green')) return 'success';
  if (raw.includes('--blue')) return 'info';
  if (raw.includes('--purple')) return 'accent';
  if (raw.includes('--muted')) return 'neutral';
  if (raw.includes('--orange') || raw.includes('--yellow') || raw.includes('--accent')) return 'warning';
  if (raw.includes('--red')) return 'danger';
  return '';
}

function showToast(msg, color, undoFn) {
  const bridge = getRuntimeBridge();
  if (bridge && typeof bridge.showToast === 'function') {
    bridge.showToast({
      message: msg || '',
      color: color || '',
      variant: getToastVariant(color),
      undoLabel: tr('common.undo', 'Undo'),
      undoAction: typeof undoFn === 'function' ? undoFn : null,
      durationMs: typeof undoFn === 'function' ? 5000 : 2800,
    });
    return;
  }

  const toast = document.getElementById('toast');
  if (!toast) return;

  clearTimeout(_toastTimeout);
  toast.className = 'toast';

  const variant = getToastVariant(color);
  if (variant) toast.classList.add(`toast-${variant}`);

  toast.style.removeProperty('background');
  toast.replaceChildren();

  if (undoFn) {
    toast.style.pointerEvents = 'auto';
    const messageNode = document.createElement('span');
    messageNode.textContent = msg || '';
    const undoButton = document.createElement('button');
    undoButton.id = 't-undo';
    undoButton.type = 'button';
    undoButton.textContent = tr('common.undo', 'Undo');
    undoButton.style.background = 'rgba(255,255,255,0.2)';
    undoButton.style.borderRadius = '6px';
    undoButton.style.padding = '2px 10px';
    undoButton.style.marginLeft = '6px';
    undoButton.style.cursor = 'pointer';
    undoButton.style.fontWeight = '700';
    undoButton.style.fontSize = '13px';
    undoButton.style.border = 'none';
    undoButton.style.color = 'inherit';
    undoButton.onclick = () => {
      clearTimeout(_toastTimeout);
      toast.classList.remove('show');
      toast.style.pointerEvents = 'none';
      undoFn();
    };
    toast.append(messageNode, undoButton);
  } else {
    toast.style.pointerEvents = 'none';
    toast.textContent = msg;
  }

  if (!variant && color) toast.style.background = color;

  toast.classList.add('show');
  _toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    toast.style.pointerEvents = 'none';
  }, undoFn ? 5000 : 2800);
}

function showConfirm(title, msg, cb) {
  confirmPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  confirmState = {
    open: true,
    title: title || tr('modal.confirm.title', 'Confirm'),
    message: msg || 'Are you sure?',
  };
  confirmCallback = cb;
  const bridge = getRuntimeBridge();
  if (bridge && typeof bridge.openConfirm === 'function') {
    bridge.openConfirm({
      ...confirmState,
      confirmLabel: tr('modal.confirm.ok', 'Confirm'),
      cancelLabel: tr('modal.confirm.cancel', 'Cancel'),
    });
    return;
  }
  document.getElementById('confirm-title').textContent = confirmState.title;
  document.getElementById('confirm-msg').textContent = confirmState.message;
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => document.getElementById('confirm-ok')?.focus());
}

function hideConfirmModal() {
  confirmState = {
    ...confirmState,
    open: false,
  };
  const bridge = getRuntimeBridge();
  if (bridge && typeof bridge.closeConfirm === 'function') {
    bridge.closeConfirm();
  }
  const modal = document.getElementById('confirm-modal');
  if (!isAppShellActive() && modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (confirmPreviousFocus?.isConnected) confirmPreviousFocus.focus();
  confirmPreviousFocus = null;
}

function confirmOk() {
  const cb = confirmCallback;
  confirmCallback = null;
  hideConfirmModal();
  if (cb) cb();
}

function confirmCancel() {
  hideConfirmModal();
  confirmCallback = null;
}

function showNameModal(title, cb) {
  nameModalCallback = cb;
  if (typeof openExerciseCatalogForAdd === 'function') {
    openExerciseCatalogForAdd(title, cb);
    return;
  }
  document.getElementById('name-modal-title').textContent = title || tr('catalog.title.add', 'Add Exercise');
  document.getElementById('name-modal-input').value = '';
  document.getElementById('name-modal').classList.add('active');
  setTimeout(() => document.getElementById('name-modal-input').focus(), 100);
}

function closeNameModal() {
  document.getElementById('name-modal').classList.remove('active');
  if (typeof resetExerciseCatalogState === 'function') resetExerciseCatalogState();
  nameModalCallback = null;
}

function submitNameModal() {
  if (typeof submitExerciseCatalogSelection === 'function') {
    submitExerciseCatalogSelection();
    return;
  }
  const value = document.getElementById('name-modal-input').value.trim();
  if (!value) return;
  document.getElementById('name-modal').classList.remove('active');
  if (nameModalCallback) nameModalCallback(value);
  nameModalCallback = null;
}

window.getActivePageName = () => activePageName;
window.getConfirmReactSnapshot = getConfirmReactSnapshot;
window.runPageActivationSideEffects = runPageActivationSideEffects;
window.showPage = showPage;
window.goToLog = goToLog;
window.showToast = showToast;
window.showConfirm = showConfirm;
window.confirmOk = confirmOk;
window.confirmCancel = confirmCancel;
window.showNameModal = showNameModal;
window.closeNameModal = closeNameModal;
window.submitNameModal = submitNameModal;

window.addEventListener('hashchange', () => {
  const pageFromHash = getPageFromHash();
  if (!pageFromHash || pageFromHash === activePageName) return;
  showPage(pageFromHash, getNavButtonForPage(pageFromHash));
});

if (!isAppShellActive()) syncLegacyShellDom(activePageName, getNavButtonForPage(activePageName));
