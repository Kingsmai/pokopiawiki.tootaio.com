import { normalizeSiteUrl, sitemapXml } from '../utils/seo-files';

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  return sitemapXml(normalizeSiteUrl(config.public.siteUrl));
});
