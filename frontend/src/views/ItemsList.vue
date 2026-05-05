<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { iconAdd, iconChevronDown, iconChevronUp, iconItem } from '../icons';
import { api, getAuthToken, type AuthUser, type Item, type Options } from '../services/api';
import ItemEdit from './ItemEdit.vue';

const props = defineProps<{
  eventOnly?: boolean;
}>();

const options = ref<Options | null>(null);
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const items = ref<Item[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const ordering = ref(false);
const search = ref('');
const categoryId = ref('');
const usageId = ref('');
const tagIds = ref<string[]>([]);
const createDefaultsMenu = ref<HTMLElement | null>(null);
const createDefaultsOpen = ref(false);
const itemContextMenu = ref<{
  item: Item;
  x: number;
  y: number;
} | null>(null);
const itemContextMenuRef = ref<HTMLElement | null>(null);
const draggingItemId = ref<number | null>(null);
const dropTargetItemId = ref<number | null>(null);
const dropInsertAfter = ref(false);
const suppressNextItemClick = ref(false);
const dragSourceItems = ref<Item[]>([]);
const dropCommitted = ref(false);

type ItemCreateDefaults = {
  categoryId: string;
  usageId: string;
  dyeable: boolean;
  dualDyeable: boolean;
  patternEditable: boolean;
  noRecipe: boolean;
  acquisitionMethodIds: string[];
};

const itemCreateDefaultsStorageKey = 'pokopia_item_create_defaults';

const emptyItemCreateDefaults = (): ItemCreateDefaults => ({
  categoryId: '',
  usageId: '',
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
const isAllView = computed(() => !props.eventOnly && categoryId.value === '');
const hasActiveFilters = computed(
  () => search.value.trim() !== '' || usageId.value !== '' || tagIds.value.length > 0 || categoryId.value !== ''
);
const itemSortingAllowed = computed(
  () => isAllView.value && !hasActiveFilters.value && currentUser.value?.permissions.includes('items.order') === true
);
const itemInsertionAllowed = computed(
  () => itemSortingAllowed.value && currentUser.value?.permissions.includes('items.create') === true
);

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
    itemCreateDefaults.value.usageId !== '' ||
    itemCreateDefaults.value.dyeable ||
    itemCreateDefaults.value.dualDyeable ||
    itemCreateDefaults.value.patternEditable ||
    itemCreateDefaults.value.noRecipe ||
    itemCreateDefaults.value.acquisitionMethodIds.length > 0
);

function itemCardImage(item: Item) {
  return item.image ? { src: item.image.url, alt: t('media.imageAlt', { name: item.name }) } : undefined;
}

function sameItem(first: number, second: number): boolean {
  return first === second;
}

function reorderedItems(currentItems: Item[], draggedId: number, targetId: number, insertAfter: boolean): Item[] {
  if (sameItem(draggedId, targetId)) {
    return currentItems;
  }

  const draggedItem = currentItems.find((item) => sameItem(item.id, draggedId));
  if (!draggedItem) {
    return currentItems;
  }

  const nextItems = currentItems.filter((item) => !sameItem(item.id, draggedId));
  const targetIndex = nextItems.findIndex((item) => sameItem(item.id, targetId));
  if (targetIndex < 0) {
    return currentItems;
  }

  nextItems.splice(targetIndex + (insertAfter ? 1 : 0), 0, draggedItem);
  return nextItems;
}

function hasOrderChanged(currentItems: Item[], nextItems: Item[]): boolean {
  return currentItems.length !== nextItems.length || currentItems.some((item, index) => !sameItem(item.id, nextItems[index]?.id ?? -1));
}

function clampMenuPosition(x: number, y: number) {
  const width = 216;
  const height = 104;
  return {
    x: Math.max(16, Math.min(x, window.innerWidth - width - 16)),
    y: Math.max(16, Math.min(y, window.innerHeight - height - 16))
  };
}

function menuPositionForEvent(event: MouseEvent | KeyboardEvent) {
  if (event instanceof MouseEvent) {
    return clampMenuPosition(event.clientX, event.clientY);
  }

  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  if (target) {
    const rect = target.getBoundingClientRect();
    return clampMenuPosition(rect.left, rect.bottom + 6);
  }

  return clampMenuPosition(window.innerWidth / 2, window.innerHeight / 2);
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
      usageId: typeof parsedValue.usageId === 'string' ? parsedValue.usageId : '',
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
  const usageIds = new Set(options.value.itemUsages.map((item) => String(item.id)));
  const methodIds = new Set(options.value.acquisitionMethods.map((item) => String(item.id)));
  const nextDefaults = {
    ...itemCreateDefaults.value,
    categoryId: categoryIds.has(itemCreateDefaults.value.categoryId) ? itemCreateDefaults.value.categoryId : '',
    usageId: usageIds.has(itemCreateDefaults.value.usageId) ? itemCreateDefaults.value.usageId : '',
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
  const target = event.target as Node | null;
  if (createDefaultsMenu.value && target && !createDefaultsMenu.value.contains(target)) {
    closeCreateDefaultsMenu();
  }

  if (itemContextMenu.value && itemContextMenuRef.value && target && !itemContextMenuRef.value.contains(target)) {
    closeItemContextMenu();
  }
}

function onCreateDefaultsKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeCreateDefaultsMenu();
    closeItemContextMenu();
  }

  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    openCreateDefaultsMenu(event);
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeCreateDefaultsMenu();
    closeItemContextMenu();
  }
}

