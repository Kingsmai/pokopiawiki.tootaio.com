<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import PokemonDetail from '../../../src/views/PokemonDetail.vue';

definePageMeta({
  name: 'pokemon-edit',
  requiredPermission: 'pokemon.update',
  editorModal: true,
  seo: {
    titleKey: 'pages.pokemon.editKicker',
    descriptionKey: 'pages.pokemon.editSubtitle',
    canonicalPath: (route: RouteLocationNormalizedLoaded) => `/pokemon/${String(route.params.id)}`,
    noindex: true
  }
});
</script>

<template>
  <PokemonDetail />
</template>
