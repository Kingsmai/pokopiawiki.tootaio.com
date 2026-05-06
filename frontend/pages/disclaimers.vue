<script setup lang="ts">
import LegalView from '../src/views/LegalView.vue';

definePageMeta({
  name: 'disclaimers',
  seo: { titleKey: 'pages.legal.disclaimers.title', descriptionKey: 'pages.legal.disclaimers.subtitle', canonicalPath: '/disclaimers' }
});
</script>

<template>
  <LegalView page="disclaimers" />
</template>
