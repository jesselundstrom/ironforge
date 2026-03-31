import { Component, useEffect, useMemo, useRef } from 'react';
import { useRuntimeStore } from './store/runtime-store.ts';
import { t } from './services/i18n.ts';
import LoginScreen from './LoginScreen.jsx';
import { applyPendingPwaUpdate } from './services/pwa-update-runtime.ts';
import OnboardingFlow from './OnboardingFlow.jsx';
import { DashboardIsland } from '../dashboard-island/main.jsx';
import { HistoryIsland } from '../history-island/main.jsx';
import { NutritionIsland } from '../nutrition-island/main.jsx';
import { LogStartIsland } from '../log-start-island/main.jsx';
import { LogActiveIsland } from '../log-active-island/main.jsx';
import { SettingsBodyIsland } from '../settings-body-island/main.jsx';
import { SettingsAccountIsland } from '../settings-account-island/main.jsx';
import { SettingsPreferencesIsland } from '../settings-preferences-island/main.jsx';
import { SettingsProgramIsland } from '../settings-program-island/main.jsx';
import { SettingsScheduleIsland } from '../settings-schedule-island/main.jsx';
import {
  clearExerciseCatalogFilters,
  closeExerciseCatalog,
  selectExerciseCatalogExercise,
  setExerciseCatalogFilter,
  setExerciseCatalogSearch,
} from './services/exercise-catalog.ts';
import { confirmCancel, confirmOk } from './services/confirm-actions.ts';
import { navigateToPage, showSettingsTab } from './services/navigation-actions.ts';
import { closeProgramSetupSheet } from './services/settings-actions.ts';
import {
  cancelSportReadinessCheck,
  closeExerciseGuide,
  closeSummaryModal,
  prefersReducedMotionUI,
  runPageActivationSideEffects,
  selectRPE,
  selectSportReadiness,
  setSummaryFeedback,
  skipRPE,
  startSessionSummaryCelebration,
  updateSummaryNotes,
} from './services/workout-ui-actions.ts';

const PAGE_META = [
  { id: 'dashboard', labelKey: 'nav.dashboard', fallbackLabel: 'Dashboard' },
  { id: 'log', labelKey: 'nav.train', fallbackLabel: 'Train' },
  { id: 'history', labelKey: 'nav.history', fallbackLabel: 'History' },
  { id: 'settings', labelKey: 'nav.settings', fallbackLabel: 'Settings' },
  { id: 'nutrition', labelKey: 'nav.nutrition', fallbackLabel: 'Nutrition' },
];

const SETTINGS_TAB_META = [
  {
    id: 'schedule',
    labelKey: 'settings.tabs.my_sport',
    fallbackLabel: 'My Sport',
  },
  {
    id: 'preferences',
    labelKey: 'settings.tabs.training',
    fallbackLabel: 'Training',
  },
  {
    id: 'program',
    labelKey: 'settings.tabs.program',
    fallbackLabel: 'Program',
  },
  {
    id: 'account',
    labelKey: 'settings.tabs.app',
    fallbackLabel: 'App',
  },
  {
    id: 'body',
    labelKey: 'settings.tabs.body',
    fallbackLabel: 'Body',
  },
];

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

class IslandErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Ironforge] Island render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ margin: '16px 0', padding: '20px' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {t('shell.error.title', 'Something went wrong.')}
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            {t('common.reload', 'Reload')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function formatRestTimerText(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function RestTimerBar({ session }) {
  const total = Math.max(0, Number(session.restTotal || 0));
  const remaining = Math.max(0, Number(session.restSecondsLeft || 0));
  const ratio = total > 0 ? remaining / total : 0;
  const circumference = 119.4;
  const dashOffset = circumference * (1 - ratio);

  return (
    <div
      className={`rest-timer-bar${session.restBarActive ? ' active' : ''}`}
      id="rest-timer-bar"
    >
      <svg className="rest-timer-ring" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r="19"
          fill="none"
          stroke="var(--border)"
          strokeWidth="3"
        />
        <circle
          cx="22"
          cy="22"
          r="19"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          id="timer-arc"
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="rest-timer-info">
        <div className="rest-timer-label" data-i18n="workout.rest_timer">
          {t('workout.rest_timer', 'Rest timer')}
        </div>
        <div className="rest-timer-count" id="rest-timer-count">
          {formatRestTimerText(remaining || session.restDuration)}
        </div>
      </div>
      <button
        className="rest-skip-btn"
        type="button"
        onClick={() => window.skipRest?.()}
      >
        {t('common.skip', 'Skip')}
      </button>
    </div>
  );
}

function ExerciseCatalogModal({ view }) {
  const filters = view?.filters || [];
  const sections = view?.sections || [];
  const firstResult = sections.flatMap((section) => section.items)[0] || null;

  return (
    <div
      className={`modal-overlay${view?.open ? ' active' : ''}`}
      id="name-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeExerciseCatalog();
        }
      }}
    >
      <div className="modal-sheet catalog-sheet">
        <div className="modal-handle" />
        <div className="catalog-header">
          <div className="modal-title" id="name-modal-title">
            {view?.title || t('workout.add_exercise', 'Add Exercise')}
          </div>
          <div className="modal-sub" id="exercise-catalog-sub">
            {view?.subtitle ||
              t(
                'catalog.sub',
                'Pick an exercise from the library or search by name.'
              )}
          </div>
        </div>
        <div className="catalog-search-wrap">
          <input
            type="text"
            id="name-modal-input"
            className="exercise-catalog-search-input"
            placeholder={t('catalog.search.placeholder', 'Search exercises')}
            value={view?.search || ''}
            onChange={(event) => setExerciseCatalogSearch(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                closeExerciseCatalog();
                return;
              }
              if (event.key === 'Enter' && firstResult) {
                event.preventDefault();
                selectExerciseCatalogExercise(firstResult.id);
              }
            }}
          />
          <button
            className="btn btn-ghost btn-sm catalog-clear-btn"
            id="catalog-clear-btn"
            type="button"
            onClick={() => clearExerciseCatalogFilters()}
            style={{ visibility: view?.clearVisible ? 'visible' : 'hidden' }}
          >
            Clear
          </button>
        </div>
        <div className="catalog-filter-groups" id="exercise-catalog-filters">
          {filters.map((group) => (
            <div className="catalog-filter-group" key={group.id}>
              <label
                className="catalog-filter-label"
                htmlFor={`catalog-filter-${group.id}`}
              >
                {group.label}
              </label>
              <div className="catalog-filter-select-wrap">
                <select
                  id={`catalog-filter-${group.id}`}
                  className="catalog-filter-select"
                  value={group.activeValue || ''}
                  onChange={(event) =>
                    setExerciseCatalogFilter(group.id, event.currentTarget.value)
                  }
                >
                  {group.options.map((option) => (
                    <option key={option.value || '__all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <div className="catalog-scroll" id="exercise-catalog-scroll">
          <div id="exercise-catalog-content">
            {sections.map((section) => (
              <section className="catalog-section" key={section.id}>
                <div className="catalog-section-title">{section.title}</div>
                {section.items.length ? (
                  section.items.map((item) => (
                    <button
                      type="button"
                      className="catalog-item"
                      data-exercise-id={item.id}
                      key={item.id}
                      onClick={() => selectExerciseCatalogExercise(item.id)}
                    >
                      <span className="catalog-item-main">{item.name}</span>
                      <span className="catalog-item-meta">{item.meta}</span>
                    </button>
                  ))
                ) : (
                  <div className="catalog-section-empty">
                    {section.emptyCopy ||
                      view?.emptyCopy ||
                      t('catalog.section.empty', 'No exercises in this section yet.')}
                  </div>
                )}
              </section>
            ))}
          </div>
          <div
            className="catalog-empty-state"
            id="exercise-catalog-empty"
            style={{ display: view?.emptyVisible ? 'block' : 'none' }}
          >
            {view?.emptyCopy || 'No exercises matched your filters.'}
          </div>
        </div>
        <div className="catalog-footer">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => closeExerciseCatalog()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PageShell({ id, active, children }) {
  return (
    <div className={`page${active ? ' active' : ''}`} id={`page-${id}`}>
      {children}
    </div>
  );
}

function AppUpdateBanner({ updateReady, applyingUpdate }) {
  if (!updateReady && !applyingUpdate) return null;

  return (
    <div
      className="toast toast-info show"
      id="app-update-toast"
      style={{
        top: 16,
        bottom: 'auto',
        pointerEvents: 'auto',
      }}
    >
      <span>
        {applyingUpdate
          ? t('pwa.update.applying', 'Updating Ironforge...')
          : t(
              'pwa.update.available',
              'A new version of Ironforge is ready.'
            )}
      </span>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={applyingUpdate}
        onClick={() => applyPendingPwaUpdate()}
      >
        {applyingUpdate
          ? t('pwa.update.refreshing', 'Refreshing...')
          : t('pwa.update.refresh', 'Refresh')}
      </button>
    </div>
  );
}

export default function AppShell() {
  const auth = useRuntimeStore((state) => state.auth);
  const serviceWorker = useRuntimeStore((state) => state.serviceWorker);
  const activePage = useRuntimeStore((state) => state.navigation.activePage);
  const activeSettingsTab = useRuntimeStore(
    (state) => state.navigation.activeSettingsTab
  );
  const confirm = useRuntimeStore((state) => state.ui.confirm);
  const toast = useRuntimeStore((state) => state.ui.toast);
  const hideToast = useRuntimeStore((state) => state.hideToast);
  const languageVersion = useRuntimeStore((state) => state.ui.languageVersion);
  const session = useRuntimeStore((state) => state.workoutSession.session);
  const exerciseCatalog = useRuntimeStore((state) => state.exerciseCatalog.view);
  const previousPageRef = useRef(activePage);

  const navItems = useMemo(
    () =>
      PAGE_META.map((page) => ({
        id: page.id,
        label: t(page.labelKey, page.fallbackLabel),
      })),
    [languageVersion]
  );

  const settingsTabs = useMemo(
    () =>
      SETTINGS_TAB_META.map((tab) => ({
        ...tab,
        label: t(tab.labelKey, tab.fallbackLabel),
      })),
    [languageVersion]
  );

  useEffect(() => {
    if (!confirm?.open) return;
    window.requestAnimationFrame(() =>
      document.getElementById('confirm-ok')?.focus()
    );
  }, [confirm?.open]);

  useEffect(() => {
    if (!toast?.visible || !toast?.message) return undefined;
    const timeoutId = window.setTimeout(() => {
      hideToast();
    }, toast.durationMs || 2800);
    return () => window.clearTimeout(timeoutId);
  }, [toast?.visible, toast?.token, toast?.durationMs, hideToast]);

  useEffect(() => {
    if (!session.summaryOpen || !session.summaryPrompt?.seed) return;
    window.requestAnimationFrame(() => {
      const modal = document.getElementById('summary-modal');
      if (modal) {
        modal.classList.toggle(
          'reduced-motion',
          prefersReducedMotionUI()
        );
      }
      startSessionSummaryCelebration(modal, session.summaryPrompt?.summaryData || null);
      const notesField = document.getElementById('summary-notes-textarea');
      if (notesField instanceof HTMLTextAreaElement) {
        notesField.style.height = 'auto';
        notesField.style.height = `${Math.min(notesField.scrollHeight, 168)}px`;
      }
    });
  }, [session.summaryOpen, session.summaryPrompt?.seed]);

  useEffect(() => {
    const contentScroller = document.querySelector('.content');
    const appRoot = document.getElementById('app-root');
    if (!contentScroller) return;

    const isNutritionActive = activePage === 'nutrition';
    contentScroller.scrollTo({ top: 0, behavior: 'auto' });
    contentScroller.classList.toggle('no-scroll', isNutritionActive);
    contentScroller.classList.toggle('nutrition-active', isNutritionActive);
    if (appRoot) {
      appRoot.classList.toggle('nutrition-active', isNutritionActive);
    }
  }, [activePage]);

  useEffect(() => {
    if (previousPageRef.current === activePage) return;
    previousPageRef.current = activePage;
    runPageActivationSideEffects(activePage);
  }, [activePage]);

  if (auth.phase !== 'signed_in') {
    return (
      <>
        <AppUpdateBanner
          updateReady={serviceWorker.updateReady}
          applyingUpdate={serviceWorker.applyingUpdate}
        />
        <LoginScreen />
      </>
    );
  }

  return (
    <div className="app" id="app-root">
      <AppUpdateBanner
        updateReady={serviceWorker.updateReady}
        applyingUpdate={serviceWorker.applyingUpdate}
      />
      <div
        className={`toast${toast?.variant ? ` toast-${toast.variant}` : ''}${
          toast?.visible ? ' show' : ''
        }`}
        id="toast"
        style={{
          ...(toast?.background ? { background: toast.background } : {}),
          pointerEvents: toast?.undoAction ? 'auto' : 'none',
        }}
      >
        <span>{toast?.message || ''}</span>
        {toast?.undoAction ? (
          <button
            id="t-undo"
            type="button"
            style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 6,
              padding: '2px 10px',
              marginLeft: 6,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              border: 'none',
              color: 'inherit',
            }}
            onClick={() => {
              const undoAction = toast.undoAction;
              hideToast();
              undoAction?.();
            }}
          >
            {toast?.undoLabel || 'Undo'}
          </button>
        ) : null}
      </div>

      <RestTimerBar session={session} />
      <ExerciseCatalogModal view={exerciseCatalog} />

      <div
        className={`confirm-modal${confirm?.open ? ' active' : ''}`}
        id="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-hidden={confirm?.open ? 'false' : 'true'}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
      >
        <div className="confirm-box">
          <h3 id="confirm-title">
            {confirm?.title || t('modal.confirm.title', 'Confirm')}
          </h3>
          <p id="confirm-msg">
            {confirm?.message || t('modal.confirm.message', 'Are you sure?')}
          </p>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => confirmCancel()}
            >
              {confirm?.cancelLabel || t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              id="confirm-ok"
              onClick={() => confirmOk()}
            >
              {confirm?.confirmLabel || t('modal.confirm.ok', 'Confirm')}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`modal-overlay${session.rpeOpen ? ' active' : ''}`}
        id="rpe-modal"
      >
        <div className="modal-sheet">
          <div className="modal-handle" />
          <div className="modal-title" id="rpe-modal-title">
            {session.rpePrompt?.title ||
              t('rpe.session_title', 'How hard was this session?')}
          </div>
          <div className="modal-sub" id="rpe-modal-sub">
            {session.rpePrompt?.subtitle ||
              t(
                'rpe.session_subtitle',
                'Rate overall effort (6 = easy, 10 = max)'
              )}
          </div>
          <div className="rpe-grid" id="rpe-grid">
            {(session.rpePrompt?.options || []).map((option) => (
              <button
                key={option.value}
                className="rpe-btn"
                type="button"
                onClick={() => {
                  window.setTimeout(() => selectRPE(option.value), 200);
                }}
              >
                <div className="rpe-num">{option.value}</div>
                <div className="rpe-feel">{option.feel}</div>
                <div className="rpe-desc">{option.description}</div>
              </button>
            ))}
          </div>
          <div
            className="rpe-skip"
            role="button"
            tabIndex={0}
            onClick={() => skipRPE()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                skipRPE();
              }
            }}
          >
            {t('common.skip', 'Skip')}
          </div>
        </div>
      </div>

      <div
        className={`modal-overlay${session.summaryOpen ? ' active' : ''}`}
        id="summary-modal"
      >
        <div className="modal-sheet summary-sheet">
          <div className="modal-handle" />
          <div id="summary-modal-content" className="summary-modal-content">
            {session.summaryPrompt ? (
              <div className="summary-celebration">
                <canvas className="summary-burst-canvas" aria-hidden="true" />
                <div className="summary-forge-glow" aria-hidden="true" />
                <div className="summary-shell">
                  <div className="summary-kicker">
                    {session.summaryPrompt.kicker}
                  </div>
                  <div className="summary-title">
                    {session.summaryPrompt.title}
                  </div>
                  <div className="summary-program">
                    {session.summaryPrompt.programLabel}
                  </div>
                  <div className="summary-stats">
                    {session.summaryPrompt.stats.map((stat, index) => (
                      <div
                        key={stat.key}
                        className={`summary-stat summary-stat-${stat.key}`}
                        style={{ '--summary-stat-delay': `${index * 100}ms` }}
                      >
                        <div
                          className={`summary-stat-value ${stat.accent}`.trim()}
                          data-stat-key={stat.key}
                          data-stat-value="0"
                        >
                          {stat.initialText}
                        </div>
                        <div className="summary-stat-label">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  {session.summaryPrompt.coachNote ? (
                    <div className="summary-coach-note">
                      {session.summaryPrompt.coachNote}
                    </div>
                  ) : null}
                  <div className="summary-notes-shell">
                    <label
                      className="summary-notes-label"
                      htmlFor="summary-notes-textarea"
                    >
                      {session.summaryPrompt.notesLabel}
                    </label>
                    <textarea
                      id="summary-notes-textarea"
                      className="summary-notes-textarea"
                      placeholder={session.summaryPrompt.notesPlaceholder}
                      maxLength={500}
                      rows={3}
                      value={session.summaryPrompt.notes || ''}
                      onInput={(event) => {
                        const nextValue = event.currentTarget.value;
                        event.currentTarget.style.height = 'auto';
                        event.currentTarget.style.height = `${Math.min(
                          event.currentTarget.scrollHeight,
                          168
                        )}px`;
                        updateSummaryNotes(nextValue);
                      }}
                    />
                  </div>
                  <div className="summary-feedback">
                    <div className="summary-feedback-label">
                      {session.summaryPrompt.feedbackLabel}
                    </div>
                    <div className="summary-feedback-options">
                      {session.summaryPrompt.feedbackOptions.map((option) => (
                        <button
                          key={option.value}
                          className={`summary-feedback-btn${
                            session.summaryPrompt.feedback === option.value
                              ? ' is-active'
                              : ''
                          }`}
                          type="button"
                          data-feedback={option.value}
                          onClick={() => setSummaryFeedback(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {session.summaryPrompt.canLogNutrition ? (
                    <button
                      className="btn btn-ghost summary-nutrition-action"
                      type="button"
                      onClick={() => closeSummaryModal(true)}
                    >
                      {session.summaryPrompt.nutritionLabel}
                    </button>
                  ) : null}
                  <button
                    className="btn btn-primary summary-action"
                    type="button"
                    onClick={() => closeSummaryModal()}
                  >
                    {session.summaryPrompt.doneLabel}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={`modal-overlay${session.sportCheckOpen ? ' active' : ''}`}
        id="sport-check-modal"
      >
        <div className="modal-sheet">
          <div className="modal-handle" />
          <div className="modal-title" id="sport-check-title">
            {session.sportCheckPrompt?.title || 'Sport check-in'}
          </div>
          <div className="modal-sub" id="sport-check-sub">
            {session.sportCheckPrompt?.subtitle ||
              'Have you had a leg-heavy sport session yesterday, or do you have one tomorrow?'}
          </div>
          <div className="sport-check-grid">
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => selectSportReadiness('none')}
            >
              No
            </button>
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => selectSportReadiness('yesterday')}
            >
              Yes, yesterday
            </button>
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => selectSportReadiness('tomorrow')}
            >
              Yes, tomorrow
            </button>
            <button
              className="btn btn-secondary sport-check-btn"
              type="button"
              onClick={() => selectSportReadiness('both')}
            >
              Yes, both
            </button>
          </div>
          <button
            className="btn btn-ghost session-secondary-action"
            type="button"
            onClick={() => cancelSportReadinessCheck()}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="modal-overlay" id="onboarding-modal">
        <div className="modal-sheet onboarding-sheet">
          <div className="modal-handle" />
          <div id="onboarding-content" className="onboarding-scroll">
            <OnboardingFlow />
          </div>
        </div>
      </div>

      <div
        className={`modal-overlay${
          session.exerciseGuideOpen ? ' active' : ''
        }`}
        id="exercise-guide-modal"
        onClick={(event) => closeExerciseGuide(event)}
      >
        <div className="modal-sheet exercise-guide-sheet">
          <div className="modal-handle" />
          <div className="modal-title" id="exercise-guide-modal-title">
            {session.exerciseGuidePrompt?.title ||
              t('guidance.title', 'Movement Guide')}
          </div>
          <div className="modal-sub" id="exercise-guide-modal-sub">
            {session.exerciseGuidePrompt?.subtitle || ''}
          </div>
          <div className="exercise-guide-sheet-body" id="exercise-guide-modal-body">
            {session.exerciseGuidePrompt ? (
              <div className="exercise-guide-grid">
                <div>
                  <div className="exercise-guide-title">{t('guidance.setup', 'Setup')}</div>
                  <div className="exercise-guide-text">
                    {session.exerciseGuidePrompt.setup || ''}
                  </div>
                </div>
                <div>
                  <div className="exercise-guide-title">
                    {t('guidance.execution', 'Execution')}
                  </div>
                  <ol className="exercise-guide-list">
                    {session.exerciseGuidePrompt.execution.map((step, index) => (
                      <li key={`${step}-${index}`}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div className="exercise-guide-title">
                    {t('guidance.cues', 'Key cues')}
                  </div>
                  <ul className="exercise-guide-list">
                    {session.exerciseGuidePrompt.cues.map((cue, index) => (
                      <li key={`${cue}-${index}`}>{cue}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="exercise-guide-title">
                    {t('guidance.safety', 'Safety')}
                  </div>
                  <div className="exercise-guide-text">
                    {session.exerciseGuidePrompt.safety || ''}
                  </div>
                </div>
                {session.exerciseGuidePrompt.mediaLinks.length ? (
                  <div className="exercise-guide-links">
                    {session.exerciseGuidePrompt.mediaLinks.map((link) => (
                      <a
                        key={link.href}
                        className="exercise-guide-link"
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            className="btn btn-ghost exercise-guide-sheet-close"
            type="button"
            onClick={() => closeExerciseGuide()}
          >
            {t('common.done', 'Done')}
          </button>
        </div>
      </div>

      <div
        className="modal-overlay"
        id="program-setup-sheet"
        onClick={(event) => closeProgramSetupSheet(event)}
      >
        <div className="modal-sheet sheet-scroll-body">
          <div className="modal-handle" />
          <div className="sheet-header">
            <div className="modal-title" id="program-setup-sheet-title">
              {t('settings.program_setup', 'Program Setup')}
            </div>
            <button
              className="sheet-close-btn"
              type="button"
              onClick={() => closeProgramSetupSheet()}
            >
              {t('common.done', 'Done')}
            </button>
          </div>
          <div id="program-settings-container" />
        </div>
      </div>

      <main className="content">
        <div className="header">
          <div className="header-brand">
            <svg className="header-logo" viewBox="0 0 44 36" aria-hidden="true">
              <defs>
                <linearGradient id="hdr-m" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fffdf5" />
                  <stop offset="25%" stopColor="#f5d9a0" />
                  <stop offset="55%" stopColor="#dba85e" />
                  <stop offset="100%" stopColor="#a06830" />
                </linearGradient>
                <linearGradient id="hdr-hi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
              </defs>
              <path
                d="M4,8 L22,8 Q28,8 34,10 Q40,12 40,13 Q40,14 34,13 L22,12 L4,12 Z"
                fill="url(#hdr-m)"
              />
              <path
                d="M4,8 L22,8 Q28,8 34,10 L22,9.5 L4,9.5 Z"
                fill="url(#hdr-hi)"
              />
              <path
                d="M6,12 L20,12 Q21,12 21,13 L21,20 Q21,21 20,21 L6,21 Q5,21 5,20 L5,13 Q5,12 6,12 Z"
                fill="url(#hdr-m)"
              />
              <path
                d="M8,21 L18,21 Q19,21 19,22 L19,25 Q19,26 18,26 L8,26 Q7,26 7,25 L7,22 Q7,21 8,21 Z"
                fill="url(#hdr-m)"
              />
              <path
                d="M1,26 L25,26 Q27,26 27,28 L27,31 Q27,33 25,33 L1,33 Q-1,33 -0.5,31 L-0.5,28 Q-1,26 1,26 Z"
                fill="url(#hdr-m)"
              />
              <path
                d="M1,26 L25,26 Q27,26 27,28 L-0.5,28 Q-1,26 1,26 Z"
                fill="url(#hdr-hi)"
              />
            </svg>
            <div className="header-text">
              <h1 className="page-title page-title-wordmark" aria-label="Ironforge">
                <span>Ironforge</span>
              </h1>
              <p id="header-sub">
                {t('shell.header.loading', 'Forge Protocol · Loading...')}
              </p>
            </div>
          </div>
        </div>

        <PageShell id="dashboard" active={activePage === 'dashboard'}>
          <div id="dashboard-react-root">
            <IslandErrorBoundary>
              <DashboardIsland />
            </IslandErrorBoundary>
          </div>
        </PageShell>

        <PageShell id="log" active={activePage === 'log'}>
          <div id="log-start-react-root">
            <IslandErrorBoundary>
              <LogStartIsland />
            </IslandErrorBoundary>
          </div>
          <div id="log-active-react-root">
            <IslandErrorBoundary>
              <LogActiveIsland />
            </IslandErrorBoundary>
          </div>
        </PageShell>

        <PageShell id="history" active={activePage === 'history'}>
          <div id="history-react-root">
            <IslandErrorBoundary>
              <HistoryIsland />
            </IslandErrorBoundary>
          </div>
        </PageShell>

        <PageShell id="settings" active={activePage === 'settings'}>
          <div className="tabs" id="settings-tabs" role="tablist" aria-label="Settings sections">
            {settingsTabs.map((tab) => {
              const isActive = activeSettingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`tab${isActive ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive ? 'true' : 'false'}
                  data-settings-tab={tab.id}
                  onClick={(event) => showSettingsTab(tab.id, event.currentTarget)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div id="settings-tab-schedule" style={{ display: activeSettingsTab === 'schedule' ? '' : 'none' }}>
            <div id="settings-schedule-react-root">
              <IslandErrorBoundary>
                <SettingsScheduleIsland />
              </IslandErrorBoundary>
            </div>
          </div>

          <div id="settings-tab-preferences" style={{ display: activeSettingsTab === 'preferences' ? '' : 'none' }}>
            <div id="settings-preferences-react-root">
              <IslandErrorBoundary>
                <SettingsPreferencesIsland />
              </IslandErrorBoundary>
            </div>
          </div>

          <div id="settings-tab-program" style={{ display: activeSettingsTab === 'program' ? '' : 'none' }}>
            <div id="settings-program-react-root">
              <IslandErrorBoundary>
                <SettingsProgramIsland />
              </IslandErrorBoundary>
            </div>
          </div>

          <div id="settings-tab-account" style={{ display: activeSettingsTab === 'account' ? '' : 'none' }}>
            <div id="settings-account-react-root">
              <IslandErrorBoundary>
                <SettingsAccountIsland />
              </IslandErrorBoundary>
            </div>
          </div>

          <div id="settings-tab-body" style={{ display: activeSettingsTab === 'body' ? '' : 'none' }}>
            <div id="settings-body-react-root">
              <IslandErrorBoundary>
                <SettingsBodyIsland />
              </IslandErrorBoundary>
            </div>
          </div>
        </PageShell>

        <PageShell id="nutrition" active={activePage === 'nutrition'}>
          <div id="nutrition-react-root">
            <IslandErrorBoundary>
              <NutritionIsland />
            </IslandErrorBoundary>
          </div>
        </PageShell>
      </main>

      <nav
        className="bottom-nav"
        style={{
          '--nav-indicator-x': PAGE_META.findIndex((item) => item.id === activePage),
        }}
        aria-label="Primary"
      >
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              className={`nav-btn${isActive ? ' active' : ''}`}
              type="button"
              data-page={item.id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => navigateToPage(item.id)}
            >
              {NAV_ICONS[item.id]}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
