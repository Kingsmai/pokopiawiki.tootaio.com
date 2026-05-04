<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { iconClose, iconSearch } from '../icons';
import { api, type GlobalSearchGroup, type GlobalSearchGroupType, type GlobalSearchItem } from '../services/api';

const emit = defineEmits<{
  navigate: [];
}>();

const { t } = useI18n();
const router = useRouter();
const root = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const query = ref('');
const groups = ref<GlobalSearchGroup[]>([]);
const open = ref(false);
const mobileOpen = ref(false);
const loading = ref(false);
const failed = ref(false);
let searchTimeout: number | null = null;
let abortController: AbortController | null = null;
let requestId = 0;

const cleanQuery = computed(() => query.value.trim());
const hasResults = computed(() => groups.value.some((group) => group.items.length > 0));
const firstResult = computed(() => groups.value.find((group) => group.items.length > 0)?.items[0] ?? null);
const panelVisible = computed(() => open.value && cleanQuery.value !== '' && (loading.value || failed.value || groups.value.length > 0));

const groupLabels: Record<GlobalSearchGroupType, string> = {
  pokemon: 'search.groups.pokemon',
  habitats: 'search.groups.habitats',
  items: 'search.groups.items',
  'ancient-artifacts': 'search.groups.ancientArtifacts',
  recipes: 'search.groups.recipes',
  'daily-checklist': 'search.groups.dailyChecklist',
  life: 'search.groups.life'
};

function clearSearchTimeout() {
  if (searchTimeout !== null) {
    window.clearTimeout(searchTimeout);
    searchTimeout = null;
  }
}

function abortSearch() {
  abortController?.abort();
  abortController = null;
}

function resetResults() {
  groups.value = [];
  failed.value = false;
  loading.value = false;
}

async function runSearch(value: string) {
  const currentRequestId = ++requestId;
  abortSearch();
  const controller = new AbortController();
  abortController = controller;
  loading.value = true;
  failed.value = false;

  try {
    const response = await api.globalSearch(value, controller.signal);
    if (currentRequestId === requestId) {
      groups.value = response.groups;
    }
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }
    if (currentRequestId === requestId) {
      groups.value = [];
      failed.value = true;
    }
  } finally {
    if (currentRequestId === requestId) {
      loading.value = false;
      if (abortController === controller) {
        abortController = null;
      }
    }
  }
}

function scheduleSearch() {
  clearSearchTimeout();
  const value = cleanQuery.value;
  if (!value) {
    requestId += 1;
    abortSearch();
    resetResults();
    return;
  }

  requestId += 1;
  abortSearch();
  loading.value = true;
  failed.value = false;
  searchTimeout = window.setTimeout(() => {
    searchTimeout = null;
    void runSearch(value);
  }, 240);
}

function openPanel() {
  open.value = true;
}

function closePanel() {
  open.value = false;
}

function toggleMobileSearch() {
  mobileOpen.value = !mobileOpen.value;
  openPanel();
  if (mobileOpen.value) {
    void nextTick(() => input.value?.focus());
  }
}

function clearQuery() {
  query.value = '';
  resetResults();
  openPanel();
  void nextTick(() => input.value?.focus());
}

function onSubmit() {
  const item = firstResult.value;
  if (!item) {
    openPanel();
    return;
  }

  void navigateTo(item);
}

async function navigateTo(item: GlobalSearchItem) {
  selectResult();
  await router.push(item.url);
}

function selectResult() {
  closePanel();
  mobileOpen.value = false;
  emit('navigate');
}

function onRootKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePanel();
    input.value?.blur();
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) {
    closePanel();
  }
}

function groupLabel(type: GlobalSearchGroupType) {
  return t(groupLabels[type]);
}

watch(query, scheduleSearch);

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
});

onBeforeUnmount(() => {
  clearSearchTimeout();
  abortSearch();
  document.removeEventListener('pointerdown', onDocumentPointerDown);
});
</script>

<template>
  <div
    ref="root"
    class="global-search"
    :class="{ 'global-search--mobile-open': mobileOpen }"
    @keydown="onRootKeydown"
  >
    <button
      class="global-search__toggle"
      type="button"
      :aria-label="t('search.open')"
      :aria-expanded="mobileOpen"
      @click="toggleMobileSearch"
    >
      <Icon :icon="mobileOpen ? iconClose : iconSearch" class="ui-icon" aria-hidden="true" />
    </button>

    <form class="global-search__form" role="search" @submit.prevent="onSubmit">
      <Icon :icon="iconSearch" class="ui-icon global-search__form-icon" aria-hidden="true" />
      <input
        ref="input"
        v-model="query"
        class="global-search__input"
        type="search"
        :placeholder="t('search.placeholder')"
        :aria-label="t('search.label')"
        :aria-controls="panelVisible ? 'global-search-results' : undefined"
        :aria-expanded="panelVisible"
        autocomplete="off"
        @focus="openPanel"
      />
      <button
        v-if="cleanQuery"
        class="global-search__clear"
        type="button"
        :aria-label="t('search.clear')"
        @click="clearQuery"
      >
        <Icon :icon="iconClose" class="ui-icon" aria-hidden="true" />
      </button>
    </form>

    <div
      v-if="panelVisible"
      id="global-search-results"
      class="global-search__panel"
      :aria-busy="loading"
    >
      <div v-if="loading" class="global-search__skeleton" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <p v-else-if="failed" class="global-search__message">{{ t('search.failed') }}</p>
      <p v-else-if="!hasResults" class="global-search__message">{{ t('search.empty') }}</p>

      <template v-else>
        <section
          v-for="group in groups"
          :key="group.type"
          class="global-search__group"
          :aria-label="groupLabel(group.type)"
        >
          <h2 class="global-search__group-title">{{ groupLabel(group.type) }}</h2>
          <RouterLink
            v-for="item in group.items"
            :key="`${group.type}-${item.id}`"
            class="global-search__result"
            :to="item.url"
            @click="selectResult"
          >
            <img
              v-if="item.image"
              class="global-search__result-image"
              :src="item.image.url"
              :alt="item.title"
              loading="lazy"
            />
            <span v-else class="global-search__result-mark" aria-hidden="true">
              <Icon :icon="iconSearch" class="ui-icon" aria-hidden="true" />
            </span>
            <span class="global-search__result-copy">
              <span class="global-search__result-title">{{ item.title }}</span>
              <span v-if="item.summary || item.meta" class="global-search__result-meta">
                <span v-if="item.meta">{{ item.meta }}</span>
                <span v-if="item.summary">{{ item.summary }}</span>
              </span>
            </span>
          </RouterLink>
        </section>
      </template>
    </div>
  </div>
</template>
