<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityChips from '../components/EntityChips.vue';
import Modal from '../components/Modal.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect, { type TagsSelectOption } from '../components/TagsSelect.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TranslationFields from '../components/TranslationFields.vue';
import { iconAdd, iconCancel, iconDelete, iconDish, iconEdit, iconItem, iconSave } from '../icons';
import {
  api,
  getAuthToken,
  type AuthUser,
  type Dish,
  type DishCategory,
  type Item,
  type ItemLink,
  type Language,
  type NamedEntity,
  type Skill,
  type TranslationMap
} from '../services/api';

const { t } = useI18n();
const categories = ref<DishCategory[]>([]);
const activeCategoryId = ref('');
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const currentUser = ref<AuthUser | null>(null);
const languages = ref<Language[]>([]);
const items = ref<Item[]>([]);
const skills = ref<Skill[]>([]);
const dishFlavors = ref<NamedEntity[]>([]);
const dishCategoryModalOpen = ref(false);
const dishModalOpen = ref(false);
const dishCategoryForm = ref({
  id: 0,
  name: '',
  effect: '',
  translations: {} as TranslationMap,
  cookwareItemId: '',
  mainMaterialItemId: '',
  totalMaterialQuantity: 2
});
const dishForm = ref({
  id: 0,
  categoryId: '',
  itemId: '',
  flavorId: '',
  translations: {} as TranslationMap,
  secondaryMaterialItemIds: ['', ''],
  pokemonSkillId: '',
  mosslaxEffect: ''
});

const categoryTabs = computed<TabOption[]>(() =>
  categories.value.map((category) => ({ value: String(category.id), label: category.name }))
);
const activeCategory = computed(() =>
  categories.value.find((category) => String(category.id) === activeCategoryId.value) ?? categories.value[0] ?? null
);
const canCreateDish = computed(() => currentUser.value?.permissions.includes('dish.create') === true);
const canUpdateDish = computed(() => currentUser.value?.permissions.includes('dish.update') === true);
const canDeleteDish = computed(() => currentUser.value?.permissions.includes('dish.delete') === true);
const selectedDishFormCategory = computed(() => categories.value.find((category) => String(category.id) === dishForm.value.categoryId) ?? null);
const dishAllowsSecondSecondaryMaterial = computed(() => (selectedDishFormCategory.value?.totalMaterialQuantity ?? 0) > 2);
const dishCategoryModalTitle = computed(() =>
  dishCategoryForm.value.id ? t('pages.dish.editCategory') : t('pages.dish.newCategory')
);
const dishModalTitle = computed(() => (dishForm.value.id ? t('pages.dish.editDish') : t('pages.dish.newDish')));
const itemSelectOptions = computed<TagsSelectOption[]>(() =>
  items.value.map((item) => ({ id: item.id, name: item.name }))
);
const optionalItemSelectOptions = computed<TagsSelectOption[]>(() => [{ id: '', name: t('common.none') }, ...itemSelectOptions.value]);
const categorySelectOptions = computed<TagsSelectOption[]>(() => categories.value.map((category) => ({ id: category.id, name: category.name })));
const flavorSelectOptions = computed<TagsSelectOption[]>(() => dishFlavors.value.map((flavor) => ({ id: flavor.id, name: flavor.name })));
const optionalSkillSelectOptions = computed<TagsSelectOption[]>(() => [{ id: '', name: t('common.none') }, ...skills.value]);
const dishCategoryFormValid = computed(
  () =>
    dishCategoryForm.value.name.trim() !== '' &&
    dishCategoryForm.value.effect.trim() !== '' &&
    dishCategoryForm.value.cookwareItemId !== '' &&
    dishCategoryForm.value.mainMaterialItemId !== '' &&
    Number(dishCategoryForm.value.totalMaterialQuantity) >= 2
);
const dishFormValid = computed(
  () =>
    dishForm.value.categoryId !== '' &&
    dishForm.value.itemId !== '' &&
    dishForm.value.flavorId !== '' &&
    dishForm.value.mosslaxEffect.trim() !== ''
);

function itemImage(item: ItemLink) {
  return item.image ? { src: item.image.url, alt: t('media.imageAlt', { name: item.name }) } : null;
}

