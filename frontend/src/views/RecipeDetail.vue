<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import PageHeader from '../components/PageHeader.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { api, type RecipeDetail } from '../services/api';

const route = useRoute();
const recipe = ref<RecipeDetail | null>(null);

onMounted(async () => {
  recipe.value = await api.recipeDetail(String(route.params.id));
});
</script>

<template>
  <StatusMessage v-if="!recipe" :duration="0">加载中</StatusMessage>
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
