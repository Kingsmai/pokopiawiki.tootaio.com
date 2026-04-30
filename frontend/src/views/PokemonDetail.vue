<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import DetailSection from '../components/DetailSection.vue';
import EditMeta from '../components/EditMeta.vue';
import EntityChips from '../components/EntityChips.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import { api, type PokemonDetail } from '../services/api';

const route = useRoute();
const pokemon = ref<PokemonDetail | null>(null);
const itemCategoryTab = ref('');
const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];

type HabitatRow = {
  id: number;
  name: string;
  timeOfDays: string[];
  weathers: string[];
  rarity: number;
  maps: string[];
};

function sortByOrder(values: Set<string>, order: string[]) {
  return [...values].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

const habitatRows = computed<HabitatRow[]>(() => {
  if (!pokemon.value) return [];

  const rows = new Map<
    string,
    {
      id: number;
      name: string;
      timeOfDays: Set<string>;
      weathers: Set<string>;
      rarity: number;
      maps: Set<string>;
    }
  >();

  pokemon.value.habitats.forEach((habitat) => {
    const key = `${habitat.id}:${habitat.rarity}`;
    const row = rows.get(key) ?? {
      id: habitat.id,
      name: habitat.name,
      timeOfDays: new Set<string>(),
      weathers: new Set<string>(),
      rarity: habitat.rarity,
      maps: new Set<string>()
    };

    row.timeOfDays.add(habitat.time_of_day);
    row.weathers.add(habitat.weather);
    row.maps.add(habitat.map.name);
    rows.set(key, row);
  });

  return [...rows.values()].map((row) => ({
    id: row.id,
    name: row.name,
    timeOfDays: sortByOrder(row.timeOfDays, timeOfDays),
    weathers: sortByOrder(row.weathers, weathers),
    rarity: row.rarity,
    maps: [...row.maps].sort((a, b) => a.localeCompare(b))
  }));
});
const skillDropRows = computed(() => pokemon.value?.skills.filter((skill) => skill.itemDrop) ?? []);
const itemCategoryTabs = computed<TabOption[]>(() => {
  const categories = new Map<string, string>();

  pokemon.value?.favoriteThingItems.forEach((item) => {
    categories.set(String(item.category.id), item.category.name);
  });

  const tabs = [...categories.entries()]
    .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB))
    .map(([value, label]) => ({ value, label }));

  return tabs.length > 1 ? [{ value: '', label: '全部' }, ...tabs] : [];
});
const favoriteThingItems = computed(() => {
  const items = pokemon.value?.favoriteThingItems ?? [];

  if (!itemCategoryTab.value) {
    return items;
  }

  return items.filter((item) => String(item.category.id) === itemCategoryTab.value);
});

onMounted(async () => {
  pokemon.value = await api.pokemonDetail(String(route.params.id));
});
</script>

<template>
  <section v-if="!pokemon" class="page-stack" aria-busy="true" aria-label="正在加载 Pokemon 详情">
    <div class="page-header page-header--skeleton" aria-hidden="true">
      <div class="page-header__copy">
        <Skeleton width="142px" />
        <Skeleton width="280px" height="46px" />
        <Skeleton width="220px" />
        <Skeleton width="310px" />
      </div>
      <div class="page-header__actions">
        <Skeleton variant="box" width="88px" height="36px" />
      </div>
    </div>

    <div class="detail-grid detail-grid--stack" aria-hidden="true">
      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="56px" height="24px" />
        </div>
        <div class="detail-section__body">
          <div class="skeleton-chip-row">
            <Skeleton v-for="index in 2" :key="index" width="74px" class="skeleton-chip" />
          </div>
        </div>
      </section>

      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="92px" height="24px" />
        </div>
        <div class="detail-section__body">
          <div class="skeleton-chip-row">
            <Skeleton v-for="index in 4" :key="index" width="82px" class="skeleton-chip" />
          </div>
        </div>
      </section>

      <section class="detail-section skeleton-detail-section">
        <div class="detail-section__header">
          <Skeleton width="68px" height="24px" />
        </div>
        <div class="detail-section__body">
          <ul class="row-list appearance-list skeleton-row-list">
            <li v-for="index in 3" :key="index" class="skeleton-appearance-row">
              <Skeleton width="96px" />
              <div class="skeleton-summary">
                <div v-for="line in 4" :key="line">
                  <Skeleton width="56px" />
                  <Skeleton :width="line === 4 ? '70%' : '48%'" />
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </section>
  <section v-else class="page-stack">
    <PageHeader :title="`#${pokemon.id} ${pokemon.name}`" :subtitle="`喜欢的环境：${pokemon.environment.name}`">
      <template #kicker>Pokédex Detail</template>
      <template #meta>
        <EditMeta :entity="pokemon" />
      </template>
      <template #actions>
        <RouterLink class="ui-button ui-button--primary ui-button--small" :to="`/pokemon/${pokemon.id}/edit`">编辑</RouterLink>
        <RouterLink class="ui-button ui-button--blue ui-button--small" to="/pokemon">返回列表</RouterLink>
      </template>
    </PageHeader>

    <div class="detail-grid detail-grid--stack">
      <DetailSection title="特长">
        <EntityChips :items="pokemon.skills" />
      </DetailSection>

      <DetailSection v-if="skillDropRows.length" title="特长掉落物">
        <ul class="row-list skill-drop-summary">
          <li v-for="skill in skillDropRows" :key="skill.id">
            <span>{{ skill.name }}掉落物</span>
            <RouterLink v-if="skill.itemDrop" :to="`/items/${skill.itemDrop.id}`">{{ skill.itemDrop.name }}</RouterLink>
          </li>
        </ul>
      </DetailSection>

      <DetailSection title="喜欢的东西">
        <EntityChips :items="pokemon.favorite_things" />
      </DetailSection>

      <DetailSection title="关联物品">
        <template v-if="pokemon.favoriteThingItems.length">
          <Tabs
            v-if="itemCategoryTabs.length"
            id="pokemon-favorite-items"
            v-model="itemCategoryTab"
            :tabs="itemCategoryTabs"
            label="关联物品分类"
          />
          <ul v-if="favoriteThingItems.length" class="row-list">
            <li v-for="item in favoriteThingItems" :key="item.id">
              <RouterLink :to="`/items/${item.id}`">{{ item.name }}</RouterLink>
              <EntityChips :items="item.tags" />
            </li>
          </ul>
          <p v-else class="meta-line">无</p>
        </template>
        <p v-else class="meta-line">无</p>
      </DetailSection>

      <DetailSection title="栖息地">
        <ul class="row-list appearance-list">
          <li v-for="habitat in habitatRows" :key="`${habitat.id}-${habitat.rarity}`">
            <RouterLink class="appearance-name" :to="`/habitats/${habitat.id}`">{{ habitat.name }}</RouterLink>
            <dl class="appearance-summary">
              <div>
                <dt>时段</dt>
                <dd>{{ habitat.timeOfDays.join(' / ') }}</dd>
              </div>
              <div>
                <dt>天气</dt>
                <dd>{{ habitat.weathers.join(' / ') }}</dd>
              </div>
              <div>
                <dt>稀有度</dt>
                <dd>{{ habitat.rarity }} 星</dd>
              </div>
              <div>
                <dt>出现地图</dt>
                <dd>{{ habitat.maps.join(' / ') }}</dd>
              </div>
            </dl>
          </li>
        </ul>
      </DetailSection>
    </div>
  </section>
</template>
