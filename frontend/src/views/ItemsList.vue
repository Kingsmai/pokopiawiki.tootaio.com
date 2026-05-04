<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { iconAdd, iconChevronDown, iconItem } from '../icons';
import { api, getAuthToken, type AuthUser, type Item, type Options } from '../services/api';
import ItemEdit from './ItemEdit.vue';

const props = defineProps<{
  eventOnly?: boolean;
}>();

const options = ref<Options | null>(null);
const route = useRoute();
const { t } = useI18n();
const items = ref<Item[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const search = ref('');
const categoryId = ref('');
const usageId = ref('');
const tagIds = ref<string[]>([]);
const createDefaultsMenu = ref<HTMLElement | null>(null);
const createDefaultsOpen = ref(false);

type ItemCreateDefaults = {
  categoryId: string;
  dyeable: boolean;
  dualDyeable: boolean;
  patternEditable: boolean;
  noRecipe: boolean;
  acquisitionMethodIds: string[];
};

const itemCreateDefaultsStorageKey = 'pokopia_item_create_defaults';

const emptyItemCreateDefaults = (): ItemCreateDefaults => ({
  categoryId: '',
  dyeable: false,
  dualDyeable: false,
  patternEditable: false,
  noRecipe: false,
  acquisitionMethodIds: []
});

const itemCreateDefaults = ref<ItemCreateDefaults>(readItemCreateDefaults());

const categorySkeletonWidths = ['64px', '92px', '78px', '104px', '86px'];
const filterSkeletonWidths = ['52px', '48px', '48px'];
const skeletonCardCount = 6;
const pageTitle = computed(() => (props.eventOnly ? t('pages.eventItems.title') : t('pages.items.title')));
const pageSubtitle = computed(() => (props.eventOnly ? t('pages.eventItems.subtitle') : t('pages.items.subtitle')));
const pageKicker = computed(() => (props.eventOnly ? t('pages.eventItems.kicker') : t('pages.items.kicker')));
const createTarget = computed(() => (props.eventOnly ? '/event-items/new' : '/items/new'));

const categoryTabs = computed<TabOption[]>(() => [
  { value: '', label: t('common.all') },
  ...(options.value?.itemCategories.map((item) => ({ value: String(item.id), label: item.name })) ?? [])
]);

const itemQuery = computed(() => ({
  search: search.value,
  categoryId: categoryId.value,
  usageId: usageId.value,
  tagIds: tagIds.value.join(','),
  isEventItem: props.eventOnly
}));
const showEditor = computed(() => route.name === 'item-new' || route.name === 'event-item-new');
const canCreateItem = computed(() => currentUser.value?.permissions.includes('items.create') === true);
const hasItemCreateDefaults = computed(
  () =>
    itemCreateDefaults.value.categoryId !== '' ||
    itemCreateDefaults.value.dyeable ||
    itemCreateDefaults.value.dualDyeable ||
    itemCreateDefaults.value.patternEditable ||
    itemCreateDefaults.value.noRecipe ||
    itemCreateDefaults.value.acquisitionMethodIds.length > 0
);

function itemCardImage(item: Item) {
  return item.image ? { src: item.image.url, alt: t('media.imageAlt', { name: item.name }) } : undefined;
}

function readItemCreateDefaults(): ItemCreateDefaults {
  if (typeof sessionStorage === 'undefined') {
    return emptyItemCreateDefaults();
  }

  try {
    const rawValue = sessionStorage.getItem(itemCreateDefaultsStorageKey);
    if (!rawValue) {
      return emptyItemCreateDefaults();
    }

    const parsedValue = JSON.parse(rawValue) as Partial<ItemCreateDefaults>;
    return {
      categoryId: typeof parsedValue.categoryId === 'string' ? parsedValue.categoryId : '',
      dyeable: parsedValue.dyeable === true,
      dualDyeable: parsedValue.dualDyeable === true,
      patternEditable: parsedValue.patternEditable === true,
      noRecipe: parsedValue.noRecipe === true,
      acquisitionMethodIds: Array.isArray(parsedValue.acquisitionMethodIds)
        ? parsedValue.acquisitionMethodIds.filter((item) => typeof item === 'string')
        : []
    };
  } catch {
    return emptyItemCreateDefaults();
  }
}

function persistItemCreateDefaults() {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  if (!hasItemCreateDefaults.value) {
    sessionStorage.removeItem(itemCreateDefaultsStorageKey);
    return;
  }

  sessionStorage.setItem(itemCreateDefaultsStorageKey, JSON.stringify(itemCreateDefaults.value));
}

function sanitizeItemCreateDefaults() {
  if (!options.value) {
    return;
  }

  const categoryIds = new Set(options.value.itemCategories.map((item) => String(item.id)));
  const methodIds = new Set(options.value.acquisitionMethods.map((item) => String(item.id)));
  const nextDefaults = {
    ...itemCreateDefaults.value,
    categoryId: categoryIds.has(itemCreateDefaults.value.categoryId) ? itemCreateDefaults.value.categoryId : '',
    acquisitionMethodIds: itemCreateDefaults.value.acquisitionMethodIds.filter((item) => methodIds.has(item))
  };

  itemCreateDefaults.value = nextDefaults;
}

function openCreateDefaultsMenu(event?: MouseEvent | KeyboardEvent) {
  event?.preventDefault();
  if (!options.value) {
    return;
  }

  createDefaultsOpen.value = true;
}

function closeCreateDefaultsMenu() {
  createDefaultsOpen.value = false;
}

function toggleCreateDefaultsMenu(event?: MouseEvent) {
  event?.preventDefault();
  if (createDefaultsOpen.value) {
    closeCreateDefaultsMenu();
  } else {
    openCreateDefaultsMenu(event);
  }
}

function clearItemCreateDefaults() {
  itemCreateDefaults.value = emptyItemCreateDefaults();
}

function onCreateDefaultsDocumentPointerDown(event: PointerEvent) {
  if (createDefaultsMenu.value && !createDefaultsMenu.value.contains(event.target as Node)) {
    closeCreateDefaultsMenu();
  }
}

function onCreateDefaultsKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeCreateDefaultsMenu();
  }

  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    openCreateDefaultsMenu(event);
  }
}

