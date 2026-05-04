<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditHistoryPanel from '../components/EditHistoryPanel.vue';
import EntityChips from '../components/EntityChips.vue';
import EntityDiscussionPanel from '../components/EntityDiscussionPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import { iconArtifact, iconBack, iconEdit } from '../icons';
import { applySeo } from '../seo';
import { api, getAuthToken, type AncientArtifactDetail, type AuthUser } from '../services/api';
import AncientArtifactEdit from './AncientArtifactEdit.vue';

const route = useRoute();
const { t } = useI18n();
const artifact = ref<AncientArtifactDetail | null>(null);
const currentUser = ref<AuthUser | null>(null);
const detailTab = ref('details');
const showEditor = computed(() => route.name === 'ancient-artifact-edit');
const canUpdateArtifact = computed(() => currentUser.value?.permissions.includes('ancient-artifacts.update') === true);
const detailTabs = computed<TabOption[]>(() => [
  { value: 'details', label: t('common.details') },
  { value: 'discussion', label: t('discussion.title') },
  { value: 'history', label: t('history.editHistory') }
]);

async function loadArtifactDetail() {
  const nextArtifact = await api.ancientArtifactDetail(String(route.params.id));
  artifact.value = nextArtifact;

  if (route.meta.editorModal !== true) {
    applySeo({
      title: `${nextArtifact.name} - ${t('pages.ancientArtifacts.title')}`,
      description: t('seo.ancientArtifactDetailDescription', { name: nextArtifact.name }),
      canonicalPath: `/ancient-artifacts/${nextArtifact.id}`,
      image: nextArtifact.image?.url
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
  await loadArtifactDetail();
});

watch(
  () => route.name,
  (name, oldName) => {
    if (oldName === 'ancient-artifact-edit' && name === 'ancient-artifact-detail') {
      void loadArtifactDetail();
    }
  }
);

watch(
  () => route.params.id,
  () => {
    artifact.value = null;
    detailTab.value = 'details';
    void loadArtifactDetail();
  }
);
</script>

<template>
  <section v-if="!artifact" class="page-stack" aria-busy="true" :aria-label="t('pages.ancientArtifacts.loadingDetail')">
    <div class="page-header page-header--skeleton" aria-hidden="true">
      <div class="page-header__copy">
        <Skeleton width="132px" />
        <Skeleton width="260px" height="46px" />
        <Skeleton width="220px" />
      </div>
      <div class="page-header__actions">
        <Skeleton variant="box" width="88px" height="36px" />
      </div>
    </div>

    <section class="detail-section skeleton-detail-section" aria-hidden="true">
      <div class="detail-section__header">
        <Skeleton width="112px" height="24px" />
      </div>
      <div class="detail-section__body">
        <Skeleton width="45%" />
        <Skeleton variant="box" height="120px" />
      </div>
    </section>
  </section>
  <section v-else class="page-stack">
    <PageHeader :title="`#${artifact.displayId} ${artifact.name}`" :subtitle="artifact.category.name">
      <template #kicker>{{ t('pages.ancientArtifacts.detailKicker') }}</template>
      <template #actions>
        <RouterLink v-if="canUpdateArtifact" class="ui-button ui-button--primary ui-button--small" :to="`/ancient-artifacts/${artifact.id}/edit`">
          <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
          {{ t('common.edit') }}
        </RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/ancient-artifacts">
          <Icon :icon="iconBack" class="ui-icon" aria-hidden="true" />
          {{ t('common.backToList') }}
        </RouterLink>
      </template>
    </PageHeader>

    <div class="detail-tabs">
      <Tabs id="artifact-detail-tabs" v-model="detailTab" :tabs="detailTabs" :label="t('common.details')" />

      <div v-if="detailTab === 'details'" class="detail-grid">
        <DetailSection :title="t('common.details')">
          <dl class="entity-profile-facts">
            <div>
              <dt>{{ t('pages.ancientArtifacts.displayId') }}</dt>
              <dd>#{{ artifact.displayId }}</dd>
            </div>
            <div>
              <dt>{{ t('pages.ancientArtifacts.category') }}</dt>
              <dd>{{ artifact.category.name }}</dd>
            </div>
          </dl>
        </DetailSection>

        <DetailSection :title="t('media.image')">
          <div class="entity-detail-image">
            <div class="entity-detail-image__frame" :class="{ 'entity-detail-image__frame--placeholder': !artifact.image }">
              <img v-if="artifact.image" :src="artifact.image.url" :alt="t('media.imageAlt', { name: artifact.name })" />
              <span v-else class="entity-card__mark entity-detail-image__mark" role="img" :aria-label="t('media.imageEmpty')">
                <Icon :icon="iconArtifact" class="entity-card__icon" aria-hidden="true" />
              </span>
            </div>
          </div>
        </DetailSection>

        <DetailSection :title="t('pages.ancientArtifacts.description')">
          <p v-if="artifact.details" class="preserve-lines">{{ artifact.details }}</p>
          <p v-else class="meta-line">{{ t('common.none') }}</p>
        </DetailSection>

        <DetailSection :title="t('pages.ancientArtifacts.category')">
          <span class="chip">
            <Icon :icon="iconArtifact" class="ui-icon" aria-hidden="true" />
            {{ artifact.category.name }}
          </span>
        </DetailSection>

        <DetailSection :title="t('pages.ancientArtifacts.tags')">
          <EntityChips v-if="artifact.tags.length" :items="artifact.tags" />
          <p v-else class="meta-line">{{ t('common.none') }}</p>
        </DetailSection>
      </div>

      <div v-else-if="detailTab === 'discussion'" class="detail-tab-panel">
        <EntityDiscussionPanel entity-type="ancient-artifacts" :entity-id="artifact.id" />
      </div>

      <div v-else class="detail-tab-panel">
        <EditHistoryPanel :entity="artifact" :history="artifact.editHistory" />
      </div>
    </div>
  </section>

  <AncientArtifactEdit v-if="showEditor" />
</template>
