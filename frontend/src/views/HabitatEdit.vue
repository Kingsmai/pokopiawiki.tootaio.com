<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import SwitchGroup from '../components/SwitchGroup.vue';
import TagsSelect from '../components/TagsSelect.vue';
import {
  api,
  type ConfigType,
  type HabitatDetail,
  type HabitatPayload,
  type Item,
  type Options,
  type Pokemon
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
const options = ref<Options | null>(null);
const itemRows = ref<Item[]>([]);
const pokemonRows = ref<Pokemon[]>([]);
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const habitatForm = ref({
  name: '',
  recipeItems: [] as Array<{ itemId: string; quantity: number }>,
  pokemonAppearances: [] as HabitatAppearanceForm[]
});

const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];
const timeOfDayOptions = timeOfDays.map((value) => ({ value, label: value }));
const weatherOptions = weathers.map((value) => ({ value, label: value }));
const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const itemSelectOptions = computed(() => itemRows.value.map((item) => ({ id: item.id, name: item.name })));
const pokemonSelectOptions = computed(() =>
  pokemonRows.value.map((pokemon) => ({ id: pokemon.id, name: pokemon.name, label: `#${pokemon.id} ${pokemon.name}` }))
);
const pageTitle = computed(() => (isEditing.value ? `编辑 ${habitatForm.value.name || '栖息地'}` : '新增栖息地'));
const cancelTo = computed(() => (isEditing.value ? `/habitats/${routeId.value}` : '/habitats'));

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

async function loadEditor() {
  loading.value = true;
  message.value = '';

  try {
    const [loadedOptions, loadedItems, loadedPokemon] = await Promise.all([api.options(), api.items({}), api.pokemon({})]);
    options.value = loadedOptions;
    itemRows.value = loadedItems;
    pokemonRows.value = loadedPokemon;

    if (isEditing.value) {
      const habitat = await api.habitatDetail(routeId.value);
      habitatForm.value = {
        name: habitat.name,
        recipeItems: habitat.recipe.map((recipeItem) => ({ itemId: String(recipeItem.id), quantity: recipeItem.quantity })),
        pokemonAppearances: groupPokemonAppearances(habitat)
      };
    }
  } catch (error) {
    message.value = errorText(error, '加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  options.value = await api.options();
}

async function createMultiOption(selectKey: string, type: ConfigType, name: string, values: string[]) {
  const cleanName = name.trim();
  if (!cleanName) return;

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
    message.value = errorText(error, '添加失败');
  } finally {
    creatingSelect.value = '';
  }
}

async function saveHabitat() {
  busy.value = true;
  message.value = '';

  try {
    const payload: HabitatPayload = {
      name: habitatForm.value.name,
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
    message.value = errorText(error, '保存失败');
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void loadEditor();
});
</script>

<template>
  <section class="page-stack">
    <PageHeader :title="pageTitle" subtitle="维护栖息地配方和可能出现的 Pokemon。">
      <template #kicker>Habitat Edit</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="cancelTo">返回</RouterLink>
      </template>
    </PageHeader>

    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" class="detail-section" @submit.prevent="saveHabitat">
      <div class="field">
        <label for="habitat-name">名称</label>
        <input id="habitat-name" v-model="habitatForm.name" required />
      </div>

      <div class="field">
        <label>配方</label>
        <div v-for="(row, index) in habitatForm.recipeItems" :key="index" class="inline-row">
          <TagsSelect
            :id="`habitat-recipe-item-${index}`"
            v-model="row.itemId"
            :options="itemSelectOptions"
            :multiple="false"
            placeholder="请选择"
            search-placeholder="搜索物品"
          />
          <input v-model.number="row.quantity" aria-label="数量" type="number" min="1" />
          <button type="button" @click="habitatForm.recipeItems.splice(index, 1)">删除</button>
        </div>
        <button type="button" class="plain-button" @click="addHabitatRecipeItem">添加物品</button>
      </div>

      <div class="field">
        <label>可出现的 Pokemon</label>
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
                search-placeholder="搜索 Pokemon"
              />
            </div>
            <SwitchGroup :id="`appearance-times-${index}`" v-model="row.timeOfDays" label="时间" :options="timeOfDayOptions" />
            <SwitchGroup :id="`appearance-weathers-${index}`" v-model="row.weathers" label="天气" :options="weatherOptions" />

            <div class="field appearance-row__rarity">
              <label :for="`appearance-rarity-${index}`">稀有度</label>
              <input :id="`appearance-rarity-${index}`" v-model.number="row.rarity" type="number" min="1" max="3" />
            </div>

            <button type="button" class="appearance-row__delete" @click="habitatForm.pokemonAppearances.splice(index, 1)">删除</button>
          </div>

          <div class="field appearance-row__maps">
            <label :for="`appearance-maps-${index}`">地图</label>
            <TagsSelect
              :id="`appearance-maps-${index}`"
              v-model="row.mapIds"
              :options="options.maps"
              allow-create
              :creating="creatingSelect === `appearance-maps-${index}`"
              placeholder="搜索地图"
              @create="createMultiOption(`appearance-maps-${index}`, 'maps', $event, row.mapIds)"
            />
          </div>
        </div>
        <button type="button" class="plain-button" @click="addPokemonAppearance">添加 Pokemon</button>
      </div>

      <div class="form-actions">
        <button type="submit" class="link-button" :disabled="busy">{{ busy ? '保存中' : '保存' }}</button>
        <RouterLink class="plain-button" :to="cancelTo">取消</RouterLink>
      </div>
    </form>

    <section v-else class="detail-section skeleton-detail-section" aria-busy="true" aria-label="正在加载栖息地编辑内容">
      <div v-for="index in 5" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '112px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>
  </section>
</template>
