<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditHistoryPanel from '../components/EditHistoryPanel.vue';
import EntityDiscussionPanel from '../components/EntityDiscussionPanel.vue';
import EntityChips from '../components/EntityChips.vue';
import PageHeader from '../components/PageHeader.vue';
import PokeBallMark from '../components/PokeBallMark.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import { iconBack, iconEdit, iconHabitat } from '../icons';
import { applySeo, resolvedSeoHead, resolveSeo } from '../seo';
import { api, type AuthUser, type HabitatDetail } from '../services/api';
import HabitatEdit from './HabitatEdit.vue';

const route = useRoute();
const { t, locale } = useI18n();
const habitat = ref<HabitatDetail | null>(null);
const currentUser = ref<AuthUser | null>(null);
const detailTab = ref('details');
const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];
const habitatDetailRouteNames = new Set(['habitat-detail', 'habitat-edit']);
const showEditor = computed(() => route.name === 'habitat-edit');
const canUpdateHabitat = computed(() => currentUser.value?.permissions.includes('habitats.update') === true);
const listPath = computed(() => (habitat.value?.isEventItem ? '/event-habitats' : '/habitats'));
const detailKicker = computed(() => t(habitat.value?.isEventItem ? 'pages.eventHabitats.detailKicker' : 'pages.habitats.detailKicker'));
const detailTabs = computed<TabOption[]>(() => [
  { value: 'details', label: t('common.details') },
  { value: 'discussion', label: t('discussion.title') },
  { value: 'history', label: t('history.editHistory') }
]);

const { data: initialHabitat } = await useAsyncData<HabitatDetail | null>(
  `habitat-detail:${activeHabitatRouteId() ?? 'none'}:${locale.value}`,
  async () => {
    const routeId = activeHabitatRouteId();
    if (!routeId) {
      return null;
    }

    try {
      return await api.habitatDetail(routeId);
    } catch {
      return null;
    }
  },
  { default: () => null }
);

const initialHabitatLoaded = ref(false);
if (initialHabitat.value) {
  habitat.value = initialHabitat.value;
  initialHabitatLoaded.value = true;
}

const habitatSeo = computed(() =>
  habitat.value && route.meta.editorModal !== true
    ? resolveSeo({
        title: `${habitat.value.name} - ${t(habitat.value.isEventItem ? 'pages.eventHabitats.title' : 'pages.habitats.title')}`,
        description: t('seo.habitatDetailDescription', { name: habitat.value.name }),
        canonicalPath: `/habitats/${habitat.value.id}`,
        image: habitat.value.image?.url
      })
    : null
);

useHead(() => (habitatSeo.value ? resolvedSeoHead(habitatSeo.value) : {}));

function applyInitialHabitat(value: HabitatDetail | null | undefined) {
  if (!value || initialHabitatLoaded.value) return;

  habitat.value = value;
  initialHabitatLoaded.value = true;
}

type PokemonRow = {
  id: number;
  name: string;
  image: HabitatDetail['pokemon'][number]['image'];
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

function activeHabitatRouteId(): string | null {
  return typeof route.name === 'string' &&
    habitatDetailRouteNames.has(route.name) &&
    typeof route.params.id === 'string' &&
    route.params.id.trim() !== ''
    ? route.params.id
    : null;
}

const pokemonRows = computed<PokemonRow[]>(() => {
  if (!habitat.value) return [];

  const rows = new Map<
    string,
    {
      id: number;
      name: string;
      image: HabitatDetail['pokemon'][number]['image'];
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
      image: pokemon.image,
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
    image: row.image,
    timeOfDays: sortByOrder(row.timeOfDays, timeOfDays),
    weathers: sortByOrder(row.weathers, weathers),
    rarity: row.rarity,
    maps: [...row.maps]
  }));
});

