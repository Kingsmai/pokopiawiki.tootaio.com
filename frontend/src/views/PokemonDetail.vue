<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import { api, type PokemonDetail } from '../services/api';

const route = useRoute();
const pokemon = ref<PokemonDetail | null>(null);
const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];

type HabitatRow = {
  id: number;
  name: string;
  timeOfDays: string[];
  weathers: string[];
  rarity: number;
  maps: string[];
};

function sortByOrder(values: Set<string>, order: string[]) {
  return [...values].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

const habitatRows = computed<HabitatRow[]>(() => {
  if (!pokemon.value) return [];

  const rows = new Map<
    string,
    {
      id: number;
      name: string;
      timeOfDays: Set<string>;
      weathers: Set<string>;
      rarity: number;
      maps: Set<string>;
    }
  >();

  pokemon.value.habitats.forEach((habitat) => {
    const key = `${habitat.id}:${habitat.rarity}`;
    const row = rows.get(key) ?? {
      id: habitat.id,
      name: habitat.name,
      timeOfDays: new Set<string>(),
      weathers: new Set<string>(),
      rarity: habitat.rarity,
      maps: new Set<string>()
    };

    row.timeOfDays.add(habitat.time_of_day);
    row.weathers.add(habitat.weather);
    row.maps.add(habitat.map.name);
    rows.set(key, row);
  });

  return [...rows.values()].map((row) => ({
    id: row.id,
    name: row.name,
    timeOfDays: sortByOrder(row.timeOfDays, timeOfDays),
    weathers: sortByOrder(row.weathers, weathers),
    rarity: row.rarity,
    maps: [...row.maps].sort((a, b) => a.localeCompare(b))
  }));
});

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
        <EditMeta :entity="pokemon" />
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
        <ul class="row-list appearance-list">
          <li v-for="habitat in habitatRows" :key="`${habitat.id}-${habitat.rarity}`">
            <RouterLink class="appearance-name" :to="`/habitats/${habitat.id}`">{{ habitat.name }}</RouterLink>
            <dl class="appearance-summary">
              <div>
                <dt>时段</dt>
                <dd>{{ habitat.timeOfDays.join(' / ') }}</dd>
              </div>
              <div>
                <dt>天气</dt>
                <dd>{{ habitat.weathers.join(' / ') }}</dd>
              </div>
              <div>
                <dt>稀有度</dt>
                <dd>{{ habitat.rarity }} 星</dd>
              </div>
              <div>
                <dt>出现地图</dt>
                <dd>{{ habitat.maps.join(' / ') }}</dd>
              </div>
            </dl>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
