<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section class="filter-panel" :aria-label="t('common.filters')">
    <slot></slot>
  </section>
</template>
