<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
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
  <p v-if="!item" class="status">加载中</p>
  <section v-else>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ item.name }}</h1>
        <p class="page-subtitle">{{ item.usage ? `${item.category.name} · ${item.usage.name}` : item.category.name }}</p>
        <EditMeta :entity="item" />
      </div>
      <RouterLink class="link-button" to="/items">返回列表</RouterLink>
    </div>

    <div class="detail-grid">
      <section class="detail-section">
        <h2>入手方式</h2>
        <EntityChips :items="item.acquisitionMethods" />
      </section>

      <section class="detail-section">
        <h2>自定义</h2>
        <div v-if="customization.length" class="chips">
          <span v-for="entry in customization" :key="entry" class="chip">{{ entry }}</span>
        </div>
        <p v-else class="meta-line">无</p>
      </section>

      <section class="detail-section">
        <h2>标签</h2>
        <EntityChips :items="item.tags" />
      </section>

      <section class="detail-section">
        <h2>材料单信息</h2>
        <template v-if="item.recipe">
          <RouterLink :to="`/recipes/${item.recipe.id}`">{{ item.recipe.name }}</RouterLink>
          <EntityChips :items="item.recipe.materials" />
        </template>
        <p v-else class="meta-line">无</p>
      </section>

      <section class="detail-section">
        <h2>相关栖息地</h2>
        <ul class="row-list">
          <li v-for="habitat in item.relatedHabitats" :key="habitat.id">
            <RouterLink :to="`/habitats/${habitat.id}`">{{ habitat.name }}</RouterLink>
            <span>× {{ habitat.quantity }}</span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
