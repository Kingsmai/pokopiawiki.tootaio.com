<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EntityCard from '../components/EntityCard.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import { iconAdd, iconHabitat } from '../icons';
import { api, type Habitat } from '../services/api';
import HabitatEdit from './HabitatEdit.vue';

const habitats = ref<Habitat[]>([]);
const route = useRoute();
const { t } = useI18n();
const loading = ref(true);
const skeletonCardCount = 6;
const showEditor = computed(() => route.name === 'habitat-new');

function habitatCardImage(item: Habitat) {
  return item.image ? { src: item.image.url, alt: t('media.imageAlt', { name: item.name }) } : undefined;
}

onMounted(async () => {
  habitats.value = await api.habitats();
  loading.value = false;
});
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="t('pages.habitats.title')" :subtitle="t('pages.habitats.subtitle')">
      <template #kicker>Habitats</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" to="/habitats/new">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.add') }}
        </RouterLink>
      </template>
    </PageHeader>

    <div v-if="loading" class="entity-grid pokemon-list-grid" aria-busy="true" :aria-label="t('pages.habitats.loadingList')">
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
