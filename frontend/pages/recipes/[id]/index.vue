<script setup lang="ts">
import RecipeDetail from '../../../src/views/RecipeDetail.vue';

definePageMeta({
  name: 'recipe-detail',
  seo: { titleKey: 'pages.recipes.detailKicker', descriptionKey: 'pages.recipes.subtitle' }
});
</script>

<template>
  <RecipeDetail />
</template>
