import { normalizeApiBaseUrl, normalizeSiteUrl, pokedexSitemapXml } from '../utils/seo-files';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  return pokedexSitemapXml(normalizeSiteUrl(config.public.siteUrl), normalizeApiBaseUrl(config.serverApiBaseUrl));
});
