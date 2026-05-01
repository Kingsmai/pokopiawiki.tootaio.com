<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import { api, type DailyChecklistItem } from '../services/api';

type ChecklistState = {
  date: string;
  checkedIds: number[];
};

const checklistStateKey = 'pokopia_daily_checklist_state';
const stateRefreshIntervalMs = 60_000;
const checklistItems = ref<DailyChecklistItem[]>([]);
const checkedTaskIds = ref<Set<number>>(new Set());
const loading = ref(true);
const skeletonRows = 5;
let stateRefreshTimer: number | null = null;

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

async function loadDailyChecklist() {
  loading.value = true;
  try {
    checklistItems.value = await api.dailyChecklist();
    syncChecklistState();
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadChecklistState();
  stateRefreshTimer = window.setInterval(loadChecklistState, stateRefreshIntervalMs);
  void loadDailyChecklist();
});

onUnmounted(() => {
  if (stateRefreshTimer !== null) {
    window.clearInterval(stateRefreshTimer);
  }
});
</script>

<template>
  <section class="page-stack">
    <PageHeader title="每日清单" subtitle="查看每天可以完成的事项。">
      <template #kicker>CheckList</template>
    </PageHeader>

    <section class="detail-section" :aria-busy="loading">
      <h2>每日做什么</h2>

      <ul v-if="loading" class="row-list skeleton-row-list checklist-skeleton-list" aria-label="正在加载每日清单">
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
      </ul>

      <p v-else class="meta-line">暂无每日清单</p>
    </section>
  </section>
</template>
