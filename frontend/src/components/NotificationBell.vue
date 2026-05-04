<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  iconBell,
  iconCheck,
  iconComment,
  iconReactionFun,
  iconReactionHelpful,
  iconReactionLike,
  iconReactionThanks,
  iconReply,
  iconWarning
} from '../icons';
import {
  api,
  getAuthToken,
  moderationUpdateEvent,
  notificationWebSocketUrl,
  type AuthUser,
  type LifeReactionType,
  type NotificationItem,
  type NotificationTargetType,
  type NotificationWsMessage
} from '../services/api';
import Skeleton from './Skeleton.vue';

const props = defineProps<{
  currentUser: AuthUser | null;
}>();

const { locale, t } = useI18n();
const router = useRouter();
const root = ref<HTMLElement | null>(null);
const notifications = ref<NotificationItem[]>([]);
const unreadCount = ref(0);
const nextCursor = ref<string | null>(null);
const hasMore = ref(false);
const open = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const loadError = ref('');
const busyId = ref<number | null>(null);
const markingAll = ref(false);
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let stopped = false;

const notificationLimit = 12;
const displayUnreadCount = computed(() => (unreadCount.value > 99 ? '99+' : String(unreadCount.value)));

const reactionOptions = [
  { type: 'like', icon: iconReactionLike, labelKey: 'pages.life.reactionLike' },
  { type: 'helpful', icon: iconReactionHelpful, labelKey: 'pages.life.reactionHelpful' },
  { type: 'fun', icon: iconReactionFun, labelKey: 'pages.life.reactionFun' },
  { type: 'thanks', icon: iconReactionThanks, labelKey: 'pages.life.reactionThanks' }
] as const satisfies ReadonlyArray<{ type: LifeReactionType; icon: string; labelKey: string }>;

function closeMenu() {
  open.value = false;
}

function onDocumentPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) {
    closeMenu();
  }
}

function toggleMenu() {
  open.value = !open.value;
  if (open.value && notifications.value.length === 0 && !loading.value) {
    void loadNotifications(true);
  }
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function disconnectNotifications() {
  stopped = true;
  clearReconnectTimer();
  socket?.close();
  socket = null;
}

function scheduleReconnect() {
  clearReconnectTimer();
  if (stopped || !props.currentUser || !getAuthToken()) {
    return;
  }

  reconnectTimer = window.setTimeout(() => {
    void connectNotifications();
  }, 5000);
}

function upsertNotification(notification: NotificationItem) {
  notifications.value = [
    notification,
    ...notifications.value.filter((item) => item.id !== notification.id)
  ].slice(0, 40);
}

function mergeNotifications(existing: NotificationItem[], incoming: NotificationItem[]) {
  const existingIds = new Set(existing.map((notification) => notification.id));
  return [...existing, ...incoming.filter((notification) => !existingIds.has(notification.id))];
}

function isNotificationWsMessage(value: unknown): value is NotificationWsMessage {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

async function connectNotifications() {
  if (!props.currentUser || !getAuthToken() || typeof WebSocket === 'undefined') {
    return;
  }

  stopped = false;
  clearReconnectTimer();
  socket?.close();
  socket = null;

  try {
    const { ticket } = await api.notificationWsTicket();
    if (stopped || !props.currentUser) {
      return;
    }

    const nextSocket = new WebSocket(notificationWebSocketUrl(ticket));
    socket = nextSocket;
    nextSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as unknown;
        if (!isNotificationWsMessage(message)) {
          return;
        }

        if ('unreadCount' in message) {
          unreadCount.value = message.unreadCount;
        }
        if (message.type === 'notifications.created') {
          upsertNotification(message.notification);
        } else if (message.type === 'moderation.updated') {
          window.dispatchEvent(new CustomEvent(moderationUpdateEvent, { detail: message }));
        }
      } catch {
        // Invalid socket payloads are ignored.
      }
    };
    nextSocket.onclose = () => {
      if (socket === nextSocket) {
        socket = null;
      }
      scheduleReconnect();
    };
    nextSocket.onerror = () => {
      nextSocket.close();
    };
  } catch {
    scheduleReconnect();
  }
}