function resetDishCategoryForm() {
  dishCategoryForm.value = {
    id: 0,
    name: '',
    effect: '',
    translations: {},
    cookwareItemId: '',
    mainMaterialItemId: '',
    totalMaterialQuantity: 2
  };
}

function resetDishForm() {
  dishForm.value = {
    id: 0,
    categoryId: activeCategory.value ? String(activeCategory.value.id) : categories.value[0] ? String(categories.value[0].id) : '',
    itemId: '',
    flavorId: '',
    translations: {},
    secondaryMaterialItemIds: ['', ''],
    pokemonSkillId: '',
    mosslaxEffect: ''
  };
}

function openNewDishCategory() {
  resetDishCategoryForm();
  dishCategoryModalOpen.value = true;
}

function editDishCategory(category: DishCategory) {
  dishCategoryForm.value = {
    id: category.id,
    name: category.baseName ?? category.name,
    effect: category.baseEffect ?? category.effect,
    translations: category.translations ?? {},
    cookwareItemId: String(category.cookware.id),
    mainMaterialItemId: String(category.mainMaterial.id),
    totalMaterialQuantity: category.totalMaterialQuantity
  };
  dishCategoryModalOpen.value = true;
}

function closeDishCategoryModal() {
  dishCategoryModalOpen.value = false;
  resetDishCategoryForm();
}

function openNewDish() {
  resetDishForm();
  dishModalOpen.value = true;
}

function editDish(dish: Dish) {
  dishForm.value = {
    id: dish.id,
    categoryId: String(dish.category.id),
    itemId: String(dish.item.id),
    flavorId: String(dish.flavor.id),
    translations: dish.translations ?? {},
    secondaryMaterialItemIds: [String(dish.secondaryMaterials[0]?.id ?? ''), String(dish.secondaryMaterials[1]?.id ?? '')],
    pokemonSkillId: String(dish.pokemonSkill?.id ?? ''),
    mosslaxEffect: dish.baseMosslaxEffect ?? dish.mosslaxEffect
  };
  dishModalOpen.value = true;
}

function closeDishModal() {
  dishModalOpen.value = false;
  resetDishForm();
}

function dishCategoryPayloadForSave() {
  return {
    name: dishCategoryForm.value.name,
    effect: dishCategoryForm.value.effect,
    translations: dishCategoryForm.value.translations,
    cookwareItemId: Number(dishCategoryForm.value.cookwareItemId),
    mainMaterialItemId: Number(dishCategoryForm.value.mainMaterialItemId),
    totalMaterialQuantity: Number(dishCategoryForm.value.totalMaterialQuantity)
  };
}

function dishPayloadForSave() {
  const secondaryMaterialItemIds = dishForm.value.secondaryMaterialItemIds
    .map((itemId) => Number(itemId))
    .filter((itemId) => Number.isInteger(itemId) && itemId > 0);

  return {
    categoryId: Number(dishForm.value.categoryId),
    itemId: Number(dishForm.value.itemId),
    flavorId: Number(dishForm.value.flavorId),
    translations: dishForm.value.translations,
    secondaryMaterialItemIds: dishAllowsSecondSecondaryMaterial.value ? secondaryMaterialItemIds : secondaryMaterialItemIds.slice(0, 1),
    pokemonSkillId: dishForm.value.pokemonSkillId ? Number(dishForm.value.pokemonSkillId) : null,
    mosslaxEffect: dishForm.value.mosslaxEffect
  };
}

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : t('errors.operationFailed');
}

async function run(action: () => Promise<void>) {
  busy.value = true;
  message.value = '';
  try {
    await action();
  } catch (error) {
    message.value = errorText(error);
  } finally {
    busy.value = false;
  }
}

async function loadDish(showSkeleton = false) {
  if (showSkeleton) {
    loading.value = true;
  }
  categories.value = await api.dish();
  activeCategoryId.value = categories.value[0] ? String(categories.value[0].id) : '';
  loading.value = false;
}

async function saveDishCategory() {
  if (!dishCategoryFormValid.value) {
    return;
  }

  await run(async () => {
    const payload = dishCategoryPayloadForSave();
    if (dishCategoryForm.value.id) {
      await api.updateDishCategory(dishCategoryForm.value.id, payload);
    } else {
      await api.createDishCategory(payload);
    }
    await loadDish();
    closeDishCategoryModal();
  });
}

