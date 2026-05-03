<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PokeBallMark from '../components/PokeBallMark.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusBadge from '../components/StatusBadge.vue';
import {
  iconAction,
  iconAutomation,
  iconChevronRight,
  iconChecklist,
  iconClothes,
  iconDish,
  iconDreamIsland,
  iconEvent,
  iconExternal,
  iconGitCommit,
  iconHabitat,
  iconItem,
  iconLife,
  iconPokemon,
  iconRecipe
} from '../icons';
import { api, type ProjectUpdateCommit, type ProjectUpdates } from '../services/api';

const { t, locale } = useI18n();
const projectCommitPageSize = 5;
const projectUpdates = ref<ProjectUpdates | null>(null);
const projectUpdatesLoading = ref(true);
const projectCommits = ref<ProjectUpdateCommit[]>([]);

const primarySections = computed(() => [
  { key: 'pokemon', to: '/pokemon', icon: iconPokemon },
  { key: 'habitats', to: '/habitats', icon: iconHabitat },
  { key: 'items', to: '/items', icon: iconItem },
  { key: 'recipes', to: '/recipes', icon: iconRecipe }
]);

const communitySections = computed(() => [
  { key: 'checklist', to: '/checklist', icon: iconChecklist },
  { key: 'life', to: '/life', icon: iconLife }
]);

const futureSections = computed(() => [
  { key: 'automation', to: '/automation', icon: iconAutomation },
  { key: 'dish', to: '/dish', icon: iconDish },
  { key: 'events', to: '/events', icon: iconEvent },
  { key: 'actions', to: '/actions', icon: iconAction },
  { key: 'dreamIsland', to: '/dream-island', icon: iconDreamIsland },
  { key: 'clothes', to: '/clothes', icon: iconClothes }
]);

const latestReleases = computed(() => projectUpdates.value?.releases.slice(0, 3) ?? []);
const showProjectUpdates = computed(
  () => projectUpdatesLoading.value || projectCommits.value.length > 0 || latestReleases.value.length > 0
);
const showProjectUpdatesViewAll = computed(() => projectCommits.value.length > 0 || latestReleases.value.length > 0);
const repositoryUpdatedAt = computed(() => formatDateTime(projectUpdates.value?.repository.updatedAt ?? null));

onMounted(() => {
  void loadProjectUpdates();
});

function sectionTitleKey(key: string) {
  return `pages.home.sections.${key}.title`;
}

function sectionDescriptionKey(key: string) {
  return `pages.home.sections.${key}.description`;
}

