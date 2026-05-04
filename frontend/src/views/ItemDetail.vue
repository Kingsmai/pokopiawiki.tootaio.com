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
import PokeBallMark from '../components/PokeBallMark.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import { iconAdd, iconBack, iconEdit, iconHabitat, iconItem } from '../icons';
import { applySeo } from '../seo';
import { api, getAuthToken, type AuthUser, type ItemDetail } from '../services/api';
import ItemEdit from './ItemEdit.vue';

const route = useRoute();
const { t } = useI18n();
const item = ref<ItemDetail | null>(null);
const currentUser = ref<AuthUser | null>(null);
const detailTab = ref('details');
const showEditor = computed(() => route.name === 'item-edit');
const canUpdateItem = computed(() => currentUser.value?.permissions.includes('items.update') === true);
const canCreateRecipe = computed(() => currentUser.value?.permissions.includes('recipes.create') === true);
const detailTabs = computed<TabOption[]>(() => [
  { value: 'details', label: t('common.details') },
  { value: 'discussion', label: t('discussion.title') },
  { value: 'history', label: t('history.editHistory') }
]);
const itemSubtitle = computed(() => {
  if (!item.value) {
    return '';
  }

  return item.value.usage ? `${item.value.category.name} · ${item.value.usage.name}` : item.value.category.name;
});
const detailKicker = computed(() => (item.value?.isEventItem ? t('pages.eventItems.detailKicker') : t('pages.items.detailKicker')));
const listTarget = computed(() => (item.value?.isEventItem ? '/event-items' : '/items'));

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

async function loadItemDetail() {
  const nextItem = await api.itemDetail(String(route.params.id));
  item.value = nextItem;

  if (route.meta.editorModal !== true) {
    applySeo({
      title: `${nextItem.name} - ${t(nextItem.isEventItem ? 'pages.eventItems.title' : 'pages.items.title')}`,
      description: t('seo.itemDetailDescription', { name: nextItem.name }),
      canonicalPath: `/items/${nextItem.id}`,
      image: nextItem.image?.url
    });
  }
}

