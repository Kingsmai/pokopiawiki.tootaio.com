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
import { api, type ConfigType, type EntityImage, type EntityImageUpload, type ItemPayload, type Language, type Options, type TranslationMap } from '../services/api';

const route = useRoute();
const router = useRouter();
const { locale, t } = useI18n();
const options = ref<Options | null>(null);
const languages = ref<Language[]>([]);
const currentImage = ref<EntityImage | null>(null);
const imageHistory = ref<EntityImageUpload[]>([]);
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const itemForm = ref({
  name: '',
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

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const pageTitle = computed(() =>
  isEditing.value
    ? t('pages.items.editTitle', { name: itemForm.value.name || t('pages.items.fallbackName') })
    : t('pages.items.newTitle')
);
const cancelTo = computed(() => (isEditing.value ? `/items/${routeId.value}` : '/items'));
const hasRecipe = ref(false);
const imageEntityName = computed(() => itemNameForSave().trim());

function toIds(values: string[]): number[] {
  return values.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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

async function loadEditor() {
  loading.value = true;
  message.value = '';

  try {
    await loadOptions();
    if (isEditing.value) {
      const item = await api.itemDetail(routeId.value);
      itemForm.value = {
        name: item.baseName ?? item.name,
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
    }
  } catch (error) {
    message.value = errorText(error, t('errors.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function createSingleOption(selectKey: string, type: ConfigType, name: string, assign: (value: string) => void) {
  const cleanName = name.trim();
  if (!cleanName) return;

  creatingSelect.value = selectKey;
  message.value = '';
  try {
    const created = await api.createConfig(type, { name: cleanName });
    await loadOptions();
    assign(String(created.id));
  } catch (error) {
    message.value = errorText(error, t('errors.addFailed'));
  } finally {
    creatingSelect.value = '';
  }
}

async function createMultiOption(selectKey: string, type: ConfigType, name: string, values: string[]) {
  const cleanName = name.trim();
  if (!cleanName) return;

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

      <ImageUploadField
        v-model="itemForm.imagePath"
        entity-type="items"
        :entity-id="isEditing ? routeId : null"
        :entity-name="imageEntityName"
        :label="t('media.image')"
        :current-image="currentImage"
        :history="imageHistory"
        :disabled="busy"
        @selected="handleImageSelected"
        @uploaded="handleImageUploaded"
        @error="message = $event"
      />

      <div class="field">
        <label for="item-category">{{ t('pages.items.category') }}</label>
        <TagsSelect
          id="item-category"
          v-model="itemForm.categoryId"
          :options="options.itemCategories"
          :multiple="false"
          allow-create
          :creating="creatingSelect === 'item-category'"
          :placeholder="t('common.select')"
          :search-placeholder="t('pages.items.searchCategory')"
          @create="createSingleOption('item-category', 'item-categories', $event, (value) => (itemForm.categoryId = value))"
        />
      </div>

      <div class="field">
        <label for="item-usage">{{ t('pages.items.usage') }}</label>
        <TagsSelect
          id="item-usage"
          v-model="itemForm.usageId"
          :options="options.itemUsages"
          :multiple="false"
          allow-create
          :creating="creatingSelect === 'item-usage'"
          :placeholder="t('common.none')"
          :search-placeholder="t('pages.items.searchUsage')"
          @create="createSingleOption('item-usage', 'item-usages', $event, (value) => (itemForm.usageId = value))"
        />
      </div>

      <div class="check-row">
        <label><input v-model="itemForm.dyeable" type="checkbox" /> {{ t('pages.items.dyeable') }}</label>
        <label><input v-model="itemForm.dualDyeable" type="checkbox" /> {{ t('pages.items.dualDyeable') }}</label>
        <label><input v-model="itemForm.patternEditable" type="checkbox" /> {{ t('pages.items.patternEditable') }}</label>
        <label><input v-model="itemForm.noRecipe" type="checkbox" :disabled="hasRecipe" /> {{ t('pages.items.noRecipe') }}</label>
        <label><input v-model="itemForm.isEventItem" type="checkbox" /> {{ t('pages.items.eventItem') }}</label>
      </div>

      <div class="field">
        <label for="item-methods">{{ t('pages.items.acquisitionMethods') }}</label>
        <TagsSelect
          id="item-methods"
          v-model="itemForm.acquisitionMethodIds"
          :options="options.acquisitionMethods"
          allow-create
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
          allow-create
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
