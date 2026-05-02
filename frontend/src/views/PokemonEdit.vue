<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import Modal from '../components/Modal.vue';
import PokemonStatsFields from '../components/PokemonStatsFields.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import Tabs from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import TranslationFields from '../components/TranslationFields.vue';
import { iconCancel, iconSave } from '../icons';
import {
  api,
  type ConfigType,
  type Language,
  type NamedEntity,
  type Options,
  type PokemonPayload,
  type PokemonStats,
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
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const activeEditTab = ref('basic');
const heightUnit = ref<'imperial' | 'metric'>('imperial');
const weightUnit = ref<'imperial' | 'metric'>('imperial');

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
  id: '',
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
  skillItemDrops: [] as SkillItemDropForm[]
});

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const pageTitle = computed(() =>
  isEditing.value
    ? t('pages.pokemon.editTitle', { id: pokemonForm.value.id || routeId.value, name: pokemonForm.value.name })
    : t('pages.pokemon.newTitle')
);
const cancelTo = computed(() => (isEditing.value ? `/pokemon/${routeId.value}` : '/pokemon'));
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
  return Number(isEditing.value ? routeId.value : pokemonForm.value.id);
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
    await loadOptions();
    if (isEditing.value) {
      const pokemon = await api.pokemonDetail(routeId.value);
      pokemonForm.value = {
        id: String(pokemon.id),
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
        }))
      };
      syncSkillItemDrops();
    }
  } catch (error) {
    message.value = errorText(error, t('errors.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function createSingleOption(selectKey: string, type: ConfigType, name: string, assign: (value: string) => void) {
  const cleanName = name.trim();
  if (!cleanName) return;

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
  if (!cleanName || (max > 0 && values.length >= max)) return;

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
  if (!hasRequiredBasicFields()) {
    await showBasicFieldValidation();
    return;
  }

  busy.value = true;
  message.value = '';

  try {
    const payload: PokemonPayload = {
      id: pokemonIdForSave(),
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
        .filter((row) => Number.isInteger(row.skillId) && row.skillId > 0 && Number.isInteger(row.itemId) && row.itemId > 0)
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

watch(() => pokemonForm.value.skillIds.slice(), syncSkillItemDrops);
</script>

<template>
  <Modal :title="pageTitle" :subtitle="t('pages.pokemon.editSubtitle')" :close-label="t('common.close')" size="wide" @close="closeEditor">
    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" id="pokemon-edit-form" class="modal-edit-form modal-edit-form--tabbed pokemon-edit-form" @submit.prevent="savePokemon">
      <Tabs id="pokemon-edit-tabs" v-model="activeEditTab" :tabs="editTabs" :label="t('pages.pokemon.editSections')" />

      <section v-if="activeEditTab === 'basic'" class="pokemon-edit-panel" role="tabpanel" :aria-label="t('pages.pokemon.editTabBasic')">
        <div class="pokemon-edit-grid">
          <div class="field">
            <label for="pokemon-id">ID</label>
            <input id="pokemon-id" v-model="pokemonForm.id" :disabled="isEditing" min="1" required type="number" />
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

        <div class="pokemon-edit-grid">
          <div class="field">
            <label for="pokemon-environment">{{ t('pages.pokemon.environment') }}</label>
            <TagsSelect
              id="pokemon-environment"
              v-model="pokemonForm.environmentId"
              :options="options.environments"
              :multiple="false"
              allow-create
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
              allow-create
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
            allow-create
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
            allow-create
            :creating="creatingSelect === 'pokemon-types'"
            :placeholder="t('pages.pokemon.searchTypes')"
            @create="createMultiOption('pokemon-types', 'pokemon-types', $event, pokemonForm.typeIds, 2)"
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
      <button type="submit" form="pokemon-edit-form" class="link-button" :disabled="busy">
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
