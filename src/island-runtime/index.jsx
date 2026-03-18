import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { subscribe } from '../core/state.js';

export function useIslandSnapshot(eventNames, getSnapshot) {
  const [snapshot, setSnapshot] = useState(() => getSnapshot());
  const names = Array.isArray(eventNames) ? eventNames : [eventNames];

  useEffect(() => {
    const handleChange = () => {
      setSnapshot(getSnapshot());
    };

    return subscribe(names, handleChange);
  }, [getSnapshot, ...names]);

  return snapshot;
}

export function mountIsland({
  mountId,
  legacyShellId,
  mountedFlag,
  eventName,
  Component,
}) {
  const mountNode = document.getElementById(mountId);
  if (!mountNode) return false;

  const legacyIds = Array.isArray(legacyShellId) ? legacyShellId : [legacyShellId];
  legacyIds.filter(Boolean).forEach((id) => document.getElementById(id)?.remove());
  window[mountedFlag] = true;
  createRoot(mountNode).render(<Component />);
  window.dispatchEvent(new CustomEvent(eventName));
  return true;
}
