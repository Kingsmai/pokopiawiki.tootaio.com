<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PageHeader from '../components/PageHeader.vue';
import ReorderableList from '../components/ReorderableList.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TranslationFields from '../components/TranslationFields.vue';
import { defaultLocale, getCurrentLocale, setCurrentLocale } from '../i18n';
import {
  api,
  type AuthUser,
  type ConfigType,
  type DailyChecklistItem,
  type Habitat,
  type Item,
  type Language,
  type NamedEntity,
  type Pokemon,
  type Recipe,
  type Skill,
  type TranslationMap
} from '../services/api';

type AdminTab = 'config' | 'languages' | 'checklist' | 'pokemon' | 'items' | 'recipes' | 'habitats';
type EditableConfig = (NamedEntity | Skill) & { hasItemDrop?: boolean };

const { locale, t } = useI18n();

const tabs = computed<Array<{ key: AdminTab; label: string }>>(() => [
  { key: 'config', label: t('pages.admin.config') },
  { key: 'languages', label: t('pages.admin.languages') },
  { key: 'checklist', label: t('pages.admin.checklist') },
  { key: 'pokemon', label: 'Pokemon' },
  { key: 'items', label: t('pages.items.title') },
  { key: 'recipes', label: t('pages.recipes.title') },
  { key: 'habitats', label: t('pages.habitats.title') }
]);

const configTypes = computed<Array<{ key: ConfigType; label: string; supportsItemDrop?: boolean }>>(() => [
  { key: 'skills', label: t('config.skills'), supportsItemDrop: true },
  { key: 'environments', label: t('config.environments') },
  { key: 'favorite-things', label: t('config.favoriteThings') },
  { key: 'item-categories', label: t('config.itemCategories') },
  { key: 'item-usages', label: t('config.itemUsages') },
  { key: 'acquisition-methods', label: t('config.acquisitionMethods') },
  { key: 'maps', label: t('config.maps') }
]);

const activeTab = ref<AdminTab>('config');
const activeConfigType = ref<ConfigType>('skills');
const configRows = ref<EditableConfig[]>([]);
const languageRows = ref<Language[]>([]);
const checklistRows = ref<DailyChecklistItem[]>([]);
const pokemonRows = ref<Pokemon[]>([]);
const itemRows = ref<Item[]>([]);
const recipeRows = ref<Recipe[]>([]);
const habitatRows = ref<Habitat[]>([]);
const currentUser = ref<AuthUser | null>(null);
const busy = ref(false);
const contentLoading = ref(false);
const message = ref('');
const configForm = ref({ id: 0, name: '', translations: {} as TranslationMap, hasItemDrop: false });
const checklistForm = ref({ id: 0, title: '', translations: {} as TranslationMap });
const languageForm = ref({ code: '', name: '', enabled: true, isDefault: false, sortOrder: 0 });
const editingLanguageCode = ref('');

const selectedConfig = computed(() => configTypes.value.find((item) => item.key === activeConfigType.value) ?? configTypes.value[0]);
const configTabs = computed<TabOption[]>(() => configTypes.value.map((item) => ({ value: item.key, label: item.label })));
const currentConfigLocale = computed(() => String(locale.value || defaultLocale));
const isConfigDefaultLocale = computed(() => currentConfigLocale.value === defaultLocale);
const configNameRequired = computed(() => isConfigDefaultLocale.value || !configForm.value.id);
const configNameInput = computed({
  get: () => {
    if (isConfigDefaultLocale.value) {
      return configForm.value.name;
    }

    return configForm.value.translations[currentConfigLocale.value]?.name ?? configForm.value.name;
  },
  set: (value: string) => {
    if (isConfigDefaultLocale.value) {
      configForm.value.name = value;
      return;
    }

    updateConfigTranslation(currentConfigLocale.value, value);
  }
});
const activeConfigTab = computed({
  get: () => activeConfigType.value,
  set: (value: string) => {
    const nextConfig = configTypes.value.find((item) => item.key === value);
    if (!nextConfig || nextConfig.key === activeConfigType.value) return;

    activeConfigType.value = nextConfig.key;
    resetConfigForm();
    void run(loadConfig);
  }
});
const canEdit = computed(() => currentUser.value?.emailVerified === true);
const showAdminSkeleton = computed(() => busy.value && !message.value && (!currentUser.value || contentLoading.value));
const canSetLanguageDefault = computed(() => languageForm.value.code === 'en');
const checklistKey = (item: DailyChecklistItem) => item.id;
const checklistLabel = (item: DailyChecklistItem) => item.title;
const languageKey = (item: Language) => item.code;
const languageLabel = (item: Language) => item.name;
const configKey = (item: EditableConfig) => item.id;
const configLabel = (item: EditableConfig) => item.name;
const pokemonKey = (item: Pokemon) => item.id;
const pokemonLabel = (item: Pokemon) => `#${item.id} ${item.name}`;
const itemKey = (item: Item) => item.id;
const itemLabel = (item: Item) => item.name;
const recipeKey = (item: Recipe) => item.id;
const recipeLabel = (item: Recipe) => item.name;
const habitatKey = (item: Habitat) => item.id;
const habitatLabel = (item: Habitat) => item.name;

