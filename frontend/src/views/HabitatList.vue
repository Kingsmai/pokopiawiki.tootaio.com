<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EntityCard from '../components/EntityCard.vue';
import LoadMoreSentinel from '../components/LoadMoreSentinel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import { iconAdd, iconHabitat } from '../icons';
import { api, getAuthToken, type AuthUser, type Habitat, type ListPage } from '../services/api';
import HabitatEdit from './HabitatEdit.vue';

const props = defineProps<{
  eventOnly?: boolean;
}>();

const habitats = ref<Habitat[]>([]);
const currentUser = ref<AuthUser | null>(null);
const route = useRoute();
const { t, locale } = useI18n();
const loadingMore = ref(false);
const nextCursor = ref<string | null>(null);
const hasMoreHabitats = ref(false);
const skeletonCardCount = 6;
const listPageSize = 24;
let loadRequestId = 0;
const query = computed(() => ({
  isEventItem: props.eventOnly ? 'true' : 'false'
}));

const { data: initialData } = useAsyncData<ListPage<Habitat> | null>(
  `${props.eventOnly ? 'event-habitat-list-initial' : 'habitat-list-initial'}:${locale.value}`,
  async () => {
    try {
      return await api.habitatsPage({
        ...query.value,
        cursor: null,
        limit: listPageSize
      });
    } catch {
      return null;
    }
  },
  { default: () => null }
);

const initialPageLoaded = ref(false);
const loading = ref(true);

function applyInitialData(page: ListPage<Habitat> | null | undefined) {
  if (!page || initialPageLoaded.value) return;

  habitats.value = page.items;
  nextCursor.value = page.nextCursor;
  hasMoreHabitats.value = page.hasMore;
  initialPageLoaded.value = true;
  loading.value = false;
}

const showEditor = computed(() => route.name === 'habitat-new' || route.name === 'event-habitat-new');
const canCreateHabitat = computed(() => currentUser.value?.permissions.includes('habitats.create') === true);
const pageTitle = computed(() => t(props.eventOnly ? 'pages.eventHabitats.title' : 'pages.habitats.title'));
const pageSubtitle = computed(() => t(props.eventOnly ? 'pages.eventHabitats.subtitle' : 'pages.habitats.subtitle'));
const pageKicker = computed(() => t(props.eventOnly ? 'pages.eventHabitats.kicker' : 'pages.habitats.listKicker'));
const newHabitatPath = computed(() => (props.eventOnly ? '/event-habitats/new' : '/habitats/new'));
const loadingListLabel = computed(() => t(props.eventOnly ? 'pages.eventHabitats.loadingList' : 'pages.habitats.loadingList'));

function habitatCardImage(item: Habitat) {
  return item.image ? { src: item.image.url, alt: t('media.imageAlt', { name: item.name }) } : undefined;
}

async function loadHabitats(reset = true) {
  if (!reset && (loading.value || loadingMore.value || !hasMoreHabitats.value)) {
    return;
  }

  const requestId = ++loadRequestId;
  if (reset) {
    loading.value = true;
    loadingMore.value = false;
    nextCursor.value = null;
    hasMoreHabitats.value = false;
  } else {
    loadingMore.value = true;
  }

  try {
    const page = await api.habitatsPage({
      ...query.value,
      cursor: reset ? null : nextCursor.value,
      limit: listPageSize
    });

    if (requestId !== loadRequestId) {
      return;
    }

    if (reset) {
      habitats.value = page.items;
    } else {
      const existingIds = new Set(habitats.value.map((item) => item.id));
      habitats.value = [...habitats.value, ...page.items.filter((item) => !existingIds.has(item.id))];
    }
    nextCursor.value = page.nextCursor;
    hasMoreHabitats.value = page.hasMore;
    initialPageLoaded.value = true;
  } catch {
    if (requestId === loadRequestId && reset) {
      habitats.value = [];
      nextCursor.value = null;
      hasMoreHabitats.value = false;
      initialPageLoaded.value = true;
    }
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function loadMoreHabitats() {
  void loadHabitats(false);
}

onMounted(async () => {
  if (getAuthToken()) {
    try {
      currentUser.value = (await api.me()).user;
    } catch {
      currentUser.value = null;
    }
  }
  if (!initialPageLoaded.value) {
    await loadHabitats();
  }
});

watch(query, () => {
  void loadHabitats();
});

watch(initialData, applyInitialData, { immediate: true });
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
      <template #kicker>{{ pageKicker }}</template>
      <template #actions>
        <RouterLink v-if="canCreateHabitat" class="ui-button ui-button--primary ui-button--small" :to="newHabitatPath">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.add') }}
        </RouterLink>
      </template>
    </PageHeader>

    <div v-if="loading" class="entity-grid pokemon-list-grid" aria-busy="true" :aria-label="loadingListLabel">
      <article v-for="index in skeletonCardCount" :key="index" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
        </div>
      </article>
    </div>
    <div v-else class="entity-grid pokemon-list-grid">
      <EntityCard
        v-for="item in habitats"
        :key="item.id"
        :title="item.name"
        :to="`/habitats/${item.id}`"
        :icon="iconHabitat"
        :image="habitatCardImage(item)"
      />
    </div>
    <div v-if="loadingMore" class="entity-grid pokemon-list-grid" aria-hidden="true">
      <article v-for="index in 2" :key="`habitat-more-${index}`" class="entity-card entity-card--skeleton">
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
        </div>
      </article>
    </div>
    <LoadMoreSentinel :active="hasMoreHabitats" :disabled="loading || loadingMore" @load="loadMoreHabitats" />

    <HabitatEdit v-if="showEditor" />
  </section>
</template>
