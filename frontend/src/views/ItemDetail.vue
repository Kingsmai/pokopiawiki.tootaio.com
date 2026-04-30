<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditHistoryPanel from '../components/EditHistoryPanel.vue';
import EntityChips from '../components/EntityChips.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
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
  <section v-if="!item" class="page-stack" aria-busy="true" aria-label="正在加载物品详情">
    <div class="page-header page-header--skeleton" aria-hidden="true">
      <div class="page-header__copy">
        <Skeleton width="96px" />
        <Skeleton width="260px" height="46px" />
        <Skeleton width="220px" />
        <Skeleton width="300px" />
      </div>
      <div class="page-header__actions">
        <Skeleton variant="box" width="88px" height="36px" />
      </div>
    </div>

    <div class="detail-grid" aria-hidden="true">
      <section v-for="index in 3" :key="`chips-${index}`" class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton :width="index === 2 ? '68px' : '92px'" height="24px" />
        </div>
        <div class="detail-section__body">
          <div class="skeleton-chip-row">
            <Skeleton v-for="chipIndex in 3" :key="chipIndex" width="82px" class="skeleton-chip" />
          </div>
        </div>
      </section>

      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="112px" height="24px" />
        </div>
        <div class="detail-section__body">
          <Skeleton width="45%" />
          <div class="skeleton-chip-row">
            <Skeleton v-for="index in 3" :key="index" width="76px" class="skeleton-chip" />
          </div>
        </div>
      </section>

      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="108px" height="24px" />
        </div>
        <div class="detail-section__body">
          <ul class="row-list skeleton-row-list">
            <li v-for="index in 3" :key="index">
              <Skeleton width="120px" />
              <Skeleton width="44px" />
            </li>
          </ul>
        </div>
      </section>
    </div>
  </section>
  <section v-else class="page-stack">
    <PageHeader :title="item.name" :subtitle="item.usage ? `${item.category.name} · ${item.usage.name}` : item.category.name">
      <template #kicker>Item Detail</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" :to="`/items/${item.id}/edit`">编辑</RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/items">返回列表</RouterLink>
      </template>
    </PageHeader>

    <div class="detail-with-sidebar">
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
          <p v-else-if="item.noRecipe" class="meta-line">无材料单</p>
          <template v-else>
            <p class="meta-line">无</p>
            <RouterLink class="ui-button ui-button--primary ui-button--small" :to="`/recipes/new?itemId=${item.id}`">
              创建材料单
            </RouterLink>
          </template>
        </DetailSection>

        <DetailSection title="相关材料单">
          <ul v-if="item.relatedRecipes.length" class="row-list">
            <li v-for="recipe in item.relatedRecipes" :key="recipe.id">
              <RouterLink :to="`/recipes/${recipe.id}`">{{ recipe.name }}</RouterLink>
              <EntityChips :items="recipe.materials" />
            </li>
          </ul>
          <p v-else class="meta-line">无</p>
        </DetailSection>

        <DetailSection title="相关栖息地">
          <ul v-if="item.relatedHabitats.length" class="row-list">
            <li v-for="habitat in item.relatedHabitats" :key="habitat.id">
              <RouterLink :to="`/habitats/${habitat.id}`">{{ habitat.name }}</RouterLink>
              <EntityChips :items="habitat.recipe" />
            </li>
          </ul>
          <p v-else class="meta-line">无</p>
        </DetailSection>

        <DetailSection title="Pokemon 掉落">
          <ul v-if="item.droppedByPokemon.length" class="row-list">
            <li v-for="entry in item.droppedByPokemon" :key="`${entry.pokemon.id}-${entry.skill.id}`">
              <RouterLink :to="`/pokemon/${entry.pokemon.id}`">#{{ entry.pokemon.id }} {{ entry.pokemon.name }}</RouterLink>
              <span>{{ entry.skill.name }}掉落物</span>
            </li>
          </ul>
          <p v-else class="meta-line">无</p>
        </DetailSection>
      </div>

      <EditHistoryPanel :entity="item" :history="item.editHistory" />
    </div>
  </section>
</template>
