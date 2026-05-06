import { setSystemWordingsApiBaseUrls } from '../src/i18n';
import { setConfiguredSiteUrl } from '../src/seo';
import { setApiBaseUrls } from '../src/services/api';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const apiBaseUrls = {
    browser: config.public.apiBaseUrl,
    server: config.serverApiBaseUrl
  };

  setApiBaseUrls(apiBaseUrls);
  setSystemWordingsApiBaseUrls(apiBaseUrls);
  setConfiguredSiteUrl(config.public.siteUrl);
});
