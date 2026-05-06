import { computed, ref } from 'vue';
import { onLocaleChange } from '../src/i18n';
import { applyRouteSeo, onSeoChange, resolvedSeoHead, resolveRouteSeo, setSeoTranslator, type ResolvedSeoConfig } from '../src/seo';

export default defineNuxtPlugin(() => {
  const router = useRouter();
  const nuxtApp = useNuxtApp();
  const t = (nuxtApp.$pokopiaI18n as { global: { t: (key: string, values?: Record<string, string | number>) => string } }).global.t;
  const dynamicSeo = ref<ResolvedSeoConfig | null>(null);
  const activeSeo = computed(() => dynamicSeo.value ?? resolveRouteSeo(router.currentRoute.value, t));
  useHead(() => resolvedSeoHead(activeSeo.value));

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
