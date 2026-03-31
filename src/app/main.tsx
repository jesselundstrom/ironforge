import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import '../styles/tailwind.css';
import AppShell from './AppShell.jsx';
import { getPageFromHash } from './constants';
import { syncRoutePage } from './services/navigation-actions';
import {
  prepareLegacyShellMount,
  startLegacyRuntimeBridge,
  syncRuntimeStoreFromLegacy,
} from './services/legacy-runtime';
import { installAppRuntimeBridge } from './services/app-runtime';
import { installPlanningWindowBindings } from './services/planning-runtime';
import { installWorkoutRuntimeBridge } from './services/workout-runtime';
import { useRuntimeStore } from './store/runtime-store';
import { installLegacyI18nStoreBridge } from '../stores/i18n-store';
import { installLegacyDataStoreBridge } from '../stores/data-store';
import { installLegacyProfileStoreBridge } from '../stores/profile-store';
import { installLegacyProgramStoreBridge } from '../stores/program-store';
import { installLegacyWorkoutStoreBridge } from '../stores/workout-store';
import { installDashboardStore } from '../stores/dashboard-store';
import { installHistoryStore } from '../stores/history-store';
import { installNutritionStore } from '../stores/nutrition-store';
import { installTestStoresBridge } from './services/test-stores';
import { installAuthRuntime } from './services/auth-runtime';
import { installPwaUpdateRuntime } from './services/pwa-update-runtime';

function LegacyRuntimeBridge() {
  useEffect(() => startLegacyRuntimeBridge(), []);
  return null;
}

function RouteInitializer() {
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = useRuntimeStore((state) => state.navigation.activePage);

  useEffect(() => {
    const routePage = getPageFromHash(`#${location.pathname}`);
    if (!routePage) {
      navigate(`/${activePage}`, { replace: true });
      return;
    }
    if (routePage !== activePage) {
      syncRoutePage(routePage);
    }
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  return (
    <HashRouter>
      <LegacyRuntimeBridge />
      <RouteInitializer />
      <AppShell />
    </HashRouter>
  );
}

const mountNode = document.getElementById('app-shell-react-root');

if (mountNode) {
  // Bridge for legacy data-layer.js to drive React auth state.
  // Called by hideLoginScreen() / showLoginScreen() in data-layer.js.
  window.__IRONFORGE_SET_AUTH_LOGGED_IN__ = (isLoggedIn: boolean) => {
    useRuntimeStore.getState().setAuthLoggedIn(isLoggedIn);
  };
  window.__IRONFORGE_SET_AUTH_STATE__ = (
    partial: Partial<ReturnType<typeof useRuntimeStore.getState>['auth']>
  ) => {
    useRuntimeStore.getState().setAuthState(partial);
  };

  installLegacyI18nStoreBridge();
  installLegacyDataStoreBridge();
  installLegacyProfileStoreBridge();
  installLegacyProgramStoreBridge();
  installLegacyWorkoutStoreBridge();
  installPlanningWindowBindings();
  installWorkoutRuntimeBridge();
  installDashboardStore();
  installHistoryStore();
  installNutritionStore();
  installTestStoresBridge();
  installAppRuntimeBridge();
  installAuthRuntime();
  installPwaUpdateRuntime();
  prepareLegacyShellMount();
  syncRuntimeStoreFromLegacy();
  createRoot(mountNode).render(<App />);
}
