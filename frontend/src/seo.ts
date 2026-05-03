import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import { getCurrentLocale, i18n, onLocaleChange } from './i18n';

const siteName = 'Pokopia Wiki';
const defaultCanonicalPath = '/';
const defaultImagePath = '/seo/pokopia-hero.jpg';
const fallbackSiteUrl = 'https://pokopiawiki.tootaio.com';

type TranslationValues = Record<string, string | number>;

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

const translate = i18n.global.t as (key: string, values?: TranslationValues) => string;

function configuredSiteUrl(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return normalizeSiteUrl(fromEnv);
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
  return description?.trim() || translate('seo.siteDescription');
}

function localeForOpenGraph(locale: string): string {
  if (locale === 'en') {
    return 'en_US';
  }

  return locale.replace('-', '_');
}

function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function setStructuredData(title: string, description: string, canonicalUrl: string): void {
  let element = document.getElementById('pokopia-structured-data') as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement('script');
    element.id = 'pokopia-structured-data';
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify({
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
  });
}

export function applySeo(config: SeoConfig = {}): void {
  if (typeof document === 'undefined') {
    return;
  }

  const title = metaTitle(config.title);
  const description = metaDescription(config.description);
  const canonicalUrl = absoluteUrl(normalizePath(config.canonicalPath));
  const imageUrl = absoluteUrl(config.image?.trim() || defaultImagePath);
  const noindex = config.noindex === true;
  const robots = noindex ? 'noindex, nofollow' : 'index, follow';
  const locale = getCurrentLocale();

  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', robots);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', imageUrl);
  setMeta('property', 'og:site_name', siteName);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:image', imageUrl);
  setMeta('property', 'og:locale', localeForOpenGraph(locale));
  setCanonical(canonicalUrl);
  setStructuredData(title, description, canonicalUrl);
}

export function applyRouteSeo(route: RouteLocationNormalizedLoaded): void {
  const routeSeo = route.meta.seo as RouteSeoConfig | undefined;
  const canonicalPath =
    typeof routeSeo?.canonicalPath === 'function'
      ? routeSeo.canonicalPath(route)
      : routeSeo?.canonicalPath ?? route.path ?? defaultCanonicalPath;

  applySeo({
    title: routeSeo?.titleKey ? translate(routeSeo.titleKey) : routeSeo?.title,
    description: routeSeo?.descriptionKey ? translate(routeSeo.descriptionKey) : routeSeo?.description,
    canonicalPath,
    image: routeSeo?.image,
    noindex: routeSeo?.noindex
  });
}

export function setupSeo(router: Router): void {
  router.afterEach((to) => {
    applyRouteSeo(to);
  });

  if (typeof window !== 'undefined') {
    onLocaleChange(() => {
      applyRouteSeo(router.currentRoute.value);
    });
  }
}