onMounted(async () => {
  if (getAuthToken()) {
    try {
      currentUser.value = (await api.me()).user;
    } catch {
      currentUser.value = null;
    }
  }
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
    <PageHeader :title="`#${item.displayId} ${item.name}`" :subtitle="itemSubtitle">
      <template #kicker>{{ detailKicker }}</template>
      <template #actions>
        <RouterLink v-if="canUpdateItem" class="ui-button ui-button--primary ui-button--small" :to="`/items/${item.id}/edit`">
          <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
          {{ t('common.edit') }}
        </RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="listTarget">
          <Icon :icon="iconBack" class="ui-icon" aria-hidden="true" />
          {{ t('common.backToList') }}
        </RouterLink>
      </template>
    </PageHeader>

    <div class="detail-tabs">
      <Tabs id="item-detail-tabs" v-model="detailTab" :tabs="detailTabs" :label="t('common.details')" />

      <div v-if="detailTab === 'details'" class="detail-grid detail-grid--stack">
        <div class="entity-profile-grid">
          <section class="detail-section entity-profile-media-section" :aria-label="t('media.image')">
            <div class="entity-detail-image">
              <div class="entity-detail-image__frame" :class="{ 'entity-detail-image__frame--placeholder': !item.image }">
                <img v-if="item.image" :src="item.image.url" :alt="t('media.imageAlt', { name: item.name })" />
                <span v-else class="entity-card__mark entity-detail-image__mark" role="img" :aria-label="t('media.imageEmpty')">
                  <Icon :icon="iconItem" class="entity-card__icon" aria-hidden="true" />
                </span>
              </div>
            </div>
          </section>

          <div class="entity-profile-main">
            <section class="detail-section entity-profile-overview" :aria-label="t('common.details')">
              <dl class="entity-profile-facts">
                <div>
                  <dt>{{ t('pages.items.displayId') }}</dt>
                  <dd>#{{ item.displayId }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.items.category') }}</dt>
                  <dd>{{ item.category.name }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.items.usage') }}</dt>
                  <dd>{{ item.usage?.name ?? t('common.none') }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.items.recipeInfo') }}</dt>
                  <dd>{{ item.noRecipe ? t('pages.items.noRecipe') : item.recipe ? item.recipe.name : t('common.none') }}</dd>
                </div>
              </dl>

              <div class="entity-profile-groups">
                <div class="entity-profile-group">
                  <h3 class="section-subtitle">{{ t('pages.items.description') }}</h3>
                  <p v-if="item.details" class="preserve-lines">{{ item.details }}</p>
                  <p v-else class="meta-line">{{ t('common.none') }}</p>
                </div>
                <div class="entity-profile-group">
                  <h3 class="section-subtitle">{{ t('pages.items.acquisitionMethods') }}</h3>
                  <EntityChips v-if="item.acquisitionMethods.length" :items="item.acquisitionMethods" />
                  <p v-else class="meta-line">{{ t('common.none') }}</p>
                </div>
                <div class="entity-profile-group">
                  <h3 class="section-subtitle">{{ t('pages.items.customization') }}</h3>
                  <div v-if="customization.length" class="chips">
                    <span v-for="entry in customization" :key="entry" class="chip">{{ entry }}</span>
                  </div>
                  <p v-else class="meta-line">{{ t('common.none') }}</p>
                </div>
                <div class="entity-profile-group">
                  <h3 class="section-subtitle">{{ t('pages.items.tags') }}</h3>
                  <EntityChips v-if="item.tags.length" :items="item.tags" />
                  <p v-else class="meta-line">{{ t('common.none') }}</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div class="detail-grid">
          <DetailSection :title="t('pages.items.recipeInfo')">
            <template v-if="item.recipe">
              <RouterLink class="related-entity-link related-entity-link--compact" :to="`/recipes/${item.recipe.id}`">
                <span class="related-entity-media related-entity-media--inline" aria-hidden="true">
                  <img v-if="item.recipe.item.image" :src="item.recipe.item.image.url" alt="" loading="lazy" />
                  <Icon v-else :icon="iconItem" class="related-entity-media__icon" aria-hidden="true" />
                </span>
                <span>{{ item.recipe.name }}</span>
              </RouterLink>
              <EntityChips :items="item.recipe.materials" />
            </template>
            <p v-else-if="item.noRecipe" class="meta-line">{{ t('pages.items.noRecipe') }}</p>
            <template v-else>
              <p class="meta-line">{{ t('common.none') }}</p>
              <RouterLink v-if="canCreateRecipe" class="ui-button ui-button--primary ui-button--small" :to="`/recipes/new?itemId=${item.id}`">
                <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
                {{ t('pages.items.createRecipe') }}
              </RouterLink>
            </template>
          </DetailSection>

          <DetailSection :title="t('pages.items.relatedRecipes')">
            <ul v-if="item.relatedRecipes.length" class="row-list">
              <li v-for="recipe in item.relatedRecipes" :key="recipe.id">
                <RouterLink class="related-entity-link related-entity-link--compact" :to="`/recipes/${recipe.id}`">
                  <span class="related-entity-media related-entity-media--inline" aria-hidden="true">
                    <img v-if="recipe.image" :src="recipe.image.url" alt="" loading="lazy" />
                    <Icon v-else :icon="iconItem" class="related-entity-media__icon" aria-hidden="true" />
                  </span>
                  <span>{{ recipe.name }}</span>
                </RouterLink>
                <EntityChips :items="recipe.materials" />
              </li>
            </ul>
            <p v-else class="meta-line">{{ t('common.none') }}</p>
          </DetailSection>

          <DetailSection :title="t('pages.items.relatedHabitats')">
            <ul v-if="item.relatedHabitats.length" class="row-list">
              <li v-for="habitat in item.relatedHabitats" :key="habitat.id">
                <RouterLink class="related-entity-link related-entity-link--compact" :to="`/habitats/${habitat.id}`">
                  <span class="related-entity-media related-entity-media--inline" aria-hidden="true">
                    <img v-if="habitat.image" :src="habitat.image.url" alt="" loading="lazy" />
                    <Icon v-else :icon="iconHabitat" class="related-entity-media__icon" aria-hidden="true" />
                  </span>
                  <span>{{ habitat.name }}</span>
                </RouterLink>
                <EntityChips :items="habitat.recipe" />
              </li>
            </ul>
            <p v-else class="meta-line">{{ t('common.none') }}</p>
          </DetailSection>

          <DetailSection :title="t('pages.items.pokemonDrops')">
            <ul v-if="item.droppedByPokemon.length" class="row-list">
              <li v-for="entry in item.droppedByPokemon" :key="`${entry.pokemon.id}-${entry.skill.id}`">
                <RouterLink class="related-entity-link related-entity-link--compact" :to="`/pokemon/${entry.pokemon.id}`">
                  <span class="related-entity-media related-entity-media--inline related-entity-media--pokemon" aria-hidden="true">
                    <img v-if="entry.pokemon.image" :src="entry.pokemon.image.url" alt="" loading="lazy" />
                    <PokeBallMark v-else size="22px" />
                  </span>
                  <span>#{{ entry.pokemon.displayId }} {{ entry.pokemon.name }}</span>
                </RouterLink>
                <span>{{ t('pages.pokemon.skillDrop', { name: entry.skill.name }) }}</span>
              </li>
            </ul>
            <p v-else class="meta-line">{{ t('common.none') }}</p>
          </DetailSection>
        </div>
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
