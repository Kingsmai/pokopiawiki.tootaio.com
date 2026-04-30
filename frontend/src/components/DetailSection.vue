<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <section class="detail-section">
    <div class="detail-section__header">
      <h2>{{ title }}</h2>
      <slot name="actions"></slot>
    </div>
    <div class="detail-section__body">
      <slot></slot>
    </div>
  </section>
</template>
