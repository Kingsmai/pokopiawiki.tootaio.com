<script setup lang="ts">
import AncientArtifactList from '../../src/views/AncientArtifactList.vue';

definePageMeta({
  name: 'ancient-artifact-new',
  requiredPermission: 'items.create',
  editorModal: true,
  seo: {
    titleKey: 'pages.ancientArtifacts.newTitle',
    descriptionKey: 'pages.ancientArtifacts.editSubtitle',
    canonicalPath: '/ancient-artifacts',
    noindex: true
  }
});
</script>

<template>
  <AncientArtifactList />
</template>
