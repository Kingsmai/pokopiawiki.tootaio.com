<script setup lang="ts">
import ComingSoonView from '../src/views/ComingSoonView.vue';

definePageMeta({
  name: 'clothes',
  seo: { titleKey: 'pages.comingSoon.sections.clothes.title', descriptionKey: 'pages.comingSoon.sections.clothes.subtitle', noindex: true }
});
</script>

<template>
  <ComingSoonView page="clothes" />
</template>
