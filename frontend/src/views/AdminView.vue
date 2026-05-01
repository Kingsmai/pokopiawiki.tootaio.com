<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import {
  api,
  type AuthUser,
  type ConfigType,
  type DailyChecklistItem,
  type Habitat,
  type Item,
  type NamedEntity,
  type Pokemon,
  type Recipe,
  type Skill
} from '../services/api';

type AdminTab = 'config' | 'checklist' | 'pokemon' | 'items' | 'recipes' | 'habitats';
type EditableConfig = (NamedEntity | Skill) & { hasItemDrop?: boolean };

const tabs: Array<{ key: AdminTab; label: string }> = [
  { key: 'config', label: '系统配置' },
  { key: 'checklist', label: 'CheckList' },
  { key: 'pokemon', label: 'Pokemon' },
  { key: 'items', label: '物品' },
  { key: 'recipes', label: '材料单' },
  { key: 'habitats', label: '栖息地' }
];

const configTypes: Array<{ key: ConfigType; label: string; supportsItemDrop?: boolean }> = [
  { key: 'skills', label: '特长', supportsItemDrop: true },
  { key: 'environments', label: '喜欢的环境' },
  { key: 'favorite-things', label: '喜欢的东西 / 标签' },
  { key: 'item-categories', label: '物品分类' },
  { key: 'item-usages', label: '物品用途' },
  { key: 'acquisition-methods', label: '入手方式' },
  { key: 'maps', label: '地图' }
];

const activeTab = ref<AdminTab>('config');
const activeConfigType = ref<ConfigType>('skills');
const configRows = ref<EditableConfig[]>([]);
const checklistRows = ref<DailyChecklistItem[]>([]);
const pokemonRows = ref<Pokemon[]>([]);
const itemRows = ref<Item[]>([]);
const recipeRows = ref<Recipe[]>([]);
const habitatRows = ref<Habitat[]>([]);
const currentUser = ref<AuthUser | null>(null);
const busy = ref(false);
const contentLoading = ref(false);
const message = ref('');
const configForm = ref({ id: 0, name: '', hasItemDrop: false });
const checklistForm = ref({ id: 0, title: '' });
const draggingChecklistId = ref<number | null>(null);
const dragOverChecklistId = ref<number | null>(null);
const dragInsertAfterTarget = ref(false);
const dragSourceChecklistRows = ref<DailyChecklistItem[]>([]);
const dragDropCommitted = ref(false);

const selectedConfig = computed(() => configTypes.find((item) => item.key === activeConfigType.value) ?? configTypes[0]);
const configTabs = computed<TabOption[]>(() => configTypes.map((item) => ({ value: item.key, label: item.label })));
const activeConfigTab = computed({
  get: () => activeConfigType.value,
  set: (value: string) => {
    const nextConfig = configTypes.find((item) => item.key === value);
    if (!nextConfig || nextConfig.key === activeConfigType.value) return;

    activeConfigType.value = nextConfig.key;
    resetConfigForm();
    void run(loadConfig);
  }
});
const canEdit = computed(() => currentUser.value?.emailVerified === true);
const showAdminSkeleton = computed(() => busy.value && !message.value && (!currentUser.value || contentLoading.value));

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function run(action: () => Promise<void>) {
  busy.value = true;
  message.value = '';
  try {
    await action();
  } catch (error) {
    message.value = errorText(error, '操作失败');
  } finally {
    busy.value = false;
  }
}

async function loadConfig() {
  configRows.value = (await api.config(activeConfigType.value)) as EditableConfig[];
}

function resetConfigForm() {
  configForm.value = { id: 0, name: '', hasItemDrop: false };
}

function resetChecklistForm() {
  checklistForm.value = { id: 0, title: '' };
}

function editConfig(item: EditableConfig) {
  configForm.value = { id: item.id, name: item.name, hasItemDrop: item.hasItemDrop === true };
}

function editChecklistItem(item: DailyChecklistItem) {
  checklistForm.value = { id: item.id, title: item.title };
}

function hasChecklistOrderChanged(rows: DailyChecklistItem[], nextRows: DailyChecklistItem[]) {
  return rows.length !== nextRows.length || rows.some((item, index) => item.id !== nextRows[index]?.id);
}

function reorderedChecklistRows(
  rows: DailyChecklistItem[],
  draggedId: number,
  targetId: number,
  insertAfterTarget: boolean
) {
  if (draggedId === targetId) {
    return rows;
  }

  const draggedItem = rows.find((item) => item.id === draggedId);
  if (!draggedItem) {
    return rows;
  }

  const nextRows = rows.filter((item) => item.id !== draggedId);
  const targetIndex = nextRows.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) {
    return rows;
  }

  nextRows.splice(targetIndex + (insertAfterTarget ? 1 : 0), 0, draggedItem);
  return nextRows;
}

