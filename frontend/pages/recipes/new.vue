<script setup lang="ts">
import RecipeList from '../../src/views/RecipeList.vue';

definePageMeta({
  name: 'recipe-new',
  requiredPermission: 'recipes.create',
  editorModal: true,
  seo: { titleKey: 'pages.recipes.newTitle', descriptionKey: 'pages.recipes.editSubtitle', canonicalPath: '/recipes', noindex: true }
});
</script>

<template>
  <RecipeList />
</template>
