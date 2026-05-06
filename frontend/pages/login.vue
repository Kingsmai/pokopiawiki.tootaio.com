<script setup lang="ts">
import LoginView from '../src/views/LoginView.vue';

definePageMeta({
  name: 'login',
  seo: { titleKey: 'auth.loginTitle', descriptionKey: 'auth.loginSubtitle', noindex: true }
});
</script>

<template>
  <LoginView />
</template>
