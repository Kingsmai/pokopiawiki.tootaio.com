<script setup lang="ts">
import ItemDetail from '../../../src/views/ItemDetail.vue';

definePageMeta({
  name: 'item-detail',
  seo: { titleKey: 'pages.items.detailKicker', descriptionKey: 'pages.items.subtitle' }
});
</script>

<template>
  <ItemDetail />
</template>
