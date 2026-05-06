<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { EditInfo } from '../services/api';

withDefaults(
  defineProps<{
    entity: EditInfo;
    showLabel?: boolean;
  }>(),
  {
    showLabel: true
  }
);

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
    <template v-if="showLabel">{{ t('history.lastEdited') }}: </template>
    <RouterLink v-if="entity.updatedBy" class="user-profile-link" :to="`/profile/${entity.updatedBy.id}`">
      {{ entity.updatedBy.displayName }}
    </RouterLink>
    <span v-else>{{ t('common.system') }}</span>
    / <time :datetime="entity.updatedAt">{{ formatDateTime(entity.updatedAt) }}</time>
  </p>
</template>
