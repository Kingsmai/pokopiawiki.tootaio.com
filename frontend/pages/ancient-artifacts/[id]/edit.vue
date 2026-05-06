<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import ItemDetail from '../../../src/views/ItemDetail.vue';

definePageMeta({
  name: 'ancient-artifact-edit',
  requiredPermission: 'items.update',
  editorModal: true,
  seo: {
    titleKey: 'pages.ancientArtifacts.editKicker',
    descriptionKey: 'pages.ancientArtifacts.editSubtitle',
    canonicalPath: (route: RouteLocationNormalizedLoaded) => `/ancient-artifacts/${String(route.params.id)}`,
    noindex: true
  }
});
</script>

<template>
  <ItemDetail />
</template>