async function loadProjectUpdates(): Promise<void> {
  projectUpdatesLoading.value = true;
  try {
    const updates = await api.projectUpdates({ limit: projectCommitPageSize });
    projectUpdates.value = updates;
    projectCommits.value = updates.commits.items;
  } catch {
    projectUpdates.value = null;
    projectCommits.value = [];
  } finally {
    projectUpdatesLoading.value = false;
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}
</script>

<template>
  <section class="home-page">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero__copy">
        <span class="page-kicker">{{ t('pages.home.kicker') }}</span>
        <h1 id="home-title" class="home-hero__title">{{ t('pages.home.title') }}</h1>
        <p class="home-hero__subtitle">{{ t('pages.home.subtitle') }}</p>

        <div class="home-hero__actions" :aria-label="t('pages.home.primaryActions')">
          <RouterLink class="ui-button ui-button--primary" to="/pokemon">
            <Icon :icon="iconPokemon" class="ui-icon" aria-hidden="true" />
            {{ t('pages.home.browsePokemon') }}
          </RouterLink>
          <RouterLink class="ui-button ui-button--blue" to="/checklist">
            <Icon :icon="iconChecklist" class="ui-icon" aria-hidden="true" />
            {{ t('pages.home.openChecklist') }}
          </RouterLink>
          <RouterLink class="ui-button ui-button--ghost" to="/life">
            <Icon :icon="iconLife" class="ui-icon" aria-hidden="true" />
            {{ t('pages.home.openLife') }}
          </RouterLink>
        </div>

        <div class="home-quick-index" :aria-label="t('pages.home.quickIndex')">
          <RouterLink v-for="section in primarySections" :key="section.key" :to="section.to">
            <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
            <span>{{ t(sectionTitleKey(section.key)) }}</span>
          </RouterLink>
        </div>
      </div>

      <aside class="home-dex" :aria-label="t('pages.home.featuredPanel')">
        <div class="home-dex__head">
          <div class="home-dex__lights" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>{{ t('pages.home.dexCode') }}</span>
        </div>
        <div class="home-dex__screen">
          <PokeBallMark size="84px" />
          <div class="home-dex__copy">
            <strong>{{ t('pages.home.dexTitle') }}</strong>
            <p>{{ t('pages.home.dexBody') }}</p>
          </div>
          <div class="home-dex__tiles">
            <RouterLink v-for="section in primarySections" :key="section.key" :to="section.to">
              <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
              <span>{{ t(sectionTitleKey(section.key)) }}</span>
            </RouterLink>
          </div>
        </div>
      </aside>
    </section>

    <section class="home-section" aria-labelledby="home-wiki-title">
      <div class="home-section__header">
        <span class="page-kicker">{{ t('pages.home.wikiKicker') }}</span>
        <h2 id="home-wiki-title">{{ t('pages.home.wikiTitle') }}</h2>
      </div>

      <div class="home-card-grid home-card-grid--primary">
        <RouterLink v-for="section in primarySections" :key="section.key" class="home-card" :to="section.to">
          <span class="home-card__icon">
            <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
          </span>
          <span class="home-card__copy">
            <strong>{{ t(sectionTitleKey(section.key)) }}</strong>
            <span>{{ t(sectionDescriptionKey(section.key)) }}</span>
          </span>
        </RouterLink>
      </div>
    </section>

    <section class="home-section" aria-labelledby="home-community-title">
      <div class="home-section__header">
        <span class="page-kicker">{{ t('pages.home.communityKicker') }}</span>
        <h2 id="home-community-title">{{ t('pages.home.communityTitle') }}</h2>
      </div>

      <div class="home-card-grid home-card-grid--community">
        <RouterLink v-for="section in communitySections" :key="section.key" class="home-card home-card--wide" :to="section.to">
          <span class="home-card__icon">
            <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
          </span>
          <span class="home-card__copy">
            <strong>{{ t(sectionTitleKey(section.key)) }}</strong>
            <span>{{ t(sectionDescriptionKey(section.key)) }}</span>
          </span>
        </RouterLink>
      </div>
    </section>

    <section v-if="showProjectUpdates" class="home-section home-project-updates" aria-labelledby="home-project-updates-title">
      <div class="home-section__header">
        <span class="page-kicker">{{ t('pages.home.projectUpdatesKicker') }}</span>
        <h2 id="home-project-updates-title">{{ t('pages.home.projectUpdatesTitle') }}</h2>
      </div>

      <div class="home-project-updates__panel">
        <div v-if="projectUpdates" class="home-project-updates__repo">
          <span class="home-project-updates__repo-label">{{ t('pages.home.projectUpdatesRepo') }}</span>
          <a :href="projectUpdates.repository.url" target="_blank" rel="noreferrer">
            <Icon :icon="iconGitCommit" class="ui-icon" aria-hidden="true" />
            {{ projectUpdates.repository.fullName }}
          </a>
          <span v-if="repositoryUpdatedAt" class="home-project-updates__updated">
            {{ t('pages.home.projectUpdatesUpdatedAt', { date: repositoryUpdatedAt }) }}
          </span>
        </div>

        <div v-if="projectUpdatesLoading" class="home-project-updates__skeleton">
          <Skeleton width="42%" />
          <Skeleton width="76%" />
          <Skeleton width="64%" />
        </div>

        <div v-else-if="projectUpdates" class="home-project-updates__content">
          <div v-if="latestReleases.length" class="home-project-updates__group">
            <h3>{{ t('pages.home.projectUpdatesReleases') }}</h3>
            <ol class="home-project-updates__list">
              <li v-for="release in latestReleases" :key="release.tagName" class="home-project-updates__item">
                <div class="home-project-updates__commit">
                  <div class="home-project-updates__title">
                    <span class="home-project-updates__sha">{{ release.tagName }}</span>
                    <strong>{{ release.name }}</strong>
                  </div>
                  <div v-if="release.publishedAt" class="home-project-updates__meta">
                    <time :datetime="release.publishedAt">{{ formatDateTime(release.publishedAt) }}</time>
                  </div>
                </div>
                <a class="ui-button ui-button--ghost home-project-updates__link" :href="release.url" target="_blank" rel="noreferrer">
                  <Icon :icon="iconExternal" class="ui-icon" aria-hidden="true" />
                  {{ t('pages.home.projectUpdatesViewRelease') }}
                </a>
              </li>
            </ol>
          </div>

          <div v-if="projectCommits.length" class="home-project-updates__group">
            <h3>{{ t('pages.home.projectUpdatesCommits') }}</h3>
            <ol class="home-project-updates__list">
              <li v-for="commit in projectCommits" :key="commit.sha" class="home-project-updates__item">
                <div class="home-project-updates__commit">
                  <div class="home-project-updates__title">
                    <span class="home-project-updates__sha">{{ commit.shortSha }}</span>
                    <strong>{{ commit.title }}</strong>
                  </div>
                  <div class="home-project-updates__meta">
                    <span>{{ commit.authorName }}</span>
                    <time :datetime="commit.createdAt">{{ formatDateTime(commit.createdAt) }}</time>
                  </div>
                </div>
                <a class="ui-button ui-button--ghost home-project-updates__link" :href="commit.url" target="_blank" rel="noreferrer">
                  <Icon :icon="iconExternal" class="ui-icon" aria-hidden="true" />
                  {{ t('pages.home.projectUpdatesViewCommit') }}
                </a>
              </li>
            </ol>

            <div v-if="showProjectUpdatesViewAll" class="home-project-updates__actions">
              <RouterLink class="ui-button ui-button--blue ui-button--small" to="/project-updates">
                <Icon :icon="iconChevronRight" class="ui-icon" aria-hidden="true" />
                {{ t('pages.home.projectUpdatesViewAll') }}
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="home-section" aria-labelledby="home-future-title">
      <div class="home-section__header">
        <span class="page-kicker">{{ t('pages.home.futureKicker') }}</span>
        <h2 id="home-future-title">{{ t('pages.home.futureTitle') }}</h2>
      </div>

      <div class="home-card-grid home-card-grid--future">
        <RouterLink v-for="section in futureSections" :key="section.key" class="home-card home-card--future" :to="section.to">
          <span class="home-card__icon">
            <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
          </span>
          <span class="home-card__copy">
            <strong>{{ t(sectionTitleKey(section.key)) }}</strong>
            <span>{{ t(sectionDescriptionKey(section.key)) }}</span>
          </span>
          <StatusBadge :label="t('common.inDev')" tone="info" compact />
        </RouterLink>
      </div>
    </section>
  </section>
</template>
