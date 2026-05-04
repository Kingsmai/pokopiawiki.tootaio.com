<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { iconAdd, iconArtifact } from '../icons';
import { api, getAuthToken, type AncientArtifact, type AuthUser, type Options } from '../services/api';
import AncientArtifactEdit from './AncientArtifactEdit.vue';

const route = useRoute();
const { t } = useI18n();
const options = ref<Options | null>(null);
const artifacts = ref<AncientArtifact[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const search = ref('');
const categoryId = ref('');
const tagIds = ref<string[]>([]);

const categorySkeletonWidths = ['64px', '132px', '132px', '86px'];
const filterSkeletonWidths = ['52px', '36px'];
const skeletonCardCount = 6;

const categoryTabs = computed<TabOption[]>(() => [
  { value: '', label: t('common.all') },
  ...(options.value?.ancientArtifactCategories.map((item) => ({ value: String(item.id), label: item.name })) ?? [])
]);
const artifactQuery = computed(() => ({
  search: search.value,
  categoryId: categoryId.value,
  tagIds: tagIds.value.join(',')
}));
const showEditor = computed(() => route.name === 'ancient-artifact-new');
const canCreateArtifact = computed(() => currentUser.value?.permissions.includes('ancient-artifacts.create') === true);

function artifactCardImage(artifact: AncientArtifact) {
  return artifact.image ? { src: artifact.image.url, alt: t('media.imageAlt', { name: artifact.name }) } : undefined;
}

async function loadArtifacts() {
  loading.value = true;
  artifacts.value = await api.ancientArtifacts(artifactQuery.value);
  loading.value = false;
}

onMounted(async () => {
  if (getAuthToken()) {
    try {
      currentUser.value = (await api.me()).user;
    } catch {
      currentUser.value = null;
    }
  }
  options.value = await api.options();
  await loadArtifacts();
});

watch(artifactQuery, loadArtifacts);
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="t('pages.ancientArtifacts.title')" :subtitle="t('pages.ancientArtifacts.subtitle')">
      <template #kicker>{{ t('pages.ancientArtifacts.kicker') }}</template>
      <template #actions>
        <RouterLink v-if="canCreateArtifact" class="ui-button ui-button--primary ui-button--small" to="/ancient-artifacts/new">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.add') }}
        </RouterLink>
      </template>
    </PageHeader>

    <Tabs v-if="options" id="artifact-category" v-model="categoryId" :tabs="categoryTabs" :label="t('pages.ancientArtifacts.category')" />
    <div v-else class="tabs tabs--component" aria-hidden="true">
      <div class="tab-list tab-list--skeleton">
        <Skeleton
          v-for="width in categorySkeletonWidths"
          :key="width"
          variant="box"
          :width="width"
          height="42px"
          class="skeleton-tab"
        />
      </div>
    </div>

    <FilterPanel v-if="options">
      <div class="field">
        <label for="artifact-search">{{ t('common.search') }}</label>
        <input id="artifact-search" v-model="search" type="search" :placeholder="t('common.name')" />
      </div>

      <div class="field">
        <label for="artifact-tags">{{ t('pages.ancientArtifacts.tags') }}</label>
        <TagsSelect
          id="artifact-tags"
          v-model="tagIds"
          :options="options.itemTags"
          :placeholder="t('pages.ancientArtifacts.searchTags')"
        />
      </div>
    </FilterPanel>
    <FilterPanel v-else class="filter-panel--skeleton" aria-hidden="true">
      <div v-for="(width, index) in filterSkeletonWidths" :key="index" class="field">
        <Skeleton :width="width" />
        <Skeleton variant="box" height="44px" />
      </div>
    </FilterPanel>

    <div v-if="loading" class="entity-grid catalog-card-grid" aria-busy="true" :aria-label="t('pages.ancientArtifacts.loadingList')">
      <article v-for="index in skeletonCardCount" :key="`artifact-skeleton-${index}`" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
          <Skeleton width="92px" />
        </div>
      </article>
    </div>
    <div v-else class="entity-grid catalog-card-grid">
      <EntityCard
        v-for="artifact in artifacts"
        :key="artifact.id"
        :title="artifact.name"
        :subtitle="artifact.category.name"
        :to="`/ancient-artifacts/${artifact.id}`"
        :icon="iconArtifact"
        :image="artifactCardImage(artifact)"
      />
    </div>

    <AncientArtifactEdit v-if="showEditor" />
  </section>
</template>
