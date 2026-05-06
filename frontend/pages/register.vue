<script setup lang="ts">
import RegisterView from '../src/views/RegisterView.vue';

definePageMeta({
  name: 'register',
  seo: { titleKey: 'auth.registerTitle', descriptionKey: 'auth.registerSubtitle', noindex: true }
});
</script>

<template>
  <RegisterView />
</template>
