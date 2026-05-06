<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import {
  iconChevronDown,
  iconChevronUp,
  iconExternal,
  iconGitCommit,
  iconWarning
} from '../icons';
import { api, type ProjectUpdateCommit, type ProjectUpdates } from '../services/api';

const { t, locale } = useI18n();
const projectCommitPageSize = 10;
const projectUpdates = ref<ProjectUpdates | null>(null);
const projectCommits = ref<ProjectUpdateCommit[]>([]);
const projectCommitCursor = ref<string | null>(null);
const projectHasMoreCommits = ref(false);
const loading = ref(true);
const loadingMore = ref(false);
const loadError = ref(false);
const loadMorePaused = ref(false);
const loadMoreSentinel = ref<HTMLElement | null>(null);
const expandedCommitShas = ref<Set<string>>(new Set());
let projectUpdatesObserver: IntersectionObserver | null = null;

const { data: initialData } = await useAsyncData<ProjectUpdates | null>(
  `project-updates-initial:${locale.value}`,
  async () => {
    try {
      return await api.projectUpdates({ limit: projectCommitPageSize });
    } catch {
      return null;
    }
  },
  { default: () => null }
);

const initialUpdates = initialData.value;
projectUpdates.value = initialUpdates;
projectCommits.value = initialUpdates?.commits.items ?? [];
projectCommitCursor.value = initialUpdates?.commits.nextCursor ?? null;
projectHasMoreCommits.value = initialUpdates?.commits.hasMore ?? false;
const initialUpdatesLoaded = ref(initialUpdates !== null);
loading.value = !initialUpdatesLoaded.value;

const releases = computed(() => projectUpdates.value?.releases ?? []);
const repositoryUpdatedAt = computed(() => formatDateTime(projectUpdates.value?.repository.updatedAt ?? null));

onMounted(() => {
  if (!initialUpdatesLoaded.value) {
    void loadProjectUpdates();
  }
});

onBeforeUnmount(() => {
  disconnectProjectUpdatesObserver();
});

async function loadProjectUpdates(): Promise<void> {
  loading.value = true;
  loadingMore.value = false;
  loadError.value = false;
  loadMorePaused.value = false;
  projectCommitCursor.value = null;
  projectHasMoreCommits.value = false;
  expandedCommitShas.value = new Set();

  try {
    const updates = await api.projectUpdates({ limit: projectCommitPageSize });
    projectUpdates.value = updates;
    projectCommits.value = updates.commits.items;
    projectCommitCursor.value = updates.commits.nextCursor;
    projectHasMoreCommits.value = updates.commits.hasMore;
    initialUpdatesLoaded.value = true;
  } catch {
    projectUpdates.value = null;
    projectCommits.value = [];
    initialUpdatesLoaded.value = true;
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

async function loadMoreProjectUpdates(): Promise<void> {
  if (loading.value || loadingMore.value || loadMorePaused.value || !projectHasMoreCommits.value) {
    return;
  }

  const cursor = projectCommitCursor.value;
  if (!cursor) {
    projectHasMoreCommits.value = false;
    return;
  }

  loadingMore.value = true;

  try {
    const updates = await api.projectUpdates({
      cursor,
      limit: projectCommitPageSize
    });
    projectUpdates.value = updates;
    const existingShas = new Set(projectCommits.value.map((commit) => commit.sha));
    projectCommits.value = [...projectCommits.value, ...updates.commits.items.filter((commit) => !existingShas.has(commit.sha))];
    projectCommitCursor.value = updates.commits.nextCursor;
    projectHasMoreCommits.value = updates.commits.hasMore;
  } catch {
    loadMorePaused.value = true;
  } finally {
    loadingMore.value = false;
  }
}

function retryLoadMore(): void {
  loadMorePaused.value = false;
  void loadMoreProjectUpdates();
}

function toggleCommitMessage(sha: string): void {
  const nextExpanded = new Set(expandedCommitShas.value);
  if (nextExpanded.has(sha)) {
    nextExpanded.delete(sha);
  } else {
    nextExpanded.add(sha);
  }
  expandedCommitShas.value = nextExpanded;
}

function isCommitExpanded(sha: string): boolean {
  return expandedCommitShas.value.has(sha);
}

function disconnectProjectUpdatesObserver(): void {
  projectUpdatesObserver?.disconnect();
  projectUpdatesObserver = null;
}

function observeProjectUpdatesLoadMore(): void {
  disconnectProjectUpdatesObserver();

  if (loading.value || loadingMore.value || loadMorePaused.value || !projectHasMoreCommits.value || !loadMoreSentinel.value) {
    return;
  }

  if (typeof IntersectionObserver === 'undefined') {
    void loadMoreProjectUpdates();
    return;
  }

  projectUpdatesObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMoreProjectUpdates();
      }
    },
    { rootMargin: '360px 0px' }
  );
  projectUpdatesObserver.observe(loadMoreSentinel.value);
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

watch([loadMoreSentinel, projectHasMoreCommits, loading, loadingMore, loadMorePaused], observeProjectUpdatesLoadMore, {
  flush: 'post'
});
</script>

