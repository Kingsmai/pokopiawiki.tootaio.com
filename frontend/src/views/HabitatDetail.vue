<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditHistoryPanel from '../components/EditHistoryPanel.vue';
import EntityChips from '../components/EntityChips.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import { api, type HabitatDetail } from '../services/api';
import HabitatEdit from './HabitatEdit.vue';

const route = useRoute();
const { t } = useI18n();
const habitat = ref<HabitatDetail | null>(null);
const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];
const showEditor = computed(() => route.name === 'habitat-edit');

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

function timeLabel(value: string): string {
  const labels: Record<string, string> = {
    早晨: t('appearance.morning'),
    中午: t('appearance.noon'),
    傍晚: t('appearance.evening'),
    晚上: t('appearance.night')
  };
  return labels[value] ?? value;
}

function weatherLabel(value: string): string {
  const labels: Record<string, string> = {
    晴天: t('appearance.sunny'),
    阴天: t('appearance.cloudy'),
    雨天: t('appearance.rainy')
  };
  return labels[value] ?? value;
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
    maps: [...row.maps]
  }));
});

async function loadHabitatDetail() {
  habitat.value = await api.habitatDetail(String(route.params.id));
}

onMounted(async () => {
  await loadHabitatDetail();
});

watch(
  () => route.name,
  (name, oldName) => {
    if (oldName === 'habitat-edit' && name === 'habitat-detail') {
      void loadHabitatDetail();
    }
  }
);

watch(
  () => route.params.id,
  () => {
    habitat.value = null;
    void loadHabitatDetail();
  }
);
</script>

<template>
  <section v-if="!habitat" class="page-stack" aria-busy="true" :aria-label="t('pages.habitats.loadingDetail')">
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

    <div class="habitat-detail-stack" aria-hidden="true">
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
    <PageHeader :title="habitat.name" :subtitle="t('pages.habitats.detailSubtitle')">
      <template #kicker>Habitat Detail</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" :to="`/habitats/${habitat.id}/edit`">{{ t('common.edit') }}</RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/habitats">{{ t('common.backToList') }}</RouterLink>
      </template>
    </PageHeader>

    <div class="detail-with-sidebar">
      <div class="habitat-detail-stack">
        <DetailSection :title="t('pages.habitats.recipeList')">
          <EntityChips :items="habitat.recipe" />
        </DetailSection>

        <DetailSection :title="t('pages.habitats.possiblePokemon')">
          <ul class="row-list appearance-list">
            <li v-for="item in pokemonRows" :key="`${item.id}-${item.rarity}`">
              <RouterLink class="appearance-name" :to="`/pokemon/${item.id}`">{{ item.name }}</RouterLink>
              <dl class="appearance-summary">
                <div>
                  <dt>{{ t('appearance.time') }}</dt>
                  <dd>{{ item.timeOfDays.map(timeLabel).join(' / ') }}</dd>
                </div>
                <div>
                  <dt>{{ t('appearance.weather') }}</dt>
                  <dd>{{ item.weathers.map(weatherLabel).join(' / ') }}</dd>
                </div>
                <div>
                  <dt>{{ t('appearance.rarity') }}</dt>
                  <dd>{{ t('appearance.stars', { count: item.rarity }) }}</dd>
                </div>
                <div>
                  <dt>{{ t('appearance.maps') }}</dt>
                  <dd>{{ item.maps.join(' / ') }}</dd>
                </div>
              </dl>
            </li>
          </ul>
        </DetailSection>
      </div>

      <EditHistoryPanel :entity="habitat" :history="habitat.editHistory" />
    </div>
  </section>

  <HabitatEdit v-if="showEditor" />
</template>
