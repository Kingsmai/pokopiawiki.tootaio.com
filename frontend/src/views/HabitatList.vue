<script setup lang="ts">
import { onMounted, ref } from 'vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import EntityCard from '../components/EntityCard.vue';
import PageHeader from '../components/PageHeader.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { api, type Habitat } from '../services/api';

const habitats = ref<Habitat[]>([]);
const loading = ref(true);

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

    <StatusMessage v-if="loading" :duration="0">加载中</StatusMessage>
    <div v-else class="entity-grid">
      <EntityCard v-for="item in habitats" :key="item.id" :title="item.name" :to="`/habitats/${item.id}`" marker="◎">
        <EditMeta :entity="item" />
        <EntityChips :items="item.recipe" />
        <EntityChips :items="item.pokemon ?? []" />
      </EntityCard>
    </div>
  </section>
</template>
