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
  type AncientArtifactPayload,
  type AuthUser,
  type ConfigType,
  type EntityImage,
  type EntityImageUpload,
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
const artifactForm = ref({
  name: '',
  details: '',
  translations: {} as TranslationMap,
  categoryId: '',
  tagIds: [] as string[],
  imagePath: ''
});

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const pageTitle = computed(() =>
  isEditing.value
    ? t('pages.ancientArtifacts.editTitle', { name: artifactForm.value.name || t('pages.ancientArtifacts.fallbackName') })
    : t('pages.ancientArtifacts.newTitle')
);
const cancelTo = computed(() => (isEditing.value ? `/ancient-artifacts/${routeId.value}` : '/ancient-artifacts'));
const canCreateConfig = computed(() => currentUser.value?.permissions.includes('admin.config.create') === true);
const canUploadImage = computed(() => currentUser.value?.permissions.includes('ancient-artifacts.upload') === true);
const imageEntityName = computed(() => artifactNameForSave().trim());

function toIds(values: string[]): number[] {
  return values.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function closeEditor() {
  void router.push(cancelTo.value);
}

function artifactNameForSave() {
  const baseName = artifactForm.value.name.trim();
  if (baseName !== '') {
    return artifactForm.value.name;
  }

  return artifactForm.value.translations[String(locale.value || '')]?.name ?? '';
}

async function loadEditor() {
  loading.value = true;
  message.value = '';

  try {
    const [loadedOptions, loadedLanguages] = await Promise.all([api.options(), api.languages()]);
    options.value = loadedOptions;
    languages.value = loadedLanguages;

    if (getAuthToken()) {
      try {
        currentUser.value = (await api.me()).user;
      } catch {
        currentUser.value = null;
      }
    }

    if (isEditing.value) {
      const artifact = await api.ancientArtifactDetail(routeId.value);
      artifactForm.value = {
        name: artifact.baseName ?? artifact.name,
        details: artifact.baseDetails ?? artifact.details,
        translations: artifact.translations ?? {},
        categoryId: String(artifact.category.id),
        tagIds: artifact.tags.map((tag) => String(tag.id)),
        imagePath: artifact.image?.path ?? ''
      };
      currentImage.value = artifact.image;
      imageHistory.value = artifact.imageHistory;
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
    options.value = await api.options();
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

async function saveArtifact() {
  busy.value = true;
  message.value = '';

  try {
    const payload: AncientArtifactPayload = {
      name: artifactNameForSave(),
      details: artifactForm.value.details,
      translations: artifactForm.value.translations,
      categoryId: Number(artifactForm.value.categoryId),
      tagIds: toIds(artifactForm.value.tagIds),
      imagePath: artifactForm.value.imagePath
    };
    const saved = isEditing.value
      ? await api.updateAncientArtifact(routeId.value, payload)
      : await api.createAncientArtifact(payload);
    await router.push(`/ancient-artifacts/${saved.id}`);
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
  <Modal :title="pageTitle" :subtitle="t('pages.ancientArtifacts.editSubtitle')" :close-label="t('common.close')" size="wide" @close="closeEditor">
    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" id="artifact-edit-form" class="modal-edit-form" @submit.prevent="saveArtifact">
      <TranslationFields
        id-prefix="artifact-name"
        v-model:base-value="artifactForm.name"
        v-model:translations="artifactForm.translations"
        field="name"
        :label="t('common.name')"
        :languages="languages"
        required
      />

      <TranslationFields
        id-prefix="artifact-details"
        v-model:base-value="artifactForm.details"
        v-model:translations="artifactForm.translations"
        field="details"
        :label="t('pages.ancientArtifacts.description')"
        :languages="languages"
        multiline
        :rows="4"
      />

      <div class="field">
        <label for="artifact-category">{{ t('pages.ancientArtifacts.category') }}</label>
        <TagsSelect
          id="artifact-category"
          v-model="artifactForm.categoryId"
          :options="options.ancientArtifactCategories"
          :multiple="false"
          :placeholder="t('common.select')"
          :search-placeholder="t('pages.ancientArtifacts.searchCategory')"
        />
      </div>

      <ImageUploadField
        v-model="artifactForm.imagePath"
        entity-type="ancient-artifacts"
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
        <label for="artifact-tags">{{ t('pages.ancientArtifacts.tags') }}</label>
        <TagsSelect
          id="artifact-tags"
          v-model="artifactForm.tagIds"
          :options="options.itemTags"
          :allow-create="canCreateConfig"
          :creating="creatingSelect === 'artifact-tags'"
          :placeholder="t('pages.ancientArtifacts.searchTags')"
          @create="createMultiOption('artifact-tags', 'favorite-things', $event, artifactForm.tagIds)"
        />
      </div>
    </form>
    <section v-else class="modal-edit-form skeleton-detail-section" aria-busy="true" :aria-label="t('pages.ancientArtifacts.loadingEdit')">
      <Skeleton width="160px" />
      <Skeleton variant="box" height="44px" />
      <Skeleton width="140px" />
      <Skeleton variant="box" height="120px" />
      <Skeleton width="120px" />
      <Skeleton variant="box" height="44px" />
    </section>

    <template #footer>
      <button type="button" class="ui-button ui-button--ghost" @click="closeEditor">
        <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
        {{ t('common.cancel') }}
      </button>
      <button type="submit" form="artifact-edit-form" class="ui-button ui-button--primary" :disabled="busy || loading">
        <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
        {{ busy ? t('common.saving') : t('common.save') }}
      </button>
    </template>
  </Modal>
</template>
