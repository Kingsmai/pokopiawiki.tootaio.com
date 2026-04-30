<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import TagsSelect from '../components/TagsSelect.vue';
import {
  api,
  type ConfigType,
  type Habitat,
  type HabitatDetail,
  type HabitatPayload,
  type Item,
  type ItemPayload,
  type NamedEntity,
  type Options,
  type Pokemon,
  type PokemonPayload,
  type Recipe,
  type RecipePayload,
  type Skill
} from '../services/api';

type AdminTab = 'config' | 'pokemon' | 'items' | 'recipes' | 'habitats';
type EditableConfig = (NamedEntity | Skill) & { subcategory?: string | null };
type HabitatAppearanceForm = {
  pokemonId: string;
  mapIds: string[];
  timeOfDays: string[];
  weathers: string[];
  rarity: number;
};

const tabs: Array<{ key: AdminTab; label: string }> = [
  { key: 'config', label: '系统配置' },
  { key: 'pokemon', label: 'Pokemon' },
  { key: 'items', label: '物品' },
  { key: 'recipes', label: '材料单' },
  { key: 'habitats', label: '栖息地' }
];

const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];
const timeOfDayOptions = timeOfDays.map((name) => ({ id: name, name }));
const weatherOptions = weathers.map((name) => ({ id: name, name }));

const configTypes: Array<{ key: ConfigType; label: string; hasSubcategory?: boolean }> = [
  { key: 'skills', label: '特长', hasSubcategory: true },
  { key: 'environments', label: '喜欢的环境' },
  { key: 'favorite-things', label: '喜欢的东西' },
  { key: 'item-categories', label: '物品 / 材料单分类' },
  { key: 'item-usages', label: '物品 / 材料单用途' },
  { key: 'acquisition-methods', label: '入手方式' },
  { key: 'maps', label: '地图' }
];

const activeTab = ref<AdminTab>('config');
const activeConfigType = ref<ConfigType>('skills');
const options = ref<Options | null>(null);
const configRows = ref<EditableConfig[]>([]);
const pokemonRows = ref<Pokemon[]>([]);
const itemRows = ref<Item[]>([]);
const recipeRows = ref<Recipe[]>([]);
const habitatRows = ref<Habitat[]>([]);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');

const configForm = ref({ id: 0, name: '', subcategory: '' });
const pokemonForm = ref({ id: '', name: '', environmentId: '', skillIds: [] as string[], favoriteThingIds: [] as string[] });
const itemForm = ref({
  id: 0,
  name: '',
  categoryId: '',
  usageId: '',
  dyeable: false,
  dualDyeable: false,
  patternEditable: false,
  acquisitionMethodIds: [] as string[],
  tagIds: [] as string[]
});
const recipeForm = ref({
  id: 0,
  itemId: '',
  acquisitionMethodIds: [] as string[],
  materials: [] as Array<{ itemId: string; quantity: number }>
});
const habitatForm = ref({
  id: 0,
  name: '',
  recipeItems: [] as Array<{ itemId: string; quantity: number }>,
  pokemonAppearances: [] as HabitatAppearanceForm[]
});

const selectedConfig = computed(() => configTypes.find((item) => item.key === activeConfigType.value) ?? configTypes[0]);