async function saveDish() {
  if (!dishFormValid.value) {
    return;
  }

  await run(async () => {
    const payload = dishPayloadForSave();
    if (dishForm.value.id) {
      await api.updateDish(dishForm.value.id, payload);
    } else {
      await api.createDish(payload);
    }
    await loadDish();
    closeDishModal();
  });
}

async function removeDishCategory(id: number) {
  await run(async () => {
    await api.deleteDishCategory(id);
    await loadDish();
  });
}

async function removeDish(id: number) {
  await run(async () => {
    await api.deleteDish(id);
    await loadDish();
  });
}

async function loadEditorOptions() {
  const [nextLanguages, nextItems, nextOptions] = await Promise.all([api.languages(), api.items({}), api.options()]);
  languages.value = nextLanguages;
  items.value = nextItems;
  skills.value = nextOptions.skills;
  dishFlavors.value = nextOptions.dishFlavors;
}

async function loadPage() {
  loading.value = true;
  if (getAuthToken()) {
    try {
      currentUser.value = (await api.me()).user;
    } catch {
      currentUser.value = null;
    }
  }
  await Promise.all([loadDish(), loadEditorOptions()]);
}

watch(categories, (nextCategories) => {
  if (!nextCategories.some((category) => String(category.id) === activeCategoryId.value)) {
    activeCategoryId.value = nextCategories[0] ? String(nextCategories[0].id) : '';
  }
});

watch(
  () => dishForm.value.categoryId,
  () => {
    if (!dishAllowsSecondSecondaryMaterial.value) {
      dishForm.value.secondaryMaterialItemIds[1] = '';
    }
  }
);

onMounted(loadPage);
</script>

