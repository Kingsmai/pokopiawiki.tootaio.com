<script setup lang="ts">
import type { EditHistoryAction, EditHistoryEntry, EditInfo, UserSummary } from '../services/api';

defineProps<{
  entity: EditInfo;
  history: EditHistoryEntry[];
}>();

const actionLabels: Record<EditHistoryAction, string> = {
  create: '创建',
  update: '编辑',
  delete: '删除'
};

function displayName(user: UserSummary | null): string {
  return user?.displayName ?? '系统';
}

function actionLabel(action: EditHistoryAction): string {
  return actionLabels[action];
}

function actionMark(action: EditHistoryAction): string {
  return actionLabels[action].charAt(0);
}

function historySummary(entry: EditHistoryEntry): string {
  if (!entry.changes.length) {
    return actionLabel(entry.action);
  }

  return entry.changes.map((change) => change.label).join('、');
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
</script>

<template>
  <aside class="edit-history-panel" aria-labelledby="edit-history-panel-title">
    <div class="edit-history-panel__header">
      <h2 id="edit-history-panel-title">贡献记录</h2>
    </div>

    <dl class="edit-history-summary">
      <div>
        <dt>由谁创建</dt>
        <dd>
          <strong>{{ displayName(entity.createdBy) }}</strong>
          <time :datetime="entity.createdAt">{{ formatDateTime(entity.createdAt) }}</time>
        </dd>
      </div>
      <div>
        <dt>最后编辑</dt>
        <dd>
          <strong>{{ displayName(entity.updatedBy) }}</strong>
          <time :datetime="entity.updatedAt">{{ formatDateTime(entity.updatedAt) }}</time>
        </dd>
      </div>
    </dl>

    <section class="edit-history-list" aria-labelledby="edit-history-list-title">
      <h3 id="edit-history-list-title">编辑历史</h3>
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
                    <dt>{{ change.label }}</dt>
                    <dd>
                      <span class="edit-change-list__label">修改前</span>
                      <span>{{ change.before }}</span>
                      <span class="edit-change-list__label">修改后</span>
                      <span>{{ change.after }}</span>
                    </dd>
                  </div>
                </dl>

                <dl class="edit-history-detail-meta">
                  <div>
                    <dt>作者</dt>
                    <dd>{{ displayName(entry.user) }}</dd>
                  </div>
                  <div>
                    <dt>时间</dt>
                    <dd><time :datetime="entry.createdAt">{{ formatDateTime(entry.createdAt) }}</time></dd>
                  </div>
                  <div>
                    <dt>动作</dt>
                    <dd>{{ actionLabel(entry.action) }}</dd>
                  </div>
                </dl>
              </div>
            </details>
          </div>
        </li>
      </ol>
      <p v-else class="meta-line">暂无编辑历史</p>
    </section>
  </aside>
</template>
