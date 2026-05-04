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
  image?: { src: string; alt: string };
  ribbon?: string;
  compactTooltip?: boolean;
}>();
</script>

<template>
  <RouterLink
    v-if="to"
    class="entity-card entity-card--link"
    :class="{ 'entity-card--collection-compact': compactTooltip }"
    :to="to"
    :aria-label="compactTooltip ? title : undefined"
  >
    <span v-if="ribbon" class="entity-card__ribbon-clip" aria-hidden="true">
      <span class="entity-card__ribbon">{{ ribbon }}</span>
    </span>
    <span class="entity-card__mark" :class="{ 'entity-card__mark--image': image }">
      <img v-if="image" class="entity-card__image" :src="image.src" :alt="image.alt" loading="lazy" />
      <Icon v-else-if="icon" :icon="icon" class="entity-card__icon" aria-hidden="true" />
      <PokeBallMark v-else-if="!marker" size="30px" />
      <span v-else>{{ marker }}</span>
    </span>
    <span v-if="compactTooltip" class="entity-card__tooltip" role="tooltip">{{ title }}</span>
    <div class="entity-card__content">
      <span class="entity-card__title">{{ title }}</span>
      <slot name="after-title"></slot>
      <span v-if="subtitle" class="entity-card__subtitle">{{ subtitle }}</span>
      <slot></slot>
    </div>
  </RouterLink>

  <article v-else class="entity-card" :class="{ 'entity-card--collection-compact': compactTooltip }">
    <span v-if="ribbon" class="entity-card__ribbon-clip" aria-hidden="true">
      <span class="entity-card__ribbon">{{ ribbon }}</span>
    </span>
    <span class="entity-card__mark" :class="{ 'entity-card__mark--image': image }">
      <img v-if="image" class="entity-card__image" :src="image.src" :alt="image.alt" loading="lazy" />
      <Icon v-else-if="icon" :icon="icon" class="entity-card__icon" aria-hidden="true" />
      <PokeBallMark v-else-if="!marker" size="30px" />
      <span v-else>{{ marker }}</span>
    </span>
    <span v-if="compactTooltip" class="entity-card__tooltip" role="tooltip">{{ title }}</span>
    <div class="entity-card__content">
      <span class="entity-card__title">{{ title }}</span>
      <slot name="after-title"></slot>
      <span v-if="subtitle" class="entity-card__subtitle">{{ subtitle }}</span>
      <slot></slot>
    </div>
  </article>
</template>
