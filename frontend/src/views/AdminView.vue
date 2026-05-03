<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '../components/Modal.vue';
import PageHeader from '../components/PageHeader.vue';
import ReorderableList from '../components/ReorderableList.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TranslationFields from '../components/TranslationFields.vue';
import {
  iconAdd,
  iconAdmin,
  iconCancel,
  iconChecklist,
  iconDelete,
  iconEdit,
  iconHabitat,
  iconItem,
  iconKey,
  iconPokemon,
  iconProfile,
  iconRecipe,
  iconSave,
  iconTranslate,
  type AppIcon
} from '../icons';
import { defaultLocale, getCurrentLocale, loadSystemWordings, setCurrentLocale } from '../i18n';
import {
  api,
  type AiModerationApiFormat,
  type AiModerationAuthMode,
  type AiModerationSettings,
  type AiModerationSettingsPayload,
  type AuthUser,
  type AdminUser,
  type ConfigType,
  type DailyChecklistItem,
  type Habitat,
  type Item,
  type Language,
  type NamedEntity,
  type Permission,
  type PermissionPayload,
  type Pokemon,
  type Recipe,
  type RoleDetail,
  type RolePayload,
  type Skill,
  type SystemWording,
  type SystemWordingSurface,
  type TranslationMap
} from '../services/api';

type AdminTab =
  | 'users'
  | 'roles'
  | 'permissions'
  | 'aiModeration'
  | 'config'
  | 'languages'
  | 'wordings'
  | 'checklist'
  | 'pokemon'
  | 'items'
  | 'recipes'
  | 'habitats';
type AdminGroup = 'content' | 'configuration' | 'localization' | 'access';
type AdminNavItem = { key: AdminTab; label: string; permission: string | string[] };
type AdminNavGroup = { key: AdminGroup; label: string; items: AdminNavItem[] };
type EditableConfig = (NamedEntity | Skill) & { hasItemDrop?: boolean };

const adminTabIcons: Record<AdminTab, AppIcon> = {
  users: iconProfile,
  roles: iconKey,
  permissions: iconKey,
  aiModeration: iconAdmin,
  config: iconAdmin,
  languages: iconTranslate,
  wordings: iconTranslate,
  checklist: iconChecklist,
  pokemon: iconPokemon,
  items: iconItem,
  recipes: iconRecipe,
  habitats: iconHabitat
};

const { locale, t } = useI18n();

const adminNavigationGroups = computed<AdminNavGroup[]>(() => {
  const groups: AdminNavGroup[] = [
    {
      key: 'configuration',
      label: t('pages.admin.configurationGroup'),
      items: [{ key: 'config', label: t('pages.admin.config'), permission: 'admin.config.read' }]
    },
    {
      key: 'content',
      label: t('pages.admin.contentGroup'),
      items: [
        { key: 'checklist', label: t('pages.admin.checklist'), permission: ['checklist.create', 'checklist.update', 'checklist.delete', 'checklist.order'] },
        { key: 'pokemon', label: t('pages.admin.pokemonList'), permission: ['pokemon.order', 'pokemon.delete'] },
        { key: 'items', label: t('pages.admin.itemList'), permission: ['items.order', 'items.delete'] },
        { key: 'recipes', label: t('pages.admin.recipeList'), permission: ['recipes.order', 'recipes.delete'] },
        { key: 'habitats', label: t('pages.admin.habitatList'), permission: ['habitats.order', 'habitats.delete'] }
      ]
    },
    {
      key: 'localization',
      label: t('pages.admin.localizationGroup'),
      items: [
        { key: 'languages', label: t('pages.admin.languages'), permission: 'admin.languages.read' },
        { key: 'wordings', label: t('pages.admin.wordings'), permission: 'admin.wordings.read' },
        { key: 'aiModeration', label: t('pages.admin.aiModeration'), permission: 'admin.ai-moderation.read' }
      ]
    },
    {
      key: 'access',
      label: t('pages.admin.accessGroup'),
      items: [
        { key: 'users', label: t('pages.admin.users'), permission: 'admin.users.read' },
        { key: 'roles', label: t('pages.admin.roles'), permission: 'admin.roles.read' },
        { key: 'permissions', label: t('pages.admin.permissions'), permission: 'admin.permissions.read' }
      ]
    }
  ];

  return groups
    .map((group) => ({ ...group, items: group.items.filter((tab) => canAny(tab.permission)) }))
    .filter((group) => group.items.length);
});
const tabs = computed<AdminNavItem[]>(() => adminNavigationGroups.value.flatMap((group) => group.items));

const configTypes = computed<Array<{ key: ConfigType; label: string; supportsItemDrop?: boolean }>>(() => [
  { key: 'pokemon-types', label: t('config.pokemonTypes') },
  { key: 'skills', label: t('config.skills'), supportsItemDrop: true },
  { key: 'environments', label: t('config.environments') },
  { key: 'favorite-things', label: t('config.favoriteThings') },
  { key: 'item-categories', label: t('config.itemCategories') },
  { key: 'item-usages', label: t('config.itemUsages') },
  { key: 'acquisition-methods', label: t('config.acquisitionMethods') },
  { key: 'maps', label: t('config.maps') },
  { key: 'life-tags', label: t('config.lifeTags') }
]);

