<script setup lang="ts">
import VerifyEmailView from '../src/views/VerifyEmailView.vue';

definePageMeta({
  name: 'verify-email',
  seo: { titleKey: 'auth.verifyTitle', descriptionKey: 'auth.verifySubtitle', noindex: true }
});
</script>

<template>
  <VerifyEmailView />
</template>