function dragSortLabel(name: string) {
  return t('pages.admin.dragSort', { name });
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function run(action: () => Promise<void>) {
  busy.value = true;
  message.value = '';
  try {
    await action();
  } catch (error) {
    message.value = errorText(error, t('errors.operationFailed'));
  } finally {
    busy.value = false;
  }
}

async function loadConfig() {
  await loadLanguages();
  configRows.value = (await api.config(activeConfigType.value)) as EditableConfig[];
}

async function loadLanguages() {
  languageRows.value = await api.adminLanguages();
}

function resetConfigForm() {
  configForm.value = { id: 0, name: '', translations: {}, hasItemDrop: false };
}

function resetChecklistForm() {
  checklistForm.value = { id: 0, title: '', translations: {} };
}

function resetLanguageForm() {
  languageForm.value = { code: '', name: '', enabled: true, isDefault: false, sortOrder: 0 };
  editingLanguageCode.value = '';
}

function editConfig(item: EditableConfig) {
  configForm.value = { id: item.id, name: item.baseName ?? item.name, translations: item.translations ?? {}, hasItemDrop: item.hasItemDrop === true };
}

function editChecklistItem(item: DailyChecklistItem) {
  checklistForm.value = { id: item.id, title: item.title, translations: item.translations ?? {} };
}

function editLanguage(item: Language) {
  editingLanguageCode.value = item.code;
  languageForm.value = {
    code: item.code,
    name: item.name,
    enabled: item.enabled,
    isDefault: item.isDefault,
    sortOrder: item.sortOrder
  };
}

function updateConfigTranslation(localeCode: string, value: string) {
  const nextTranslations: TranslationMap = { ...configForm.value.translations };
  const nextFields = { ...(nextTranslations[localeCode] ?? {}) };

  if (value.trim() === '') {
    delete nextFields.name;
  } else {
    nextFields.name = value;
  }

  if (Object.keys(nextFields).length) {
    nextTranslations[localeCode] = nextFields;
  } else {
    delete nextTranslations[localeCode];
  }

  configForm.value.translations = nextTranslations;
}

function configBaseNameForSave() {
  if (configForm.value.name.trim() !== '' || isConfigDefaultLocale.value) {
    return configForm.value.name;
  }

  return configForm.value.translations[currentConfigLocale.value]?.name ?? '';
}

function previewChecklistOrder(rows: DailyChecklistItem[]) {
  checklistRows.value = rows;
}

function previewLanguageOrder(rows: Language[]) {
  languageRows.value = rows;
}

function previewConfigOrder(rows: EditableConfig[]) {
  configRows.value = rows;
}

function previewPokemonOrder(rows: Pokemon[]) {
  pokemonRows.value = rows;
}

function previewItemOrder(rows: Item[]) {
  itemRows.value = rows;
}

function previewRecipeOrder(rows: Recipe[]) {
  recipeRows.value = rows;
}

function previewHabitatOrder(rows: Habitat[]) {
  habitatRows.value = rows;
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

async function persistLanguageOrder(nextRows: Language[], fallbackRows: Language[]) {
  languageRows.value = nextRows;
  await run(async () => {
    try {
      languageRows.value = await api.reorderLanguages(nextRows.map((item) => item.code));
      setCurrentLocale(getCurrentLocale());
    } catch (error) {
      languageRows.value = fallbackRows;
      throw error;
    }
  });
}

async function persistConfigOrder(nextRows: EditableConfig[], fallbackRows: EditableConfig[]) {
  configRows.value = nextRows;
  await run(async () => {
    try {
      configRows.value = (await api.reorderConfig(activeConfigType.value, nextRows.map((item) => item.id))) as EditableConfig[];
    } catch (error) {
      configRows.value = fallbackRows;
      throw error;
    }
  });
}

async function persistPokemonOrder(nextRows: Pokemon[], fallbackRows: Pokemon[]) {
  pokemonRows.value = nextRows;
  await run(async () => {
    try {
      pokemonRows.value = await api.reorderPokemon(nextRows.map((item) => item.id));
    } catch (error) {
      pokemonRows.value = fallbackRows;
      throw error;
    }
  });
}

async function persistItemOrder(nextRows: Item[], fallbackRows: Item[]) {
  itemRows.value = nextRows;
  await run(async () => {
    try {
      itemRows.value = await api.reorderItems(nextRows.map((item) => item.id));
    } catch (error) {
      itemRows.value = fallbackRows;
      throw error;
    }
  });
}

async function persistRecipeOrder(nextRows: Recipe[], fallbackRows: Recipe[]) {
  recipeRows.value = nextRows;
  await run(async () => {
    try {
      recipeRows.value = await api.reorderRecipes(nextRows.map((item) => item.id));
    } catch (error) {
      recipeRows.value = fallbackRows;
      throw error;
    }
  });
}

async function persistHabitatOrder(nextRows: Habitat[], fallbackRows: Habitat[]) {
  habitatRows.value = nextRows;
  await run(async () => {
    try {
      habitatRows.value = await api.reorderHabitats(nextRows.map((item) => item.id));
    } catch (error) {
      habitatRows.value = fallbackRows;
      throw error;
    }
  });
}

async function saveConfig() {
  await run(async () => {
    const payload = {
      name: configBaseNameForSave(),
      translations: configForm.value.translations,
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
  await loadLanguages();
  checklistRows.value = await api.dailyChecklist();
  if (!checklistForm.value.id && checklistForm.value.title.trim() === '') {
    resetChecklistForm();
  }
}

async function saveChecklistItem() {
  await run(async () => {
    const payload = {
      title: checklistForm.value.title,
      translations: checklistForm.value.translations
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

async function saveLanguage() {
  await run(async () => {
    const payload = {
      code: languageForm.value.code,
      name: languageForm.value.name,
      enabled: languageForm.value.enabled,
      isDefault: languageForm.value.isDefault,
      sortOrder: languageSortOrderForSave()
    };

    languageRows.value = editingLanguageCode.value
      ? await api.updateLanguage(editingLanguageCode.value, payload)
      : await api.createLanguage(payload);
    resetLanguageForm();
    setCurrentLocale(getCurrentLocale());
  });
}

function languageSortOrderForSave() {
  if (editingLanguageCode.value) {
    return languageRows.value.find((item) => item.code === editingLanguageCode.value)?.sortOrder ?? languageForm.value.sortOrder;
  }

  return languageRows.value.reduce((maxOrder, item) => Math.max(maxOrder, item.sortOrder), 0) + 10;
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
    if (activeTab.value === 'languages') await loadLanguages();
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
    message.value = t('errors.completeEmailVerification');
    return;
  }

  activeTab.value = tab;
  void run(() => loadCurrentTab(true));
}

async function loadAdmin() {
  const response = await api.me();
  currentUser.value = response.user;

  if (!response.user.emailVerified) {
    message.value = t('errors.completeEmailVerification');
    return;
  }

  await loadCurrentTab(true);
}

async function removeLanguage(code: string) {
  await run(async () => {
    await api.deleteLanguage(code);
    if (editingLanguageCode.value === code) {
      resetLanguageForm();
    }
    await loadLanguages();
    setCurrentLocale(getCurrentLocale());
  });
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
    <PageHeader :title="t('pages.admin.title')" :subtitle="t('pages.admin.subtitle')">
      <template #kicker>Admin</template>
    </PageHeader>

    <div v-if="canEdit" class="tabs" role="tablist" :aria-label="t('pages.admin.modules')">
      <button v-for="tab in tabs" :key="tab.key" :class="{ active: activeTab === tab.key }" type="button" @click="setTab(tab.key)">
        {{ tab.label }}
      </button>
    </div>

    <StatusMessage v-if="message" variant="warning">{{ message }}</StatusMessage>

    <section v-if="showAdminSkeleton" class="detail-section skeleton-detail-section" aria-busy="true" :aria-label="t('pages.admin.loading')">
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
      <h2>{{ t('pages.admin.checklist') }}</h2>

      <form class="detail-section__body" @submit.prevent="saveChecklistItem">
        <h3 class="section-subtitle">{{ checklistForm.id ? t('pages.checklist.editTask') : t('pages.checklist.newTask') }}</h3>
        <TranslationFields
          id-prefix="checklist-title"
          v-model:base-value="checklistForm.title"
          v-model:translations="checklistForm.translations"
          field="title"
          :label="t('pages.checklist.task')"
          :languages="languageRows"
          required
        />
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">{{ busy ? t('common.saving') : t('common.save') }}</button>
          <button type="button" class="plain-button" :disabled="busy" @click="resetChecklistForm">{{ t('common.new') }}</button>
        </div>
      </form>

      <h3 class="section-subtitle">{{ t('pages.checklist.sectionTitle') }}</h3>
      <ReorderableList
        v-if="checklistRows.length"
        :items="checklistRows"
        :item-key="checklistKey"
        :item-label="checklistLabel"
        list-key-prefix="checklist"
        :disabled="busy"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewChecklistOrder"
        @cancel="previewChecklistOrder"
        @reorder="persistChecklistOrder"
      >
        <template #default="{ item }">
          <span class="reorderable-row-title">{{ item.title }}</span>
          <span class="row-actions">
            <button type="button" :disabled="busy" @click="editChecklistItem(item)">{{ t('common.edit') }}</button>
            <button type="button" :disabled="busy" @click="removeChecklistItem(item.id)">{{ t('common.delete') }}</button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'config'" class="detail-section">
      <h2>{{ t('pages.admin.config') }}</h2>
      <Tabs id="admin-config-type" v-model="activeConfigTab" :tabs="configTabs" :label="t('pages.admin.configType')" />

      <form class="detail-section__body" @submit.prevent="saveConfig">
        <h3 class="section-subtitle">
          {{ configForm.id ? t('pages.admin.editConfig', { name: selectedConfig.label }) : t('pages.admin.newConfig', { name: selectedConfig.label }) }}
        </h3>
        <div class="field">
          <label for="config-name">{{ t('common.name') }}</label>
          <input id="config-name" v-model="configNameInput" :required="configNameRequired" />
        </div>
        <div v-if="selectedConfig.supportsItemDrop" class="check-row">
          <label>
            <input v-model="configForm.hasItemDrop" type="checkbox" />
            {{ t('pages.admin.hasItemDrop') }}
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">{{ busy ? t('common.saving') : t('common.save') }}</button>
          <button type="button" class="plain-button" :disabled="busy" @click="resetConfigForm">{{ t('common.new') }}</button>
        </div>
      </form>

      <h3 class="section-subtitle">{{ selectedConfig.label }}</h3>
      <ReorderableList
        v-if="configRows.length"
        :items="configRows"
        :item-key="configKey"
        :item-label="configLabel"
        :list-key-prefix="`config-${activeConfigType}`"
        :disabled="busy"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewConfigOrder"
        @cancel="previewConfigOrder"
        @reorder="persistConfigOrder"
      >
        <template #default="{ item }">
          <span class="reorderable-row-title">
            {{ item.name }}<span v-if="item.hasItemDrop" class="config-flag">{{ t('pages.admin.hasItemDrop') }}</span>
          </span>
          <span class="row-actions">
            <button type="button" :disabled="busy" @click="editConfig(item)">{{ t('common.edit') }}</button>
            <button type="button" :disabled="busy" @click="removeConfig(item.id)">{{ t('common.delete') }}</button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'languages'" class="detail-section">
      <h2>{{ t('pages.admin.languages') }}</h2>

      <form class="detail-section__body" @submit.prevent="saveLanguage">
        <h3 class="section-subtitle">{{ editingLanguageCode ? t('pages.admin.editLanguage') : t('pages.admin.newLanguage') }}</h3>
        <div class="field">
          <label for="language-code">{{ t('pages.admin.languageCode') }}</label>
          <input id="language-code" v-model="languageForm.code" :disabled="Boolean(editingLanguageCode)" required />
        </div>
        <div class="field">
          <label for="language-name">{{ t('pages.admin.languageName') }}</label>
          <input id="language-name" v-model="languageForm.name" required />
        </div>
        <div class="check-row">
          <label><input v-model="languageForm.enabled" type="checkbox" /> {{ t('pages.admin.enabled') }}</label>
          <label>
            <input v-model="languageForm.isDefault" type="checkbox" :disabled="!canSetLanguageDefault" />
            {{ t('pages.admin.defaultLanguage') }}
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="link-button" :disabled="busy">{{ busy ? t('common.saving') : t('common.save') }}</button>
          <button type="button" class="plain-button" :disabled="busy" @click="resetLanguageForm">{{ t('common.new') }}</button>
        </div>
      </form>

      <ReorderableList
        v-if="languageRows.length"
        :items="languageRows"
        :item-key="languageKey"
        :item-label="languageLabel"
        list-key-prefix="languages"
        :disabled="busy"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewLanguageOrder"
        @cancel="previewLanguageOrder"
        @reorder="persistLanguageOrder"
      >
        <template #default="{ item }">
          <span class="reorderable-row-title">
            {{ item.name }} <span class="meta-line">{{ item.code }}</span>
            <span v-if="item.isDefault" class="config-flag">{{ t('pages.admin.defaultLanguage') }}</span>
          </span>
          <span class="row-actions">
            <button type="button" @click="editLanguage(item)">{{ t('common.edit') }}</button>
            <button type="button" :disabled="item.isDefault" @click="removeLanguage(item.code)">{{ t('common.delete') }}</button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'pokemon'" class="detail-section">
      <h2>{{ t('pages.admin.pokemonList') }}</h2>
      <ReorderableList
        v-if="pokemonRows.length"
        :items="pokemonRows"
        :item-key="pokemonKey"
        :item-label="pokemonLabel"
        list-key-prefix="pokemon"
        :disabled="busy"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewPokemonOrder"
        @cancel="previewPokemonOrder"
        @reorder="persistPokemonOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/pokemon/${item.id}`">#{{ item.id }} {{ item.name }}</RouterLink>
          <span class="row-actions">
            <button type="button" :disabled="busy" @click="removePokemon(item.id)">{{ t('common.delete') }}</button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'items'" class="detail-section">
      <h2>{{ t('pages.admin.itemList') }}</h2>
      <ReorderableList
        v-if="itemRows.length"
        :items="itemRows"
        :item-key="itemKey"
        :item-label="itemLabel"
        list-key-prefix="items"
        :disabled="busy"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewItemOrder"
        @cancel="previewItemOrder"
        @reorder="persistItemOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/items/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button type="button" :disabled="busy" @click="removeItem(item.id)">{{ t('common.delete') }}</button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'recipes'" class="detail-section">
      <h2>{{ t('pages.admin.recipeList') }}</h2>
      <ReorderableList
        v-if="recipeRows.length"
        :items="recipeRows"
        :item-key="recipeKey"
        :item-label="recipeLabel"
        list-key-prefix="recipes"
        :disabled="busy"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewRecipeOrder"
        @cancel="previewRecipeOrder"
        @reorder="persistRecipeOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/recipes/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button type="button" :disabled="busy" @click="removeRecipe(item.id)">{{ t('common.delete') }}</button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'habitats'" class="detail-section">
      <h2>{{ t('pages.admin.habitatList') }}</h2>
      <ReorderableList
        v-if="habitatRows.length"
        :items="habitatRows"
        :item-key="habitatKey"
        :item-label="habitatLabel"
        list-key-prefix="habitats"
        :disabled="busy"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewHabitatOrder"
        @cancel="previewHabitatOrder"
        @reorder="persistHabitatOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/habitats/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button type="button" :disabled="busy" @click="removeHabitat(item.id)">{{ t('common.delete') }}</button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>
  </section>
</template>
