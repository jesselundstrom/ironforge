export function getState() {
  if (typeof window !== 'undefined' && typeof window.getIronforgeState === 'function') {
    return window.getIronforgeState();
  }
  return {
    workouts: typeof window !== 'undefined' ? window.workouts || [] : [],
    schedule: typeof window !== 'undefined' ? window.schedule || null : null,
    profile: typeof window !== 'undefined' ? window.profile || null : null,
    activeWorkout: typeof window !== 'undefined' ? window.activeWorkout || null : null,
    restDuration: typeof window !== 'undefined' ? window.restDuration || 0 : 0,
    restEndsAt: typeof window !== 'undefined' ? window.restEndsAt || 0 : 0,
    restSecondsLeft: typeof window !== 'undefined' ? window.restSecondsLeft || 0 : 0,
    currentUser: typeof window !== 'undefined' ? window.currentUser || null : null,
  };
}

export function subscribe(eventNames, listener) {
  if (typeof window === 'undefined') return () => {};
  const names = Array.isArray(eventNames) ? eventNames : [eventNames];
  names.forEach((eventName) => window.addEventListener(eventName, listener));
  return () => {
    names.forEach((eventName) => window.removeEventListener(eventName, listener));
  };
}
