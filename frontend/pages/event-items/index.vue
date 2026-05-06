<script setup lang="ts">
import ItemsList from '../../src/views/ItemsList.vue';

definePageMeta({
  name: 'event-item-list',
  seo: { titleKey: 'pages.eventItems.title', descriptionKey: 'pages.eventItems.subtitle', canonicalPath: '/event-items' }
});
</script>

<template>
  <ItemsList :event-only="true" />
</template>
