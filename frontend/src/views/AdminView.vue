<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '../components/Modal.vue';
import PageHeader from '../components/PageHeader.vue';
import ReorderableList from '../components/ReorderableList.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import SwitchGroup, { type SwitchGroupOption } from '../components/SwitchGroup.vue';
import TagsSelect, { type TagsSelectOption } from '../components/TagsSelect.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TranslationFields from '../components/TranslationFields.vue';
import {
  iconAdd,
  iconAdmin,
  iconArtifact,
  iconCancel,
  iconChecklist,
  iconDelete,
  iconDish,
  iconEdit,
  iconHabitat,
  iconItem,
  iconKey,
  iconPokemon,
  iconProfile,
  iconRecipe,
  iconSave,
  iconTranslate,
  iconUpload,
  type AppIcon
} from '../icons';
import { defaultLocale, getCurrentLocale, loadSystemWordings, setCurrentLocale } from '../i18n';
import {
  api,
  type AncientArtifact,
  type AiModerationApiFormat,
  type AiModerationAuthMode,
  type AiModerationSettings,
  type AiModerationSettingsPayload,
  type AuthUser,
  type AdminUser,
  type ConfigType,
  type DataToolScope,
  type DataToolsBundle,
  type DataToolsSummary,
  type DailyChecklistItem,
  type Dish,
  type DishCategory,
  type GameVersion,
  type Habitat,
  type Item,
  type Language,
  type LifeCategory,
  type NamedEntity,
  type Permission,
  type PermissionPayload,
  type Pokemon,
  type RateLimitPolicyKey,
  type RateLimitPolicySettings,
  type RateLimitSettings,
  type RateLimitSettingsPayload,
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
  | 'rateLimits'
  | 'aiModeration'
  | 'dataTools'
  | 'config'
  | 'languages'
  | 'wordings'
  | 'checklist'
  | 'pokemon'
  | 'items'
  | 'ancientArtifacts'
  | 'recipes'
  | 'dish'
  | 'habitats';
type AdminGroup = 'content' | 'configuration' | 'localization' | 'access';
type AdminNavItem = { key: AdminTab; label: string; permission: string | string[] };
type AdminNavGroup = { key: AdminGroup; label: string; items: AdminNavItem[] };
type EditableConfig = (NamedEntity | Skill | LifeCategory | GameVersion) & {
  hasItemDrop?: boolean;
  hasTrading?: boolean;
  isDefault?: boolean;
  isRateable?: boolean;
  changeLog?: string;
};
type RateLimitPolicyForm = {
  maxRequests: number;
  timeWindowMinutes: number;
  cooldownSeconds: number;
};

const rateLimitPolicyKeys: RateLimitPolicyKey[] = [
  'accountWrite',
  'adminWrite',
  'wikiWrite',
  'communityWrite',
  'communityReaction',
  'upload',
  'fetch'
];
const dataToolScopeKeys: DataToolScope[] = ['pokemon', 'habitats', 'items', 'artifacts', 'recipes', 'checklist'];
const defaultRateLimitPolicies: Record<RateLimitPolicyKey, RateLimitPolicySettings> = {
  accountWrite: { maxRequests: 20, timeWindowSeconds: 60 * 60, cooldownSeconds: 5 },
  adminWrite: { maxRequests: 120, timeWindowSeconds: 60 * 60, cooldownSeconds: 2 },
  communityReaction: { maxRequests: 120, timeWindowSeconds: 60 * 60, cooldownSeconds: 1 },
  communityWrite: { maxRequests: 60, timeWindowSeconds: 60 * 60, cooldownSeconds: 5 },
  fetch: { maxRequests: 60, timeWindowSeconds: 10 * 60, cooldownSeconds: 1 },
  upload: { maxRequests: 20, timeWindowSeconds: 60 * 60, cooldownSeconds: 30 },
  wikiWrite: { maxRequests: 120, timeWindowSeconds: 60 * 60, cooldownSeconds: 2 }
};

const adminTabIcons: Record<AdminTab, AppIcon> = {
  users: iconProfile,
  roles: iconKey,
  permissions: iconKey,
  rateLimits: iconAdmin,
  aiModeration: iconAdmin,
  dataTools: iconAdmin,
  config: iconAdmin,
  languages: iconTranslate,
  wordings: iconTranslate,
  checklist: iconChecklist,
  pokemon: iconPokemon,
  items: iconItem,
  ancientArtifacts: iconArtifact,
  recipes: iconRecipe,
  dish: iconDish,
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
        { key: 'pokemon', label: t('pages.admin.pokemonList'), permission: 'pokemon.delete' },
        { key: 'items', label: t('pages.admin.itemList'), permission: ['items.order', 'items.delete'] },
        {
          key: 'ancientArtifacts',
          label: t('pages.admin.ancientArtifactList'),
          permission: ['ancient-artifacts.order', 'ancient-artifacts.delete']
        },
        { key: 'recipes', label: t('pages.admin.recipeList'), permission: ['recipes.order', 'recipes.delete'] },
        { key: 'dish', label: t('pages.admin.dishList'), permission: ['dish.create', 'dish.update', 'dish.delete', 'dish.order'] },
        { key: 'habitats', label: t('pages.admin.habitatList'), permission: ['habitats.order', 'habitats.delete'] },
        { key: 'dataTools', label: t('pages.admin.dataTools'), permission: ['admin.data.export', 'admin.data.import'] }
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
        { key: 'permissions', label: t('pages.admin.permissions'), permission: 'admin.permissions.read' },
        { key: 'rateLimits', label: t('pages.admin.rateLimits'), permission: 'admin.rate-limits.read' }
      ]
    }
  ];

  return groups
    .map((group) => ({ ...group, items: group.items.filter((tab) => canAny(tab.permission)) }))
    .filter((group) => group.items.length);
});
const tabs = computed<AdminNavItem[]>(() => adminNavigationGroups.value.flatMap((group) => group.items));

const configTypes = computed<
  Array<{
    key: ConfigType;
    label: string;
    supportsItemDrop?: boolean;
    supportsTrading?: boolean;
    supportsDefault?: boolean;
    supportsRateable?: boolean;
    supportsChangeLog?: boolean;
  }>
