<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { iconError, iconInfo, iconSuccess, iconWarning } from '../icons';

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
const statusIcon = computed(() => {
  if (props.variant === 'success') return iconSuccess;
  if (props.variant === 'warning') return iconWarning;
  if (props.variant === 'danger') return iconError;
  return iconInfo;
});

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
    <Icon :icon="statusIcon" class="status-message__icon" aria-hidden="true" />
    <slot></slot>
  </p>
</template>
