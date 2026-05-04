import { defineConfig, loadEnv, type PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';

const fallbackSiteUrl = 'https://pokopiawiki.tootaio.com';
const frontendPort = 20015;
const sitemapPaths = [
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
  '/life'
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

function normalizeSiteUrl(value: string | undefined): string {
  return (value?.trim() || fallbackSiteUrl).replace(/\/+$/, '');
}

function robotsTxt(siteUrl: string): string {
  const disallowLines = robotsDisallowPaths.map((path) => `Disallow: ${path}`).join('\n');
  return `User-agent: *\nAllow: /\n${disallowLines}\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

function sitemapXml(siteUrl: string): string {
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

function seoFilesPlugin(siteUrl: string): PluginOption {
  return {
    name: 'pokopia-seo-files',
    transformIndexHtml(html) {
      return html.replaceAll('%POKOPIA_SITE_URL%', siteUrl);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === '/robots.txt') {
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end(robotsTxt(siteUrl));
          return;
        }

        if (request.url === '/sitemap.xml') {
          response.setHeader('Content-Type', 'application/xml; charset=utf-8');
          response.end(sitemapXml(siteUrl));
          return;
        }

        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsTxt(siteUrl)
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemapXml(siteUrl)
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = normalizeSiteUrl(process.env.VITE_SITE_URL ?? env.VITE_SITE_URL);

  return {
    plugins: [vue(), seoFilesPlugin(siteUrl)],
    server: {
      port: frontendPort
    }
  };
});
