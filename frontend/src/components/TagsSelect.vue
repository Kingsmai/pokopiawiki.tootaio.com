<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

export type TagsSelectOption = {
  id: number | string;
  name: string;
  label?: string;
};

type OptionRow = {
  value: string;
  label: string;
  id: string;
};

type CandidateRow = { type: 'option'; id: string; value: string; label: string } | { type: 'create'; id: string };

const props = withDefaults(
  defineProps<{
    id: string;
    modelValue: string[] | string;
    options: TagsSelectOption[];
    multiple?: boolean;
    max?: number;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    allowCreate?: boolean;
    creating?: boolean;
    createLabel?: string;
  }>(),
  {
    multiple: true,
    max: 0,
    allowCreate: false,
    creating: false
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string[] | string];
  create: [name: string];
}>();

const { t } = useI18n();
const root = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const search = ref('');
const activeIndex = ref(-1);

const optionRows = computed(() =>
  props.options.map((option, index) => ({
    value: String(option.id),
    label: option.label ?? option.name,
    id: `${props.id}-option-${index}`
  }))
);

const modelValues = computed(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue;
  return props.modelValue ? [props.modelValue] : [];
});
const selectedValues = computed(() => new Set(modelValues.value));
const maxReached = computed(() => props.multiple && props.max > 0 && modelValues.value.length >= props.max);

const selectedRows = computed(() =>
  modelValues.value
    .map((value) => optionRows.value.find((option) => option.value === value))
    .filter((option) => option !== undefined)
);
const selectedLabel = computed(() => selectedRows.value[0]?.label ?? '');

const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return optionRows.value;
  return optionRows.value.filter((option) => option.label.toLowerCase().includes(keyword));
});
const createName = computed(() => search.value.trim());
const hasExactMatch = computed(() => {
  const keyword = createName.value.toLowerCase();
  return optionRows.value.some((option) => option.label.toLowerCase() === keyword);
});
const canCreate = computed(() => props.allowCreate && createName.value !== '' && !hasExactMatch.value && !maxReached.value);
const placeholderText = computed(() => props.placeholder ?? t('common.searchOrSelect'));
const searchPlaceholderText = computed(() => props.searchPlaceholder ?? t('common.search'));
const emptyTextValue = computed(() => props.emptyText ?? t('common.noMatches'));
const createText = computed(() => props.createLabel?.replace('{name}', createName.value) ?? t('common.createNamed', { name: createName.value }));
const optionsListId = computed(() => `${props.id}-options`);
const createOptionId = computed(() => `${props.id}-create`);
const candidateRows = computed<CandidateRow[]>(() => {
  const rows: CandidateRow[] = filteredRows.value
    .filter((option) => isSearchSelectable(option.value))
    .map((option) => ({ type: 'option', id: option.id, value: option.value, label: option.label }));

  if (canCreate.value) {
    rows.push({ type: 'create', id: createOptionId.value });
  }

  return rows;
});
const activeCandidate = computed(() => candidateRows.value[activeIndex.value]);
const activeDescendant = computed(() => activeCandidate.value?.id);

function setDefaultActiveIndex() {
  const keyword = createName.value.toLowerCase();
  const exactIndex = keyword
    ? candidateRows.value.findIndex((candidate) => candidate.type === 'option' && candidate.label.toLowerCase() === keyword)
    : -1;
  activeIndex.value = exactIndex >= 0 ? exactIndex : candidateRows.value.length ? 0 : -1;
}

function clampActiveIndex() {
  if (!candidateRows.value.length) {
    activeIndex.value = -1;
    return;
  }

  if (activeIndex.value < 0) {
    activeIndex.value = 0;
    return;
  }

  activeIndex.value = Math.min(activeIndex.value, candidateRows.value.length - 1);
}

async function openDropdown() {
  isOpen.value = true;
  await nextTick();
  setDefaultActiveIndex();
  searchInput.value?.focus();
}

function closeDropdown() {
  isOpen.value = false;
  search.value = '';
  activeIndex.value = -1;
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown();
  } else {
    void openDropdown();
  }
}

function updateValue(values: string[]) {
  emit('update:modelValue', props.multiple ? values : (values[0] ?? ''));
}

