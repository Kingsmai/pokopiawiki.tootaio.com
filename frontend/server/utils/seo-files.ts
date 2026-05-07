const fallbackSiteUrl = 'https://pokopiawiki.tootaio.com';
const fallbackApiBaseUrl = 'http://localhost:3001';
const staticLastmod = new Date().toISOString();
const sitemapPageSize = 72;

type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export type SitemapUrl = {
  path: string;
  lastmod?: string | null;
  changefreq?: ChangeFrequency;
  priority?: number;
};

type SitemapEntity = {
  id: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastActiveAt?: string | null;
  ancientArtifactCategory?: unknown;
};

type ListPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

const sitemapFiles = [
  '/sitemap-static.xml',
  '/sitemap-pokedex.xml',
  '/sitemap-habitats.xml',
  '/sitemap-collections.xml',
  '/sitemap-life.xml',
  '/sitemap-threads.xml'
];

const staticSitemapUrls: SitemapUrl[] = [
  { path: '/', changefreq: 'weekly', priority: 1 },
  { path: '/pokemon', changefreq: 'weekly', priority: 0.95 },
  { path: '/event-pokemon', changefreq: 'weekly', priority: 0.85 },
  { path: '/habitats', changefreq: 'weekly', priority: 0.9 },
  { path: '/event-habitats', changefreq: 'weekly', priority: 0.8 },
  { path: '/items', changefreq: 'weekly', priority: 0.9 },
  { path: '/event-items', changefreq: 'weekly', priority: 0.8 },
  { path: '/ancient-artifacts', changefreq: 'weekly', priority: 0.85 },
  { path: '/recipes', changefreq: 'weekly', priority: 0.85 },
  { path: '/dish', changefreq: 'weekly', priority: 0.8 },
  { path: '/checklist', changefreq: 'weekly', priority: 0.8 },
  { path: '/life', changefreq: 'daily', priority: 0.75 },
  { path: '/threads', changefreq: 'daily', priority: 0.75 },
  { path: '/project-updates', changefreq: 'weekly', priority: 0.6 },
  { path: '/privacy-policy', changefreq: 'yearly', priority: 0.3 },
  { path: '/terms-of-service', changefreq: 'yearly', priority: 0.3 },
  { path: '/disclaimers', changefreq: 'yearly', priority: 0.3 }
];

const robotsDisallowPaths = [
  '/admin',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/pokemon/new',
  '/event-pokemon/new',
  '/pokemon/*/edit',
  '/habitats/new',
  '/event-habitats/new',
  '/habitats/*/edit',
  '/items/new',
  '/event-items/new',
  '/items/*/edit',
  '/ancient-artifacts/new',
  '/ancient-artifacts/*/edit',
  '/recipes/new',
  '/recipes/*/edit',
  '/automation',
  '/events',
  '/actions',
  '/dream-island',
  '/clothes'
];

export function normalizeSiteUrl(value: unknown): string {
  return (typeof value === 'string' && value.trim() ? value.trim() : fallbackSiteUrl).replace(/\/+$/, '');
}

export function normalizeApiBaseUrl(value: unknown): string {
  return (typeof value === 'string' && value.trim() ? value.trim() : fallbackApiBaseUrl).replace(/\/+$/, '');
}

