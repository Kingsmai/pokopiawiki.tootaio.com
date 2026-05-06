<script setup lang="ts">
import { Icon } from '@iconify/vue';
import Modal from './Modal.vue';
import { iconCancel, iconDelete } from '../icons';

withDefaults(
  defineProps<{
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    closeLabel: string;
    busy?: boolean;
  }>(),
  {
    busy: false
  }
);

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();
</script>

<template>
  <Modal
    :title="title"
    :close-label="closeLabel"
    :close-on-backdrop="!busy"
    :close-on-escape="!busy"
    @close="emit('cancel')"
  >
    <p class="confirm-dialog__message">{{ message }}</p>

    <template #footer>
      <button type="button" class="link-button link-button--danger" :disabled="busy" @click="emit('confirm')">
        <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
        {{ confirmLabel }}
      </button>
      <button type="button" class="plain-button" :disabled="busy" @click="emit('cancel')">
        <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
        {{ cancelLabel }}
      </button>
    </template>
  </Modal>
</template>