function closeItemContextMenu() {
  itemContextMenu.value = null;
}

function openItemContextMenu(item: Item, event: MouseEvent | KeyboardEvent) {
  if (!itemInsertionAllowed.value) {
    return;
  }

  event.preventDefault();
  closeCreateDefaultsMenu();

  const { x, y } = menuPositionForEvent(event);
  itemContextMenu.value = { item, x, y };
}

function startItemInsert(position: 'before' | 'after') {
  if (!itemContextMenu.value) {
    return;
  }

  const queryKey = position === 'before' ? 'insertBeforeItemId' : 'insertAfterItemId';
  void router.push({
    path: createTarget.value,
    query: { [queryKey]: String(itemContextMenu.value.item.id) }
  });
  closeItemContextMenu();
}

function clearItemDragState() {
  draggingItemId.value = null;
  dropTargetItemId.value = null;
  dropInsertAfter.value = false;
  dragSourceItems.value = [];
  dropCommitted.value = false;
}

function startItemDrag(item: Item, event: DragEvent) {
  if (!itemSortingAllowed.value || ordering.value) {
    return;
  }

  draggingItemId.value = item.id;
  dropTargetItemId.value = null;
  dropInsertAfter.value = false;
  suppressNextItemClick.value = false;
  dragSourceItems.value = [...items.value];
  dropCommitted.value = false;
  event.dataTransfer?.setData('text/plain', String(item.id));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.dropEffect = 'move';
  }
}

function endItemDrag() {
  if (draggingItemId.value !== null && !dropCommitted.value && dragSourceItems.value.length) {
    items.value = [...dragSourceItems.value];
  }

  if (draggingItemId.value !== null) {
    suppressNextItemClick.value = true;
  }

  clearItemDragState();
}

function previewItemDrop(targetItem: Item, event: DragEvent) {
  if (!itemSortingAllowed.value || draggingItemId.value === null || ordering.value) {
    return;
  }

  const draggedId = draggingItemId.value;
  if (sameItem(draggedId, targetItem.id)) {
    dropTargetItemId.value = null;
    dropInsertAfter.value = false;
    return;
  }

  const element = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const insertAfter = element ? event.clientY > element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2 : false;
  dropTargetItemId.value = targetItem.id;
  dropInsertAfter.value = insertAfter;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  const nextItems = reorderedItems(items.value, draggedId, targetItem.id, insertAfter);
  if (hasOrderChanged(items.value, nextItems)) {
    items.value = nextItems;
  }
}

async function dropItem(targetItem: Item, event: DragEvent) {
  if (!itemSortingAllowed.value || draggingItemId.value === null || ordering.value) {
    clearItemDragState();
    return;
  }

  previewItemDrop(targetItem, event);
  const nextItems = [...items.value];
  const previousItems = dragSourceItems.value.length ? [...dragSourceItems.value] : nextItems;
  dropCommitted.value = true;
  clearItemDragState();

  if (!hasOrderChanged(previousItems, nextItems)) {
    return;
  }

  items.value = nextItems;
  ordering.value = true;
  suppressNextItemClick.value = true;
  try {
    await api.reorderItems(nextItems.map((item) => item.id));
    items.value = await api.items(itemQuery.value);
  } catch {
    items.value = previousItems;
  } finally {
    ordering.value = false;
  }
}

