<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import EntityChips from '../components/EntityChips.vue';
import { api, type PokemonDetail } from '../services/api';

const route = useRoute();
const pokemon = ref<PokemonDetail | null>(null);

onMounted(async () => {
  pokemon.value = await api.pokemonDetail(String(route.params.id));
});
</script>

<template>
  <p v-if="!pokemon" class="status">加载中</p>
  <section v-else>
    <div class="page-header">
      <div>
        <h1 class="page-title">#{{ pokemon.id }} {{ pokemon.name }}</h1>
        <p class="page-subtitle">喜欢的环境：{{ pokemon.environment.name }}</p>
      </div>
      <RouterLink class="link-button" to="/pokemon">返回列表</RouterLink>
    </div>

    <div class="detail-grid">
      <section class="detail-section">
        <h2>特长</h2>
        <EntityChips :items="pokemon.skills" />
      </section>

      <section class="detail-section">
        <h2>喜欢的东西</h2>
        <EntityChips :items="pokemon.favorite_things" />
      </section>

      <section class="detail-section">
        <h2>栖息地</h2>
        <ul class="row-list">
          <li v-for="habitat in pokemon.habitats" :key="`${habitat.id}-${habitat.map.id}-${habitat.time_of_day}`">
            <RouterLink :to="`/habitats/${habitat.id}`">{{ habitat.name }}</RouterLink>
            <span>{{ habitat.time_of_day }} · {{ habitat.weather }} · {{ habitat.rarity }} 星 · {{ habitat.map.name }}</span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
