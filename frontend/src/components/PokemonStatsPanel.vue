<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import ProgressBar from './ProgressBar.vue';
import type { PokemonStats } from '../services/api';

defineProps<{
  stats: PokemonStats;
}>();

const { t } = useI18n();
const statMax = 150;
const statRows: Array<{ key: keyof PokemonStats; labelKey: string; color: string }> = [
  { key: 'hp', labelKey: 'pages.pokemon.stats.hp', color: 'var(--success)' },
  { key: 'attack', labelKey: 'pages.pokemon.stats.attack', color: 'var(--pokemon-red)' },
  { key: 'defense', labelKey: 'pages.pokemon.stats.defense', color: 'var(--pokemon-blue)' },
  { key: 'specialAttack', labelKey: 'pages.pokemon.stats.specialAttack', color: 'var(--type-psychic)' },
  { key: 'specialDefense', labelKey: 'pages.pokemon.stats.specialDefense', color: 'var(--type-water)' },
  { key: 'speed', labelKey: 'pages.pokemon.stats.speed', color: 'var(--pokemon-yellow)' }
];
</script>

<template>
  <div class="pokemon-stats-panel">
    <ProgressBar
      v-for="stat in statRows"
      :key="stat.key"
      :label="t(stat.labelKey)"
      :value="stats[stat.key]"
      :max="statMax"
      :color="stat.color"
    />
  </div>
</template>