function handleItemKeydown(item: Item, event: KeyboardEvent) {
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    openItemContextMenu(item, event);
  }
}

function handleItemClick(event: MouseEvent) {
  if (!suppressNextItemClick.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  suppressNextItemClick.value = false;
}

async function loadItems() {
  loading.value = true;
  items.value = await api.items(itemQuery.value);
  loading.value = false;
}

onMounted(async () => {
  document.addEventListener('pointerdown', onCreateDefaultsDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);
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
  document.removeEventListener('keydown', onDocumentKeydown);
});

watch(itemQuery, loadItems);
watch(itemCreateDefaults, persistItemCreateDefaults, { deep: true });
watch(showEditor, () => {
  closeCreateDefaultsMenu();
  closeItemContextMenu();
});
watch(itemSortingAllowed, (allowed) => {
  if (!allowed) {
    clearItemDragState();
    closeItemContextMenu();
  }
});
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

            <div class="field">
              <label for="item-default-usage">{{ t('pages.items.usage') }}</label>
              <TagsSelect
                id="item-default-usage"
                v-model="itemCreateDefaults.usageId"
                :options="options.itemUsages"
                :multiple="false"
                clearable
                :placeholder="t('common.none')"
                :search-placeholder="t('pages.items.searchUsage')"
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
          clearable
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
        class="entity-card entity-card--skeleton entity-card--collection-compact item-grid-card"
      >
        <Skeleton variant="box" width="92px" height="92px" class="skeleton-entity-mark" />
        <div class="entity-card__content">
          <Skeleton width="128px" height="24px" />
          <Skeleton width="92px" />
        </div>
      </article>
    </div>
    <TransitionGroup v-else name="item-grid" tag="div" class="entity-grid catalog-card-grid collections-card-grid">
      <div
        v-for="item in items"
        :key="item.id"
        class="item-grid-slot"
        :class="{
          'item-grid-card--interactive': itemSortingAllowed,
          'is-dragging': draggingItemId === item.id,
          'is-drop-target': dropTargetItemId === item.id,
          'is-drop-after': dropTargetItemId === item.id && dropInsertAfter,
          'is-drop-before': dropTargetItemId === item.id && !dropInsertAfter
        }"
        :draggable="itemSortingAllowed"
        :aria-haspopup="itemInsertionAllowed ? 'menu' : undefined"
        @contextmenu="openItemContextMenu(item, $event)"
        @dragstart="startItemDrag(item, $event)"
        @dragend="endItemDrag"
        @dragover.prevent="previewItemDrop(item, $event)"
        @drop.prevent="dropItem(item, $event)"
        @click.capture="handleItemClick"
        @keydown="handleItemKeydown(item, $event)"
      >
        <EntityCard
          :title="item.name"
          :subtitle="item.category.name"
          :to="`/items/${item.id}`"
          :icon="iconItem"
          :image="itemCardImage(item)"
          :ribbon="item.usage?.name"
          class="item-grid-card"
          compact-tooltip
        />
      </div>
    </TransitionGroup>

    <div
      v-if="itemContextMenu"
      ref="itemContextMenuRef"
      class="item-context-menu"
      role="menu"
      :aria-label="t('pages.items.itemActions')"
      :style="{ left: `${itemContextMenu.x}px`, top: `${itemContextMenu.y}px` }"
    >
      <button type="button" class="item-context-menu__option" role="menuitem" @click="startItemInsert('before')">
        <Icon :icon="iconChevronUp" class="ui-icon" aria-hidden="true" />
        {{ t('pages.items.insertBeforeItem') }}
      </button>
      <button type="button" class="item-context-menu__option" role="menuitem" @click="startItemInsert('after')">
        <Icon :icon="iconChevronDown" class="ui-icon" aria-hidden="true" />
        {{ t('pages.items.insertAfterItem') }}
      </button>
    </div>

    <ItemEdit v-if="showEditor" />
  </section>
</template>
