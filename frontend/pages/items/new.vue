<script setup lang="ts">
import ItemsList from '../../src/views/ItemsList.vue';

definePageMeta({
  name: 'item-new',
  requiredPermission: 'items.create',
  editorModal: true,
  seo: { titleKey: 'pages.items.newTitle', descriptionKey: 'pages.items.editSubtitle', canonicalPath: '/items', noindex: true }
});
</script>

<template>
  <ItemsList :event-only="false" />
</template>
