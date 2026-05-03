<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { iconItem } from '../icons';
import type { EntityImage, NamedEntity, PokemonImage } from '../services/api';

type ChipItem = NamedEntity & {
  image?: EntityImage | PokemonImage | null;
  quantity?: number;
};

defineProps<{
  items: ChipItem[];
}>();

function hasImageSlot(item: ChipItem) {
  return Object.prototype.hasOwnProperty.call(item, 'image');
}
</script>

<template>
  <div class="chips">
    <span v-for="item in items" :key="`${item.id}-${item.name}`" class="chip" :class="{ 'chip--with-media': hasImageSlot(item) }">
      <span v-if="hasImageSlot(item)" class="chip__media" aria-hidden="true">
        <img v-if="item.image" :src="item.image.url" alt="" loading="lazy" />
        <Icon v-else :icon="iconItem" class="chip__icon" aria-hidden="true" />
      </span>
      {{ item.name }}<span v-if="item.quantity"> × {{ item.quantity }}</span>
    </span>
  </div>
</template>
