<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import ThreadsView from '../../src/views/ThreadsView.vue';

definePageMeta({
  name: 'thread-detail',
  seo: {
    titleKey: 'pages.threads.title',
    descriptionKey: 'seo.threadsDescription',
    canonicalPath: (route: RouteLocationNormalizedLoaded) => `/threads/${String(route.params.id)}`
  }
});
</script>

<template>
  <ThreadsView />
</template>