const activeTab = ref<AdminTab>('config');
const activeConfigType = ref<ConfigType>('skills');
const userRows = ref<AdminUser[]>([]);
const roleRows = ref<RoleDetail[]>([]);
const permissionRows = ref<Permission[]>([]);
const configRows = ref<EditableConfig[]>([]);
const languageRows = ref<Language[]>([]);
const checklistRows = ref<DailyChecklistItem[]>([]);
const pokemonRows = ref<Pokemon[]>([]);
const itemRows = ref<Item[]>([]);
const recipeRows = ref<Recipe[]>([]);
const habitatRows = ref<Habitat[]>([]);
const wordingRows = ref<SystemWording[]>([]);
const aiModerationSettings = ref<AiModerationSettings | null>(null);
const currentUser = ref<AuthUser | null>(null);
const busy = ref(false);
const contentLoading = ref(false);
const message = ref('');
const configForm = ref({ id: 0, name: '', translations: {} as TranslationMap, hasItemDrop: false });
const checklistForm = ref({ id: 0, title: '', translations: {} as TranslationMap });
const languageForm = ref({ code: '', name: '', enabled: true, isDefault: false, sortOrder: 0 });
const wordingForm = ref({ key: '', locale: defaultLocale, value: '', defaultValue: '', placeholders: [] as string[] });
const aiModerationForm = ref({
  enabled: true,
  apiFormat: 'gemini-generate-content' as AiModerationApiFormat,
  authMode: 'bearer-token' as AiModerationAuthMode,
  endpoint: 'https://ai.example.com/v1beta',
  model: 'gemini-2.0-flash-lite',
  requestsPerMinute: 10,
  apiKey: '',
  clearApiKey: false
});
const userRoleForm = ref({ userId: 0, roleIds: [] as number[] });
const roleForm = ref({ id: 0, key: '', name: '', description: '', level: 100, enabled: true });
const rolePermissionForm = ref({ roleId: 0, permissionIds: [] as number[] });
const permissionForm = ref({ id: 0, key: '', name: '', description: '', category: 'General', enabled: true });
const editingLanguageCode = ref('');
const configModalOpen = ref(false);
const checklistModalOpen = ref(false);
const languageModalOpen = ref(false);
const wordingModalOpen = ref(false);
const userRoleModalOpen = ref(false);
const roleModalOpen = ref(false);
const rolePermissionsModalOpen = ref(false);
const permissionModalOpen = ref(false);
const wordingLocale = ref(getCurrentLocale());
const wordingModule = ref('');
const wordingSurface = ref<SystemWordingSurface | ''>('');
const wordingMissingOnly = ref(false);

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

    return configForm.value.translations[currentConfigLocale.value]?.name ?? '';
  },
  set: (value: string) => {
    if (isConfigDefaultLocale.value) {
      configForm.value.name = value;
      return;
    }

    updateConfigTranslation(currentConfigLocale.value, value);
  }
});
const configNamePlaceholder = computed(() => (isConfigDefaultLocale.value ? '' : configForm.value.name));
const activeConfigTab = computed({
  get: () => activeConfigType.value,
  set: (value: string) => {
    const nextConfig = configTypes.value.find((item) => item.key === value);
    if (!nextConfig || nextConfig.key === activeConfigType.value) return;

    activeConfigType.value = nextConfig.key;
    closeConfigModal();
    void run(loadConfig);
  }
});
const canEdit = computed(() => can('admin.access'));
const showAdminSkeleton = computed(() => busy.value && !message.value && (!currentUser.value || contentLoading.value));
const canSetLanguageDefault = computed(() => languageForm.value.code === 'en');
const configModalTitle = computed(() =>
  configForm.value.id ? t('pages.admin.editConfig', { name: selectedConfig.value.label }) : t('pages.admin.newConfig', { name: selectedConfig.value.label })
);
const checklistModalTitle = computed(() => (checklistForm.value.id ? t('pages.checklist.editTask') : t('pages.checklist.newTask')));
const languageModalTitle = computed(() => (editingLanguageCode.value ? t('pages.admin.editLanguage') : t('pages.admin.newLanguage')));
const wordingModalTitle = computed(() => t('pages.admin.editWording'));
const roleModalTitle = computed(() => (roleForm.value.id ? t('pages.admin.editRole') : t('pages.admin.newRole')));
const permissionModalTitle = computed(() =>
  permissionForm.value.id ? t('pages.admin.editPermission') : t('pages.admin.newPermission')
);
const rolePermissionsModalTitle = computed(() => t('pages.admin.rolePermissions'));
const userRoleModalTitle = computed(() => t('pages.admin.userRoles'));
const editingUser = computed(() => userRows.value.find((user) => user.id === userRoleForm.value.userId) ?? null);
const editingRole = computed(() => roleRows.value.find((role) => role.id === rolePermissionForm.value.roleId) ?? null);
const permissionGroups = computed(() => {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissionRows.value) {
    groups.set(permission.category, [...(groups.get(permission.category) ?? []), permission]);
  }
  return [...groups.entries()].map(([category, permissions]) => ({ category, permissions }));
});
const wordingLocaleOptions = computed(() =>
  languageRows.value.length
    ? languageRows.value
    : [
        { code: 'en', name: 'English', enabled: true, isDefault: true, sortOrder: 10 },
        { code: 'zh-CN', name: '简体中文', enabled: true, isDefault: false, sortOrder: 20 }
      ]
);
const wordingModules = computed(() => [...new Set(wordingRows.value.map((item) => item.module))].sort((a, b) => a.localeCompare(b)));
const wordingSurfaceTabs = computed<TabOption[]>(() => [
  { value: '', label: t('pages.admin.allSurfaces') },
  { value: 'frontend', label: t('pages.admin.surfaceFrontend') },
  { value: 'backend', label: t('pages.admin.surfaceBackend') },
  { value: 'email', label: t('pages.admin.surfaceEmail') }
]);
const activeWordingSurfaceTab = computed({
  get: () => wordingSurface.value,
  set: (value: string) => {
    wordingSurface.value = value === 'frontend' || value === 'backend' || value === 'email' ? value : '';
  }
});
const aiModerationApiFormatOptions = computed<Array<{ value: AiModerationApiFormat; label: string }>>(() => [
  { value: 'gemini-generate-content', label: t('pages.admin.aiModerationFormatGemini') },
  { value: 'openai-chat-completions', label: t('pages.admin.aiModerationFormatOpenAi') }
]);
const aiModerationAuthModeOptions = computed<Array<{ value: AiModerationAuthMode; label: string }>>(() => [
  { value: 'bearer-token', label: t('pages.admin.aiModerationAuthBearer') },
  { value: 'query-key', label: t('pages.admin.aiModerationAuthQueryKey') }
]);
const filteredWordingRows = computed(() =>
  wordingRows.value.filter((item) => {
    if (wordingModule.value && item.module !== wordingModule.value) return false;
    if (wordingSurface.value && item.surface !== wordingSurface.value) return false;
    if (wordingMissingOnly.value && !item.missing) return false;
    return true;
  })
);
const checklistKey = (item: DailyChecklistItem) => item.id;
const checklistLabel = (item: DailyChecklistItem) => item.title;
const languageKey = (item: Language) => item.code;
const languageLabel = (item: Language) => item.name;
const configKey = (item: EditableConfig) => item.id;
const configLabel = (item: EditableConfig) => item.name;
const pokemonKey = (item: Pokemon) => item.id;
const pokemonLabel = (item: Pokemon) => `#${item.displayId} ${item.name}`;
const itemKey = (item: Item) => item.id;
const itemLabel = (item: Item) => item.name;
const recipeKey = (item: Recipe) => item.id;
const recipeLabel = (item: Recipe) => item.name;
const habitatKey = (item: Habitat) => item.id;
const habitatLabel = (item: Habitat) => item.name;

