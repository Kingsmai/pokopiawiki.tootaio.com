<script setup lang="ts">
import PokemonList from '../../src/views/PokemonList.vue';

definePageMeta({
  name: 'event-pokemon-new',
  requiredPermission: 'pokemon.create',
  editorModal: true,
  seo: { titleKey: 'pages.eventPokemon.newTitle', descriptionKey: 'pages.eventPokemon.editSubtitle', canonicalPath: '/event-pokemon', noindex: true }
});
</script>

<template>
  <PokemonList :event-only="true" />
</template>
