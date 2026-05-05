<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import ImageUploadField from '../components/ImageUploadField.vue';
import Modal from '../components/Modal.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import TranslationFields from '../components/TranslationFields.vue';
import { iconCancel, iconSave } from '../icons';
import {
  api,
  getAuthToken,
  type AuthUser,
  type ConfigType,
  type EntityImage,
  type EntityImageUpload,
  type ItemPayload,
  type Language,
  type Options,
  type TranslationMap
} from '../services/api';

const route = useRoute();
const router = useRouter();
const { locale, t } = useI18n();
const options = ref<Options | null>(null);
const languages = ref<Language[]>([]);
const currentUser = ref<AuthUser | null>(null);
const currentImage = ref<EntityImage | null>(null);
const imageHistory = ref<EntityImageUpload[]>([]);
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const itemForm = ref({
  name: '',
  details: '',
  basePrice: '',
  translations: {} as TranslationMap,
  categoryId: '',
  usageId: '',
  dyeable: false,
  dualDyeable: false,
  patternEditable: false,
  noRecipe: false,
  isEventItem: false,
  acquisitionMethodIds: [] as string[],
  tagIds: [] as string[],
  imagePath: ''
});

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

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const isEventCreate = computed(() => route.name === 'event-item-new');
const insertBeforeItemId = computed(() => queryItemId(route.query.insertBeforeItemId));
const insertAfterItemId = computed(() => queryItemId(route.query.insertAfterItemId));
const pageTitle = computed(() =>
  isEditing.value
    ? t('pages.items.editTitle', { name: itemForm.value.name || t('pages.items.fallbackName') })
    : isEventCreate.value
      ? t('pages.eventItems.newTitle')
      : t('pages.items.newTitle')
);
const cancelTo = computed(() => (isEditing.value ? `/items/${routeId.value}` : isEventCreate.value ? '/event-items' : '/items'));
const hasRecipe = ref(false);
const imageEntityName = computed(() => itemNameForSave().trim());
const canCreateConfig = computed(() => currentUser.value?.permissions.includes('admin.config.create') === true);
const canUploadImage = computed(() => currentUser.value?.permissions.includes('items.upload') === true);

