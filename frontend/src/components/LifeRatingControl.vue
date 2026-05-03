<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { iconStar, iconStarOutline } from '../icons';

const props = withDefaults(
  defineProps<{
    ratingAverage: number | null;
    ratingCount: number;
    myRating: number | null;
    disabled?: boolean;
    busy?: boolean;
  }>(),
  {
    disabled: false,
    busy: false
  }
);

const emit = defineEmits<{
  rate: [rating: number];
}>();

const { locale, t } = useI18n();
const ratings = [1, 2, 3, 4, 5] as const;

const formattedAverage = computed(() => {
  if (props.ratingAverage === null || props.ratingCount === 0) {
    return '-';
  }

  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(props.ratingAverage);
});

const summaryLabel = computed(() => {
  if (props.ratingAverage === null || props.ratingCount === 0) {
    return t('pages.life.noRatings');
  }

  return t('pages.life.ratingAverage', {
    average: formattedAverage.value,
    count: props.ratingCount
  });
});

function buttonLabel(rating: number) {
  return props.myRating === rating ? t('pages.life.removeRating') : t('pages.life.setRating', { count: rating });
}
</script>

<template>
  <div class="life-rating-control" role="group" :aria-busy="busy" :aria-label="t('pages.life.rating')">
    <div class="life-rating-control__stars" role="group" :aria-label="t('pages.life.rating')">
      <button
        v-for="rating in ratings"
        :key="rating"
        class="life-rating-control__star"
        :class="{ 'is-active': myRating !== null && rating <= myRating }"
        type="button"
        :aria-label="buttonLabel(rating)"
        :aria-pressed="myRating === rating"
        :disabled="disabled || busy"
        @click="emit('rate', rating)"
      >
        <Icon :icon="myRating !== null && rating <= myRating ? iconStar : iconStarOutline" class="ui-icon" aria-hidden="true" />
      </button>
    </div>
    <span class="life-rating-control__summary" :aria-label="summaryLabel">{{ formattedAverage }}</span>
  </div>
</template>
