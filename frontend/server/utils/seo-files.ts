const fallbackSiteUrl = 'https://pokopiawiki.tootaio.com';

const sitemapPaths = [
  '/',
  '/pokemon',
  '/event-pokemon',
  '/habitats',
  '/event-habitats',
  '/items',
  '/event-items',
  '/ancient-artifacts',
  '/recipes',
  '/dish',
  '/checklist',
  '/life',
  '/project-updates',
  '/privacy-policy',
  '/terms-of-service',
  '/disclaimers'
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

export function robotsTxt(siteUrl: string): string {
  const disallowLines = robotsDisallowPaths.map((path) => `Disallow: ${path}`).join('\n');
  return `User-agent: *\nAllow: /\n${disallowLines}\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

export function sitemapXml(siteUrl: string): string {
  const urls = sitemapPaths
    .map(
      (path) => `  <url>
    <loc>${siteUrl}${path}</loc>
    <changefreq>weekly</changefreq>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