function can(permissionKey: string) {
  return currentUser.value?.permissions.includes(permissionKey) === true;
}

function canAny(permissionKey: string | string[]) {
  return Array.isArray(permissionKey) ? permissionKey.some((key) => can(key)) : can(permissionKey);
}

function dragSortLabel(name: string) {
  return t('pages.admin.dragSort', { name });
}

function roleNames(roleIds: number[], fallbackRoles: AuthUser['roles'] = []) {
  const names = roleIds
    .map((roleId) => roleRows.value.find((role) => role.id === roleId)?.name)
    .filter((name): name is string => Boolean(name));
  const fallbackNames = fallbackRoles.map((role) => role.name);
  const visibleNames = names.length ? names : fallbackNames;
  return visibleNames.length ? visibleNames.join(', ') : t('pages.admin.noRoles');
}

function rolePermissionCount(role: RoleDetail) {
  return t('pages.admin.permissionCount', { count: role.permissionIds.length });
}

function toggleUserRole(roleId: number) {
  const roleIds = new Set(userRoleForm.value.roleIds);
  if (roleIds.has(roleId)) {
    roleIds.delete(roleId);
  } else {
    roleIds.add(roleId);
  }
  userRoleForm.value.roleIds = [...roleIds].sort((a, b) => a - b);
}

