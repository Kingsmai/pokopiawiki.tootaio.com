<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: string;
  }>(),
  {
    size: '34px'
  }
);
</script>

<template>
  <span class="pokeball-mark" :style="{ '--ball-size': size }" aria-hidden="true"></span>
</template>
