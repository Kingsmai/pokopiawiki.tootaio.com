<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import { api, type HabitatDetail } from '../services/api';

const route = useRoute();
const habitat = ref<HabitatDetail | null>(null);
const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];

type PokemonRow = {
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

const pokemonRows = computed<PokemonRow[]>(() => {
  if (!habitat.value) return [];

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

  habitat.value.pokemon.forEach((pokemon) => {
    const key = `${pokemon.id}:${pokemon.rarity}`;
    const row = rows.get(key) ?? {
      id: pokemon.id,
      name: pokemon.name,
      timeOfDays: new Set<string>(),
      weathers: new Set<string>(),
      rarity: pokemon.rarity,
      maps: new Set<string>()
    };

    row.timeOfDays.add(pokemon.time_of_day);
    row.weathers.add(pokemon.weather);
    row.maps.add(pokemon.map.name);
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
  habitat.value = await api.habitatDetail(String(route.params.id));
});
</script>

<template>
  <p v-if="!habitat" class="status">加载中</p>
  <section v-else>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ habitat.name }}</h1>
        <p class="page-subtitle">栖息地详情</p>
        <EditMeta :entity="habitat" />
      </div>
      <RouterLink class="link-button" to="/habitats">返回列表</RouterLink>
    </div>

    <div class="detail-grid">
      <section class="detail-section">
        <h2>配方列表</h2>
        <EntityChips :items="habitat.recipe" />
      </section>

      <section class="detail-section">
        <h2>可能出现的宝可梦</h2>
        <ul class="row-list appearance-list">
          <li v-for="item in pokemonRows" :key="`${item.id}-${item.rarity}`">
            <RouterLink class="appearance-name" :to="`/pokemon/${item.id}`">{{ item.name }}</RouterLink>
            <dl class="appearance-summary">
              <div>
                <dt>时段</dt>
                <dd>{{ item.timeOfDays.join(' / ') }}</dd>
              </div>
              <div>
                <dt>天气</dt>
                <dd>{{ item.weathers.join(' / ') }}</dd>
              </div>
              <div>
                <dt>稀有度</dt>
                <dd>{{ item.rarity }} 星</dd>
              </div>
              <div>
                <dt>出现地图</dt>
                <dd>{{ item.maps.join(' / ') }}</dd>
              </div>
            </dl>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
