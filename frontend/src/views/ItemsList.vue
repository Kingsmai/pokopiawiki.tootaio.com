<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { api, type Item, type Options, type Recipe } from '../services/api';

const tab = ref<'items' | 'recipes'>('items');
const options = ref<Options | null>(null);
const items = ref<Item[]>([]);
const recipes = ref<Recipe[]>([]);
const loading = ref(true);
const search = ref('');
const categoryId = ref('');
const usageId = ref('');
const tagIds = ref<string[]>([]);

const itemQuery = computed(() => ({
  search: search.value,
  categoryId: categoryId.value,
  usageId: usageId.value,
  tagIds: tagIds.value.join(',')
}));

async function loadItems() {
  loading.value = true;
  if (tab.value === 'items') {
    items.value = await api.items(itemQuery.value);
  } else {
    recipes.value = await api.recipes();
  }
  loading.value = false;
}

onMounted(async () => {
  options.value = await api.options();
  await loadItems();
});

watch([tab, itemQuery], loadItems);
</script>

<template>
  <section class="page-stack">
    <PageHeader title="物品 / 材料单" subtitle="按分类、用途、标签查看物品，并浏览材料单。">
      <template #kicker>Bag</template>
    </PageHeader>

    <div class="tabs" role="tablist" aria-label="物品和材料单">
      <button :class="{ active: tab === 'items' }" type="button" @click="tab = 'items'">物品</button>
      <button :class="{ active: tab === 'recipes' }" type="button" @click="tab = 'recipes'">材料单</button>
    </div>

    <FilterPanel v-if="tab === 'items' && options">
      <div class="field">
        <label for="item-search">搜索</label>
        <input id="item-search" v-model="search" type="search" placeholder="名称" />
      </div>

      <div class="field">
        <label for="category">分类</label>
        <TagsSelect
          id="category"
          v-model="categoryId"
          :options="options.itemCategories"
          :multiple="false"
          placeholder="全部"
          search-placeholder="搜索分类"
        />
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

    <StatusMessage v-if="loading" :duration="0">加载中</StatusMessage>
    <div v-else-if="tab === 'items'" class="entity-grid">
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

    <div v-else class="entity-grid">
      <EntityCard v-for="item in recipes" :key="item.id" :title="item.name" :to="`/recipes/${item.id}`" marker="▦">
        <EditMeta :entity="item" />
        <EntityChips :items="item.materials" />
      </EntityCard>
    </div>
  </section>
</template>
