<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { api, type ConfigType, type Options, type PokemonPayload } from '../services/api';

const route = useRoute();
const router = useRouter();
const options = ref<Options | null>(null);
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const creatingSelect = ref('');
const pokemonForm = ref({
  id: '',
  name: '',
  environmentId: '',
  skillIds: [] as string[],
  favoriteThingIds: [] as string[]
});

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => routeId.value !== '');
const pageTitle = computed(() => (isEditing.value ? `编辑 #${pokemonForm.value.id || routeId.value} ${pokemonForm.value.name}` : '新增 Pokemon'));
const cancelTo = computed(() => (isEditing.value ? `/pokemon/${routeId.value}` : '/pokemon'));

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
      const pokemon = await api.pokemonDetail(routeId.value);
      pokemonForm.value = {
        id: String(pokemon.id),
        name: pokemon.name,
        environmentId: String(pokemon.environment.id),
        skillIds: pokemon.skills.map((skill) => String(skill.id)),
        favoriteThingIds: pokemon.favorite_things.map((thing) => String(thing.id))
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

async function createMultiOption(selectKey: string, type: ConfigType, name: string, values: string[], max = 0) {
  const cleanName = name.trim();
  if (!cleanName || (max > 0 && values.length >= max)) return;

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

async function savePokemon() {
  busy.value = true;
  message.value = '';

  try {
    const payload: PokemonPayload = {
      id: Number(isEditing.value ? routeId.value : pokemonForm.value.id),
      name: pokemonForm.value.name,
      environmentId: Number(pokemonForm.value.environmentId),
      skillIds: toIds(pokemonForm.value.skillIds.slice(0, 2)),
      favoriteThingIds: toIds(pokemonForm.value.favoriteThingIds.slice(0, 6))
    };
    const saved = isEditing.value ? await api.updatePokemon(routeId.value, payload) : await api.createPokemon(payload);
    await router.push(`/pokemon/${saved.id}`);
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
    <PageHeader :title="pageTitle" subtitle="维护 Pokemon 基本资料、特长和喜欢的东西。">
      <template #kicker>Pokédex Edit</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--blue ui-button--small" :to="cancelTo">返回</RouterLink>
      </template>
    </PageHeader>

    <StatusMessage v-if="message" variant="danger">{{ message }}</StatusMessage>

    <form v-if="!loading && options" class="detail-section" @submit.prevent="savePokemon">
      <div class="field">
        <label for="pokemon-id">ID</label>
        <input id="pokemon-id" v-model="pokemonForm.id" :disabled="isEditing" min="1" required type="number" />
      </div>

      <div class="field">
        <label for="pokemon-name">名字</label>
        <input id="pokemon-name" v-model="pokemonForm.name" required />
      </div>

      <div class="field">
        <label for="pokemon-environment">喜欢的环境</label>
        <TagsSelect
          id="pokemon-environment"
          v-model="pokemonForm.environmentId"
          :options="options.environments"
          :multiple="false"
          allow-create
          :creating="creatingSelect === 'pokemon-environment'"
          placeholder="请选择"
          search-placeholder="搜索喜欢的环境"
          @create="createSingleOption('pokemon-environment', 'environments', $event, (value) => (pokemonForm.environmentId = value))"
        />
      </div>

      <div class="field">
        <label for="pokemon-skills">特长</label>
        <TagsSelect
          id="pokemon-skills"
          v-model="pokemonForm.skillIds"
          :options="options.skills"
          :max="2"
          allow-create
          :creating="creatingSelect === 'pokemon-skills'"
          placeholder="搜索特长"
          @create="createMultiOption('pokemon-skills', 'skills', $event, pokemonForm.skillIds, 2)"
        />
      </div>

      <div class="field">
        <label for="pokemon-things">喜欢的东西</label>
        <TagsSelect
          id="pokemon-things"
          v-model="pokemonForm.favoriteThingIds"
          :options="options.favoriteThings"
          :max="6"
          allow-create
          :creating="creatingSelect === 'pokemon-things'"
          placeholder="搜索喜欢的东西"
          @create="createMultiOption('pokemon-things', 'favorite-things', $event, pokemonForm.favoriteThingIds, 6)"
        />
      </div>

      <div class="form-actions">
        <button type="submit" class="link-button" :disabled="busy">{{ busy ? '保存中' : '保存' }}</button>
        <RouterLink class="plain-button" :to="cancelTo">取消</RouterLink>
      </div>
    </form>

    <section v-else class="detail-section skeleton-detail-section" aria-busy="true" aria-label="正在加载 Pokemon 编辑内容">
      <div v-for="index in 5" :key="index" class="field">
        <Skeleton :width="index === 1 ? '52px' : '88px'" />
        <Skeleton variant="box" height="44px" />
      </div>
    </section>
  </section>
</template>
