<script setup lang="ts">
import { onMounted, ref } from 'vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import EntityCard from '../components/EntityCard.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import { api, type Habitat } from '../services/api';

const habitats = ref<Habitat[]>([]);
const loading = ref(true);
const skeletonCardCount = 6;

onMounted(async () => {
  habitats.value = await api.habitats();
  loading.value = false;
});
</script>

<template>
  <section class="page-stack">
    <PageHeader title="栖息地" subtitle="查看配方和可能出现的宝可梦。">
      <template #kicker>Habitats</template>
    </PageHeader>

    <div v-if="loading" class="entity-grid" aria-busy="true" aria-label="正在加载栖息地列表">
      <article v-for="index in skeletonCardCount" :key="index" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="42px" height="42px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="68%" height="24px" />
          <Skeleton width="66%" />
          <div class="skeleton-chip-row">
            <Skeleton v-for="chipIndex in 3" :key="`recipe-${chipIndex}`" width="70px" class="skeleton-chip" />
          </div>
          <div class="skeleton-chip-row">
            <Skeleton v-for="chipIndex in 2" :key="`pokemon-${chipIndex}`" width="82px" class="skeleton-chip" />
          </div>
        </div>
      </article>
    </div>
    <div v-else class="entity-grid">
      <EntityCard v-for="item in habitats" :key="item.id" :title="item.name" :to="`/habitats/${item.id}`" marker="◎">
        <EditMeta :entity="item" />
        <EntityChips :items="item.recipe" />
        <EntityChips :items="item.pokemon ?? []" />
      </EntityCard>
    </div>
  </section>
</template>
