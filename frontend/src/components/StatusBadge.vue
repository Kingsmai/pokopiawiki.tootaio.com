<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
    compact?: boolean;
  }>(),
  {
    tone: 'info',
    compact: false
  }
);
</script>

<template>
  <span class="status-badge" :class="[`status-badge--${tone}`, { 'status-badge--compact': compact }]">
    <span class="status-badge__dot" aria-hidden="true"></span>
    <span class="status-badge__label">{{ label }}</span>
  </span>
</template>
