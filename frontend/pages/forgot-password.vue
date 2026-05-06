<script setup lang="ts">
import ForgotPasswordView from '../src/views/ForgotPasswordView.vue';

definePageMeta({
  name: 'forgot-password',
  seo: { titleKey: 'auth.requestResetTitle', descriptionKey: 'auth.requestResetSubtitle', noindex: true }
});
</script>

<template>
  <ForgotPasswordView />
</template>
