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
import { iconBack, iconEdit } from '../icons';
import { api, type RecipeDetail } from '../services/api';
import RecipeEdit from './RecipeEdit.vue';

const route = useRoute();
const { t } = useI18n();
const recipe = ref<RecipeDetail | null>(null);
const detailTab = ref('details');
const showEditor = computed(() => route.name === 'recipe-edit');
const detailTabs = computed<TabOption[]>(() => [
  { value: 'details', label: t('common.details') },
  { value: 'discussion', label: t('discussion.title') },
  { value: 'history', label: t('history.editHistory') }
]);

async function loadRecipeDetail() {
  recipe.value = await api.recipeDetail(String(route.params.id));
}

onMounted(async () => {
  await loadRecipeDetail();
});

watch(
  () => route.name,
  (name, oldName) => {
    if (oldName === 'recipe-edit' && name === 'recipe-detail') {
      void loadRecipeDetail();
    }
  }
);

watch(
  () => route.params.id,
  () => {
    recipe.value = null;
    detailTab.value = 'details';
    void loadRecipeDetail();
  }
);
</script>

<template>
  <section v-if="!recipe" class="page-stack" aria-busy="true" :aria-label="t('pages.recipes.loadingDetail')">
    <div class="page-header page-header--skeleton" aria-hidden="true">
      <div class="page-header__copy">
        <Skeleton width="112px" />
        <Skeleton width="260px" height="46px" />
        <Skeleton width="128px" />
        <Skeleton width="300px" />
      </div>
      <div class="page-header__actions">
        <Skeleton variant="box" width="88px" height="36px" />
      </div>
    </div>

    <div class="detail-grid" aria-hidden="true">
      <section v-for="index in 2" :key="index" class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton :width="index === 1 ? '92px' : '88px'" height="24px" />
        </div>
        <div class="detail-section__body">
          <div class="skeleton-chip-row">
            <Skeleton v-for="chipIndex in index === 1 ? 3 : 4" :key="chipIndex" width="82px" class="skeleton-chip" />
          </div>
        </div>
      </section>
    </div>
  </section>
  <section v-else class="page-stack">
    <PageHeader :title="recipe.name" :subtitle="t('pages.recipes.detailSubtitle')">
      <template #kicker>Recipe Detail</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" :to="`/recipes/${recipe.id}/edit`">
          <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
          {{ t('common.edit') }}
        </RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/recipes">
          <Icon :icon="iconBack" class="ui-icon" aria-hidden="true" />
          {{ t('common.backToList') }}
        </RouterLink>
      </template>
    </PageHeader>

    <div class="detail-tabs">
      <Tabs id="recipe-detail-tabs" v-model="detailTab" :tabs="detailTabs" :label="t('common.details')" />

      <div v-if="detailTab === 'details'" class="detail-grid">
        <DetailSection :title="t('pages.items.acquisitionMethods')">
          <EntityChips :items="recipe.acquisition_methods" />
        </DetailSection>

        <DetailSection :title="t('pages.recipes.materials')">
          <EntityChips :items="recipe.materials" />
        </DetailSection>
      </div>

      <div v-else-if="detailTab === 'discussion'" class="detail-tab-panel">
        <EntityDiscussionPanel entity-type="recipes" :entity-id="recipe.id" />
      </div>

      <div v-else class="detail-tab-panel">
        <EditHistoryPanel :entity="recipe" :history="recipe.editHistory" />
      </div>
    </div>
  </section>

  <RecipeEdit v-if="showEditor" />
</template>
