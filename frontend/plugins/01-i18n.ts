import { createPokopiaI18n, setActiveI18n } from '../src/i18n';

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = createPokopiaI18n();
  if (import.meta.client) {
    setActiveI18n(i18n);
  }

  nuxtApp.vueApp.use(i18n);
  return {
    provide: {
      pokopiaI18n: i18n
    }
  };
});
