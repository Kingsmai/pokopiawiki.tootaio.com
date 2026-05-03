<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import ImageUploadField from '../components/ImageUploadField.vue';
import Modal from '../components/Modal.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import SwitchGroup from '../components/SwitchGroup.vue';
import TagsSelect from '../components/TagsSelect.vue';
import TranslationFields from '../components/TranslationFields.vue';
import { iconAdd, iconCancel, iconDelete, iconPokemon, iconSave } from '../icons';
import {
  api,
  getAuthToken,
  type AuthUser,
  type ConfigType,
  type EntityImage,
  type EntityImageUpload,
  type HabitatDetail,
  type HabitatPayload,
  type Item,
  type Language,
  type Options,
  type Pokemon,
  type TranslationMap
} from '../services/api';

type HabitatAppearanceForm = {
  pokemonId: string;
  mapIds: string[];
  timeOfDays: string[];
  weathers: string[];
  rarity: number;
};

const route = useRoute();
const router = useRouter();
const { locale, t } = useI18n();
const options = ref<Options | null>(null);
const itemRows = ref<Item[]>([]);
const pokemonRows = ref<Pokemon[]>([]);
const languages = ref<Language[]>([]);
const currentUser = ref<AuthUser | null>(null);
const currentImage = ref<EntityImage | null>(null);
const imageHistory = ref<EntityImageUpload[]>([]);
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const habitatForm = ref({
  name: '',
  translations: {} as TranslationMap,
  isEventItem: false,
  imagePath: '',
  recipeItems: [] as Array<{ itemId: string; quantity: number }>,
  pokemonAppearances: [] as HabitatAppearanceForm[]
});

const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];
const timeOfDayOptions = computed(() => [
  { value: '早晨', label: t('appearance.morning') },
  { value: '中午', label: t('appearance.noon') },
  { value: '傍晚', label: t('appearance.evening') },
  { value: '晚上', label: t('appearance.night') }
]);
const weatherOptions = computed(() => [
  { value: '晴天', label: t('appearance.sunny') },
  { value: '阴天', label: t('appearance.cloudy') },
  { value: '雨天', label: t('appearance.rainy') }
]);
const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const isEventCreate = computed(() => route.name === 'event-habitat-new');
const itemSelectOptions = computed(() => itemRows.value.map((item) => ({ id: item.id, name: item.name })));
const pokemonSelectOptions = computed(() =>
  pokemonRows.value.map((pokemon) => ({ id: pokemon.id, name: pokemon.name, label: `#${pokemon.displayId} ${pokemon.name}` }))
);
const pageTitle = computed(() =>
  isEditing.value
    ? t(habitatForm.value.isEventItem ? 'pages.eventHabitats.editTitle' : 'pages.habitats.editTitle', {
        name: habitatForm.value.name || t('pages.habitats.fallbackName')
      })
    : t(isEventCreate.value ? 'pages.eventHabitats.newTitle' : 'pages.habitats.newTitle')
);
const editSubtitle = computed(() => t(habitatForm.value.isEventItem || isEventCreate.value ? 'pages.eventHabitats.editSubtitle' : 'pages.habitats.editSubtitle'));
const cancelTo = computed(() => (isEditing.value ? `/habitats/${routeId.value}` : isEventCreate.value ? '/event-habitats' : '/habitats'));
const imageEntityName = computed(() => habitatNameForSave().trim());
const canCreateConfig = computed(() => currentUser.value?.permissions.includes('admin.config.create') === true);
const canUploadImage = computed(() => currentUser.value?.permissions.includes('habitats.upload') === true);

