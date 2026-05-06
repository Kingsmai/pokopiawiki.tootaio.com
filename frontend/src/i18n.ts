import { createI18n } from 'vue-i18n';
import { defaultLocale, systemWordingMessages, type SystemWordingTree } from '../../system-wordings';

export { defaultLocale } from '../../system-wordings';
let apiBaseUrl = 'http://localhost:3001';
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

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: readStoredLocale(),
  fallbackLocale: defaultLocale,
  messages
});

export function setSystemWordingsApiBaseUrl(value: unknown): void {
  if (typeof value === 'string' && value.trim() !== '') {
    apiBaseUrl = value.trim();
  }
}

function readStoredLocale(): string {
  if (typeof localStorage === 'undefined') {
    return defaultLocale;
  }

  const storedLocale = localStorage.getItem(localeStorageKey);
  return storedLocale && storedLocale.trim() !== '' ? storedLocale : defaultLocale;
}

function globalLocaleRef() {
  return i18n.global.locale as unknown as { value: string };
}

export function getCurrentLocale(): string {
  return globalLocaleRef().value || defaultLocale;
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
      const response = await fetch(`${apiBaseUrl}/api/system-wordings?locale=${encodeURIComponent(targetLocale)}`);
      if (!response.ok) {
        throw new Error(`System wordings failed (${response.status})`);
      }

      const data = (await response.json()) as SystemWordingsResponse;
      i18n.global.setLocaleMessage(
        targetLocale,
        mergeMessageTrees(messages[defaultLocale], messages[targetLocale], data.messages) as never
      );
      loadedWordingLocales.add(targetLocale);
    } catch {
      i18n.global.setLocaleMessage(targetLocale, builtInMessagesFor(targetLocale) as never);
    } finally {
      pendingWordingLoads.delete(targetLocale);
    }
  })();

  pendingWordingLoads.set(targetLocale, loadPromise);
  await loadPromise;
}

export function setCurrentLocale(locale: string): void {
  const nextLocale = locale || defaultLocale;
  globalLocaleRef().value = nextLocale;

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

setCurrentLocale(getCurrentLocale());
