<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PokeBallMark from '../components/PokeBallMark.vue';
import StatusBadge from '../components/StatusBadge.vue';
import {
  iconAction,
  iconAutomation,
  iconChecklist,
  iconClothes,
  iconDish,
  iconDreamIsland,
  iconEvent,
  iconHabitat,
  iconItem,
  iconLife,
  iconPokemon,
  iconRecipe
} from '../icons';

const { t } = useI18n();

const primarySections = computed(() => [
  { key: 'pokemon', to: '/pokemon', icon: iconPokemon },
  { key: 'habitats', to: '/habitats', icon: iconHabitat },
  { key: 'items', to: '/items', icon: iconItem },
  { key: 'recipes', to: '/recipes', icon: iconRecipe }
]);

const communitySections = computed(() => [
  { key: 'checklist', to: '/checklist', icon: iconChecklist },
  { key: 'life', to: '/life', icon: iconLife }
]);

const futureSections = computed(() => [
  { key: 'automation', to: '/automation', icon: iconAutomation },
  { key: 'dish', to: '/dish', icon: iconDish },
  { key: 'events', to: '/events', icon: iconEvent },
  { key: 'actions', to: '/actions', icon: iconAction },
  { key: 'dreamIsland', to: '/dream-island', icon: iconDreamIsland },
  { key: 'clothes', to: '/clothes', icon: iconClothes }
]);

function sectionTitleKey(key: string) {
  return `pages.home.sections.${key}.title`;
}

function sectionDescriptionKey(key: string) {
  return `pages.home.sections.${key}.description`;
}
</script>

<template>
  <section class="home-page">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero__copy">
        <span class="page-kicker">{{ t('pages.home.kicker') }}</span>
        <h1 id="home-title" class="home-hero__title">{{ t('pages.home.title') }}</h1>
        <p class="home-hero__subtitle">{{ t('pages.home.subtitle') }}</p>

        <div class="home-hero__actions" :aria-label="t('pages.home.primaryActions')">
          <RouterLink class="ui-button ui-button--primary" to="/pokemon">
            <Icon :icon="iconPokemon" class="ui-icon" aria-hidden="true" />
            {{ t('pages.home.browsePokemon') }}
          </RouterLink>
          <RouterLink class="ui-button ui-button--blue" to="/checklist">
            <Icon :icon="iconChecklist" class="ui-icon" aria-hidden="true" />
            {{ t('pages.home.openChecklist') }}
          </RouterLink>
          <RouterLink class="ui-button ui-button--ghost" to="/life">
            <Icon :icon="iconLife" class="ui-icon" aria-hidden="true" />
            {{ t('pages.home.openLife') }}
          </RouterLink>
        </div>

        <div class="home-quick-index" :aria-label="t('pages.home.quickIndex')">
          <RouterLink v-for="section in primarySections" :key="section.key" :to="section.to">
            <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
            <span>{{ t(sectionTitleKey(section.key)) }}</span>
          </RouterLink>
        </div>
      </div>

      <aside class="home-dex" :aria-label="t('pages.home.featuredPanel')">
        <div class="home-dex__head">
          <div class="home-dex__lights" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>{{ t('pages.home.dexCode') }}</span>
        </div>
        <div class="home-dex__screen">
          <PokeBallMark size="84px" />
          <div class="home-dex__copy">
            <strong>{{ t('pages.home.dexTitle') }}</strong>
            <p>{{ t('pages.home.dexBody') }}</p>
          </div>
          <div class="home-dex__tiles">
            <RouterLink v-for="section in primarySections" :key="section.key" :to="section.to">
              <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
              <span>{{ t(sectionTitleKey(section.key)) }}</span>
            </RouterLink>
          </div>
        </div>
      </aside>
    </section>

    <section class="home-section" aria-labelledby="home-wiki-title">
      <div class="home-section__header">
        <span class="page-kicker">{{ t('pages.home.wikiKicker') }}</span>
        <h2 id="home-wiki-title">{{ t('pages.home.wikiTitle') }}</h2>
      </div>

      <div class="home-card-grid home-card-grid--primary">
        <RouterLink v-for="section in primarySections" :key="section.key" class="home-card" :to="section.to">
          <span class="home-card__icon">
            <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
          </span>
          <span class="home-card__copy">
            <strong>{{ t(sectionTitleKey(section.key)) }}</strong>
            <span>{{ t(sectionDescriptionKey(section.key)) }}</span>
          </span>
        </RouterLink>
      </div>
    </section>

    <section class="home-section" aria-labelledby="home-community-title">
      <div class="home-section__header">
        <span class="page-kicker">{{ t('pages.home.communityKicker') }}</span>
        <h2 id="home-community-title">{{ t('pages.home.communityTitle') }}</h2>
      </div>

      <div class="home-card-grid home-card-grid--community">
        <RouterLink v-for="section in communitySections" :key="section.key" class="home-card home-card--wide" :to="section.to">
          <span class="home-card__icon">
            <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
          </span>
          <span class="home-card__copy">
            <strong>{{ t(sectionTitleKey(section.key)) }}</strong>
            <span>{{ t(sectionDescriptionKey(section.key)) }}</span>
          </span>
        </RouterLink>
      </div>
    </section>

    <section class="home-section" aria-labelledby="home-future-title">
      <div class="home-section__header">
        <span class="page-kicker">{{ t('pages.home.futureKicker') }}</span>
        <h2 id="home-future-title">{{ t('pages.home.futureTitle') }}</h2>
      </div>

      <div class="home-card-grid home-card-grid--future">
        <RouterLink v-for="section in futureSections" :key="section.key" class="home-card home-card--future" :to="section.to">
          <span class="home-card__icon">
            <Icon :icon="section.icon" class="ui-icon" aria-hidden="true" />
          </span>
          <span class="home-card__copy">
            <strong>{{ t(sectionTitleKey(section.key)) }}</strong>
            <span>{{ t(sectionDescriptionKey(section.key)) }}</span>
          </span>
          <StatusBadge :label="t('common.inDev')" tone="info" compact />
        </RouterLink>
      </div>
    </section>
  </section>
</template>
