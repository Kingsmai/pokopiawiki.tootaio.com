<script setup lang="ts">
import HomeView from '../src/views/HomeView.vue';

definePageMeta({
  name: 'home',
  seo: { titleKey: 'pages.home.title', descriptionKey: 'pages.home.subtitle', canonicalPath: '/' }
});
</script>

<template>
  <HomeView />
</template>
