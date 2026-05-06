<script setup lang="ts">
import UserProfileView from '../../src/views/UserProfileView.vue';

definePageMeta({
  name: 'profile',
  requiresAuth: true,
  seo: { titleKey: 'pages.profile.title', descriptionKey: 'pages.profile.subtitle', noindex: true }
});
</script>

<template>
  <UserProfileView />
</template>
