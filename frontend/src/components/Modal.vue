<script lang="ts">
let openModalCount = 0;
</script>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { nextTick, onBeforeUnmount, onMounted, onUpdated, ref, watch } from 'vue';
import { iconClose } from '../icons';

const props = withDefaults(
  defineProps<{
    open?: boolean;
    title: string;
    subtitle?: string;
    closeLabel: string;
    size?: 'default' | 'wide';
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
  }>(),
  {
    open: true,
    size: 'default',
    closeOnBackdrop: true,
    closeOnEscape: true
  }
);

const emit = defineEmits<{
  close: [];
}>();

const titleId = `modal-title-${Math.random().toString(36).slice(2)}`;
const dialog = ref<HTMLElement | null>(null);
const modalBody = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const previousActiveElement = ref<HTMLElement | null>(null);
const focusedBodyControl = ref(false);
let bodyObserver: MutationObserver | null = null;

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');
const bodyInputSelector = [
  '[autofocus]',
  'input:not([disabled]):not([readonly]):not([type="hidden"])',
  'textarea:not([disabled]):not([readonly])',
  'select:not([disabled])'
].join(',');
const bodyFallbackSelector = [
  '.tags-select__trigger:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function lockPage() {
  openModalCount += 1;
  document.body.classList.add('lock-scroll');
}

function unlockPage() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.body.classList.remove('lock-scroll');
  }
}

function restoreFocus() {
  const target = previousActiveElement.value;
  if (target?.isConnected) {
    target.focus();
  }
}

function stopBodyObserver() {
  bodyObserver?.disconnect();
  bodyObserver = null;
}

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

function firstVisibleElement(root: HTMLElement, selector: string) {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).find(isVisible);
}

function firstBodyControl() {
  const body = modalBody.value;
  if (!body) return undefined;

  return firstVisibleElement(body, bodyInputSelector) ?? firstVisibleElement(body, bodyFallbackSelector);
}

function shouldMoveFocusIntoBody() {
  const activeElement = document.activeElement;
  return activeElement === closeButton.value || activeElement === dialog.value || activeElement === document.body;
}

function watchBodyForControls() {
  stopBodyObserver();
  if (!modalBody.value) return;

  bodyObserver = new MutationObserver(() => {
    if (!props.open || focusedBodyControl.value || !shouldMoveFocusIntoBody()) return;
    focusFirstControl();
  });
  bodyObserver.observe(modalBody.value, { childList: true, subtree: true });
}

function focusFirstControl() {
  void nextTick(() => {
    const target = firstBodyControl();
    if (target) {
      target.focus();
      focusedBodyControl.value = true;
      stopBodyObserver();
      return;
    }

    watchBodyForControls();
    closeButton.value?.focus();
  });
}

function handleOpen() {
  previousActiveElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  focusedBodyControl.value = false;
  lockPage();
  focusFirstControl();
}

function handleClose() {
  stopBodyObserver();
  unlockPage();
  restoreFocus();
}

function requestClose() {
  emit('close');
}

function onBackdropClick(event: MouseEvent) {
  if (props.closeOnBackdrop && event.target === event.currentTarget) {
    requestClose();
  }
}

function focusableElements() {
  return Array.from(dialog.value?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter(isVisible);
}

function keepFocusInside(event: KeyboardEvent) {
  const elements = focusableElements();
  if (!elements.length) {
    event.preventDefault();
    dialog.value?.focus();
    return;
  }

  const first = elements[0];
  const last = elements[elements.length - 1];
  const current = document.activeElement;

  if (event.shiftKey && current === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (!props.open) return;

  if (event.key === 'Escape' && props.closeOnEscape) {
    event.preventDefault();
    requestClose();
    return;
  }

  if (event.key === 'Tab') {
    keepFocusInside(event);
  }
}

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown);
  if (props.open) {
    handleOpen();
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown);
  stopBodyObserver();
  if (props.open) {
    handleClose();
  }
});

onUpdated(() => {
  if (!props.open || focusedBodyControl.value) return;

  if (shouldMoveFocusIntoBody()) {
    focusFirstControl();
  }
});

watch(
  () => props.open,
  (open, wasOpen) => {
    if (open && !wasOpen) {
      handleOpen();
    }

    if (!open && wasOpen) {
      handleClose();
    }
  }
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop is-open" role="presentation" @click="onBackdropClick">
      <section
        ref="dialog"
        class="modal"
        :class="{ 'modal--wide': size === 'wide' }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <div class="modal-header">
          <div class="modal-header__copy">
            <h2 :id="titleId">{{ title }}</h2>
            <p v-if="subtitle">{{ subtitle }}</p>
          </div>
          <button ref="closeButton" class="modal-close-button" type="button" :aria-label="closeLabel" @click="requestClose">
            <Icon :icon="iconClose" class="ui-icon" aria-hidden="true" />
          </button>
        </div>

        <div ref="modalBody" class="modal-body">
          <slot></slot>
        </div>

        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer"></slot>
        </div>
      </section>
    </div>
  </Teleport>
</template>
