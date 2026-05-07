<script setup lang="ts">
import ThreadsView from '../../src/views/ThreadsView.vue';

definePageMeta({
  name: 'threads',
  seo: { titleKey: 'pages.threads.title', descriptionKey: 'seo.threadsDescription', canonicalPath: '/threads' }
});
</script>

<template>
  <ThreadsView />
</template>
