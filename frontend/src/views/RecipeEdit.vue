<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { api, type ConfigType, type Item, type Options, type RecipePayload } from '../services/api';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const options = ref<Options | null>(null);
const itemRows = ref<Item[]>([]);
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const recipeForm = ref({
  itemId: '',
  acquisitionMethodIds: [] as string[],
  materials: [] as Array<{ itemId: string; quantity: number }>
});

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const materialItemOptions = computed(() => itemRows.value.map((item) => ({ id: item.id, name: item.name })));
const resultItemOptions = computed(() =>
  itemRows.value
    .filter((item) => !item.noRecipe || String(item.id) === recipeForm.value.itemId)
    .map((item) => ({ id: item.id, name: item.name }))
);
const selectedItemName = computed(() => resultItemOptions.value.find((item) => String(item.id) === recipeForm.value.itemId)?.name ?? '');
const pageTitle = computed(() =>
  isEditing.value
    ? t('pages.recipes.editTitle', { name: selectedItemName.value || t('pages.recipes.fallbackName') })
    : t('pages.recipes.newTitle')
);
const cancelTo = computed(() => (isEditing.value ? `/recipes/${routeId.value}` : '/recipes'));

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

function preselectedItemId() {
  const itemId = route.query.itemId;
  if (typeof itemId !== 'string') {
    return '';
  }

  return resultItemOptions.value.some((item) => String(item.id) === itemId) ? itemId : '';
}

async function loadEditor() {
  loading.value = true;
  message.value = '';

  try {
    const [loadedOptions, loadedItems] = await Promise.all([api.options(), api.items({})]);
    options.value = loadedOptions;
    itemRows.value = loadedItems;

    if (isEditing.value) {
      const recipe = await api.recipeDetail(routeId.value);
      recipeForm.value = {
        itemId: String(recipe.item.id),
        acquisitionMethodIds: recipe.acquisition_methods.map((method) => String(method.id)),
        materials: recipe.materials.map((material) => ({ itemId: String(material.id), quantity: material.quantity }))
      };
    } else {
      recipeForm.value.itemId = preselectedItemId();
    }
  } catch (error) {
    message.value = errorText(error, t('errors.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function addRecipeMaterial() {
  recipeForm.value.materials.push({ itemId: '', quantity: 1 });
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
    message.value = errorText(error, t('errors.addFailed'));
  } finally {
    creatingSelect.value = '';
  }
}

async function saveRecipe() {
  busy.value = true;
  message.value = '';

  try {
    const payload: RecipePayload = {
      itemId: Number(recipeForm.value.itemId),
      acquisitionMethodIds: toIds(recipeForm.value.acquisitionMethodIds),
      materials: toQuantityRows(recipeForm.value.materials)
    };
    const saved = isEditing.value ? await api.updateRecipe(routeId.value, payload) : await api.createRecipe(payload);
    await router.push(`/recipes/${saved.id}`);
  } catch (error) {
    message.value = errorText(error, t('errors.saveFailed'));
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
    <PageHeader :title="pageTitle" :subtitle="t('pages.recipes.editSubtitle')">
      <template #kicker>Recipe Edit</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="cancelTo">{{ t('common.back') }}</RouterLink>
      </template>
    </PageHeader>

    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" class="detail-section" @submit.prevent="saveRecipe">
      <div class="field">
        <label for="recipe-item">{{ t('pages.recipes.item') }}</label>
        <TagsSelect
          id="recipe-item"
          v-model="recipeForm.itemId"
          :options="resultItemOptions"
          :multiple="false"
          :placeholder="t('common.select')"
          :search-placeholder="t('pages.pokemon.searchItems')"
        />
      </div>

      <div class="field">
        <label for="recipe-methods">{{ t('pages.items.acquisitionMethods') }}</label>
        <TagsSelect
          id="recipe-methods"
          v-model="recipeForm.acquisitionMethodIds"
          :options="options.acquisitionMethods"
          allow-create
          :creating="creatingSelect === 'recipe-methods'"
          :placeholder="t('pages.items.searchMethods')"
          @create="createMultiOption('recipe-methods', 'acquisition-methods', $event, recipeForm.acquisitionMethodIds)"
        />
      </div>

      <div class="field">
        <label>{{ t('pages.recipes.materials') }}</label>
        <div v-for="(row, index) in recipeForm.materials" :key="index" class="inline-row">
          <TagsSelect
            :id="`recipe-material-${index}`"
            v-model="row.itemId"
            :options="materialItemOptions"
            :multiple="false"
            :placeholder="t('common.select')"
            :search-placeholder="t('pages.pokemon.searchItems')"
          />
          <input v-model.number="row.quantity" :aria-label="t('common.quantity')" type="number" min="1" />
          <button type="button" @click="recipeForm.materials.splice(index, 1)">{{ t('common.delete') }}</button>
        </div>
        <button type="button" class="plain-button" @click="addRecipeMaterial">{{ t('pages.recipes.addMaterial') }}</button>
      </div>

      <div class="form-actions">
        <button type="submit" class="link-button" :disabled="busy">{{ busy ? t('common.saving') : t('common.save') }}</button>
        <RouterLink class="plain-button" :to="cancelTo">{{ t('common.cancel') }}</RouterLink>
      </div>
    </form>

    <section v-else class="detail-section skeleton-detail-section" aria-busy="true" :aria-label="t('pages.recipes.loadingEdit')">
      <div v-for="index in 4" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '88px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>
  </section>
</template>
