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
import { iconAdd, iconItem } from '../icons';
import { api, getAuthToken, type AuthUser, type Item, type Options } from '../services/api';
import ItemEdit from './ItemEdit.vue';

const props = defineProps<{
  eventOnly?: boolean;
}>();

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
const pageTitle = computed(() => (props.eventOnly ? t('pages.eventItems.title') : t('pages.items.title')));
const pageSubtitle = computed(() => (props.eventOnly ? t('pages.eventItems.subtitle') : t('pages.items.subtitle')));
const pageKicker = computed(() => (props.eventOnly ? t('pages.eventItems.kicker') : t('pages.items.kicker')));
const createTarget = computed(() => (props.eventOnly ? '/event-items/new' : '/items/new'));

const categoryTabs = computed<TabOption[]>(() => [
  { value: '', label: t('common.all') },
  ...(options.value?.itemCategories.map((item) => ({ value: String(item.id), label: item.name })) ?? [])
]);

const itemQuery = computed(() => ({
  search: search.value,
  categoryId: categoryId.value,
  usageId: usageId.value,
  tagIds: tagIds.value.join(','),
  isEventItem: props.eventOnly
}));
const showEditor = computed(() => route.name === 'item-new' || route.name === 'event-item-new');
const canCreateItem = computed(() => currentUser.value?.permissions.includes('items.create') === true);

function itemCardImage(item: Item) {
  return item.image ? { src: item.image.url, alt: t('media.imageAlt', { name: item.name }) } : undefined;
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
    <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
      <template #kicker>{{ pageKicker }}</template>
      <template #actions>
        <RouterLink v-if="canCreateItem" class="ui-button ui-button--primary ui-button--small" :to="createTarget">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.add') }}
        </RouterLink>
      </template>
    </PageHeader>

    <Tabs v-if="options" id="item-category" v-model="categoryId" :tabs="categoryTabs" :label="t('pages.items.category')" />
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
        <label for="item-search">{{ t('common.search') }}</label>
        <input id="item-search" v-model="search" type="search" :placeholder="t('common.name')" />
      </div>

      <div class="field">
        <label for="usage">{{ t('pages.items.usage') }}</label>
        <TagsSelect
          id="usage"
          v-model="usageId"
          :options="options.itemUsages"
          :multiple="false"
          :placeholder="t('common.all')"
          :search-placeholder="t('pages.items.searchUsage')"
        />
      </div>

      <div class="field">
        <label for="tags">{{ t('pages.items.tags') }}</label>
        <TagsSelect id="tags" v-model="tagIds" :options="options.itemTags" :placeholder="t('pages.items.searchTags')" />
      </div>
    </FilterPanel>
    <FilterPanel v-else class="filter-panel--skeleton" aria-hidden="true">
      <div v-for="(width, index) in filterSkeletonWidths" :key="index" class="field">
        <Skeleton :width="width" />
        <Skeleton variant="box" height="44px" />
      </div>
    </FilterPanel>

    <div v-if="loading" class="entity-grid catalog-card-grid" aria-busy="true" :aria-label="t('pages.items.loadingList')">
      <article v-for="index in skeletonCardCount" :key="`item-skeleton-${index}`" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
          <Skeleton width="92px" />
        </div>
      </article>
    </div>
    <div v-else class="entity-grid catalog-card-grid">
      <EntityCard
        v-for="item in items"
        :key="item.id"
        :title="item.name"
        :subtitle="item.category.name"
        :to="`/items/${item.id}`"
        :icon="iconItem"
        :image="itemCardImage(item)"
        :ribbon="item.usage?.name"
      />
    </div>

    <ItemEdit v-if="showEditor" />
  </section>
</template>
