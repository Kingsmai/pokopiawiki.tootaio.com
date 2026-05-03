<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { iconCancel, iconImage, iconUpload } from '../icons';
import { api, type EntityImage, type EntityImageUpload, type ImageUploadEntityType } from '../services/api';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    entityType: ImageUploadEntityType;
    entityId?: string | number | null;
    entityName: string;
    label?: string;
    currentImage?: EntityImage | null;
    history?: EntityImageUpload[];
    disabled?: boolean;
    allowUpload?: boolean;
    showPreview?: boolean;
  }>(),
  {
    label: '',
    currentImage: null,
    history: () => [],
    disabled: false,
    allowUpload: true,
    showPreview: true
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  uploaded: [image: EntityImageUpload];
  selected: [image: EntityImage];
  error: [message: string];
}>();

const { t } = useI18n();
const fileInput = ref<HTMLInputElement | null>(null);
const uploadBusy = ref(false);
const localUploads = ref<EntityImageUpload[]>([]);

const imageLabel = computed(() => props.label || t('media.image'));
const uploadDisabled = computed(() => !props.allowUpload || props.disabled || uploadBusy.value || props.entityName.trim() === '');
const imageOptions = computed<EntityImage[]>(() => {
  const images = [
    ...localUploads.value,
    ...(props.history ?? []),
    ...(props.currentImage ? [props.currentImage] : [])
  ];
  const seen = new Set<string>();

  return images.filter((image) => {
    if (!image.path || seen.has(image.path)) {
      return false;
    }
    seen.add(image.path);
    return true;
  });
});
const selectedImage = computed(() => {
  if (!props.modelValue) {
    return null;
  }
  return imageOptions.value.find((image) => image.path === props.modelValue) ?? props.currentImage ?? null;
});

function imageName(image: EntityImage): string {
  const parts = image.path.split('/');
  return parts.at(-1) ?? t('media.image');
}

function openFilePicker() {
  if (!uploadDisabled.value) {
    fileInput.value?.click();
  }
}

function selectImage(image: EntityImage) {
  emit('update:modelValue', image.path);
  emit('selected', image);
}

function clearImage() {
  emit('update:modelValue', '');
}

async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  uploadBusy.value = true;
  try {
    const uploaded = await api.uploadImage(props.entityType, {
      file,
      entityName: props.entityName,
      entityId: props.entityId
    });
    localUploads.value = [uploaded, ...localUploads.value];
    emit('uploaded', uploaded);
    selectImage(uploaded);
  } catch (error) {
    emit('error', error instanceof Error && error.message ? error.message : t('media.uploadFailed'));
  } finally {
    uploadBusy.value = false;
    input.value = '';
  }
}
</script>

<template>
  <section class="image-upload-field field">
    <div class="image-upload-field__header">
      <span class="field-label">{{ imageLabel }}</span>
      <div class="image-upload-field__actions">
        <input
          v-if="allowUpload"
          ref="fileInput"
          class="image-upload-field__input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          :disabled="uploadDisabled"
          @change="uploadImage"
        />
        <button v-if="allowUpload" type="button" class="ui-button ui-button--blue ui-button--small" :disabled="uploadDisabled" @click="openFilePicker">
          <Icon :icon="iconUpload" class="ui-icon" aria-hidden="true" />
          {{ uploadBusy ? t('media.uploading') : t('media.uploadImage') }}
        </button>
        <button v-if="modelValue" type="button" class="plain-button ui-button--small" :disabled="disabled || uploadBusy" @click="clearImage">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('media.clearImage') }}
        </button>
      </div>
    </div>

    <div v-if="showPreview && selectedImage" class="pokemon-image-preview image-upload-field__preview" :aria-label="t('media.selectedImage')">
      <div class="pokemon-image-preview__screen">
        <img :src="selectedImage.url" :alt="t('media.imageAlt', { name: entityName })" />
      </div>
      <div class="pokemon-image-preview__caption">
        <strong>{{ t('media.selectedImage') }}</strong>
        <span>{{ imageName(selectedImage) }}</span>
      </div>
    </div>
    <p v-else-if="showPreview" class="meta-line">{{ t('media.imageEmpty') }}</p>

    <div v-if="imageOptions.length" class="pokemon-image-thumbnails image-upload-field__history" :aria-label="t('media.imageHistory')">
      <button
        v-for="image in imageOptions"
        :key="image.path"
        type="button"
        class="pokemon-image-thumbnail"
        :class="{ active: image.path === modelValue }"
        :aria-pressed="image.path === modelValue"
        :disabled="disabled || uploadBusy"
        @click="selectImage(image)"
      >
        <img :src="image.url" :alt="t('media.imageAlt', { name: entityName })" loading="lazy" />
        <span>{{ imageName(image) }}</span>
      </button>
    </div>
    <p v-else class="meta-line image-upload-field__empty">
      <Icon :icon="iconImage" class="ui-icon" aria-hidden="true" />
      {{ t('media.imageHistoryEmpty') }}
    </p>
  </section>
</template>
