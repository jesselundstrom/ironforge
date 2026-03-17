import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const APP_SHELL_EVENT =
  window.__IRONFORGE_APP_SHELL_EVENT__ || 'ironforge:app-shell-updated';
const LANGUAGE_EVENT = 'ironforge:language-changed';
const PAGE_META = [
  { id: 'dashboard', labelKey: 'nav.dashboard', fallbackLabel: 'Dashboard' },
  { id: 'log', labelKey: 'nav.train', fallbackLabel: 'Train' },
  { id: 'history', labelKey: 'nav.history', fallbackLabel: 'History' },
  { id: 'settings', labelKey: 'nav.settings', fallbackLabel: 'Settings' },
  { id: 'nutrition', labelKey: 'nav.nutrition', fallbackLabel: 'Nutrition' },
];
const PAGE_NAMES = PAGE_META.map((page) => page.id);

const pageSources = collectPageSources();

function collectPageSources() {
  return PAGE_NAMES.reduce((acc, name) => {
    const node = document.getElementById(`page-${name}`);
    if (node) acc[name] = node;
    return acc;
  }, {});
}

const NAV_ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  log: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="10" width="4" height="4" rx="1" />
      <rect x="19" y="10" width="4" height="4" rx="1" />
      <rect x="7" y="8" width="3" height="8" rx="1" />
      <rect x="14" y="8" width="3" height="8" rx="1" />
      <line x1="5" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="19" y2="12" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  nutrition: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 8c.7-3.4-.8-6.2-3-7.5C12.3 3 11.5 5.4 12 8" />
      <path d="M12 8c-4 0-7 2.5-7 6 0 4.5 3 8 7 8s7-3.5 7-8c0-3.5-3-6-7-6z" />
    </svg>
  ),
};

function getSnapshot() {
  const activePage =
    typeof window.getActivePageName === 'function'
      ? window.getActivePageName()
      : 'dashboard';
  const confirm =
    typeof window.getConfirmReactSnapshot === 'function'
      ? window.getConfirmReactSnapshot()
      : {
          open: false,
          title: 'Confirm',
          message: 'Are you sure?',
          confirmLabel: 'Confirm',
          cancelLabel: 'Cancel',
        };

  return {
    activePage,
    navIndicatorIndex: Math.max(0, PAGE_NAMES.indexOf(activePage)),
    navItems: PAGE_META.map((page) => ({
      id: page.id,
      label:
        typeof window.tr === 'function'
          ? window.tr(page.labelKey, page.fallbackLabel)
          : page.fallbackLabel,
    })),
    confirm,
  };
}

function PageHost({ name, active }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const source = pageSources[name];
    if (!host || !source || host.dataset.pageMounted === 'true') return;

    while (source.firstChild) {
      host.appendChild(source.firstChild);
    }

    host.dataset.pageMounted = 'true';
    if (source.isConnected) source.remove();
  }, [name]);

  return (
    <div
      ref={hostRef}
      className={`page${active ? ' active' : ''}`}
      id={`page-${name}`}
      data-page-shell={name}
    />
  );
}

