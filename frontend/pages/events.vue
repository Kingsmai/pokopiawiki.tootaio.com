<script setup lang="ts">
import ComingSoonView from '../src/views/ComingSoonView.vue';

definePageMeta({
  name: 'events',
  seo: { titleKey: 'pages.comingSoon.sections.events.title', descriptionKey: 'pages.comingSoon.sections.events.subtitle', noindex: true }
});
</script>

<template>
  <ComingSoonView page="events" />
</template>
