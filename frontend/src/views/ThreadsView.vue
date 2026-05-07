<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import Modal from '../components/Modal.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import {
  iconAdd,
  iconBell,
  iconChevronUp,
  iconComment,
  iconDelete,
  iconSend,
  iconThreads,
  type AppIcon
} from '../icons';
import {
  api,
  threadWebSocketUrl,
  type AuthUser,
  type ThreadChannel,
  type ThreadChannelTag,
  type ThreadMessage,
  type ThreadReactionType,
  type ThreadSort,
  type ThreadSummary,
  type ThreadWsMessage
} from '../services/api';

type MessageGroup = {
  key: string;
  author: ThreadMessage['author'];
  createdAt: string;
  messages: ThreadMessage[];
};

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const channels = ref<ThreadChannel[]>([]);
const threads = ref<ThreadSummary[]>([]);
const messages = ref<ThreadMessage[]>([]);
const currentUser = ref<AuthUser | null>(null);
const activeThread = ref<ThreadSummary | null>(null);
const selectedChannelId = ref<number | null>(null);
const selectedTagId = ref<number | null>(null);
const selectedLanguage = ref('all');
const sort = ref<ThreadSort>('last-active');
const nextCursor = ref<string | null>(null);
const hasMoreThreads = ref(false);
const beforeCursor = ref<string | null>(null);
const hasMoreBefore = ref(false);
const loading = ref(true);
const loadingThreads = ref(false);
const loadingMessages = ref(false);
const loadingOlder = ref(false);
const busy = ref(false);
const errorMessage = ref('');
const createModalOpen = ref(false);
const composerBody = ref('');
const threadForm = ref({ title: '', body: '', languageCode: '', tagIds: [] as number[] });
const socket = ref<WebSocket | null>(null);
const chatScroller = ref<HTMLElement | null>(null);
const showJump = ref(false);

const reactionOptions: Array<{ type: ThreadReactionType; label: string; icon: AppIcon }> = [
  { type: 'thumbs-up', label: '👍', icon: 'mdi:thumb-up-outline' },
  { type: 'heart', label: '❤️', icon: 'mdi:heart-outline' },
  { type: 'laugh', label: '😂', icon: 'mdi:emoticon-lol-outline' },
  { type: 'fire', label: '🔥', icon: 'mdi:fire' },
  { type: 'eyes', label: '👀', icon: 'mdi:eye-outline' }
];

const selectedChannel = computed(() => channels.value.find((channel) => channel.id === selectedChannelId.value) ?? null);
const activeThreadId = computed(() => {
  const value = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
});
const canCreateThread = computed(() => currentUser.value?.permissions.includes('threads.create') === true);
const canCreateMessage = computed(() => currentUser.value?.permissions.includes('threads.messages.create') === true);
const canFollow = computed(() => currentUser.value?.permissions.includes('threads.follow') === true);
const canReact = computed(() => currentUser.value?.permissions.includes('threads.reactions.set') === true);
const canLockThreads = computed(() => currentUser.value?.permissions.includes('admin.threads.threads.lock') === true);
const canDeleteThreads = computed(() => currentUser.value?.permissions.includes('admin.threads.threads.delete') === true);
const canDeleteMessages = computed(() => currentUser.value?.permissions.includes('admin.threads.messages.delete') === true);
const languageOptions = computed(() => {
  const channelLanguages = selectedChannel.value?.languages ?? channels.value.flatMap((channel) => channel.languages);
  const byCode = new Map(channelLanguages.map((language) => [language.code, language]));
  return [...byCode.values()];
});
const tagOptions = computed(() => selectedChannel.value?.tags ?? []);
const currentThreadList = computed(() => threads.value);

const messageGroups = computed<MessageGroup[]>(() => {
  const groups: MessageGroup[] = [];
  for (const message of messages.value) {
    const previous = groups.at(-1);
    const previousMessage = previous?.messages.at(-1);
    const sameAuthor = previousMessage?.author?.id === message.author?.id;
    const withinMergeWindow =
      previousMessage && new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime() <= 5 * 60 * 1000;
    if (previous && sameAuthor && withinMergeWindow) {
      previous.messages.push(message);
    } else {
      groups.push({ key: String(message.id), author: message.author, createdAt: message.createdAt, messages: [message] });
    }
  }
  return groups;
});

