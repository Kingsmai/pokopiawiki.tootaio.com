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
import StatusMessage from '../components/StatusMessage.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import { iconAdd, iconBack, iconCancel, iconCheck, iconEdit, iconHabitat, iconItem } from '../icons';
import { applySeo } from '../seo';
import { api, getAuthToken, type AuthUser, type Item, type PokemonDetail, type PokemonPayload, type TradingPreference } from '../services/api';
import PokemonEdit from './PokemonEdit.vue';

const route = useRoute();
const { t } = useI18n();
const pokemon = ref<PokemonDetail | null>(null);
const currentUser = ref<AuthUser | null>(null);
const itemCategoryTab = ref('');
const relatedHabitatTab = ref('');
const detailTab = ref('details');
const imageModalOpen = ref(false);
const tradingModalOpen = ref(false);
const tradingBusy = ref(false);
const tradingItemsLoading = ref(false);
const tradingMessage = ref('');
const tradingSearch = ref('');
const tradingCategoryId = ref('');
const tradingDefaultPreference = ref<TradingPreference>('like');
const tradingItemChoices = ref<Item[]>([]);
const tradingDraftItems = ref<Array<{ itemId: number; preference: TradingPreference }>>([]);
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
const skillDropRows = computed(() => pokemon.value?.skills.filter((skill) => skill.hasItemDrop) ?? []);
const hasItemDropSkill = computed(() => skillDropRows.value.length > 0);
const hasTradingSkill = computed(() => pokemon.value?.skills.some((skill) => skill.hasTrading) === true);
const tradingGroups = computed(() => ({
  likes: pokemon.value?.tradingItems.filter((item) => item.preference === 'like') ?? [],
  neutral: pokemon.value?.tradingItems.filter((item) => item.preference === 'neutral') ?? []
}));
const tradingDetailSections = computed(() => [
  { key: 'like', title: t('pages.pokemon.tradingLikes'), items: tradingGroups.value.likes },
  { key: 'neutral', title: t('pages.pokemon.tradingNeutral'), items: tradingGroups.value.neutral }
]);
const tradingCategoryOptions = computed(() => {
  const categories = new Map<string, string>();

  tradingItemChoices.value.forEach((item) => {
    categories.set(String(item.category.id), item.category.name);
  });

  return [{ value: '', label: t('common.all') }, ...[...categories.entries()].map(([value, label]) => ({ value, label }))];
});
const tradingDraftPreferenceByItemId = computed(() => new Map(tradingDraftItems.value.map((item) => [String(item.itemId), item.preference])));
const filteredTradingItems = computed(() => {
  const search = tradingSearch.value.trim().toLocaleLowerCase();

  return tradingItemChoices.value.filter((item) => {
    if (tradingCategoryId.value && String(item.category.id) !== tradingCategoryId.value) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [item.name, item.category.name, item.usage?.name ?? ''].some((value) => value.toLocaleLowerCase().includes(search));
  });
});
const tradingDraftGroups = computed(() => {
  const itemsById = new Map(tradingItemChoices.value.map((item) => [item.id, item]));
  const rows = tradingDraftItems.value
    .map((item) => {
      const row = itemsById.get(item.itemId);
      return row ? { ...row, preference: item.preference } : null;
    })
    .filter((item): item is Item & { preference: TradingPreference } => item !== null);

  return {
    likes: rows.filter((item) => item.preference === 'like'),
    neutral: rows.filter((item) => item.preference === 'neutral')
  };
});
const tradingDraftSections = computed(() => [
  { key: 'like' as TradingPreference, title: t('pages.pokemon.tradingLikes'), items: tradingDraftGroups.value.likes },
  { key: 'neutral' as TradingPreference, title: t('pages.pokemon.tradingNeutral'), items: tradingDraftGroups.value.neutral }
]);
const showEditor = computed(() => route.name === 'pokemon-edit');
const canUpdatePokemon = computed(() => currentUser.value?.permissions.includes('pokemon.update') === true);
const listPath = computed(() => (pokemon.value?.isEventItem ? '/event-pokemon' : '/pokemon'));
const detailKicker = computed(() => t(pokemon.value?.isEventItem ? 'pages.eventPokemon.detailKicker' : 'pages.pokemon.detailKicker'));
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

