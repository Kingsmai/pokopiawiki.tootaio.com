<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    variant?: 'info' | 'success' | 'warning' | 'danger';
    duration?: number;
  }>(),
  {
    variant: 'info',
    duration: 3800
  }
);

const visible = ref(true);
let timer: number | null = null;

function clearTimer() {
  if (!timer) return;
  window.clearTimeout(timer);
  timer = null;
}

function scheduleDismiss() {
  visible.value = true;
  clearTimer();
  if (props.duration <= 0) return;

  timer = window.setTimeout(() => {
    visible.value = false;
  }, props.duration);
}

onMounted(scheduleDismiss);
onBeforeUnmount(clearTimer);
watch(() => props.duration, scheduleDismiss);
</script>

<template>
  <p class="status-message" :class="[`status-message--${variant}`, { 'status-message--hidden': !visible }]">
    <slot></slot>
  </p>
</template>
