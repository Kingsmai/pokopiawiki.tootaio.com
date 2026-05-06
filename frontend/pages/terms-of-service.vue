<script setup lang="ts">
import LegalView from '../src/views/LegalView.vue';

definePageMeta({
  name: 'terms-of-service',
  seo: { titleKey: 'pages.legal.terms.title', descriptionKey: 'pages.legal.terms.subtitle', canonicalPath: '/terms-of-service' }
});
</script>

<template>
  <LegalView page="terms" />
</template>
