<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import { api, type RecipeDetail } from '../services/api';

const route = useRoute();
const recipe = ref<RecipeDetail | null>(null);

onMounted(async () => {
  recipe.value = await api.recipeDetail(String(route.params.id));
});
</script>

<template>
  <section v-if="!recipe" class="page-stack" aria-busy="true" aria-label="正在加载材料单详情">
    <div class="page-header page-header--skeleton" aria-hidden="true">
      <div class="page-header__copy">
        <Skeleton width="112px" />
        <Skeleton width="260px" height="46px" />
        <Skeleton width="128px" />
        <Skeleton width="300px" />
      </div>
      <div class="page-header__actions">
        <Skeleton variant="box" width="88px" height="36px" />
      </div>
    </div>

    <div class="detail-grid" aria-hidden="true">
      <section v-for="index in 2" :key="index" class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton :width="index === 1 ? '92px' : '88px'" height="24px" />
        </div>
        <div class="detail-section__body">
          <div class="skeleton-chip-row">
            <Skeleton v-for="chipIndex in index === 1 ? 3 : 4" :key="chipIndex" width="82px" class="skeleton-chip" />
          </div>
        </div>
      </section>
    </div>
  </section>
  <section v-else class="page-stack">
    <PageHeader :title="recipe.name" subtitle="材料单详情">
      <template #kicker>Recipe Detail</template>
      <template #meta>
        <EditMeta :entity="recipe" />
      </template>
      <template #actions>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/items">返回列表</RouterLink>
      </template>
    </PageHeader>

    <div class="detail-grid">
      <DetailSection title="入手方式">
        <EntityChips :items="recipe.acquisition_methods" />
      </DetailSection>

      <DetailSection title="需要材料">
        <EntityChips :items="recipe.materials" />
      </DetailSection>
    </div>
  </section>
</template>
