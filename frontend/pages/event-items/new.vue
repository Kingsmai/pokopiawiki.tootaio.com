<script setup lang="ts">
import ItemsList from '../../src/views/ItemsList.vue';

definePageMeta({
  name: 'event-item-new',
  requiredPermission: 'items.create',
  editorModal: true,
  seo: { titleKey: 'pages.eventItems.newTitle', descriptionKey: 'pages.eventItems.editSubtitle', canonicalPath: '/event-items', noindex: true }
});
</script>

<template>
  <ItemsList :event-only="true" />
</template>