function toIds(values: string[]): number[] {
  return values.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function toQuantityRows(rows: Array<{ itemId: string; quantity: number }>) {
  return rows
    .map((item) => ({ itemId: Number(item.itemId), quantity: Number(item.quantity) }))
    .filter((item) => Number.isInteger(item.itemId) && item.itemId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);
}

async function run(action: () => Promise<void>) {
  busy.value = true;
  message.value = '';
  try {
    await action();
  } catch (error) {
    message.value = error instanceof Error && error.message ? error.message : '操作失败';
  } finally {
    busy.value = false;
  }
}

async function loadOptions() {
  options.value = await api.options();
}

async function loadConfig() {
  configRows.value = (await api.config(activeConfigType.value)) as EditableConfig[];
}

async function createTagsOption(selectKey: string, type: ConfigType, name: string, values: string[], max = 0) {
  const cleanName = name.trim();
  if (!cleanName || (max > 0 && values.length >= max)) return;

  creatingSelect.value = selectKey;
  try {
    await run(async () => {
      const created = await api.createConfig(type, { name: cleanName, subcategory: null });
      await loadOptions();
      const value = String(created.id);
      if (!values.includes(value)) {
        values.push(value);
      }
      if (activeConfigType.value === type) {
        await loadConfig();
      }
    });
  } finally {
    creatingSelect.value = '';
  }
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

async function loadCurrentTab() {
  await loadOptions();
  if (activeTab.value === 'config') await loadConfig();
  if (activeTab.value === 'pokemon') await loadPokemon();
  if (activeTab.value === 'items') {
    await Promise.all([loadItems(), loadRecipes()]);
  }
  if (activeTab.value === 'recipes') {
    await Promise.all([loadRecipes(), loadItems()]);
  }
  if (activeTab.value === 'habitats') {
    await Promise.all([loadHabitats(), loadPokemon(), loadItems()]);
  }
}

function setTab(tab: AdminTab) {
  activeTab.value = tab;
  void run(loadCurrentTab);
}

function resetConfigForm() {
  configForm.value = { id: 0, name: '', subcategory: '' };
}

function editConfig(item: EditableConfig) {
  configForm.value = { id: item.id, name: item.name, subcategory: item.subcategory ?? '' };
}

async function saveConfig() {
  await run(async () => {
    const payload = { name: configForm.value.name, subcategory: configForm.value.subcategory || null };
    if (configForm.value.id) {
      await api.updateConfig(activeConfigType.value, configForm.value.id, payload);
    } else {
      await api.createConfig(activeConfigType.value, payload);
    }
    resetConfigForm();
    await loadCurrentTab();
  });
}

async function removeConfig(id: number) {
  await run(async () => {
    await api.deleteConfig(activeConfigType.value, id);
    await loadCurrentTab();
  });
}

function resetPokemonForm() {
  pokemonForm.value = { id: '', name: '', environmentId: '', skillIds: [], favoriteThingIds: [] };
}

function editPokemon(item: Pokemon) {
  pokemonForm.value = {
    id: String(item.id),
    name: item.name,
    environmentId: String(item.environment.id),
    skillIds: item.skills.map((skill) => String(skill.id)),
    favoriteThingIds: item.favorite_things.map((thing) => String(thing.id))
  };
}

async function savePokemon() {
  await run(async () => {
    const payload: PokemonPayload = {
      id: Number(pokemonForm.value.id),
      name: pokemonForm.value.name,
      environmentId: Number(pokemonForm.value.environmentId),
      skillIds: toIds(pokemonForm.value.skillIds.slice(0, 2)),
      favoriteThingIds: toIds(pokemonForm.value.favoriteThingIds.slice(0, 6))
    };
    const exists = pokemonRows.value.some((item) => item.id === payload.id);
    if (exists) {
      await api.updatePokemon(payload.id, payload);
    } else {
      await api.createPokemon(payload);
    }
    resetPokemonForm();
    await loadPokemon();
  });
}

async function removePokemon(id: number) {
  await run(async () => {
    await api.deletePokemon(id);
    await loadPokemon();
  });
}

function resetItemForm() {
  itemForm.value = {
    id: 0,
    name: '',
    categoryId: '',
    usageId: '',
    dyeable: false,
    dualDyeable: false,
    patternEditable: false,
    acquisitionMethodIds: [],
    tagIds: []
  };
}

async function editItem(item: Item) {
  await run(async () => {
    const detail = await api.itemDetail(item.id);
    itemForm.value = {
      id: detail.id,
      name: detail.name,
      categoryId: String(detail.category.id),
      usageId: detail.usage ? String(detail.usage.id) : '',
      dyeable: detail.customization.dyeable,
      dualDyeable: detail.customization.dualDyeable,
      patternEditable: detail.customization.patternEditable,
      acquisitionMethodIds: detail.acquisitionMethods.map((method) => String(method.id)),
      tagIds: detail.tags.map((tag) => String(tag.id))
    };
  });
}

async function saveItem() {
  await run(async () => {
    const payload: ItemPayload = {
      name: itemForm.value.name,
      categoryId: Number(itemForm.value.categoryId),
      usageId: itemForm.value.usageId ? Number(itemForm.value.usageId) : null,
      dyeable: itemForm.value.dyeable,
      dualDyeable: itemForm.value.dualDyeable,
      patternEditable: itemForm.value.patternEditable,
      acquisitionMethodIds: toIds(itemForm.value.acquisitionMethodIds),
      tagIds: toIds(itemForm.value.tagIds)
    };
    if (itemForm.value.id) {
      await api.updateItem(itemForm.value.id, payload);
    } else {
      await api.createItem(payload);
    }
    resetItemForm();
    await loadItems();
  });
}

async function removeItem(id: number) {
  await run(async () => {
    await api.deleteItem(id);
    await loadItems();
  });
}

function resetRecipeForm() {
  recipeForm.value = { id: 0, itemId: '', acquisitionMethodIds: [], materials: [] };
}

function addRecipeMaterial() {
  recipeForm.value.materials.push({ itemId: '', quantity: 1 });
}

async function editRecipe(item: Recipe) {
  await run(async () => {
    const detail = await api.recipeDetail(item.id);
    recipeForm.value = {
      id: detail.id,
      itemId: String(detail.item.id),
      acquisitionMethodIds: detail.acquisition_methods.map((method) => String(method.id)),
      materials: detail.materials.map((material) => ({ itemId: String(material.id), quantity: material.quantity }))
    };
  });
}

async function saveRecipe() {
  await run(async () => {
    const payload: RecipePayload = {
      itemId: Number(recipeForm.value.itemId),
      acquisitionMethodIds: toIds(recipeForm.value.acquisitionMethodIds),
      materials: toQuantityRows(recipeForm.value.materials)
    };
    if (recipeForm.value.id) {
      await api.updateRecipe(recipeForm.value.id, payload);
    } else {
      await api.createRecipe(payload);
    }
    resetRecipeForm();
    await Promise.all([loadRecipes(), loadItems()]);
  });
}

async function removeRecipe(id: number) {
  await run(async () => {
    await api.deleteRecipe(id);
    await loadRecipes();
  });
}

function resetHabitatForm() {
  habitatForm.value = { id: 0, name: '', recipeItems: [], pokemonAppearances: [] };
}

function addHabitatRecipeItem() {
  habitatForm.value.recipeItems.push({ itemId: '', quantity: 1 });
}

function addPokemonAppearance() {
  habitatForm.value.pokemonAppearances.push({
    pokemonId: '',
    mapIds: [],
    timeOfDays: ['早晨'],
    weathers: ['晴天'],
    rarity: 1
  });
}

function groupPokemonAppearances(detail: HabitatDetail): HabitatAppearanceForm[] {
  const rows = new Map<string, HabitatAppearanceForm>();

  detail.pokemon.forEach((pokemon) => {
    const key = `${pokemon.id}:${pokemon.rarity}`;
    const row = rows.get(key) ?? {
      pokemonId: String(pokemon.id),
      mapIds: [],
      timeOfDays: [],
      weathers: [],
      rarity: pokemon.rarity
    };

    const mapId = String(pokemon.map.id);
    if (!row.mapIds.includes(mapId)) row.mapIds.push(mapId);
    if (!row.timeOfDays.includes(pokemon.time_of_day)) row.timeOfDays.push(pokemon.time_of_day);
    if (!row.weathers.includes(pokemon.weather)) row.weathers.push(pokemon.weather);
    rows.set(key, row);
  });

  return [...rows.values()];
}

async function editHabitat(item: Habitat) {
  await run(async () => {
    const detail = await api.habitatDetail(item.id);
    habitatForm.value = {
      id: detail.id,
      name: detail.name,
      recipeItems: detail.recipe.map((recipeItem) => ({ itemId: String(recipeItem.id), quantity: recipeItem.quantity })),
      pokemonAppearances: groupPokemonAppearances(detail)
    };
  });
}

async function saveHabitat() {
  await run(async () => {
    const payload: HabitatPayload = {
      name: habitatForm.value.name,
      recipeItems: toQuantityRows(habitatForm.value.recipeItems),
      pokemonAppearances: habitatForm.value.pokemonAppearances
        .map((item) => ({
          pokemonId: Number(item.pokemonId),
          mapIds: toIds(item.mapIds),
          timeOfDays: item.timeOfDays.filter((entry) => timeOfDays.includes(entry)),
          weathers: item.weathers.filter((entry) => weathers.includes(entry)),
          rarity: Number(item.rarity)
        }))
        .filter((item) => item.pokemonId > 0 && item.mapIds.length > 0 && item.timeOfDays.length > 0 && item.weathers.length > 0)
    };
    if (habitatForm.value.id) {
      await api.updateHabitat(habitatForm.value.id, payload);
    } else {
      await api.createHabitat(payload);
    }
    resetHabitatForm();
    await loadHabitats();
  });
}

async function removeHabitat(id: number) {
  await run(async () => {
    await api.deleteHabitat(id);
    await loadHabitats();
  });
}

onMounted(() => {
  void run(loadCurrentTab);
});
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">管理</h1>
        <p class="page-subtitle">维护 Wiki 数据和系统配置。</p>
      </div>
    </div>

    <div class="tabs" role="tablist" aria-label="管理模块">
      <button v-for="tab in tabs" :key="tab.key" :class="{ active: activeTab === tab.key }" type="button" @click="setTab(tab.key)">
        {{ tab.label }}
      </button>
    </div>

    <p v-if="message" class="status">{{ message }}</p>

    <section v-if="activeTab === 'config'" class="admin-layout">
      <form class="detail-section" @submit.prevent="saveConfig">
        <h2>系统配置</h2>
        <div class="field">
          <label for="config-type">类型</label>
          <select id="config-type" v-model="activeConfigType" @change="run(loadConfig)">
            <option v-for="item in configTypes" :key="item.key" :value="item.key">{{ item.label }}</option>
          </select>
        </div>
        <div class="field">
          <label for="config-name">名称</label>
          <input id="config-name" v-model="configForm.name" />
        </div>
        <div v-if="selectedConfig.hasSubcategory" class="field">
          <label for="config-subcategory">二级分类</label>
          <input id="config-subcategory" v-model="configForm.subcategory" />
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">保存</button>
          <button type="button" class="plain-button" @click="resetConfigForm">新建</button>
        </div>
      </form>

      <div class="detail-section">
        <h2>{{ selectedConfig.label }}</h2>
        <ul class="row-list">
          <li v-for="item in configRows" :key="item.id">
            <span>{{ item.name }}<span v-if="item.subcategory"> · {{ item.subcategory }}</span></span>
            <span class="row-actions">
              <button type="button" @click="editConfig(item)">编辑</button>
              <button type="button" @click="removeConfig(item.id)">删除</button>
            </span>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="activeTab === 'pokemon' && options" class="admin-layout">
      <form class="detail-section" @submit.prevent="savePokemon">
        <h2>Pokemon</h2>
        <div class="field"><label for="pokemon-id">ID</label><input id="pokemon-id" v-model="pokemonForm.id" type="number" /></div>
        <div class="field"><label for="pokemon-name">名字</label><input id="pokemon-name" v-model="pokemonForm.name" /></div>
        <div class="field">
          <label for="pokemon-environment">喜欢的环境</label>
          <select id="pokemon-environment" v-model="pokemonForm.environmentId">
            <option value="">请选择</option>
            <option v-for="item in options.environments" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="pokemon-skills">特长</label>
          <TagsSelect
            id="pokemon-skills"
            v-model="pokemonForm.skillIds"
            :options="options.skills"
            :max="2"
            allow-create
            :creating="creatingSelect === 'pokemon-skills'"
            placeholder="搜索特长"
            @create="createTagsOption('pokemon-skills', 'skills', $event, pokemonForm.skillIds, 2)"
          />
        </div>
        <div class="field">
          <label for="pokemon-things">喜欢的东西</label>
          <TagsSelect
            id="pokemon-things"
            v-model="pokemonForm.favoriteThingIds"
            :options="options.favoriteThings"
            :max="6"
            allow-create
            :creating="creatingSelect === 'pokemon-things'"
            placeholder="搜索喜欢的东西"
            @create="createTagsOption('pokemon-things', 'favorite-things', $event, pokemonForm.favoriteThingIds, 6)"
          />
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">保存</button>
          <button type="button" class="plain-button" @click="resetPokemonForm">新建</button>
        </div>
      </form>

      <div class="detail-section">
        <h2>Pokemon 列表</h2>
        <ul class="row-list">
          <li v-for="item in pokemonRows" :key="item.id">
            <span>#{{ item.id }} {{ item.name }}</span>
            <span class="row-actions">
              <button type="button" @click="editPokemon(item)">编辑</button>
              <button type="button" @click="removePokemon(item.id)">删除</button>
            </span>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="activeTab === 'items' && options" class="admin-layout">
      <form class="detail-section" @submit.prevent="saveItem">
        <h2>物品</h2>
        <div class="field"><label for="item-name">名称</label><input id="item-name" v-model="itemForm.name" /></div>
        <div class="field">
          <label for="item-category">分类</label>
          <select id="item-category" v-model="itemForm.categoryId">
            <option value="">请选择</option>
            <option v-for="item in options.itemCategories" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="item-usage">用途</label>
          <select id="item-usage" v-model="itemForm.usageId">
            <option value="">无</option>
            <option v-for="item in options.itemUsages" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>
        <div class="check-row">
          <label><input v-model="itemForm.dyeable" type="checkbox" /> 可染色</label>
          <label><input v-model="itemForm.dualDyeable" type="checkbox" /> 可双区染色</label>
          <label><input v-model="itemForm.patternEditable" type="checkbox" /> 可改花纹</label>
        </div>
        <div class="field">
          <label for="item-methods">入手方式</label>
          <TagsSelect
            id="item-methods"
            v-model="itemForm.acquisitionMethodIds"
            :options="options.acquisitionMethods"
            allow-create
            :creating="creatingSelect === 'item-methods'"
            placeholder="搜索入手方式"
            @create="createTagsOption('item-methods', 'acquisition-methods', $event, itemForm.acquisitionMethodIds)"
          />
        </div>
        <div class="field">
          <label for="item-tags">标签</label>
          <TagsSelect
            id="item-tags"
            v-model="itemForm.tagIds"
            :options="options.itemTags"
            allow-create
            :creating="creatingSelect === 'item-tags'"
            placeholder="搜索标签"
            @create="createTagsOption('item-tags', 'favorite-things', $event, itemForm.tagIds)"
          />
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">保存</button>
          <button type="button" class="plain-button" @click="resetItemForm">新建</button>
        </div>
      </form>

      <div class="detail-section">
        <h2>物品列表</h2>
        <ul class="row-list">
          <li v-for="item in itemRows" :key="item.id">
            <span>{{ item.name }}</span>
            <span class="row-actions">
              <button type="button" @click="editItem(item)">编辑</button>
              <button type="button" @click="removeItem(item.id)">删除</button>
            </span>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="activeTab === 'recipes' && options" class="admin-layout">
      <form class="detail-section" @submit.prevent="saveRecipe">
        <h2>材料单</h2>
        <div class="field">
          <label for="recipe-item">物品</label>
          <select id="recipe-item" v-model="recipeForm.itemId">
            <option value="">请选择</option>
            <option v-for="item in itemRows" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="recipe-methods">入手方式</label>
          <TagsSelect
            id="recipe-methods"
            v-model="recipeForm.acquisitionMethodIds"
            :options="options.acquisitionMethods"
            allow-create
            :creating="creatingSelect === 'recipe-methods'"
            placeholder="搜索入手方式"
            @create="createTagsOption('recipe-methods', 'acquisition-methods', $event, recipeForm.acquisitionMethodIds)"
          />
        </div>
        <div class="field">
          <label>需要材料</label>
          <div v-for="(row, index) in recipeForm.materials" :key="index" class="inline-row">
            <select v-model="row.itemId">
              <option value="">请选择</option>
              <option v-for="item in itemRows" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
            </select>
            <input v-model.number="row.quantity" type="number" min="1" />
            <button type="button" @click="recipeForm.materials.splice(index, 1)">删除</button>
          </div>
          <button type="button" class="plain-button" @click="addRecipeMaterial">添加材料</button>
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">保存</button>
          <button type="button" class="plain-button" @click="resetRecipeForm">新建</button>
        </div>
      </form>

      <div class="detail-section">
        <h2>材料单列表</h2>
        <ul class="row-list">
          <li v-for="item in recipeRows" :key="item.id">
            <span>{{ item.name }}</span>
            <span class="row-actions">
              <button type="button" @click="editRecipe(item)">编辑</button>
              <button type="button" @click="removeRecipe(item.id)">删除</button>
            </span>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="activeTab === 'habitats' && options" class="admin-layout">
      <form class="detail-section" @submit.prevent="saveHabitat">
        <h2>栖息地</h2>
        <div class="field"><label for="habitat-name">名称</label><input id="habitat-name" v-model="habitatForm.name" /></div>
        <div class="field">
          <label>配方</label>
          <div v-for="(row, index) in habitatForm.recipeItems" :key="index" class="inline-row">
            <select v-model="row.itemId">
              <option value="">请选择</option>
              <option v-for="item in itemRows" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
            </select>
            <input v-model.number="row.quantity" type="number" min="1" />
            <button type="button" @click="habitatForm.recipeItems.splice(index, 1)">删除</button>
          </div>
          <button type="button" class="plain-button" @click="addHabitatRecipeItem">添加物品</button>
        </div>
        <div class="field">
          <label>可出现的宝可梦</label>
          <div v-for="(row, index) in habitatForm.pokemonAppearances" :key="index" class="appearance-row">
            <select v-model="row.pokemonId">
              <option value="">Pokemon</option>
              <option v-for="item in pokemonRows" :key="item.id" :value="String(item.id)">#{{ item.id }} {{ item.name }}</option>
            </select>
            <TagsSelect
              :id="`appearance-maps-${index}`"
              v-model="row.mapIds"
              :options="options.maps"
              allow-create
              :creating="creatingSelect === `appearance-maps-${index}`"
              placeholder="搜索地图"
              @create="createTagsOption(`appearance-maps-${index}`, 'maps', $event, row.mapIds)"
            />
            <TagsSelect :id="`appearance-times-${index}`" v-model="row.timeOfDays" :options="timeOfDayOptions" placeholder="搜索时间" />
            <TagsSelect :id="`appearance-weathers-${index}`" v-model="row.weathers" :options="weatherOptions" placeholder="搜索天气" />
            <input v-model.number="row.rarity" type="number" min="1" max="3" />
            <button type="button" @click="habitatForm.pokemonAppearances.splice(index, 1)">删除</button>
          </div>
          <button type="button" class="plain-button" @click="addPokemonAppearance">添加 Pokemon</button>
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">保存</button>
          <button type="button" class="plain-button" @click="resetHabitatForm">新建</button>
        </div>
      </form>

      <div class="detail-section">
        <h2>栖息地列表</h2>
        <ul class="row-list">
          <li v-for="item in habitatRows" :key="item.id">
            <span>{{ item.name }}</span>
            <span class="row-actions">
              <button type="button" @click="editHabitat(item)">编辑</button>
              <button type="button" @click="removeHabitat(item.id)">删除</button>
            </span>
          </li>
        </ul>
      </div>
    </section>
  </section>
</template>
