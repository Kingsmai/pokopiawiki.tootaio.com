<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: number;
    max?: number;
    color?: string;
  }>(),
  {
    max: 100,
    color: 'var(--pokemon-blue)'
  }
);

const safeMax = computed(() => (Number.isFinite(props.max) && props.max > 0 ? props.max : 100));
const safeValue = computed(() => (Number.isFinite(props.value) && props.value > 0 ? props.value : 0));
const percentage = computed(() => Math.min(100, Math.round((safeValue.value / safeMax.value) * 100)));
const valueText = computed(() => `${safeValue.value} / ${safeMax.value}`);
</script>

<template>
  <div class="progress" role="meter" :aria-label="label" :aria-valuenow="safeValue" aria-valuemin="0" :aria-valuemax="safeMax">
    <div class="progress-label">
      <span>{{ label }}</span>
      <span>{{ valueText }}</span>
    </div>
    <div class="progress-track">
      <span class="progress-fill" :style="{ width: `${percentage}%`, background: color }"></span>
    </div>
  </div>
</template>
