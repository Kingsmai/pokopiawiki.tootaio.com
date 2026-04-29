<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import EntityChips from '../components/EntityChips.vue';
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
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">物品 / 材料单</h1>
        <p class="page-subtitle">按分类、用途、标签查看物品，并浏览材料单。</p>
      </div>
    </div>

    <div class="tabs" role="tablist" aria-label="物品和材料单">
      <button :class="{ active: tab === 'items' }" type="button" @click="tab = 'items'">物品</button>
      <button :class="{ active: tab === 'recipes' }" type="button" @click="tab = 'recipes'">材料单</button>
    </div>

    <div v-if="tab === 'items' && options" class="toolbar">
      <div class="field">
        <label for="item-search">搜索</label>
        <input id="item-search" v-model="search" type="search" placeholder="名称" />
      </div>

      <div class="field">
        <label for="category">分类</label>
        <select id="category" v-model="categoryId">
          <option value="">全部</option>
          <option v-for="item in options.itemCategories" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>

      <div class="field">
        <label for="usage">用途</label>
        <select id="usage" v-model="usageId">
          <option value="">全部</option>
          <option v-for="item in options.itemUsages" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>

      <div class="field">
        <label for="tags">标签</label>
        <select id="tags" v-model="tagIds" multiple>
          <option v-for="item in options.itemTags" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
        </select>
      </div>
    </div>

    <p v-if="loading" class="status">加载中</p>
    <div v-else-if="tab === 'items'" class="grid">
      <RouterLink v-for="item in items" :key="item.id" class="entity-card" :to="`/items/${item.id}`">
        <h2>{{ item.name }}</h2>
        <p class="meta-line">{{ item.category.name }} · {{ item.usage.name }}</p>
        <EntityChips :items="item.tags" />
      </RouterLink>
    </div>

    <div v-else class="grid">
      <RouterLink v-for="item in recipes" :key="item.id" class="entity-card" :to="`/recipes/${item.id}`">
        <h2>{{ item.name }}</h2>
        <EntityChips :items="item.materials" />
      </RouterLink>
    </div>
  </section>
</template>
