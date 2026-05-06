<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import LoadMoreSentinel from '../components/LoadMoreSentinel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { iconAdd } from '../icons';
import { api, getAuthToken, type AuthUser, type Options, type Pokemon } from '../services/api';
import PokemonEdit from './PokemonEdit.vue';

const props = defineProps<{
  eventOnly?: boolean;
}>();

const options = ref<Options | null>(null);
const route = useRoute();
const { t } = useI18n();
const pokemon = ref<Pokemon[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const nextCursor = ref<string | null>(null);
const hasMorePokemon = ref(false);
const search = ref('');
const environmentId = ref('');
const skillIds = ref<string[]>([]);
const skillMode = ref<'any' | 'all'>('any');
const favoriteThingIds = ref<string[]>([]);
const favoriteThingMode = ref<'any' | 'all'>('any');
const filterSkeletonWidths = ['52px', '92px', '48px', '72px'];
const skeletonCardCount = 6;
const listPageSize = 24;
let loadRequestId = 0;

const query = computed(() => ({
  search: search.value,
  isEventItem: props.eventOnly ? 'true' : 'false',
  environmentId: environmentId.value,
  skillIds: skillIds.value.join(','),
  skillMode: skillMode.value,
  favoriteThingIds: favoriteThingIds.value.join(','),
  favoriteThingMode: favoriteThingMode.value
}));
const showEditor = computed(() => route.name === 'pokemon-new' || route.name === 'event-pokemon-new');
const canCreatePokemon = computed(() => currentUser.value?.permissions.includes('pokemon.create') === true);
const pageTitle = computed(() => t(props.eventOnly ? 'pages.eventPokemon.title' : 'pages.pokemon.title'));
const pageSubtitle = computed(() => t(props.eventOnly ? 'pages.eventPokemon.subtitle' : 'pages.pokemon.subtitle'));
const pageKicker = computed(() => t(props.eventOnly ? 'pages.eventPokemon.kicker' : 'pages.pokemon.listKicker'));
const newPokemonPath = computed(() => (props.eventOnly ? '/event-pokemon/new' : '/pokemon/new'));
const loadingListLabel = computed(() => t(props.eventOnly ? 'pages.eventPokemon.loadingList' : 'pages.pokemon.loadingList'));

async function loadPokemon(reset = true) {
  if (!reset && (loading.value || loadingMore.value || !hasMorePokemon.value)) {
    return;
  }

  const requestId = ++loadRequestId;
  if (reset) {
    loading.value = true;
    loadingMore.value = false;
    nextCursor.value = null;
    hasMorePokemon.value = false;
  } else {
    loadingMore.value = true;
  }

  try {
    const page = await api.pokemonPage({
      ...query.value,
      cursor: reset ? null : nextCursor.value,
      limit: listPageSize
    });

    if (requestId !== loadRequestId) {
      return;
    }

    if (reset) {
      pokemon.value = page.items;
    } else {
      const existingIds = new Set(pokemon.value.map((item) => item.id));
      pokemon.value = [...pokemon.value, ...page.items.filter((item) => !existingIds.has(item.id))];
    }
    nextCursor.value = page.nextCursor;
    hasMorePokemon.value = page.hasMore;
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function loadMorePokemon() {
  void loadPokemon(false);
}

function pokemonCardImage(item: Pokemon) {
  return item.image ? { src: item.image.url, alt: t('pages.pokemon.imageAlt', { name: item.name, variant: item.image.variant }) } : undefined;
}

onMounted(async () => {
  if (getAuthToken()) {
    try {
      currentUser.value = (await api.me()).user;
    } catch {
      currentUser.value = null;
    }
  }
  options.value = await api.options();
  await loadPokemon();
});

watch(query, () => {
  void loadPokemon();
});
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
      <template #kicker>{{ pageKicker }}</template>
      <template #actions>
        <RouterLink v-if="canCreatePokemon" class="ui-button ui-button--primary ui-button--small" :to="newPokemonPath">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.add') }}
        </RouterLink>
      </template>
    </PageHeader>

    <FilterPanel v-if="options">
      <div class="field">
        <label for="pokemon-search">{{ t('common.search') }}</label>
        <input id="pokemon-search" v-model="search" type="search" :placeholder="t('pages.pokemon.namePlaceholder')" />
      </div>

      <div class="field">
        <label for="environment">{{ t('pages.pokemon.environment') }}</label>
        <TagsSelect
          id="environment"
          v-model="environmentId"
          :options="options.environments"
          :multiple="false"
          :placeholder="t('common.all')"
          :search-placeholder="t('pages.pokemon.searchEnvironment')"
        />
      </div>

      <div class="field">
        <label for="skills">{{ t('pages.pokemon.skills') }}</label>
        <TagsSelect id="skills" v-model="skillIds" :options="options.skills" :placeholder="t('pages.pokemon.searchSkills')" />
        <div class="segmented" :aria-label="t('pages.pokemon.skillMatchMode')">
          <button :class="{ active: skillMode === 'any' }" type="button" @click="skillMode = 'any'">{{ t('pages.pokemon.any') }}</button>
          <button :class="{ active: skillMode === 'all' }" type="button" @click="skillMode = 'all'">{{ t('pages.pokemon.all') }}</button>
        </div>
      </div>

      <div class="field">
        <label for="favorite-things">{{ t('pages.pokemon.favoriteThings') }}</label>
        <TagsSelect
          id="favorite-things"
          v-model="favoriteThingIds"
          :options="options.favoriteThings"
          :placeholder="t('pages.pokemon.searchFavoriteThings')"
        />
        <div class="segmented" :aria-label="t('pages.pokemon.favoriteThingMatchMode')">
          <button :class="{ active: favoriteThingMode === 'any' }" type="button" @click="favoriteThingMode = 'any'">
            {{ t('pages.pokemon.any') }}
          </button>
          <button :class="{ active: favoriteThingMode === 'all' }" type="button" @click="favoriteThingMode = 'all'">
            {{ t('pages.pokemon.all') }}
          </button>
        </div>
      </div>
    </FilterPanel>
    <FilterPanel v-else class="filter-panel--skeleton" aria-hidden="true">
      <div v-for="(width, index) in filterSkeletonWidths" :key="index" class="field">
        <Skeleton :width="width" />
        <Skeleton variant="box" height="44px" />
        <div v-if="index > 1" class="segmented">
          <Skeleton variant="box" width="52px" height="34px" />
          <Skeleton variant="box" width="52px" height="34px" />
        </div>
      </div>
    </FilterPanel>

    <div v-if="loading" class="entity-grid pokemon-list-grid" aria-busy="true" :aria-label="loadingListLabel">
      <article v-for="index in skeletonCardCount" :key="index" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
        </div>
      </article>
    </div>
    <div v-else class="entity-grid pokemon-list-grid">
      <EntityCard
        v-for="item in pokemon"
        :key="item.id"
        :title="`#${item.displayId} ${item.name}`"
        :to="`/pokemon/${item.id}`"
        :image="pokemonCardImage(item)"
      />
    </div>
    <div v-if="loadingMore" class="entity-grid pokemon-list-grid" aria-hidden="true">
      <article v-for="index in 2" :key="`pokemon-more-${index}`" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
        </div>
      </article>
    </div>
    <LoadMoreSentinel :active="hasMorePokemon" :disabled="loading || loadingMore" @load="loadMorePokemon" />

    <PokemonEdit v-if="showEditor" />
  </section>
</template>