function buildPokemonPayload(tradingItems: Array<{ itemId: number; preference: TradingPreference }>): PokemonPayload | null {
  if (!pokemon.value) {
    return null;
  }

  return {
    dataId: pokemon.value.dataId ?? null,
    dataIdentifier: pokemon.value.dataIdentifier ?? '',
    displayId: pokemon.value.displayId,
    isEventItem: pokemon.value.isEventItem,
    name: pokemon.value.baseName ?? pokemon.value.name,
    genus: pokemon.value.baseGenus ?? pokemon.value.genus,
    details: pokemon.value.baseDetails ?? pokemon.value.details,
    heightInches: pokemon.value.heightInches,
    weightPounds: pokemon.value.weightPounds,
    translations: pokemon.value.translations ?? {},
    typeIds: pokemon.value.types.map((type) => type.id),
    stats: pokemon.value.stats,
    environmentId: pokemon.value.environment.id,
    skillIds: pokemon.value.skills.map((skill) => skill.id),
    favoriteThingIds: pokemon.value.favorite_things.map((thing) => thing.id),
    skillItemDrops: pokemon.value.skills
      .filter((skill) => skill.hasItemDrop && skill.itemDrop)
      .map((skill) => ({ skillId: skill.id, itemId: skill.itemDrop!.id })),
    tradingItems: hasTradingSkill.value
      ? tradingItems.map((item) => ({
          itemId: item.itemId,
          preference: item.preference
        }))
      : [],
    imagePath: pokemon.value.image?.path ?? ''
  };
}

async function loadTradingItems() {
  if (tradingItemsLoading.value) {
    return;
  }

  tradingItemsLoading.value = true;
  tradingMessage.value = '';
  try {
    if (!tradingItemChoices.value.length) {
      tradingItemChoices.value = await api.items({});
    }
  } catch (error) {
    tradingMessage.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    tradingItemsLoading.value = false;
  }
}

function resetTradingDraft() {
  tradingDraftItems.value = pokemon.value?.tradingItems.map((item) => ({
    itemId: item.itemId,
    preference: item.preference
  })) ?? [];
  tradingDefaultPreference.value = 'like';
  tradingSearch.value = '';
  tradingCategoryId.value = '';
  tradingMessage.value = '';
}

function isTradingItemSelected(itemId: string | number) {
  return tradingDraftPreferenceByItemId.value.has(String(itemId));
}

function addTradingItem(item: Item) {
  const itemId = String(item.id);
  if (isTradingItemSelected(itemId)) {
    return;
  }

  tradingDraftItems.value.push({ itemId: item.id, preference: tradingDefaultPreference.value });
}

function removeTradingItem(itemId: string | number) {
  const value = Number(itemId);
  tradingDraftItems.value = tradingDraftItems.value.filter((item) => item.itemId !== value);
}

function setTradingPreference(itemId: string | number, preference: TradingPreference) {
  const value = Number(itemId);
  const row = tradingDraftItems.value.find((item) => item.itemId === value);
  if (row) {
    row.preference = preference;
  }
}

async function openTradingModal() {
  if (!pokemon.value) {
    return;
  }

  resetTradingDraft();
  tradingModalOpen.value = true;
  await loadTradingItems();
}

function closeTradingModal() {
  tradingModalOpen.value = false;
  tradingMessage.value = '';
}

async function saveTradingItems() {
  if (!pokemon.value || tradingBusy.value) {
    return;
  }

  tradingBusy.value = true;
  tradingMessage.value = '';

  try {
    const payload = buildPokemonPayload(tradingDraftItems.value);
    if (!payload) {
      return;
    }

    pokemon.value = await api.updatePokemon(pokemon.value.id, payload);
    tradingModalOpen.value = false;
  } catch (error) {
    tradingMessage.value = error instanceof Error && error.message ? error.message : t('errors.saveFailed');
  } finally {
    tradingBusy.value = false;
  }
}

async function loadPokemonDetail() {
  const nextPokemon = await api.pokemonDetail(String(route.params.id));
  pokemon.value = nextPokemon;
  relatedHabitatTab.value = habitatTabValue(nextPokemon.environment.id);

  if (route.meta.editorModal !== true) {
    applySeo({
      title: `${nextPokemon.name} - ${t(nextPokemon.isEventItem ? 'pages.eventPokemon.title' : 'pages.pokemon.title')}`,
      description: t('seo.pokemonDetailDescription', { name: nextPokemon.name }),
      canonicalPath: `/pokemon/${nextPokemon.id}`,
      image: nextPokemon.image?.url
    });
  }
}

