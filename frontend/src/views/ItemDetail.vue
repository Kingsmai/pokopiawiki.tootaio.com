<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditHistoryPanel from '../components/EditHistoryPanel.vue';
import EntityDiscussionPanel from '../components/EntityDiscussionPanel.vue';
import EntityChips from '../components/EntityChips.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import { iconAdd, iconBack, iconEdit } from '../icons';
import { api, type ItemDetail } from '../services/api';
import ItemEdit from './ItemEdit.vue';

const route = useRoute();
const { t } = useI18n();
const item = ref<ItemDetail | null>(null);
const detailTab = ref('details');
const showEditor = computed(() => route.name === 'item-edit');
const detailTabs = computed<TabOption[]>(() => [
  { value: 'details', label: t('common.details') },
  { value: 'discussion', label: t('discussion.title') },
  { value: 'history', label: t('history.editHistory') }
]);

const customization = computed(() => {
  if (!item.value) {
    return [];
  }

  return [
    item.value.customization.dyeable ? t('pages.items.dyeable') : '',
    item.value.customization.dualDyeable ? t('pages.items.dualDyeable') : '',
    item.value.customization.patternEditable ? t('pages.items.patternEditable') : ''
  ].filter(Boolean);
});

function imageFileName(path: string): string {
  return path.split('/').at(-1) ?? t('media.image');
}

async function loadItemDetail() {
  item.value = await api.itemDetail(String(route.params.id));
}

onMounted(async () => {
  await loadItemDetail();
});

watch(
  () => route.name,
  (name, oldName) => {
    if (oldName === 'item-edit' && name === 'item-detail') {
      void loadItemDetail();
    }
  }
);

watch(
  () => route.params.id,
  () => {
    item.value = null;
    detailTab.value = 'details';
    void loadItemDetail();
  }
);
</script>

<template>
  <section v-if="!item" class="page-stack" aria-busy="true" :aria-label="t('pages.items.loadingDetail')">
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
        <RouterLink class="ui-button ui-button--primary ui-button--small" :to="`/items/${item.id}/edit`">
          <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
          {{ t('common.edit') }}
        </RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/items">
          <Icon :icon="iconBack" class="ui-icon" aria-hidden="true" />
          {{ t('common.backToList') }}
        </RouterLink>
      </template>
    </PageHeader>

    <div class="detail-tabs">
      <Tabs id="item-detail-tabs" v-model="detailTab" :tabs="detailTabs" :label="t('common.details')" />

      <div v-if="detailTab === 'details'" class="detail-grid">
        <DetailSection v-if="item.image || item.imageHistory.length" :title="t('media.image')">
          <div class="entity-detail-image">
            <div v-if="item.image" class="entity-detail-image__frame">
              <img :src="item.image.url" :alt="t('media.imageAlt', { name: item.name })" />
            </div>
            <p v-else class="meta-line">{{ t('media.imageEmpty') }}</p>
            <div v-if="item.imageHistory.length" class="image-history-list" :aria-label="t('media.imageHistory')">
              <div v-for="image in item.imageHistory" :key="image.path" class="image-history-list__item">
                <img :src="image.url" :alt="t('media.imageAlt', { name: item.name })" loading="lazy" />
                <span>{{ imageFileName(image.path) }}</span>
              </div>
            </div>
          </div>
        </DetailSection>

        <DetailSection :title="t('pages.items.acquisitionMethods')">
          <EntityChips :items="item.acquisitionMethods" />
        </DetailSection>

        <DetailSection :title="t('pages.items.customization')">
          <div v-if="customization.length" class="chips">
            <span v-for="entry in customization" :key="entry" class="chip">{{ entry }}</span>
          </div>
          <p v-else class="meta-line">{{ t('common.none') }}</p>
        </DetailSection>

        <DetailSection :title="t('pages.items.tags')">
          <EntityChips :items="item.tags" />
        </DetailSection>

        <DetailSection :title="t('pages.items.recipeInfo')">
          <template v-if="item.recipe">
            <RouterLink :to="`/recipes/${item.recipe.id}`">{{ item.recipe.name }}</RouterLink>
            <EntityChips :items="item.recipe.materials" />
          </template>
          <p v-else-if="item.noRecipe" class="meta-line">{{ t('pages.items.noRecipe') }}</p>
          <template v-else>
            <p class="meta-line">{{ t('common.none') }}</p>
            <RouterLink class="ui-button ui-button--primary ui-button--small" :to="`/recipes/new?itemId=${item.id}`">
              <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
              {{ t('pages.items.createRecipe') }}
            </RouterLink>
          </template>
        </DetailSection>

        <DetailSection :title="t('pages.items.relatedRecipes')">
          <ul v-if="item.relatedRecipes.length" class="row-list">
            <li v-for="recipe in item.relatedRecipes" :key="recipe.id">
              <RouterLink :to="`/recipes/${recipe.id}`">{{ recipe.name }}</RouterLink>
              <EntityChips :items="recipe.materials" />
            </li>
          </ul>
          <p v-else class="meta-line">{{ t('common.none') }}</p>
        </DetailSection>

        <DetailSection :title="t('pages.items.relatedHabitats')">
          <ul v-if="item.relatedHabitats.length" class="row-list">
            <li v-for="habitat in item.relatedHabitats" :key="habitat.id">
              <RouterLink :to="`/habitats/${habitat.id}`">{{ habitat.name }}</RouterLink>
              <EntityChips :items="habitat.recipe" />
            </li>
          </ul>
          <p v-else class="meta-line">{{ t('common.none') }}</p>
        </DetailSection>

        <DetailSection :title="t('pages.items.pokemonDrops')">
          <ul v-if="item.droppedByPokemon.length" class="row-list">
            <li v-for="entry in item.droppedByPokemon" :key="`${entry.pokemon.id}-${entry.skill.id}`">
              <RouterLink :to="`/pokemon/${entry.pokemon.id}`">#{{ entry.pokemon.id }} {{ entry.pokemon.name }}</RouterLink>
              <span>{{ t('pages.pokemon.skillDrop', { name: entry.skill.name }) }}</span>
            </li>
          </ul>
          <p v-else class="meta-line">{{ t('common.none') }}</p>
        </DetailSection>
      </div>

      <div v-else-if="detailTab === 'discussion'" class="detail-tab-panel">
        <EntityDiscussionPanel entity-type="items" :entity-id="item.id" />
      </div>

      <div v-else class="detail-tab-panel">
        <EditHistoryPanel :entity="item" :history="item.editHistory" />
      </div>
    </div>
  </section>

  <ItemEdit v-if="showEditor" />
</template>
