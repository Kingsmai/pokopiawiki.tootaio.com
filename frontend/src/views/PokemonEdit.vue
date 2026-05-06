<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import ImageUploadField from '../components/ImageUploadField.vue';
import Modal from '../components/Modal.vue';
import PokemonStatsFields from '../components/PokemonStatsFields.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import Tabs from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import TranslationFields from '../components/TranslationFields.vue';
import { iconCancel, iconSave, iconSearch } from '../icons';
import {
  api,
  type AuthUser,
  type ConfigType,
  type EntityImage,
  type EntityImageUpload,
  type Language,
  type NamedEntity,
  type Options,
  type PokemonFetchOption,
  type PokemonFetchResult,
  type PokemonImage,
  type PokemonPayload,
  type PokemonStats,
  type TradingPreference,
  type TranslationMap
} from '../services/api';

type SkillItemDropForm = {
  skillId: string;
  itemId: string;
};

const route = useRoute();
const router = useRouter();
const { locale, t } = useI18n();
const options = ref<Options | null>(null);
const itemOptions = ref<NamedEntity[]>([]);
const languages = ref<Language[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const busy = ref(false);
const fetchBusy = ref(false);
const imageBusy = ref(false);
const fetchOptionsLoading = ref(false);
const fetchOptionsOpen = ref(false);
const message = ref('');
const fetchInput = ref<HTMLInputElement | null>(null);
const fetchIdentifier = ref('');
const fetchOptions = ref<PokemonFetchOption[]>([]);
const allFetchOptions = ref<PokemonFetchOption[]>([]);
const fetchOptionsLoaded = ref(false);
const fetchOptionsFailed = ref(false);
const fetchResultsStyle = ref<CSSProperties>({});
const imageOptions = ref<PokemonImage[]>([]);
const currentPokemonImage = ref<PokemonImage | null>(null);
const imageHistory = ref<EntityImageUpload[]>([]);
const creatingSelect = ref('');
const activeEditTab = ref('basic');
const heightUnit = ref<'imperial' | 'metric'>('imperial');
const weightUnit = ref<'imperial' | 'metric'>('imperial');
let fetchOptionsController: AbortController | null = null;
let fetchPositionFrame = 0;
const fetchOptionsLimit = 20;

function defaultPokemonStats(): PokemonStats {
  return {
    hp: 0,
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0
  };
}

const pokemonForm = ref({
  dataId: null as number | null,
  dataIdentifier: '',
  id: '',
  isEventItem: false,
  name: '',
  genus: '',
  details: '',
  heightInches: 0,
  weightPounds: 0,
  translations: {} as TranslationMap,
  typeIds: [] as string[],
  stats: defaultPokemonStats(),
  environmentId: '',
  skillIds: [] as string[],
  favoriteThingIds: [] as string[],
  skillItemDrops: [] as SkillItemDropForm[],
  tradingItems: [] as Array<{ itemId: string; preference: TradingPreference }>,
  imagePath: ''
});

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const isEventCreate = computed(() => route.name === 'event-pokemon-new');
const pageTitle = computed(() =>
  isEditing.value
    ? t(pokemonForm.value.isEventItem ? 'pages.eventPokemon.editTitle' : 'pages.pokemon.editTitle', {
        id: pokemonForm.value.id || routeId.value,
        name: pokemonForm.value.name
      })
    : t(isEventCreate.value ? 'pages.eventPokemon.newTitle' : 'pages.pokemon.newTitle')
);
const editSubtitle = computed(() => t(pokemonForm.value.isEventItem || isEventCreate.value ? 'pages.eventPokemon.editSubtitle' : 'pages.pokemon.editSubtitle'));
const cancelTo = computed(() => (isEditing.value ? `/pokemon/${routeId.value}` : isEventCreate.value ? '/event-pokemon' : '/pokemon'));
const selectedSkillDropRows = computed(() =>
  pokemonForm.value.skillItemDrops.filter((row) => pokemonForm.value.skillIds.includes(row.skillId) && skillSupportsItemDrop(row.skillId))
);
const editTabs = computed(() => [
  { value: 'basic', label: t('pages.pokemon.editTabBasic') },
  { value: 'advance', label: t('pages.pokemon.editTabAdvance') }
]);
const totalHeightInchesValue = computed(() => Math.round(pokemonForm.value.heightInches));
const heightFeetValue = computed(() => Math.floor(totalHeightInchesValue.value / 12));
const heightInchesValue = computed(() => totalHeightInchesValue.value - heightFeetValue.value * 12);
const heightMetersValue = computed(() => roundMeasurement(pokemonForm.value.heightInches * 0.0254, 2));
const weightPoundsValue = computed(() => roundMeasurement(pokemonForm.value.weightPounds, 1));
const weightKgValue = computed(() => roundMeasurement(pokemonForm.value.weightPounds * 0.45359237, 2));
const imageEntityName = computed(() => pokemonNameForSave().trim());
const selectedPokemonImage = computed(() => {
  const imagePath = pokemonForm.value.imagePath;
  if (!imagePath) {
    return null;
  }

  return imageOptions.value.find((image) => image.path === imagePath) ?? (currentPokemonImage.value?.path === imagePath ? currentPokemonImage.value : null);
});
const displayedImageOptions = computed(() => {
  const selectedImage = selectedPokemonImage.value;
  if (!selectedImage || imageOptions.value.some((image) => image.path === selectedImage.path)) {
    return imageOptions.value;
  }

  return [selectedImage, ...imageOptions.value];
});
const selectedUploadImage = computed(() => (selectedPokemonImage.value?.source === 'upload' ? selectedPokemonImage.value : null));
const canCreateConfig = computed(() => currentUser.value?.permissions.includes('admin.config.create') === true);
const canFetchPokemon = computed(() => currentUser.value?.permissions.includes('pokemon.fetch') === true);
const canUploadImage = computed(() => currentUser.value?.permissions.includes('pokemon.upload') === true);
const hasTradingSkill = computed(() => pokemonForm.value.skillIds.some((skillId) => skillSupportsTrading(skillId)));

function toIds(values: string[]): number[] {
  return values.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function numericInputValue(event: Event): number {
  const value = event.target instanceof HTMLInputElement ? Number(event.target.value) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function roundMeasurement(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function updateHeightFeet(event: Event) {
  pokemonForm.value.heightInches = Math.round(numericInputValue(event) * 12 + heightInchesValue.value);
}

function updateHeightInches(event: Event) {
  pokemonForm.value.heightInches = Math.round(heightFeetValue.value * 12 + numericInputValue(event));
}

function updateHeightMeters(event: Event) {
  pokemonForm.value.heightInches = roundMeasurement(numericInputValue(event) / 0.0254, 2);
}

function updateWeightPounds(event: Event) {
  pokemonForm.value.weightPounds = roundMeasurement(numericInputValue(event), 1);
}

function updateWeightKg(event: Event) {
  pokemonForm.value.weightPounds = roundMeasurement(numericInputValue(event) / 0.45359237, 1);
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function loadOptions() {
  const [loadedOptions, loadedItems, loadedLanguages] = await Promise.all([api.options(), api.items({}), api.languages()]);
  options.value = loadedOptions;
  itemOptions.value = loadedItems.map((item) => ({ id: item.id, name: item.name }));
  languages.value = loadedLanguages;
}

async function loadCurrentUser() {
  try {
    currentUser.value = (await api.me()).user;
  } catch {
    currentUser.value = null;
  }
}

function syncSkillItemDrops() {
  const selectedSkillIds = new Set(pokemonForm.value.skillIds);
  const rows = pokemonForm.value.skillItemDrops.filter((row) => selectedSkillIds.has(row.skillId) && skillSupportsItemDrop(row.skillId));

  pokemonForm.value.skillIds.forEach((skillId) => {
    if (skillSupportsItemDrop(skillId) && !rows.some((row) => row.skillId === skillId)) {
      rows.push({ skillId, itemId: '' });
    }
  });

  pokemonForm.value.skillItemDrops = rows;
}

function skillName(skillId: string) {
  return options.value?.skills.find((skill) => String(skill.id) === skillId)?.name ?? '';
}

function skillSupportsItemDrop(skillId: string) {
  return options.value?.skills.some((skill) => String(skill.id) === skillId && skill.hasItemDrop) === true;
}

function skillSupportsTrading(skillId: string) {
  return options.value?.skills.some((skill) => String(skill.id) === skillId && skill.hasTrading) === true;
}

function syncSkillFeatures() {
  syncSkillItemDrops();
  if (!hasTradingSkill.value) {
    pokemonForm.value.tradingItems = [];
  }
}

function skillDropLabel(skillId: string) {
  const name = skillName(skillId);
  return name ? t('pages.pokemon.skillDrop', { name }) : t('pages.pokemon.dropItem');
}

function pokemonNameForSave() {
  const baseName = pokemonForm.value.name.trim();
  if (baseName !== '') {
    return pokemonForm.value.name;
  }

  return pokemonForm.value.translations[String(locale.value || '')]?.name ?? '';
}

function pokemonIdForSave() {
  return Number(pokemonForm.value.id);
}

function mergeFetchedTranslations(fetchedTranslations: TranslationMap | undefined): TranslationMap {
  const nextTranslations = Object.entries(pokemonForm.value.translations).reduce<TranslationMap>((translations, [code, fields]) => {
    translations[code] = { ...fields };
    return translations;
  }, {});

  Object.entries(fetchedTranslations ?? {}).forEach(([code, fields]) => {
    const nextFields = { ...(nextTranslations[code] ?? {}) };
    if (typeof fields.name === 'string') {
      nextFields.name = fields.name;
    }
    if (typeof fields.genus === 'string') {
      nextFields.genus = fields.genus;
    }
    nextTranslations[code] = nextFields;
  });

  return nextTranslations;
}

function applyFetchedPokemon(fetchedPokemon: PokemonFetchResult): boolean {
  const routePokemonId = Number(routeId.value);
  if (
    isEditing.value &&
    Number.isInteger(routePokemonId) &&
    routePokemonId > 0 &&
    fetchedPokemon.id !== routePokemonId
  ) {
    message.value = t('pages.pokemon.fetchIdMismatch', { id: fetchedPokemon.id });
    return false;
  }

  pokemonForm.value = {
    ...pokemonForm.value,
    dataId: fetchedPokemon.id,
    dataIdentifier: fetchedPokemon.identifier,
    id: pokemonForm.value.id.trim() === '' ? String(fetchedPokemon.id) : pokemonForm.value.id,
    name: fetchedPokemon.name,
    genus: fetchedPokemon.genus,
    heightInches: fetchedPokemon.heightInches,
    weightPounds: fetchedPokemon.weightPounds,
    translations: mergeFetchedTranslations(fetchedPokemon.translations),
    typeIds: fetchedPokemon.typeIds.map(String),
    stats: fetchedPokemon.stats
  };
  return true;
}

function hasRequiredBasicFields() {
  const id = pokemonIdForSave();
  return Number.isInteger(id) && id > 0 && pokemonNameForSave().trim() !== '';
}

async function showBasicFieldValidation() {
  activeEditTab.value = 'basic';
  await nextTick();
  document.querySelector<HTMLFormElement>('#pokemon-edit-form')?.reportValidity();
}

function closeEditor() {
  void router.push(cancelTo.value);
}

async function loadEditor() {
  loading.value = true;
  message.value = '';

  try {
    await Promise.all([loadCurrentUser(), loadOptions()]);
    if (isEditing.value) {
      const pokemon = await api.pokemonDetail(routeId.value);
      pokemonForm.value = {
        dataId: pokemon.dataId ?? null,
        dataIdentifier: pokemon.dataIdentifier ?? '',
        id: String(pokemon.displayId),
        isEventItem: pokemon.isEventItem,
        name: pokemon.baseName ?? pokemon.name,
        genus: pokemon.baseGenus ?? pokemon.genus,
        details: pokemon.baseDetails ?? pokemon.details,
        heightInches: pokemon.heightInches,
        weightPounds: pokemon.weightPounds,
        translations: pokemon.translations ?? {},
        typeIds: pokemon.types.map((type) => String(type.id)),
        stats: pokemon.stats,
        environmentId: String(pokemon.environment.id),
        skillIds: pokemon.skills.map((skill) => String(skill.id)),
        favoriteThingIds: pokemon.favorite_things.map((thing) => String(thing.id)),
        skillItemDrops: pokemon.skills.map((skill) => ({
          skillId: String(skill.id),
          itemId: skill.itemDrop ? String(skill.itemDrop.id) : ''
        })),
        tradingItems: pokemon.tradingItems.map((item) => ({
          itemId: String(item.itemId),
          preference: item.preference
        })),
        imagePath: pokemon.image?.path ?? ''
      };
      currentPokemonImage.value = pokemon.image;
      imageOptions.value = pokemon.image ? [pokemon.image] : [];
      imageHistory.value = pokemon.imageHistory;
      syncSkillFeatures();
    } else {
      pokemonForm.value.isEventItem = isEventCreate.value;
    }
  } catch (error) {
    message.value = errorText(error, t('errors.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function cancelFetchOptionsRequest() {
  fetchOptionsController?.abort();
  fetchOptionsController = null;
  fetchOptionsLoading.value = false;
}

function resetFetchOptionsCache() {
  cancelFetchOptionsRequest();
  allFetchOptions.value = [];
  fetchOptions.value = [];
  fetchOptionsLoaded.value = false;
  fetchOptionsFailed.value = false;
}

function fetchOptionLabel(option: PokemonFetchOption) {
  return `#${option.id} ${option.name}`;
}

function fetchOptionMatchesSearch(option: PokemonFetchOption, search: string) {
  if (!search) {
    return true;
  }

  const keyword = search.toLowerCase();
  return [String(option.id), option.identifier, option.name].some((value) => value.toLowerCase().includes(keyword));
}

function applyLocalFetchOptions() {
  const search = fetchIdentifier.value.trim();
  fetchOptions.value = allFetchOptions.value.filter((option) => fetchOptionMatchesSearch(option, search)).slice(0, fetchOptionsLimit);
}

async function loadFetchOptions() {
  if (!canFetchPokemon.value) {
    return;
  }

  if (fetchOptionsLoaded.value || fetchOptionsFailed.value) {
    applyLocalFetchOptions();
    return;
  }

  if (fetchOptionsController) {
    return;
  }

  cancelFetchOptionsRequest();
  const controller = new AbortController();
  fetchOptionsController = controller;
  fetchOptionsLoading.value = true;

  try {
    const rows = await api.pokemonFetchOptions('', controller.signal, true);
    if (fetchOptionsController === controller) {
      allFetchOptions.value = rows;
      fetchOptionsLoaded.value = true;
      applyLocalFetchOptions();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    if (fetchOptionsController === controller) {
      fetchOptions.value = [];
      fetchOptionsFailed.value = true;
      message.value = errorText(error, t('pages.pokemon.fetchSearchFailed'));
    }
  } finally {
    if (fetchOptionsController === controller) {
      fetchOptionsLoading.value = false;
      fetchOptionsController = null;
    }
  }
}

function refreshFetchOptions() {
  if (!fetchOptionsOpen.value) {
    return;
  }

  if (fetchOptionsLoaded.value || fetchOptionsFailed.value) {
    applyLocalFetchOptions();
    return;
  }

  void loadFetchOptions();
}

function updateFetchResultsPosition() {
  if (!fetchInput.value) {
    fetchResultsStyle.value = {};
    return;
  }

  const viewportPadding = 12;
  const dropdownGap = 6;
  const inputRect = fetchInput.value.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(inputRect.width, viewportWidth - viewportPadding * 2);
  const left = Math.min(Math.max(inputRect.left, viewportPadding), viewportWidth - width - viewportPadding);
  const spaceBelow = viewportHeight - inputRect.bottom - viewportPadding - dropdownGap;
  const spaceAbove = inputRect.top - viewportPadding - dropdownGap;
  const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(96, Math.min(260, placeAbove ? spaceAbove : spaceBelow));
  const nextStyle = {
    left: `${left}px`,
    width: `${width}px`,
    '--pokemon-fetch-results-max-height': `${maxHeight}px`
  } as CSSProperties;

  fetchResultsStyle.value = placeAbove
    ? { ...nextStyle, bottom: `${viewportHeight - inputRect.top + dropdownGap}px` }
    : { ...nextStyle, top: `${inputRect.bottom + dropdownGap}px` };
}

function scheduleFetchResultsPositionUpdate() {
  if (!fetchOptionsOpen.value || fetchPositionFrame) {
    return;
  }

  fetchPositionFrame = window.requestAnimationFrame(() => {
    fetchPositionFrame = 0;
    updateFetchResultsPosition();
  });
}

function addFetchPositionListeners() {
  window.addEventListener('resize', scheduleFetchResultsPositionUpdate);
  window.addEventListener('scroll', scheduleFetchResultsPositionUpdate, true);
}

function removeFetchPositionListeners() {
  window.removeEventListener('resize', scheduleFetchResultsPositionUpdate);
  window.removeEventListener('scroll', scheduleFetchResultsPositionUpdate, true);

  if (fetchPositionFrame) {
    window.cancelAnimationFrame(fetchPositionFrame);
    fetchPositionFrame = 0;
  }
}

function positionFetchResultsAfterOpen() {
  updateFetchResultsPosition();
  addFetchPositionListeners();
  void nextTick(updateFetchResultsPosition);
}

function openFetchOptions() {
  if (!canFetchPokemon.value) {
    return;
  }

  fetchOptionsOpen.value = true;
  positionFetchResultsAfterOpen();
  refreshFetchOptions();
}

function closeFetchOptions() {
  fetchOptionsOpen.value = false;
  fetchResultsStyle.value = {};
  removeFetchPositionListeners();
  cancelFetchOptionsRequest();
  if (!fetchOptionsLoaded.value) {
    fetchOptionsFailed.value = false;
  }
}

function handleFetchIdentifierInput() {
  if (!canFetchPokemon.value) {
    return;
  }

  fetchOptionsOpen.value = true;
  positionFetchResultsAfterOpen();
}

function closeFetchOptionsAfterBlur() {
  window.setTimeout(closeFetchOptions, 120);
}

async function selectFetchOption(option: PokemonFetchOption) {
  fetchIdentifier.value = option.identifier;
  closeFetchOptions();
  await fetchPokemonByIdentifier(option.identifier);
}

async function fetchPokemonByIdentifier(identifierValue?: string) {
  if (!canFetchPokemon.value) {
    return;
  }

  const identifier = (identifierValue ?? fetchIdentifier.value).trim();
  if (!identifier) {
    message.value = t('pages.pokemon.fetchIdentifierRequired');
    return;
  }

  fetchBusy.value = true;
  message.value = '';

  try {
    const fetchedPokemon = await api.fetchPokemonData(identifier);
    await loadOptions();
    if (applyFetchedPokemon(fetchedPokemon)) {
      fetchIdentifier.value = fetchedPokemon.identifier;
      closeFetchOptions();
    }
  } catch (error) {
    message.value = errorText(error, t('pages.pokemon.fetchFailed'));
  } finally {
    fetchBusy.value = false;
  }
}

function fetchPokemonFromInput() {
  void fetchPokemonByIdentifier();
}

function pokemonImageLabel(image: PokemonImage) {
  if (image.source === 'upload') {
    return t('media.uploadedImage');
  }
  return `${image.version} - ${image.variant}`;
}

function pokemonImageAlt(image: PokemonImage) {
  const name = pokemonForm.value.name.trim() || (pokemonForm.value.id.trim() ? `#${pokemonForm.value.id.trim()}` : t('pages.pokemon.title'));
  return image.source === 'upload' ? t('media.imageAlt', { name }) : t('pages.pokemon.imageAlt', { name, variant: image.variant });
}

function selectPokemonImage(image: PokemonImage) {
  pokemonForm.value.imagePath = image.path;
  currentPokemonImage.value = image;
}

function clearPokemonImage() {
  pokemonForm.value.imagePath = '';
  currentPokemonImage.value = null;
}

function pokemonImageFromUpload(image: EntityImage): PokemonImage {
  return {
    path: image.path,
    url: image.url,
    style: t('media.uploadedImage'),
    version: t('media.uploadedImage'),
    variant: imageEntityName.value || (pokemonForm.value.id.trim() ? `#${pokemonForm.value.id.trim()}` : t('pages.pokemon.title')),
    description: '',
    source: 'upload'
  };
}

function handleUploadImageSelected(image: EntityImage) {
  selectPokemonImage(pokemonImageFromUpload(image));
}

function handleUploadImageUploaded(image: EntityImageUpload) {
  imageHistory.value = [image, ...imageHistory.value.filter((item) => item.path !== image.path)];
  selectPokemonImage(pokemonImageFromUpload(image));
}

async function fetchPokemonImages() {
  if (!canFetchPokemon.value) {
    return;
  }

  const identifier = fetchIdentifier.value.trim();
  if (!identifier) {
    message.value = t('pages.pokemon.fetchIdentifierRequired');
    return;
  }

  imageBusy.value = true;
  message.value = '';

  try {
    const result = await api.fetchPokemonImageOptions(identifier);
    fetchIdentifier.value = result.identifier;
    imageOptions.value = result.images;

    if (!result.images.length) {
      message.value = t('pages.pokemon.imageNoMatches');
      return;
    }

    if (!result.images.some((image) => image.path === pokemonForm.value.imagePath)) {
      selectPokemonImage(result.images[0]);
    }
  } catch (error) {
    message.value = errorText(error, t('pages.pokemon.imageFetchFailed'));
  } finally {
    imageBusy.value = false;
  }
}

function fetchPokemonImagesFromInput() {
  void fetchPokemonImages();
}

async function createSingleOption(selectKey: string, type: ConfigType, name: string, assign: (value: string) => void) {
  const cleanName = name.trim();
  if (!cleanName || !canCreateConfig.value) return;

  creatingSelect.value = selectKey;
  message.value = '';
  try {
    const created = await api.createConfig(type, { name: cleanName });
    await loadOptions();
    assign(String(created.id));
  } catch (error) {
    message.value = errorText(error, t('errors.addFailed'));
  } finally {
    creatingSelect.value = '';
  }
}

async function createMultiOption(selectKey: string, type: ConfigType, name: string, values: string[], max = 0) {
  const cleanName = name.trim();
  if (!cleanName || !canCreateConfig.value || (max > 0 && values.length >= max)) return;

  creatingSelect.value = selectKey;
  message.value = '';
  try {
    const created = await api.createConfig(type, { name: cleanName });
    await loadOptions();
    const value = String(created.id);
    if (!values.includes(value)) {
      values.push(value);
    }
  } catch (error) {
    message.value = errorText(error, t('errors.addFailed'));
  } finally {
    creatingSelect.value = '';
  }
}

async function savePokemon() {
  if (fetchBusy.value || imageBusy.value) {
    return;
  }

  if (!hasRequiredBasicFields()) {
    await showBasicFieldValidation();
    return;
  }

  busy.value = true;
  message.value = '';

  try {
    const payload: PokemonPayload = {
      dataId: pokemonForm.value.dataId,
      dataIdentifier: pokemonForm.value.dataIdentifier,
      displayId: pokemonIdForSave(),
      isEventItem: pokemonForm.value.isEventItem,
      name: pokemonNameForSave(),
      genus: pokemonForm.value.genus,
      details: pokemonForm.value.details,
      heightInches: pokemonForm.value.heightInches,
      weightPounds: pokemonForm.value.weightPounds,
      translations: pokemonForm.value.translations,
      typeIds: toIds(pokemonForm.value.typeIds.slice(0, 2)),
      stats: pokemonForm.value.stats,
      environmentId: Number(pokemonForm.value.environmentId),
      skillIds: toIds(pokemonForm.value.skillIds.slice(0, 2)),
      favoriteThingIds: toIds(pokemonForm.value.favoriteThingIds.slice(0, 6)),
      skillItemDrops: selectedSkillDropRows.value
        .map((row) => ({ skillId: Number(row.skillId), itemId: Number(row.itemId) }))
        .filter((row) => Number.isInteger(row.skillId) && row.skillId > 0 && Number.isInteger(row.itemId) && row.itemId > 0),
      tradingItems: hasTradingSkill.value
        ? pokemonForm.value.tradingItems
            .map((item) => ({ itemId: Number(item.itemId), preference: item.preference }))
            .filter((item) => Number.isInteger(item.itemId) && item.itemId > 0)
        : [],
      imagePath: pokemonForm.value.imagePath
    };
    const saved = isEditing.value ? await api.updatePokemon(routeId.value, payload) : await api.createPokemon(payload);
    await router.push(`/pokemon/${saved.id}`);
  } catch (error) {
    message.value = errorText(error, t('errors.saveFailed'));
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void loadEditor();
});

onBeforeUnmount(() => {
  cancelFetchOptionsRequest();
  removeFetchPositionListeners();
});

watch(() => pokemonForm.value.skillIds.slice(), syncSkillFeatures);
watch(fetchIdentifier, refreshFetchOptions);
watch(locale, () => {
  resetFetchOptionsCache();
  refreshFetchOptions();
});
</script>

<template>
  <Modal
    :title="pageTitle"
    :subtitle="editSubtitle"
    :close-label="t('common.close')"
    size="wide"
    @close="closeEditor"
  >
    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" id="pokemon-edit-form" class="modal-edit-form modal-edit-form--tabbed pokemon-edit-form" @submit.prevent="savePokemon">
      <Tabs id="pokemon-edit-tabs" v-model="activeEditTab" :tabs="editTabs" :label="t('pages.pokemon.editSections')" />

      <div v-if="canFetchPokemon" class="pokemon-fetch-panel" :aria-label="t('pages.pokemon.fetchData')">
        <div class="field pokemon-fetch-panel__input">
          <label for="pokemon-fetch-identifier">{{ t('pages.pokemon.fetchIdentifier') }}</label>
          <input
            id="pokemon-fetch-identifier"
            ref="fetchInput"
            v-model="fetchIdentifier"
            type="search"
            :placeholder="t('pages.pokemon.fetchIdentifierPlaceholder')"
            autocomplete="off"
            role="combobox"
            :aria-expanded="fetchOptionsOpen"
            aria-controls="pokemon-fetch-results"
            @click="openFetchOptions"
            @input="handleFetchIdentifierInput"
            @blur="closeFetchOptionsAfterBlur"
            @keydown.escape.stop="closeFetchOptions"
            @keydown.enter.prevent="fetchPokemonFromInput"
          />
          <div
            v-if="fetchOptionsOpen"
            id="pokemon-fetch-results"
            class="pokemon-fetch-results"
            :style="fetchResultsStyle"
            role="listbox"
            :aria-label="t('pages.pokemon.fetchResults')"
          >
            <p v-if="fetchOptionsLoading" class="pokemon-fetch-results__status">{{ t('pages.pokemon.fetchSearching') }}</p>
            <template v-else-if="fetchOptions.length">
              <button
                v-for="option in fetchOptions"
                :key="option.id"
                type="button"
                class="pokemon-fetch-option"
                role="option"
                @mousedown.prevent
                @click="selectFetchOption(option)"
              >
                <span class="pokemon-fetch-option__name">{{ fetchOptionLabel(option) }}</span>
                <span class="pokemon-fetch-option__identifier">{{ option.identifier }}</span>
              </button>
            </template>
            <p v-else class="pokemon-fetch-results__status">{{ t('pages.pokemon.fetchNoMatches') }}</p>
          </div>
        </div>
        <div class="pokemon-fetch-panel__actions">
          <button type="button" class="ui-button ui-button--blue ui-button--small pokemon-fetch-panel__button" :disabled="busy || fetchBusy" @click="fetchPokemonFromInput">
            <Icon :icon="iconSearch" class="ui-icon" aria-hidden="true" />
            {{ fetchBusy ? t('pages.pokemon.fetchingData') : t('pages.pokemon.fetchData') }}
          </button>
          <button type="button" class="ui-button ui-button--blue ui-button--small pokemon-fetch-panel__button" :disabled="busy || imageBusy" @click="fetchPokemonImagesFromInput">
            <Icon :icon="iconSearch" class="ui-icon" aria-hidden="true" />
            {{ imageBusy ? t('pages.pokemon.fetchingImages') : t('pages.pokemon.fetchImages') }}
          </button>
        </div>
      </div>

      <section v-if="activeEditTab === 'basic'" class="pokemon-edit-panel" role="tabpanel" :aria-label="t('pages.pokemon.editTabBasic')">
        <div class="pokemon-edit-grid">
          <div class="field">
            <label for="pokemon-id">{{ t('pages.pokemon.id') }}</label>
            <input id="pokemon-id" v-model="pokemonForm.id" min="1" required type="number" />
          </div>

          <TranslationFields
            id-prefix="pokemon-name"
            v-model:base-value="pokemonForm.name"
            v-model:translations="pokemonForm.translations"
            field="name"
            :label="t('common.name')"
            :languages="languages"
            required
          />
        </div>

        <div class="check-row">
          <label><input v-model="pokemonForm.isEventItem" type="checkbox" :disabled="isEventCreate" /> {{ t('pages.pokemon.eventItem') }}</label>
        </div>

        <div class="pokemon-edit-grid">
          <div class="field">
            <label for="pokemon-environment">{{ t('pages.pokemon.environment') }}</label>
            <TagsSelect
              id="pokemon-environment"
              v-model="pokemonForm.environmentId"
              :options="options.environments"
              :multiple="false"
              :allow-create="canCreateConfig"
              :creating="creatingSelect === 'pokemon-environment'"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.pokemon.searchEnvironment')"
              @create="createSingleOption('pokemon-environment', 'environments', $event, (value) => (pokemonForm.environmentId = value))"
            />
          </div>

          <div class="field">
            <label for="pokemon-skills">{{ t('pages.pokemon.skills') }}</label>
            <TagsSelect
              id="pokemon-skills"
              v-model="pokemonForm.skillIds"
              :options="options.skills"
              :max="2"
              :allow-create="canCreateConfig"
              :creating="creatingSelect === 'pokemon-skills'"
              :placeholder="t('pages.pokemon.searchSkills')"
              @create="createMultiOption('pokemon-skills', 'skills', $event, pokemonForm.skillIds, 2)"
            />
          </div>
        </div>

        <div class="field">
          <label for="pokemon-things">{{ t('pages.pokemon.favoriteThings') }}</label>
          <TagsSelect
            id="pokemon-things"
            v-model="pokemonForm.favoriteThingIds"
            :options="options.favoriteThings"
            :max="6"
            :allow-create="canCreateConfig"
            :creating="creatingSelect === 'pokemon-things'"
            :placeholder="t('pages.pokemon.searchFavoriteThings')"
            @create="createMultiOption('pokemon-things', 'favorite-things', $event, pokemonForm.favoriteThingIds, 6)"
          />
        </div>

        <div v-if="selectedSkillDropRows.length" class="field">
          <span class="field-label">{{ t('pages.pokemon.skillDrops') }}</span>
          <div class="skill-drop-list">
            <div v-for="row in selectedSkillDropRows" :key="row.skillId" class="skill-drop-row">
              <label :for="`pokemon-skill-drops-${row.skillId}`">{{ skillDropLabel(row.skillId) }}</label>
              <TagsSelect
                :id="`pokemon-skill-drops-${row.skillId}`"
                v-model="row.itemId"
                :options="itemOptions"
                :multiple="false"
                :placeholder="t('pages.pokemon.dropItem')"
                :search-placeholder="t('pages.pokemon.searchItems')"
              />
            </div>
          </div>
        </div>

        <div v-if="imageBusy" class="pokemon-image-preview pokemon-image-preview--loading" aria-busy="true" :aria-label="t('pages.pokemon.loadingImages')">
          <Skeleton variant="box" height="220px" />
          <Skeleton width="44%" />
          <Skeleton width="70%" />
        </div>

        <div v-else-if="selectedPokemonImage" class="pokemon-image-picker">
          <div class="pokemon-image-preview" :aria-label="t('pages.pokemon.selectedImage')">
            <div class="pokemon-image-preview__screen">
              <img :src="selectedPokemonImage.url" :alt="pokemonImageAlt(selectedPokemonImage)" />
            </div>
            <div class="pokemon-image-preview__caption">
              <strong>{{ pokemonImageLabel(selectedPokemonImage) }}</strong>
              <span>{{ selectedPokemonImage.style }}</span>
              <p>{{ selectedPokemonImage.description }}</p>
            </div>
          </div>

          <div v-if="displayedImageOptions.length" class="pokemon-image-thumbnails" :aria-label="t('pages.pokemon.imageOptions')">
            <button
              v-for="image in displayedImageOptions"
              :key="image.path"
              type="button"
              class="pokemon-image-thumbnail"
              :class="{ active: image.path === pokemonForm.imagePath }"
              :aria-pressed="image.path === pokemonForm.imagePath"
              @click="selectPokemonImage(image)"
            >
              <img :src="image.url" :alt="pokemonImageAlt(image)" loading="lazy" />
              <span>{{ image.variant }}</span>
            </button>
          </div>

          <button type="button" class="plain-button pokemon-image-clear" @click="clearPokemonImage">
            <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
            {{ t('pages.pokemon.clearImage') }}
          </button>
        </div>

        <p v-else class="meta-line">{{ t('pages.pokemon.imageEmpty') }}</p>

        <ImageUploadField
          v-model="pokemonForm.imagePath"
          entity-type="pokemon"
          :entity-id="isEditing ? routeId : null"
          :entity-name="imageEntityName"
          :label="t('media.imageHistory')"
          :current-image="selectedUploadImage"
          :history="imageHistory"
          :disabled="busy || imageBusy"
          :allow-upload="canUploadImage"
          :show-preview="false"
          @selected="handleUploadImageSelected"
          @uploaded="handleUploadImageUploaded"
          @error="message = $event"
        />
      </section>

      <section v-else class="pokemon-edit-panel" role="tabpanel" :aria-label="t('pages.pokemon.editTabAdvance')">
        <TranslationFields
          id-prefix="pokemon-genus"
          v-model:base-value="pokemonForm.genus"
          v-model:translations="pokemonForm.translations"
          field="genus"
          :label="t('pages.pokemon.genus')"
          :languages="languages"
        />

        <TranslationFields
          id-prefix="pokemon-details"
          v-model:base-value="pokemonForm.details"
          v-model:translations="pokemonForm.translations"
          field="details"
          :label="t('pages.pokemon.details')"
          :languages="languages"
          multiline
          :rows="5"
        />

        <div class="field">
          <span id="pokemon-measurements-label" class="field-label">{{ t('pages.pokemon.measurements') }}</span>
          <div class="pokemon-measurement-row" aria-labelledby="pokemon-measurements-label">
            <div class="pokemon-measurement-control">
              <span id="pokemon-height-label" class="field-label">{{ t('pages.pokemon.height') }}</span>
              <div class="segmented" aria-labelledby="pokemon-height-label">
                <button :class="{ active: heightUnit === 'imperial' }" type="button" @click="heightUnit = 'imperial'">
                  {{ t('pages.pokemon.heightImperial') }}
                </button>
                <button :class="{ active: heightUnit === 'metric' }" type="button" @click="heightUnit = 'metric'">
                  {{ t('pages.pokemon.heightMetric') }}
                </button>
              </div>

              <div v-if="heightUnit === 'imperial'" class="pokemon-measurement-fields">
                <div class="field">
                  <label for="pokemon-height-feet">{{ t('pages.pokemon.feet') }}</label>
                  <input id="pokemon-height-feet" :value="heightFeetValue" min="0" step="1" type="number" inputmode="numeric" @input="updateHeightFeet" />
                </div>

                <div class="field">
                  <label for="pokemon-height-inches">{{ t('pages.pokemon.inches') }}</label>
                  <input id="pokemon-height-inches" :value="heightInchesValue" min="0" step="1" type="number" inputmode="numeric" @input="updateHeightInches" />
                </div>
              </div>

              <div v-else class="field">
                <label for="pokemon-height-meters">{{ t('pages.pokemon.meters') }}</label>
                <input id="pokemon-height-meters" :value="heightMetersValue" min="0" step="0.01" type="number" inputmode="decimal" @input="updateHeightMeters" />
              </div>
            </div>

            <div class="pokemon-measurement-control">
              <span id="pokemon-weight-label" class="field-label">{{ t('pages.pokemon.weight') }}</span>
              <div class="segmented" aria-labelledby="pokemon-weight-label">
                <button :class="{ active: weightUnit === 'imperial' }" type="button" @click="weightUnit = 'imperial'">
                  {{ t('pages.pokemon.pounds') }}
                </button>
                <button :class="{ active: weightUnit === 'metric' }" type="button" @click="weightUnit = 'metric'">
                  {{ t('pages.pokemon.kilograms') }}
                </button>
              </div>

              <div v-if="weightUnit === 'imperial'" class="field">
                <label for="pokemon-weight-pounds">{{ t('pages.pokemon.pounds') }}</label>
                <input id="pokemon-weight-pounds" :value="weightPoundsValue" min="0" step="0.1" type="number" inputmode="decimal" @input="updateWeightPounds" />
              </div>

              <div v-else class="field">
                <label for="pokemon-weight-kg">{{ t('pages.pokemon.kilograms') }}</label>
                <input id="pokemon-weight-kg" :value="weightKgValue" min="0" step="0.01" type="number" inputmode="decimal" @input="updateWeightKg" />
              </div>
            </div>
          </div>
        </div>

        <div class="field">
          <label for="pokemon-types">{{ t('pages.pokemon.types') }}</label>
          <TagsSelect
            id="pokemon-types"
            v-model="pokemonForm.typeIds"
            :options="options.pokemonTypes"
            :max="2"
            :creating="creatingSelect === 'pokemon-types'"
            :placeholder="t('pages.pokemon.searchTypes')"
          />
        </div>

        <div class="field">
          <span class="field-label">{{ t('pages.pokemon.statsTitle') }}</span>
          <PokemonStatsFields id-prefix="pokemon-stats" v-model="pokemonForm.stats" />
        </div>
      </section>
    </form>

    <section v-else class="modal-edit-form skeleton-detail-section" aria-busy="true" :aria-label="t('pages.pokemon.loadingEdit')">
      <div v-for="index in 5" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '88px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>

    <template v-if="!loading && options" #footer>
      <button type="submit" form="pokemon-edit-form" class="link-button" :disabled="busy || fetchBusy || imageBusy">
        <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
        {{ busy ? t('common.saving') : t('common.save') }}
      </button>
      <button type="button" class="plain-button" :disabled="busy" @click="closeEditor">
        <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
        {{ t('common.cancel') }}
      </button>
    </template>
  </Modal>

</template>
