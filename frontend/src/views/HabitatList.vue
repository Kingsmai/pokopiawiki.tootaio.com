<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EntityCard from '../components/EntityCard.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import { iconAdd, iconHabitat } from '../icons';
import { api, getAuthToken, type AuthUser, type Habitat } from '../services/api';
import HabitatEdit from './HabitatEdit.vue';

const props = defineProps<{
  eventOnly?: boolean;
}>();

const habitats = ref<Habitat[]>([]);
const currentUser = ref<AuthUser | null>(null);
const route = useRoute();
const { t } = useI18n();
const loading = ref(true);
const skeletonCardCount = 6;
const query = computed(() => ({
  isEventItem: props.eventOnly ? 'true' : 'false'
}));
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

async function loadHabitats() {
  loading.value = true;
  habitats.value = await api.habitats(query.value);
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
  await loadHabitats();
});

watch(query, loadHabitats);
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

    <HabitatEdit v-if="showEditor" />
  </section>
</template>