>(() => [
  { key: 'pokemon-types', label: t('config.pokemonTypes') },
  { key: 'skills', label: t('config.skills'), supportsItemDrop: true, supportsTrading: true },
  { key: 'environments', label: t('config.environments') },
  { key: 'favorite-things', label: t('config.favoriteThings') },
  { key: 'acquisition-methods', label: t('config.acquisitionMethods') },
  { key: 'maps', label: t('config.maps') },
  { key: 'life-tags', label: t('config.lifeCategories'), supportsDefault: true, supportsRateable: true },
  { key: 'game-versions', label: t('config.gameVersions'), supportsChangeLog: true },
  { key: 'dish-flavors', label: t('config.dishFlavors') }
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
const ancientArtifactRows = ref<AncientArtifact[]>([]);
const recipeRows = ref<Recipe[]>([]);
const dishCategoryRows = ref<DishCategory[]>([]);
const dishItemRows = ref<Item[]>([]);
const dishSkillRows = ref<Skill[]>([]);
const dishFlavorRows = ref<NamedEntity[]>([]);
const habitatRows = ref<Habitat[]>([]);
const wordingRows = ref<SystemWording[]>([]);
const aiModerationSettings = ref<AiModerationSettings | null>(null);
const rateLimitSettings = ref<RateLimitSettings | null>(null);
const dataToolsSummary = ref<DataToolsSummary | null>(null);
const currentUser = ref<AuthUser | null>(null);
const busy = ref(false);
const contentLoading = ref(false);
const message = ref('');
const configForm = ref({
  id: 0,
  name: '',
  translations: {} as TranslationMap,
  hasItemDrop: false,
  hasTrading: false,
  isDefault: false,
  isRateable: false,
  changeLog: ''
});
const checklistForm = ref({ id: 0, title: '', translations: {} as TranslationMap });
const dishCategoryForm = ref({
  id: 0,
  name: '',
  effect: '',
  translations: {} as TranslationMap,
  cookwareItemId: '',
  mainMaterialItemId: '',
  totalMaterialQuantity: 2
});
const dishForm = ref({
  id: 0,
  categoryId: '',
  itemId: '',
  flavorId: '',
  translations: {} as TranslationMap,
  secondaryMaterialItemIds: ['', ''],
  pokemonSkillId: '',
  mosslaxEffect: ''
});
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
const rateLimitForm = ref<Record<RateLimitPolicyKey, RateLimitPolicyForm>>(
  Object.fromEntries(
    rateLimitPolicyKeys.map((policy) => [
      policy,
      {
        maxRequests: defaultRateLimitPolicies[policy].maxRequests,
        timeWindowMinutes: defaultRateLimitPolicies[policy].timeWindowSeconds / 60,
        cooldownSeconds: defaultRateLimitPolicies[policy].cooldownSeconds
      }
    ])
  ) as Record<RateLimitPolicyKey, RateLimitPolicyForm>
);
const userRoleForm = ref({ userId: 0, roleIds: [] as number[] });
const roleForm = ref({ id: 0, key: '', name: '', description: '', level: 100, enabled: true });
const rolePermissionForm = ref({ roleId: 0, permissionIds: [] as number[] });
const permissionForm = ref({ id: 0, key: '', name: '', description: '', category: 'General', enabled: true });
const editingLanguageCode = ref('');
const configModalOpen = ref(false);
const checklistModalOpen = ref(false);
const dishCategoryModalOpen = ref(false);
const dishModalOpen = ref(false);
const languageModalOpen = ref(false);
const wordingModalOpen = ref(false);
const userRoleModalOpen = ref(false);
const roleModalOpen = ref(false);
const rolePermissionsModalOpen = ref(false);
const permissionModalOpen = ref(false);
const dataToolImportModalOpen = ref(false);
const dataToolWipeModalOpen = ref(false);
const wordingLocale = ref(getCurrentLocale());
const wordingModule = ref('');
const wordingSurface = ref<SystemWordingSurface | ''>('');
const wordingMissingOnly = ref(false);
const selectedExportScopes = ref<DataToolScope[]>(['pokemon']);
const selectedWipeScopes = ref<DataToolScope[]>([]);
const pendingImportBundle = ref<DataToolsBundle | null>(null);
const dataToolConfirmText = ref('');

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
const dishCategoryModalTitle = computed(() =>
  dishCategoryForm.value.id ? t('pages.dish.editCategory') : t('pages.dish.newCategory')
);
const dishModalTitle = computed(() => (dishForm.value.id ? t('pages.dish.editDish') : t('pages.dish.newDish')));
const dishRows = computed(() => dishCategoryRows.value.flatMap((category) => category.dishes));
const selectedDishFormCategory = computed(() => dishCategoryRows.value.find((category) => String(category.id) === dishForm.value.categoryId) ?? null);
const dishAllowsSecondSecondaryMaterial = computed(() => (selectedDishFormCategory.value?.totalMaterialQuantity ?? 0) > 2);
const dishItemSelectOptions = computed<TagsSelectOption[]>(() =>
  dishItemRows.value.map((item) => ({ id: item.id, name: item.name, thumbnailUrl: item.image?.url }))
);
const optionalDishItemSelectOptions = computed<TagsSelectOption[]>(() => [{ id: '', name: t('common.none') }, ...dishItemSelectOptions.value]);
const dishCategorySelectOptions = computed<TagsSelectOption[]>(() =>
  dishCategoryRows.value.map((category) => ({ id: category.id, name: category.name }))
);
const dishFlavorSelectOptions = computed<TagsSelectOption[]>(() => dishFlavorRows.value.map((flavor) => ({ id: flavor.id, name: flavor.name })));
const optionalDishSkillSelectOptions = computed<TagsSelectOption[]>(() => [
  { id: '', name: t('common.none') },
  ...dishSkillRows.value.map((skill) => ({ id: skill.id, name: skill.name }))
]);
const dishCategoryFormValid = computed(
  () =>
    dishCategoryForm.value.name.trim() !== '' &&
    dishCategoryForm.value.effect.trim() !== '' &&
    dishCategoryForm.value.cookwareItemId !== '' &&
    dishCategoryForm.value.mainMaterialItemId !== '' &&
    Number(dishCategoryForm.value.totalMaterialQuantity) >= 2
);
const dishFormValid = computed(
  () =>
    dishForm.value.categoryId !== '' &&
    dishForm.value.itemId !== '' &&
    dishForm.value.flavorId !== '' &&
    dishForm.value.mosslaxEffect.trim() !== ''
);
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
const userRoleSwitchOptions = computed<SwitchGroupOption[]>(() =>
  roleRows.value.map((role) => ({
    value: role.id,
    label: role.name,
    description: role.description,
    disabled: busy.value || !role.enabled
  }))
);
const userRoleSwitchValue = computed<Array<string | number>>({
  get: () => userRoleForm.value.roleIds,
  set: (values) => {
    userRoleForm.value.roleIds = values.map((value) => Number(value)).sort((a, b) => a - b);
  }
});
const rolePermissionSwitchValue = computed<Array<string | number>>({
  get: () => rolePermissionForm.value.permissionIds,
  set: (values) => {
    rolePermissionForm.value.permissionIds = values.map((value) => Number(value)).sort((a, b) => a - b);
  }
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
const rateLimitPolicyOptions = computed<Array<{ value: RateLimitPolicyKey; label: string }>>(() => [
  { value: 'accountWrite', label: t('pages.admin.rateLimitAccountWrite') },
  { value: 'adminWrite', label: t('pages.admin.rateLimitAdminWrite') },
  { value: 'wikiWrite', label: t('pages.admin.rateLimitWikiWrite') },
  { value: 'communityWrite', label: t('pages.admin.rateLimitCommunityWrite') },
  { value: 'communityReaction', label: t('pages.admin.rateLimitCommunityReaction') },
  { value: 'upload', label: t('pages.admin.rateLimitUpload') },
  { value: 'fetch', label: t('pages.admin.rateLimitFetch') }
]);
const dataToolScopeOptions = computed<Array<{ value: DataToolScope; label: string; count: number }>>(() =>
  dataToolScopeKeys.map((scope) => ({
    value: scope,
    label: t(`pages.admin.dataToolScope${scope.charAt(0).toUpperCase()}${scope.slice(1)}`),
    count: dataToolsSummary.value?.scopes.find((item) => item.scope === scope)?.count ?? 0
  }))
);
const importScopeLabels = computed(() =>
  (pendingImportBundle.value?.scopes ?? [])
    .map((scope) => dataToolScopeOptions.value.find((option) => option.value === scope)?.label ?? scope)
    .join(' / ')
);
const wipeScopeLabels = computed(() =>
  selectedWipeScopes.value
    .map((scope) => dataToolScopeOptions.value.find((option) => option.value === scope)?.label ?? scope)
    .join(' / ')
);
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
const itemKey = (item: Item) => item.id;
const itemLabel = (item: Item) => item.name;
const ancientArtifactKey = (item: AncientArtifact) => item.id;
const ancientArtifactLabel = (item: AncientArtifact) => item.name;
const recipeKey = (item: Recipe) => item.id;
const recipeLabel = (item: Recipe) => item.name;
const dishCategoryKey = (item: DishCategory) => item.id;
const dishCategoryLabel = (item: DishCategory) => item.name;
const dishKey = (item: Dish) => item.id;
const dishLabel = (item: Dish) => item.item.name;
const habitatKey = (item: Habitat) => item.id;
const habitatLabel = (item: Habitat) => item.name;

function can(permissionKey: string) {
  return currentUser.value?.permissions.includes(permissionKey) === true;
}

function canAny(permissionKey: string | string[]) {
  return Array.isArray(permissionKey) ? permissionKey.some((key) => can(key)) : can(permissionKey);
}

function toggleDataToolScope(values: DataToolScope[], scope: DataToolScope) {
  const nextValues = new Set(values);
  if (nextValues.has(scope)) {
    nextValues.delete(scope);
  } else {
    nextValues.add(scope);
  }
  return normalizeDataToolScopes([...nextValues]);
}

function normalizeDataToolScopes(scopes: DataToolScope[]) {
  const nextValues = new Set(scopes);
  if (nextValues.has('items')) {
    nextValues.add('recipes');
  }
  return dataToolScopeKeys.filter((item) => nextValues.has(item));
}

function dataToolScopeLocked(values: DataToolScope[], scope: DataToolScope) {
  return scope === 'recipes' && values.includes('items');
}

function toggleExportScope(scope: DataToolScope) {
  selectedExportScopes.value = toggleDataToolScope(selectedExportScopes.value, scope);
}

function toggleWipeScope(scope: DataToolScope) {
  selectedWipeScopes.value = toggleDataToolScope(selectedWipeScopes.value, scope);
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

function permissionSwitchOptions(permissions: Permission[]): SwitchGroupOption[] {
  return permissions.map((permission) => ({
    value: permission.id,
    label: permission.name,
    description: permission.key,
    disabled: busy.value || !permission.enabled
  }));
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
  configForm.value = { id: 0, name: '', translations: {}, hasItemDrop: false, hasTrading: false, isDefault: false, isRateable: false, changeLog: '' };
}

function resetChecklistForm() {
  checklistForm.value = { id: 0, title: '', translations: {} };
}

function resetDishCategoryForm() {
  dishCategoryForm.value = {
    id: 0,
    name: '',
    effect: '',
    translations: {},
    cookwareItemId: '',
    mainMaterialItemId: '',
    totalMaterialQuantity: 2
  };
}

function resetDishForm() {
  dishForm.value = {
    id: 0,
    categoryId: dishCategoryRows.value[0] ? String(dishCategoryRows.value[0].id) : '',
    itemId: '',
    flavorId: '',
    translations: {},
    secondaryMaterialItemIds: ['', ''],
    pokemonSkillId: '',
    mosslaxEffect: ''
  };
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

function resetRateLimitForm(settings: RateLimitSettings | null = rateLimitSettings.value) {
  rateLimitForm.value = Object.fromEntries(
    rateLimitPolicyKeys.map((policy) => {
      const policySettings = settings?.policies[policy] ?? defaultRateLimitPolicies[policy];
      return [
        policy,
        {
          maxRequests: policySettings.maxRequests,
          timeWindowMinutes: Math.max(1, Math.round(policySettings.timeWindowSeconds / 60)),
          cooldownSeconds: policySettings.cooldownSeconds
        }
      ];
    })
  ) as Record<RateLimitPolicyKey, RateLimitPolicyForm>;
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
  configForm.value = {
    id: item.id,
    name: item.baseName ?? item.name,
    translations: item.translations ?? {},
    hasItemDrop: item.hasItemDrop === true,
    hasTrading: item.hasTrading === true,
    isDefault: item.isDefault === true,
    isRateable: item.isRateable === true,
    changeLog: item.changeLog ?? ''
  };
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

function openNewDishCategory() {
  resetDishCategoryForm();
  dishCategoryModalOpen.value = true;
}

function closeDishCategoryModal() {
  dishCategoryModalOpen.value = false;
  resetDishCategoryForm();
}

function editDishCategory(item: DishCategory) {
  dishCategoryForm.value = {
    id: item.id,
    name: item.baseName ?? item.name,
    effect: item.baseEffect ?? item.effect,
    translations: item.translations ?? {},
    cookwareItemId: String(item.cookware.id),
    mainMaterialItemId: String(item.mainMaterial.id),
    totalMaterialQuantity: item.totalMaterialQuantity
  };
  dishCategoryModalOpen.value = true;
}

function openNewDish() {
  resetDishForm();
  dishModalOpen.value = true;
}

function closeDishModal() {
  dishModalOpen.value = false;
  resetDishForm();
}

function editDish(item: Dish) {
  dishForm.value = {
    id: item.id,
    categoryId: String(item.category.id),
    itemId: String(item.item.id),
    flavorId: String(item.flavor.id),
    translations: item.translations ?? {},
    secondaryMaterialItemIds: [String(item.secondaryMaterials[0]?.id ?? ''), String(item.secondaryMaterials[1]?.id ?? '')],
    pokemonSkillId: String(item.pokemonSkill?.id ?? ''),
    mosslaxEffect: item.baseMosslaxEffect ?? item.mosslaxEffect
  };
  dishModalOpen.value = true;
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

function previewItemOrder(rows: Item[]) {
  itemRows.value = rows;
}

function previewAncientArtifactOrder(rows: AncientArtifact[]) {
  ancientArtifactRows.value = rows;
}

function previewRecipeOrder(rows: Recipe[]) {
  recipeRows.value = rows;
}

function previewDishCategoryOrder(rows: DishCategory[]) {
  dishCategoryRows.value = rows;
}

function previewDishOrder(rows: Dish[]) {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const orderById = new Map(rows.map((row, index) => [row.id, index]));
  dishCategoryRows.value = dishCategoryRows.value.map((category) => ({
    ...category,
    dishes: category.dishes
      .map((dish) => rowsById.get(dish.id) ?? dish)
      .sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0))
  }));
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

async function persistAncientArtifactOrder(nextRows: AncientArtifact[], fallbackRows: AncientArtifact[]) {
  ancientArtifactRows.value = nextRows;
  await run(async () => {
    try {
      ancientArtifactRows.value = await api.reorderAncientArtifacts(nextRows.map((item) => item.id));
    } catch (error) {
      ancientArtifactRows.value = fallbackRows;
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

async function persistDishCategoryOrder(nextRows: DishCategory[], fallbackRows: DishCategory[]) {
  dishCategoryRows.value = nextRows;
  await run(async () => {
    try {
      dishCategoryRows.value = await api.reorderDishCategories(nextRows.map((item) => item.id));
    } catch (error) {
      dishCategoryRows.value = fallbackRows;
      throw error;
    }
  });
}

async function persistDishOrder(nextRows: Dish[], fallbackRows: Dish[]) {
  previewDishOrder(nextRows);
  await run(async () => {
    try {
      dishCategoryRows.value = await api.reorderDishes(nextRows.map((item) => item.id));
    } catch (error) {
      previewDishOrder(fallbackRows);
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
      hasItemDrop: selectedConfig.value.supportsItemDrop ? configForm.value.hasItemDrop : undefined,
      hasTrading: selectedConfig.value.supportsTrading ? configForm.value.hasTrading : undefined,
      isDefault: selectedConfig.value.supportsDefault ? configForm.value.isDefault : undefined,
      isRateable: selectedConfig.value.supportsRateable ? configForm.value.isRateable : undefined,
      changeLog: selectedConfig.value.supportsChangeLog ? configForm.value.changeLog : undefined
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

function dishCategoryPayloadForSave() {
  return {
    name: dishCategoryForm.value.name,
    effect: dishCategoryForm.value.effect,
    translations: dishCategoryForm.value.translations,
    cookwareItemId: Number(dishCategoryForm.value.cookwareItemId),
    mainMaterialItemId: Number(dishCategoryForm.value.mainMaterialItemId),
    totalMaterialQuantity: Number(dishCategoryForm.value.totalMaterialQuantity)
  };
}

function dishPayloadForSave() {
  const secondaryMaterialItemIds = dishForm.value.secondaryMaterialItemIds
    .map((itemId) => Number(itemId))
    .filter((itemId) => Number.isInteger(itemId) && itemId > 0);

  return {
    categoryId: Number(dishForm.value.categoryId),
    itemId: Number(dishForm.value.itemId),
    flavorId: Number(dishForm.value.flavorId),
    translations: dishForm.value.translations,
    secondaryMaterialItemIds: dishAllowsSecondSecondaryMaterial.value ? secondaryMaterialItemIds : secondaryMaterialItemIds.slice(0, 1),
    pokemonSkillId: dishForm.value.pokemonSkillId ? Number(dishForm.value.pokemonSkillId) : null,
    mosslaxEffect: dishForm.value.mosslaxEffect
  };
}

async function saveDishCategory() {
  if (!dishCategoryFormValid.value) {
    return;
  }

  await run(async () => {
    const payload = dishCategoryPayloadForSave();
    if (dishCategoryForm.value.id) {
      await api.updateDishCategory(dishCategoryForm.value.id, payload);
    } else {
      await api.createDishCategory(payload);
    }
    await loadDishAdmin();
    closeDishCategoryModal();
  });
}

async function saveDish() {
  if (!dishFormValid.value) {
    return;
  }

  await run(async () => {
    const payload = dishPayloadForSave();
    if (dishForm.value.id) {
      await api.updateDish(dishForm.value.id, payload);
    } else {
      await api.createDish(payload);
    }
    await loadDishAdmin();
    closeDishModal();
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

async function loadAncientArtifacts() {
  ancientArtifactRows.value = await api.ancientArtifacts();
}

async function loadRecipes() {
  recipeRows.value = await api.recipes();
}

async function loadDishAdmin() {
  await loadLanguages();
  const [dishCategories, items, options] = await Promise.all([api.dish(), api.items({}), api.options()]);
  dishCategoryRows.value = dishCategories;
  dishItemRows.value = items;
  dishSkillRows.value = options.skills;
  dishFlavorRows.value = options.dishFlavors;
  if (!dishForm.value.id && !dishForm.value.categoryId) {
    resetDishForm();
  }
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

async function loadRateLimitSettings() {
  rateLimitSettings.value = await api.rateLimitSettings();
  resetRateLimitForm(rateLimitSettings.value);
}

async function loadDataToolsSummary() {
  dataToolsSummary.value = await api.dataToolsSummary();
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

async function saveRateLimitSettings() {
  await run(async () => {
    const policies = Object.fromEntries(
      rateLimitPolicyKeys.map((policy) => [
        policy,
        {
          maxRequests: rateLimitForm.value[policy].maxRequests,
          timeWindowSeconds: rateLimitForm.value[policy].timeWindowMinutes * 60,
          cooldownSeconds: rateLimitForm.value[policy].cooldownSeconds
        }
      ])
    ) as RateLimitSettingsPayload['policies'];

    rateLimitSettings.value = await api.updateRateLimitSettings({ policies });
    resetRateLimitForm(rateLimitSettings.value);
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
    if (activeTab.value === 'rateLimits') await loadRateLimitSettings();
    if (activeTab.value === 'languages') await loadLanguages();
    if (activeTab.value === 'wordings') await loadWordings();
    if (activeTab.value === 'aiModeration') await loadAiModerationSettings();
    if (activeTab.value === 'dataTools') await loadDataToolsSummary();
    if (activeTab.value === 'checklist') await loadChecklist();
    if (activeTab.value === 'pokemon') await loadPokemon();
    if (activeTab.value === 'items') await loadItems();
    if (activeTab.value === 'ancientArtifacts') await loadAncientArtifacts();
    if (activeTab.value === 'recipes') await loadRecipes();
    if (activeTab.value === 'dish') await loadDishAdmin();
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

async function removeAncientArtifact(id: number) {
  await run(async () => {
    await api.deleteAncientArtifact(id);
    await loadAncientArtifacts();
  });
}

async function removeRecipe(id: number) {
  await run(async () => {
    await api.deleteRecipe(id);
    await loadRecipes();
  });
}

async function removeDishCategory(id: number) {
  await run(async () => {
    await api.deleteDishCategory(id);
    if (dishCategoryForm.value.id === id) {
      closeDishCategoryModal();
    }
    await loadDishAdmin();
  });
}

async function removeDish(id: number) {
  await run(async () => {
    await api.deleteDish(id);
    if (dishForm.value.id === id) {
      closeDishModal();
    }
    await loadDishAdmin();
  });
}

async function removeHabitat(id: number) {
  await run(async () => {
    await api.deleteHabitat(id);
    await loadHabitats();
  });
}

function downloadDataToolsBundle(bundle: DataToolsBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pokopia-data-${bundle.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportDataTools() {
  const scopes = normalizeDataToolScopes(selectedExportScopes.value);
  if (!scopes.length) {
    message.value = t('pages.admin.dataToolSelectScope');
    return;
  }
  selectedExportScopes.value = scopes;

  await run(async () => {
    const bundle = await api.exportDataTools(scopes);
    downloadDataToolsBundle(bundle);
  });
}

function openWipeDataTools() {
  const scopes = normalizeDataToolScopes(selectedWipeScopes.value);
  if (!scopes.length) {
    message.value = t('pages.admin.dataToolSelectScope');
    return;
  }
  selectedWipeScopes.value = scopes;
  dataToolConfirmText.value = '';
  dataToolWipeModalOpen.value = true;
}

function closeWipeDataToolsModal() {
  dataToolWipeModalOpen.value = false;
  dataToolConfirmText.value = '';
}

async function confirmWipeDataTools() {
  if (dataToolConfirmText.value !== 'WIPE') {
    return;
  }

  await run(async () => {
    dataToolsSummary.value = await api.wipeDataTools(normalizeDataToolScopes(selectedWipeScopes.value));
    selectedWipeScopes.value = [];
    closeWipeDataToolsModal();
  });
}

function validDataToolsBundle(value: unknown): value is DataToolsBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const bundle = value as Partial<DataToolsBundle>;
  return (
    bundle.version === 1 &&
    Array.isArray(bundle.scopes) &&
    bundle.scopes.length > 0 &&
    bundle.scopes.every((scope) => dataToolScopeKeys.includes(scope)) &&
    Boolean(bundle.data) &&
    typeof bundle.data === 'object' &&
    !Array.isArray(bundle.data)
  );
}

async function selectImportDataToolsFile(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (input) {
    input.value = '';
  }
  if (!file) {
    return;
  }

  try {
    const bundle = JSON.parse(await file.text()) as unknown;
    if (!validDataToolsBundle(bundle)) {
      message.value = t('pages.admin.dataToolInvalidBundle');
      return;
    }
    pendingImportBundle.value = { ...bundle, scopes: normalizeDataToolScopes(bundle.scopes) };
    dataToolConfirmText.value = '';
    dataToolImportModalOpen.value = true;
  } catch {
    message.value = t('pages.admin.dataToolInvalidBundle');
  }
}

async function selectImportItemsCsvFile(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (input) {
    input.value = '';
  }
  if (!file) {
    return;
  }

  await run(async () => {
    const csv = await file.text();
    dataToolsSummary.value = await api.importItemsCsvDataTools(csv);
    message.value = t('pages.admin.dataToolItemsCsvImported');
  });
}

async function selectImportHabitatsCsvFile(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (input) {
    input.value = '';
  }
  if (!file) {
    return;
  }

  await run(async () => {
    const csv = await file.text();
    dataToolsSummary.value = await api.importHabitatsCsvDataTools(csv);
    message.value = t('pages.admin.dataToolHabitatsCsvImported');
  });
}

function closeImportDataToolsModal() {
  dataToolImportModalOpen.value = false;
  pendingImportBundle.value = null;
  dataToolConfirmText.value = '';
}

async function confirmImportDataTools() {
  if (!pendingImportBundle.value || dataToolConfirmText.value !== 'IMPORT') {
    return;
  }

  await run(async () => {
    dataToolsSummary.value = await api.importDataTools(pendingImportBundle.value as DataToolsBundle);
    closeImportDataToolsModal();
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

    <section v-else-if="canEdit && activeTab === 'rateLimits'" class="detail-section">
      <form class="modal-edit-form" @submit.prevent="saveRateLimitSettings">
        <div class="detail-section__header">
          <h2>{{ t('pages.admin.rateLimits') }}</h2>
          <button v-if="can('admin.rate-limits.update')" class="ui-button ui-button--primary ui-button--small" type="submit" :disabled="busy">
            <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
            {{ busy ? t('common.saving') : t('common.save') }}
          </button>
        </div>
        <div class="rate-limit-list">
          <div v-for="policy in rateLimitPolicyOptions" :key="policy.value" class="rate-limit-row">
            <h3>{{ policy.label }}</h3>
            <div class="rate-limit-fields">
              <div class="field">
                <label :for="`rate-limit-${policy.value}-max`">{{ t('pages.admin.rateLimitMaxRequests') }}</label>
                <input
                  :id="`rate-limit-${policy.value}-max`"
                  v-model.number="rateLimitForm[policy.value].maxRequests"
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  :disabled="busy || !can('admin.rate-limits.update')"
                  required
                />
              </div>
              <div class="field">
                <label :for="`rate-limit-${policy.value}-window`">{{ t('pages.admin.rateLimitWindowMinutes') }}</label>
                <input
                  :id="`rate-limit-${policy.value}-window`"
                  v-model.number="rateLimitForm[policy.value].timeWindowMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  :disabled="busy || !can('admin.rate-limits.update')"
                  required
                />
              </div>
              <div class="field">
                <label :for="`rate-limit-${policy.value}-cooldown`">{{ t('pages.admin.rateLimitCooldownSeconds') }}</label>
                <input
                  :id="`rate-limit-${policy.value}-cooldown`"
                  v-model.number="rateLimitForm[policy.value].cooldownSeconds"
                  type="number"
                  min="0"
                  max="3600"
                  step="1"
                  :disabled="busy || !can('admin.rate-limits.update')"
                  required
                />
              </div>
            </div>
          </div>
        </div>
      </form>
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

    <section v-else-if="canEdit && activeTab === 'dataTools'" class="detail-section">
      <div class="detail-section__header">
        <h2>{{ t('pages.admin.dataTools') }}</h2>
        <button type="button" class="ui-button ui-button--blue ui-button--small" :disabled="busy" @click="run(loadDataToolsSummary)">
          <Icon :icon="iconAdmin" class="ui-icon" aria-hidden="true" />
          {{ t('pages.admin.dataToolRefresh') }}
        </button>
      </div>

      <div class="data-tool-grid">
        <section class="data-tool-panel" :aria-label="t('pages.admin.dataToolExport')">
          <div class="data-tool-panel__header">
            <h3>{{ t('pages.admin.dataToolExport') }}</h3>
            <button type="button" class="ui-button ui-button--primary ui-button--small" :disabled="busy || !can('admin.data.export')" @click="exportDataTools">
              <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
              {{ t('pages.admin.dataToolExportButton') }}
            </button>
          </div>
          <div class="data-tool-scope-list">
            <label v-for="option in dataToolScopeOptions" :key="`export-${option.value}`" class="data-tool-scope">
              <input
                type="checkbox"
                :checked="selectedExportScopes.includes(option.value)"
                :disabled="busy || !can('admin.data.export') || dataToolScopeLocked(selectedExportScopes, option.value)"
                @change="toggleExportScope(option.value)"
              />
              <span>{{ option.label }}</span>
              <span class="config-flag">{{ option.count }}</span>
            </label>
          </div>
          <p class="meta-line">{{ t('pages.admin.dataToolDependencyNote') }}</p>
          <p class="meta-line">{{ t('pages.admin.dataToolUploadsNote') }}</p>
        </section>

        <section class="data-tool-panel" :aria-label="t('pages.admin.dataToolImport')">
          <div class="data-tool-panel__header">
            <h3>{{ t('pages.admin.dataToolImport') }}</h3>
          </div>
          <div class="field">
            <label for="data-tools-import-file">{{ t('pages.admin.dataToolImportFile') }}</label>
            <input id="data-tools-import-file" type="file" accept="application/json,.json" :disabled="busy || !can('admin.data.import')" @change="selectImportDataToolsFile" />
          </div>
          <p class="meta-line">{{ t('pages.admin.dataToolDependencyNote') }}</p>
          <p class="meta-line">{{ t('pages.admin.dataToolImportMode') }}</p>
          <div class="field">
            <label for="data-tools-items-csv-file">{{ t('pages.admin.dataToolItemsCsvFile') }}</label>
            <input id="data-tools-items-csv-file" type="file" accept="text/csv,.csv" :disabled="busy || !can('admin.data.import')" @change="selectImportItemsCsvFile" />
          </div>
          <p class="meta-line">{{ t('pages.admin.dataToolItemsCsvMode') }}</p>
          <div class="field">
            <label for="data-tools-habitats-csv-file">{{ t('pages.admin.dataToolHabitatsCsvFile') }}</label>
            <input id="data-tools-habitats-csv-file" type="file" accept="text/csv,.csv" :disabled="busy || !can('admin.data.import')" @change="selectImportHabitatsCsvFile" />
          </div>
          <p class="meta-line">{{ t('pages.admin.dataToolHabitatsCsvMode') }}</p>
        </section>

        <section class="data-tool-panel data-tool-panel--danger" :aria-label="t('pages.admin.dataToolWipe')">
          <div class="data-tool-panel__header">
            <h3>{{ t('pages.admin.dataToolWipe') }}</h3>
            <button type="button" class="ui-button ui-button--red ui-button--small" :disabled="busy || !can('admin.data.import')" @click="openWipeDataTools">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('pages.admin.dataToolWipeButton') }}
            </button>
          </div>
          <div class="data-tool-scope-list">
            <label v-for="option in dataToolScopeOptions" :key="`wipe-${option.value}`" class="data-tool-scope">
              <input
                type="checkbox"
                :checked="selectedWipeScopes.includes(option.value)"
                :disabled="busy || !can('admin.data.import') || dataToolScopeLocked(selectedWipeScopes, option.value)"
                @change="toggleWipeScope(option.value)"
              />
              <span>{{ option.label }}</span>
              <span class="config-flag">{{ option.count }}</span>
            </label>
          </div>
          <p class="meta-line">{{ t('pages.admin.dataToolDependencyNote') }}</p>
          <p class="meta-line">{{ t('pages.admin.dataToolReplaceNote') }}</p>
        </section>
      </div>
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
            {{ item.name }}
            <span v-if="item.hasItemDrop" class="config-flag">{{ t('pages.admin.hasItemDrop') }}</span>
            <span v-if="item.hasTrading" class="config-flag">{{ t('pages.admin.hasTrading') }}</span>
            <span v-if="item.isDefault" class="config-flag">{{ t('pages.admin.defaultCategory') }}</span>
            <span v-if="item.isRateable" class="config-flag">{{ t('pages.admin.rateableCategory') }}</span>
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
      <ul v-if="pokemonRows.length" class="row-list">
        <li v-for="item in pokemonRows" :key="item.id">
          <RouterLink :to="`/pokemon/${item.id}`">#{{ item.displayId }} {{ item.name }}</RouterLink>
          <span class="row-actions">
            <button v-if="can('pokemon.delete')" type="button" :disabled="busy" @click="removePokemon(item.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </span>
        </li>
      </ul>
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

    <section v-else-if="canEdit && activeTab === 'ancientArtifacts'" class="detail-section">
      <h2>{{ t('pages.admin.ancientArtifactList') }}</h2>
      <ReorderableList
        v-if="ancientArtifactRows.length"
        :items="ancientArtifactRows"
        :item-key="ancientArtifactKey"
        :item-label="ancientArtifactLabel"
        list-key-prefix="ancient-artifacts"
        :disabled="busy || !can('ancient-artifacts.order')"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewAncientArtifactOrder"
        @cancel="previewAncientArtifactOrder"
        @reorder="persistAncientArtifactOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/ancient-artifacts/${item.id}`">{{ item.name }}</RouterLink>
          <span class="row-actions">
            <button v-if="can('ancient-artifacts.delete')" type="button" :disabled="busy" @click="removeAncientArtifact(item.id)">
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

    <section v-else-if="canEdit && activeTab === 'dish'" class="detail-section">
      <div class="detail-section__header">
        <h2>{{ t('pages.admin.dishList') }}</h2>
        <span class="row-actions">
          <button v-if="can('dish.create')" type="button" class="ui-button ui-button--primary ui-button--small" :disabled="busy" @click="openNewDishCategory">
            <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
            {{ t('pages.dish.newCategory') }}
          </button>
          <button v-if="can('dish.create')" type="button" class="ui-button ui-button--blue ui-button--small" :disabled="busy || !dishCategoryRows.length" @click="openNewDish">
            <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
            {{ t('pages.dish.newDish') }}
          </button>
        </span>
      </div>

      <h3 class="section-subtitle">{{ t('pages.dish.categories') }}</h3>
      <ReorderableList
        v-if="dishCategoryRows.length"
        :items="dishCategoryRows"
        :item-key="dishCategoryKey"
        :item-label="dishCategoryLabel"
        list-key-prefix="dish-categories"
        :disabled="busy || !can('dish.order')"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewDishCategoryOrder"
        @cancel="previewDishCategoryOrder"
        @reorder="persistDishCategoryOrder"
      >
        <template #default="{ item }">
          <span class="reorderable-row-title">{{ item.name }}</span>
          <span class="meta-line">{{ item.cookware.name }} / {{ item.mainMaterial.name }} / {{ item.totalMaterialQuantity }}</span>
          <span class="row-actions">
            <button v-if="can('dish.update')" type="button" :disabled="busy" @click="editDishCategory(item)">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('common.edit') }}
            </button>
            <button v-if="can('dish.delete')" type="button" :disabled="busy" @click="removeDishCategory(item.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </span>
        </template>
      </ReorderableList>
      <p v-else class="meta-line">{{ t('common.noRecords') }}</p>

      <h3 class="section-subtitle">{{ t('pages.dish.dishes') }}</h3>
      <ReorderableList
        v-if="dishRows.length"
        :items="dishRows"
        :item-key="dishKey"
        :item-label="dishLabel"
        list-key-prefix="dishes"
        :disabled="busy || !can('dish.order')"
        :handle-label="dragSortLabel"
        :handle-title="t('pages.admin.dragSortTitle')"
        @preview="previewDishOrder"
        @cancel="previewDishOrder"
        @reorder="persistDishOrder"
      >
        <template #default="{ item }">
          <RouterLink :to="`/items/${item.item.id}`">{{ item.item.name }}</RouterLink>
          <span class="meta-line">{{ item.category.name }} / {{ item.flavor.name }}</span>
          <span class="row-actions">
            <button v-if="can('dish.update')" type="button" :disabled="busy" @click="editDish(item)">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('common.edit') }}
            </button>
            <button v-if="can('dish.delete')" type="button" :disabled="busy" @click="removeDish(item.id)">
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

    <Modal v-if="dataToolImportModalOpen" :title="t('pages.admin.dataToolImport')" :close-label="t('common.close')" @close="closeImportDataToolsModal">
      <form id="admin-data-tool-import-form" class="modal-edit-form" @submit.prevent="confirmImportDataTools">
        <p class="meta-line">{{ t('pages.admin.dataToolImportConfirm', { scopes: importScopeLabels }) }}</p>
        <div class="field">
          <label for="data-tool-import-confirm">{{ t('pages.admin.dataToolConfirmImport') }}</label>
          <input id="data-tool-import-confirm" v-model="dataToolConfirmText" autocomplete="off" required />
        </div>
      </form>
      <template #footer>
        <button type="button" class="link-button" :disabled="busy" @click="closeImportDataToolsModal">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" form="admin-data-tool-import-form" class="link-button" :disabled="busy || dataToolConfirmText !== 'IMPORT'">
          <Icon :icon="iconUpload" class="ui-icon" aria-hidden="true" />
          {{ t('pages.admin.dataToolImportButton') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="dataToolWipeModalOpen" :title="t('pages.admin.dataToolWipe')" :close-label="t('common.close')" @close="closeWipeDataToolsModal">
      <form id="admin-data-tool-wipe-form" class="modal-edit-form" @submit.prevent="confirmWipeDataTools">
        <p class="meta-line">{{ t('pages.admin.dataToolWipeConfirm', { scopes: wipeScopeLabels }) }}</p>
        <div class="field">
          <label for="data-tool-wipe-confirm">{{ t('pages.admin.dataToolConfirmWipe') }}</label>
          <input id="data-tool-wipe-confirm" v-model="dataToolConfirmText" autocomplete="off" required />
        </div>
      </form>
      <template #footer>
        <button type="button" class="link-button" :disabled="busy" @click="closeWipeDataToolsModal">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" form="admin-data-tool-wipe-form" class="link-button" :disabled="busy || dataToolConfirmText !== 'WIPE'">
          <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
          {{ t('pages.admin.dataToolWipeButton') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="userRoleModalOpen" :title="userRoleModalTitle" :close-label="t('common.close')" size="wide" @close="closeUserRoleModal">
      <form id="admin-user-roles-form" class="modal-edit-form" @submit.prevent="saveUserRoles">
        <div v-if="editingUser" class="access-modal-heading">
          <strong>{{ editingUser.displayName }}</strong>
          <span class="meta-line">{{ editingUser.email }}</span>
        </div>
        <SwitchGroup id="admin-user-roles" v-model="userRoleSwitchValue" :label="t('pages.admin.roles')" :options="userRoleSwitchOptions" layout="grid" />
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
          <section v-for="(group, index) in permissionGroups" :key="group.category" class="permission-group">
            <SwitchGroup
              :id="`admin-role-permissions-${index}`"
              v-model="rolePermissionSwitchValue"
              :label="group.category"
              :options="permissionSwitchOptions(group.permissions)"
              layout="grid"
            />
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

    <Modal v-if="dishCategoryModalOpen" :title="dishCategoryModalTitle" :close-label="t('common.close')" size="wide" @close="closeDishCategoryModal">
      <form id="admin-dish-category-form" class="modal-edit-form dish-form-stack" @submit.prevent="saveDishCategory">
        <div class="dish-form-row dish-form-row--4">
          <TranslationFields
            id-prefix="dish-category-name"
            v-model:base-value="dishCategoryForm.name"
            v-model:translations="dishCategoryForm.translations"
            field="name"
            :label="t('common.name')"
            :languages="languageRows"
            required
          />
          <div class="field">
            <label for="dish-category-cookware">{{ t('pages.dish.cookware') }}</label>
            <TagsSelect
              id="dish-category-cookware"
              v-model="dishCategoryForm.cookwareItemId"
              :options="dishItemSelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
          <div class="field">
            <label for="dish-category-total-material-quantity">{{ t('pages.dish.totalMaterialQuantity') }}</label>
            <input id="dish-category-total-material-quantity" v-model.number="dishCategoryForm.totalMaterialQuantity" type="number" min="2" required />
          </div>
          <div class="field">
            <label for="dish-category-main-material">{{ t('pages.dish.mainMaterial') }}</label>
            <TagsSelect
              id="dish-category-main-material"
              v-model="dishCategoryForm.mainMaterialItemId"
              :options="dishItemSelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
        </div>
        <TranslationFields
          id-prefix="dish-category-effect"
          v-model:base-value="dishCategoryForm.effect"
          v-model:translations="dishCategoryForm.translations"
          field="effect"
          :label="t('pages.dish.effect')"
          :languages="languageRows"
          required
        />
      </form>

      <template #footer>
        <button type="submit" form="admin-dish-category-form" class="link-button" :disabled="busy || !dishCategoryFormValid">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeDishCategoryModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="dishModalOpen" :title="dishModalTitle" :close-label="t('common.close')" size="wide" @close="closeDishModal">
      <form id="admin-dish-form" class="modal-edit-form dish-form-stack" @submit.prevent="saveDish">
        <div class="dish-form-row dish-form-row--3">
          <div class="field">
            <label for="dish-category">{{ t('pages.dish.category') }}</label>
            <TagsSelect
              id="dish-category"
              v-model="dishForm.categoryId"
              :options="dishCategorySelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.dish.category')"
            />
          </div>
          <div class="field">
            <label for="dish-item">{{ t('pages.dish.dishItem') }}</label>
            <TagsSelect
              id="dish-item"
              v-model="dishForm.itemId"
              :options="dishItemSelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
          <div class="field">
            <label for="dish-flavor">{{ t('pages.dish.flavor') }}</label>
            <TagsSelect
              id="dish-flavor"
              v-model="dishForm.flavorId"
              :options="dishFlavorSelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.dish.flavor')"
            />
          </div>
        </div>
        <div class="dish-form-row dish-form-row--3">
          <div class="field">
            <label for="dish-secondary-material-1">{{ t('pages.dish.secondaryMaterial') }}</label>
            <TagsSelect
              id="dish-secondary-material-1"
              v-model="dishForm.secondaryMaterialItemIds[0]"
              :options="optionalDishItemSelectOptions"
              :multiple="false"
              :placeholder="t('common.none')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
          <div v-if="dishAllowsSecondSecondaryMaterial" class="field">
            <label for="dish-secondary-material-2">{{ t('pages.dish.secondSecondaryMaterial') }}</label>
            <TagsSelect
              id="dish-secondary-material-2"
              v-model="dishForm.secondaryMaterialItemIds[1]"
              :options="optionalDishItemSelectOptions"
              :multiple="false"
              :placeholder="t('common.none')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
          <div class="field">
            <label for="dish-pokemon-skill">{{ t('pages.dish.pokemonSkill') }}</label>
            <TagsSelect
              id="dish-pokemon-skill"
              v-model="dishForm.pokemonSkillId"
              :options="optionalDishSkillSelectOptions"
              :multiple="false"
              :placeholder="t('common.none')"
              :search-placeholder="t('pages.dish.pokemonSkill')"
            />
          </div>
        </div>
        <TranslationFields
          id-prefix="dish-mosslax-effect"
          v-model:base-value="dishForm.mosslaxEffect"
          v-model:translations="dishForm.translations"
          field="mosslaxEffect"
          :label="t('pages.dish.mosslaxEffect')"
          :languages="languageRows"
          required
        />
      </form>

      <template #footer>
        <button type="submit" form="admin-dish-form" class="link-button" :disabled="busy || !dishFormValid">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeDishModal">
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
        <div v-if="selectedConfig.supportsTrading" class="check-row">
          <label>
            <input v-model="configForm.hasTrading" type="checkbox" />
            {{ t('pages.admin.hasTrading') }}
          </label>
        </div>
        <div v-if="selectedConfig.supportsDefault" class="check-row">
          <label>
            <input v-model="configForm.isDefault" type="checkbox" />
            {{ t('pages.admin.defaultCategory') }}
          </label>
        </div>
        <div v-if="selectedConfig.supportsRateable" class="check-row">
          <label>
            <input v-model="configForm.isRateable" type="checkbox" />
            {{ t('pages.admin.rateableCategory') }}
          </label>
        </div>
        <div v-if="selectedConfig.supportsChangeLog" class="field">
          <label for="config-change-log">{{ t('pages.admin.changeLog') }}</label>
          <textarea id="config-change-log" v-model="configForm.changeLog"></textarea>
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
