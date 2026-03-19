import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import AppShell from './AppShell.jsx';
import { getPageFromHash } from './constants';
import {
  prepareLegacyShellMount,
  startLegacyRuntimeBridge,
  syncRuntimeStoreFromLegacy,
} from './services/legacy-runtime';
import { useRuntimeStore } from './store/runtime-store';

function LegacyRuntimeBridge() {
  useEffect(() => startLegacyRuntimeBridge(), []);
  return null;
}

function RouteInitializer() {
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = useRuntimeStore((state) => state.ui.activePage);

  useEffect(() => {
    const routePage = getPageFromHash(`#${location.pathname}`);
    if (!routePage) {
      navigate(`/${activePage}`, { replace: true });
      return;
    }
    if (routePage !== activePage) {
      window.showPage?.(routePage);
    }
  }, [activePage, location.pathname, navigate]);

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
  prepareLegacyShellMount();
  syncRuntimeStoreFromLegacy();
  createRoot(mountNode).render(<App />);
}
