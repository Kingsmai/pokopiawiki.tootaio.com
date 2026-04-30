<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
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
    </div>

    <p v-if="loading" class="status">加载中</p>
    <div v-else-if="tab === 'items'" class="grid">
      <RouterLink v-for="item in items" :key="item.id" class="entity-card" :to="`/items/${item.id}`">
        <h2>{{ item.name }}</h2>
        <p class="meta-line">{{ item.usage ? `${item.category.name} · ${item.usage.name}` : item.category.name }}</p>
        <EditMeta :entity="item" />
        <EntityChips :items="item.tags" />
      </RouterLink>
    </div>

    <div v-else class="grid">
      <RouterLink v-for="item in recipes" :key="item.id" class="entity-card" :to="`/recipes/${item.id}`">
        <h2>{{ item.name }}</h2>
        <EditMeta :entity="item" />
        <EntityChips :items="item.materials" />
      </RouterLink>
    </div>
  </section>
</template>