function toIds(values: string[]): number[] {
  return values.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function queryItemId(value: unknown): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const id = Number(rawValue);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function readItemCreateDefaults(): ItemCreateDefaults {
  if (typeof sessionStorage === 'undefined') {
    return {
      categoryId: '',
      usageId: '',
      dyeable: false,
      dualDyeable: false,
      patternEditable: false,
      noRecipe: false,
      acquisitionMethodIds: []
    };
  }

  try {
    const rawValue = sessionStorage.getItem(itemCreateDefaultsStorageKey);
    if (!rawValue) {
      return {
        categoryId: '',
        usageId: '',
        dyeable: false,
        dualDyeable: false,
        patternEditable: false,
        noRecipe: false,
        acquisitionMethodIds: []
      };
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
    return {
      categoryId: '',
      usageId: '',
      dyeable: false,
      dualDyeable: false,
      patternEditable: false,
      noRecipe: false,
      acquisitionMethodIds: []
    };
  }
}

function applyItemCreateDefaults(isEventItem: boolean) {
  const loadedOptions = options.value;
  if (!loadedOptions) {
    itemForm.value.isEventItem = isEventItem;
    return;
  }

  const defaults = readItemCreateDefaults();
  const categoryIds = new Set(loadedOptions.itemCategories.map((item) => String(item.id)));
  const usageIds = new Set(loadedOptions.itemUsages.map((item) => String(item.id)));
  const methodIds = new Set(loadedOptions.acquisitionMethods.map((item) => String(item.id)));
  itemForm.value = {
    ...itemForm.value,
    categoryId: categoryIds.has(defaults.categoryId) ? defaults.categoryId : '',
    usageId: usageIds.has(defaults.usageId) ? defaults.usageId : '',
    dyeable: defaults.dyeable,
    dualDyeable: defaults.dualDyeable,
    patternEditable: defaults.patternEditable,
    noRecipe: defaults.noRecipe,
    isEventItem,
    acquisitionMethodIds: defaults.acquisitionMethodIds.filter((item) => methodIds.has(item))
  };
}

function closeEditor() {
  void router.push(cancelTo.value);
}

function itemNameForSave() {
  const baseName = itemForm.value.name.trim();
  if (baseName !== '') {
    return itemForm.value.name;
  }

  return itemForm.value.translations[String(locale.value || '')]?.name ?? '';
}

async function loadOptions() {
  const [loadedOptions, loadedLanguages] = await Promise.all([api.options(), api.languages()]);
  options.value = loadedOptions;
  languages.value = loadedLanguages;
}

async function loadCurrentUser() {
  if (!getAuthToken()) {
    currentUser.value = null;
    return;
  }

  try {
    currentUser.value = (await api.me()).user;
  } catch {
    currentUser.value = null;
  }
}

async function loadEditor() {
  loading.value = true;
  message.value = '';

  try {
    await Promise.all([loadCurrentUser(), loadOptions()]);
    if (isEditing.value) {
      const item = await api.itemDetail(routeId.value);
      itemForm.value = {
        name: item.baseName ?? item.name,
        details: item.baseDetails ?? item.details,
        basePrice: item.basePrice === null || item.basePrice === undefined ? '' : String(item.basePrice),
        translations: item.translations ?? {},
        categoryId: String(item.category.id),
        usageId: item.usage ? String(item.usage.id) : '',
        dyeable: item.customization.dyeable,
        dualDyeable: item.customization.dualDyeable,
        patternEditable: item.customization.patternEditable,
        noRecipe: item.noRecipe,
        isEventItem: item.isEventItem,
        acquisitionMethodIds: item.acquisitionMethods.map((method) => String(method.id)),
        tagIds: item.tags.map((tag) => String(tag.id)),
        imagePath: item.image?.path ?? ''
      };
      currentImage.value = item.image;
      imageHistory.value = item.imageHistory;
      hasRecipe.value = item.recipe !== null;
    } else {
      applyItemCreateDefaults(isEventCreate.value);
    }
  } catch (error) {
    message.value = errorText(error, t('errors.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function createMultiOption(selectKey: string, type: ConfigType, name: string, values: string[]) {
  const cleanName = name.trim();
  if (!cleanName || !canCreateConfig.value) return;

  creatingSelect.value = selectKey;
  message.value = '';
  try {
    const created = await api.createConfig(type, { name: cleanName });
    await loadOptions();
    const value = String(created.id);
    if (!values.includes(value)) {
      values.push(value);
    }
  } catch (error) {
    message.value = errorText(error, t('errors.addFailed'));
  } finally {
    creatingSelect.value = '';
  }
}

async function saveItem() {
  busy.value = true;
  message.value = '';

  try {
    const payload: ItemPayload = {
      name: itemNameForSave(),
      details: itemForm.value.details,
      basePrice: itemForm.value.basePrice.trim() === '' ? null : Number(itemForm.value.basePrice),
      translations: itemForm.value.translations,
      categoryId: Number(itemForm.value.categoryId),
      usageId: itemForm.value.usageId ? Number(itemForm.value.usageId) : null,
      dyeable: itemForm.value.dyeable,
      dualDyeable: itemForm.value.dualDyeable,
      patternEditable: itemForm.value.patternEditable,
      noRecipe: itemForm.value.noRecipe,
      isEventItem: itemForm.value.isEventItem,
      acquisitionMethodIds: toIds(itemForm.value.acquisitionMethodIds),
      tagIds: toIds(itemForm.value.tagIds),
      imagePath: itemForm.value.imagePath
    };
    if (!isEditing.value && insertBeforeItemId.value !== null) {
      payload.insertBeforeItemId = insertBeforeItemId.value;
    }
    if (!isEditing.value && insertAfterItemId.value !== null) {
      payload.insertAfterItemId = insertAfterItemId.value;
    }
    const saved = isEditing.value ? await api.updateItem(routeId.value, payload) : await api.createItem(payload);
    await router.push(`/items/${saved.id}`);
  } catch (error) {
    message.value = errorText(error, t('errors.saveFailed'));
  } finally {
    busy.value = false;
  }
}

function handleImageSelected(image: EntityImage) {
  currentImage.value = image;
}

function handleImageUploaded(image: EntityImageUpload) {
  currentImage.value = image;
  imageHistory.value = [image, ...imageHistory.value.filter((item) => item.path !== image.path)];
}

onMounted(() => {
  void loadEditor();
});
</script>

<template>
  <Modal :title="pageTitle" :subtitle="t('pages.items.editSubtitle')" :close-label="t('common.close')" size="wide" @close="closeEditor">
    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" id="item-edit-form" class="modal-edit-form" @submit.prevent="saveItem">
      <TranslationFields
        id-prefix="item-name"
        v-model:base-value="itemForm.name"
        v-model:translations="itemForm.translations"
        field="name"
        :label="t('common.name')"
        :languages="languages"
        required
      />

      <TranslationFields
        id-prefix="item-details"
        v-model:base-value="itemForm.details"
        v-model:translations="itemForm.translations"
        field="details"
        :label="t('pages.items.description')"
        :languages="languages"
        multiline
        :rows="4"
      />

      <ImageUploadField
        v-model="itemForm.imagePath"
        entity-type="items"
        :entity-id="isEditing ? routeId : null"
        :entity-name="imageEntityName"
        :label="t('media.image')"
        :current-image="currentImage"
        :history="imageHistory"
        :disabled="busy"
        :allow-upload="canUploadImage"
        @selected="handleImageSelected"
        @uploaded="handleImageUploaded"
        @error="message = $event"
      />

      <div class="field">
        <label for="item-base-price">{{ t('pages.items.basePrice') }}</label>
        <input id="item-base-price" v-model="itemForm.basePrice" type="number" min="0" step="1" inputmode="numeric" />
      </div>

      <div class="field">
        <label for="item-category">{{ t('pages.items.category') }}</label>
        <TagsSelect
          id="item-category"
          v-model="itemForm.categoryId"
          :options="options.itemCategories"
          :multiple="false"
          :placeholder="t('common.select')"
          :search-placeholder="t('pages.items.searchCategory')"
        />
      </div>

      <div class="field">
        <label for="item-usage">{{ t('pages.items.usage') }}</label>
        <TagsSelect
          id="item-usage"
          v-model="itemForm.usageId"
          :options="options.itemUsages"
          :multiple="false"
          clearable
          :placeholder="t('common.none')"
          :search-placeholder="t('pages.items.searchUsage')"
        />
      </div>

      <div class="check-row">
        <label><input v-model="itemForm.dyeable" type="checkbox" /> {{ t('pages.items.dyeable') }}</label>
        <label><input v-model="itemForm.dualDyeable" type="checkbox" /> {{ t('pages.items.dualDyeable') }}</label>
        <label><input v-model="itemForm.patternEditable" type="checkbox" /> {{ t('pages.items.patternEditable') }}</label>
        <label><input v-model="itemForm.noRecipe" type="checkbox" :disabled="hasRecipe" /> {{ t('pages.items.noRecipe') }}</label>
        <label><input v-model="itemForm.isEventItem" type="checkbox" :disabled="isEventCreate" /> {{ t('pages.items.eventItem') }}</label>
      </div>

      <div class="field">
        <label for="item-methods">{{ t('pages.items.acquisitionMethods') }}</label>
        <TagsSelect
          id="item-methods"
          v-model="itemForm.acquisitionMethodIds"
          :options="options.acquisitionMethods"
          :allow-create="canCreateConfig"
          :creating="creatingSelect === 'item-methods'"
          :placeholder="t('pages.items.searchMethods')"
          @create="createMultiOption('item-methods', 'acquisition-methods', $event, itemForm.acquisitionMethodIds)"
        />
      </div>

      <div class="field">
        <label for="item-tags">{{ t('pages.items.tags') }}</label>
        <TagsSelect
          id="item-tags"
          v-model="itemForm.tagIds"
          :options="options.itemTags"
          :allow-create="canCreateConfig"
          :creating="creatingSelect === 'item-tags'"
          :placeholder="t('pages.items.searchTags')"
          @create="createMultiOption('item-tags', 'favorite-things', $event, itemForm.tagIds)"
        />
      </div>
    </form>

    <section v-else class="modal-edit-form skeleton-detail-section" aria-busy="true" :aria-label="t('pages.items.loadingEdit')">
      <div v-for="index in 6" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '88px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>

    <template v-if="!loading && options" #footer>
      <button type="submit" form="item-edit-form" class="link-button" :disabled="busy">
        <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
        {{ busy ? t('common.saving') : t('common.save') }}
      </button>
      <button type="button" class="plain-button" :disabled="busy" @click="closeEditor">
        <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
        {{ t('common.cancel') }}
      </button>
    </template>
  </Modal>
</template>
