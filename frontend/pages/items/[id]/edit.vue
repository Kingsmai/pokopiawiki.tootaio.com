<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import ItemDetail from '../../../src/views/ItemDetail.vue';

definePageMeta({
  name: 'item-edit',
  requiredPermission: 'items.update',
  editorModal: true,
  seo: {
    titleKey: 'pages.items.editKicker',
    descriptionKey: 'pages.items.editSubtitle',
    canonicalPath: (route: RouteLocationNormalizedLoaded) => `/items/${String(route.params.id)}`,
    noindex: true
  }
});
</script>

<template>
  <ItemDetail />
</template>
