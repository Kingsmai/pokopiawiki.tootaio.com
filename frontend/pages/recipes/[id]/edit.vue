<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import RecipeDetail from '../../../src/views/RecipeDetail.vue';

definePageMeta({
  name: 'recipe-edit',
  requiredPermission: 'recipes.update',
  editorModal: true,
  seo: {
    titleKey: 'pages.recipes.editKicker',
    descriptionKey: 'pages.recipes.editSubtitle',
    canonicalPath: (route: RouteLocationNormalizedLoaded) => `/recipes/${String(route.params.id)}`,
    noindex: true
  }
});
</script>

<template>
  <RecipeDetail />
</template>
