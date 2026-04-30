<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
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
  <section v-if="!habitat" class="page-stack" aria-busy="true" aria-label="正在加载栖息地详情">
    <div class="page-header page-header--skeleton" aria-hidden="true">
      <div class="page-header__copy">
        <Skeleton width="132px" />
        <Skeleton width="240px" height="46px" />
        <Skeleton width="120px" />
        <Skeleton width="300px" />
      </div>
      <div class="page-header__actions">
        <Skeleton variant="box" width="88px" height="36px" />
      </div>
    </div>

    <div class="detail-grid" aria-hidden="true">
      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="92px" height="24px" />
        </div>
        <div class="detail-section__body">
          <div class="skeleton-chip-row">
            <Skeleton v-for="index in 4" :key="index" width="76px" class="skeleton-chip" />
          </div>
        </div>
      </section>

      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="148px" height="24px" />
        </div>
        <div class="detail-section__body">
          <ul class="row-list appearance-list skeleton-row-list">
            <li v-for="index in 3" :key="index" class="skeleton-appearance-row">
              <Skeleton width="104px" />
              <div class="skeleton-summary">
                <div v-for="line in 4" :key="line">
                  <Skeleton width="56px" />
                  <Skeleton :width="line === 4 ? '72%' : '46%'" />
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </section>
  <section v-else class="page-stack">
    <PageHeader :title="habitat.name" subtitle="栖息地详情">
      <template #kicker>Habitat Detail</template>
      <template #meta>
        <EditMeta :entity="habitat" />
      </template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" :to="`/habitats/${habitat.id}/edit`">编辑</RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/habitats">返回列表</RouterLink>
      </template>
    </PageHeader>

    <div class="detail-grid">
      <DetailSection title="配方列表">
        <EntityChips :items="habitat.recipe" />
      </DetailSection>

      <DetailSection title="可能出现的宝可梦">
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
      </DetailSection>
    </div>
  </section>
</template>
