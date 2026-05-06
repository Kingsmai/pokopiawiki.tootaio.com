<script setup lang="ts">
export type SwitchGroupOption = {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
};

const props = defineProps<{
  id: string;
  label: string;
  modelValue: Array<string | number>;
  options: SwitchGroupOption[];
  layout?: 'inline' | 'grid';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Array<string | number>];
}>();

function optionId(index: number) {
  return `${props.id}-${index}`;
}

function isSelected(value: string | number) {
  return props.modelValue.includes(value);
}

function updateOption(value: string | number, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return;

  const { checked } = event.target;

  if (checked) {
    emit('update:modelValue', isSelected(value) ? props.modelValue : [...props.modelValue, value]);
    return;
  }

  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== value)
  );
}
</script>

<template>
  <fieldset class="switch-group">
    <legend>{{ label }}</legend>
    <div class="switch-group__options" :class="{ 'switch-group__options--grid': layout === 'grid' }">
      <label
        v-for="(option, index) in options"
        :key="option.value"
        class="switch-control switch-control--stacked"
        :class="{ 'switch-control--disabled': option.disabled }"
      >
        <span class="switch-control__copy">
          <span class="switch-control__label">{{ option.label }}</span>
          <span v-if="option.description" class="switch-control__description">{{ option.description }}</span>
        </span>
        <input
          :id="optionId(index)"
          type="checkbox"
          :checked="isSelected(option.value)"
          :value="option.value"
          :disabled="option.disabled"
          @change="updateOption(option.value, $event)"
        />
        <span class="switch-track" aria-hidden="true"></span>
      </label>
    </div>
  </fieldset>
</template>
