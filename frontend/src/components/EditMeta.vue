<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { EditInfo } from '../services/api';

defineProps<{
  entity: EditInfo;
}>();

const { locale, t } = useI18n();

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
</script>

<template>
  <p class="edit-meta">
    {{ t('history.lastEdited') }}:
    <RouterLink v-if="entity.updatedBy" class="user-profile-link" :to="`/profile/${entity.updatedBy.id}`">
      {{ entity.updatedBy.displayName }}
    </RouterLink>
    <span v-else>{{ t('common.system') }}</span>
    / {{ formatDateTime(entity.updatedAt) }}
  </p>
</template>
