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
  type Habitat,
  type Item,
  type NamedEntity,
  type Pokemon,
  type Recipe
} from '../services/api';

type AdminTab = 'config' | 'pokemon' | 'items' | 'recipes' | 'habitats';
type EditableConfig = NamedEntity;

const tabs: Array<{ key: AdminTab; label: string }> = [
  { key: 'config', label: '系统配置' },
  { key: 'pokemon', label: 'Pokemon' },
  { key: 'items', label: '物品' },
  { key: 'recipes', label: '材料单' },
  { key: 'habitats', label: '栖息地' }
];

const configTypes: Array<{ key: ConfigType; label: string }> = [
  { key: 'skills', label: '特长' },
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
const pokemonRows = ref<Pokemon[]>([]);
const itemRows = ref<Item[]>([]);
const recipeRows = ref<Recipe[]>([]);
const habitatRows = ref<Habitat[]>([]);
const currentUser = ref<AuthUser | null>(null);
const busy = ref(false);
const contentLoading = ref(false);
const message = ref('');
const configForm = ref({ id: 0, name: '' });

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
  configForm.value = { id: 0, name: '' };
}

function editConfig(item: EditableConfig) {
  configForm.value = { id: item.id, name: item.name };
}

async function saveConfig() {
  await run(async () => {
    const payload = {
      name: configForm.value.name
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

    <section v-else-if="canEdit && activeTab === 'config'" class="detail-section">
      <h2>系统配置</h2>
      <Tabs id="admin-config-type" v-model="activeConfigTab" :tabs="configTabs" label="系统配置类型" />

      <form class="detail-section__body" @submit.prevent="saveConfig">
        <h3 class="section-subtitle">{{ configForm.id ? `编辑${selectedConfig.label}` : `新增${selectedConfig.label}` }}</h3>
        <div class="field">
          <label for="config-name">名称</label>
          <input id="config-name" v-model="configForm.name" required />
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">{{ busy ? '保存中' : '保存' }}</button>
          <button type="button" class="plain-button" :disabled="busy" @click="resetConfigForm">新建</button>
        </div>
      </form>

      <h3 class="section-subtitle">{{ selectedConfig.label }}</h3>
      <ul v-if="configRows.length" class="row-list">
        <li v-for="item in configRows" :key="item.id">
          <span>{{ item.name }}</span>
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
