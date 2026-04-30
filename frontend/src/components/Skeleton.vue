<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'line' | 'box';
    width?: string;
    height?: string;
  }>(),
  {
    variant: 'line',
    width: undefined,
    height: undefined
  }
);
</script>

<template>
  <span
    :class="variant === 'box' ? 'skeleton-box' : 'skeleton-line'"
    :style="{ width, height }"
    aria-hidden="true"
  ></span>
</template>
