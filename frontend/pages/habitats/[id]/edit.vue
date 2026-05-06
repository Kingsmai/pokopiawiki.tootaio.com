<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import HabitatDetail from '../../../src/views/HabitatDetail.vue';

definePageMeta({
  name: 'habitat-edit',
  requiredPermission: 'habitats.update',
  editorModal: true,
  seo: {
    titleKey: 'pages.habitats.detailKicker',
    descriptionKey: 'pages.habitats.editSubtitle',
    canonicalPath: (route: RouteLocationNormalizedLoaded) => `/habitats/${String(route.params.id)}`,
    noindex: true
  }
});
</script>

<template>
  <HabitatDetail />
</template>
