<script setup lang="ts">
import ResetPasswordView from '../src/views/ResetPasswordView.vue';

definePageMeta({
  name: 'reset-password',
  seo: { titleKey: 'auth.resetTitle', descriptionKey: 'auth.resetSubtitle', noindex: true }
});
</script>

<template>
  <ResetPasswordView />
</template>
