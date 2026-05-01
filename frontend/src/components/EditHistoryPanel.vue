<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { EditHistoryAction, EditHistoryEntry, EditInfo, UserSummary } from '../services/api';

defineProps<{
  entity: EditInfo;
  history: EditHistoryEntry[];
}>();

const { locale, t } = useI18n();
const changeLabelKeys: Record<string, string> = {
  Name: 'common.name',
  名字: 'common.name',
  名称: 'common.name',
  'Ideal Habitat': 'pages.pokemon.environment',
  'Favorite environment': 'pages.pokemon.environment',
  喜欢的环境: 'pages.pokemon.environment',
  Specialities: 'pages.pokemon.skills',
  Skills: 'pages.pokemon.skills',
  特长: 'pages.pokemon.skills',
  Favourites: 'pages.pokemon.favoriteThings',
  'Favorite things': 'pages.pokemon.favoriteThings',
  喜欢的东西: 'pages.pokemon.favoriteThings',
  'Speciality drops': 'pages.pokemon.skillDrops',
  'Skill drops': 'pages.pokemon.skillDrops',
  特长掉落物: 'pages.pokemon.skillDrops',
  Category: 'pages.items.category',
  分类: 'pages.items.category',
  Usage: 'pages.items.usage',
  用途: 'pages.items.usage',
  Dyeable: 'pages.items.dyeable',
  可染色: 'pages.items.dyeable',
  'Dual dyeable': 'pages.items.dualDyeable',
  可双区染色: 'pages.items.dualDyeable',
  'Pattern editable': 'pages.items.patternEditable',
  可改花纹: 'pages.items.patternEditable',
  'No recipe': 'pages.items.noRecipe',
  无材料单: 'pages.items.noRecipe',
  'Acquisition methods': 'pages.items.acquisitionMethods',
  入手方式: 'pages.items.acquisitionMethods',
  Tags: 'pages.items.tags',
  标签: 'pages.items.tags',
  Recipe: 'pages.habitats.recipe',
  配方: 'pages.habitats.recipe',
  'Possible Pokemon': 'pages.habitats.possiblePokemon',
  可能出现的宝可梦: 'pages.habitats.possiblePokemon',
  Item: 'pages.recipes.item',
  物品: 'pages.recipes.item',
  Materials: 'pages.recipes.materials',
  需要材料: 'pages.recipes.materials'
};

function displayName(user: UserSummary | null): string {
  return user?.displayName ?? t('common.system');
}

function actionLabel(action: EditHistoryAction): string {
  return t(`history.${action}`);
}

function actionMark(action: EditHistoryAction): string {
  return actionLabel(action).charAt(0);
}

function changeLabel(label: string): string {
  const key = changeLabelKeys[label];
  return key ? t(key) : label;
}

function changeValue(value: string): string {
  const values: Record<string, string> = {
    None: t('common.none'),
    无: t('common.none'),
    Yes: locale.value === 'zh-CN' ? '是' : 'Yes',
    是: locale.value === 'zh-CN' ? '是' : 'Yes',
    No: locale.value === 'zh-CN' ? '否' : 'No',
    否: locale.value === 'zh-CN' ? '否' : 'No'
  };
  return values[value] ?? value;
}

function historySummary(entry: EditHistoryEntry): string {
  if (!entry.changes.length) {
    return actionLabel(entry.action);
  }

  return entry.changes.map((change) => changeLabel(change.label)).join(locale.value === 'zh-CN' ? '、' : ', ');
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
</script>

<template>
  <aside class="edit-history-panel" aria-labelledby="edit-history-panel-title">
    <div class="edit-history-panel__header">
      <h2 id="edit-history-panel-title">{{ t('history.title') }}</h2>
    </div>

    <dl class="edit-history-summary">
      <div>
        <dt>{{ t('history.createdBy') }}</dt>
        <dd>
          <strong>{{ displayName(entity.createdBy) }}</strong>
          <time :datetime="entity.createdAt">{{ formatDateTime(entity.createdAt) }}</time>
        </dd>
      </div>
      <div>
        <dt>{{ t('history.lastEdited') }}</dt>
        <dd>
          <strong>{{ displayName(entity.updatedBy) }}</strong>
          <time :datetime="entity.updatedAt">{{ formatDateTime(entity.updatedAt) }}</time>
        </dd>
      </div>
    </dl>

    <section class="edit-history-list" aria-labelledby="edit-history-list-title">
      <h3 id="edit-history-list-title">{{ t('history.editHistory') }}</h3>
      <ol v-if="history.length" class="edit-timeline">
        <li v-for="entry in history" :key="`${entry.action}-${entry.createdAt}-${entry.user?.id ?? 'system'}`">
          <span class="edit-timeline__avatar" aria-hidden="true">{{ actionMark(entry.action) }}</span>
          <div class="edit-timeline__body">
            <details class="edit-history-entry">
              <summary>
                <span class="edit-history-entry__title">{{ historySummary(entry) }}</span>
              </summary>

              <div class="edit-history-entry__content">
                <dl v-if="entry.changes.length" class="edit-change-list">
                  <div v-for="change in entry.changes" :key="`${change.label}-${change.before}-${change.after}`">
                    <dt>{{ changeLabel(change.label) }}</dt>
                    <dd>
                      <span class="edit-change-list__label">{{ t('history.before') }}</span>
                      <span>{{ changeValue(change.before) }}</span>
                      <span class="edit-change-list__label">{{ t('history.after') }}</span>
                      <span>{{ changeValue(change.after) }}</span>
                    </dd>
                  </div>
                </dl>

                <dl class="edit-history-detail-meta">
                  <div>
                    <dt>{{ t('history.author') }}</dt>
                    <dd>{{ displayName(entry.user) }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('history.time') }}</dt>
                    <dd><time :datetime="entry.createdAt">{{ formatDateTime(entry.createdAt) }}</time></dd>
                  </div>
                  <div>
                    <dt>{{ t('history.action') }}</dt>
                    <dd>{{ actionLabel(entry.action) }}</dd>
                  </div>
                </dl>
              </div>
            </details>
          </div>
        </li>
      </ol>
      <p v-else class="meta-line">{{ t('history.empty') }}</p>
    </section>
  </aside>
</template>
