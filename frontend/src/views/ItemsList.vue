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
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { iconAdd, iconItem } from '../icons';
import { api, type Item, type Options } from '../services/api';
import ItemEdit from './ItemEdit.vue';

const options = ref<Options | null>(null);
const route = useRoute();
const { t } = useI18n();
const items = ref<Item[]>([]);
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
  tagIds: tagIds.value.join(',')
}));
const showEditor = computed(() => route.name === 'item-new');

async function loadItems() {
  loading.value = true;
  items.value = await api.items(itemQuery.value);
  loading.value = false;
}

onMounted(async () => {
  options.value = await api.options();
  await loadItems();
});

watch(itemQuery, loadItems);
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="t('pages.items.title')" :subtitle="t('pages.items.subtitle')">
      <template #kicker>Bag</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" to="/items/new">
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

    <div v-if="loading" class="entity-grid" aria-busy="true" :aria-label="t('pages.items.loadingList')">
      <article v-for="index in skeletonCardCount" :key="`item-skeleton-${index}`" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="42px" height="42px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="72%" height="24px" />
          <Skeleton width="52%" />
          <Skeleton width="64%" />
          <div class="skeleton-chip-row">
            <Skeleton
              v-for="chipIndex in 3"
              :key="chipIndex"
              :width="chipIndex === 1 ? '74px' : '58px'"
              class="skeleton-chip"
            />
          </div>
        </div>
      </article>
    </div>
    <div v-else class="entity-grid">
      <EntityCard
        v-for="item in items"
        :key="item.id"
        :title="item.name"
        :subtitle="item.usage ? `${item.category.name} · ${item.usage.name}` : item.category.name"
        :to="`/items/${item.id}`"
        :icon="iconItem"
      >
        <EditMeta :entity="item" />
        <EntityChips :items="item.tags" />
      </EntityCard>
    </div>

    <ItemEdit v-if="showEditor" />
  </section>
</template>