async function persistChecklistOrder(nextRows: DailyChecklistItem[], fallbackRows: DailyChecklistItem[]) {
  checklistRows.value = nextRows;
  await run(async () => {
    try {
      checklistRows.value = await api.reorderDailyChecklistItems(nextRows.map((item) => item.id));
    } catch (error) {
      checklistRows.value = fallbackRows;
      throw error;
    }
  });
}

async function saveConfig() {
  await run(async () => {
    const payload = {
      name: configForm.value.name,
      hasItemDrop: selectedConfig.value.supportsItemDrop ? configForm.value.hasItemDrop : undefined
    };

    if (configForm.value.id) {
      await api.updateConfig(activeConfigType.value, configForm.value.id, payload);
    } else {
      await api.createConfig(activeConfigType.value, payload);
    }

    resetConfigForm();
    await loadConfig();
  });
}

async function loadChecklist() {
  checklistRows.value = await api.dailyChecklist();
  if (!checklistForm.value.id && checklistForm.value.title.trim() === '') {
    resetChecklistForm();
  }
}

async function saveChecklistItem() {
  await run(async () => {
    const payload = {
      title: checklistForm.value.title
    };

    if (checklistForm.value.id) {
      await api.updateDailyChecklistItem(checklistForm.value.id, payload);
    } else {
      await api.createDailyChecklistItem(payload);
    }

    await loadChecklist();
    resetChecklistForm();
  });
}

async function loadPokemon() {
  pokemonRows.value = await api.pokemon({});
}

async function loadItems() {
  itemRows.value = await api.items({});
}

async function loadRecipes() {
  recipeRows.value = await api.recipes();
}

async function loadHabitats() {
  habitatRows.value = await api.habitats();
}

async function loadCurrentTab(showSkeleton = false) {
  if (showSkeleton) {
    contentLoading.value = true;
  }

  try {
    if (activeTab.value === 'config') await loadConfig();
    if (activeTab.value === 'checklist') await loadChecklist();
    if (activeTab.value === 'pokemon') await loadPokemon();
    if (activeTab.value === 'items') await loadItems();
    if (activeTab.value === 'recipes') await loadRecipes();
    if (activeTab.value === 'habitats') await loadHabitats();
  } finally {
    if (showSkeleton) {
      contentLoading.value = false;
    }
  }
}

function setTab(tab: AdminTab) {
  if (!canEdit.value) {
    message.value = '请先完成邮箱验证';
    return;
  }

  activeTab.value = tab;
  void run(() => loadCurrentTab(true));
}

async function loadAdmin() {
  const response = await api.me();
  currentUser.value = response.user;

  if (!response.user.emailVerified) {
    message.value = '请先完成邮箱验证';
    return;
  }

  await loadCurrentTab(true);
}

async function removeConfig(id: number) {
  await run(async () => {
    await api.deleteConfig(activeConfigType.value, id);
    if (configForm.value.id === id) {
      resetConfigForm();
    }
    await loadConfig();
  });
}

async function removeChecklistItem(id: number) {
  await run(async () => {
    await api.deleteDailyChecklistItem(id);
    if (checklistForm.value.id === id) {
      resetChecklistForm();
    }
    await loadChecklist();
  });
}

function startChecklistDrag(item: DailyChecklistItem, event: Event) {
  draggingChecklistId.value = item.id;
  dragSourceChecklistRows.value = [...checklistRows.value];
  dragDropCommitted.value = false;
  const dragEvent = event instanceof DragEvent ? event : null;
  dragEvent?.dataTransfer?.setData('text/plain', String(item.id));
  if (dragEvent?.dataTransfer) {
    dragEvent.dataTransfer.effectAllowed = 'move';
    dragEvent.dataTransfer.dropEffect = 'move';
  }
}

function clearChecklistDragState() {
  draggingChecklistId.value = null;
  dragOverChecklistId.value = null;
  dragInsertAfterTarget.value = false;
  dragSourceChecklistRows.value = [];
  dragDropCommitted.value = false;
}

function endChecklistDrag() {
  if (draggingChecklistId.value !== null && !dragDropCommitted.value && dragSourceChecklistRows.value.length) {
    checklistRows.value = dragSourceChecklistRows.value;
  }

  clearChecklistDragState();
}

