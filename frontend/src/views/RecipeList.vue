<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { iconAdd, iconNoRecipe, iconRecipe } from '../icons';
import { api, getAuthToken, type AuthUser, type Item, type Options } from '../services/api';
import RecipeEdit from './RecipeEdit.vue';

const options = ref<Options | null>(null);
const route = useRoute();
const { t } = useI18n();
const items = ref<Item[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const search = ref('');
const categoryId = ref('');
const usageId = ref('');
const tagIds = ref<string[]>([]);

const categorySkeletonWidths = ['64px', '92px', '78px', '104px', '86px'];
const filterSkeletonWidths = ['52px', '48px', '48px'];
const skeletonCardCount = 6;

const categoryTabs = computed<TabOption[]>(() => [
  { value: '', label: t('common.all') },
  ...(options.value?.itemCategories.map((item) => ({ value: String(item.id), label: item.name })) ?? [])
]);

const itemQuery = computed(() => ({
  search: search.value,
  categoryId: categoryId.value,
  usageId: usageId.value,
  tagIds: tagIds.value.join(','),
  recipeOrder: 1
}));
const showEditor = computed(() => route.name === 'recipe-new');
const canCreateRecipe = computed(() => currentUser.value?.permissions.includes('recipes.create') === true);

function recipeTarget(item: Item) {
  return item.recipe ? `/recipes/${item.recipe.id}` : undefined;
}

function recipeCardImage(item: Item) {
  return item.image ? { src: item.image.url, alt: t('media.imageAlt', { name: item.name }) } : undefined;
}

function createRecipeTarget(item: Item) {
  return `/recipes/new?itemId=${item.id}`;
}

function itemIcon(item: Item) {
  if (item.recipe) {
    return iconRecipe;
  }

  return item.noRecipe ? iconNoRecipe : iconAdd;
}

async function loadItems() {
  loading.value = true;
  items.value = await api.items(itemQuery.value);
  loading.value = false;
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
  await loadItems();
});

watch(itemQuery, loadItems);
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="t('pages.recipes.title')" :subtitle="t('pages.recipes.subtitle')">
      <template #kicker>Recipes</template>
      <template #actions>
        <RouterLink v-if="canCreateRecipe" class="ui-button ui-button--primary ui-button--small" to="/recipes/new">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.add') }}
        </RouterLink>
      </template>
    </PageHeader>

    <Tabs v-if="options" id="recipe-category" v-model="categoryId" :tabs="categoryTabs" :label="t('pages.items.category')" />
    <div v-else class="tabs tabs--component" aria-hidden="true">
      <div class="tab-list tab-list--skeleton">
        <Skeleton
          v-for="width in categorySkeletonWidths"
          :key="width"
          variant="box"
          :width="width"
          height="42px"
          class="skeleton-tab"
        />
      </div>
    </div>

    <FilterPanel v-if="options">
      <div class="field">
        <label for="recipe-search">{{ t('common.search') }}</label>
        <input id="recipe-search" v-model="search" type="search" :placeholder="t('common.name')" />
      </div>

      <div class="field">
        <label for="recipe-usage">{{ t('pages.items.usage') }}</label>
        <TagsSelect
          id="recipe-usage"
          v-model="usageId"
          :options="options.itemUsages"
          :multiple="false"
          :placeholder="t('common.all')"
          :search-placeholder="t('pages.items.searchUsage')"
        />
      </div>

      <div class="field">
        <label for="recipe-tags">{{ t('pages.items.tags') }}</label>
        <TagsSelect id="recipe-tags" v-model="tagIds" :options="options.itemTags" :placeholder="t('pages.items.searchTags')" />
      </div>
    </FilterPanel>
    <FilterPanel v-else class="filter-panel--skeleton" aria-hidden="true">
      <div v-for="(width, index) in filterSkeletonWidths" :key="index" class="field">
        <Skeleton :width="width" />
        <Skeleton variant="box" height="44px" />
      </div>
    </FilterPanel>

    <div v-if="loading" class="entity-grid catalog-card-grid" aria-busy="true" :aria-label="t('pages.recipes.loadingList')">
      <article v-for="index in skeletonCardCount" :key="`recipe-skeleton-${index}`" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
          <Skeleton variant="box" width="132px" height="36px" />
          <Skeleton width="92px" />
        </div>
      </article>
    </div>

    <div v-else class="entity-grid catalog-card-grid">
      <EntityCard
        v-for="item in items"
        :key="item.id"
        :title="`#${item.displayId} ${item.name}`"
        :subtitle="item.category.name"
        :to="recipeTarget(item)"
        :icon="itemIcon(item)"
        :image="recipeCardImage(item)"
        :ribbon="item.usage?.name"
      >
        <template #after-title>
          <span
            v-if="item.recipe"
            class="ui-button ui-button--primary ui-button--small catalog-card-action catalog-card-action--hidden"
            aria-hidden="true"
          >
            <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
            {{ t('pages.items.createRecipe') }}
          </span>
          <button
            v-else-if="item.noRecipe"
            class="ui-button ui-button--primary ui-button--small catalog-card-action"
            type="button"
            disabled
          >
            <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
            {{ t('pages.items.createRecipe') }}
          </button>
          <RouterLink
            v-else-if="canCreateRecipe"
            class="ui-button ui-button--primary ui-button--small catalog-card-action"
            :to="createRecipeTarget(item)"
          >
            <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
            {{ t('pages.items.createRecipe') }}
          </RouterLink>
        </template>
      </EntityCard>
    </div>

    <RecipeEdit v-if="showEditor" />
  </section>
</template>
