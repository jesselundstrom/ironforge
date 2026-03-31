export const APP_PAGES = [
  'dashboard',
  'log',
  'history',
  'settings',
  'nutrition',
] as const;

export type AppPage = (typeof APP_PAGES)[number];

export const SETTINGS_TABS = [
  'schedule',
  'preferences',
  'program',
  'account',
  'body',
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export type ConfirmSnapshot = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

export type ToastSnapshot = {
  visible: boolean;
  message: string;
  variant: string;
  background: string;
  undoLabel: string;
  durationMs: number;
  token: number;
  undoAction: (() => void) | null;
};

export type LogStartView = {
  labels: Record<string, unknown>;
  values: Record<string, unknown>;
};

export type LogActiveView = {
  labels: Record<string, unknown>;
  values: Record<string, unknown>;
};

export type SettingsAccountView = {
  [key: string]: unknown;
};

export type SettingsBodyView = {
  [key: string]: unknown;
};

export type SettingsPreferencesView = {
  [key: string]: unknown;
};

export type SettingsProgramView = {
  [key: string]: unknown;
};

export type SettingsScheduleView = {
  [key: string]: unknown;
};

export type ExerciseCatalogOption = {
  value: string;
  label: string;
};

export type ExerciseCatalogFilterGroup = {
  id: string;
  label: string;
  activeValue: string;
  options: ExerciseCatalogOption[];
};

export type ExerciseCatalogItem = {
  id: string;
  name: string;
  meta: string;
};

export type ExerciseCatalogSection = {
  id: string;
  title: string;
  items: ExerciseCatalogItem[];
  emptyCopy?: string;
};

export type ExerciseCatalogView = {
  open: boolean;
  mode: string;
  title: string;
  subtitle: string;
  search: string;
  clearVisible: boolean;
  emptyVisible: boolean;
  emptyCopy: string;
  filters: ExerciseCatalogFilterGroup[];
  sections: ExerciseCatalogSection[];
};

export type RpePromptSnapshot = {
  open: boolean;
  title: string;
  subtitle: string;
  options: Array<{
    value: number;
    feel: string;
    description: string;
  }>;
};

export type SportCheckPromptSnapshot = {
  open: boolean;
  title: string;
  subtitle: string;
};

export type SummaryPromptSnapshot = {
  open: boolean;
  seed: number;
  kicker: string;
  title: string;
  programLabel: string;
  coachNote: string;
  notesLabel: string;
  notesPlaceholder: string;
  feedbackLabel: string;
  feedbackOptions: Array<{
    value: string;
    label: string;
  }>;
  nutritionLabel: string;
  doneLabel: string;
  notes: string;
  feedback: string | null;
  canLogNutrition: boolean;
  stats: Array<{
    key: string;
    accent: string;
    label: string;
    initialText: string;
  }>;
  summaryData: Record<string, unknown> | null;
};

export type ExerciseGuidePromptSnapshot = {
  open: boolean;
  title: string;
  subtitle: string;
  setup: string;
  execution: string[];
  cues: string[];
  safety: string;
  mediaLinks: Array<{
    href: string;
    label: string;
  }>;
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
  rpePrompt: RpePromptSnapshot | null;
  summaryOpen: boolean;
  summaryPrompt: SummaryPromptSnapshot | null;
  sportCheckOpen: boolean;
  sportCheckPrompt: SportCheckPromptSnapshot | null;
  exerciseGuideOpen: boolean;
  exerciseGuidePrompt: ExerciseGuidePromptSnapshot | null;
};

export function isAppPage(value: unknown): value is AppPage {
  return typeof value === 'string' && APP_PAGES.includes(value as AppPage);
}

export function isSettingsTab(value: unknown): value is SettingsTab {
  return (
    typeof value === 'string' && SETTINGS_TABS.includes(value as SettingsTab)
  );
}

export function getPageFromHash(hash = window.location.hash): AppPage | null {
  const normalized = String(hash || '')
    .replace(/^#\/?/, '')
    .split(/[/?]/)[0]
    .trim();
  return isAppPage(normalized) ? normalized : null;
}
