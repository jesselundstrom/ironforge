export function t(key, fallback, params) {
  if (typeof window !== 'undefined' && typeof window.tr === 'function') {
    return window.tr(key, fallback, params);
  }
  return fallback;
}
