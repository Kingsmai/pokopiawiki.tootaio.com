<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { api, type Item, type Options } from '../services/api';

const options = ref<Options | null>(null);
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
  { value: '', label: '全部' },
  ...(options.value?.itemCategories.map((item) => ({ value: String(item.id), label: item.name })) ?? [])
]);

const itemQuery = computed(() => ({
  search: search.value,
  categoryId: categoryId.value,
  usageId: usageId.value,
  tagIds: tagIds.value.join(',')
}));

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
    <PageHeader title="物品" subtitle="按分类、用途、标签查看物品。">
      <template #kicker>Bag</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" to="/items/new">新增</RouterLink>
      </template>
    </PageHeader>

    <Tabs v-if="options" id="item-category" v-model="categoryId" :tabs="categoryTabs" label="分类" />
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
        <label for="item-search">搜索</label>
        <input id="item-search" v-model="search" type="search" placeholder="名称" />
      </div>

      <div class="field">
        <label for="usage">用途</label>
        <TagsSelect
          id="usage"
          v-model="usageId"
          :options="options.itemUsages"
          :multiple="false"
          placeholder="全部"
          search-placeholder="搜索用途"
        />
      </div>

      <div class="field">
        <label for="tags">标签</label>
        <TagsSelect id="tags" v-model="tagIds" :options="options.itemTags" placeholder="搜索标签" />
      </div>
    </FilterPanel>
    <FilterPanel v-else class="filter-panel--skeleton" aria-hidden="true">
      <div v-for="(width, index) in filterSkeletonWidths" :key="index" class="field">
        <Skeleton :width="width" />
        <Skeleton variant="box" height="44px" />
      </div>
    </FilterPanel>

    <div v-if="loading" class="entity-grid" aria-busy="true" aria-label="正在加载列表">
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
        marker="＋"
      >
        <EditMeta :entity="item" />
        <EntityChips :items="item.tags" />
      </EntityCard>
    </div>
  </section>
</template>
