<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { iconAdd } from '../icons';
import { api, type Options, type Pokemon } from '../services/api';
import PokemonEdit from './PokemonEdit.vue';

const options = ref<Options | null>(null);
const route = useRoute();
const { t } = useI18n();
const pokemon = ref<Pokemon[]>([]);
const loading = ref(true);
const search = ref('');
const environmentId = ref('');
const skillIds = ref<string[]>([]);
const skillMode = ref<'any' | 'all'>('any');
const favoriteThingIds = ref<string[]>([]);
const favoriteThingMode = ref<'any' | 'all'>('any');
const filterSkeletonWidths = ['52px', '92px', '48px', '72px'];
const skeletonCardCount = 6;

const query = computed(() => ({
  search: search.value,
  environmentId: environmentId.value,
  skillIds: skillIds.value.join(','),
  skillMode: skillMode.value,
  favoriteThingIds: favoriteThingIds.value.join(','),
  favoriteThingMode: favoriteThingMode.value
}));
const showEditor = computed(() => route.name === 'pokemon-new');

async function loadPokemon() {
  loading.value = true;
  pokemon.value = await api.pokemon(query.value);
  loading.value = false;
}

onMounted(async () => {
  options.value = await api.options();
  await loadPokemon();
});

watch(query, loadPokemon);
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="t('pages.pokemon.title')" :subtitle="t('pages.pokemon.subtitle')">
      <template #kicker>Pokédex</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" to="/pokemon/new">
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

    <div v-if="loading" class="entity-grid" aria-busy="true" :aria-label="t('pages.pokemon.loadingList')">
      <article v-for="index in skeletonCardCount" :key="index" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="42px" height="42px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="76%" height="24px" />
          <Skeleton width="58%" />
          <Skeleton width="68%" />
          <div class="skeleton-chip-row">
            <Skeleton v-for="chipIndex in 2" :key="`skills-${chipIndex}`" width="64px" class="skeleton-chip" />
          </div>
          <div class="skeleton-chip-row">
            <Skeleton v-for="chipIndex in 3" :key="`things-${chipIndex}`" width="72px" class="skeleton-chip" />
          </div>
        </div>
      </article>
    </div>
    <div v-else class="entity-grid">
      <EntityCard
        v-for="item in pokemon"
        :key="item.id"
        :title="`#${item.id} ${item.name}`"
        :subtitle="t('pages.pokemon.environmentPrefix', { name: item.environment.name })"
        :to="`/pokemon/${item.id}`"
      >
        <EditMeta :entity="item" />
        <EntityChips v-if="item.types.length" :items="item.types" />
        <EntityChips :items="item.skills" />
        <EntityChips :items="item.favorite_things" />
      </EntityCard>
    </div>

    <PokemonEdit v-if="showEditor" />
  </section>
</template>
