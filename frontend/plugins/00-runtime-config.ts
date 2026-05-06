import { setSystemWordingsApiBaseUrl } from '../src/i18n';
import { setConfiguredSiteUrl } from '../src/seo';
import { setApiBaseUrl } from '../src/services/api';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  setApiBaseUrl(config.public.apiBaseUrl);
  setSystemWordingsApiBaseUrl(config.public.apiBaseUrl);
  setConfiguredSiteUrl(config.public.siteUrl);
});
