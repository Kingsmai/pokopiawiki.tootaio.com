<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import LoadMoreSentinel from '../components/LoadMoreSentinel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import { api, type DailyChecklistItem, type ListPage } from '../services/api';

type ChecklistState = {
  date: string;
  checkedIds: number[];
};

const checklistStateKey = 'pokopia_daily_checklist_state';
const { t, locale } = useI18n();
const stateRefreshIntervalMs = 60_000;
const checklistItems = ref<DailyChecklistItem[]>([]);
const checkedTaskIds = ref<Set<number>>(new Set());
const loading = ref(true);
const loadingMore = ref(false);
const nextCursor = ref<string | null>(null);
const hasMoreItems = ref(false);
const skeletonRows = 5;
const listPageSize = 20;
let stateRefreshTimer: number | null = null;
let loadRequestId = 0;

const { data: initialData } = await useAsyncData<ListPage<DailyChecklistItem> | null>(
  `daily-checklist-initial:${locale.value}`,
  async () => {
    try {
      return await api.dailyChecklistPage({
        cursor: null,
        limit: listPageSize
      });
    } catch {
      return null;
    }
  },
  { default: () => null }
);

const initialPage = initialData.value;
checklistItems.value = initialPage?.items ?? [];
const initialPageLoaded = ref(initialPage !== null);
loading.value = !initialPageLoaded.value;
nextCursor.value = initialPage?.nextCursor ?? null;
hasMoreItems.value = initialPage?.hasMore ?? false;

function todayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function persistChecklistState() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const state: ChecklistState = {
    date: todayKey(),
    checkedIds: [...checkedTaskIds.value]
  };
  localStorage.setItem(checklistStateKey, JSON.stringify(state));
}

function loadChecklistState() {
  if (typeof localStorage === 'undefined') {
    checkedTaskIds.value = new Set();
    return;
  }

  try {
    const state = JSON.parse(localStorage.getItem(checklistStateKey) ?? 'null') as Partial<ChecklistState> | null;
    checkedTaskIds.value = state?.date === todayKey() ? new Set(state.checkedIds?.filter((id) => Number.isInteger(id))) : new Set();
  } catch {
    checkedTaskIds.value = new Set();
  }

  persistChecklistState();
}

function syncChecklistState() {
  const checklistIds = new Set(checklistItems.value.map((item) => item.id));
  const nextCheckedIds = new Set([...checkedTaskIds.value].filter((id) => checklistIds.has(id)));
  if (nextCheckedIds.size !== checkedTaskIds.value.size) {
    checkedTaskIds.value = nextCheckedIds;
    persistChecklistState();
  }
}

function isTaskChecked(id: number) {
  return checkedTaskIds.value.has(id);
}

function toggleTask(id: number, checked: boolean) {
  const nextCheckedIds = new Set(checkedTaskIds.value);
  if (checked) {
    nextCheckedIds.add(id);
  } else {
    nextCheckedIds.delete(id);
  }

  checkedTaskIds.value = nextCheckedIds;
  persistChecklistState();
}

function handleTaskChange(id: number, event: Event) {
  const checkbox = event.target instanceof HTMLInputElement ? event.target : null;
  toggleTask(id, checkbox?.checked === true);
}

async function loadDailyChecklist(reset = true) {
  if (!reset && (loading.value || loadingMore.value || !hasMoreItems.value)) {
    return;
  }

  const requestId = ++loadRequestId;
  if (reset) {
    loading.value = true;
    loadingMore.value = false;
    nextCursor.value = null;
    hasMoreItems.value = false;
  } else {
    loadingMore.value = true;
  }

  try {
    const page = await api.dailyChecklistPage({
      cursor: reset ? null : nextCursor.value,
      limit: listPageSize
    });

    if (requestId !== loadRequestId) {
      return;
    }

    if (reset) {
      checklistItems.value = page.items;
    } else {
      const existingIds = new Set(checklistItems.value.map((item) => item.id));
      checklistItems.value = [...checklistItems.value, ...page.items.filter((item) => !existingIds.has(item.id))];
    }
    nextCursor.value = page.nextCursor;
    hasMoreItems.value = page.hasMore;
    initialPageLoaded.value = true;
    if (!page.hasMore) {
      syncChecklistState();
    }
  } catch {
    if (requestId === loadRequestId && reset) {
      checklistItems.value = [];
      nextCursor.value = null;
      hasMoreItems.value = false;
      initialPageLoaded.value = true;
    }
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function loadMoreDailyChecklist() {
  void loadDailyChecklist(false);
}

onMounted(() => {
  loadChecklistState();
  if (initialPageLoaded.value && !hasMoreItems.value) {
    syncChecklistState();
  }
  stateRefreshTimer = window.setInterval(loadChecklistState, stateRefreshIntervalMs);
  if (!initialPageLoaded.value) {
    void loadDailyChecklist();
  }
});

onUnmounted(() => {
  if (stateRefreshTimer !== null) {
    window.clearInterval(stateRefreshTimer);
  }
});
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="t('pages.checklist.title')" :subtitle="t('pages.checklist.subtitle')">
      <template #kicker>CheckList</template>
    </PageHeader>

    <section class="detail-section" :aria-busy="loading">
      <h2>{{ t('pages.checklist.sectionTitle') }}</h2>

      <ul v-if="loading" class="row-list skeleton-row-list checklist-skeleton-list" :aria-label="t('pages.checklist.loading')">
        <li v-for="index in skeletonRows" :key="index">
          <Skeleton variant="box" width="34px" height="34px" />
          <Skeleton :width="index % 2 === 0 ? '220px' : '160px'" />
        </li>
      </ul>

      <ul v-else-if="checklistItems.length" class="checklist-list">
        <li v-for="item in checklistItems" :key="item.id" class="checklist-item" :class="{ 'is-checked': isTaskChecked(item.id) }">
          <label class="checklist-check">
            <input
              type="checkbox"
              :checked="isTaskChecked(item.id)"
              @change="handleTaskChange(item.id, $event)"
            />
            <span>{{ item.title }}</span>
          </label>
        </li>
        <li v-for="index in loadingMore ? 2 : 0" :key="`checklist-more-${index}`" class="checklist-item checklist-check" aria-hidden="true">
          <Skeleton variant="box" width="34px" height="34px" />
          <Skeleton :width="index % 2 === 0 ? '220px' : '160px'" />
        </li>
      </ul>

      <p v-else class="meta-line">{{ t('pages.checklist.empty') }}</p>
      <LoadMoreSentinel :active="hasMoreItems" :disabled="loading || loadingMore" @load="loadMoreDailyChecklist" />
    </section>
  </section>
</template>
