import { normalizeSiteUrl, robotsTxt } from '../utils/seo-files';

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  return robotsTxt(normalizeSiteUrl(config.public.siteUrl));
});
