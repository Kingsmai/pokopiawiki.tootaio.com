<script setup lang="ts">
import ItemsList from '../../src/views/ItemsList.vue';

definePageMeta({
  name: 'item-list',
  seo: { titleKey: 'pages.items.title', descriptionKey: 'pages.items.subtitle' }
});
</script>

<template>
  <ItemsList :event-only="false" />
</template>
