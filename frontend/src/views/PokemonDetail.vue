<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditHistoryPanel from '../components/EditHistoryPanel.vue';
import EntityDiscussionPanel from '../components/EntityDiscussionPanel.vue';
import EntityChips from '../components/EntityChips.vue';
import Modal from '../components/Modal.vue';
import PageHeader from '../components/PageHeader.vue';
import PokeBallMark from '../components/PokeBallMark.vue';
import PokemonStatsPanel from '../components/PokemonStatsPanel.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import { iconBack, iconEdit, iconHabitat, iconItem } from '../icons';
import { api, type PokemonDetail } from '../services/api';
import PokemonEdit from './PokemonEdit.vue';

const route = useRoute();
const { t } = useI18n();
const pokemon = ref<PokemonDetail | null>(null);
const itemCategoryTab = ref('');
const relatedHabitatTab = ref('');
const detailTab = ref('details');
const imageModalOpen = ref(false);
const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];
const relatedPokemonLimit = 6;

type HabitatRow = {
  id: number;
  name: string;
  image: PokemonDetail['habitats'][number]['image'];
  timeOfDays: string[];
  weathers: string[];
  rarity: number;
  maps: string[];
};

function sortByOrder(values: Set<string>, order: string[]) {
  return [...values].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

function habitatTabValue(id: number): string {
  return `habitat-${id}`;
}

function timeLabel(value: string): string {
  const labels: Record<string, string> = {
    早晨: t('appearance.morning'),
    中午: t('appearance.noon'),
    傍晚: t('appearance.evening'),
    晚上: t('appearance.night')
  };
  return labels[value] ?? value;
}

function weatherLabel(value: string): string {
  const labels: Record<string, string> = {
    晴天: t('appearance.sunny'),
    阴天: t('appearance.cloudy'),
    雨天: t('appearance.rainy')
  };
  return labels[value] ?? value;
}

const habitatRows = computed<HabitatRow[]>(() => {
  if (!pokemon.value) return [];

  const rows = new Map<
    string,
    {
      id: number;
      name: string;
      image: PokemonDetail['habitats'][number]['image'];
      timeOfDays: Set<string>;
      weathers: Set<string>;
      rarity: number;
      maps: Set<string>;
    }
  >();

  pokemon.value.habitats.forEach((habitat) => {
    const key = `${habitat.id}:${habitat.rarity}`;
    const row = rows.get(key) ?? {
      id: habitat.id,
      name: habitat.name,
      image: habitat.image,
      timeOfDays: new Set<string>(),
      weathers: new Set<string>(),
      rarity: habitat.rarity,
      maps: new Set<string>()
    };

    row.timeOfDays.add(habitat.time_of_day);
    row.weathers.add(habitat.weather);
    row.maps.add(habitat.map.name);
    rows.set(key, row);
  });

  return [...rows.values()].map((row) => ({
    id: row.id,
    name: row.name,
    image: row.image,
    timeOfDays: sortByOrder(row.timeOfDays, timeOfDays),
    weathers: sortByOrder(row.weathers, weathers),
    rarity: row.rarity,
    maps: [...row.maps]
  }));
});
const skillDropRows = computed(() => pokemon.value?.skills.filter((skill) => skill.itemDrop) ?? []);
const showEditor = computed(() => route.name === 'pokemon-edit');
const detailTabs = computed<TabOption[]>(() => [
  { value: 'details', label: t('common.details') },
  { value: 'discussion', label: t('discussion.title') },
  { value: 'history', label: t('history.editHistory') }
]);
const itemCategoryTabs = computed<TabOption[]>(() => {
  const categories = new Map<string, string>();

  pokemon.value?.favoriteThingItems.forEach((item) => {
    categories.set(String(item.category.id), item.category.name);
  });

  const tabs = [...categories.entries()].map(([value, label]) => ({ value, label }));

  return tabs.length > 1 ? [{ value: '', label: t('common.all') }, ...tabs] : [];
});
const favoriteThingItems = computed(() => {
  const items = pokemon.value?.favoriteThingItems ?? [];

  if (!itemCategoryTab.value) {
    return items;
  }

  return items.filter((item) => String(item.category.id) === itemCategoryTab.value);
});
const relatedHabitatTabs = computed<TabOption[]>(() => {
  if (!pokemon.value?.relatedPokemon.length) {
    return [];
  }

  const habitats = new Map<string, string>();
  habitats.set(habitatTabValue(pokemon.value.environment.id), pokemon.value.environment.name);

  pokemon.value.relatedPokemon.forEach((item) => {
    habitats.set(habitatTabValue(item.environment.id), item.environment.name);
  });

  const tabs = [...habitats.entries()].map(([value, label]) => ({ value, label }));
  return [...tabs, { value: 'all', label: t('common.all') }];
});
const relatedPokemonRows = computed(() => {
  const rows = pokemon.value?.relatedPokemon ?? [];
  const selectedTab = relatedHabitatTab.value || (pokemon.value ? habitatTabValue(pokemon.value.environment.id) : '');

  if (selectedTab === 'all') {
    return rows.slice(0, relatedPokemonLimit);
  }

  return rows.filter((item) => habitatTabValue(item.environment.id) === selectedTab).slice(0, relatedPokemonLimit);
});
const typeSlotClass = computed(() => ({
  'pokemon-type-slots--single': (pokemon.value?.types.length ?? 0) === 1
}));

function formatMetricMeasure(value: number): string {
  return value.toFixed(2);
}

function formatPoundsMeasure(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatImperialHeight(inches: number): string {
  const totalInches = Math.round(inches);
  const feet = Math.floor(totalInches / 12);
  const remainingInches = totalInches - feet * 12;
  return `${feet}'${remainingInches}"`;
}

function pokemonTypeIconSrc(typeId: number): string | null {
  return typeId >= 1 && typeId <= 19 ? `/types/small/${typeId}.png` : null;
}

function pokemonImageAlt() {
  if (!pokemon.value?.image) {
    return '';
  }
  return pokemon.value.image.source === 'upload'
    ? t('media.imageAlt', { name: pokemon.value.name })
    : t('pages.pokemon.imageAlt', { name: pokemon.value.name, variant: pokemon.value.image.variant });
}

function pokemonImageLabel() {
  if (!pokemon.value?.image) {
    return '';
  }
  return pokemon.value.image.source === 'upload' ? t('media.uploadedImage') : `${pokemon.value.image.version} - ${pokemon.value.image.variant}`;
}

function openImageModal() {
  imageModalOpen.value = true;
}

function closeImageModal() {
  imageModalOpen.value = false;
}

async function loadPokemonDetail() {
  const nextPokemon = await api.pokemonDetail(String(route.params.id));
  pokemon.value = nextPokemon;
  relatedHabitatTab.value = habitatTabValue(nextPokemon.environment.id);
}

onMounted(async () => {
  await loadPokemonDetail();
});

watch(
  () => route.name,
  (name, oldName) => {
    if (oldName === 'pokemon-edit' && name === 'pokemon-detail') {
      void loadPokemonDetail();
    }
  }
);

watch(
  () => route.params.id,
  () => {
    pokemon.value = null;
    relatedHabitatTab.value = '';
    detailTab.value = 'details';
    imageModalOpen.value = false;
    void loadPokemonDetail();
  }
);
</script>

<template>
  <section v-if="!pokemon" class="page-stack" aria-busy="true" :aria-label="t('pages.pokemon.loadingDetail')">
    <div class="page-header page-header--skeleton" aria-hidden="true">
      <div class="page-header__copy">
        <Skeleton width="142px" />
        <Skeleton width="280px" height="46px" />
        <Skeleton width="220px" />
        <Skeleton width="310px" />
      </div>
      <div class="page-header__actions">
        <Skeleton variant="box" width="88px" height="36px" />
      </div>
    </div>

    <div class="detail-grid detail-grid--stack" aria-hidden="true">
      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="56px" height="24px" />
        </div>
        <div class="detail-section__body">
          <div class="skeleton-chip-row">
            <Skeleton v-for="index in 2" :key="index" width="74px" class="skeleton-chip" />
          </div>
        </div>
      </section>

      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="92px" height="24px" />
        </div>
        <div class="detail-section__body">
          <div class="skeleton-chip-row">
            <Skeleton v-for="index in 4" :key="index" width="82px" class="skeleton-chip" />
          </div>
        </div>
      </section>

      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="68px" height="24px" />
        </div>
        <div class="detail-section__body">
          <ul class="row-list appearance-list skeleton-row-list">
            <li v-for="index in 3" :key="index" class="skeleton-appearance-row">
              <Skeleton width="96px" />
              <div class="skeleton-summary">
                <div v-for="line in 4" :key="line">
                  <Skeleton width="56px" />
                  <Skeleton :width="line === 4 ? '70%' : '48%'" />
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </section>
  <section v-else class="page-stack">
    <PageHeader :title="`#${pokemon.id} ${pokemon.name}`" :subtitle="t('pages.pokemon.environmentPrefix', { name: pokemon.environment.name })">
      <template #kicker>Pokédex Detail</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" :to="`/pokemon/${pokemon.id}/edit`">
          <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
          {{ t('common.edit') }}
        </RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/pokemon">
          <Icon :icon="iconBack" class="ui-icon" aria-hidden="true" />
          {{ t('common.backToList') }}
        </RouterLink>
      </template>
    </PageHeader>

    <div class="detail-tabs">
      <Tabs id="pokemon-detail-tabs" v-model="detailTab" :tabs="detailTabs" :label="t('common.details')" />

      <div v-if="detailTab === 'details'" class="detail-grid detail-grid--stack">
        <div class="pokemon-profile-grid pokemon-profile-grid--with-image">
          <div class="pokemon-profile-main">
            <section class="detail-section pokemon-profile-card" :aria-label="t('pages.pokemon.details')">
              <p v-if="pokemon.genus" class="pokemon-genus">{{ pokemon.genus }}</p>
              <div v-if="pokemon.genus && pokemon.details.trim()" class="pokemon-profile-divider"></div>
              <p v-if="pokemon.details.trim()" class="detail-text">{{ pokemon.details }}</p>
              <p v-if="!pokemon.genus && !pokemon.details.trim()" class="meta-line">{{ t('common.none') }}</p>
            </section>

            <div class="pokemon-profile-row">
              <section class="detail-section pokemon-profile-card" :aria-label="t('pages.pokemon.measurements')">
                <div class="pokemon-measurement-display">
                  <div class="pokemon-measurement-item" :title="`${formatImperialHeight(pokemon.heightInches)} / ${formatMetricMeasure(pokemon.heightMeters)} m`">
                    <div class="pokemon-measurement-stack">
                      <strong class="pokemon-measurement-value">{{ formatImperialHeight(pokemon.heightInches) }}</strong>
                      <span class="pokemon-measurement-divider" aria-hidden="true"></span>
                      <strong class="pokemon-measurement-value">{{ formatMetricMeasure(pokemon.heightMeters) }} m</strong>
                      <span class="pokemon-measurement-label">{{ t('pages.pokemon.height') }}</span>
                    </div>
                  </div>
                  <div class="pokemon-measurement-item" :title="`${formatPoundsMeasure(pokemon.weightPounds)} lbs / ${formatMetricMeasure(pokemon.weightKg)} kg`">
                    <div class="pokemon-measurement-stack">
                      <strong class="pokemon-measurement-value">{{ formatPoundsMeasure(pokemon.weightPounds) }} lbs</strong>
                      <span class="pokemon-measurement-divider" aria-hidden="true"></span>
                      <strong class="pokemon-measurement-value">{{ formatMetricMeasure(pokemon.weightKg) }} kg</strong>
                      <span class="pokemon-measurement-label">{{ t('pages.pokemon.weight') }}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section class="detail-section pokemon-profile-card pokemon-types-card" :aria-label="t('pages.pokemon.types')">
                <div v-if="pokemon.types.length" class="pokemon-type-slots" :class="typeSlotClass">
                  <span v-for="type in pokemon.types.slice(0, 2)" :key="type.id" class="chip pokemon-type-chip">
                    <img v-if="pokemonTypeIconSrc(type.id)" class="pokemon-type-chip__icon" :src="pokemonTypeIconSrc(type.id) ?? undefined" alt="" aria-hidden="true" />
                    <span>{{ type.name }}</span>
                  </span>
                </div>
                <p v-else class="meta-line">{{ t('common.none') }}</p>
              </section>
            </div>
          </div>

          <div class="pokemon-profile-side pokemon-profile-side--with-image">
            <DetailSection class="pokemon-profile-stats" :title="t('pages.pokemon.statsTitle')">
              <PokemonStatsPanel :stats="pokemon.stats" />
            </DetailSection>

            <button v-if="pokemon.image" type="button" class="pokemon-profile-image" :aria-label="pokemonImageLabel()" @click="openImageModal">
              <img :src="pokemon.image.url" :alt="pokemonImageAlt()" />
            </button>
            <div v-else class="pokemon-profile-image pokemon-profile-image--placeholder" role="img" :aria-label="t('pages.pokemon.imageEmpty')">
              <PokeBallMark size="64px" />
            </div>
          </div>
        </div>

        <DetailSection :title="t('pages.pokemon.skills')">
          <EntityChips :items="pokemon.skills" />
        </DetailSection>

        <DetailSection v-if="skillDropRows.length" :title="t('pages.pokemon.skillDrops')">
          <ul class="row-list skill-drop-summary">
            <li v-for="skill in skillDropRows" :key="skill.id">
              <span>{{ t('pages.pokemon.skillDrop', { name: skill.name }) }}</span>
              <RouterLink v-if="skill.itemDrop" class="related-entity-link related-entity-link--compact" :to="`/items/${skill.itemDrop.id}`">
                <span class="related-entity-media related-entity-media--inline" aria-hidden="true">
                  <img v-if="skill.itemDrop.image" :src="skill.itemDrop.image.url" alt="" loading="lazy" />
                  <Icon v-else :icon="iconItem" class="related-entity-media__icon" aria-hidden="true" />
                </span>
                <span>{{ skill.itemDrop.name }}</span>
              </RouterLink>
            </li>
          </ul>
        </DetailSection>

        <DetailSection :title="t('pages.pokemon.favoriteThings')">
          <EntityChips :items="pokemon.favorite_things" />
        </DetailSection>

        <div class="pokemon-related-grid">
          <DetailSection :title="t('pages.pokemon.relatedPokemon')">
            <template v-if="pokemon.relatedPokemon.length">
              <Tabs
                v-if="relatedHabitatTabs.length"
                id="pokemon-related-habitats"
                v-model="relatedHabitatTab"
                :tabs="relatedHabitatTabs"
                :label="t('pages.pokemon.relatedHabitat')"
              />
              <ul v-if="relatedPokemonRows.length" class="row-list related-pokemon-list">
                <li v-for="related in relatedPokemonRows" :key="related.id">
                  <div class="related-pokemon-list-item">
                    <span class="related-entity-media related-entity-media--pokemon" aria-hidden="true">
                      <img v-if="related.image" :src="related.image.url" alt="" loading="lazy" />
                      <PokeBallMark v-else size="24px" />
                    </span>
                    <div class="related-pokemon-row">
                      <div class="related-pokemon-row__summary">
                        <RouterLink class="related-pokemon-row__name" :to="`/pokemon/${related.id}`">#{{ related.id }} {{ related.name }}</RouterLink>
                        <div class="related-pokemon-row__traits">
                          <EntityChips
                            v-if="related.skills.length"
                            class="related-pokemon-row__skills"
                            :items="related.skills"
                          />
                          <span
                            class="chip related-pokemon-row__environment"
                            :class="{ 'related-pokemon-row__environment--match': related.environment.id === pokemon.environment.id }"
                          >
                            {{ related.environment.name }}
                          </span>
                        </div>
                      </div>
                      <div
                        v-if="related.favorite_things.length"
                        class="chips related-pokemon-row__favourites"
                      >
                        <span
                          v-for="thing in related.favorite_things"
                          :key="thing.id"
                          class="chip related-favourite-chip"
                          :class="{ 'related-favourite-chip--match': thing.matches }"
                        >
                          {{ thing.name }}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
              <p v-else class="meta-line">{{ t('common.none') }}</p>
            </template>
            <p v-else class="meta-line">{{ t('common.none') }}</p>
          </DetailSection>

          <DetailSection :title="t('pages.pokemon.relatedItems')">
            <template v-if="pokemon.favoriteThingItems.length">
              <Tabs
                v-if="itemCategoryTabs.length"
                id="pokemon-favorite-items"
                v-model="itemCategoryTab"
                :tabs="itemCategoryTabs"
                :label="t('pages.pokemon.relatedItemCategory')"
              />
              <ul v-if="favoriteThingItems.length" class="row-list">
                <li v-for="item in favoriteThingItems" :key="item.id">
                  <RouterLink class="related-entity-link related-entity-link--compact" :to="`/items/${item.id}`">
                    <span class="related-entity-media related-entity-media--inline" aria-hidden="true">
                      <img v-if="item.image" :src="item.image.url" alt="" loading="lazy" />
                      <Icon v-else :icon="iconItem" class="related-entity-media__icon" aria-hidden="true" />
                    </span>
                    <span>{{ item.name }}</span>
                  </RouterLink>
                  <EntityChips :items="item.tags" />
                </li>
              </ul>
              <p v-else class="meta-line">{{ t('common.none') }}</p>
            </template>
            <p v-else class="meta-line">{{ t('common.none') }}</p>
          </DetailSection>
        </div>

        <DetailSection :title="t('pages.pokemon.habitats')">
          <ul class="row-list appearance-list appearance-list--with-media">
            <li v-for="habitat in habitatRows" :key="`${habitat.id}-${habitat.rarity}`">
              <span class="related-entity-media related-entity-media--appearance" aria-hidden="true">
                <img v-if="habitat.image" :src="habitat.image.url" alt="" loading="lazy" />
                <Icon v-else :icon="iconHabitat" class="related-entity-media__icon" aria-hidden="true" />
              </span>
              <RouterLink class="appearance-name" :to="`/habitats/${habitat.id}`">{{ habitat.name }}</RouterLink>
              <dl class="appearance-summary">
                <div>
                  <dt>{{ t('appearance.time') }}</dt>
                  <dd>{{ habitat.timeOfDays.map(timeLabel).join(' / ') }}</dd>
                </div>
                <div>
                  <dt>{{ t('appearance.weather') }}</dt>
                  <dd>{{ habitat.weathers.map(weatherLabel).join(' / ') }}</dd>
                </div>
                <div>
                  <dt>{{ t('appearance.rarity') }}</dt>
                  <dd>{{ t('appearance.stars', { count: habitat.rarity }) }}</dd>
                </div>
                <div>
                  <dt>{{ t('appearance.maps') }}</dt>
                  <dd>{{ habitat.maps.join(' / ') }}</dd>
                </div>
              </dl>
            </li>
          </ul>
        </DetailSection>
      </div>

      <div v-else-if="detailTab === 'discussion'" class="detail-tab-panel">
        <EntityDiscussionPanel entity-type="pokemon" :entity-id="pokemon.id" />
      </div>

      <div v-else class="detail-tab-panel">
        <EditHistoryPanel :entity="pokemon" :history="pokemon.editHistory" />
      </div>
    </div>
  </section>

  <Modal
    v-if="pokemon?.image && imageModalOpen"
    :title="t('pages.pokemon.image')"
    :subtitle="pokemonImageLabel()"
    :close-label="t('common.close')"
    size="wide"
    @close="closeImageModal"
  >
    <div class="pokemon-image-detail">
      <div class="pokemon-image-detail__screen">
        <img :src="pokemon.image.url" :alt="pokemonImageAlt()" />
      </div>
      <div class="pokemon-image-detail__caption">
        <strong>{{ pokemonImageLabel() }}</strong>
        <span v-if="pokemon.image.style">{{ pokemon.image.style }}</span>
        <p v-if="pokemon.image.description">{{ pokemon.image.description }}</p>
      </div>
    </div>
  </Modal>

  <PokemonEdit v-if="showEditor" />
</template>
