import { createStore } from 'zustand/vanilla';

type LegacyI18nApi = {
  t?: (
    key: string,
    params?: Record<string, unknown> | null,
    fallback?: string
  ) => string;
  extendStrings?: (locale: string, entries: Record<string, string>) => void;
  setLanguage?: (
    locale: string,
    options?: { persist?: boolean; notify?: boolean }
  ) => string | void;
  getLanguage?: () => string;
  applyTranslations?: (root?: ParentNode) => void;
  fallbackLocale?: string;
  supportedLocales?: string[];
};

type I18nStoreState = {
  language: string;
  version: number;
  fallbackLocale: string;
  supportedLocales: string[];
  syncFromLegacy: () => string;
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

const LANGUAGE_EVENT = 'ironforge:language-changed';
let bridgeInstalled = false;

function getLegacyI18n(): LegacyI18nApi | null {
  if (typeof window === 'undefined') return null;
  return window.I18N || null;
}

function getInitialLanguage() {
  return getLegacyI18n()?.getLanguage?.() || 'en';
}

function syncStoreFromLegacy() {
  const legacy = getLegacyI18n();
  const language = legacy?.getLanguage?.() || 'en';
  i18nStore.setState((state) => ({
    ...state,
    language,
    fallbackLocale: String(legacy?.fallbackLocale || 'en'),
    supportedLocales: Array.isArray(legacy?.supportedLocales)
      ? legacy.supportedLocales.map((locale) => String(locale))
      : ['en'],
    version: state.version + 1,
  }));
  return language;
}

export const i18nStore = createStore<I18nStoreState>((set) => ({
  language: getInitialLanguage(),
  version: 0,
  fallbackLocale: String(getLegacyI18n()?.fallbackLocale || 'en'),
  supportedLocales: Array.isArray(getLegacyI18n()?.supportedLocales)
    ? (getLegacyI18n()?.supportedLocales || []).map((locale) => String(locale))
    : ['en'],
  syncFromLegacy: () => syncStoreFromLegacy(),
  t: (key, params, fallback) => {
    const legacy = getLegacyI18n();
    if (legacy?.t) {
      return legacy.t(key, params, fallback);
    }
    return String(fallback ?? key);
  },
  setLanguage: (locale, options) => {
    const legacy = getLegacyI18n();
    legacy?.setLanguage?.(locale, options);
    const nextLanguage = legacy?.getLanguage?.() || String(locale);
    set((state) => ({
      ...state,
      language: nextLanguage,
      version: state.version + 1,
    }));
    return nextLanguage;
  },
  extendStrings: (locale, entries) => {
    getLegacyI18n()?.extendStrings?.(locale, entries);
    syncStoreFromLegacy();
  },
  applyTranslations: (root) => {
    getLegacyI18n()?.applyTranslations?.(root || undefined);
  },
}));

export function installLegacyI18nStoreBridge() {
  if (bridgeInstalled || typeof window === 'undefined') return;
  bridgeInstalled = true;
  syncStoreFromLegacy();
  window.addEventListener(LANGUAGE_EVENT, syncStoreFromLegacy);
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
