<script setup lang="ts">
import { onMounted, ref } from 'vue';
import EntityChips from '../components/EntityChips.vue';
import { api, type Habitat } from '../services/api';

const habitats = ref<Habitat[]>([]);
const loading = ref(true);

onMounted(async () => {
  habitats.value = await api.habitats();
  loading.value = false;
});
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">栖息地</h1>
        <p class="page-subtitle">查看配方和可能出现的宝可梦。</p>
      </div>
    </div>

    <p v-if="loading" class="status">加载中</p>
    <div v-else class="grid">
      <RouterLink v-for="item in habitats" :key="item.id" class="entity-card" :to="`/habitats/${item.id}`">
        <h2>{{ item.name }}</h2>
        <EntityChips :items="item.recipe" />
        <EntityChips :items="item.pokemon ?? []" />
      </RouterLink>
    </div>
  </section>
</template>
