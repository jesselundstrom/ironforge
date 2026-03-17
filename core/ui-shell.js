let _toastTimeout = null;
let confirmCallback = null;
let confirmPreviousFocus = null;
let nameModalCallback = null;

function getNavButtonForPage(name) {
  return document.querySelector(`.nav-btn[onclick*="showPage('${name}'"]`);
}

function showPage(name, btn) {
  document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((navBtn) => navBtn.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  const resolvedButton = btn || getNavButtonForPage(name);
  if (resolvedButton) resolvedButton.classList.add('active');

  // Slide the nav indicator to the active button
  const nav = document.querySelector('.bottom-nav');
  if (nav && resolvedButton) {
    const navBtns = nav.querySelectorAll('.nav-btn');
    const idx = Array.from(navBtns).indexOf(resolvedButton);
    if (idx >= 0) nav.style.setProperty('--nav-indicator-x', idx);
  }

  const contentScroller = document.querySelector('.content');
  if (contentScroller) contentScroller.scrollTo({ top: 0, behavior: 'auto' });

  if (name === 'dashboard') updateDashboard();
  if (name === 'history') renderHistory();
  if (name === 'settings') initSettings();
  if (name === 'nutrition' && typeof initNutritionPage === 'function') initNutritionPage();
  if (name === 'log') {
    if (activeWorkout && typeof resumeActiveWorkoutUI === 'function') resumeActiveWorkoutUI({ toast: false });
    else resetNotStartedView();
  }
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
  const toast = document.getElementById('toast');
  if (!toast) return;

  clearTimeout(_toastTimeout);
  toast.className = 'toast';

  const variant = getToastVariant(color);
  if (variant) toast.classList.add(`toast-${variant}`);

  toast.style.removeProperty('background');

  if (undoFn) {
    toast.style.pointerEvents = 'auto';
    toast.innerHTML =
      `${msg} <span id="t-undo" style="background:rgba(255,255,255,0.2);border-radius:6px;padding:2px 10px;margin-left:6px;cursor:pointer;font-weight:700;font-size:13px">${tr('common.undo', 'Undo')}</span>`;
    document.getElementById('t-undo').onclick = () => {
      clearTimeout(_toastTimeout);
      toast.classList.remove('show');
      toast.style.pointerEvents = 'none';
      undoFn();
    };
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
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  confirmCallback = cb;
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => document.getElementById('confirm-ok')?.focus());
}

function hideConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
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
