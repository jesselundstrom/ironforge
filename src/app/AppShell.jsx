import { Suspense, lazy, useEffect } from 'react';
import { useStore } from 'zustand';
import { useRuntimeStore } from './store/runtime-store.ts';
import { t } from './services/i18n.ts';
import LoginScreen from './LoginScreen.jsx';
import { applyPendingPwaUpdate } from './services/pwa-update-runtime.ts';
import { confirmCancel, confirmOk } from './services/confirm-actions.ts';
import { navigateToPage } from './services/navigation-actions.ts';
import { profileStore } from '../stores/profile-store.ts';

const DashboardPage = lazy(async () => {
  const module = await import('../dashboard-island/main.jsx');
  return { default: module.DashboardIsland };
});
const HistoryPage = lazy(async () => {
  const module = await import('../history-island/main.jsx');
  return { default: module.HistoryIsland };
});
const TrainingPage = lazy(() => import('./TrainingPage.jsx'));
const SettingsPage = lazy(() => import('./SettingsPage.jsx'));
const OnboardingFlow = lazy(() => import('./OnboardingFlow.jsx'));

const PAGE_META = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'log', label: 'Train' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

const NAV_ICONS = {
  dashboard: 'GRID',
  log: 'LOG',
  history: 'HIST',
  settings: 'SET',
};

function AppUpdateBanner({ updateReady, applyingUpdate }) {
  if (!updateReady && !applyingUpdate) return null;
  return (
    <div className="fixed inset-x-4 top-4 z-50 rounded-2xl border border-accent/30 bg-[#16110b]/95 px-4 py-3 shadow-card backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text">
          {applyingUpdate
            ? t('pwa.update.applying', 'Updating Ironforge...')
            : t('pwa.update.available', 'A new version of Ironforge is ready.')}
        </span>
        <button
          type="button"
          className="rounded-full bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white"
          disabled={applyingUpdate}
          onClick={() => applyPendingPwaUpdate()}
        >
          {applyingUpdate
            ? t('pwa.update.refreshing', 'Refreshing...')
            : t('pwa.update.refresh', 'Refresh')}
        </button>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="text-sm text-muted">
        {t('common.loading', 'Loading...')}
      </div>
    </div>
  );
}

function PageBody({ activePage }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <div
        id={`page-${activePage}`}
        className="page active"
        data-page={activePage}
      >
        {activePage === 'dashboard' ? <DashboardPage /> : null}
        {activePage === 'log' ? <TrainingPage /> : null}
        {activePage === 'history' ? <HistoryPage /> : null}
        {activePage === 'settings' ? <SettingsPage /> : null}
      </div>
    </Suspense>
  );
}

export default function AppShell() {
  const auth = useRuntimeStore((state) => state.auth);
  const serviceWorker = useRuntimeStore((state) => state.serviceWorker);
  const activePage = useRuntimeStore((state) => state.navigation.activePage);
  const confirm = useRuntimeStore((state) => state.ui.confirm);
  const toast = useRuntimeStore((state) => state.ui.toast);
  const hideToast = useRuntimeStore((state) => state.hideToast);
  const profile = useStore(profileStore, (state) => state.profile);
  const onboardingOpen =
    auth.phase === 'signed_in' &&
    profile?.coaching?.onboardingCompleted !== true;

  useEffect(() => {
    if (!toast?.visible || !toast?.message) return undefined;
    const timeoutId = window.setTimeout(() => {
      hideToast();
    }, toast.durationMs || 2800);
    return () => window.clearTimeout(timeoutId);
  }, [toast?.visible, toast?.message, toast?.durationMs, hideToast]);

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
        id="toast"
        className={`fixed inset-x-4 bottom-24 z-40 rounded-2xl px-4 py-3 text-sm text-white shadow-card transition ${
          toast?.visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          background: toast?.background || '#1f2430',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span>{toast?.message || ''}</span>
          {toast?.undoAction ? (
            <button
              type="button"
              id="t-undo"
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]"
              onClick={() => {
                const undoAction = toast.undoAction;
                hideToast();
                undoAction?.();
              }}
            >
              {toast.undoLabel || 'Undo'}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-black/55 px-4 py-8 backdrop-blur-sm transition ${
          confirm?.open
            ? 'active opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
        id="confirm-modal"
      >
        <div className="mx-auto mt-24 max-w-sm rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="text-lg font-bold text-text" id="confirm-title">
            {confirm?.title || t('modal.confirm.title', 'Confirm')}
          </div>
          <div className="mt-2 text-sm leading-6 text-muted" id="confirm-msg">
            {confirm?.message || t('modal.confirm.message', 'Are you sure?')}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 font-bold text-text"
              onClick={() => confirmCancel()}
            >
              {confirm?.cancelLabel || t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              id="confirm-ok"
              className="rounded-2xl bg-accent px-4 py-3 font-bold text-white"
              onClick={() => confirmOk()}
            >
              {confirm?.confirmLabel || t('modal.confirm.ok', 'Confirm')}
            </button>
          </div>
        </div>
      </div>

      {onboardingOpen ? (
        <div className="fixed inset-0 z-30 overflow-auto bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto max-w-xl rounded-card border border-border bg-surface p-5 shadow-card">
            <Suspense fallback={<PageFallback />}>
              <OnboardingFlow
                onDone={() => {}}
                onSkip={async () => {
                  await profileStore.getState().updateProfile({
                    coaching: {
                      ...(profile?.coaching || {}),
                      onboardingSeen: true,
                      onboardingCompleted: true,
                    },
                  });
                }}
              />
            </Suspense>
          </div>
        </div>
      ) : null}

      <main className="content mx-auto min-h-[100dvh] max-w-5xl px-4 pb-32 pt-[max(24px,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              {t('shell.kicker', 'Ironforge Training Core')}
            </div>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-text">
              Ironforge
            </h1>
            <div
              className="mt-2 text-sm leading-6 text-muted"
              id="header-sub"
            />
          </div>
        </header>

        <PageBody activePage={activePage} />
      </main>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-20 border-t border-white/8 bg-[#0b0e16]/96 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
          {PAGE_META.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-page={item.id}
                className={`rounded-2xl px-3 py-3 text-center transition ${
                  active
                    ? 'active bg-accent/12 text-accent'
                    : 'bg-white/[0.02] text-text'
                }`}
                onClick={() => navigateToPage(item.id)}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em]">
                  {NAV_ICONS[item.id]}
                </div>
                <div className="mt-1 text-xs font-semibold">{item.label}</div>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