function canUseThreads() {
  return currentUser.value?.emailVerified === true;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function authorName(author: ThreadMessage['author']) {
  return author?.displayName ?? t('pages.life.byUnknown');
}

function authorInitial(author: ThreadMessage['author']) {
  return authorName(author).trim().charAt(0).toUpperCase() || '?';
}

function reactionCount(threadOrMessage: ThreadSummary | ThreadMessage, type: ThreadReactionType) {
  return threadOrMessage.reactionCounts[type] ?? 0;
}

function reactionActive(threadOrMessage: ThreadSummary | ThreadMessage, type: ThreadReactionType) {
  return threadOrMessage.myReactions.includes(type);
}

function updateThreadInList(thread: ThreadSummary) {
  const index = threads.value.findIndex((item) => item.id === thread.id);
  if (index >= 0) {
    threads.value[index] = thread;
  } else {
    threads.value = [thread, ...threads.value];
  }
  if (activeThread.value?.id === thread.id) {
    activeThread.value = thread;
  }
}

function updateMessageInList(message: ThreadMessage) {
  const index = messages.value.findIndex((item) => item.id === message.id);
  if (index >= 0) {
    messages.value[index] = message;
  } else {
    messages.value = [...messages.value, message];
  }
}

function isNearBottom() {
  const el = chatScroller.value;
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}

async function scrollToBottom() {
  await nextTick();
  const el = chatScroller.value;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
  showJump.value = false;
}

async function loadCurrentUser() {
  try {
    currentUser.value = (await api.me()).user;
  } catch {
    currentUser.value = null;
  }
}

async function loadChannels() {
  channels.value = await api.threadChannels();
  if (!selectedChannelId.value && channels.value[0]) {
    selectedChannelId.value = channels.value[0].id;
  }
  if (!threadForm.value.languageCode) {
    threadForm.value.languageCode = channels.value[0]?.languages[0]?.code ?? 'en';
  }
}

async function loadThreads(reset = true) {
  loadingThreads.value = true;
  try {
    const page = await api.threads({
      cursor: reset ? null : nextCursor.value,
      limit: 20,
      channelId: selectedChannelId.value,
      language: selectedLanguage.value,
      tagId: selectedTagId.value,
      sort: sort.value
    });
    threads.value = reset ? page.items : [...threads.value, ...page.items];
    nextCursor.value = page.nextCursor;
    hasMoreThreads.value = page.hasMore;
  } finally {
    loadingThreads.value = false;
  }
}

async function loadActiveThread() {
  const id = activeThreadId.value;
  if (!id) {
    activeThread.value = null;
    messages.value = [];
    return;
  }
  activeThread.value = await api.thread(id);
  updateThreadInList(activeThread.value);
}

async function loadMessages(reset = true) {
  const id = activeThreadId.value;
  if (!id) return;
  if (reset) {
    loadingMessages.value = true;
  } else {
    loadingOlder.value = true;
  }
  try {
    const page = await api.threadMessages(id, { before: reset ? null : beforeCursor.value, limit: 40 });
    messages.value = reset ? page.items : [...page.items, ...messages.value];
    beforeCursor.value = page.beforeCursor;
    hasMoreBefore.value = page.hasMoreBefore;
    if (reset) {
      await scrollToBottom();
      if (canFollow.value) {
        try {
          activeThread.value = await api.markThreadRead(id);
          updateThreadInList(activeThread.value);
        } catch {
          // Read state is best-effort and does not block browsing.
        }
      }
    }
  } finally {
    loadingMessages.value = false;
    loadingOlder.value = false;
  }
}

async function loadAll() {
  loading.value = true;
  errorMessage.value = '';
  try {
    await loadCurrentUser();
    await loadChannels();
    await loadThreads(true);
    if (activeThreadId.value) {
      await loadActiveThread();
      await loadMessages(true);
    }
    connectSocket();
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    loading.value = false;
  }
}

async function selectThread(thread: ThreadSummary) {
  await router.push(`/threads/${thread.id}`);
}

function selectChannel(channelId: number | null) {
  selectedChannelId.value = channelId;
  selectedTagId.value = null;
  void loadThreads(true);
}

function openCreateThread() {
  const channel = selectedChannel.value ?? channels.value[0];
  threadForm.value = {
    title: '',
    body: '',
    languageCode: channel?.languages[0]?.code ?? 'en',
    tagIds: []
  };
  createModalOpen.value = true;
}

function closeCreateThread() {
  createModalOpen.value = false;
}

function toggleThreadTag(tag: ThreadChannelTag) {
  const tags = new Set(threadForm.value.tagIds);
  if (tags.has(tag.id)) {
    tags.delete(tag.id);
  } else {
    tags.add(tag.id);
  }
  threadForm.value.tagIds = [...tags];
}

async function submitThread() {
  const channel = selectedChannel.value ?? channels.value[0];
  if (!channel) return;
  busy.value = true;
  errorMessage.value = '';
  try {
    const thread = await api.createThread({
      channelId: channel.id,
      title: threadForm.value.title,
      body: threadForm.value.body,
      languageCode: threadForm.value.languageCode,
      tagIds: threadForm.value.tagIds
    });
    closeCreateThread();
    updateThreadInList(thread);
    await router.push(`/threads/${thread.id}`);
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('pages.threads.createFailed');
  } finally {
    busy.value = false;
  }
}

async function submitMessage() {
  const id = activeThreadId.value;
  if (!id || !composerBody.value.trim()) return;
  busy.value = true;
  errorMessage.value = '';
  try {
    const message = await api.createThreadMessage(id, { body: composerBody.value });
    composerBody.value = '';
    updateMessageInList(message);
    await scrollToBottom();
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('pages.threads.messageFailed');
  } finally {
    busy.value = false;
  }
}

async function toggleFollow() {
  const thread = activeThread.value;
  if (!thread) return;
  busy.value = true;
  try {
    const updated = thread.followed ? await api.unfollowThread(thread.id) : await api.followThread(thread.id);
    updateThreadInList(updated);
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('pages.threads.followFailed');
  } finally {
    busy.value = false;
  }
}

async function toggleThreadReaction(thread: ThreadSummary, type: ThreadReactionType) {
  if (!canReact.value) return;
  try {
    const updated = reactionActive(thread, type) ? await api.deleteThreadReaction(thread.id, type) : await api.setThreadReaction(thread.id, type);
    updateThreadInList(updated);
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('pages.threads.reactionFailed');
  }
}

async function toggleThreadLock() {
  const thread = activeThread.value;
  if (!thread) return;
  busy.value = true;
  try {
    const updated = await api.lockThread(thread.id, !thread.locked);
    updateThreadInList(updated);
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('errors.operationFailed');
  } finally {
    busy.value = false;
  }
}

async function removeActiveThread() {
  const thread = activeThread.value;
  if (!thread) return;
  busy.value = true;
  try {
    await api.deleteThread(thread.id);
    threads.value = threads.value.filter((item) => item.id !== thread.id);
    activeThread.value = null;
    messages.value = [];
    await router.push('/threads');
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('errors.operationFailed');
  } finally {
    busy.value = false;
  }
}

async function removeMessage(message: ThreadMessage) {
  busy.value = true;
  try {
    await api.deleteThreadMessage(message.id);
    messages.value = messages.value.filter((item) => item.id !== message.id);
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('errors.operationFailed');
  } finally {
    busy.value = false;
  }
}

async function toggleMessageReaction(message: ThreadMessage, type: ThreadReactionType) {
  if (!canReact.value) return;
  try {
    const updated = reactionActive(message, type)
      ? await api.deleteThreadMessageReaction(message.id, type)
      : await api.setThreadMessageReaction(message.id, type);
    updateMessageInList(updated);
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('pages.threads.reactionFailed');
  }
}

function handleThreadWsMessage(message: ThreadWsMessage) {
  if (message.type === 'thread.message.created') {
    updateThreadInList(message.thread);
    if (activeThreadId.value === message.threadId) {
      const stick = isNearBottom();
      updateMessageInList(message.message);
      if (stick) {
        void scrollToBottom();
      } else {
        showJump.value = true;
      }
    }
  } else if (message.type === 'thread.reactions.updated') {
    if (message.target === 'thread') {
      const thread = threads.value.find((item) => item.id === message.threadId);
      if (thread) {
        updateThreadInList({ ...thread, reactionCounts: message.reactionCounts, myReactions: message.myReactions });
      }
    } else if (message.messageId) {
      const existing = messages.value.find((item) => item.id === message.messageId);
      if (existing) {
        updateMessageInList({ ...existing, reactionCounts: message.reactionCounts, myReactions: message.myReactions });
      }
    }
  } else if (message.type === 'thread.read.updated') {
    const thread = threads.value.find((item) => item.id === message.threadId);
    if (thread) {
      updateThreadInList({ ...thread, unread: message.unread });
    }
  }
}

async function connectSocket() {
  if (!canUseThreads() || socket.value) return;
  try {
    const { ticket } = await api.threadWsTicket();
    const nextSocket = new WebSocket(threadWebSocketUrl(ticket));
    socket.value = nextSocket;
    nextSocket.addEventListener('message', (event) => {
      try {
        handleThreadWsMessage(JSON.parse(String(event.data)) as ThreadWsMessage);
      } catch {
        // Invalid socket frames are ignored.
      }
    });
    nextSocket.addEventListener('close', () => {
      if (socket.value === nextSocket) {
        socket.value = null;
      }
    });
  } catch {
    socket.value = null;
  }
}

function onScroll() {
  showJump.value = !isNearBottom();
}

watch([selectedLanguage, selectedTagId, sort], () => {
  void loadThreads(true);
});

watch(activeThreadId, async () => {
  errorMessage.value = '';
  await loadActiveThread();
  await loadMessages(true);
});

onMounted(() => {
  void loadAll();
});

onBeforeUnmount(() => {
  socket.value?.close();
});
</script>

<template>
  <section class="page-stack threads-page">
    <PageHeader :title="t('pages.threads.title')" :subtitle="t('pages.threads.subtitle')">
      <template #kicker>{{ t('pages.threads.kicker') }}</template>
      <button v-if="canCreateThread" type="button" class="ui-button ui-button--primary" @click="openCreateThread">
        <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
        {{ t('pages.threads.newThread') }}
      </button>
    </PageHeader>

    <StatusMessage v-if="errorMessage" variant="warning">{{ errorMessage }}</StatusMessage>

    <div class="threads-layout">
      <aside class="threads-sidebar" :aria-label="t('pages.threads.channels')">
        <h2>{{ t('pages.threads.channels') }}</h2>
        <button
          type="button"
          class="thread-channel"
          :class="{ active: selectedChannelId === null }"
          @click="selectChannel(null)"
        >
          <Icon :icon="iconThreads" class="ui-icon" aria-hidden="true" />
          <span>{{ t('pages.threads.allChannels') }}</span>
        </button>
        <button
          v-for="channel in channels"
          :key="channel.id"
          type="button"
          class="thread-channel"
          :class="{ active: selectedChannelId === channel.id }"
          @click="selectChannel(channel.id)"
        >
          <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
          <span>{{ channel.name }}</span>
          <span v-if="channel.unreadCount > 0" class="thread-unread-dot" :aria-label="t('pages.threads.unread')"></span>
        </button>
      </aside>

      <section class="threads-list-panel">
        <div class="thread-filters">
          <label>
            <span>{{ t('pages.threads.language') }}</span>
            <select v-model="selectedLanguage">
              <option value="all">{{ t('pages.threads.allLanguages') }}</option>
              <option v-for="language in languageOptions" :key="language.code" :value="language.code">{{ language.name }}</option>
            </select>
          </label>
          <label>
            <span>{{ t('pages.threads.sort') }}</span>
            <select v-model="sort">
              <option value="last-active">{{ t('pages.threads.sortLastActive') }}</option>
              <option value="latest">{{ t('pages.threads.sortLatest') }}</option>
              <option value="most-discussed">{{ t('pages.threads.sortMostDiscussed') }}</option>
            </select>
          </label>
        </div>
        <div v-if="tagOptions.length" class="thread-tag-filter" :aria-label="t('pages.threads.tags')">
          <button type="button" class="thread-chip" :class="{ active: selectedTagId === null }" @click="selectedTagId = null">
            {{ t('common.all') }}
          </button>
          <button
            v-for="tag in tagOptions"
            :key="tag.id"
            type="button"
            class="thread-chip"
            :class="{ active: selectedTagId === tag.id }"
            @click="selectedTagId = tag.id"
          >
            {{ tag.name }}
          </button>
        </div>

        <div v-if="loading || loadingThreads" class="thread-list" aria-busy="true">
          <article v-for="index in 4" :key="index" class="thread-list-item">
            <Skeleton width="70%" height="20px" />
            <Skeleton width="45%" />
          </article>
        </div>
        <div v-else-if="currentThreadList.length" class="thread-list">
          <button
            v-for="thread in currentThreadList"
            :key="thread.id"
            type="button"
            class="thread-list-item"
            :class="{ active: activeThread?.id === thread.id, unread: thread.unread }"
            @click="selectThread(thread)"
          >
            <span class="thread-list-item__title">
              <span v-if="thread.unread" class="thread-unread-dot" :aria-label="t('pages.threads.unread')"></span>
              {{ thread.title }}
            </span>
            <span class="thread-list-item__meta">
              {{ thread.author?.displayName ?? t('pages.life.byUnknown') }} · {{ formatDateTime(thread.lastActiveAt) }}
            </span>
            <span class="thread-list-item__tags">
              <span v-for="tag in thread.tags" :key="tag.id" class="thread-chip">{{ tag.name }}</span>
              <span class="thread-chip">{{ thread.messageCount }}</span>
            </span>
          </button>
          <button v-if="hasMoreThreads" type="button" class="ui-button ui-button--ghost" :disabled="loadingThreads" @click="loadThreads(false)">
            {{ t('pages.threads.loadMoreThreads') }}
          </button>
        </div>
        <p v-else class="threads-empty">{{ t('pages.threads.noThreads') }}</p>
      </section>

      <section class="thread-chat-panel">
        <template v-if="activeThread">
          <header class="thread-chat-header">
            <div>
              <h2>{{ activeThread.title }}</h2>
              <p>
                {{ activeThread.author?.displayName ?? t('pages.life.byUnknown') }} · {{ formatDateTime(activeThread.createdAt) }}
              </p>
            </div>
            <div class="thread-chat-actions">
              <button v-if="canFollow" type="button" class="ui-button ui-button--small" :disabled="busy" @click="toggleFollow">
                <Icon :icon="iconBell" class="ui-icon" aria-hidden="true" />
                {{ activeThread.followed ? t('pages.threads.unfollow') : t('pages.threads.follow') }}
              </button>
              <button v-if="canLockThreads" type="button" class="ui-button ui-button--small" :disabled="busy" @click="toggleThreadLock">
                {{ activeThread.locked ? t('pages.threads.unlock') : t('pages.threads.lock') }}
              </button>
              <button v-if="canDeleteThreads" type="button" class="ui-button ui-button--red ui-button--small" :disabled="busy" @click="removeActiveThread">
                <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                {{ t('common.delete') }}
              </button>
              <span v-if="activeThread.locked" class="config-flag">{{ t('pages.threads.locked') }}</span>
            </div>
          </header>

          <div class="thread-reactions">
            <button
              v-for="option in reactionOptions"
              :key="option.type"
              type="button"
              class="thread-reaction"
              :class="{ active: reactionActive(activeThread, option.type) }"
              :disabled="!canReact"
              @click="toggleThreadReaction(activeThread, option.type)"
            >
              <Icon :icon="option.icon" class="ui-icon" aria-hidden="true" />
              <span>{{ reactionCount(activeThread, option.type) }}</span>
            </button>
          </div>

          <div ref="chatScroller" class="thread-message-scroll" @scroll="onScroll">
            <button
              v-if="hasMoreBefore"
              type="button"
              class="ui-button ui-button--ghost thread-load-older"
              :disabled="loadingOlder"
              @click="loadMessages(false)"
            >
              <Icon :icon="iconChevronUp" class="ui-icon" aria-hidden="true" />
              {{ t('pages.threads.loadOlder') }}
            </button>
            <div v-if="loadingMessages" class="thread-message-list" aria-busy="true">
              <article v-for="index in 4" :key="index" class="thread-message-group">
                <Skeleton width="160px" />
                <Skeleton width="90%" />
              </article>
            </div>
            <div v-else-if="messages.length" class="thread-message-list">
              <article v-for="group in messageGroups" :key="group.key" class="thread-message-group">
                <div class="thread-avatar" aria-hidden="true">{{ authorInitial(group.author) }}</div>
                <div class="thread-message-group__body">
                  <div class="thread-message-meta">
                    <strong>{{ authorName(group.author) }}</strong>
                    <time :datetime="group.createdAt">{{ formatDateTime(group.createdAt) }}</time>
                  </div>
                  <div v-for="message in group.messages" :key="message.id" class="thread-message">
                    <p>{{ message.body }}</p>
                    <span v-if="message.moderationStatus === 'reviewing'" class="config-flag">{{ t('pages.threads.messageReviewing') }}</span>
                    <span v-else-if="message.moderationStatus === 'rejected' || message.moderationStatus === 'failed'" class="config-flag">
                      {{ t('pages.threads.messageRejected') }}
                    </span>
                    <div class="thread-reactions thread-reactions--message">
                      <button
                        v-for="option in reactionOptions"
                        :key="option.type"
                        type="button"
                        class="thread-reaction"
                        :class="{ active: reactionActive(message, option.type) }"
                        :disabled="!canReact || message.moderationStatus !== 'approved'"
                        @click="toggleMessageReaction(message, option.type)"
                      >
                        <Icon :icon="option.icon" class="ui-icon" aria-hidden="true" />
                        <span>{{ reactionCount(message, option.type) }}</span>
                      </button>
                      <button
                        v-if="canDeleteMessages"
                        type="button"
                        class="thread-reaction"
                        :disabled="busy"
                        :aria-label="t('common.delete')"
                        @click="removeMessage(message)"
                      >
                        <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
            <p v-else class="threads-empty">{{ t('pages.threads.noMessages') }}</p>
          </div>

          <button v-if="showJump" type="button" class="thread-jump-button" @click="scrollToBottom">
            {{ t('pages.threads.jumpToPresent') }}
          </button>

          <form class="thread-composer" @submit.prevent="submitMessage">
            <label class="sr-only" for="thread-message-body">{{ t('pages.threads.message') }}</label>
            <textarea
              id="thread-message-body"
              v-model="composerBody"
              rows="2"
              :disabled="busy || !canCreateMessage || activeThread.locked"
              :placeholder="t('pages.threads.message')"
            ></textarea>
            <button class="ui-button ui-button--primary" type="submit" :disabled="busy || !composerBody.trim() || !canCreateMessage || activeThread.locked">
              <Icon :icon="iconSend" class="ui-icon" aria-hidden="true" />
              {{ busy ? t('pages.threads.sending') : t('pages.threads.send') }}
            </button>
          </form>
        </template>
        <p v-else class="threads-empty threads-empty--select">{{ t('pages.threads.selectThread') }}</p>
      </section>
    </div>

    <Modal v-if="createModalOpen" :title="t('pages.threads.newThread')" :close-label="t('common.close')" @close="closeCreateThread">
      <form class="modal-edit-form" @submit.prevent="submitThread">
        <div class="field">
          <label for="thread-title">{{ t('pages.threads.threadTitle') }}</label>
          <input id="thread-title" v-model="threadForm.title" required maxlength="140" :disabled="busy" />
        </div>
        <div class="field">
          <label for="thread-language">{{ t('pages.threads.language') }}</label>
          <select id="thread-language" v-model="threadForm.languageCode" :disabled="busy">
            <option v-for="language in languageOptions" :key="language.code" :value="language.code">{{ language.name }}</option>
          </select>
        </div>
        <div v-if="tagOptions.length" class="field">
          <span class="field-label">{{ t('pages.threads.tags') }}</span>
          <div class="thread-tag-filter">
            <button
              v-for="tag in tagOptions"
              :key="tag.id"
              type="button"
              class="thread-chip"
              :class="{ active: threadForm.tagIds.includes(tag.id) }"
              :disabled="busy"
              @click="toggleThreadTag(tag)"
            >
              {{ tag.name }}
            </button>
          </div>
        </div>
        <div class="field">
          <label for="thread-body">{{ t('pages.threads.firstMessage') }}</label>
          <textarea id="thread-body" v-model="threadForm.body" rows="5" required maxlength="2000" :disabled="busy"></textarea>
        </div>
        <button class="ui-button ui-button--primary" type="submit" :disabled="busy || !threadForm.title.trim() || !threadForm.body.trim()">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('common.saving') : t('common.create') }}
        </button>
      </form>
    </Modal>
  </section>
</template>
