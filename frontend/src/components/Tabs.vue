<script setup lang="ts">
import { computed, nextTick, type ComponentPublicInstance } from 'vue';

export type TabOption = {
  value: string;
  label: string;
};

const props = defineProps<{
  id: string;
  modelValue: string;
  tabs: TabOption[];
  label: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const buttonRefs = new Map<string, HTMLButtonElement>();
const selectedIndex = computed(() => Math.max(0, props.tabs.findIndex((item) => item.value === props.modelValue)));

function setButtonRef(value: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLButtonElement) {
    buttonRefs.set(value, element);
  } else {
    buttonRefs.delete(value);
  }
}

function assignButtonRef(value: string) {
  return (element: Element | ComponentPublicInstance | null) => setButtonRef(value, element);
}

function selectTab(value: string) {
  if (value !== props.modelValue) {
    emit('update:modelValue', value);
  }
}

async function moveToIndex(index: number) {
  const item = props.tabs[index];
  if (!item) return;

  emit('update:modelValue', item.value);
  await nextTick();
  buttonRefs.get(item.value)?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (!props.tabs.length) return;

  let nextIndex = selectedIndex.value;
  if (event.key === 'ArrowLeft') {
    nextIndex = (selectedIndex.value - 1 + props.tabs.length) % props.tabs.length;
  } else if (event.key === 'ArrowRight') {
    nextIndex = (selectedIndex.value + 1) % props.tabs.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = props.tabs.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  void moveToIndex(nextIndex);
}
</script>

<template>
  <div class="tabs tabs--component">
    <div class="tab-list" role="tablist" :aria-label="label" @keydown="onKeydown">
      <button
        v-for="item in tabs"
        :id="`${id}-${item.value}-tab`"
        :key="item.value"
        :ref="assignButtonRef(item.value)"
        class="tab-button"
        role="tab"
        type="button"
        :aria-selected="modelValue === item.value"
        :tabindex="modelValue === item.value ? 0 : -1"
        @click="selectTab(item.value)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
