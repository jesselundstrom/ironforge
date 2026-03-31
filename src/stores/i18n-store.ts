import { createStore } from 'zustand/vanilla';
import { useRuntimeStore } from '../app/store/runtime-store';

type I18nStoreState = {
  language: string;
  version: number;
  fallbackLocale: string;
  supportedLocales: string[];
  refreshSnapshot: () => string;
  t: (
    key: string,
    params?: Record<string, unknown> | null,
    fallback?: string
  ) => string;
  setLanguage: (
    locale: string,
    options?: { persist?: boolean; notify?: boolean }
  ) => string;
  extendStrings: (locale: string, entries: Record<string, string>) => void;
  applyTranslations: (root?: ParentNode | null) => void;
};

type Dictionary = Record<string, string>;

const LANGUAGE_STORAGE_KEY = 'if2_language';
const dictionaries: Record<string, Dictionary> = {
  en: {
    'day.sun.short': 'Sun',
    'day.mon.short': 'Mon',
    'day.tue.short': 'Tue',
    'day.wed.short': 'Wed',
    'day.thu.short': 'Thu',
    'day.fri.short': 'Fri',
    'day.sat.short': 'Sat',
    'common.sport': 'Sport',
    'training.days_per_week': '{count} sessions / week',
  },
  fi: {
    'day.sun.short': 'Su',
    'day.mon.short': 'Ma',
    'day.tue.short': 'Ti',
    'day.wed.short': 'Ke',
    'day.thu.short': 'To',
    'day.fri.short': 'Pe',
    'day.sat.short': 'La',
    'common.sport': 'Urheilu',
    'training.days_per_week': '{count} harjoitusta / viikko',
  },
};

function readStoredLanguage() {
  if (typeof localStorage === 'undefined') return 'en';
  try {
    return String(localStorage.getItem(LANGUAGE_STORAGE_KEY) || '').trim() === 'fi'
      ? 'fi'
      : 'en';
  } catch {
    return 'en';
  }
}

function interpolate(
  template: string,
  params?: Record<string, unknown> | null
) {
  return Object.entries(params || {}).reduce(
    (value, [key, nextValue]) =>
      value.replaceAll(`{${key}}`, String(nextValue ?? '')),
    template
  );
}

function translate(
  language: string,
  key: string,
  params?: Record<string, unknown> | null,
  fallback?: string
) {
  const dictionary = dictionaries[language] || dictionaries.en;
  return interpolate(dictionary[key] || fallback || key, params);
}

function notifyLanguageChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('ironforge:language-changed'));
  useRuntimeStore.getState().bumpLanguageVersion();
}

export const i18nStore = createStore<I18nStoreState>((set, get) => ({
  language: readStoredLanguage(),
  version: 0,
  fallbackLocale: 'en',
  supportedLocales: ['en', 'fi'],
  refreshSnapshot: () => get().language,
  t: (key, params, fallback) =>
    translate(get().language, key, params, fallback),
  setLanguage: (locale, options) => {
    const nextLanguage = String(locale || '').toLowerCase().startsWith('fi')
      ? 'fi'
      : 'en';
    if (options?.persist !== false && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      } catch {}
    }
    set((state) => ({
      ...state,
      language: nextLanguage,
      version: state.version + 1,
    }));
    if (options?.notify !== false) {
      notifyLanguageChanged();
    }
    return nextLanguage;
  },
  extendStrings: (locale, entries) => {
    const key = String(locale || '').toLowerCase().startsWith('fi') ? 'fi' : 'en';
    dictionaries[key] = {
      ...(dictionaries[key] || {}),
      ...(entries || {}),
    };
    set((state) => ({
      ...state,
      version: state.version + 1,
    }));
  },
  applyTranslations: () => {},
}));

export function installI18nStore() {
  useRuntimeStore.getState().bumpLanguageVersion();
}

export function tr(
  key: string,
  params?: Record<string, unknown> | null,
  fallback?: string
) {
  return i18nStore.getState().t(key, params, fallback);
}

export function getLanguage() {
  return i18nStore.getState().language;
}
