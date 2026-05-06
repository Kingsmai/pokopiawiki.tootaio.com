<script setup lang="ts">
import PokemonList from '../../src/views/PokemonList.vue';

definePageMeta({
  name: 'event-pokemon-list',
  seo: { titleKey: 'pages.eventPokemon.title', descriptionKey: 'pages.eventPokemon.subtitle', canonicalPath: '/event-pokemon' }
});
</script>

<template>
  <PokemonList :event-only="true" />
</template>
