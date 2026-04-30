<script setup lang="ts">
import type { EditInfo } from '../services/api';

defineProps<{
  entity: EditInfo;
}>();

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
</script>

<template>
  <p class="edit-meta">
    最后编辑：{{ entity.updatedBy?.displayName ?? '系统' }} / {{ formatDateTime(entity.updatedAt) }}
  </p>
</template>