function toIds(values: string[]): number[] {
  return values.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function toQuantityRows(rows: Array<{ itemId: string; quantity: number }>) {
  return rows
    .map((item) => ({ itemId: Number(item.itemId), quantity: Number(item.quantity) }))
    .filter((item) => Number.isInteger(item.itemId) && item.itemId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function addHabitatRecipeItem() {
  habitatForm.value.recipeItems.push({ itemId: '', quantity: 1 });
}

function addPokemonAppearance() {
  habitatForm.value.pokemonAppearances.push({
    pokemonId: '',
    mapIds: [],
    timeOfDays: ['早晨'],
    weathers: ['晴天'],
    rarity: 1
  });
}

function groupPokemonAppearances(detail: HabitatDetail): HabitatAppearanceForm[] {
  const rows = new Map<string, HabitatAppearanceForm>();

  detail.pokemon.forEach((pokemon) => {
    const key = `${pokemon.id}:${pokemon.rarity}`;
    const row = rows.get(key) ?? {
      pokemonId: String(pokemon.id),
      mapIds: [],
      timeOfDays: [],
      weathers: [],
      rarity: pokemon.rarity
    };

    const mapId = String(pokemon.map.id);
    if (!row.mapIds.includes(mapId)) row.mapIds.push(mapId);
    if (!row.timeOfDays.includes(pokemon.time_of_day)) row.timeOfDays.push(pokemon.time_of_day);
    if (!row.weathers.includes(pokemon.weather)) row.weathers.push(pokemon.weather);
    rows.set(key, row);
  });

  return [...rows.values()];
}

function closeEditor() {
  void router.push(cancelTo.value);
}

function habitatNameForSave() {
  const baseName = habitatForm.value.name.trim();
  if (baseName !== '') {
    return habitatForm.value.name;
  }

  return habitatForm.value.translations[String(locale.value || '')]?.name ?? '';
}

async function loadCurrentUser() {
  if (!getAuthToken()) {
    currentUser.value = null;
    return;
  }

  try {
    currentUser.value = (await api.me()).user;
  } catch {
    currentUser.value = null;
  }
}

async function loadEditor() {
  loading.value = true;
  message.value = '';

  try {
    const [, loadedOptions, loadedItems, loadedPokemon, loadedLanguages] = await Promise.all([
      loadCurrentUser(),
      api.options(),
      api.items({}),
      api.pokemon({}),
      api.languages()
    ]);
    options.value = loadedOptions;
    itemRows.value = loadedItems;
    pokemonRows.value = loadedPokemon;
    languages.value = loadedLanguages;

    if (isEditing.value) {
      const habitat = await api.habitatDetail(routeId.value);
      habitatForm.value = {
        name: habitat.baseName ?? habitat.name,
        translations: habitat.translations ?? {},
        isEventItem: habitat.isEventItem,
        imagePath: habitat.image?.path ?? '',
        recipeItems: habitat.recipe.map((recipeItem) => ({ itemId: String(recipeItem.id), quantity: recipeItem.quantity })),
        pokemonAppearances: groupPokemonAppearances(habitat)
      };
      currentImage.value = habitat.image;
      imageHistory.value = habitat.imageHistory;
    } else {
      habitatForm.value.isEventItem = isEventCreate.value;
    }
  } catch (error) {
    message.value = errorText(error, t('errors.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  options.value = await api.options();
}

async function createMultiOption(selectKey: string, type: ConfigType, name: string, values: string[]) {
  const cleanName = name.trim();
  if (!cleanName || !canCreateConfig.value) return;

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

async function saveHabitat() {
  busy.value = true;
  message.value = '';

  try {
    const payload: HabitatPayload = {
      name: habitatNameForSave(),
      translations: habitatForm.value.translations,
      isEventItem: habitatForm.value.isEventItem,
      imagePath: habitatForm.value.imagePath,
      recipeItems: toQuantityRows(habitatForm.value.recipeItems),
      pokemonAppearances: habitatForm.value.pokemonAppearances
        .map((item) => ({
          pokemonId: Number(item.pokemonId),
          mapIds: toIds(item.mapIds),
          timeOfDays: item.timeOfDays.filter((entry) => timeOfDays.includes(entry)),
          weathers: item.weathers.filter((entry) => weathers.includes(entry)),
          rarity: Number(item.rarity)
        }))
        .filter((item) => item.pokemonId > 0 && item.mapIds.length > 0 && item.timeOfDays.length > 0 && item.weathers.length > 0)
    };
    const saved = isEditing.value ? await api.updateHabitat(routeId.value, payload) : await api.createHabitat(payload);
    await router.push(`/habitats/${saved.id}`);
  } catch (error) {
    message.value = errorText(error, t('errors.saveFailed'));
  } finally {
    busy.value = false;
  }
}

function handleImageSelected(image: EntityImage) {
  currentImage.value = image;
}

function handleImageUploaded(image: EntityImageUpload) {
  currentImage.value = image;
  imageHistory.value = [image, ...imageHistory.value.filter((item) => item.path !== image.path)];
}

onMounted(() => {
  void loadEditor();
});
</script>

<template>
  <Modal :title="pageTitle" :subtitle="editSubtitle" :close-label="t('common.close')" size="wide" @close="closeEditor">
    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" id="habitat-edit-form" class="modal-edit-form" @submit.prevent="saveHabitat">
      <TranslationFields
        id-prefix="habitat-name"
        v-model:base-value="habitatForm.name"
        v-model:translations="habitatForm.translations"
        field="name"
        :label="t('common.name')"
        :languages="languages"
        required
      />

      <ImageUploadField
        v-model="habitatForm.imagePath"
        entity-type="habitats"
        :entity-id="isEditing ? routeId : null"
        :entity-name="imageEntityName"
        :label="t('media.image')"
        :current-image="currentImage"
        :history="imageHistory"
        :disabled="busy"
        :allow-upload="canUploadImage"
        @selected="handleImageSelected"
        @uploaded="handleImageUploaded"
        @error="message = $event"
      />

      <div class="check-row">
        <label><input v-model="habitatForm.isEventItem" type="checkbox" :disabled="isEventCreate" /> {{ t('pages.habitats.eventItem') }}</label>
      </div>

      <div class="field">
        <label>{{ t('pages.habitats.recipe') }}</label>
        <div v-for="(row, index) in habitatForm.recipeItems" :key="index" class="inline-row">
          <TagsSelect
            :id="`habitat-recipe-item-${index}`"
            v-model="row.itemId"
            :options="itemSelectOptions"
            :multiple="false"
            :placeholder="t('common.select')"
            :search-placeholder="t('pages.pokemon.searchItems')"
          />
          <input v-model.number="row.quantity" :aria-label="t('common.quantity')" type="number" min="1" />
          <button type="button" @click="habitatForm.recipeItems.splice(index, 1)">
            <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
            {{ t('common.delete') }}
          </button>
        </div>
        <button type="button" class="plain-button" @click="addHabitatRecipeItem">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('pages.habitats.addItem') }}
        </button>
      </div>

      <div class="field">
        <label>{{ t('pages.habitats.possiblePokemon') }}</label>
        <div v-for="(row, index) in habitatForm.pokemonAppearances" :key="index" class="appearance-row">
          <div class="appearance-row__main">
            <div class="field appearance-row__pokemon">
              <label :for="`appearance-pokemon-${index}`">Pokemon</label>
              <TagsSelect
                :id="`appearance-pokemon-${index}`"
                v-model="row.pokemonId"
                :options="pokemonSelectOptions"
                :multiple="false"
                placeholder="Pokemon"
                :search-placeholder="t('pages.pokemon.searchPokemon')"
              />
            </div>
            <SwitchGroup :id="`appearance-times-${index}`" v-model="row.timeOfDays" :label="t('appearance.time')" :options="timeOfDayOptions" />
            <SwitchGroup :id="`appearance-weathers-${index}`" v-model="row.weathers" :label="t('appearance.weather')" :options="weatherOptions" />

            <div class="field appearance-row__rarity">
              <label :for="`appearance-rarity-${index}`">{{ t('appearance.rarity') }}</label>
              <input :id="`appearance-rarity-${index}`" v-model.number="row.rarity" type="number" min="1" max="3" />
            </div>

            <button type="button" class="appearance-row__delete" @click="habitatForm.pokemonAppearances.splice(index, 1)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </div>

          <div class="field appearance-row__maps">
            <label :for="`appearance-maps-${index}`">{{ t('appearance.map') }}</label>
            <TagsSelect
              :id="`appearance-maps-${index}`"
              v-model="row.mapIds"
              :options="options.maps"
              :allow-create="canCreateConfig"
              :creating="creatingSelect === `appearance-maps-${index}`"
              :placeholder="t('pages.habitats.searchMaps')"
              @create="createMultiOption(`appearance-maps-${index}`, 'maps', $event, row.mapIds)"
            />
          </div>
        </div>
        <button type="button" class="plain-button" @click="addPokemonAppearance">
          <Icon :icon="iconPokemon" class="ui-icon" aria-hidden="true" />
          {{ t('pages.habitats.addPokemon') }}
        </button>
      </div>
    </form>

    <section v-else class="modal-edit-form skeleton-detail-section" aria-busy="true" :aria-label="t('pages.habitats.loadingEdit')">
      <div v-for="index in 5" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '112px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>

    <template v-if="!loading && options" #footer>
      <button type="submit" form="habitat-edit-form" class="link-button" :disabled="busy">
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