async function loadNotifications(reset = false) {
  if (!props.currentUser || (!reset && (!hasMore.value || loadingMore.value))) {
    return;
  }

  if (reset) {
    loading.value = true;
    nextCursor.value = null;
  } else {
    loadingMore.value = true;
  }
  loadError.value = '';

  try {
    const page = await api.notifications({
      cursor: reset ? null : nextCursor.value,
      limit: notificationLimit
    });
    notifications.value = reset ? page.items : mergeNotifications(notifications.value, page.items);
    unreadCount.value = page.unreadCount;
    nextCursor.value = page.nextCursor;
    hasMore.value = page.hasMore;
  } catch (error) {
    loadError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function replaceNotification(notification: NotificationItem | null) {
  if (!notification) {
    return;
  }

  notifications.value = notifications.value.map((item) => (item.id === notification.id ? notification : item));
}

async function markNotificationRead(notification: NotificationItem) {
  if (notification.readAt) {
    return;
  }

  busyId.value = notification.id;
  try {
    const result = await api.markNotificationRead(notification.id);
    unreadCount.value = result.unreadCount;
    replaceNotification(result.notification);
  } finally {
    busyId.value = null;
  }
}

async function activateNotification(notification: NotificationItem) {
  try {
    await markNotificationRead(notification);
  } finally {
    closeMenu();
    await router.push(notification.target.path);
  }
}

async function markAllRead() {
  if (unreadCount.value === 0 || markingAll.value) {
    return;
  }

  markingAll.value = true;
  try {
    const result = await api.markAllNotificationsRead();
    unreadCount.value = result.unreadCount;
    const now = new Date().toISOString();
    notifications.value = notifications.value.map((notification) => ({
      ...notification,
      readAt: notification.readAt ?? now
    }));
  } finally {
    markingAll.value = false;
  }
}

function reactionLabel(type: LifeReactionType | null) {
  return t(reactionOptions.find((option) => option.type === type)?.labelKey ?? 'pages.life.reactionLike');
}

function reactionIcon(type: LifeReactionType | null) {
  return reactionOptions.find((option) => option.type === type)?.icon ?? iconReactionLike;
}

function actorName(notification: NotificationItem) {
  return notification.actor?.displayName ?? t('notifications.systemActor');
}

function targetLabel(type: NotificationTargetType) {
  const labels: Record<NotificationTargetType, string> = {
    'life-post': t('notifications.targetLifePost'),
    'life-comment': t('notifications.targetLifeComment'),
    'discussion-comment': t('notifications.targetDiscussionComment')
  };
  return labels[type];
}

function notificationText(notification: NotificationItem) {
  if (notification.type === 'life_post_comment') {
    return t('notifications.lifePostComment', { actor: actorName(notification) });
  }
  if (notification.type === 'life_comment_reply') {
    return t('notifications.lifeCommentReply', { actor: actorName(notification) });
  }
  if (notification.type === 'discussion_comment_reply') {
    return t('notifications.discussionCommentReply', { actor: actorName(notification) });
  }
  if (notification.type === 'life_post_reaction') {
    return t('notifications.lifePostReaction', {
      actor: actorName(notification),
      reaction: reactionLabel(notification.reactionType)
    });
  }

  const target = targetLabel(notification.target.type);
  if (notification.moderationStatus === 'approved') {
    return t('notifications.moderationApproved', { target });
  }
  if (notification.moderationStatus === 'rejected') {
    return t('notifications.moderationRejected', { target });
  }
  return t('notifications.moderationFailed', { target });
}

function notificationReasonVisible(notification: NotificationItem) {
  return (
    notification.type === 'moderation_result' &&
    (notification.moderationStatus === 'rejected' || notification.moderationStatus === 'failed') &&
    notification.moderationReason !== null &&
    notification.moderationReason.trim() !== ''
  );
}

function notificationIcon(notification: NotificationItem) {
  if (notification.type === 'life_post_comment') {
    return iconComment;
  }
  if (notification.type === 'life_comment_reply' || notification.type === 'discussion_comment_reply') {
    return iconReply;
  }
  if (notification.type === 'life_post_reaction') {
    return reactionIcon(notification.reactionType);
  }
  return notification.moderationStatus === 'approved' ? iconCheck : iconWarning;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

watch(
  () => props.currentUser?.id ?? null,
  (userId) => {
    disconnectNotifications();
    notifications.value = [];
    unreadCount.value = 0;
    nextCursor.value = null;
    hasMore.value = false;
    loadError.value = '';

    if (userId) {
      void loadNotifications(true);
      void connectNotifications();
      document.addEventListener('pointerdown', onDocumentPointerDown);
    } else {
      document.removeEventListener('pointerdown', onDocumentPointerDown);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  disconnectNotifications();
  document.removeEventListener('pointerdown', onDocumentPointerDown);
});
</script>

<template>
  <div ref="root" class="notification-menu">
    <button
      class="notification-menu__trigger"
      type="button"
      :aria-label="t('notifications.open')"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="toggleMenu"
    >
      <span class="notification-menu__icon-wrap">
        <Icon :icon="iconBell" class="ui-icon notification-menu__icon" aria-hidden="true" />
        <span v-if="unreadCount > 0" class="notification-menu__badge">{{ displayUnreadCount }}</span>
      </span>
      <span class="notification-menu__label">{{ t('notifications.title') }}</span>
    </button>

    <div v-if="open" class="notification-menu__dropdown" role="menu">
      <div class="notification-menu__header">
        <div>
          <h2>{{ t('notifications.title') }}</h2>
          <p>{{ t('notifications.unreadCount', { count: unreadCount }) }}</p>
        </div>
        <button
          class="notification-menu__mark-all"
          type="button"
          :disabled="unreadCount === 0 || markingAll"
          @click="markAllRead"
        >
          {{ t('notifications.markAllRead') }}
        </button>
      </div>

      <div v-if="loading" class="notification-list" aria-hidden="true">
        <article v-for="index in 4" :key="index" class="notification-item notification-item--skeleton">
          <Skeleton width="36px" height="36px" radius="999px" />
          <div class="notification-item__copy">
            <Skeleton width="85%" height="14px" />
            <Skeleton width="44%" height="12px" />
          </div>
        </article>
      </div>

      <div v-else-if="loadError" class="notification-menu__empty">
        <Icon :icon="iconWarning" class="notification-menu__empty-icon" aria-hidden="true" />
        <p>{{ loadError }}</p>
      </div>

      <div v-else-if="notifications.length" class="notification-list">
        <article
          v-for="notification in notifications"
          :key="notification.id"
          class="notification-item"
          :class="{ 'notification-item--unread': !notification.readAt }"
        >
          <button class="notification-item__main" type="button" role="menuitem" @click="activateNotification(notification)">
            <span class="notification-item__icon">
              <Icon :icon="notificationIcon(notification)" class="ui-icon" aria-hidden="true" />
            </span>
            <span class="notification-item__copy">
              <strong>{{ notificationText(notification) }}</strong>
              <span v-if="notificationReasonVisible(notification)" class="notification-item__detail">
                {{ notification.moderationReason }}
              </span>
              <time :datetime="notification.createdAt">{{ formatDateTime(notification.createdAt) }}</time>
            </span>
          </button>
          <button
            v-if="!notification.readAt"
            class="notification-item__read-button"
            type="button"
            :disabled="busyId === notification.id"
            :aria-label="t('notifications.markRead')"
            @click="markNotificationRead(notification)"
          >
            <Icon :icon="iconCheck" class="ui-icon" aria-hidden="true" />
          </button>
        </article>
      </div>

      <div v-else class="notification-menu__empty">
        <Icon :icon="iconBell" class="notification-menu__empty-icon" aria-hidden="true" />
        <h3>{{ t('notifications.emptyTitle') }}</h3>
        <p>{{ t('notifications.emptyBody') }}</p>
      </div>

      <button
        v-if="hasMore && !loading"
        class="notification-menu__load-more"
        type="button"
        :disabled="loadingMore"
        @click="loadNotifications(false)"
      >
        {{ loadingMore ? t('common.loading') : t('notifications.loadMore') }}
      </button>
    </div>
  </div>
</template>
