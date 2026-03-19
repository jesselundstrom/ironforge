export const APP_PAGES = [
  'dashboard',
  'log',
  'history',
  'settings',
  'nutrition',
] as const;

export type AppPage = (typeof APP_PAGES)[number];

export type ConfirmSnapshot = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

export type SessionSnapshot = {
  activeWorkout: unknown;
  restDuration: number;
  restEndsAt: number;
  restSecondsLeft: number;
  restTotal: number;
  currentUser: unknown;
  restBarActive: boolean;
  rpeOpen: boolean;
  summaryOpen: boolean;
  sportCheckOpen: boolean;
};

export function isAppPage(value: unknown): value is AppPage {
  return typeof value === 'string' && APP_PAGES.includes(value as AppPage);
}

export function getPageFromHash(hash = window.location.hash): AppPage | null {
  const normalized = String(hash || '')
    .replace(/^#\/?/, '')
    .split(/[/?]/)[0]
    .trim();
  return isAppPage(normalized) ? normalized : null;
}
