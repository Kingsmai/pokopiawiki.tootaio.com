<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

export type TagsSelectOption = {
  id: number | string;
  name: string;
  subcategory?: string | null;
};

const props = withDefaults(
  defineProps<{
    id: string;
    modelValue: string[];
    options: TagsSelectOption[];
    max?: number;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
  }>(),
  {
    max: 0,
    placeholder: '搜索或选择',
    searchPlaceholder: '搜索',
    emptyText: '没有匹配项'
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const root = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const search = ref('');

const optionRows = computed(() =>
  props.options.map((option) => ({
    value: String(option.id),
    label: option.subcategory ? `${option.name} · ${option.subcategory}` : option.name
  }))
);

const selectedValues = computed(() => new Set(props.modelValue));
const maxReached = computed(() => props.max > 0 && props.modelValue.length >= props.max);

const selectedRows = computed(() =>
  props.modelValue
    .map((value) => optionRows.value.find((option) => option.value === value))
    .filter((option) => option !== undefined)
);

const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return optionRows.value;
  return optionRows.value.filter((option) => option.label.toLowerCase().includes(keyword));
});

async function openDropdown() {
  isOpen.value = true;
  await nextTick();
  searchInput.value?.focus();
}

function closeDropdown() {
  isOpen.value = false;
  search.value = '';
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown();
  } else {
    void openDropdown();
  }
}

function toggle(value: string) {
  if (selectedValues.value.has(value)) {
    emit(
      'update:modelValue',
      props.modelValue.filter((item) => item !== value)
    );
    return;
  }

  if (!maxReached.value) {
    emit('update:modelValue', [...props.modelValue, value]);
  }
}

function remove(value: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== value)
  );
}

function onRootKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeDropdown();
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
});
</script>

<template>
  <div ref="root" class="tags-select" @keydown="onRootKeydown">
    <button
      :id="id"
      type="button"
      class="tags-select__trigger"
      :class="{ open: isOpen }"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click="toggleDropdown"
    >
      <span v-if="selectedRows.length" class="tags-select__selected">
        <span v-for="option in selectedRows" :key="option.value" class="tags-select__tag">
          <span>{{ option.label }}</span>
          <span
            class="tags-select__remove"
            role="button"
            tabindex="0"
            :aria-label="`移除${option.label}`"
            @click.stop="remove(option.value)"
            @keydown.enter.stop.prevent="remove(option.value)"
            @keydown.space.stop.prevent="remove(option.value)"
          >
            ×
          </span>
        </span>
      </span>
      <span v-else class="tags-select__placeholder">{{ placeholder }}</span>
      <span class="tags-select__arrow" aria-hidden="true">⌄</span>
    </button>

    <div v-if="isOpen" class="tags-select__dropdown">
      <input
        ref="searchInput"
        v-model="search"
        class="tags-select__search"
        type="search"
        :placeholder="searchPlaceholder"
      />

      <div class="tags-select__options" role="listbox" aria-multiselectable="true">
        <button
          v-for="option in filteredRows"
          :key="option.value"
          type="button"
          class="tags-select__option"
          :class="{ selected: selectedValues.has(option.value) }"
          role="option"
          :aria-selected="selectedValues.has(option.value)"
          :disabled="!selectedValues.has(option.value) && maxReached"
          @click="toggle(option.value)"
        >
          <span>{{ option.label }}</span>
          <span v-if="selectedValues.has(option.value)" class="tags-select__state">已选</span>
        </button>
        <p v-if="!filteredRows.length" class="tags-select__empty">{{ emptyText }}</p>
      </div>
    </div>
  </div>
</template>
