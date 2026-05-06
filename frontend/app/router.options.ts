import type { RouterConfig } from '@nuxt/schema';

export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.meta.editorModal === true || from.meta.editorModal === true) return false;
    return { top: 0 };
  }
};
