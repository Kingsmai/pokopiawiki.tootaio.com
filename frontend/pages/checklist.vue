<script setup lang="ts">
import DailyChecklistView from '../src/views/DailyChecklistView.vue';

definePageMeta({
  name: 'checklist',
  seo: { titleKey: 'pages.checklist.title', descriptionKey: 'pages.checklist.subtitle' }
});
</script>

<template>
  <DailyChecklistView />
</template>
