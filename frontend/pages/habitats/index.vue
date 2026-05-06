<script setup lang="ts">
import HabitatList from '../../src/views/HabitatList.vue';

definePageMeta({
  name: 'habitat-list',
  seo: { titleKey: 'pages.habitats.title', descriptionKey: 'pages.habitats.subtitle' }
});
</script>

<template>
  <HabitatList :event-only="false" />
</template>
