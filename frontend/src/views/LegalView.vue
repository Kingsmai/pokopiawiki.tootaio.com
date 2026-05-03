<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PageHeader from '../components/PageHeader.vue';

type LegalPage = 'privacy' | 'terms' | 'disclaimers';

type LegalSource = {
  labelKey: string;
  href: string;
};

type LegalSection = {
  key: string;
  paragraphKeys: string[];
  sources?: LegalSource[];
};

defineProps<{
  page: LegalPage;
}>();

const { t } = useI18n();

const sectionsByPage: Record<LegalPage, LegalSection[]> = {
  privacy: [
    { key: 'overview', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'information', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'storage', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'content', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'sharing', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'choices', paragraphKeys: ['bodyOne', 'bodyTwo'] }
  ],
  terms: [
    { key: 'acceptance', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'accounts', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'contributions', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'acceptableUse', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'availability', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'changes', paragraphKeys: ['bodyOne', 'bodyTwo'] }
  ],
  disclaimers: [
    { key: 'community', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'affiliation', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'pokeapi', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    {
      key: 'references',
      paragraphKeys: ['bodyOne', 'bodyTwo'],
      sources: [
        { labelKey: 'pokeapiDocs', href: 'https://pokeapi.co/docs/v2' },
        { labelKey: 'pokeapiApiDataLicense', href: 'https://github.com/PokeAPI/api-data/blob/master/LICENSE.txt' },
        { labelKey: 'pokeapiSpritesLicense', href: 'https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt' },
        { labelKey: 'pokemonLegal', href: 'https://www.pokemon.com/us/legal/' },
        { labelKey: 'pokopiaWikiReference', href: 'https://www.pokopiawiki.com/' }
      ]
    },
    { key: 'accuracy', paragraphKeys: ['bodyOne', 'bodyTwo'] },
    { key: 'rights', paragraphKeys: ['bodyOne', 'bodyTwo'] }
  ]
};

function pageKey(page: LegalPage, suffix: string) {
  return `pages.legal.${page}.${suffix}`;
}

function sectionKey(page: LegalPage, section: string, suffix: string) {
  return `pages.legal.${page}.sections.${section}.${suffix}`;
}

function sourceKey(page: LegalPage, source: string) {
  return `pages.legal.${page}.sources.${source}`;
}
</script>

<template>
  <section class="page-stack legal-page">
    <PageHeader :title="t(pageKey(page, 'title'))" :subtitle="t(pageKey(page, 'subtitle'))">
      <template #kicker>{{ t(pageKey(page, 'kicker')) }}</template>
      <template #meta>
        <p class="legal-page__updated">{{ t('pages.legal.lastUpdated') }}</p>
      </template>
    </PageHeader>

    <article
      v-for="section in sectionsByPage[page]"
      :key="section.key"
      class="detail-section legal-section"
    >
      <h2>{{ t(sectionKey(page, section.key, 'title')) }}</h2>
      <div class="detail-section__body legal-section__body">
        <p v-for="paragraphKey in section.paragraphKeys" :key="paragraphKey">
          {{ t(sectionKey(page, section.key, paragraphKey)) }}
        </p>

        <ul v-if="section.sources?.length" class="legal-source-list" :aria-label="t('pages.legal.sourceLinks')">
          <li v-for="source in section.sources" :key="source.href">
            <a :href="source.href" target="_blank" rel="noreferrer">
              {{ t(sourceKey(page, source.labelKey)) }}
            </a>
          </li>
        </ul>
      </div>
    </article>
  </section>
</template>