async function loadHabitatDetail() {
  const routeId = activeHabitatRouteId();
  if (!routeId) {
    initialHabitatLoaded.value = true;
    return;
  }

  try {
    const nextHabitat = await api.habitatDetail(routeId);
    habitat.value = nextHabitat;
    initialHabitatLoaded.value = true;

    if (route.meta.editorModal !== true) {
      applySeo({
        title: `${nextHabitat.name} - ${t(nextHabitat.isEventItem ? 'pages.eventHabitats.title' : 'pages.habitats.title')}`,
        description: t('seo.habitatDetailDescription', { name: nextHabitat.name }),
        canonicalPath: `/habitats/${nextHabitat.id}`,
        image: nextHabitat.image?.url
      });
    }
  } catch {
    habitat.value = null;
    initialHabitatLoaded.value = true;
  }
}

onMounted(async () => {
  try {
    currentUser.value = (await api.me()).user;
  } catch {
    currentUser.value = null;
  }

  if (!initialHabitatLoaded.value) {
    await loadHabitatDetail();
  }
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
    if (!activeHabitatRouteId()) {
      return;
    }

    habitat.value = null;
    detailTab.value = 'details';
    void loadHabitatDetail();
  }
);

watch(initialHabitat, applyInitialHabitat, { immediate: true });
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
      <template #kicker>{{ detailKicker }}</template>
      <template #actions>
        <RouterLink v-if="canUpdateHabitat" class="ui-button ui-button--primary ui-button--small" :to="`/habitats/${habitat.id}/edit`">
          <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
          {{ t('common.edit') }}
        </RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="listPath">
          <Icon :icon="iconBack" class="ui-icon" aria-hidden="true" />
          {{ t('common.backToList') }}
        </RouterLink>
      </template>
    </PageHeader>

    <div class="detail-tabs">
      <Tabs id="habitat-detail-tabs" v-model="detailTab" :tabs="detailTabs" :label="t('common.details')" />

      <div v-if="detailTab === 'details'" class="detail-grid detail-grid--stack">
        <div class="entity-profile-grid">
          <section class="detail-section entity-profile-media-section" :aria-label="t('media.image')">
            <div class="entity-detail-image">
              <div class="entity-detail-image__frame" :class="{ 'entity-detail-image__frame--placeholder': !habitat.image }">
                <img v-if="habitat.image" :src="habitat.image.url" :alt="t('media.imageAlt', { name: habitat.name })" />
                <span v-else class="entity-card__mark entity-detail-image__mark" role="img" :aria-label="t('media.imageEmpty')">
                  <Icon :icon="iconHabitat" class="entity-card__icon" aria-hidden="true" />
                </span>
              </div>
            </div>
          </section>

          <div class="entity-profile-main">
            <section class="detail-section entity-profile-overview" :aria-label="t('common.details')">
              <dl class="entity-profile-facts">
                <div>
                  <dt>{{ t('pages.habitats.recipeList') }}</dt>
                  <dd>{{ habitat.recipe.length }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.habitats.possiblePokemon') }}</dt>
                  <dd>{{ pokemonRows.length }}</dd>
                </div>
              </dl>

              <div class="entity-profile-group">
                <h3 class="section-subtitle">{{ t('pages.habitats.recipeList') }}</h3>
                <EntityChips v-if="habitat.recipe.length" :items="habitat.recipe" />
                <p v-else class="meta-line">{{ t('common.none') }}</p>
              </div>
            </section>
          </div>
        </div>

        <DetailSection :title="t('pages.habitats.possiblePokemon')">
          <ul v-if="pokemonRows.length" class="row-list appearance-list appearance-list--with-media">
            <li v-for="item in pokemonRows" :key="`${item.id}-${item.rarity}`">
              <span class="related-entity-media related-entity-media--appearance related-entity-media--pokemon" aria-hidden="true">
                <img v-if="item.image" :src="item.image.url" alt="" loading="lazy" />
                <PokeBallMark v-else size="24px" />
              </span>
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
          <p v-else class="meta-line">{{ t('common.none') }}</p>
        </DetailSection>
      </div>

      <div v-else-if="detailTab === 'discussion'" class="detail-tab-panel">
        <EntityDiscussionPanel entity-type="habitats" :entity-id="habitat.id" />
      </div>

      <div v-else class="detail-tab-panel">
        <EditHistoryPanel :entity="habitat" :history="habitat.editHistory" />
      </div>
    </div>
  </section>

  <HabitatEdit v-if="showEditor" />
</template>
