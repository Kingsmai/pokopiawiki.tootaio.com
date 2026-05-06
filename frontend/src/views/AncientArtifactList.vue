<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import LoadMoreSentinel from '../components/LoadMoreSentinel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { iconAdd, iconArtifact } from '../icons';
import { api, getAuthToken, type AncientArtifact, type AuthUser, type ListPage, type Options } from '../services/api';
import ItemEdit from './ItemEdit.vue';

const route = useRoute();
const { t, locale } = useI18n();
const options = ref<Options | null>(null);
const artifacts = ref<AncientArtifact[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const nextCursor = ref<string | null>(null);
const hasMoreArtifacts = ref(false);
const search = ref('');
const categoryId = ref('');
const tagIds = ref<string[]>([]);

const categorySkeletonWidths = ['64px', '132px', '132px', '86px'];
const filterSkeletonWidths = ['52px', '36px'];
const skeletonCardCount = 6;
const listPageSize = 24;
let loadRequestId = 0;

const categoryTabs = computed<TabOption[]>(() => [
  { value: '', label: t('common.all') },
  ...(options.value?.ancientArtifactCategories.map((item) => ({ value: String(item.id), label: item.name })) ?? [])
]);
const artifactQuery = computed(() => ({
  search: search.value,
  categoryId: categoryId.value,
  tagIds: tagIds.value.join(',')
}));

type AncientArtifactListInitialData = {
  options: Options | null;
  page: ListPage<AncientArtifact> | null;
};

const { data: initialData } = await useAsyncData<AncientArtifactListInitialData>(
  `ancient-artifact-list-initial:${locale.value}`,
  async () => {
    const [optionsResult, artifactsResult] = await Promise.allSettled([
      api.options(),
      api.ancientArtifactsPage({
        ...artifactQuery.value,
        cursor: null,
        limit: listPageSize
      })
    ]);

    return {
      options: optionsResult.status === 'fulfilled' ? optionsResult.value : null,
      page: artifactsResult.status === 'fulfilled' ? artifactsResult.value : null
    };
  },
  { default: () => ({ options: null, page: null }) }
);

const initialPage = initialData.value?.page ?? null;
options.value = initialData.value?.options ?? null;
artifacts.value = initialPage?.items ?? [];
const initialPageLoaded = ref(initialPage !== null);
loading.value = !initialPageLoaded.value;
nextCursor.value = initialPage?.nextCursor ?? null;
hasMoreArtifacts.value = initialPage?.hasMore ?? false;

const showEditor = computed(() => route.name === 'ancient-artifact-new');
const canCreateArtifact = computed(() => currentUser.value?.permissions.includes('items.create') === true);

function artifactCardImage(artifact: AncientArtifact) {
  return artifact.image ? { src: artifact.image.url, alt: t('media.imageAlt', { name: artifact.name }) } : undefined;
}

async function loadArtifacts(reset = true) {
  if (!reset && (loading.value || loadingMore.value || !hasMoreArtifacts.value)) {
    return;
  }

  const requestId = ++loadRequestId;
  if (reset) {
    loading.value = true;
    loadingMore.value = false;
    nextCursor.value = null;
    hasMoreArtifacts.value = false;
  } else {
    loadingMore.value = true;
  }

  try {
    const page = await api.ancientArtifactsPage({
      ...artifactQuery.value,
      cursor: reset ? null : nextCursor.value,
      limit: listPageSize
    });

    if (requestId !== loadRequestId) {
      return;
    }

    if (reset) {
      artifacts.value = page.items;
    } else {
      const existingIds = new Set(artifacts.value.map((item) => item.id));
      artifacts.value = [...artifacts.value, ...page.items.filter((item) => !existingIds.has(item.id))];
    }
    nextCursor.value = page.nextCursor;
    hasMoreArtifacts.value = page.hasMore;
    initialPageLoaded.value = true;
  } catch {
    if (requestId === loadRequestId && reset) {
      artifacts.value = [];
      nextCursor.value = null;
      hasMoreArtifacts.value = false;
      initialPageLoaded.value = true;
    }
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function loadMoreArtifacts() {
  void loadArtifacts(false);
}

onMounted(async () => {
  if (getAuthToken()) {
    try {
      currentUser.value = (await api.me()).user;
    } catch {
      currentUser.value = null;
    }
  }
  if (!options.value) {
    try {
      options.value = await api.options();
    } catch {
      options.value = null;
    }
  }
  if (!initialPageLoaded.value) {
    await loadArtifacts();
  }
});

watch(artifactQuery, () => {
  void loadArtifacts();
});
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

    <div v-if="loading" class="entity-grid catalog-card-grid collections-card-grid" aria-busy="true" :aria-label="t('pages.ancientArtifacts.loadingList')">
      <article
        v-for="index in skeletonCardCount"
        :key="`artifact-skeleton-${index}`"
        class="entity-card entity-card--skeleton entity-card--collection-compact"
      >
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
          <Skeleton width="92px" />
        </div>
      </article>
    </div>
    <div v-else class="entity-grid catalog-card-grid collections-card-grid">
      <EntityCard
        v-for="artifact in artifacts"
        :key="artifact.id"
        :title="artifact.name"
        :subtitle="artifact.category.name"
        :to="`/ancient-artifacts/${artifact.id}`"
        :icon="iconArtifact"
        :image="artifactCardImage(artifact)"
        compact-tooltip
      />
    </div>
    <div v-if="loadingMore" class="entity-grid catalog-card-grid collections-card-grid" aria-hidden="true">
      <article
        v-for="index in 2"
        :key="`artifact-more-${index}`"
        class="entity-card entity-card--skeleton entity-card--collection-compact"
      >
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
          <Skeleton width="92px" />
        </div>
      </article>
    </div>
    <LoadMoreSentinel :active="hasMoreArtifacts" :disabled="loading || loadingMore" @load="loadMoreArtifacts" />

    <ItemEdit v-if="showEditor" />
  </section>
</template>
