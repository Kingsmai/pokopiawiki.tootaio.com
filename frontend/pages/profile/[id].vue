<script setup lang="ts">
import UserProfileView from '../../src/views/UserProfileView.vue';

definePageMeta({
  name: 'profile-id',
  seo: { titleKey: 'pages.profile.title', descriptionKey: 'pages.profile.publicSubtitle' }
});
</script>

<template>
  <UserProfileView />
</template>
