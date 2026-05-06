import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { getCurrentLocale } from './i18n';
import { defaultLocale, systemWordingMessages, type SystemWordingTree } from '../../system-wordings';

const siteName = 'Pokopia Wiki';
const defaultCanonicalPath = '/';
const defaultImagePath = '/seo/pokopia-hero.jpg';
const fallbackSiteUrl = 'https://pokopiawiki.tootaio.com';
let runtimeSiteUrl: string | null = null;

type TranslationValues = Record<string, string | number>;
type Translator = (key: string, values?: TranslationValues) => string;

export type RouteSeoConfig = {
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  canonicalPath?: string | ((route: RouteLocationNormalizedLoaded) => string);
  image?: string;
  noindex?: boolean;
};

export type SeoConfig = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  image?: string | null;
  noindex?: boolean;
};

export type ResolvedSeoConfig = {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string;
  robots: string;
  locale: string;
  structuredData: Record<string, unknown>;
};

const messages = systemWordingMessages as unknown as Record<string, SystemWordingTree>;
let activeTranslator: Translator | null = null;
let currentSeo: ResolvedSeoConfig | null = null;
const seoListeners = new Set<(seo: ResolvedSeoConfig) => void>();

export function setSeoTranslator(translator: Translator): void {
  activeTranslator = translator;
}

export function setConfiguredSiteUrl(value: unknown): void {
  if (typeof value === 'string' && value.trim() !== '') {
    runtimeSiteUrl = normalizeSiteUrl(value);
  }
}

function configuredSiteUrl(): string {
  if (runtimeSiteUrl) {
    return runtimeSiteUrl;
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return normalizeSiteUrl(window.location.origin);
  }

  return fallbackSiteUrl;
}

function normalizeSiteUrl(value: string): string {
  return value.trim().replace(/\/+$/, '') || fallbackSiteUrl;
}

function normalizePath(value: string | undefined): string {
  const path = value?.trim() || defaultCanonicalPath;
  return path.startsWith('/') ? path : `/${path}`;
}

export function absoluteUrl(value: string): string {
  try {
    return new URL(value, `${configuredSiteUrl()}/`).toString();
  } catch {
    return `${configuredSiteUrl()}${normalizePath(value)}`;
  }
}

function metaTitle(title?: string): string {
  const cleanTitle = title?.trim();
  if (!cleanTitle || cleanTitle === siteName) {
    return siteName;
  }

  return `${cleanTitle} | ${siteName}`;
}

function metaDescription(description?: string): string {
  return description?.trim() || translateSeo('seo.siteDescription');
}

function builtInTranslate(key: string, values: TranslationValues = {}): string {
  let message: SystemWordingTree[string] | undefined = messages[defaultLocale];
  for (const part of key.split('.')) {
    message = typeof message === 'object' && message !== null ? message[part] : undefined;
  }

  if (typeof message !== 'string') {
    return key;
  }

  return Object.entries(values).reduce((nextMessage, [name, value]) => nextMessage.replaceAll(`{${name}}`, String(value)), message);
}

function translateSeo(key: string, values?: TranslationValues, translator = activeTranslator): string {
  return translator ? translator(key, values) : builtInTranslate(key, values);
}

export function resolveSeo(config: SeoConfig = {}): ResolvedSeoConfig {
  const title = metaTitle(config.title);
  const description = metaDescription(config.description);
  const canonicalUrl = absoluteUrl(normalizePath(config.canonicalPath));
  const imageUrl = absoluteUrl(config.image?.trim() || defaultImagePath);
  const robots = config.noindex === true ? 'noindex, nofollow' : 'index, follow';
  const locale = getCurrentLocale();

  return {
    title,
    description,
    canonicalUrl,
    imageUrl,
    robots,
    locale,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonicalUrl,
      isPartOf: {
        '@type': 'WebSite',
        name: siteName,
        url: absoluteUrl('/')
      }
    }
  };
}

export function resolvedSeoHead(seo: ResolvedSeoConfig) {
  return {
    title: seo.title,
    htmlAttrs: {
      lang: seo.locale
    },
    meta: [
      { key: 'description', name: 'description', content: seo.description },
      { key: 'robots', name: 'robots', content: seo.robots },
      { key: 'twitter-card', name: 'twitter:card', content: 'summary_large_image' },
      { key: 'twitter-title', name: 'twitter:title', content: seo.title },
      { key: 'twitter-description', name: 'twitter:description', content: seo.description },
      { key: 'twitter-image', name: 'twitter:image', content: seo.imageUrl },
      { key: 'og-site-name', property: 'og:site_name', content: siteName },
      { key: 'og-type', property: 'og:type', content: 'website' },
      { key: 'og-title', property: 'og:title', content: seo.title },
      { key: 'og-description', property: 'og:description', content: seo.description },
      { key: 'og-url', property: 'og:url', content: seo.canonicalUrl },
      { key: 'og-image', property: 'og:image', content: seo.imageUrl },
      { key: 'og-locale', property: 'og:locale', content: seo.locale === 'en' ? 'en_US' : seo.locale.replace('-', '_') }
    ],
    link: [{ key: 'canonical', rel: 'canonical', href: seo.canonicalUrl }],
    script: [
      {
        key: 'pokopia-structured-data',
        id: 'pokopia-structured-data',
        type: 'application/ld+json',
        innerHTML: JSON.stringify(seo.structuredData).replace(/</g, '\\u003C')
      }
    ]
  };
}

export function routeSeoConfig(route: RouteLocationNormalizedLoaded, translator?: Translator): SeoConfig {
  const routeSeo = route.meta.seo as RouteSeoConfig | undefined;
  const canonicalPath =
    typeof routeSeo?.canonicalPath === 'function'
      ? routeSeo.canonicalPath(route)
      : routeSeo?.canonicalPath ?? route.path ?? defaultCanonicalPath;
  const requiresPrivateAccess = route.matched.some(
    (record) =>
      record.meta.requiresAuth === true ||
      record.meta.requiresVerified === true ||
      typeof record.meta.requiredPermission === 'string' ||
      (Array.isArray(record.meta.requiredAnyPermission) && record.meta.requiredAnyPermission.length > 0)
  );

  return {
    title: routeSeo?.titleKey ? translateSeo(routeSeo.titleKey, undefined, translator) : routeSeo?.title,
    description: routeSeo?.descriptionKey ? translateSeo(routeSeo.descriptionKey, undefined, translator) : routeSeo?.description,
    canonicalPath,
    image: routeSeo?.image,
    noindex: routeSeo?.noindex === true || requiresPrivateAccess
  };
}

export function resolveRouteSeo(route: RouteLocationNormalizedLoaded, translator?: Translator): ResolvedSeoConfig {
  return resolveSeo(routeSeoConfig(route, translator));
}

export function onSeoChange(callback: (seo: ResolvedSeoConfig) => void): () => void {
  seoListeners.add(callback);
  callback(currentSeo ?? resolveSeo());
  return () => seoListeners.delete(callback);
}

export function applySeo(config: SeoConfig = {}): void {
  currentSeo = resolveSeo(config);
  for (const listener of seoListeners) {
    listener(currentSeo);
  }
}

export function applyRouteSeo(route: RouteLocationNormalizedLoaded): void {
  applySeo(routeSeoConfig(route));
}