function previewChecklistDrop(targetItem: DailyChecklistItem, event: Event) {
  const dragEvent = event instanceof DragEvent ? event : null;
  const draggedId = draggingChecklistId.value ?? Number(dragEvent?.dataTransfer?.getData('text/plain'));
  if (!draggedId || busy.value) {
    return;
  }

  if (draggedId === targetItem.id) {
    dragOverChecklistId.value = null;
    dragInsertAfterTarget.value = false;
    return;
  }

  if (dragEvent?.dataTransfer) {
    dragEvent.dataTransfer.dropEffect = 'move';
  }

  const targetElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const insertAfterTarget = targetElement
    ? (dragEvent?.clientY ?? 0) > targetElement.getBoundingClientRect().top + targetElement.getBoundingClientRect().height / 2
    : false;

  dragOverChecklistId.value = targetItem.id;
  dragInsertAfterTarget.value = insertAfterTarget;
  const nextRows = reorderedChecklistRows(checklistRows.value, draggedId, targetItem.id, insertAfterTarget);
  if (hasChecklistOrderChanged(checklistRows.value, nextRows)) {
    checklistRows.value = nextRows;
  }
}

async function dropChecklistItem(targetItem: DailyChecklistItem, event: Event) {
  if (!draggingChecklistId.value || busy.value) {
    endChecklistDrag();
    return;
  }

  previewChecklistDrop(targetItem, event);

  const nextRows = [...checklistRows.value];
  const fallbackRows = dragSourceChecklistRows.value.length ? [...dragSourceChecklistRows.value] : nextRows;
  dragDropCommitted.value = true;
  clearChecklistDragState();

  if (!hasChecklistOrderChanged(fallbackRows, nextRows)) {
    return;
  }

  await persistChecklistOrder(nextRows, fallbackRows);
}

async function moveChecklistItemByKeyboard(item: DailyChecklistItem, offset: -1 | 1) {
  if (busy.value) {
    return;
  }

  const currentIndex = checklistRows.value.findIndex((row) => row.id === item.id);
  const targetIndex = currentIndex + offset;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= checklistRows.value.length) {
    return;
  }

  const fallbackRows = [...checklistRows.value];
  const nextRows = [...checklistRows.value];
  const [movedItem] = nextRows.splice(currentIndex, 1);
  nextRows.splice(targetIndex, 0, movedItem);
  await persistChecklistOrder(nextRows, fallbackRows);
}

function handleChecklistHandleKey(item: DailyChecklistItem, event: Event) {
  const keyboardEvent = event instanceof KeyboardEvent ? event : null;
  if (!keyboardEvent) {
    return;
  }

  if (keyboardEvent.key === 'ArrowUp') {
    keyboardEvent.preventDefault();
    void moveChecklistItemByKeyboard(item, -1);
  }

  if (keyboardEvent.key === 'ArrowDown') {
    keyboardEvent.preventDefault();
    void moveChecklistItemByKeyboard(item, 1);
  }
}

async function removePokemon(id: number) {
  await run(async () => {
    await api.deletePokemon(id);
    await loadPokemon();
  });
}

async function removeItem(id: number) {
  await run(async () => {
    await api.deleteItem(id);
    await loadItems();
  });
}

async function removeRecipe(id: number) {
  await run(async () => {
    await api.deleteRecipe(id);
    await loadRecipes();
  });
}

async function removeHabitat(id: number) {
  await run(async () => {
    await api.deleteHabitat(id);
    await loadHabitats();
  });
}

onMounted(() => {
  void run(loadAdmin);
});
</script>