function toggleRolePermission(permissionId: number) {
  const permissionIds = new Set(rolePermissionForm.value.permissionIds);
  if (permissionIds.has(permissionId)) {
    permissionIds.delete(permissionId);
  } else {
    permissionIds.add(permissionId);
  }
  rolePermissionForm.value.permissionIds = [...permissionIds].sort((a, b) => a - b);
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

function resetWordingForm() {
  wordingForm.value = { key: '', locale: wordingLocale.value || defaultLocale, value: '', defaultValue: '', placeholders: [] };
}

function resetAiModerationForm(settings: AiModerationSettings | null = aiModerationSettings.value) {
  aiModerationForm.value = {
    enabled: settings?.enabled ?? true,
    apiFormat: settings?.apiFormat ?? 'gemini-generate-content',
    authMode: settings?.authMode ?? 'bearer-token',
    endpoint: settings?.endpoint ?? 'https://ai.example.com/v1beta',
    model: settings?.model ?? 'gemini-2.0-flash-lite',
    requestsPerMinute: settings?.requestsPerMinute ?? 10,
    apiKey: '',
    clearApiKey: false
  };
}

function resetUserRoleForm() {
  userRoleForm.value = { userId: 0, roleIds: [] };
}

function resetRoleForm() {
  roleForm.value = { id: 0, key: '', name: '', description: '', level: 100, enabled: true };
}

function resetRolePermissionForm() {
  rolePermissionForm.value = { roleId: 0, permissionIds: [] };
}

function resetPermissionForm() {
  permissionForm.value = { id: 0, key: '', name: '', description: '', category: 'General', enabled: true };
}

function selectWordingModule(module: string) {
  wordingModule.value = module;
}

function openNewConfig() {
  resetConfigForm();
  configModalOpen.value = true;
}

function closeConfigModal() {
  configModalOpen.value = false;
  resetConfigForm();
}

function editConfig(item: EditableConfig) {
  configForm.value = { id: item.id, name: item.baseName ?? item.name, translations: item.translations ?? {}, hasItemDrop: item.hasItemDrop === true };
  configModalOpen.value = true;
}

function openNewChecklistItem() {
  resetChecklistForm();
  checklistModalOpen.value = true;
}

function closeChecklistModal() {
  checklistModalOpen.value = false;
  resetChecklistForm();
}

function editChecklistItem(item: DailyChecklistItem) {
  checklistForm.value = { id: item.id, title: item.baseTitle ?? item.title, translations: item.translations ?? {} };
  checklistModalOpen.value = true;
}

function openNewLanguage() {
  resetLanguageForm();
  languageModalOpen.value = true;
}

function closeLanguageModal() {
  languageModalOpen.value = false;
  resetLanguageForm();
}

function closeWordingModal() {
  wordingModalOpen.value = false;
  resetWordingForm();
}

function openUserRoles(user: AdminUser) {
  userRoleForm.value = { userId: user.id, roleIds: [...user.roleIds] };
  userRoleModalOpen.value = true;
}

function closeUserRoleModal() {
  userRoleModalOpen.value = false;
  resetUserRoleForm();
}

function openNewRole() {
  resetRoleForm();
  roleModalOpen.value = true;
}

function editRole(role: RoleDetail) {
  roleForm.value = {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    level: role.level,
    enabled: role.enabled
  };
  roleModalOpen.value = true;
}

function closeRoleModal() {
  roleModalOpen.value = false;
  resetRoleForm();
}

function editRolePermissions(role: RoleDetail) {
  rolePermissionForm.value = { roleId: role.id, permissionIds: [...role.permissionIds] };
  rolePermissionsModalOpen.value = true;
}

function closeRolePermissionsModal() {
  rolePermissionsModalOpen.value = false;
  resetRolePermissionForm();
}

function openNewPermission() {
  resetPermissionForm();
  permissionModalOpen.value = true;
}

function editPermission(permission: Permission) {
  permissionForm.value = {
    id: permission.id,
    key: permission.key,
    name: permission.name,
    description: permission.description,
    category: permission.category,
    enabled: permission.enabled
  };
  permissionModalOpen.value = true;
}

function closePermissionModal() {
  permissionModalOpen.value = false;
  resetPermissionForm();
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
  languageModalOpen.value = true;
}

function editWording(item: SystemWording) {
  wordingForm.value = {
    key: item.key,
    locale: wordingLocale.value || defaultLocale,
    value: item.value,
    defaultValue: item.defaultValue,
    placeholders: item.placeholders
  };
  wordingModalOpen.value = true;
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
  if (configForm.value.name.trim() !== '') {
    return configForm.value.name;
  }

  return configForm.value.translations[currentConfigLocale.value]?.name ?? '';
}

function checklistTitleForSave() {
  if (checklistForm.value.title.trim() !== '') {
    return checklistForm.value.title;
  }

  return checklistForm.value.translations[currentConfigLocale.value]?.title ?? '';
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

    await loadConfig();
    closeConfigModal();
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
      title: checklistTitleForSave(),
      translations: checklistForm.value.translations
    };

    if (checklistForm.value.id) {
      await api.updateDailyChecklistItem(checklistForm.value.id, payload);
    } else {
      await api.createDailyChecklistItem(payload);
    }

    await loadChecklist();
    closeChecklistModal();
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
    closeLanguageModal();
    await loadSystemWordings(getCurrentLocale(), true);
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

async function loadUsers() {
  if (can('admin.roles.read')) {
    roleRows.value = await api.roles();
  }
  userRows.value = await api.adminUsers();
}

async function loadRoles() {
  const [roles, permissions] = await Promise.all([
    api.roles(),
    can('admin.permissions.read') ? api.permissions() : Promise.resolve(permissionRows.value)
  ]);
  roleRows.value = roles;
  permissionRows.value = permissions;
}

async function loadPermissions() {
  permissionRows.value = await api.permissions();
}

async function loadWordings() {
  await loadLanguages();
  if (!wordingLocaleOptions.value.some((language) => language.code === wordingLocale.value)) {
    wordingLocale.value = defaultLocale;
  }
  wordingRows.value = await api.systemWordings({ locale: wordingLocale.value });
}

async function loadAiModerationSettings() {
  aiModerationSettings.value = await api.aiModerationSettings();
  resetAiModerationForm(aiModerationSettings.value);
}

async function reloadWordings() {
  await run(loadWordings);
}

async function saveWording() {
  await run(async () => {
    wordingRows.value = await api.updateSystemWording(wordingForm.value.key, {
      locale: wordingForm.value.locale,
      value: wordingForm.value.value
    });
    await loadSystemWordings(wordingForm.value.locale, true);
    if (wordingForm.value.locale === getCurrentLocale()) {
      setCurrentLocale(getCurrentLocale());
    }
    closeWordingModal();
  });
}

async function saveAiModerationSettings() {
  await run(async () => {
    const payload: AiModerationSettingsPayload = {
      enabled: aiModerationForm.value.enabled,
      apiFormat: aiModerationForm.value.apiFormat,
      authMode: aiModerationForm.value.authMode,
      endpoint: aiModerationForm.value.endpoint,
      model: aiModerationForm.value.model,
      requestsPerMinute: aiModerationForm.value.requestsPerMinute,
      clearApiKey: aiModerationForm.value.clearApiKey
    };

    if (aiModerationForm.value.apiKey.trim()) {
      payload.apiKey = aiModerationForm.value.apiKey.trim();
    }

    aiModerationSettings.value = await api.updateAiModerationSettings(payload);
    resetAiModerationForm(aiModerationSettings.value);
  });
}

async function saveUserRoles() {
  await run(async () => {
    userRows.value = await api.updateAdminUserRoles(userRoleForm.value.userId, userRoleForm.value.roleIds);
    closeUserRoleModal();
    if (can('admin.roles.read')) {
      roleRows.value = await api.roles();
    }
  });
}

async function saveRole() {
  await run(async () => {
    const payload: RolePayload = {
      name: roleForm.value.name,
      description: roleForm.value.description,
      level: roleForm.value.level,
      enabled: roleForm.value.enabled
    };

    roleRows.value = roleForm.value.id
      ? await api.updateRole(roleForm.value.id, payload)
      : await api.createRole({ ...payload, key: roleForm.value.key });
    closeRoleModal();
  });
}

async function saveRolePermissions() {
  await run(async () => {
    roleRows.value = await api.updateRolePermissions(rolePermissionForm.value.roleId, rolePermissionForm.value.permissionIds);
    closeRolePermissionsModal();
  });
}

async function savePermission() {
  await run(async () => {
    const payload: PermissionPayload = {
      name: permissionForm.value.name,
      description: permissionForm.value.description,
      category: permissionForm.value.category,
      enabled: permissionForm.value.enabled
    };

    permissionRows.value = permissionForm.value.id
      ? await api.updatePermission(permissionForm.value.id, payload)
      : await api.createPermission({ ...payload, key: permissionForm.value.key });
    closePermissionModal();
    if (can('admin.roles.read')) {
      roleRows.value = await api.roles();
    }
  });
}

async function loadCurrentTab(showSkeleton = false) {
  if (showSkeleton) {
    contentLoading.value = true;
  }

  try {
    if (activeTab.value === 'config') await loadConfig();
    if (activeTab.value === 'users') await loadUsers();
    if (activeTab.value === 'roles') await loadRoles();
    if (activeTab.value === 'permissions') await loadPermissions();
    if (activeTab.value === 'languages') await loadLanguages();
    if (activeTab.value === 'wordings') await loadWordings();
    if (activeTab.value === 'aiModeration') await loadAiModerationSettings();
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
    message.value = t('errors.permissionDenied');
    return;
  }

  activeTab.value = tab;
  void run(() => loadCurrentTab(true));
}

function ensureActiveTabAllowed() {
  if (!tabs.value.some((tab) => tab.key === activeTab.value)) {
    activeTab.value = tabs.value[0]?.key ?? 'config';
  }
}

async function loadAdmin() {
  const response = await api.me();
  currentUser.value = response.user;

  if (!response.user.emailVerified) {
    message.value = t('errors.completeEmailVerification');
    return;
  }
  if (!canEdit.value || !tabs.value.length) {
    message.value = t('errors.permissionDenied');
    return;
  }

  ensureActiveTabAllowed();
  await loadCurrentTab(true);
}

async function removeLanguage(code: string) {
  await run(async () => {
    await api.deleteLanguage(code);
    if (editingLanguageCode.value === code) {
      closeLanguageModal();
    }
    await loadLanguages();
    setCurrentLocale(getCurrentLocale());
  });
}

async function removeConfig(id: number) {
  await run(async () => {
    await api.deleteConfig(activeConfigType.value, id);
    if (configForm.value.id === id) {
      closeConfigModal();
    }
    await loadConfig();
  });
}

async function removeChecklistItem(id: number) {
  await run(async () => {
    await api.deleteDailyChecklistItem(id);
    if (checklistForm.value.id === id) {
      closeChecklistModal();
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

async function removeRole(id: number) {
  await run(async () => {
    await api.deleteRole(id);
    if (roleForm.value.id === id) {
      closeRoleModal();
    }
    if (rolePermissionForm.value.roleId === id) {
      closeRolePermissionsModal();
    }
    await loadRoles();
  });
}

async function removePermission(id: number) {
  await run(async () => {
    await api.deletePermission(id);
    if (permissionForm.value.id === id) {
      closePermissionModal();
    }
    await loadPermissions();
    if (can('admin.roles.read')) {
      roleRows.value = await api.roles();
    }
  });
}

onMounted(() => {
  void run(loadAdmin);
});
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="t('pages.admin.title')" :subtitle="t('pages.admin.subtitle')">
      <template #kicker>{{ t('nav.admin') }}</template>
    </PageHeader>

    <StatusMessage v-if="message" variant="warning">{{ message }}</StatusMessage>

    <div v-if="canEdit || showAdminSkeleton" class="admin-layout" :class="{ 'admin-layout--loading': !canEdit }">
      <nav v-if="canEdit" class="admin-secondary-nav" :aria-label="t('pages.admin.modules')">
        <div v-for="group in adminNavigationGroups" :key="group.key" class="admin-secondary-nav__group">
          <span class="admin-secondary-nav__title">{{ group.label }}</span>
          <div class="admin-secondary-nav__items">
            <button
              v-for="tab in group.items"
              :key="tab.key"
              class="admin-secondary-nav__item"
              :class="{ active: activeTab === tab.key }"
              type="button"
              :aria-current="activeTab === tab.key ? 'page' : undefined"
              @click="setTab(tab.key)"
            >
              <Icon :icon="adminTabIcons[tab.key]" class="ui-icon admin-secondary-nav__icon" aria-hidden="true" />
              <span>{{ tab.label }}</span>
            </button>
          </div>
        </div>
      </nav>

      <div class="admin-content">
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

    <section v-else-if="canEdit && activeTab === 'users'" class="detail-section">
      <div class="detail-section__header">
        <h2>{{ t('pages.admin.users') }}</h2>
      </div>
      <ul v-if="userRows.length" class="row-list access-list">
        <li v-for="user in userRows" :key="user.id">
          <span class="access-row">
            <strong>{{ user.displayName }}</strong>
            <span class="meta-line">{{ user.email }}</span>
            <span class="system-wording-row__meta">
              <span class="config-flag">{{ user.emailVerified ? t('pages.profile.emailVerified') : t('pages.profile.emailUnverified') }}</span>
              <span class="config-flag">{{ roleNames(user.roleIds, user.roles) }}</span>
            </span>
          </span>
          <span class="row-actions">
            <button v-if="can('admin.users.update') && can('admin.roles.read')" type="button" :disabled="busy" @click="openUserRoles(user)">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('pages.admin.userRoles') }}
            </button>
          </span>
        </li>
      </ul>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'roles'" class="detail-section">
      <div class="detail-section__header">
        <h2>{{ t('pages.admin.roles') }}</h2>
        <button v-if="can('admin.roles.create')" type="button" class="ui-button ui-button--primary ui-button--small" :disabled="busy" @click="openNewRole">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.new') }}
        </button>
      </div>
      <ul v-if="roleRows.length" class="row-list access-list">
        <li v-for="role in roleRows" :key="role.id">
          <span class="access-row">
            <strong>{{ role.name }}</strong>
            <span class="meta-line">{{ role.description }}</span>
            <span class="system-wording-row__meta">
              <span class="config-flag">{{ role.key }}</span>
              <span class="config-flag">{{ t('pages.admin.roleLevel', { level: role.level }) }}</span>
              <span class="config-flag">{{ role.enabled ? t('pages.admin.enabled') : t('pages.admin.disabled') }}</span>
              <span v-if="role.systemRole" class="config-flag">{{ t('pages.admin.systemRole') }}</span>
              <span class="config-flag">{{ rolePermissionCount(role) }}</span>
            </span>
          </span>
          <span class="row-actions">
            <button v-if="can('admin.roles.update')" type="button" :disabled="busy" @click="editRole(role)">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('common.edit') }}
            </button>
            <button v-if="can('admin.roles.update') && can('admin.permissions.read')" type="button" :disabled="busy || role.key === 'owner'" @click="editRolePermissions(role)">
              <Icon :icon="iconKey" class="ui-icon" aria-hidden="true" />
              {{ t('pages.admin.rolePermissions') }}
            </button>
            <button v-if="can('admin.roles.delete')" type="button" :disabled="busy || role.key === 'owner'" @click="removeRole(role.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </span>
        </li>
      </ul>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'permissions'" class="detail-section">
      <div class="detail-section__header">
        <h2>{{ t('pages.admin.permissions') }}</h2>
        <button v-if="can('admin.permissions.create')" type="button" class="ui-button ui-button--primary ui-button--small" :disabled="busy" @click="openNewPermission">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.new') }}
        </button>
      </div>
      <ul v-if="permissionRows.length" class="row-list access-list">
        <li v-for="permission in permissionRows" :key="permission.id">
          <span class="access-row">
            <strong>{{ permission.name }}</strong>
            <span class="meta-line">{{ permission.description }}</span>
            <span class="system-wording-row__meta">
              <span class="config-flag">{{ permission.key }}</span>
              <span class="config-flag">{{ permission.category }}</span>
              <span class="config-flag">{{ permission.enabled ? t('pages.admin.enabled') : t('pages.admin.disabled') }}</span>
              <span v-if="permission.systemPermission" class="config-flag">{{ t('pages.admin.systemPermission') }}</span>
            </span>
          </span>
          <span class="row-actions">
            <button v-if="can('admin.permissions.update')" type="button" :disabled="busy" @click="editPermission(permission)">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('common.edit') }}
            </button>
            <button v-if="can('admin.permissions.delete')" type="button" :disabled="busy" @click="removePermission(permission.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </span>
        </li>
      </ul>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'checklist'" class="detail-section">
      <div class="detail-section__header">
        <h2>{{ t('pages.admin.checklist') }}</h2>
        <button v-if="can('checklist.create')" type="button" class="ui-button ui-button--primary ui-button--small" :disabled="busy" @click="openNewChecklistItem">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.new') }}
        </button>
      </div>
      <h3 class="section-subtitle">{{ t('pages.checklist.sectionTitle') }}</h3>
      <ReorderableList
        v-if="checklistRows.length"
        :items="checklistRows"
        :item-key="checklistKey"
        :item-label="checklistLabel"
        list-key-prefix="checklist"
        :disabled="busy || !can('checklist.order')"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewChecklistOrder"
        @cancel="previewChecklistOrder"
        @reorder="persistChecklistOrder"
      >
        <template #default="{ item }">
          <span class="reorderable-row-title">{{ item.title }}</span>
          <span class="row-actions">
            <button v-if="can('checklist.update')" type="button" :disabled="busy" @click="editChecklistItem(item)">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('common.edit') }}
            </button>
            <button v-if="can('checklist.delete')" type="button" :disabled="busy" @click="removeChecklistItem(item.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'config'" class="detail-section">
      <div class="detail-section__header">
        <h2>{{ t('pages.admin.config') }}</h2>
        <button v-if="can('admin.config.create')" type="button" class="ui-button ui-button--primary ui-button--small" :disabled="busy" @click="openNewConfig">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.new') }}
        </button>
      </div>
      <Tabs id="admin-config-type" v-model="activeConfigTab" :tabs="configTabs" :label="t('pages.admin.configType')" />
      <h3 class="section-subtitle">{{ selectedConfig.label }}</h3>
      <ReorderableList
        v-if="configRows.length"
        :items="configRows"
        :item-key="configKey"
        :item-label="configLabel"
        :list-key-prefix="`config-${activeConfigType}`"
        :disabled="busy || !can('admin.config.order')"
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
            <button v-if="can('admin.config.update')" type="button" :disabled="busy" @click="editConfig(item)">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('common.edit') }}
            </button>
            <button v-if="can('admin.config.delete')" type="button" :disabled="busy" @click="removeConfig(item.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'languages'" class="detail-section">
      <div class="detail-section__header">
        <h2>{{ t('pages.admin.languages') }}</h2>
        <button v-if="can('admin.languages.create')" type="button" class="ui-button ui-button--primary ui-button--small" :disabled="busy" @click="openNewLanguage">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('common.new') }}
        </button>
      </div>
      <ReorderableList
        v-if="languageRows.length"
        :items="languageRows"
        :item-key="languageKey"
        :item-label="languageLabel"
        list-key-prefix="languages"
        :disabled="busy || !can('admin.languages.order')"
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
            <button v-if="can('admin.languages.update')" type="button" @click="editLanguage(item)">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('common.edit') }}
            </button>
            <button v-if="can('admin.languages.delete')" type="button" :disabled="item.isDefault" @click="removeLanguage(item.code)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else-if="canEdit && activeTab === 'wordings'" class="detail-section">
      <div class="detail-section__header system-wording-header">
        <h2>{{ t('pages.admin.wordings') }}</h2>
        <div class="field system-wording-header__locale">
          <label for="wording-locale">{{ t('pages.admin.wordingLocale') }}</label>
          <select id="wording-locale" v-model="wordingLocale" :disabled="busy" @change="reloadWordings">
            <option v-for="language in wordingLocaleOptions" :key="language.code" :value="language.code">
              {{ language.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="system-wording-layout">
        <nav class="system-wording-sidebar" :aria-label="t('pages.admin.wordingModule')">
          <span class="system-wording-sidebar__title">{{ t('pages.admin.wordingModule') }}</span>
          <button
            type="button"
            class="system-wording-sidebar__button"
            :class="{ active: !wordingModule }"
            :aria-current="!wordingModule ? 'true' : undefined"
            :disabled="busy"
            @click="selectWordingModule('')"
          >
            {{ t('pages.admin.allModules') }}
          </button>
          <button
            v-for="module in wordingModules"
            :key="module"
            type="button"
            class="system-wording-sidebar__button"
            :class="{ active: wordingModule === module }"
            :aria-current="wordingModule === module ? 'true' : undefined"
            :disabled="busy"
            @click="selectWordingModule(module)"
          >
            {{ module }}
          </button>
        </nav>

        <div class="system-wording-content">
          <div class="system-wording-controls">
            <Tabs id="admin-wording-surface" v-model="activeWordingSurfaceTab" :tabs="wordingSurfaceTabs" :label="t('pages.admin.wordingSurface')" />
            <div class="check-row system-wording-toolbar__check">
              <label>
                <input v-model="wordingMissingOnly" type="checkbox" :disabled="busy" />
                {{ t('pages.admin.wordingMissingOnly') }}
              </label>
            </div>
          </div>
          <ul v-if="filteredWordingRows.length" class="row-list system-wording-list">
            <li v-for="item in filteredWordingRows" :key="item.key">
              <span class="system-wording-row">
                <strong>{{ item.key }}</strong>
                <span class="system-wording-row__meta">
                  <span class="config-flag">{{ item.module }}</span>
                  <span class="config-flag">{{ t(`pages.admin.surface${item.surface.charAt(0).toUpperCase()}${item.surface.slice(1)}`) }}</span>
                  <span v-if="item.missing" class="config-flag">{{ t('pages.admin.missingTranslation') }}</span>
                </span>
                <span class="system-wording-row__value">{{ item.value || item.defaultValue }}</span>
              </span>
              <span class="row-actions">
                <button v-if="can('admin.wordings.update')" type="button" :disabled="busy" @click="editWording(item)">
                  <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
                  {{ t('common.edit') }}
                </button>
              </span>
            </li>
          </ul>
          <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
        </div>
      </div>
    </section>

    <section v-else-if="canEdit && activeTab === 'aiModeration'" class="detail-section">
      <div class="detail-section__header">
        <div>
          <h2>{{ t('pages.admin.aiModeration') }}</h2>
          <p class="meta-line">
            {{
              aiModerationSettings?.apiKeyConfigured
                ? t('pages.admin.aiModerationApiKeyConfigured')
                : t('pages.admin.aiModerationApiKeyMissing')
            }}
          </p>
        </div>
      </div>

      <form class="modal-edit-form ai-moderation-form" @submit.prevent="saveAiModerationSettings">
        <div class="check-row">
          <label>
            <input v-model="aiModerationForm.enabled" type="checkbox" :disabled="busy || !can('admin.ai-moderation.update')" />
            {{ t('pages.admin.aiModerationEnabled') }}
          </label>
        </div>
        <div class="field">
          <label for="ai-moderation-format">{{ t('pages.admin.aiModerationFormat') }}</label>
          <select
            id="ai-moderation-format"
            v-model="aiModerationForm.apiFormat"
            :disabled="busy || !can('admin.ai-moderation.update')"
            required
          >
            <option v-for="option in aiModerationApiFormatOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="ai-moderation-auth-mode">{{ t('pages.admin.aiModerationAuthMode') }}</label>
          <select
            id="ai-moderation-auth-mode"
            v-model="aiModerationForm.authMode"
            :disabled="busy || !can('admin.ai-moderation.update')"
            required
          >
            <option v-for="option in aiModerationAuthModeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="ai-moderation-endpoint">{{ t('pages.admin.aiModerationEndpoint') }}</label>
          <input
            id="ai-moderation-endpoint"
            v-model="aiModerationForm.endpoint"
            :disabled="busy || !can('admin.ai-moderation.update')"
            required
          />
        </div>
        <div class="field">
          <label for="ai-moderation-model">{{ t('pages.admin.aiModerationModel') }}</label>
          <input
            id="ai-moderation-model"
            v-model="aiModerationForm.model"
            :disabled="busy || !can('admin.ai-moderation.update')"
            required
          />
        </div>
        <div class="field">
          <label for="ai-moderation-rpm">{{ t('pages.admin.aiModerationRpm') }}</label>
          <input
            id="ai-moderation-rpm"
            v-model.number="aiModerationForm.requestsPerMinute"
            type="number"
            min="1"
            max="60"
            :disabled="busy || !can('admin.ai-moderation.update')"
            required
          />
        </div>
        <div class="field">
          <label for="ai-moderation-api-key">{{ t('pages.admin.aiModerationApiKey') }}</label>
          <input
            id="ai-moderation-api-key"
            v-model="aiModerationForm.apiKey"
            type="password"
            autocomplete="new-password"
            :disabled="busy || !can('admin.ai-moderation.update')"
          />
        </div>
        <div class="check-row">
          <label>
            <input
              v-model="aiModerationForm.clearApiKey"
              type="checkbox"
              :disabled="busy || !can('admin.ai-moderation.update') || !aiModerationSettings?.apiKeyConfigured"
            />
            {{ t('pages.admin.aiModerationClearApiKey') }}
          </label>
        </div>
        <button v-if="can('admin.ai-moderation.update')" class="ui-button ui-button--primary" type="submit" :disabled="busy">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
      </form>
    </section>

    <section v-else-if="canEdit && activeTab === 'pokemon'" class="detail-section">
      <h2>{{ t('pages.admin.pokemonList') }}</h2>
      <ReorderableList
        v-if="pokemonRows.length"
        :items="pokemonRows"
        :item-key="pokemonKey"
        :item-label="pokemonLabel"
        list-key-prefix="pokemon"
        :disabled="busy || !can('pokemon.order')"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewPokemonOrder"
        @cancel="previewPokemonOrder"
        @reorder="persistPokemonOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/pokemon/${item.id}`">#{{ item.displayId }} {{ item.name }}</RouterLink>
          <span class="row-actions">
            <button v-if="can('pokemon.delete')" type="button" :disabled="busy" @click="removePokemon(item.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
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
        :disabled="busy || !can('items.order')"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewItemOrder"
        @cancel="previewItemOrder"
        @reorder="persistItemOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/items/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button v-if="can('items.delete')" type="button" :disabled="busy" @click="removeItem(item.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
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
        :disabled="busy || !can('recipes.order')"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewRecipeOrder"
        @cancel="previewRecipeOrder"
        @reorder="persistRecipeOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/recipes/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button v-if="can('recipes.delete')" type="button" :disabled="busy" @click="removeRecipe(item.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
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
        :disabled="busy || !can('habitats.order')"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewHabitatOrder"
        @cancel="previewHabitatOrder"
        @reorder="persistHabitatOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/habitats/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button v-if="can('habitats.delete')" type="button" :disabled="busy" @click="removeHabitat(item.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>
    </section>
      </div>
    </div>

    <Modal v-if="userRoleModalOpen" :title="userRoleModalTitle" :close-label="t('common.close')" size="wide" @close="closeUserRoleModal">
      <form id="admin-user-roles-form" class="modal-edit-form" @submit.prevent="saveUserRoles">
        <div v-if="editingUser" class="access-modal-heading">
          <strong>{{ editingUser.displayName }}</strong>
          <span class="meta-line">{{ editingUser.email }}</span>
        </div>
        <div class="permission-grid" role="group" :aria-label="t('pages.admin.roles')">
          <label v-for="role in roleRows" :key="role.id" class="permission-toggle">
            <input
              type="checkbox"
              :checked="userRoleForm.roleIds.includes(role.id)"
              :disabled="busy || !role.enabled"
              @change="toggleUserRole(role.id)"
            />
            <span>
              <strong>{{ role.name }}</strong>
              <small>{{ role.description }}</small>
            </span>
          </label>
        </div>
      </form>

      <template #footer>
        <button type="submit" form="admin-user-roles-form" class="link-button" :disabled="busy">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeUserRoleModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="roleModalOpen" :title="roleModalTitle" :close-label="t('common.close')" @close="closeRoleModal">
      <form id="admin-role-form" class="modal-edit-form" @submit.prevent="saveRole">
        <div class="field">
          <label for="role-key">{{ t('pages.admin.roleKey') }}</label>
          <input id="role-key" v-model="roleForm.key" :disabled="Boolean(roleForm.id)" required />
        </div>
        <div class="field">
          <label for="role-name">{{ t('pages.admin.roleName') }}</label>
          <input id="role-name" v-model="roleForm.name" required />
        </div>
        <div class="field">
          <label for="role-description">{{ t('pages.admin.description') }}</label>
          <textarea id="role-description" v-model="roleForm.description"></textarea>
        </div>
        <div class="field">
          <label for="role-level">{{ t('pages.admin.level') }}</label>
          <input id="role-level" v-model.number="roleForm.level" type="number" min="0" step="1" required />
        </div>
        <div class="check-row">
          <label><input v-model="roleForm.enabled" type="checkbox" /> {{ t('pages.admin.enabled') }}</label>
        </div>
      </form>

      <template #footer>
        <button type="submit" form="admin-role-form" class="link-button" :disabled="busy">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeRoleModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="rolePermissionsModalOpen" :title="rolePermissionsModalTitle" :close-label="t('common.close')" size="wide" @close="closeRolePermissionsModal">
      <form id="admin-role-permissions-form" class="modal-edit-form" @submit.prevent="saveRolePermissions">
        <div v-if="editingRole" class="access-modal-heading">
          <strong>{{ editingRole.name }}</strong>
          <span class="meta-line">{{ editingRole.description }}</span>
        </div>
        <div class="permission-groups">
          <section v-for="group in permissionGroups" :key="group.category" class="permission-group">
            <h3>{{ group.category }}</h3>
            <div class="permission-grid" role="group" :aria-label="group.category">
              <label v-for="permission in group.permissions" :key="permission.id" class="permission-toggle">
                <input
                  type="checkbox"
                  :checked="rolePermissionForm.permissionIds.includes(permission.id)"
                  :disabled="busy || !permission.enabled"
                  @change="toggleRolePermission(permission.id)"
                />
                <span>
                  <strong>{{ permission.name }}</strong>
                  <small>{{ permission.key }}</small>
                </span>
              </label>
            </div>
          </section>
        </div>
      </form>

      <template #footer>
        <button type="submit" form="admin-role-permissions-form" class="link-button" :disabled="busy">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeRolePermissionsModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="permissionModalOpen" :title="permissionModalTitle" :close-label="t('common.close')" @close="closePermissionModal">
      <form id="admin-permission-form" class="modal-edit-form" @submit.prevent="savePermission">
        <div class="field">
          <label for="permission-key">{{ t('pages.admin.permissionKey') }}</label>
          <input id="permission-key" v-model="permissionForm.key" :disabled="Boolean(permissionForm.id)" required />
        </div>
        <div class="field">
          <label for="permission-name">{{ t('pages.admin.permissionName') }}</label>
          <input id="permission-name" v-model="permissionForm.name" required />
        </div>
        <div class="field">
          <label for="permission-category">{{ t('pages.admin.category') }}</label>
          <input id="permission-category" v-model="permissionForm.category" required />
        </div>
        <div class="field">
          <label for="permission-description">{{ t('pages.admin.description') }}</label>
          <textarea id="permission-description" v-model="permissionForm.description"></textarea>
        </div>
        <div class="check-row">
          <label><input v-model="permissionForm.enabled" type="checkbox" /> {{ t('pages.admin.enabled') }}</label>
        </div>
      </form>

      <template #footer>
        <button type="submit" form="admin-permission-form" class="link-button" :disabled="busy">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closePermissionModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="checklistModalOpen" :title="checklistModalTitle" :close-label="t('common.close')" size="wide" @close="closeChecklistModal">
      <form id="admin-checklist-form" class="modal-edit-form" @submit.prevent="saveChecklistItem">
        <TranslationFields
          id-prefix="checklist-title"
          v-model:base-value="checklistForm.title"
          v-model:translations="checklistForm.translations"
          field="title"
          :label="t('pages.checklist.task')"
          :languages="languageRows"
          required
        />
      </form>

      <template #footer>
        <button type="submit" form="admin-checklist-form" class="link-button" :disabled="busy">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeChecklistModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="configModalOpen" :title="configModalTitle" :close-label="t('common.close')" @close="closeConfigModal">
      <form id="admin-config-form" class="modal-edit-form" @submit.prevent="saveConfig">
        <div class="field">
          <label for="config-name">{{ t('common.name') }}</label>
          <input id="config-name" v-model="configNameInput" :placeholder="configNamePlaceholder" :required="configNameRequired" />
        </div>
        <div v-if="selectedConfig.supportsItemDrop" class="check-row">
          <label>
            <input v-model="configForm.hasItemDrop" type="checkbox" />
            {{ t('pages.admin.hasItemDrop') }}
          </label>
        </div>
      </form>

      <template #footer>
        <button type="submit" form="admin-config-form" class="link-button" :disabled="busy">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeConfigModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="languageModalOpen" :title="languageModalTitle" :close-label="t('common.close')" @close="closeLanguageModal">
      <form id="admin-language-form" class="modal-edit-form" @submit.prevent="saveLanguage">
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
      </form>

      <template #footer>
        <button type="submit" form="admin-language-form" class="link-button" :disabled="busy">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeLanguageModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="wordingModalOpen" :title="wordingModalTitle" :close-label="t('common.close')" size="wide" @close="closeWordingModal">
      <form id="admin-wording-form" class="modal-edit-form" @submit.prevent="saveWording">
        <div class="field">
          <label for="wording-key">{{ t('pages.admin.wordingKey') }}</label>
          <input id="wording-key" :value="wordingForm.key" disabled />
        </div>
        <div class="field">
          <label for="wording-default-value">{{ t('pages.admin.defaultValue') }}</label>
          <textarea id="wording-default-value" :value="wordingForm.defaultValue" disabled></textarea>
        </div>
        <div v-if="wordingForm.placeholders.length" class="field">
          <span class="field-label">{{ t('pages.admin.placeholders') }}</span>
          <span class="chips">
            <span v-for="placeholder in wordingForm.placeholders" :key="placeholder" class="chip">{{ placeholder }}</span>
          </span>
        </div>
        <div class="field">
          <label for="wording-value">{{ t('pages.admin.wordingValue') }}</label>
          <textarea id="wording-value" v-model="wordingForm.value" :required="wordingForm.locale === defaultLocale"></textarea>
        </div>
      </form>

      <template #footer>
        <button type="submit" form="admin-wording-form" class="link-button" :disabled="busy">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeWordingModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>
  </section>
</template>
