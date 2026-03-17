import { startTransition, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

export function useIslandSnapshot(eventNames, getSnapshot) {
  const [snapshot, setSnapshot] = useState(() => getSnapshot());
  const names = Array.isArray(eventNames) ? eventNames : [eventNames];

  useEffect(() => {
    const handleChange = () => {
      startTransition(() => {
        setSnapshot(getSnapshot());
      });
    };

    names.forEach((eventName) => window.addEventListener(eventName, handleChange));
    return () => {
      names.forEach((eventName) => window.removeEventListener(eventName, handleChange));
    };
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

  document.getElementById(legacyShellId)?.remove();
  window[mountedFlag] = true;
  createRoot(mountNode).render(<Component />);
  window.dispatchEvent(new CustomEvent(eventName));
  return true;
}
