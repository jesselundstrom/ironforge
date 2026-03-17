import { useEffect, useRef } from 'react';
import { mountIsland, useIslandSnapshot } from '../island-runtime/index.jsx';

const APP_SHELL_EVENT =
  window.__IRONFORGE_APP_SHELL_EVENT__ || 'ironforge:app-shell-updated';
const PAGE_NAMES = ['dashboard', 'log', 'history', 'settings', 'nutrition'];

const pageSources = collectPageSources();

function collectPageSources() {
  return PAGE_NAMES.reduce((acc, name) => {
    const node = document.getElementById(`page-${name}`);
    if (node) acc[name] = node;
    return acc;
  }, {});
}

function getSnapshot() {
  return {
    activePage:
      typeof window.getActivePageName === 'function'
        ? window.getActivePageName()
        : 'dashboard',
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

function PageContainerShell() {
  const snapshot = useIslandSnapshot(APP_SHELL_EVENT, getSnapshot);

  return (
    <>
      {PAGE_NAMES.map((name) => (
        <PageHost
          key={name}
          name={name}
          active={snapshot.activePage === name}
        />
      ))}
    </>
  );
}

mountIsland({
  mountId: 'page-container-react-root',
  mountedFlag: '__IRONFORGE_PAGE_CONTAINER_SHELL_MOUNTED__',
  eventName: APP_SHELL_EVENT,
  Component: PageContainerShell,
});
