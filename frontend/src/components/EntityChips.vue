<script setup lang="ts">
import type { NamedEntity } from '../services/api';

defineProps<{
  items: Array<NamedEntity & { subcategory?: string | null; quantity?: number }>;
}>();
</script>

<template>
  <div class="chips">
    <span v-for="item in items" :key="`${item.id}-${item.name}`" class="chip">
      {{ item.name }}<span v-if="item.subcategory"> · {{ item.subcategory }}</span
      ><span v-if="item.quantity"> × {{ item.quantity }}</span>
    </span>
  </div>
</template>
