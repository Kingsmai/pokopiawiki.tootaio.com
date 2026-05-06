<script setup lang="ts">
import PokemonList from '../../src/views/PokemonList.vue';

definePageMeta({
  name: 'pokemon-new',
  requiredPermission: 'pokemon.create',
  editorModal: true,
  seo: { titleKey: 'pages.pokemon.newTitle', descriptionKey: 'pages.pokemon.editSubtitle', canonicalPath: '/pokemon', noindex: true }
});
</script>

<template>
  <PokemonList :event-only="false" />
</template>
