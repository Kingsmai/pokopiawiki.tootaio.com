<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { api, type ConfigType, type ItemPayload, type Options } from '../services/api';

const route = useRoute();
const router = useRouter();
const options = ref<Options | null>(null);
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const itemForm = ref({
  name: '',
  categoryId: '',
  usageId: '',
  dyeable: false,
  dualDyeable: false,
  patternEditable: false,
  acquisitionMethodIds: [] as string[],
  tagIds: [] as string[]
});

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const pageTitle = computed(() => (isEditing.value ? `编辑 ${itemForm.value.name || '物品'}` : '新增物品'));
const cancelTo = computed(() => (isEditing.value ? `/items/${routeId.value}` : '/items'));

function toIds(values: string[]): number[] {
  return values.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function loadOptions() {
  options.value = await api.options();
}

async function loadEditor() {
  loading.value = true;
  message.value = '';

  try {
    await loadOptions();
    if (isEditing.value) {
      const item = await api.itemDetail(routeId.value);
      itemForm.value = {
        name: item.name,
        categoryId: String(item.category.id),
        usageId: item.usage ? String(item.usage.id) : '',
        dyeable: item.customization.dyeable,
        dualDyeable: item.customization.dualDyeable,
        patternEditable: item.customization.patternEditable,
        acquisitionMethodIds: item.acquisitionMethods.map((method) => String(method.id)),
        tagIds: item.tags.map((tag) => String(tag.id))
      };
    }
  } catch (error) {
    message.value = errorText(error, '加载失败');
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
    const created = await api.createConfig(type, { name: cleanName, subcategory: null });
    await loadOptions();
    assign(String(created.id));
  } catch (error) {
    message.value = errorText(error, '添加失败');
  } finally {
    creatingSelect.value = '';
  }
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

async function saveItem() {
  busy.value = true;
  message.value = '';

  try {
    const payload: ItemPayload = {
      name: itemForm.value.name,
      categoryId: Number(itemForm.value.categoryId),
      usageId: itemForm.value.usageId ? Number(itemForm.value.usageId) : null,
      dyeable: itemForm.value.dyeable,
      dualDyeable: itemForm.value.dualDyeable,
      patternEditable: itemForm.value.patternEditable,
      acquisitionMethodIds: toIds(itemForm.value.acquisitionMethodIds),
      tagIds: toIds(itemForm.value.tagIds)
    };
    const saved = isEditing.value ? await api.updateItem(routeId.value, payload) : await api.createItem(payload);
    await router.push(`/items/${saved.id}`);
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
    <PageHeader :title="pageTitle" subtitle="维护物品分类、用途、入手方式、自定义和标签。">
      <template #kicker>Item Edit</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="cancelTo">返回</RouterLink>
      </template>
    </PageHeader>

    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" class="detail-section" @submit.prevent="saveItem">
      <div class="field">
        <label for="item-name">名称</label>
        <input id="item-name" v-model="itemForm.name" required />
      </div>

      <div class="field">
        <label for="item-category">分类</label>
        <TagsSelect
          id="item-category"
          v-model="itemForm.categoryId"
          :options="options.itemCategories"
          :multiple="false"
          allow-create
          :creating="creatingSelect === 'item-category'"
          placeholder="请选择"
          search-placeholder="搜索分类"
          @create="createSingleOption('item-category', 'item-categories', $event, (value) => (itemForm.categoryId = value))"
        />
      </div>

      <div class="field">
        <label for="item-usage">用途</label>
        <TagsSelect
          id="item-usage"
          v-model="itemForm.usageId"
          :options="options.itemUsages"
          :multiple="false"
          allow-create
          :creating="creatingSelect === 'item-usage'"
          placeholder="无"
          search-placeholder="搜索用途"
          @create="createSingleOption('item-usage', 'item-usages', $event, (value) => (itemForm.usageId = value))"
        />
      </div>

      <div class="check-row">
        <label><input v-model="itemForm.dyeable" type="checkbox" /> 可染色</label>
        <label><input v-model="itemForm.dualDyeable" type="checkbox" /> 可双区染色</label>
        <label><input v-model="itemForm.patternEditable" type="checkbox" /> 可改花纹</label>
      </div>

      <div class="field">
        <label for="item-methods">入手方式</label>
        <TagsSelect
          id="item-methods"
          v-model="itemForm.acquisitionMethodIds"
          :options="options.acquisitionMethods"
          allow-create
          :creating="creatingSelect === 'item-methods'"
          placeholder="搜索入手方式"
          @create="createMultiOption('item-methods', 'acquisition-methods', $event, itemForm.acquisitionMethodIds)"
        />
      </div>

      <div class="field">
        <label for="item-tags">标签</label>
        <TagsSelect
          id="item-tags"
          v-model="itemForm.tagIds"
          :options="options.itemTags"
          allow-create
          :creating="creatingSelect === 'item-tags'"
          placeholder="搜索标签"
          @create="createMultiOption('item-tags', 'favorite-things', $event, itemForm.tagIds)"
        />
      </div>

      <div class="form-actions">
        <button type="submit" class="link-button" :disabled="busy">{{ busy ? '保存中' : '保存' }}</button>
        <RouterLink class="plain-button" :to="cancelTo">取消</RouterLink>
      </div>
    </form>

    <section v-else class="detail-section skeleton-detail-section" aria-busy="true" aria-label="正在加载物品编辑内容">
      <div v-for="index in 6" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '88px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>
  </section>
</template>