function AppShellIsland() {
  const snapshot = useIslandSnapshot([APP_SHELL_EVENT, LANGUAGE_EVENT], getSnapshot);
  const pageContainerMount = document.getElementById('page-container-react-root');
  const previousPageRef = useRef(snapshot.activePage);

  useEffect(() => {
    if (!snapshot.confirm?.open) return;
    window.requestAnimationFrame(() => document.getElementById('confirm-ok')?.focus());
  }, [snapshot.confirm?.open]);

  useEffect(() => {
    const contentScroller = document.querySelector('.content');
    if (!contentScroller) return;

    contentScroller.scrollTo({ top: 0, behavior: 'auto' });
    // Nutrition page manages its own scroll so the shell should not fight it.
    contentScroller.classList.toggle('no-scroll', snapshot.activePage === 'nutrition');
  }, [snapshot.activePage]);

  useEffect(() => {
    if (previousPageRef.current === snapshot.activePage) return;
    previousPageRef.current = snapshot.activePage;
    window.runPageActivationSideEffects?.(snapshot.activePage);
  }, [snapshot.activePage]);

  return (
    <>
      {pageContainerMount
        ? createPortal(
            <>
              {PAGE_NAMES.map((name) => (
                <PageHost
                  key={name}
                  name={name}
                  active={snapshot.activePage === name}
                />
              ))}
            </>,
            pageContainerMount,
          )
        : null}
      <div className="toast" id="toast" />
      <div className="modal-overlay" id="name-modal">
        <div className="modal-sheet catalog-sheet">
          <div className="modal-handle" />
          <div className="catalog-header">
            <div
              className="modal-title"
              id="name-modal-title"
              data-i18n="catalog.title.add"
            >
              Add Exercise
            </div>
            <div
              className="modal-sub"
              id="exercise-catalog-sub"
              data-i18n="catalog.sub"
            >
              Pick an exercise from the library or search by name.
            </div>
          </div>
          <div className="catalog-search-wrap">
            <input
              type="text"
              id="name-modal-input"
              className="exercise-catalog-search-input"
              data-i18n-placeholder="catalog.search.placeholder"
              placeholder="Search exercises"
            />
            <button
              className="btn btn-ghost btn-sm catalog-clear-btn"
              id="catalog-clear-btn"
              type="button"
              onClick={() => window.clearExerciseCatalogFilters?.()}
              data-i18n="catalog.clear_filters"
            >
              Clear
            </button>
          </div>
          <div className="catalog-filter-groups" id="exercise-catalog-filters" />
          <div className="catalog-scroll" id="exercise-catalog-scroll">
            <div id="exercise-catalog-content" />
            <div
              className="catalog-empty-state"
              id="exercise-catalog-empty"
              style={{ display: 'none' }}
              data-i18n="catalog.empty"
            >
              No exercises matched your filters.
            </div>
          </div>
          <div className="catalog-footer">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => window.closeNameModal?.()}
              data-i18n="common.cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      <div
        className={`confirm-modal${snapshot.confirm?.open ? ' active' : ''}`}
        id="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-hidden={snapshot.confirm?.open ? 'false' : 'true'}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
      >
        <div className="confirm-box">
          <h3 id="confirm-title">{snapshot.confirm?.title || 'Confirm'}</h3>
          <p id="confirm-msg">{snapshot.confirm?.message || 'Are you sure?'}</p>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => window.confirmCancel?.()}
            >
              {snapshot.confirm?.cancelLabel || 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              id="confirm-ok"
              onClick={() => window.confirmOk?.()}
            >
              {snapshot.confirm?.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-overlay" id="rpe-modal">
        <div className="modal-sheet">
          <div className="modal-handle" />
          <div className="modal-title" data-i18n="rpe.session_title">
            How hard was this session?
          </div>
          <div
            className="modal-sub"
            id="rpe-modal-sub"
            data-i18n="rpe.session_prompt"
          >
            Rate overall effort (6 = easy, 10 = max)
          </div>
          <div className="rpe-grid" id="rpe-grid" />
          <div
            className="rpe-skip"
            role="button"
            tabIndex={0}
            onClick={() => window.skipRPE?.()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.skipRPE?.();
              }
            }}
            data-i18n="common.skip"
          >
            Skip
          </div>
        </div>
      </div>
      <div className="modal-overlay" id="summary-modal">
        <div className="modal-sheet summary-sheet">
          <div className="modal-handle" />
          <div id="summary-modal-content" className="summary-modal-content" />
        </div>
      </div>
      <div className="modal-overlay" id="sport-check-modal">
        <div className="modal-sheet">
          <div className="modal-handle" />
          <div
            className="modal-title"
            id="sport-check-title"
            data-i18n="workout.sport_check.title"
          >
            Sport check-in
          </div>
          <div
            className="modal-sub"
            id="sport-check-sub"
            data-i18n="workout.sport_check.sub"
          >
            Have you had a leg-heavy sport session yesterday, or do you have one tomorrow?
          </div>
          <div className="sport-check-grid">
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => window.selectSportReadiness?.('none')}
              data-i18n="workout.sport_check.none"
            >
              No
            </button>
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => window.selectSportReadiness?.('yesterday')}
              data-i18n="workout.sport_check.yesterday"
            >
              Yes, yesterday
            </button>
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => window.selectSportReadiness?.('tomorrow')}
              data-i18n="workout.sport_check.tomorrow"
            >
              Yes, tomorrow
            </button>
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => window.selectSportReadiness?.('both')}
              data-i18n="workout.sport_check.both"
            >
              Yes, both
            </button>
          </div>
          <button
            className="btn btn-ghost session-secondary-action"
            type="button"
            onClick={() => window.cancelSportReadinessCheck?.()}
            data-i18n="common.cancel"
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="modal-overlay" id="onboarding-modal">
        <div className="modal-sheet onboarding-sheet">
          <div className="modal-handle" />
          <div id="onboarding-content" className="onboarding-scroll" />
        </div>
      </div>
      <div
        className="modal-overlay"
        id="exercise-guide-modal"
        onClick={(event) => window.closeExerciseGuide?.(event)}
      >
        <div className="modal-sheet exercise-guide-sheet">
          <div className="modal-handle" />
          <div
            className="modal-title"
            id="exercise-guide-modal-title"
            data-i18n="guidance.title"
          >
            Movement Guide
          </div>
          <div className="modal-sub" id="exercise-guide-modal-sub" />
          <div
            className="exercise-guide-sheet-body"
            id="exercise-guide-modal-body"
          />
          <button
            className="btn btn-ghost exercise-guide-sheet-close"
            type="button"
            onClick={() => window.closeExerciseGuide?.()}
            data-i18n="common.done"
          >
            Done
          </button>
        </div>
      </div>
      <div
        className="modal-overlay"
        id="program-setup-sheet"
        onClick={(event) => window.closeProgramSetupSheet?.(event)}
      >
        <div className="modal-sheet sheet-scroll-body">
          <div className="modal-handle" />
          <div className="sheet-header">
            <div
              className="modal-title"
              id="program-setup-sheet-title"
              data-i18n="settings.program_setup"
            >
              Program Setup
            </div>
            <button
              className="sheet-close-btn"
              type="button"
              onClick={() => window.closeProgramSetupSheet?.()}
              data-i18n="common.done"
            >
              Done
            </button>
          </div>
          <div id="program-settings-container" />
        </div>
      </div>
      <nav
        className="bottom-nav"
        style={{ '--nav-indicator-x': snapshot.navIndicatorIndex }}
        aria-label="Primary"
      >
        {snapshot.navItems.map((item) => {
          const isActive = snapshot.activePage === item.id;
          return (
            <button
              key={item.id}
              className={`nav-btn${isActive ? ' active' : ''}`}
              type="button"
              data-page={item.id}
              aria-current={isActive ? 'page' : undefined}
              onClick={(event) => window.showPage?.(item.id, event.currentTarget)}
            >
              {NAV_ICONS[item.id]}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

mountIsland({
  mountId: 'app-shell-react-root',
  legacyShellId: [
    'toast',
    'name-modal',
    'confirm-modal',
    'rpe-modal',
    'summary-modal',
    'sport-check-modal',
    'onboarding-modal',
    'exercise-guide-modal',
    'program-setup-sheet',
    'legacy-bottom-nav',
  ],
  mountedFlag: '__IRONFORGE_APP_SHELL_MOUNTED__',
  eventName: APP_SHELL_EVENT,
  Component: AppShellIsland,
});
