<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { api, type ConfigType, type Item, type Options, type RecipePayload } from '../services/api';

const route = useRoute();
const router = useRouter();
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
const itemSelectOptions = computed(() => itemRows.value.map((item) => ({ id: item.id, name: item.name })));
const selectedItemName = computed(() => itemSelectOptions.value.find((item) => String(item.id) === recipeForm.value.itemId)?.name ?? '');
const pageTitle = computed(() => (isEditing.value ? `编辑 ${selectedItemName.value || '材料单'}` : '新增材料单'));
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
    }
  } catch (error) {
    message.value = errorText(error, '加载失败');
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
    const created = await api.createConfig(type, { name: cleanName, subcategory: null });
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
    <PageHeader :title="pageTitle" subtitle="维护材料单结果物品、入手方式和需要材料。">
      <template #kicker>Recipe Edit</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="cancelTo">返回</RouterLink>
      </template>
    </PageHeader>

    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" class="detail-section" @submit.prevent="saveRecipe">
      <div class="field">
        <label for="recipe-item">物品</label>
        <TagsSelect
          id="recipe-item"
          v-model="recipeForm.itemId"
          :options="itemSelectOptions"
          :multiple="false"
          placeholder="请选择"
          search-placeholder="搜索物品"
        />
      </div>

      <div class="field">
        <label for="recipe-methods">入手方式</label>
        <TagsSelect
          id="recipe-methods"
          v-model="recipeForm.acquisitionMethodIds"
          :options="options.acquisitionMethods"
          allow-create
          :creating="creatingSelect === 'recipe-methods'"
          placeholder="搜索入手方式"
          @create="createMultiOption('recipe-methods', 'acquisition-methods', $event, recipeForm.acquisitionMethodIds)"
        />
      </div>

      <div class="field">
        <label>需要材料</label>
        <div v-for="(row, index) in recipeForm.materials" :key="index" class="inline-row">
          <TagsSelect
            :id="`recipe-material-${index}`"
            v-model="row.itemId"
            :options="itemSelectOptions"
            :multiple="false"
            placeholder="请选择"
            search-placeholder="搜索物品"
          />
          <input v-model.number="row.quantity" aria-label="数量" type="number" min="1" />
          <button type="button" @click="recipeForm.materials.splice(index, 1)">删除</button>
        </div>
        <button type="button" class="plain-button" @click="addRecipeMaterial">添加材料</button>
      </div>

      <div class="form-actions">
        <button type="submit" class="link-button" :disabled="busy">{{ busy ? '保存中' : '保存' }}</button>
        <RouterLink class="plain-button" :to="cancelTo">取消</RouterLink>
      </div>
    </form>

    <section v-else class="detail-section skeleton-detail-section" aria-busy="true" aria-label="正在加载材料单编辑内容">
      <div v-for="index in 4" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '88px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>
  </section>
</template>
