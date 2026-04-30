<script setup lang="ts">
export type SwitchGroupOption = {
  value: string;
  label: string;
};

const props = defineProps<{
  id: string;
  label: string;
  modelValue: string[];
  options: SwitchGroupOption[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

function optionId(index: number) {
  return `${props.id}-${index}`;
}

function isSelected(value: string) {
  return props.modelValue.includes(value);
}

function updateOption(value: string, event: Event) {
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
    <div class="switch-group__options">
      <label v-for="(option, index) in options" :key="option.value" class="switch-control switch-control--stacked">
        <span class="switch-control__label">{{ option.label }}</span>
        <input
          :id="optionId(index)"
          type="checkbox"
          :checked="isSelected(option.value)"
          :value="option.value"
          @change="updateOption(option.value, $event)"
        />
        <span class="switch-track" aria-hidden="true"></span>
      </label>
    </div>
  </fieldset>
</template>
