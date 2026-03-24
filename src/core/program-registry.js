function getWindowProgramRegistry() {
  if (typeof window === 'undefined') return {};
  if (typeof window.getProgramRegistry === 'function') {
    return window.getProgramRegistry() || {};
  }
  return window.PROGRAMS || {};
}

export function getRegisteredPrograms() {
  if (typeof window !== 'undefined' && typeof window.getRegisteredPrograms === 'function') {
    return window.getRegisteredPrograms() || [];
  }
  return Object.values(getWindowProgramRegistry());
}

export function hasRegisteredPrograms() {
  if (typeof window !== 'undefined' && typeof window.hasRegisteredPrograms === 'function') {
    return window.hasRegisteredPrograms() === true;
  }
  return getRegisteredPrograms().length > 0;
}

export function getProgramById(programId) {
  if (typeof window !== 'undefined' && typeof window.getProgramById === 'function') {
    return window.getProgramById(programId) || null;
  }
  const registry = getWindowProgramRegistry();
  return registry?.[String(programId || '').trim()] || null;
}

export function getProgramInitialState(programId) {
  if (
    typeof window !== 'undefined' &&
    typeof window.getProgramInitialState === 'function'
  ) {
    return window.getProgramInitialState(programId);
  }
  const program = getProgramById(programId);
  if (!program || typeof program.getInitialState !== 'function') return null;
  return program.getInitialState();
}
