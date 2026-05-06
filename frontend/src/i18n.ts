import { createI18n } from 'vue-i18n';
import { defaultLocale, systemWordingMessages, type SystemWordingTree } from '../../system-wordings';

export { defaultLocale } from '../../system-wordings';
let browserApiBaseUrl = 'http://localhost:3001';
let serverApiBaseUrl = 'http://localhost:3001';
const localeStorageKey = 'pokopia_locale';
const localeChangeEvent = 'pokopia-locale-change';

const messages = systemWordingMessages as unknown as Record<string, SystemWordingTree>;
const loadedWordingLocales = new Set<string>();
const pendingWordingLoads = new Map<string, Promise<void>>();

type SystemWordingsResponse = {
  locale: string;
  messages: SystemWordingTree;
};

export type MessageKey = keyof typeof messages.en;

export function createPokopiaI18n(initialLocale = readStoredLocale()) {
  return createI18n({
    legacy: false,
    globalInjection: true,
    locale: initialLocale || defaultLocale,
    fallbackLocale: defaultLocale,
    messages
  });
}

type PokopiaI18n = ReturnType<typeof createPokopiaI18n>;
let activeI18n: PokopiaI18n | null = null;

export function setActiveI18n(instance: PokopiaI18n): void {
  activeI18n = instance;
}

export function setSystemWordingsApiBaseUrl(value: unknown): void {
  setSystemWordingsApiBaseUrls({ browser: value, server: value });
}

export function setSystemWordingsApiBaseUrls(value: { browser?: unknown; server?: unknown }): void {
  const browserBaseUrl = normalizeApiBaseUrl(value.browser);
  const serverBaseUrl = normalizeApiBaseUrl(value.server);

  if (browserBaseUrl) {
    browserApiBaseUrl = browserBaseUrl;
  }
  if (serverBaseUrl) {
    serverApiBaseUrl = serverBaseUrl;
  }
}

function normalizeApiBaseUrl(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim().replace(/\/+$/, '');
  }

  return null;
}

function activeApiBaseUrl(): string {
  return typeof window === 'undefined' ? serverApiBaseUrl : browserApiBaseUrl;
}

export function readStoredLocale(): string {
  if (typeof localStorage === 'undefined') {
    return defaultLocale;
  }

  const storedLocale = localStorage.getItem(localeStorageKey);
  return storedLocale && storedLocale.trim() !== '' ? storedLocale : defaultLocale;
}

function globalLocaleRef() {
  return activeI18n?.global.locale as unknown as { value: string } | undefined;
}

export function getCurrentLocale(): string {
  return globalLocaleRef()?.value || defaultLocale;
}

function isMessageTree(value: SystemWordingTree[string] | undefined): value is SystemWordingTree {
  return typeof value === 'object' && value !== null;
}

function mergeMessageTrees(...trees: Array<SystemWordingTree | undefined>): SystemWordingTree {
  const merged: SystemWordingTree = {};

  for (const tree of trees) {
    if (!tree) {
      continue;
    }

    for (const [key, value] of Object.entries(tree)) {
      const current = merged[key];
      merged[key] = isMessageTree(value) && isMessageTree(current) ? mergeMessageTrees(current, value) : value;
    }
  }

  return merged;
}

function builtInMessagesFor(locale: string): SystemWordingTree {
  return mergeMessageTrees(messages[defaultLocale], messages[locale]);
}

export async function loadSystemWordings(locale = getCurrentLocale(), force = false): Promise<void> {
  if (!activeI18n) {
    return;
  }

  const targetI18n = activeI18n;
  const targetLocale = locale || defaultLocale;
  if (!force && loadedWordingLocales.has(targetLocale)) {
    return;
  }

  const pendingLoad = pendingWordingLoads.get(targetLocale);
  if (pendingLoad) {
    await pendingLoad;
    return;
  }

  const loadPromise = (async () => {
    try {
      const response = await fetch(`${activeApiBaseUrl()}/api/system-wordings?locale=${encodeURIComponent(targetLocale)}`);
      if (!response.ok) {
        throw new Error(`System wordings failed (${response.status})`);
      }

      const data = (await response.json()) as SystemWordingsResponse;
      targetI18n.global.setLocaleMessage(
        targetLocale,
        mergeMessageTrees(messages[defaultLocale], messages[targetLocale], data.messages) as never
      );
      loadedWordingLocales.add(targetLocale);
    } catch {
      targetI18n.global.setLocaleMessage(targetLocale, builtInMessagesFor(targetLocale) as never);
    } finally {
      pendingWordingLoads.delete(targetLocale);
    }
  })();

  pendingWordingLoads.set(targetLocale, loadPromise);
  await loadPromise;
}

export function setCurrentLocale(locale: string): void {
  const nextLocale = locale || defaultLocale;
  const localeRef = globalLocaleRef();
  if (localeRef) {
    localeRef.value = nextLocale;
  }

  if (typeof document !== 'undefined') {
    document.documentElement.lang = nextLocale;
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(localeStorageKey, nextLocale);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(localeChangeEvent));
  }
}

export function onLocaleChange(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener(localeChangeEvent, callback);
  return () => window.removeEventListener(localeChangeEvent, callback);
}
