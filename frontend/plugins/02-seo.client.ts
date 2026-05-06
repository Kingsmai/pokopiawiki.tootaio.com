import { onLocaleChange } from '../src/i18n';
import { applyRouteSeo } from '../src/seo';

export default defineNuxtPlugin(() => {
  const router = useRouter();

  router.afterEach((to) => {
    applyRouteSeo(to);
  });

  onLocaleChange(() => {
    applyRouteSeo(router.currentRoute.value);
  });
});
