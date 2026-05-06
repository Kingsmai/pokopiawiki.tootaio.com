<script setup lang="ts">
import AncientArtifactList from '../../src/views/AncientArtifactList.vue';

definePageMeta({
  name: 'ancient-artifact-list',
  seo: { titleKey: 'pages.ancientArtifacts.title', descriptionKey: 'pages.ancientArtifacts.subtitle' }
});
</script>

<template>
  <AncientArtifactList />
</template>
