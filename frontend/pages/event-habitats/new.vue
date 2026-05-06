<script setup lang="ts">
import HabitatList from '../../src/views/HabitatList.vue';

definePageMeta({
  name: 'event-habitat-new',
  requiredPermission: 'habitats.create',
  editorModal: true,
  seo: { titleKey: 'pages.eventHabitats.newTitle', descriptionKey: 'pages.eventHabitats.editSubtitle', canonicalPath: '/event-habitats', noindex: true }
});
</script>

<template>
  <HabitatList :event-only="true" />
</template>
