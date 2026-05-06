<script setup lang="ts">
import LegalView from '../src/views/LegalView.vue';

definePageMeta({
  name: 'privacy-policy',
  seo: { titleKey: 'pages.legal.privacy.title', descriptionKey: 'pages.legal.privacy.subtitle', canonicalPath: '/privacy-policy' }
});
</script>

<template>
  <LegalView page="privacy" />
</template>