<template>
  <section class="page-stack dish-page">
    <PageHeader :title="t('pages.dish.title')" :subtitle="t('pages.dish.subtitle')">
      <template #kicker>{{ t('pages.dish.kicker') }}</template>
      <template #actions>
        <button v-if="canCreateDish" type="button" class="ui-button ui-button--primary ui-button--small" :disabled="busy" @click="openNewDishCategory">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('pages.dish.newCategory') }}
        </button>
        <button v-if="canCreateDish" type="button" class="ui-button ui-button--blue ui-button--small" :disabled="busy || !categories.length" @click="openNewDish">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('pages.dish.newDish') }}
        </button>
      </template>
    </PageHeader>

    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <div v-if="loading" class="tabs tabs--component" aria-hidden="true">
      <div class="tab-list tab-list--skeleton">
        <Skeleton v-for="width in ['86px', '112px', '96px']" :key="width" variant="box" :width="width" height="42px" class="skeleton-tab" />
      </div>
    </div>
    <Tabs v-else-if="categoryTabs.length" id="dish-category-tabs" v-model="activeCategoryId" :tabs="categoryTabs" :label="t('pages.dish.category')" />

    <section v-if="loading" class="detail-section dish-category-panel" aria-busy="true" :aria-label="t('pages.dish.loading')">
      <div class="dish-category-summary">
        <Skeleton variant="box" width="96px" height="96px" class="skeleton-entity-mark" />
        <div class="dish-category-summary__content">
          <Skeleton width="180px" height="28px" />
          <Skeleton width="100%" />
          <Skeleton width="72%" />
        </div>
      </div>
      <div class="dish-grid">
        <article v-for="index in 4" :key="`dish-skeleton-${index}`" class="dish-card">
          <Skeleton variant="box" width="72px" height="72px" class="skeleton-entity-mark" />
          <div class="dish-card__content">
            <Skeleton width="140px" height="24px" />
            <Skeleton width="92px" />
            <Skeleton width="100%" />
          </div>
        </article>
      </div>
    </section>

    <section v-else-if="activeCategory" class="detail-section dish-category-panel">
      <div class="dish-category-summary">
        <RouterLink class="dish-media-link" :to="`/items/${activeCategory.cookware.id}`">
          <img
            v-if="itemImage(activeCategory.cookware)"
            :src="itemImage(activeCategory.cookware)?.src"
            :alt="itemImage(activeCategory.cookware)?.alt"
            loading="lazy"
          />
          <Icon v-else :icon="iconDish" class="entity-card__icon" aria-hidden="true" />
        </RouterLink>
        <div class="dish-category-summary__content">
          <h2>{{ activeCategory.name }}</h2>
          <dl class="info-list">
            <div>
              <dt>{{ t('pages.dish.cookware') }}</dt>
              <dd>
                <RouterLink :to="`/items/${activeCategory.cookware.id}`">{{ activeCategory.cookware.name }}</RouterLink>
              </dd>
            </div>
            <div>
              <dt>{{ t('pages.dish.totalMaterialQuantity') }}</dt>
              <dd>{{ activeCategory.totalMaterialQuantity }}</dd>
            </div>
            <div>
              <dt>{{ t('pages.dish.mainMaterial') }}</dt>
              <dd>
                <RouterLink :to="`/items/${activeCategory.mainMaterial.id}`">{{ activeCategory.mainMaterial.name }}</RouterLink>
              </dd>
            </div>
          </dl>
          <div class="dish-category-effect-row">
            <strong>{{ t('pages.dish.effect') }}</strong>
            <span>{{ activeCategory.effect }}</span>
          </div>
          <div v-if="canUpdateDish || canDeleteDish" class="row-actions">
            <button v-if="canUpdateDish" type="button" :disabled="busy" @click="editDishCategory(activeCategory)">
              <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
              {{ t('common.edit') }}
            </button>
            <button v-if="canDeleteDish" type="button" :disabled="busy" @click="removeDishCategory(activeCategory.id)">
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>

      <div class="dish-grid">
        <article v-for="dish in activeCategory.dishes" :key="dish.id" class="dish-card">
          <RouterLink class="dish-media-link dish-media-link--small" :to="`/items/${dish.item.id}`">
            <img v-if="dish.item.image" :src="dish.item.image.url" :alt="t('media.imageAlt', { name: dish.item.name })" loading="lazy" />
            <Icon v-else :icon="iconItem" class="entity-card__icon" aria-hidden="true" />
          </RouterLink>
          <div class="dish-card__content">
            <RouterLink class="dish-card__title" :to="`/items/${dish.item.id}`">{{ dish.item.name }}</RouterLink>
            <div class="dish-card__meta">
              <span>{{ dish.flavor.name }}</span>
              <span v-if="dish.pokemonSkill">{{ dish.pokemonSkill.name }}</span>
            </div>
            <dl class="info-list info-list--compact">
              <div>
                <dt>{{ t('pages.dish.secondaryMaterials') }}</dt>
                <dd>
                  <EntityChips v-if="dish.secondaryMaterials.length" :items="dish.secondaryMaterials" />
                  <span v-else>{{ t('common.none') }}</span>
                </dd>
              </div>
              <div>
                <dt>{{ t('pages.dish.mosslaxEffect') }}</dt>
                <dd>{{ dish.mosslaxEffect }}</dd>
              </div>
            </dl>
            <div v-if="canUpdateDish || canDeleteDish" class="row-actions">
              <button v-if="canUpdateDish" type="button" :disabled="busy" @click="editDish(dish)">
                <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
                {{ t('common.edit') }}
              </button>
              <button v-if="canDeleteDish" type="button" :disabled="busy" @click="removeDish(dish.id)">
                <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </article>
      </div>
      <p v-if="!activeCategory.dishes.length" class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <section v-else class="detail-section">
      <p class="meta-line">{{ t('common.noRecords') }}</p>
    </section>

    <Modal v-if="dishCategoryModalOpen" :title="dishCategoryModalTitle" :close-label="t('common.close')" size="wide" @close="closeDishCategoryModal">
      <form id="dish-category-form" class="modal-edit-form dish-form-stack" @submit.prevent="saveDishCategory">
        <div class="dish-form-row dish-form-row--4">
          <TranslationFields
            id-prefix="dish-category-name"
            v-model:base-value="dishCategoryForm.name"
            v-model:translations="dishCategoryForm.translations"
            field="name"
            :label="t('common.name')"
            :languages="languages"
            required
          />
          <div class="field">
            <label for="dish-category-cookware">{{ t('pages.dish.cookware') }}</label>
            <TagsSelect
              id="dish-category-cookware"
              v-model="dishCategoryForm.cookwareItemId"
              :options="itemSelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
          <div class="field">
            <label for="dish-category-total-material-quantity">{{ t('pages.dish.totalMaterialQuantity') }}</label>
            <input id="dish-category-total-material-quantity" v-model.number="dishCategoryForm.totalMaterialQuantity" type="number" min="2" required />
          </div>
          <div class="field">
            <label for="dish-category-main-material">{{ t('pages.dish.mainMaterial') }}</label>
            <TagsSelect
              id="dish-category-main-material"
              v-model="dishCategoryForm.mainMaterialItemId"
              :options="itemSelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
        </div>
        <TranslationFields
          id-prefix="dish-category-effect"
          v-model:base-value="dishCategoryForm.effect"
          v-model:translations="dishCategoryForm.translations"
          field="effect"
          :label="t('pages.dish.effect')"
          :languages="languages"
          required
        />
      </form>

      <template #footer>
        <button type="submit" form="dish-category-form" class="link-button" :disabled="busy || !dishCategoryFormValid">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeDishCategoryModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>

    <Modal v-if="dishModalOpen" :title="dishModalTitle" :close-label="t('common.close')" size="wide" @close="closeDishModal">
      <form id="dish-form" class="modal-edit-form dish-form-stack" @submit.prevent="saveDish">
        <div class="dish-form-row dish-form-row--3">
          <div class="field">
            <label for="dish-category">{{ t('pages.dish.category') }}</label>
            <TagsSelect
              id="dish-category"
              v-model="dishForm.categoryId"
              :options="categorySelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.dish.category')"
            />
          </div>
          <div class="field">
            <label for="dish-item">{{ t('pages.dish.dishItem') }}</label>
            <TagsSelect
              id="dish-item"
              v-model="dishForm.itemId"
              :options="itemSelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
          <div class="field">
            <label for="dish-flavor">{{ t('pages.dish.flavor') }}</label>
            <TagsSelect
              id="dish-flavor"
              v-model="dishForm.flavorId"
              :options="flavorSelectOptions"
              :multiple="false"
              :placeholder="t('common.select')"
              :search-placeholder="t('pages.dish.flavor')"
            />
          </div>
        </div>
        <div class="dish-form-row dish-form-row--3">
          <div class="field">
            <label for="dish-secondary-material-1">{{ t('pages.dish.secondaryMaterial') }}</label>
            <TagsSelect
              id="dish-secondary-material-1"
              v-model="dishForm.secondaryMaterialItemIds[0]"
              :options="optionalItemSelectOptions"
              :multiple="false"
              :placeholder="t('common.none')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
          <div v-if="dishAllowsSecondSecondaryMaterial" class="field">
            <label for="dish-secondary-material-2">{{ t('pages.dish.secondSecondaryMaterial') }}</label>
            <TagsSelect
              id="dish-secondary-material-2"
              v-model="dishForm.secondaryMaterialItemIds[1]"
              :options="optionalItemSelectOptions"
              :multiple="false"
              :placeholder="t('common.none')"
              :search-placeholder="t('pages.pokemon.searchItems')"
            />
          </div>
          <div class="field">
            <label for="dish-pokemon-skill">{{ t('pages.dish.pokemonSkill') }}</label>
            <TagsSelect
              id="dish-pokemon-skill"
              v-model="dishForm.pokemonSkillId"
              :options="optionalSkillSelectOptions"
              :multiple="false"
              :placeholder="t('common.none')"
              :search-placeholder="t('pages.dish.pokemonSkill')"
            />
          </div>
        </div>
        <TranslationFields
          id-prefix="dish-mosslax-effect"
          v-model:base-value="dishForm.mosslaxEffect"
          v-model:translations="dishForm.translations"
          field="mosslaxEffect"
          :label="t('pages.dish.mosslaxEffect')"
          :languages="languages"
          required
        />
      </form>

      <template #footer>
        <button type="submit" form="dish-form" class="link-button" :disabled="busy || !dishFormValid">
          <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="plain-button" :disabled="busy" @click="closeDishModal">
          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
          {{ t('common.cancel') }}
        </button>
      </template>
    </Modal>
  </section>
</template>
