import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import '../styles/tailwind.css';
import AppShell from './AppShell.jsx';
import { getPageFromHash } from './constants';
import { syncRoutePage } from './services/navigation-actions';
import { useRuntimeStore } from './store/runtime-store';
import { installI18nStore } from '../stores/i18n-store';
import { installDataStore } from '../stores/data-store';
import { installProfileStore } from '../stores/profile-store';
import { installProgramStore } from '../stores/program-store';
import { installWorkoutStore } from '../stores/workout-store';
import { installDashboardStore } from '../stores/dashboard-store';
import { installHistoryStore } from '../stores/history-store';
import { installTestStoresBridge } from './services/test-stores';
import { installAuthRuntime } from './services/auth-runtime';
import { installPwaUpdateRuntime } from './services/pwa-update-runtime';
import { installAppConfigGlobals } from './services/app-config';
import { installRuntimeHelpers } from './services/runtime-helpers';
import { installLoginDebug } from './services/login-debug';
import { installWorkoutRuntimeBridge } from './services/workout-runtime';

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
      <RouteInitializer />
      <AppShell />
    </HashRouter>
  );
}

const mountNode = document.getElementById('app-shell-react-root');

if (mountNode) {
  installAppConfigGlobals();
  installLoginDebug();
  installI18nStore();
  installDataStore();
  installProfileStore();
  installProgramStore();
  installWorkoutStore();
  installRuntimeHelpers();
  installDashboardStore();
  installHistoryStore();
  installTestStoresBridge();
  installAuthRuntime();
  installPwaUpdateRuntime();
  installWorkoutRuntimeBridge();
  createRoot(mountNode).render(<App />);
}
