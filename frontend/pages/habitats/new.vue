<script setup lang="ts">
import HabitatList from '../../src/views/HabitatList.vue';

definePageMeta({
  name: 'habitat-new',
  requiredPermission: 'habitats.create',
  editorModal: true,
  seo: { titleKey: 'pages.habitats.newTitle', descriptionKey: 'pages.habitats.editSubtitle', canonicalPath: '/habitats', noindex: true }
});
</script>

<template>
  <HabitatList :event-only="false" />
</template>
