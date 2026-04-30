<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import { api, type RecipeDetail } from '../services/api';

const route = useRoute();
const recipe = ref<RecipeDetail | null>(null);

onMounted(async () => {
  recipe.value = await api.recipeDetail(String(route.params.id));
});
</script>

<template>
  <p v-if="!recipe" class="status">加载中</p>
  <section v-else>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ recipe.name }}</h1>
        <p class="page-subtitle">材料单详情</p>
        <EditMeta :entity="recipe" />
      </div>
      <RouterLink class="link-button" to="/items">返回列表</RouterLink>
    </div>

    <div class="detail-grid">
      <section class="detail-section">
        <h2>入手方式</h2>
        <EntityChips :items="recipe.acquisition_methods" />
      </section>

      <section class="detail-section">
        <h2>需要材料</h2>
        <EntityChips :items="recipe.materials" />
      </section>
    </div>
  </section>
</template>
