<script setup lang="ts">
import AdminView from '../src/views/AdminView.vue';

definePageMeta({
  name: 'admin',
  requiredPermission: 'admin.access',
  seo: { titleKey: 'pages.admin.title', descriptionKey: 'pages.admin.subtitle', noindex: true }
});
</script>

<template>
  <AdminView />
</template>
