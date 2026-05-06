<script setup lang="ts">
import DishView from '../src/views/DishView.vue';

definePageMeta({
  name: 'dish',
  seo: { titleKey: 'pages.dish.title', descriptionKey: 'pages.dish.subtitle' }
});
</script>

<template>
  <DishView />
</template>
