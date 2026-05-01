<script setup lang="ts">
import { Icon } from '@iconify/vue';
import type { AppIcon } from '../icons';
import PokeBallMark from './PokeBallMark.vue';

defineProps<{
  title: string;
  subtitle?: string;
  to?: string;
  icon?: AppIcon;
  marker?: string;
}>();
</script>

<template>
  <RouterLink v-if="to" class="entity-card entity-card--link" :to="to">
    <span class="entity-card__mark">
      <Icon v-if="icon" :icon="icon" class="entity-card__icon" aria-hidden="true" />
      <PokeBallMark v-else-if="!marker" size="30px" />
      <span v-else>{{ marker }}</span>
    </span>
    <div class="entity-card__content">
      <span class="entity-card__title">{{ title }}</span>
      <span v-if="subtitle" class="entity-card__subtitle">{{ subtitle }}</span>
      <slot></slot>
    </div>
  </RouterLink>

  <article v-else class="entity-card">
    <span class="entity-card__mark">
      <Icon v-if="icon" :icon="icon" class="entity-card__icon" aria-hidden="true" />
      <PokeBallMark v-else-if="!marker" size="30px" />
      <span v-else>{{ marker }}</span>
    </span>
    <div class="entity-card__content">
      <span class="entity-card__title">{{ title }}</span>
      <span v-if="subtitle" class="entity-card__subtitle">{{ subtitle }}</span>
      <slot></slot>
    </div>
  </article>
</template>