<template>
  <section class="page-stack project-updates-page">
    <PageHeader :title="t('pages.projectUpdates.title')" :subtitle="t('pages.projectUpdates.subtitle')">
      <template #kicker>{{ t('pages.projectUpdates.kicker') }}</template>
      <template v-if="projectUpdates" #actions>
        <a class="ui-button ui-button--ghost" :href="projectUpdates.repository.url" target="_blank" rel="noreferrer">
          <Icon :icon="iconExternal" class="ui-icon" aria-hidden="true" />
          {{ t('pages.projectUpdates.openRepository') }}
        </a>
      </template>
    </PageHeader>

    <section v-if="loading" class="project-updates-panel" aria-busy="true" :aria-label="t('pages.projectUpdates.loading')">
      <Skeleton width="40%" height="22px" />
      <Skeleton width="76%" />
      <Skeleton width="64%" />
      <Skeleton variant="box" height="78px" />
      <Skeleton variant="box" height="78px" />
      <Skeleton variant="box" height="78px" />
    </section>

    <section v-else-if="loadError" class="project-updates-panel">
      <p class="status">{{ t('errors.loadFailed') }}</p>
      <button class="ui-button ui-button--ghost" type="button" @click="loadProjectUpdates">
        <Icon :icon="iconWarning" class="ui-icon" aria-hidden="true" />
        {{ t('pages.projectUpdates.retry') }}
      </button>
    </section>

    <template v-else-if="projectUpdates">
      <section class="project-updates-panel">
        <div class="project-updates-repo">
          <span class="project-updates-repo__icon" aria-hidden="true">
            <Icon :icon="iconGitCommit" class="ui-icon" />
          </span>
          <div class="project-updates-repo__copy">
            <span>{{ t('pages.projectUpdates.sourceRepository') }}</span>
            <a :href="projectUpdates.repository.url" target="_blank" rel="noreferrer">
              {{ projectUpdates.repository.fullName }}
            </a>
          </div>
          <span v-if="repositoryUpdatedAt" class="project-updates-repo__meta">
            {{ t('pages.projectUpdates.updatedAt', { date: repositoryUpdatedAt }) }}
          </span>
        </div>
      </section>

      <section v-if="releases.length" class="project-updates-panel">
        <h2>{{ t('pages.projectUpdates.releases') }}</h2>
        <ol class="project-updates-list">
          <li v-for="release in releases" :key="release.tagName" class="project-updates-list__item">
            <div class="project-updates-list__main">
              <div class="project-updates-list__title">
                <span class="project-updates-list__sha">{{ release.tagName }}</span>
                <strong>{{ release.name }}</strong>
              </div>
              <div v-if="release.publishedAt" class="project-updates-list__meta">
                <time :datetime="release.publishedAt">{{ formatDateTime(release.publishedAt) }}</time>
              </div>
            </div>
            <a class="ui-button ui-button--ghost ui-button--small" :href="release.url" target="_blank" rel="noreferrer">
              <Icon :icon="iconExternal" class="ui-icon" aria-hidden="true" />
              {{ t('pages.projectUpdates.viewRelease') }}
            </a>
          </li>
        </ol>
      </section>

      <section class="project-updates-panel">
        <h2>{{ t('pages.projectUpdates.commits') }}</h2>
        <ol v-if="projectCommits.length" class="project-updates-list">
          <li v-for="commit in projectCommits" :key="commit.sha" class="project-updates-list__item project-updates-list__item--commit">
            <div class="project-updates-list__row">
              <div class="project-updates-list__main">
                <div class="project-updates-list__title">
                  <span class="project-updates-list__sha">{{ commit.shortSha }}</span>
                  <strong>{{ commit.title }}</strong>
                </div>
                <div class="project-updates-list__meta">
                  <span>{{ commit.authorName }}</span>
                  <time :datetime="commit.createdAt">{{ formatDateTime(commit.createdAt) }}</time>
                </div>
              </div>
              <div class="project-updates-list__actions">
                <button
                  class="ui-button ui-button--ghost ui-button--small"
                  type="button"
                  :aria-expanded="isCommitExpanded(commit.sha)"
                  @click="toggleCommitMessage(commit.sha)"
                >
                  <Icon :icon="isCommitExpanded(commit.sha) ? iconChevronUp : iconChevronDown" class="ui-icon" aria-hidden="true" />
                  {{ isCommitExpanded(commit.sha) ? t('pages.projectUpdates.collapseMessage') : t('pages.projectUpdates.expandMessage') }}
                </button>
                <a class="ui-button ui-button--ghost ui-button--small" :href="commit.url" target="_blank" rel="noreferrer">
                  <Icon :icon="iconExternal" class="ui-icon" aria-hidden="true" />
                  {{ t('pages.projectUpdates.viewCommit') }}
                </a>
              </div>
            </div>
            <div v-if="isCommitExpanded(commit.sha)" class="project-updates-message">
              <span>{{ t('pages.projectUpdates.commitMessage') }}</span>
              <pre>{{ commit.message }}</pre>
            </div>
          </li>
        </ol>
        <p v-else class="meta-line">{{ t('pages.projectUpdates.empty') }}</p>

        <div v-if="loadingMore" class="project-updates-more-skeleton">
          <Skeleton width="82%" />
          <Skeleton width="58%" />
        </div>

        <div v-if="projectHasMoreCommits" ref="loadMoreSentinel" class="project-updates-sentinel" aria-hidden="true"></div>

        <div v-if="loadMorePaused && projectHasMoreCommits" class="project-updates-actions">
          <button class="ui-button ui-button--ghost ui-button--small" type="button" @click="retryLoadMore">
            <Icon :icon="iconWarning" class="ui-icon" aria-hidden="true" />
            {{ t('pages.projectUpdates.retry') }}
          </button>
        </div>
      </section>
    </template>
  </section>
</template>
