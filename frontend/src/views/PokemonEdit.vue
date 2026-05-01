<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import TranslationFields from '../components/TranslationFields.vue';
import { api, type ConfigType, type Language, type NamedEntity, type Options, type PokemonPayload, type TranslationMap } from '../services/api';

type SkillItemDropForm = {
  skillId: string;
  itemId: string;
};

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const options = ref<Options | null>(null);
const itemOptions = ref<NamedEntity[]>([]);
const languages = ref<Language[]>([]);
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const pokemonForm = ref({
  id: '',
  name: '',
  translations: {} as TranslationMap,
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

function toIds(values: string[]): number[] {
  return values.map(Number).filter((item) => Number.isInteger(item) && item > 0);
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

async function loadEditor() {
  loading.value = true;
  message.value = '';

  try {
    await loadOptions();
    if (isEditing.value) {
      const pokemon = await api.pokemonDetail(routeId.value);
      pokemonForm.value = {
        id: String(pokemon.id),
        name: pokemon.name,
        translations: pokemon.translations ?? {},
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
  busy.value = true;
  message.value = '';

  try {
    const payload: PokemonPayload = {
      id: Number(isEditing.value ? routeId.value : pokemonForm.value.id),
      name: pokemonForm.value.name,
      translations: pokemonForm.value.translations,
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
  <section class="page-stack">
    <PageHeader :title="pageTitle" :subtitle="t('pages.pokemon.editSubtitle')">
      <template #kicker>Pokédex Edit</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="cancelTo">{{ t('common.back') }}</RouterLink>
      </template>
    </PageHeader>

    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" class="detail-section" @submit.prevent="savePokemon">
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

      <div class="form-actions">
        <button type="submit" class="link-button" :disabled="busy">{{ busy ? t('common.saving') : t('common.save') }}</button>
        <RouterLink class="plain-button" :to="cancelTo">{{ t('common.cancel') }}</RouterLink>
      </div>
    </form>

    <section v-else class="detail-section skeleton-detail-section" aria-busy="true" :aria-label="t('pages.pokemon.loadingEdit')">
      <div v-for="index in 5" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '88px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>
  </section>
</template>
