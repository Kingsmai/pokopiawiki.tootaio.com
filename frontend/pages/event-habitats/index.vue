<script setup lang="ts">
import HabitatList from '../../src/views/HabitatList.vue';

definePageMeta({
  name: 'event-habitat-list',
  seo: { titleKey: 'pages.eventHabitats.title', descriptionKey: 'pages.eventHabitats.subtitle', canonicalPath: '/event-habitats' }
});
</script>

<template>
  <HabitatList :event-only="true" />
</template>