async function loadItems() {
  loading.value = true;
  items.value = await api.items(itemQuery.value);
  loading.value = false;
}

onMounted(async () => {
  document.addEventListener('pointerdown', onCreateDefaultsDocumentPointerDown);
  if (getAuthToken()) {
    try {
      currentUser.value = (await api.me()).user;
    } catch {
      currentUser.value = null;
    }
  }
  options.value = await api.options();
  sanitizeItemCreateDefaults();
  await loadItems();
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onCreateDefaultsDocumentPointerDown);
});

watch(itemQuery, loadItems);
watch(itemCreateDefaults, persistItemCreateDefaults, { deep: true });
watch(showEditor, closeCreateDefaultsMenu);
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
      <template #kicker>{{ pageKicker }}</template>
      <template #actions>
        <div v-if="canCreateItem" ref="createDefaultsMenu" class="item-create-action" @keydown="onCreateDefaultsKeydown">
          <div class="item-create-action__control" :class="{ 'has-defaults': hasItemCreateDefaults }">
            <RouterLink
              class="ui-button ui-button--primary ui-button--small item-create-action__primary"
              :to="createTarget"
              :aria-label="t('pages.items.addItem')"
              @contextmenu="openCreateDefaultsMenu"
            >
              <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
              {{ t('common.add') }}
            </RouterLink>
            <button
              type="button"
              class="ui-button ui-button--primary ui-button--small item-create-action__menu-button"
              :aria-label="t('pages.items.createDefaultsMenu')"
              aria-haspopup="dialog"
              :aria-controls="'item-create-defaults-menu'"
              :aria-expanded="createDefaultsOpen"
              :disabled="!options"
              @click="toggleCreateDefaultsMenu"
              @contextmenu="openCreateDefaultsMenu"
            >
              <Icon :icon="iconChevronDown" class="ui-icon" aria-hidden="true" />
            </button>
          </div>

          <div
            v-if="createDefaultsOpen && options"
            id="item-create-defaults-menu"
            class="item-create-defaults-menu"
            role="dialog"
            :aria-label="t('pages.items.createDefaultsTitle')"
          >
            <div class="item-create-defaults-menu__header">
              <strong>{{ t('pages.items.createDefaultsTitle') }}</strong>
              <button type="button" class="plain-button ui-button--small" :disabled="!hasItemCreateDefaults" @click="clearItemCreateDefaults">
                {{ t('pages.items.clearCreateDefaults') }}
              </button>
            </div>

            <div class="field">
              <label for="item-default-category">{{ t('pages.items.category') }}</label>
              <TagsSelect
                id="item-default-category"
                v-model="itemCreateDefaults.categoryId"
                :options="options.itemCategories"
                :multiple="false"
                :placeholder="t('common.none')"
                :search-placeholder="t('pages.items.searchCategory')"
              />
            </div>

            <div class="check-row item-create-defaults-menu__checks">
              <label><input v-model="itemCreateDefaults.dyeable" type="checkbox" /> {{ t('pages.items.dyeable') }}</label>
              <label><input v-model="itemCreateDefaults.dualDyeable" type="checkbox" /> {{ t('pages.items.dualDyeable') }}</label>
              <label><input v-model="itemCreateDefaults.patternEditable" type="checkbox" /> {{ t('pages.items.patternEditable') }}</label>
              <label><input v-model="itemCreateDefaults.noRecipe" type="checkbox" /> {{ t('pages.items.noRecipe') }}</label>
            </div>

            <div class="field">
              <label for="item-default-methods">{{ t('pages.items.acquisitionMethods') }}</label>
              <TagsSelect
                id="item-default-methods"
                v-model="itemCreateDefaults.acquisitionMethodIds"
                :options="options.acquisitionMethods"
                :placeholder="t('pages.items.searchMethods')"
              />
            </div>
          </div>
        </div>
      </template>
    </PageHeader>

    <Tabs v-if="options" id="item-category" v-model="categoryId" :tabs="categoryTabs" :label="t('pages.items.category')" />
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
        <label for="item-search">{{ t('common.search') }}</label>
        <input id="item-search" v-model="search" type="search" :placeholder="t('common.name')" />
      </div>

      <div class="field">
        <label for="usage">{{ t('pages.items.usage') }}</label>
        <TagsSelect
          id="usage"
          v-model="usageId"
          :options="options.itemUsages"
          :multiple="false"
          :placeholder="t('common.all')"
          :search-placeholder="t('pages.items.searchUsage')"
        />
      </div>

      <div class="field">
        <label for="tags">{{ t('pages.items.tags') }}</label>
        <TagsSelect id="tags" v-model="tagIds" :options="options.itemTags" :placeholder="t('pages.items.searchTags')" />
      </div>
    </FilterPanel>
    <FilterPanel v-else class="filter-panel--skeleton" aria-hidden="true">
      <div v-for="(width, index) in filterSkeletonWidths" :key="index" class="field">
        <Skeleton :width="width" />
        <Skeleton variant="box" height="44px" />
      </div>
    </FilterPanel>

    <div v-if="loading" class="entity-grid catalog-card-grid collections-card-grid" aria-busy="true" :aria-label="t('pages.items.loadingList')">
      <article
        v-for="index in skeletonCardCount"
        :key="`item-skeleton-${index}`"
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
        v-for="item in items"
        :key="item.id"
        :title="item.name"
        :subtitle="item.category.name"
        :to="`/items/${item.id}`"
        :icon="iconItem"
        :image="itemCardImage(item)"
        :ribbon="item.usage?.name"
        compact-tooltip
      />
    </div>

    <ItemEdit v-if="showEditor" />
  </section>
</template>
