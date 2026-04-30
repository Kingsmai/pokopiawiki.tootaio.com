<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import EntityCard from '../components/EntityCard.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import { api, type Options, type Recipe } from '../services/api';

const options = ref<Options | null>(null);
const recipes = ref<Recipe[]>([]);
const loading = ref(true);
const categoryId = ref('');

const categorySkeletonWidths = ['64px', '92px', '78px', '104px', '86px'];
const skeletonCardCount = 6;

const categoryTabs = computed<TabOption[]>(() => [
  { value: '', label: '全部' },
  ...(options.value?.itemCategories.map((item) => ({ value: String(item.id), label: item.name })) ?? [])
]);

const recipeQuery = computed(() => ({
  categoryId: categoryId.value
}));

async function loadRecipes() {
  loading.value = true;
  recipes.value = await api.recipes(recipeQuery.value);
  loading.value = false;
}

onMounted(async () => {
  options.value = await api.options();
  await loadRecipes();
});

watch(recipeQuery, loadRecipes);
</script>

<template>
  <section class="page-stack">
    <PageHeader title="材料单" subtitle="按分类浏览材料单和需要材料。">
      <template #kicker>Recipes</template>
    </PageHeader>

    <Tabs v-if="options" id="recipe-category" v-model="categoryId" :tabs="categoryTabs" label="分类" />
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

    <div v-if="loading" class="entity-grid" aria-busy="true" aria-label="正在加载材料单列表">
      <article v-for="index in skeletonCardCount" :key="`recipe-skeleton-${index}`" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="42px" height="42px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="72%" height="24px" />
          <Skeleton width="64%" />
          <div class="skeleton-chip-row">
            <Skeleton
              v-for="chipIndex in 2"
              :key="chipIndex"
              :width="chipIndex === 1 ? '74px' : '58px'"
              class="skeleton-chip"
            />
          </div>
        </div>
      </article>
    </div>

    <div v-else class="entity-grid">
      <EntityCard v-for="item in recipes" :key="item.id" :title="item.name" :to="`/recipes/${item.id}`" marker="▦">
        <EditMeta :entity="item" />
        <EntityChips :items="item.materials" />
      </EntityCard>
    </div>
  </section>
</template>
