<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import EntityChips from '../components/EntityChips.vue';
import { api, type HabitatDetail } from '../services/api';

const route = useRoute();
const habitat = ref<HabitatDetail | null>(null);

onMounted(async () => {
  habitat.value = await api.habitatDetail(String(route.params.id));
});
</script>

<template>
  <p v-if="!habitat" class="status">加载中</p>
  <section v-else>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ habitat.name }}</h1>
        <p class="page-subtitle">栖息地详情</p>
      </div>
      <RouterLink class="link-button" to="/habitats">返回列表</RouterLink>
    </div>

    <div class="detail-grid">
      <section class="detail-section">
        <h2>配方列表</h2>
        <EntityChips :items="habitat.recipe" />
      </section>

      <section class="detail-section">
        <h2>可能出现的宝可梦</h2>
        <ul class="row-list">
          <li v-for="item in habitat.pokemon" :key="`${item.id}-${item.map.id}-${item.time_of_day}`">
            <RouterLink :to="`/pokemon/${item.id}`">{{ item.name }}</RouterLink>
            <span>{{ item.time_of_day }} · {{ item.weather }} · {{ item.rarity }} 星 · {{ item.map.name }}</span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
