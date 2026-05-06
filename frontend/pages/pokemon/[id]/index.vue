<script setup lang="ts">
import PokemonDetail from '../../../src/views/PokemonDetail.vue';

definePageMeta({
  name: 'pokemon-detail',
  seo: { titleKey: 'pages.pokemon.detailKicker', descriptionKey: 'pages.pokemon.subtitle' }
});
</script>

<template>
  <PokemonDetail />
</template>
