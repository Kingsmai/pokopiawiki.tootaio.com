<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { PokemonStats } from '../services/api';

const props = defineProps<{
  idPrefix: string;
  modelValue: PokemonStats;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: PokemonStats];
}>();

const { t } = useI18n();
const statRows: Array<{ key: keyof PokemonStats; labelKey: string }> = [
  { key: 'hp', labelKey: 'pages.pokemon.stats.hp' },
  { key: 'attack', labelKey: 'pages.pokemon.stats.attack' },
  { key: 'defense', labelKey: 'pages.pokemon.stats.defense' },
  { key: 'specialAttack', labelKey: 'pages.pokemon.stats.specialAttack' },
  { key: 'specialDefense', labelKey: 'pages.pokemon.stats.specialDefense' },
  { key: 'speed', labelKey: 'pages.pokemon.stats.speed' }
];

function updateStat(key: keyof PokemonStats, event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);

  emit('update:modelValue', {
    ...props.modelValue,
    [key]: Number.isInteger(value) && value >= 0 ? value : 0
  });
}
</script>

<template>
  <div class="pokemon-stats-fields">
    <div v-for="stat in statRows" :key="stat.key" class="field">
      <label :for="`${idPrefix}-${stat.key}`">{{ t(stat.labelKey) }}</label>
      <input
        :id="`${idPrefix}-${stat.key}`"
        :value="modelValue[stat.key]"
        min="0"
        step="1"
        type="number"
        inputmode="numeric"
        @input="updateStat(stat.key, $event)"
      />
    </div>
  </div>
</template>
