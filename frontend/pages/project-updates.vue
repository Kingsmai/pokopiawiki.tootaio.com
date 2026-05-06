<script setup lang="ts">
import ProjectUpdatesView from '../src/views/ProjectUpdatesView.vue';

definePageMeta({
  name: 'project-updates',
  seo: {
    titleKey: 'pages.projectUpdates.title',
    descriptionKey: 'pages.projectUpdates.subtitle',
    canonicalPath: '/project-updates'
  }
});
</script>

<template>
  <ProjectUpdatesView />
</template>
