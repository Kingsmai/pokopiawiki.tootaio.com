<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import EntityCard from '../components/EntityCard.vue';
import FilterPanel from '../components/FilterPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import StatusMessage from '../components/StatusMessage.vue';
import TagsSelect from '../components/TagsSelect.vue';
import { api, type Options, type Pokemon } from '../services/api';

const options = ref<Options | null>(null);
const pokemon = ref<Pokemon[]>([]);
const loading = ref(true);
const search = ref('');
const environmentId = ref('');
const skillIds = ref<string[]>([]);
const skillMode = ref<'any' | 'all'>('any');
const favoriteThingIds = ref<string[]>([]);
const favoriteThingMode = ref<'any' | 'all'>('any');

const query = computed(() => ({
  search: search.value,
  environmentId: environmentId.value,
  skillIds: skillIds.value.join(','),
  skillMode: skillMode.value,
  favoriteThingIds: favoriteThingIds.value.join(','),
  favoriteThingMode: favoriteThingMode.value
}));

async function loadPokemon() {
  loading.value = true;
  pokemon.value = await api.pokemon(query.value);
  loading.value = false;
}

onMounted(async () => {
  options.value = await api.options();
  await loadPokemon();
});

watch(query, loadPokemon);
</script>

<template>
  <section class="page-stack">
    <PageHeader title="Pokemon" subtitle="搜索宝可梦，并按特长、环境、喜欢的东西筛选。">
      <template #kicker>Pokédex</template>
    </PageHeader>

    <FilterPanel v-if="options">
      <div class="field">
        <label for="pokemon-search">搜索</label>
        <input id="pokemon-search" v-model="search" type="search" placeholder="名字" />
      </div>

      <div class="field">
        <label for="environment">喜欢的环境</label>
        <TagsSelect
          id="environment"
          v-model="environmentId"
          :options="options.environments"
          :multiple="false"
          placeholder="全部"
          search-placeholder="搜索喜欢的环境"
        />
      </div>

      <div class="field">
        <label for="skills">特长</label>
        <TagsSelect id="skills" v-model="skillIds" :options="options.skills" placeholder="搜索特长" />
        <div class="segmented" aria-label="特长匹配方式">
          <button :class="{ active: skillMode === 'any' }" type="button" @click="skillMode = 'any'">任意</button>
          <button :class="{ active: skillMode === 'all' }" type="button" @click="skillMode = 'all'">全部</button>
        </div>
      </div>

      <div class="field">
        <label for="favorite-things">喜欢的东西</label>
        <TagsSelect id="favorite-things" v-model="favoriteThingIds" :options="options.favoriteThings" placeholder="搜索喜欢的东西" />
        <div class="segmented" aria-label="喜欢的东西匹配方式">
          <button :class="{ active: favoriteThingMode === 'any' }" type="button" @click="favoriteThingMode = 'any'">
            任意
          </button>
          <button :class="{ active: favoriteThingMode === 'all' }" type="button" @click="favoriteThingMode = 'all'">
            全部
          </button>
        </div>
      </div>
    </FilterPanel>

    <StatusMessage v-if="loading" :duration="0">加载中</StatusMessage>
    <div v-else class="entity-grid">
      <EntityCard
        v-for="item in pokemon"
        :key="item.id"
        :title="`#${item.id} ${item.name}`"
        :subtitle="`喜欢的环境：${item.environment.name}`"
        :to="`/pokemon/${item.id}`"
      >
        <EditMeta :entity="item" />
        <EntityChips :items="item.skills" />
        <EntityChips :items="item.favorite_things" />
      </EntityCard>
    </div>
  </section>
</template>