export function robotsTxt(siteUrl: string): string {
  const disallowLines = robotsDisallowPaths.map((path) => `Disallow: ${path}`).join('\n');
  return `User-agent: *\nAllow: /\n${disallowLines}\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

export function sitemapIndexXml(siteUrl: string): string {
  const sitemaps = sitemapFiles
    .map(
      (path) => `  <sitemap>
    <loc>${xmlEscape(siteUrl + path)}</loc>
    <lastmod>${formatLastmod(staticLastmod)}</lastmod>
  </sitemap>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>
`;
}

export function staticSitemapXml(siteUrl: string): string {
  return sitemapXml(
    siteUrl,
    staticSitemapUrls.map((url) => ({ ...url, lastmod: staticLastmod }))
  );
}

export async function pokedexSitemapXml(siteUrl: string, apiBaseUrl: string): Promise<string> {
  const pokemon = await fetchAllPages<SitemapEntity>(apiBaseUrl, '/api/pokemon');
  return sitemapXml(
    siteUrl,
    pokemon.map((item) => ({
      path: `/pokemon/${item.id}`,
      lastmod: entityLastmod(item),
      changefreq: 'weekly',
      priority: 0.8
    }))
  );
}

export async function habitatsSitemapXml(siteUrl: string, apiBaseUrl: string): Promise<string> {
  const habitats = await fetchAllPages<SitemapEntity>(apiBaseUrl, '/api/habitats');
  return sitemapXml(
    siteUrl,
    habitats.map((item) => ({
      path: `/habitats/${item.id}`,
      lastmod: entityLastmod(item),
      changefreq: 'weekly',
      priority: 0.75
    }))
  );
}

export async function collectionsSitemapXml(siteUrl: string, apiBaseUrl: string): Promise<string> {
  const [items, artifacts, recipes] = await Promise.all([
    fetchAllPages<SitemapEntity>(apiBaseUrl, '/api/items'),
    fetchAllPages<SitemapEntity>(apiBaseUrl, '/api/ancient-artifacts'),
    fetchAllPages<SitemapEntity>(apiBaseUrl, '/api/recipes')
  ]);
  return sitemapXml(siteUrl, [
    ...items
      .filter((item) => !item.ancientArtifactCategory)
      .map((item) => ({
        path: `/items/${item.id}`,
        lastmod: entityLastmod(item),
        changefreq: 'weekly' as const,
        priority: 0.75
      })),
    ...artifacts.map((item) => ({
      path: `/ancient-artifacts/${item.id}`,
      lastmod: entityLastmod(item),
      changefreq: 'weekly' as const,
      priority: 0.75
    })),
    ...recipes.map((item) => ({
      path: `/recipes/${item.id}`,
      lastmod: entityLastmod(item),
      changefreq: 'weekly' as const,
      priority: 0.7
    }))
  ]);
}

export async function lifeSitemapXml(siteUrl: string, apiBaseUrl: string): Promise<string> {
  const posts = await fetchAllPages<SitemapEntity>(apiBaseUrl, '/api/life-posts');
  return sitemapXml(
    siteUrl,
    posts.map((item) => ({
      path: `/life/${item.id}`,
      lastmod: entityLastmod(item),
      changefreq: 'daily',
      priority: 0.65
    }))
  );
}

export async function threadsSitemapXml(siteUrl: string, apiBaseUrl: string): Promise<string> {
  const threads = await fetchAllPages<SitemapEntity>(apiBaseUrl, '/api/threads');
  return sitemapXml(
    siteUrl,
    threads.map((item) => ({
      path: `/threads/${item.id}`,
      lastmod: entityLastmod(item),
      changefreq: 'daily',
      priority: 0.65
    }))
  );
}

function sitemapXml(siteUrl: string, urls: SitemapUrl[]): string {
  const body = urls.map((url) => sitemapUrlXml(siteUrl, url)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function sitemapUrlXml(siteUrl: string, url: SitemapUrl): string {
  return [
    '  <url>',
    `    <loc>${xmlEscape(siteUrl + normalizePath(url.path))}</loc>`,
    ...(url.lastmod ? [`    <lastmod>${formatLastmod(url.lastmod)}</lastmod>`] : []),
    ...(url.changefreq ? [`    <changefreq>${url.changefreq}</changefreq>`] : []),
    ...(url.priority !== undefined ? [`    <priority>${formatPriority(url.priority)}</priority>`] : []),
    '  </url>'
  ].join('\n');
}

async function fetchAllPages<T extends SitemapEntity>(apiBaseUrl: string, path: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(path, `${apiBaseUrl}/`);
    url.searchParams.set('limit', String(sitemapPageSize));
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Sitemap source request failed: ${path} (${response.status})`);
    }

    const page = (await response.json()) as ListPage<T>;
    items.push(...page.items);
    cursor = page.hasMore ? page.nextCursor : null;
  } while (cursor);

  return items;
}

function entityLastmod(entity: SitemapEntity): string | null {
  return entity.lastActiveAt ?? entity.updatedAt ?? entity.createdAt ?? null;
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function formatLastmod(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? xmlEscape(value) : date.toISOString();
}

function formatPriority(value: number): string {
  return Math.max(0, Math.min(1, value)).toFixed(2).replace(/0$/, '').replace(/\.0$/, '.0');
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
