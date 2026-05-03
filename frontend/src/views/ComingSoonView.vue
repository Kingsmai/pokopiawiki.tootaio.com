<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PageHeader from '../components/PageHeader.vue';
import StatusBadge from '../components/StatusBadge.vue';
import {
  iconAction,
  iconAutomation,
  iconClothes,
  iconDish,
  iconDreamIsland,
  iconEvent,
  type AppIcon
} from '../icons';

type ComingSoonPage = 'automation' | 'dish' | 'events' | 'actions' | 'dreamIsland' | 'clothes';

type ComingSoonConfig = {
  icon: AppIcon;
  accent: 'automation' | 'dish' | 'events' | 'actions' | 'dream' | 'clothes';
  previewKeys: Array<'one' | 'two' | 'three'>;
};

const props = defineProps<{
  page: ComingSoonPage;
}>();

const { t } = useI18n();

const pageConfigByPage: Record<ComingSoonPage, ComingSoonConfig> = {
  automation: { icon: iconAutomation, accent: 'automation', previewKeys: ['one', 'two', 'three'] },
  dish: { icon: iconDish, accent: 'dish', previewKeys: ['one', 'two', 'three'] },
  events: { icon: iconEvent, accent: 'events', previewKeys: ['one', 'two', 'three'] },
  actions: { icon: iconAction, accent: 'actions', previewKeys: ['one', 'two', 'three'] },
  dreamIsland: { icon: iconDreamIsland, accent: 'dream', previewKeys: ['one', 'two', 'three'] },
  clothes: { icon: iconClothes, accent: 'clothes', previewKeys: ['one', 'two', 'three'] }
};

const pageConfig = computed(() => pageConfigByPage[props.page]);
const previewItems = computed(() =>
  pageConfig.value.previewKeys.map((previewKey, index) => ({
    code: String(index + 1).padStart(2, '0'),
    text: t(pageMessageKey(`preview.${previewKey}`))
  }))
);

function pageMessageKey(suffix: string) {
  return `pages.comingSoon.sections.${props.page}.${suffix}`;
}
</script>

<template>
  <section class="page-stack coming-soon-page">
    <PageHeader :title="t(pageMessageKey('title'))" :subtitle="t(pageMessageKey('subtitle'))">
      <template #kicker>{{ t(pageMessageKey('kicker')) }}</template>
    </PageHeader>

    <section class="coming-soon-panel" :class="`coming-soon-panel--${pageConfig.accent}`">
      <div class="coming-soon-panel__icon" aria-hidden="true">
        <Icon :icon="pageConfig.icon" class="ui-icon" />
      </div>

      <div class="coming-soon-panel__copy">
        <StatusBadge :label="t('pages.comingSoon.status')" tone="info" />
        <h2>{{ t('pages.comingSoon.heading') }}</h2>
        <p>{{ t(pageMessageKey('body')) }}</p>
      </div>

      <div class="coming-soon-panel__signal" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </section>

    <section class="coming-soon-preview" :aria-label="t('pages.comingSoon.previewLabel')">
      <article v-for="item in previewItems" :key="item.code" class="coming-soon-preview__item">
        <span class="coming-soon-preview__index">{{ item.code }}</span>
        <p>{{ item.text }}</p>
      </article>
    </section>
  </section>
</template>
