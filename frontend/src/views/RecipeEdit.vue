<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import Modal from '../components/Modal.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { iconAdd, iconCancel, iconDelete, iconSave } from '../icons';
import { api, type AuthUser, type ConfigType, type Item, type Options, type RecipePayload } from '../services/api';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const options = ref<Options | null>(null);
const itemRows = ref<Item[]>([]);
const currentUser = ref<AuthUser | null>(null);
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
const materialItemOptions = computed(() => itemRows.value.map((item) => ({ id: item.id, name: item.name, thumbnailUrl: item.image?.url })));
const resultItemOptions = computed(() =>
  itemRows.value
    .filter((item) => !item.noRecipe || String(item.id) === recipeForm.value.itemId)
    .map((item) => ({ id: item.id, name: item.name, thumbnailUrl: item.image?.url }))
);
const selectedItemName = computed(() => resultItemOptions.value.find((item) => String(item.id) === recipeForm.value.itemId)?.name ?? '');
const pageTitle = computed(() =>
  isEditing.value
    ? t('pages.recipes.editTitle', { name: selectedItemName.value || t('pages.recipes.fallbackName') })
    : t('pages.recipes.newTitle')
);
const cancelTo = computed(() => (isEditing.value ? `/recipes/${routeId.value}` : '/recipes'));
const canCreateConfig = computed(() => currentUser.value?.permissions.includes('admin.config.create') === true);

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

function closeEditor() {
  void router.push(cancelTo.value);
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
    const [, loadedOptions, loadedItems] = await Promise.all([loadCurrentUser(), api.options(), api.items({})]);
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

async function loadCurrentUser() {
  try {
    currentUser.value = (await api.me()).user;
  } catch {
    currentUser.value = null;
  }
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
  <Modal :title="pageTitle" :subtitle="t('pages.recipes.editSubtitle')" :close-label="t('common.close')" size="wide" @close="closeEditor">
    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" id="recipe-edit-form" class="modal-edit-form" @submit.prevent="saveRecipe">
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
          :allow-create="canCreateConfig"
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
          <button type="button" @click="recipeForm.materials.splice(index, 1)">
            <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
            {{ t('common.delete') }}
          </button>
        </div>
        <button type="button" class="plain-button" @click="addRecipeMaterial">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('pages.recipes.addMaterial') }}
        </button>
      </div>
    </form>

    <section v-else class="modal-edit-form skeleton-detail-section" aria-busy="true" :aria-label="t('pages.recipes.loadingEdit')">
      <div v-for="index in 4" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '88px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>

    <template v-if="!loading && options" #footer>
      <button type="submit" form="recipe-edit-form" class="link-button" :disabled="busy">
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
