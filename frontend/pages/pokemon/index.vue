<script setup lang="ts">
import PokemonList from '../../src/views/PokemonList.vue';

definePageMeta({
  name: 'pokemon-list',
  seo: { titleKey: 'pages.pokemon.title', descriptionKey: 'pages.pokemon.subtitle' }
});
</script>

<template>
  <PokemonList :event-only="false" />
</template>
