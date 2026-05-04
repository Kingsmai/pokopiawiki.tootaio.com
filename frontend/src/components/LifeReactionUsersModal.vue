<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  iconReactionFun,
  iconReactionHelpful,
  iconReactionLike,
  iconReactionThanks
} from '../icons';
import {
  api,
  type LifeReactionType,
  type LifeReactionUser
} from '../services/api';
import Modal from './Modal.vue';
import Skeleton from './Skeleton.vue';
import Tabs, { type TabOption } from './Tabs.vue';

type ReactionFilter = LifeReactionType | 'all';

const props = defineProps<{
  postId: number;
  initialReactionType?: LifeReactionType | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { locale, t } = useI18n();
const reactionUsers = ref<LifeReactionUser[]>([]);
const nextCursor = ref<string | null>(null);
const hasMore = ref(false);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const loadError = ref('');
const activeReactionType = ref<ReactionFilter>(props.initialReactionType ?? 'all');
const pageSize = 20;

const reactionOptions = [
  { type: 'like', icon: iconReactionLike, labelKey: 'pages.life.reactionLike' },
  { type: 'helpful', icon: iconReactionHelpful, labelKey: 'pages.life.reactionHelpful' },
  { type: 'fun', icon: iconReactionFun, labelKey: 'pages.life.reactionFun' },
  { type: 'thanks', icon: iconReactionThanks, labelKey: 'pages.life.reactionThanks' }
] as const satisfies ReadonlyArray<{ type: LifeReactionType; icon: string; labelKey: string }>;

const reactionTabs = computed<TabOption[]>(() => [
  { value: 'all', label: t('pages.life.allReactions') },
  ...reactionOptions.map((option) => ({ value: option.type, label: reactionLabel(option.type) }))
]);

function reactionLabel(type: LifeReactionType) {
  return t(reactionOptions.find((option) => option.type === type)?.labelKey ?? 'pages.life.react');
}

function reactionIcon(type: LifeReactionType) {
  return reactionOptions.find((option) => option.type === type)?.icon ?? iconReactionLike;
}

function selectedReactionType() {
  return activeReactionType.value === 'all' ? undefined : activeReactionType.value;
}

function formatReactedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

async function loadReactionUsers(reset = false) {
  if (loading.value || loadingMore.value || (!reset && !hasMore.value)) {
    return;
  }

  const cursor = reset ? null : nextCursor.value;
  loading.value = reset;
  loadingMore.value = !reset;
  loadError.value = '';

  if (reset) {
    reactionUsers.value = [];
    nextCursor.value = null;
    hasMore.value = false;
    total.value = 0;
  }

  try {
    const page = await api.lifeReactionUsers(props.postId, {
      cursor,
      limit: pageSize,
      reactionType: selectedReactionType()
    });
    reactionUsers.value = reset ? page.items : [...reactionUsers.value, ...page.items];
    nextCursor.value = page.nextCursor;
    hasMore.value = page.hasMore;
    total.value = page.total;
  } catch (error) {
    loadError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

watch(
  () => props.initialReactionType,
  (nextReactionType) => {
    activeReactionType.value = nextReactionType ?? 'all';
  }
);

watch(
  [() => props.postId, activeReactionType, locale],
  () => {
    void loadReactionUsers(true);
  },
  { immediate: true }
);
</script>

<template>
  <Modal :title="t('pages.life.reactionUsersTitle')" :subtitle="t('pages.life.reactionUsersSubtitle')" :close-label="t('common.close')" @close="emit('close')">
    <div class="life-reaction-users-modal">
      <Tabs id="life-reaction-users-filter" v-model="activeReactionType" :tabs="reactionTabs" :label="t('pages.life.reactionFiltersLabel')" />

      <p class="life-reaction-users-modal__count">{{ t('pages.life.reactionsCount', { count: total }) }}</p>

      <p v-if="loadError" class="life-form__error" role="alert">{{ loadError }}</p>

      <div v-if="loading" class="life-reaction-user-list" aria-hidden="true">
        <article v-for="index in 4" :key="index" class="life-reaction-user">
          <Skeleton variant="box" width="38px" height="38px" />
          <div class="life-reaction-user__copy">
            <Skeleton width="140px" />
            <Skeleton width="190px" />
          </div>
        </article>
      </div>

      <div v-else-if="reactionUsers.length" class="life-reaction-user-list">
        <article v-for="item in reactionUsers" :key="`${item.user.id}-${item.reactedAt}`" class="life-reaction-user">
          <RouterLink class="life-reaction-user__avatar" :to="`/profile/${item.user.id}`" :aria-label="item.user.displayName">
            {{ item.user.displayName.slice(0, 1).toUpperCase() || '#' }}
          </RouterLink>
          <div class="life-reaction-user__copy">
            <RouterLink class="user-profile-link" :to="`/profile/${item.user.id}`">
              {{ item.user.displayName }}
            </RouterLink>
            <span>
              <Icon :icon="reactionIcon(item.reactionType)" class="ui-icon" aria-hidden="true" />
              {{ reactionLabel(item.reactionType) }}
              <time :datetime="item.reactedAt">{{ formatReactedAt(item.reactedAt) }}</time>
            </span>
          </div>
        </article>
      </div>

      <div v-else class="life-reaction-users-empty">
        <Icon :icon="iconReactionLike" class="life-reaction-users-empty__icon" aria-hidden="true" />
        <h3>{{ t('pages.life.reactionUsersEmpty') }}</h3>
      </div>

      <div v-if="hasMore && !loading" class="life-feed__retry">
        <button class="ui-button ui-button--ghost ui-button--small" type="button" :disabled="loadingMore" @click="loadReactionUsers(false)">
          {{ loadingMore ? t('common.loading') : t('pages.life.loadMoreReactions') }}
        </button>
      </div>
    </div>
  </Modal>
</template>
