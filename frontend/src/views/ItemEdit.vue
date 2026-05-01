<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import TranslationFields from '../components/TranslationFields.vue';
import { api, type ConfigType, type ItemPayload, type Language, type Options, type TranslationMap } from '../services/api';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const options = ref<Options | null>(null);
const languages = ref<Language[]>([]);
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const itemForm = ref({
  name: '',
  translations: {} as TranslationMap,
  categoryId: '',
  usageId: '',
  dyeable: false,
  dualDyeable: false,
  patternEditable: false,
  noRecipe: false,
  acquisitionMethodIds: [] as string[],
  tagIds: [] as string[]
});

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const pageTitle = computed(() =>
  isEditing.value
    ? t('pages.items.editTitle', { name: itemForm.value.name || t('pages.items.fallbackName') })
    : t('pages.items.newTitle')
);
const cancelTo = computed(() => (isEditing.value ? `/items/${routeId.value}` : '/items'));
const hasRecipe = ref(false);

function toIds(values: string[]): number[] {
  return values.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function loadOptions() {
  const [loadedOptions, loadedLanguages] = await Promise.all([api.options(), api.languages()]);
  options.value = loadedOptions;
  languages.value = loadedLanguages;
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
        translations: item.translations ?? {},
        categoryId: String(item.category.id),
        usageId: item.usage ? String(item.usage.id) : '',
        dyeable: item.customization.dyeable,
        dualDyeable: item.customization.dualDyeable,
        patternEditable: item.customization.patternEditable,
        noRecipe: item.noRecipe,
        acquisitionMethodIds: item.acquisitionMethods.map((method) => String(method.id)),
        tagIds: item.tags.map((tag) => String(tag.id))
      };
      hasRecipe.value = item.recipe !== null;
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

async function saveItem() {
  busy.value = true;
  message.value = '';

  try {
    const payload: ItemPayload = {
      name: itemForm.value.name,
      translations: itemForm.value.translations,
      categoryId: Number(itemForm.value.categoryId),
      usageId: itemForm.value.usageId ? Number(itemForm.value.usageId) : null,
      dyeable: itemForm.value.dyeable,
      dualDyeable: itemForm.value.dualDyeable,
      patternEditable: itemForm.value.patternEditable,
      noRecipe: itemForm.value.noRecipe,
      acquisitionMethodIds: toIds(itemForm.value.acquisitionMethodIds),
      tagIds: toIds(itemForm.value.tagIds)
    };
    const saved = isEditing.value ? await api.updateItem(routeId.value, payload) : await api.createItem(payload);
    await router.push(`/items/${saved.id}`);
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
    <PageHeader :title="pageTitle" :subtitle="t('pages.items.editSubtitle')">
      <template #kicker>Item Edit</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="cancelTo">{{ t('common.back') }}</RouterLink>
      </template>
    </PageHeader>

    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" class="detail-section" @submit.prevent="saveItem">
      <TranslationFields
        id-prefix="item-name"
        v-model:base-value="itemForm.name"
        v-model:translations="itemForm.translations"
        field="name"
        :label="t('common.name')"
        :languages="languages"
        required
      />

      <div class="field">
        <label for="item-category">{{ t('pages.items.category') }}</label>
        <TagsSelect
          id="item-category"
          v-model="itemForm.categoryId"
          :options="options.itemCategories"
          :multiple="false"
          allow-create
          :creating="creatingSelect === 'item-category'"
          :placeholder="t('common.select')"
          :search-placeholder="t('pages.items.searchCategory')"
          @create="createSingleOption('item-category', 'item-categories', $event, (value) => (itemForm.categoryId = value))"
        />
      </div>

      <div class="field">
        <label for="item-usage">{{ t('pages.items.usage') }}</label>
        <TagsSelect
          id="item-usage"
          v-model="itemForm.usageId"
          :options="options.itemUsages"
          :multiple="false"
          allow-create
          :creating="creatingSelect === 'item-usage'"
          :placeholder="t('common.none')"
          :search-placeholder="t('pages.items.searchUsage')"
          @create="createSingleOption('item-usage', 'item-usages', $event, (value) => (itemForm.usageId = value))"
        />
      </div>

      <div class="check-row">
        <label><input v-model="itemForm.dyeable" type="checkbox" /> {{ t('pages.items.dyeable') }}</label>
        <label><input v-model="itemForm.dualDyeable" type="checkbox" /> {{ t('pages.items.dualDyeable') }}</label>
        <label><input v-model="itemForm.patternEditable" type="checkbox" /> {{ t('pages.items.patternEditable') }}</label>
        <label><input v-model="itemForm.noRecipe" type="checkbox" :disabled="hasRecipe" /> {{ t('pages.items.noRecipe') }}</label>
      </div>

      <div class="field">
        <label for="item-methods">{{ t('pages.items.acquisitionMethods') }}</label>
        <TagsSelect
          id="item-methods"
          v-model="itemForm.acquisitionMethodIds"
          :options="options.acquisitionMethods"
          allow-create
          :creating="creatingSelect === 'item-methods'"
          :placeholder="t('pages.items.searchMethods')"
          @create="createMultiOption('item-methods', 'acquisition-methods', $event, itemForm.acquisitionMethodIds)"
        />
      </div>

      <div class="field">
        <label for="item-tags">{{ t('pages.items.tags') }}</label>
        <TagsSelect
          id="item-tags"
          v-model="itemForm.tagIds"
          :options="options.itemTags"
          allow-create
          :creating="creatingSelect === 'item-tags'"
          :placeholder="t('pages.items.searchTags')"
          @create="createMultiOption('item-tags', 'favorite-things', $event, itemForm.tagIds)"
        />
      </div>

      <div class="form-actions">
        <button type="submit" class="link-button" :disabled="busy">{{ busy ? t('common.saving') : t('common.save') }}</button>
        <RouterLink class="plain-button" :to="cancelTo">{{ t('common.cancel') }}</RouterLink>
      </div>
    </form>

    <section v-else class="detail-section skeleton-detail-section" aria-busy="true" :aria-label="t('pages.items.loadingEdit')">
      <div v-for="index in 6" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '88px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>
  </section>
</template>