<template>
  <section class="page-stack">
    <PageHeader title="管理" subtitle="维护系统配置，查看并删除 Wiki 数据记录。">
      <template #kicker>Admin</template>
    </PageHeader>

    <div v-if="canEdit" class="tabs" role="tablist" aria-label="管理模块">
      <button v-for="tab in tabs" :key="tab.key" :class="{ active: activeTab === tab.key }" type="button" @click="setTab(tab.key)">
        {{ tab.label }}
      </button>
    </div>

    <StatusMessage v-if="message" variant="warning">{{ message }}</StatusMessage>

    <section v-if="showAdminSkeleton" class="detail-section skeleton-detail-section" aria-busy="true" aria-label="正在加载管理列表">
      <h2><Skeleton width="120px" height="24px" /></h2>
      <ul class="row-list skeleton-row-list">
        <li v-for="index in 6" :key="index">
          <Skeleton :width="index % 2 === 0 ? '180px' : '132px'" />
          <span class="row-actions">
            <Skeleton variant="box" width="50px" height="34px" />
          </span>
        </li>
      </ul>
    </section>

    <section v-else-if="canEdit && activeTab === 'checklist'" class="detail-section">
      <h2>CheckList</h2>

      <form class="detail-section__body" @submit.prevent="saveChecklistItem">
        <h3 class="section-subtitle">{{ checklistForm.id ? '编辑 Task' : '新增 Task' }}</h3>
        <div class="field">
          <label for="checklist-title">Task</label>
          <input id="checklist-title" v-model="checklistForm.title" required />
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">{{ busy ? '保存中' : '保存' }}</button>
          <button type="button" class="plain-button" :disabled="busy" @click="resetChecklistForm">新建</button>
        </div>
      </form>

      <h3 class="section-subtitle">每日做什么</h3>
      <TransitionGroup v-if="checklistRows.length" name="admin-checklist" tag="ul" class="row-list admin-checklist-list">
        <li
          v-for="item in checklistRows"
          :key="item.id"
          class="admin-checklist-row"
          :class="{
            'is-dragging': draggingChecklistId === item.id,
            'is-drop-target': dragOverChecklistId === item.id,
            'is-drop-after': dragOverChecklistId === item.id && dragInsertAfterTarget,
            'is-drop-before': dragOverChecklistId === item.id && !dragInsertAfterTarget
          }"
          @dragover.prevent="previewChecklistDrop(item, $event)"
          @drop.prevent="dropChecklistItem(item, $event)"
        >
          <button
            type="button"
            class="drag-handle"
            draggable="true"
            :aria-label="`拖曳排序：${item.title}`"
            title="拖曳排序"
            :disabled="busy"
            @dragstart="startChecklistDrag(item, $event)"
            @dragend="endChecklistDrag"
            @keydown="handleChecklistHandleKey(item, $event)"
          >
            <span aria-hidden="true">⋮⋮</span>
          </button>
          <span class="admin-checklist-title">{{ item.title }}</span>
          <span class="row-actions">
            <button type="button" :disabled="busy" @click="editChecklistItem(item)">编辑</button>
            <button type="button" :disabled="busy" @click="removeChecklistItem(item.id)">删除</button>
          </span>
        </li>
      </TransitionGroup>
      <p v-else class="meta-line">暂无记录</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'config'" class="detail-section">
      <h2>系统配置</h2>
      <Tabs id="admin-config-type" v-model="activeConfigTab" :tabs="configTabs" label="系统配置类型" />

      <form class="detail-section__body" @submit.prevent="saveConfig">
        <h3 class="section-subtitle">{{ configForm.id ? `编辑${selectedConfig.label}` : `新增${selectedConfig.label}` }}</h3>
        <div class="field">
          <label for="config-name">名称</label>
          <input id="config-name" v-model="configForm.name" required />
        </div>
        <div v-if="selectedConfig.supportsItemDrop" class="check-row">
          <label>
            <input v-model="configForm.hasItemDrop" type="checkbox" />
            有掉落物
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">{{ busy ? '保存中' : '保存' }}</button>
          <button type="button" class="plain-button" :disabled="busy" @click="resetConfigForm">新建</button>
        </div>
      </form>

      <h3 class="section-subtitle">{{ selectedConfig.label }}</h3>
      <ul v-if="configRows.length" class="row-list">
        <li v-for="item in configRows" :key="item.id">
          <span>{{ item.name }}<span v-if="item.hasItemDrop" class="config-flag">有掉落物</span></span>
          <span class="row-actions">
            <button type="button" @click="editConfig(item)">编辑</button>
            <button type="button" @click="removeConfig(item.id)">删除</button>
          </span>
        </li>
      </ul>
      <p v-else class="meta-line">暂无记录</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'pokemon'" class="detail-section">
      <h2>Pokemon 列表</h2>
      <ul v-if="pokemonRows.length" class="row-list">
        <li v-for="item in pokemonRows" :key="item.id">
          <RouterLink :to="`/pokemon/${item.id}`">#{{ item.id }} {{ item.name }}</RouterLink>
          <span class="row-actions">
            <button type="button" @click="removePokemon(item.id)">删除</button>
          </span>
        </li>
      </ul>
      <p v-else class="meta-line">暂无记录</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'items'" class="detail-section">
      <h2>物品列表</h2>
      <ul v-if="itemRows.length" class="row-list">
        <li v-for="item in itemRows" :key="item.id">
          <RouterLink :to="`/items/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button type="button" @click="removeItem(item.id)">删除</button>
          </span>
        </li>
      </ul>
      <p v-else class="meta-line">暂无记录</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'recipes'" class="detail-section">
      <h2>材料单列表</h2>
      <ul v-if="recipeRows.length" class="row-list">
        <li v-for="item in recipeRows" :key="item.id">
          <RouterLink :to="`/recipes/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button type="button" @click="removeRecipe(item.id)">删除</button>
          </span>
        </li>
      </ul>
      <p v-else class="meta-line">暂无记录</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'habitats'" class="detail-section">
      <h2>栖息地列表</h2>
      <ul v-if="habitatRows.length" class="row-list">
        <li v-for="item in habitatRows" :key="item.id">
          <RouterLink :to="`/habitats/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button type="button" @click="removeHabitat(item.id)">删除</button>
          </span>
        </li>
      </ul>
      <p v-else class="meta-line">暂无记录</p>
    </section>
  </section>
</template>
