<script setup lang="ts" generic="T">
import { ref, shallowRef } from 'vue';

const props = withDefaults(defineProps<{
  items: T[];
  itemKey: (item: T) => string | number;
  itemLabel: (item: T) => string;
  disabled?: boolean;
  handleLabel: (name: string) => string;
  handleTitle: string;
}>(), {
  disabled: false
});

const emit = defineEmits<{
  reorder: [items: T[], originalItems: T[]];
  preview: [items: T[]];
  cancel: [items: T[]];
}>();

const draggingKey = ref<string | number | null>(null);
const dropTargetKey = ref<string | number | null>(null);
const insertAfterTarget = ref(false);
const sourceItems = shallowRef<T[]>([]);
const dropCommitted = ref(false);

function keyFor(item: T): string | number {
  return props.itemKey(item);
}

function sameKey(first: string | number, second: string | number): boolean {
  return String(first) === String(second);
}

function reorderedItems(items: T[], draggedKeyValue: string | number, targetKeyValue: string | number, insertAfter: boolean): T[] {
  if (sameKey(draggedKeyValue, targetKeyValue)) {
    return items;
  }

  const draggedItem = items.find((item) => sameKey(keyFor(item), draggedKeyValue));
  if (!draggedItem) {
    return items;
  }

  const nextItems = items.filter((item) => !sameKey(keyFor(item), draggedKeyValue));
  const targetIndex = nextItems.findIndex((item) => sameKey(keyFor(item), targetKeyValue));
  if (targetIndex < 0) {
    return items;
  }

  nextItems.splice(targetIndex + (insertAfter ? 1 : 0), 0, draggedItem);
  return nextItems;
}

function hasOrderChanged(currentItems: T[], nextItems: T[]): boolean {
  return currentItems.length !== nextItems.length || currentItems.some((item, index) => !sameKey(keyFor(item), keyFor(nextItems[index])));
}

function clearDragState() {
  draggingKey.value = null;
  dropTargetKey.value = null;
  insertAfterTarget.value = false;
  sourceItems.value = [];
  dropCommitted.value = false;
}

function startDrag(item: T, event: Event) {
  if (props.disabled) {
    return;
  }

  const key = keyFor(item);
  draggingKey.value = key;
  sourceItems.value = [...props.items];
  dropCommitted.value = false;

  const dragEvent = event instanceof DragEvent ? event : null;
  dragEvent?.dataTransfer?.setData('text/plain', String(key));
  if (dragEvent?.dataTransfer) {
    dragEvent.dataTransfer.effectAllowed = 'move';
    dragEvent.dataTransfer.dropEffect = 'move';
  }
}

function endDrag() {
  if (draggingKey.value !== null && !dropCommitted.value && sourceItems.value.length) {
    emit('cancel', [...sourceItems.value]);
  }

  clearDragState();
}

function previewDrop(targetItem: T, event: Event) {
  if (props.disabled) {
    return;
  }

  const dragEvent = event instanceof DragEvent ? event : null;
  const draggedKey = draggingKey.value ?? dragEvent?.dataTransfer?.getData('text/plain');
  const targetKey = keyFor(targetItem);
  if (draggedKey === null || draggedKey === undefined || draggedKey === '') {
    return;
  }

  if (sameKey(draggedKey, targetKey)) {
    dropTargetKey.value = null;
    insertAfterTarget.value = false;
    return;
  }

  if (dragEvent?.dataTransfer) {
    dragEvent.dataTransfer.dropEffect = 'move';
  }

  const targetElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const insertAfter = targetElement
    ? (dragEvent?.clientY ?? 0) > targetElement.getBoundingClientRect().top + targetElement.getBoundingClientRect().height / 2
    : false;

  dropTargetKey.value = targetKey;
  insertAfterTarget.value = insertAfter;

  const nextItems = reorderedItems(props.items, draggedKey, targetKey, insertAfter);
  if (hasOrderChanged(props.items, nextItems)) {
    emit('preview', nextItems);
  }
}

function dropItem(targetItem: T, event: Event) {
  if (props.disabled || draggingKey.value === null) {
    endDrag();
    return;
  }

  previewDrop(targetItem, event);

  const nextItems = [...props.items];
  const originalItems = sourceItems.value.length ? [...sourceItems.value] : nextItems;
  dropCommitted.value = true;
  clearDragState();

  if (!hasOrderChanged(originalItems, nextItems)) {
    return;
  }

  emit('reorder', nextItems, originalItems);
}

function moveByKeyboard(item: T, offset: -1 | 1) {
  if (props.disabled) {
    return;
  }

  const key = keyFor(item);
  const currentIndex = props.items.findIndex((row) => sameKey(keyFor(row), key));
  const targetIndex = currentIndex + offset;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= props.items.length) {
    return;
  }

  const nextItems = [...props.items];
  const [movedItem] = nextItems.splice(currentIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  emit('reorder', nextItems, [...props.items]);
}

function handleKeydown(item: T, event: KeyboardEvent) {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveByKeyboard(item, -1);
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveByKeyboard(item, 1);
  }
}
</script>

<template>
  <TransitionGroup name="reorderable-list" tag="ul" class="row-list reorderable-list">
    <li
      v-for="item in items"
      :key="keyFor(item)"
      class="reorderable-row"
      :class="{
        'is-dragging': draggingKey === keyFor(item),
        'is-drop-target': dropTargetKey === keyFor(item),
        'is-drop-after': dropTargetKey === keyFor(item) && insertAfterTarget,
        'is-drop-before': dropTargetKey === keyFor(item) && !insertAfterTarget
      }"
      @dragover.prevent="previewDrop(item, $event)"
      @drop.prevent="dropItem(item, $event)"
    >
      <button
        type="button"
        class="drag-handle"
        draggable="true"
        :aria-label="handleLabel(itemLabel(item))"
        :title="handleTitle"
        :disabled="disabled"
        @dragstart="startDrag(item, $event)"
        @dragend="endDrag"
        @keydown="handleKeydown(item, $event)"
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
      <slot :item="item" />
    </li>
  </TransitionGroup>
</template>
