<script setup lang="ts">
import RecipeList from '../../src/views/RecipeList.vue';

definePageMeta({
  name: 'recipe-list',
  seo: { titleKey: 'pages.recipes.title', descriptionKey: 'pages.recipes.subtitle' }
});
</script>

<template>
  <RecipeList />
</template>
