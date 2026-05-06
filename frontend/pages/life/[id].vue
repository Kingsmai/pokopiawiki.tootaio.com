<script setup lang="ts">
import LifePostDetail from '../../src/views/LifePostDetail.vue';

definePageMeta({
  name: 'life-id',
  seo: { titleKey: 'pages.life.detailTitle', descriptionKey: 'pages.life.detailSubtitle' }
});
</script>

<template>
  <LifePostDetail />
</template>