onMounted(async () => {
  if (getAuthToken()) {
    try {
      currentUser.value = (await api.me()).user;
    } catch {
      currentUser.value = null;
    }
  }
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
    tradingModalOpen.value = false;
    tradingMessage.value = '';
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
    <PageHeader :title="`#${pokemon.displayId} ${pokemon.name}`" :subtitle="t('pages.pokemon.environmentPrefix', { name: pokemon.environment.name })">
      <template #kicker>{{ detailKicker }}</template>
      <template #actions>
        <RouterLink v-if="canUpdatePokemon" class="ui-button ui-button--primary ui-button--small" :to="`/pokemon/${pokemon.id}/edit`">
          <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
          {{ t('common.edit') }}
        </RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="listPath">
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

        <DetailSection v-if="hasItemDropSkill" :title="t('pages.pokemon.skillDrops')">
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
              <span v-else class="meta-line">{{ t('common.none') }}</span>
            </li>
          </ul>
        </DetailSection>

        <DetailSection v-if="hasTradingSkill" :title="t('pages.pokemon.trading')">
          <template #actions>
            <button v-if="canUpdatePokemon" type="button" class="ui-button ui-button--blue ui-button--small" @click="openTradingModal">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('pages.pokemon.manageTrading') }}
            </button>
          </template>
          <div class="trading-detail-grid">
            <div v-for="section in tradingDetailSections" :key="section.key" class="trading-detail-group">
              <h3 class="section-subtitle">
                {{ section.title }}
                <span v-if="section.key === 'like'" class="chip">{{ t('pages.pokemon.tradingPriceBonus') }}</span>
              </h3>
              <ul v-if="section.items.length" class="row-list trading-detail-list">
                <li v-for="item in section.items" :key="`${section.key}-${item.id}`">
                  <RouterLink class="related-entity-link related-entity-link--compact" :to="`/items/${item.id}`">
                    <span class="related-entity-media related-entity-media--inline" aria-hidden="true">
                      <img v-if="item.image" :src="item.image.url" alt="" loading="lazy" />
                      <Icon v-else :icon="iconItem" class="related-entity-media__icon" aria-hidden="true" />
                    </span>
                    <span>{{ item.name }}</span>
                  </RouterLink>
                </li>
              </ul>
              <p v-else class="meta-line">{{ t('common.none') }}</p>
            </div>
          </div>
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
                        <RouterLink class="related-pokemon-row__name" :to="`/pokemon/${related.id}`">#{{ related.displayId }} {{ related.name }}</RouterLink>
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

  <Modal
    v-if="tradingModalOpen"
    :title="t('pages.pokemon.trading')"
    :subtitle="t('pages.pokemon.tradingModalSubtitle')"
    :close-label="t('common.close')"
    size="wide"
    @close="closeTradingModal"
  >
    <StatusMessage v-if="tradingMessage" variant="danger">{{ tradingMessage }}</StatusMessage>

    <div class="trading-manager">
      <section class="trading-manager__panel" :aria-label="t('pages.pokemon.tradingAvailableItems')">
        <div class="trading-manager__toolbar">
          <div class="field">
            <label for="pokemon-trading-search">{{ t('common.search') }}</label>
            <input
              id="pokemon-trading-search"
              v-model="tradingSearch"
              type="search"
              :placeholder="t('pages.pokemon.searchItems')"
            />
          </div>

          <div class="field">
            <label for="pokemon-trading-category">{{ t('pages.items.category') }}</label>
            <select id="pokemon-trading-category" v-model="tradingCategoryId">
              <option v-for="option in tradingCategoryOptions" :key="option.value || 'all'" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="trading-manager__target">
          <span class="field-label">{{ t('pages.pokemon.tradingDefaultGroup') }}</span>
          <div class="segmented trading-default-toggle" :aria-label="t('pages.pokemon.tradingDefaultGroup')">
            <button :class="{ active: tradingDefaultPreference === 'like' }" type="button" @click="tradingDefaultPreference = 'like'">
              {{ t('pages.pokemon.tradingLikes') }}
            </button>
            <button :class="{ active: tradingDefaultPreference === 'neutral' }" type="button" @click="tradingDefaultPreference = 'neutral'">
              {{ t('pages.pokemon.tradingNeutral') }}
            </button>
          </div>
        </div>

        <div class="trading-manager__list-frame">
          <ul v-if="tradingItemsLoading" class="trading-item-list trading-item-list--loading" aria-busy="true">
            <li v-for="index in 6" :key="index" class="trading-item-list__skeleton">
              <Skeleton variant="box" height="58px" />
            </li>
          </ul>
          <ul v-else-if="filteredTradingItems.length" class="trading-item-list">
            <li v-for="item in filteredTradingItems" :key="item.id">
              <button
                type="button"
                class="trading-pick-row"
                :class="{ 'trading-pick-row--selected': isTradingItemSelected(item.id) }"
                :disabled="isTradingItemSelected(item.id)"
                @click="addTradingItem(item)"
              >
                <span class="related-entity-media related-entity-media--inline" aria-hidden="true">
                  <img v-if="item.image" :src="item.image.url" alt="" loading="lazy" />
                  <Icon v-else :icon="iconItem" class="related-entity-media__icon" aria-hidden="true" />
                </span>
                <span class="trading-pick-row__copy">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.category.name }}</span>
                </span>
                <span class="trading-pick-row__state">
                  <Icon :icon="isTradingItemSelected(item.id) ? iconCheck : iconAdd" class="ui-icon" aria-hidden="true" />
                  {{ isTradingItemSelected(item.id) ? t('common.selected') : tradingDefaultPreference === 'like' ? t('pages.pokemon.tradingLikes') : t('pages.pokemon.tradingNeutral') }}
                </span>
              </button>
            </li>
          </ul>
          <p v-else class="meta-line">{{ t('common.noMatches') }}</p>
        </div>
      </section>

      <section class="trading-manager__panel" :aria-label="t('pages.pokemon.tradingSelectedItems')">
        <div class="trading-manager__list-frame trading-manager__list-frame--selected">
          <div v-for="section in tradingDraftSections" :key="section.key" class="trading-selected-group">
            <h3 class="section-subtitle">
              {{ section.title }}
              <span v-if="section.key === 'like'" class="chip">{{ t('pages.pokemon.tradingPriceBonus') }}</span>
            </h3>
            <ul v-if="section.items.length" class="trading-selected-list">
              <li v-for="item in section.items" :key="`${section.key}-${item.id}`">
                <span class="related-entity-media related-entity-media--inline" aria-hidden="true">
                  <img v-if="item.image" :src="item.image.url" alt="" loading="lazy" />
                  <Icon v-else :icon="iconItem" class="related-entity-media__icon" aria-hidden="true" />
                </span>
                <span class="trading-selected-list__copy">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.category.name }}</span>
                </span>
                <span class="segmented trading-preference-toggle" :aria-label="t('pages.pokemon.tradingPreferenceFor', { name: item.name })">
                  <button type="button" :class="{ active: item.preference === 'like' }" @click="setTradingPreference(item.id, 'like')">
                    {{ t('pages.pokemon.tradingLikes') }}
                  </button>
                  <button type="button" :class="{ active: item.preference === 'neutral' }" @click="setTradingPreference(item.id, 'neutral')">
                    {{ t('pages.pokemon.tradingNeutral') }}
                  </button>
                </span>
                <button
                  type="button"
                  class="plain-button plain-button--icon"
                  :aria-label="t('common.removeNamed', { name: item.name })"
                  @click="removeTradingItem(item.id)"
                >
                  <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
                </button>
              </li>
            </ul>
            <p v-else class="meta-line">{{ t('common.none') }}</p>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <button type="button" class="link-button" :disabled="tradingBusy || tradingItemsLoading" @click="saveTradingItems">
        <Icon :icon="iconCheck" class="ui-icon" aria-hidden="true" />
        {{ tradingBusy ? t('common.saving') : t('common.save') }}
      </button>
      <button type="button" class="plain-button" :disabled="tradingBusy || tradingItemsLoading" @click="closeTradingModal">
        <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
        {{ t('common.cancel') }}
      </button>
    </template>
  </Modal>

  <PokemonEdit v-if="showEditor" />
</template>
