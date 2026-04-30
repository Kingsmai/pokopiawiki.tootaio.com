<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import PageHeader from '../components/PageHeader.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { api, type ItemDetail } from '../services/api';

const route = useRoute();
const item = ref<ItemDetail | null>(null);

const customization = computed(() => {
  if (!item.value) {
    return [];
  }

  return [
    item.value.customization.dyeable ? '可染色' : '',
    item.value.customization.dualDyeable ? '可双区染色' : '',
    item.value.customization.patternEditable ? '可改花纹' : ''
  ].filter(Boolean);
});

onMounted(async () => {
  item.value = await api.itemDetail(String(route.params.id));
});
</script>

<template>
  <StatusMessage v-if="!item" :duration="0">加载中</StatusMessage>
  <section v-else class="page-stack">
    <PageHeader :title="item.name" :subtitle="item.usage ? `${item.category.name} · ${item.usage.name}` : item.category.name">
      <template #kicker>Item Detail</template>
      <template #meta>
        <EditMeta :entity="item" />
      </template>
      <template #actions>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/items">返回列表</RouterLink>
      </template>
    </PageHeader>

    <div class="detail-grid">
      <DetailSection title="入手方式">
        <EntityChips :items="item.acquisitionMethods" />
      </DetailSection>

      <DetailSection title="自定义">
        <div v-if="customization.length" class="chips">
          <span v-for="entry in customization" :key="entry" class="chip">{{ entry }}</span>
        </div>
        <p v-else class="meta-line">无</p>
      </DetailSection>

      <DetailSection title="标签">
        <EntityChips :items="item.tags" />
      </DetailSection>

      <DetailSection title="材料单信息">
        <template v-if="item.recipe">
          <RouterLink :to="`/recipes/${item.recipe.id}`">{{ item.recipe.name }}</RouterLink>
          <EntityChips :items="item.recipe.materials" />
        </template>
        <p v-else class="meta-line">无</p>
      </DetailSection>

      <DetailSection title="相关栖息地">
        <ul class="row-list">
          <li v-for="habitat in item.relatedHabitats" :key="habitat.id">
            <RouterLink :to="`/habitats/${habitat.id}`">{{ habitat.name }}</RouterLink>
            <span>× {{ habitat.quantity }}</span>
          </li>
        </ul>
      </DetailSection>
    </div>
  </section>
</template>
