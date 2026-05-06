import { computed, ref } from 'vue';
import { onLocaleChange } from '../src/i18n';
import { applyRouteSeo, onSeoChange, resolveRouteSeo, setSeoTranslator, type ResolvedSeoConfig } from '../src/seo';

export default defineNuxtPlugin(() => {
  const router = useRouter();
  const nuxtApp = useNuxtApp();
  const t = (nuxtApp.$pokopiaI18n as { global: { t: (key: string, values?: Record<string, string | number>) => string } }).global.t;
  const dynamicSeo = ref<ResolvedSeoConfig | null>(null);
  const activeSeo = computed(() => dynamicSeo.value ?? resolveRouteSeo(router.currentRoute.value, t));

  useHead(() => ({
    title: activeSeo.value.title,
    htmlAttrs: {
      lang: activeSeo.value.locale
    },
    meta: [
      { key: 'description', name: 'description', content: activeSeo.value.description },
      { key: 'robots', name: 'robots', content: activeSeo.value.robots },
      { key: 'twitter-card', name: 'twitter:card', content: 'summary_large_image' },
      { key: 'twitter-title', name: 'twitter:title', content: activeSeo.value.title },
      { key: 'twitter-description', name: 'twitter:description', content: activeSeo.value.description },
      { key: 'twitter-image', name: 'twitter:image', content: activeSeo.value.imageUrl },
      { key: 'og-site-name', property: 'og:site_name', content: 'Pokopia Wiki' },
      { key: 'og-type', property: 'og:type', content: 'website' },
      { key: 'og-title', property: 'og:title', content: activeSeo.value.title },
      { key: 'og-description', property: 'og:description', content: activeSeo.value.description },
      { key: 'og-url', property: 'og:url', content: activeSeo.value.canonicalUrl },
      { key: 'og-image', property: 'og:image', content: activeSeo.value.imageUrl },
      { key: 'og-locale', property: 'og:locale', content: activeSeo.value.locale === 'en' ? 'en_US' : activeSeo.value.locale.replace('-', '_') }
    ],
    link: [{ key: 'canonical', rel: 'canonical', href: activeSeo.value.canonicalUrl }],
    script: [
      {
        key: 'pokopia-structured-data',
        id: 'pokopia-structured-data',
        type: 'application/ld+json',
        children: JSON.stringify(activeSeo.value.structuredData)
      }
    ]
  }));

  if (import.meta.server) {
    return;
  }

  setSeoTranslator(t);
  onSeoChange((seo) => {
    dynamicSeo.value = seo;
  });
  onLocaleChange(() => {
    dynamicSeo.value = null;
    applyRouteSeo(router.currentRoute.value);
  });

  router.afterEach((to) => {
    dynamicSeo.value = null;
    applyRouteSeo(to);
  });

  applyRouteSeo(router.currentRoute.value);
});
