import { normalizeApiBaseUrl, normalizeSiteUrl, threadsSitemapXml } from '../utils/seo-files';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  return threadsSitemapXml(normalizeSiteUrl(config.public.siteUrl), normalizeApiBaseUrl(config.serverApiBaseUrl));
});
