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
import { iconBack, iconEdit, iconRecipe } from '../icons';
import { applySeo, resolvedSeoHead, resolveSeo } from '../seo';
import { api, type AuthUser, type RecipeDetail } from '../services/api';
import RecipeEdit from './RecipeEdit.vue';

const route = useRoute();
const { t, locale } = useI18n();
const recipe = ref<RecipeDetail | null>(null);
const currentUser = ref<AuthUser | null>(null);
const detailTab = ref('details');
const showEditor = computed(() => route.name === 'recipe-edit');
const canUpdateRecipe = computed(() => currentUser.value?.permissions.includes('recipes.update') === true);
const detailTabs = computed<TabOption[]>(() => [
  { value: 'details', label: t('common.details') },
  { value: 'discussion', label: t('discussion.title') },
  { value: 'history', label: t('history.editHistory') }
]);
const recipeSubtitle = computed(() => {
  if (!recipe.value) {
    return '';
  }

  const categoryName = recipe.value.item.category?.name;
  const usageName = recipe.value.item.usage?.name;

  if (categoryName && usageName) {
    return `${categoryName} · ${usageName}`;
  }

  return categoryName ?? t('pages.recipes.detailSubtitle');
});

const { data: initialRecipe } = useAsyncData<RecipeDetail | null>(
  `recipe-detail:${String(route.params.id)}:${locale.value}`,
  async () => {
    try {
      return await api.recipeDetail(String(route.params.id));
    } catch {
      return null;
    }
  },
  { default: () => null }
);

const initialRecipeLoaded = ref(false);
const recipeSeo = computed(() =>
  recipe.value && route.meta.editorModal !== true
    ? resolveSeo({
        title: `${recipe.value.name} - ${t('pages.recipes.title')}`,
        description: t('seo.recipeDetailDescription', { name: recipe.value.name }),
        canonicalPath: `/recipes/${recipe.value.id}`,
        image: recipe.value.item.image?.url
      })
    : null
);

useHead(() => (recipeSeo.value ? resolvedSeoHead(recipeSeo.value) : {}));

function applyInitialRecipe(value: RecipeDetail | null | undefined) {
  if (!value || initialRecipeLoaded.value) return;

  recipe.value = value;
  initialRecipeLoaded.value = true;
}

async function loadRecipeDetail() {
  try {
    const nextRecipe = await api.recipeDetail(String(route.params.id));
    recipe.value = nextRecipe;
    initialRecipeLoaded.value = true;

    if (route.meta.editorModal !== true) {
      applySeo({
        title: `${nextRecipe.name} - ${t('pages.recipes.title')}`,
        description: t('seo.recipeDetailDescription', { name: nextRecipe.name }),
        canonicalPath: `/recipes/${nextRecipe.id}`,
        image: nextRecipe.item.image?.url
      });
    }
  } catch {
    recipe.value = null;
    initialRecipeLoaded.value = true;
  }
}

onMounted(async () => {
  try {
    currentUser.value = (await api.me()).user;
  } catch {
    currentUser.value = null;
  }
  if (!initialRecipeLoaded.value) {
    await loadRecipeDetail();
  }
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

watch(initialRecipe, applyInitialRecipe, { immediate: true });
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
    <PageHeader :title="recipe.name" :subtitle="recipeSubtitle">
      <template #kicker>{{ t('pages.recipes.detailKicker') }}</template>
      <template #actions>
        <RouterLink v-if="canUpdateRecipe" class="ui-button ui-button--primary ui-button--small" :to="`/recipes/${recipe.id}/edit`">
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

      <div v-if="detailTab === 'details'" class="detail-grid detail-grid--stack">
        <div class="entity-profile-grid">
          <section class="detail-section entity-profile-media-section" :aria-label="t('pages.recipes.item')">
            <div class="entity-detail-image">
              <RouterLink
                class="entity-detail-image__frame entity-detail-image__frame--link"
                :class="{ 'entity-detail-image__frame--placeholder': !recipe.item.image }"
                :to="`/items/${recipe.item.id}`"
              >
                <img v-if="recipe.item.image" :src="recipe.item.image.url" :alt="t('media.imageAlt', { name: recipe.item.name })" />
                <span v-else class="entity-card__mark entity-detail-image__mark" role="img" :aria-label="t('media.imageEmpty')">
                  <Icon :icon="iconRecipe" class="entity-card__icon" aria-hidden="true" />
                </span>
              </RouterLink>
              <RouterLink class="entity-profile-title-link" :to="`/items/${recipe.item.id}`">{{ recipe.item.name }}</RouterLink>
            </div>
          </section>

          <div class="entity-profile-main">
            <section class="detail-section entity-profile-overview" :aria-label="t('common.details')">
              <dl class="entity-profile-facts">
                <div>
                  <dt>{{ t('pages.items.category') }}</dt>
                  <dd>{{ recipe.item.category?.name ?? t('common.none') }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.items.usage') }}</dt>
                  <dd>{{ recipe.item.usage?.name ?? t('common.none') }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.items.acquisitionMethods') }}</dt>
                  <dd>{{ recipe.acquisition_methods.length }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.recipes.materials') }}</dt>
                  <dd>{{ recipe.materials.length }}</dd>
                </div>
              </dl>

              <div class="entity-profile-groups">
                <div class="entity-profile-group">
                  <h3 class="section-subtitle">{{ t('pages.items.acquisitionMethods') }}</h3>
                  <EntityChips v-if="recipe.acquisition_methods.length" :items="recipe.acquisition_methods" />
                  <p v-else class="meta-line">{{ t('common.none') }}</p>
                </div>
                <div class="entity-profile-group">
                  <h3 class="section-subtitle">{{ t('pages.recipes.materials') }}</h3>
                  <EntityChips v-if="recipe.materials.length" :items="recipe.materials" />
                  <p v-else class="meta-line">{{ t('common.none') }}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
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