function selectOption(value: string) {
  if (!props.multiple) {
    updateValue([value]);
    closeDropdown();
    return;
  }

  if (selectedValues.value.has(value)) {
    updateValue(modelValues.value.filter((item) => item !== value));
    return;
  }

  if (!maxReached.value) {
    updateValue([...modelValues.value, value]);
    search.value = '';
    setDefaultActiveIndex();
  }
}

function remove(value: string) {
  updateValue(modelValues.value.filter((item) => item !== value));
}

function createOption() {
  if (!canCreate.value || props.creating) return;
  emit('create', createName.value);
  search.value = '';
}

function isSearchSelectable(value: string) {
  return !props.multiple || (!selectedValues.value.has(value) && !maxReached.value);
}

function isActiveOption(option: OptionRow) {
  const candidate = activeCandidate.value;
  return candidate?.type === 'option' && candidate.value === option.value;
}

function isCreateActive() {
  return activeCandidate.value?.type === 'create';
}

function moveActive(delta: number) {
  if (!candidateRows.value.length) return;
  const nextIndex = activeIndex.value < 0 ? 0 : activeIndex.value + delta;
  activeIndex.value = (nextIndex + candidateRows.value.length) % candidateRows.value.length;
}

function commitSearch() {
  const candidate = activeCandidate.value;
  if (candidate?.type === 'option') {
    selectOption(candidate.value);
    return;
  }

  if (candidate?.type === 'create') {
    createOption();
  }
}

function onRootKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    event.stopPropagation();
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

watch(search, setDefaultActiveIndex);
watch(candidateRows, clampActiveIndex);
</script>

<template>
  <div ref="root" class="tags-select" :class="{ 'tags-select--single': !multiple }" @keydown="onRootKeydown">
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
        <template v-if="multiple">
          <span v-for="option in selectedRows" :key="option.value" class="tags-select__tag">
            <span>{{ option.label }}</span>
            <span
              class="tags-select__remove"
              role="button"
              tabindex="0"
              :aria-label="t('common.removeNamed', { name: option.label })"
              @click.stop="remove(option.value)"
              @keydown.enter.stop.prevent="remove(option.value)"
              @keydown.space.stop.prevent="remove(option.value)"
            >
              ×
            </span>
          </span>
        </template>
        <span v-else class="tags-select__single-value">{{ selectedLabel }}</span>
      </span>
      <span v-else class="tags-select__placeholder">{{ placeholderText }}</span>
      <span class="tags-select__arrow" aria-hidden="true">⌄</span>
    </button>

    <div v-if="isOpen" class="tags-select__dropdown">
      <input
        ref="searchInput"
        v-model="search"
        class="tags-select__search"
        type="search"
        :placeholder="searchPlaceholderText"
        :aria-activedescendant="activeDescendant"
        :aria-controls="optionsListId"
        aria-autocomplete="list"
        role="combobox"
        @keydown.enter.stop.prevent="commitSearch"
        @keydown.down.stop.prevent="moveActive(1)"
        @keydown.up.stop.prevent="moveActive(-1)"
      />

      <div :id="optionsListId" class="tags-select__options" role="listbox" :aria-multiselectable="multiple ? 'true' : undefined">
        <button
          v-for="option in filteredRows"
          :key="option.value"
          type="button"
          class="tags-select__option"
          :id="option.id"
          :class="{ selected: selectedValues.has(option.value), active: isActiveOption(option) }"
          role="option"
          :aria-selected="selectedValues.has(option.value)"
          :disabled="!selectedValues.has(option.value) && maxReached"
          @click="selectOption(option.value)"
        >
          <span>{{ option.label }}</span>
          <span v-if="selectedValues.has(option.value)" class="tags-select__state">{{ t('common.selected') }}</span>
        </button>
        <button
          v-if="canCreate"
          type="button"
          class="tags-select__option tags-select__create"
          :id="createOptionId"
          :class="{ active: isCreateActive() }"
          :disabled="creating"
          @click="createOption"
        >
          <span>{{ createText }}</span>
          <span v-if="creating" class="tags-select__state">{{ t('common.creating') }}</span>
        </button>
        <p v-if="!filteredRows.length && !canCreate" class="tags-select__empty">{{ emptyTextValue }}</p>
      </div>
    </div>
  </div>
</template>
