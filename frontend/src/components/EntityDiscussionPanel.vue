<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import StatusBadge from './StatusBadge.vue';
import Tabs, { type TabOption } from './Tabs.vue';
import { iconCancel, iconComment, iconDelete, iconReactionLike, iconReply, iconWarning } from '../icons';
import {
  api,
  getAuthToken,
  moderationUpdateEvent,
  onAuthTokenChange,
  setAuthToken,
  type AiModerationStatus,
  type AuthUser,
  type CommentSort,
  type DiscussionEntityType,
  type EntityDiscussionComment,
  type Language,
  type ModerationUpdateDetail
} from '../services/api';
import Skeleton from './Skeleton.vue';

const props = defineProps<{
  entityType: DiscussionEntityType;
  entityId: string | number;
}>();

const { locale, t } = useI18n();
const comments = ref<EntityDiscussionComment[]>([]);
const languages = ref<Language[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const authReady = ref(false);
const body = ref('');
const replyBodies = ref<Record<number, string>>({});
const replyTargetId = ref<number | null>(null);
const busyKey = ref('');
const loadError = ref('');
const formError = ref('');
const commentErrors = ref<Record<string, string>>({});
const commentInput = ref<HTMLTextAreaElement | null>(null);
const activeLanguageCode = ref('all');
const activeSort = ref<CommentSort>('oldest');
const moderationBusyId = ref<number | null>(null);
const likeBusyId = ref<number | null>(null);
const commentMaxLength = 1000;
const discussionPageSize = 20;
const allLanguageValue = 'all';
let requestId = 0;
let removeAuthListener: (() => void) | null = null;
const nextCursor = ref<string | null>(null);
const hasMoreComments = ref(false);
const commentTotal = ref(0);

function can(permissionKey: string) {
  return currentUser.value?.permissions.includes(permissionKey) === true;
}

const canComment = computed(() => can('discussions.comments.create'));
const canLikeComments = computed(() => can('discussions.comments.like'));
const charactersLeft = computed(() => Math.max(0, commentMaxLength - body.value.length));
const selectedLanguageCode = computed(() => (activeLanguageCode.value === allLanguageValue ? undefined : activeLanguageCode.value));
const languageTabs = computed<TabOption[]>(() => [
  { value: allLanguageValue, label: t('discussion.allLanguages') },
  ...languages.value.map((language) => ({ value: language.code, label: language.name }))
]);
const sortOptions = computed<Array<{ value: CommentSort; label: string }>>(() => [
  { value: 'oldest', label: t('discussion.sortOldest') },
  { value: 'latest', label: t('discussion.sortLatest') },
  { value: 'most-liked', label: t('discussion.sortMostLiked') },
  { value: 'most-replied', label: t('discussion.sortMostReplied') }
]);

async function loadCurrentUser() {
  authReady.value = false;

  if (!getAuthToken()) {
    currentUser.value = null;
    authReady.value = true;
    return;
  }

  try {
    const response = await api.me();
    currentUser.value = response.user;
  } catch {
    currentUser.value = null;
    setAuthToken(null);
  } finally {
    authReady.value = true;
  }
}

async function loadLanguages() {
  try {
    languages.value = (await api.languages()).filter((language) => language.enabled);
    if (
      activeLanguageCode.value !== allLanguageValue &&
      !languages.value.some((language) => language.code === activeLanguageCode.value)
    ) {
      activeLanguageCode.value = allLanguageValue;
    }
  } catch {
    languages.value = [];
  }
}

function mergeComments(existing: EntityDiscussionComment[], incoming: EntityDiscussionComment[]) {
  const ids = new Set(existing.map((comment) => comment.id));
  return [...existing, ...incoming.filter((comment) => !ids.has(comment.id))];
}

async function loadDiscussion(reset = true) {
  if (!reset && (loadingMore.value || !hasMoreComments.value)) {
    return;
  }

  const nextRequestId = ++requestId;
  if (reset) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }
  loadError.value = '';

  try {
    const page = await api.entityDiscussion(props.entityType, props.entityId, {
      limit: discussionPageSize,
      cursor: reset ? null : nextCursor.value,
      language: selectedLanguageCode.value,
      sort: activeSort.value
    });
    if (nextRequestId === requestId) {
      comments.value = reset ? page.items : mergeComments(comments.value, page.items);
      nextCursor.value = page.nextCursor;
      hasMoreComments.value = page.hasMore;
      commentTotal.value = page.total;
    }
  } catch (error) {
    if (nextRequestId === requestId) {
      loadError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
    }
  } finally {
    if (nextRequestId === requestId) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function resetComposer() {
  body.value = '';
  replyBodies.value = {};
  replyTargetId.value = null;
  formError.value = '';
  commentErrors.value = {};
}

function commentKey(commentId: number) {
  return `comment-${commentId}`;
}

function likeKey(commentId: number) {
  return `like-${commentId}`;
}

function handleSortChange(event: Event) {
  if (event.target instanceof HTMLSelectElement) {
    activeSort.value = event.target.value as CommentSort;
    void loadDiscussion();
  }
}

function replyBody(commentId: number) {
  return replyBodies.value[commentId] ?? '';
}

function setCommentError(key: string, message: string) {
  commentErrors.value = { ...commentErrors.value, [key]: message };
}

function clearCommentError(key: string) {
  const nextErrors = { ...commentErrors.value };
  delete nextErrors[key];
  commentErrors.value = nextErrors;
}

function canManageComment(comment: EntityDiscussionComment) {
  return (
    !comment.deleted &&
    ((currentUser.value?.id === comment.author?.id && can('discussions.comments.delete')) ||
      can('discussions.comments.delete-any'))
  );
}

function canSeeModeration(comment: EntityDiscussionComment) {
  return currentUser.value?.id === comment.author?.id || can('discussions.comments.delete-any');
}

function canRetryModeration(comment: EntityDiscussionComment) {
  return !comment.deleted && comment.moderationStatus !== 'approved' && comment.moderationStatus !== 'reviewing' && canSeeModeration(comment);
}

function canLikeComment(comment: EntityDiscussionComment) {
  return canLikeComments.value && !comment.deleted && comment.moderationStatus === 'approved';
}

function commentLikeLabel(comment: EntityDiscussionComment) {
  return comment.myLiked ? t('discussion.unlikeComment') : t('discussion.likeComment');
}

function moderationReasonVisible(comment: EntityDiscussionComment) {
  return (
    !comment.deleted &&
    canSeeModeration(comment) &&
    (comment.moderationStatus === 'rejected' || comment.moderationStatus === 'failed') &&
    comment.moderationReason !== null &&
    comment.moderationReason.trim() !== ''
  );
}

function moderationLabel(status: AiModerationStatus) {
  const labels: Record<AiModerationStatus, string> = {
    unreviewed: t('discussion.moderationUnreviewed'),
    reviewing: t('discussion.moderationReviewing'),
    approved: t('discussion.moderationApproved'),
    rejected: t('discussion.moderationRejected'),
    failed: t('discussion.moderationFailed')
  };
  return labels[status];
}

function moderationTone(status: AiModerationStatus) {
  const tones: Record<AiModerationStatus, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
    unreviewed: 'neutral',
    reviewing: 'info',
    approved: 'success',
    rejected: 'danger',
    failed: 'warning'
  };
  return tones[status];
}

function commentAuthorName(comment: EntityDiscussionComment) {
  return comment.deleted ? t('discussion.deletedComment') : comment.author?.displayName ?? t('discussion.byUnknown');
}

function commentInitial(comment: EntityDiscussionComment) {
  return commentAuthorName(comment).slice(0, 1).toUpperCase();
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

function isBusy(key: string) {
  return busyKey.value === key;
}

function startReply(comment: EntityDiscussionComment) {
  replyTargetId.value = comment.id;
  clearCommentError(commentKey(comment.id));
}

function cancelReply(commentId: number) {
  replyTargetId.value = null;
  replyBodies.value[commentId] = '';
  clearCommentError(commentKey(commentId));
}

async function submitComment() {
  const nextBody = body.value.trim();
  if (!nextBody) {
    formError.value = t('discussion.commentRequired');
    commentInput.value?.focus();
    return;
  }

  busyKey.value = 'new-comment';
  formError.value = '';

  try {
    const comment = await api.createEntityDiscussionComment(props.entityType, props.entityId, {
      body: nextBody,
      languageCode: selectedLanguageCode.value ?? null
    });
    comments.value = [...comments.value, comment];
    commentTotal.value += 1;
    body.value = '';
    if (activeSort.value !== 'oldest') {
      void loadDiscussion();
    }
  } catch (error) {
    formError.value = error instanceof Error && error.message ? error.message : t('discussion.commentFailed');
  } finally {
    busyKey.value = '';
  }
}

async function submitReply(comment: EntityDiscussionComment) {
  const key = commentKey(comment.id);
  const nextBody = replyBody(comment.id).trim();
  if (!nextBody) {
    setCommentError(key, t('discussion.commentRequired'));
    return;
  }

  busyKey.value = key;
  clearCommentError(key);

  try {
    const reply = await api.createEntityDiscussionReply(props.entityType, props.entityId, comment.id, {
      body: nextBody,
      languageCode: selectedLanguageCode.value ?? comment.moderationLanguageCode
    });
    comment.replies.push(reply);
    comment.replyCount += 1;
    commentTotal.value += 1;
    cancelReply(comment.id);
    if (activeSort.value === 'most-replied') {
      void loadDiscussion();
    }
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('discussion.replyFailed'));
  } finally {
    busyKey.value = '';
  }
}

async function retryModeration(comment: EntityDiscussionComment) {
  const key = commentKey(comment.id);
  moderationBusyId.value = comment.id;
  clearCommentError(key);

  try {
    const updated = await api.retryEntityDiscussionModeration(comment.id);
    comment.moderationStatus = updated.moderationStatus;
    comment.moderationLanguageCode = updated.moderationLanguageCode;
    comment.moderationReason = updated.moderationReason;
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('discussion.moderationRetryFailed'));
  } finally {
    moderationBusyId.value = null;
  }
}

function replaceCommentInTree(items: EntityDiscussionComment[], updated: EntityDiscussionComment): boolean {
  for (let index = 0; index < items.length; index += 1) {
    const comment = items[index];
    if (!comment) {
      continue;
    }
    if (comment.id === updated.id) {
      items[index] = { ...updated, replies: comment.replies };
      return true;
    }
    if (replaceCommentInTree(comment.replies, updated)) {
      return true;
    }
  }

  return false;
}

async function toggleCommentLike(comment: EntityDiscussionComment) {
  if (!canLikeComment(comment)) {
    return;
  }

  const key = likeKey(comment.id);
  likeBusyId.value = comment.id;
  clearCommentError(key);

  try {
    const updated = comment.myLiked
      ? await api.deleteEntityDiscussionCommentLike(comment.id)
      : await api.setEntityDiscussionCommentLike(comment.id);
    replaceCommentInTree(comments.value, updated);
    comments.value = [...comments.value];
    if (activeSort.value === 'most-liked') {
      void loadDiscussion();
    }
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('discussion.commentLikeFailed'));
  } finally {
    likeBusyId.value = null;
  }
}

function updateDiscussionCommentModeration(
  items: EntityDiscussionComment[],
  commentId: number,
  status: AiModerationStatus,
  languageCode: string | null,
  reason: string | null
): boolean {
  for (const comment of items) {
    if (comment.id === commentId) {
      comment.moderationStatus = status;
      comment.moderationLanguageCode = languageCode;
      comment.moderationReason = reason;
      return true;
    }

    if (updateDiscussionCommentModeration(comment.replies, commentId, status, languageCode, reason)) {
      return true;
    }
  }

  return false;
}

function isModerationUpdateEvent(event: Event): event is CustomEvent<ModerationUpdateDetail> {
  return event instanceof CustomEvent && event.detail?.type === 'moderation.updated';
}

function handleModerationUpdate(event: Event) {
  if (!isModerationUpdateEvent(event)) {
    return;
  }

  const { target, moderationStatus, moderationLanguageCode, moderationReason } = event.detail;
  if (
    target.type !== 'discussion-comment' ||
    target.discussionCommentId === null ||
    target.entityType !== props.entityType ||
    target.entityId !== Number(props.entityId)
  ) {
    return;
  }

  const updated = updateDiscussionCommentModeration(
    comments.value,
    target.discussionCommentId,
    moderationStatus,
    moderationLanguageCode,
    moderationReason
  );
  if (updated) {
    comments.value = [...comments.value];
  } else if (moderationStatus === 'approved') {
    void loadDiscussion();
  }
}

function markCommentDeleted(rows: EntityDiscussionComment[], id: number): boolean {
  for (const comment of rows) {
    if (comment.id === id) {
      comment.deleted = true;
      comment.body = '';
      comment.author = null;
      return true;
    }

    if (markCommentDeleted(comment.replies, id)) {
      return true;
    }
  }

  return false;
}

async function deleteComment(comment: EntityDiscussionComment) {
  if (!window.confirm(t('discussion.deleteConfirm'))) {
    return;
  }

  const key = commentKey(comment.id);
  clearCommentError(key);

  try {
    await api.deleteEntityDiscussionComment(comment.id);
    markCommentDeleted(comments.value, comment.id);
    if (replyTargetId.value === comment.id) {
      cancelReply(comment.id);
    }
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('discussion.deleteFailed'));
  }
}

watch(
  () => [props.entityType, props.entityId],
  () => {
    resetComposer();
    comments.value = [];
    nextCursor.value = null;
    hasMoreComments.value = false;
    commentTotal.value = 0;
    void loadDiscussion();
  }
);

watch(activeLanguageCode, () => {
  comments.value = [];
  nextCursor.value = null;
  hasMoreComments.value = false;
  commentTotal.value = 0;
  void loadDiscussion();
});

onMounted(() => {
  window.addEventListener(moderationUpdateEvent, handleModerationUpdate);
  void loadCurrentUser();
  void loadLanguages();
  void loadDiscussion();
  removeAuthListener = onAuthTokenChange(() => {
    void loadCurrentUser();
  });
});

onUnmounted(() => {
  window.removeEventListener(moderationUpdateEvent, handleModerationUpdate);
  removeAuthListener?.();
});
</script>

<template>
  <section class="entity-discussion-panel" aria-labelledby="entity-discussion-title">
    <div class="entity-discussion-panel__header">
      <div>
        <h2 id="entity-discussion-title">{{ t('discussion.title') }}</h2>
        <p>{{ t('discussion.count', { count: commentTotal }) }}</p>
      </div>
    </div>

    <Tabs id="entity-discussion-language" v-model="activeLanguageCode" :tabs="languageTabs" :label="t('discussion.languages')" />
    <label class="entity-discussion-sort">
      <span>{{ t('discussion.sort') }}</span>
      <select :value="activeSort" @change="handleSortChange">
        <option v-for="option in sortOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <div v-if="!authReady" class="entity-discussion-skeleton" aria-hidden="true">
      <Skeleton variant="box" height="112px" />
    </div>

    <form v-else-if="canComment" class="entity-discussion-form" @submit.prevent="submitComment">
      <div class="field">
        <label :for="`entity-discussion-comment-${props.entityType}-${props.entityId}`">{{ t('discussion.comment') }}</label>
        <textarea
          :id="`entity-discussion-comment-${props.entityType}-${props.entityId}`"
          ref="commentInput"
          v-model="body"
          :maxlength="commentMaxLength"
          :placeholder="t('discussion.commentPlaceholder')"
        ></textarea>
        <span class="entity-discussion-form__counter">{{ t('discussion.charactersLeft', { count: charactersLeft }) }}</span>
      </div>
      <p v-if="formError" class="entity-discussion-form__error" role="alert">{{ formError }}</p>
      <button class="ui-button ui-button--primary ui-button--small" :disabled="isBusy('new-comment') || !body.trim()" type="submit">
        <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
        {{ isBusy('new-comment') ? t('discussion.postingComment') : t('discussion.postComment') }}
      </button>
    </form>

    <div v-else class="entity-discussion-auth-note">
      <p>{{ currentUser ? t('discussion.verifyPrompt') : t('discussion.loginPrompt') }}</p>
      <RouterLink v-if="!currentUser" class="ui-button ui-button--primary ui-button--small" :to="{ path: '/login', query: { redirect: $route.fullPath } }">
        {{ t('nav.login') }}
      </RouterLink>
    </div>

    <div v-if="loading" class="entity-discussion-list" :aria-label="t('discussion.loading')">
      <article v-for="index in 3" :key="index" class="entity-discussion-comment entity-discussion-comment--skeleton">
        <Skeleton variant="box" width="40px" height="40px" />
        <div class="entity-discussion-comment__content">
          <Skeleton width="148px" />
          <Skeleton width="88%" />
          <Skeleton width="62%" />
        </div>
      </article>
    </div>

    <p v-else-if="loadError" class="entity-discussion-form__error" role="alert">{{ loadError }}</p>

    <div v-else-if="comments.length" class="entity-discussion-list">
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="entity-discussion-comment"
        :class="{ 'is-deleted': comment.deleted }"
      >
        <div class="entity-discussion-comment__avatar" aria-hidden="true">{{ commentInitial(comment) }}</div>
        <div class="entity-discussion-comment__content">
          <div class="entity-discussion-comment__meta">
            <RouterLink v-if="!comment.deleted && comment.author" class="user-profile-link" :to="`/profile/${comment.author.id}`">
              {{ comment.author.displayName }}
            </RouterLink>
            <strong v-else>{{ commentAuthorName(comment) }}</strong>
            <time :datetime="comment.createdAt">{{ formatDateTime(comment.createdAt) }}</time>
            <StatusBadge
              v-if="canSeeModeration(comment)"
              :label="moderationLabel(comment.moderationStatus)"
              :tone="moderationTone(comment.moderationStatus)"
              compact
            />
          </div>
          <p v-if="!comment.deleted" class="entity-discussion-comment__body">{{ comment.body }}</p>
          <p v-if="moderationReasonVisible(comment)" class="life-moderation-detail life-moderation-detail--comment">
            <strong>{{ t('discussion.moderationReason') }}</strong>
            <span>{{ comment.moderationReason }}</span>
          </p>

          <div v-if="!comment.deleted" class="entity-discussion-comment__actions">
            <button
              class="life-icon-button life-icon-button--flat"
              type="button"
              :aria-label="commentLikeLabel(comment)"
              :aria-pressed="comment.myLiked"
              :disabled="!canLikeComment(comment) || likeBusyId === comment.id"
              @click="toggleCommentLike(comment)"
            >
              <Icon :icon="iconReactionLike" class="ui-icon" aria-hidden="true" />
              <span class="life-comment__action-count">{{ comment.likeCount }}</span>
              <span class="life-action-tooltip" role="tooltip">{{ t('discussion.commentLikeCount', { count: comment.likeCount }) }}</span>
            </button>
            <button
              v-if="canComment"
              class="life-icon-button life-icon-button--flat"
              type="button"
              :aria-label="t('discussion.reply')"
              @click="startReply(comment)"
            >
              <Icon :icon="iconReply" class="ui-icon" aria-hidden="true" />
              <span class="life-action-tooltip" role="tooltip">{{ t('discussion.reply') }}</span>
            </button>
            <button
              v-if="canRetryModeration(comment)"
              class="life-icon-button life-icon-button--flat"
              type="button"
              :aria-label="t('discussion.moderationRetry')"
              :disabled="moderationBusyId === comment.id"
              @click="retryModeration(comment)"
            >
              <Icon :icon="iconWarning" class="ui-icon" aria-hidden="true" />
              <span class="life-action-tooltip" role="tooltip">
                {{ moderationBusyId === comment.id ? t('discussion.moderationRetrying') : t('discussion.moderationRetry') }}
              </span>
            </button>
            <button
              v-if="canManageComment(comment)"
              class="life-icon-button life-icon-button--flat life-icon-button--danger"
              type="button"
              :aria-label="t('discussion.deleteComment')"
              @click="deleteComment(comment)"
            >
              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
              <span class="life-action-tooltip" role="tooltip">{{ t('discussion.deleteComment') }}</span>
            </button>
          </div>

          <p v-if="commentErrors[likeKey(comment.id)]" class="entity-discussion-form__error" role="alert">
            {{ commentErrors[likeKey(comment.id)] }}
          </p>
          <p v-if="commentErrors[commentKey(comment.id)]" class="entity-discussion-form__error" role="alert">
            {{ commentErrors[commentKey(comment.id)] }}
          </p>

          <form
            v-if="canComment && replyTargetId === comment.id"
            class="entity-discussion-form entity-discussion-form--reply"
            @submit.prevent="submitReply(comment)"
          >
            <div class="field">
              <label :for="`entity-discussion-reply-${comment.id}`">{{ t('discussion.reply') }}</label>
              <textarea
                :id="`entity-discussion-reply-${comment.id}`"
                v-model="replyBodies[comment.id]"
                :maxlength="commentMaxLength"
                :placeholder="t('discussion.replyPlaceholder')"
              ></textarea>
            </div>
            <div class="entity-discussion-form__actions">
              <button
                class="ui-button ui-button--ghost ui-button--small"
                :disabled="isBusy(commentKey(comment.id)) || !replyBody(comment.id).trim()"
                type="submit"
              >
                <Icon :icon="iconReply" class="ui-icon" aria-hidden="true" />
                {{ isBusy(commentKey(comment.id)) ? t('discussion.postingReply') : t('discussion.postReply') }}
              </button>
              <button class="ui-button ui-button--ghost ui-button--small" type="button" @click="cancelReply(comment.id)">
                <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
                {{ t('discussion.cancelReply') }}
              </button>
            </div>
          </form>

          <div v-if="comment.replies.length" class="entity-discussion-replies">
            <article
              v-for="reply in comment.replies"
              :key="reply.id"
              class="entity-discussion-comment entity-discussion-comment--reply"
              :class="{ 'is-deleted': reply.deleted }"
            >
              <div class="entity-discussion-comment__avatar" aria-hidden="true">{{ commentInitial(reply) }}</div>
              <div class="entity-discussion-comment__content">
                <div class="entity-discussion-comment__meta">
                  <RouterLink v-if="!reply.deleted && reply.author" class="user-profile-link" :to="`/profile/${reply.author.id}`">
                    {{ reply.author.displayName }}
                  </RouterLink>
                  <strong v-else>{{ commentAuthorName(reply) }}</strong>
                  <time :datetime="reply.createdAt">{{ formatDateTime(reply.createdAt) }}</time>
                  <StatusBadge
                    v-if="canSeeModeration(reply)"
                    :label="moderationLabel(reply.moderationStatus)"
                    :tone="moderationTone(reply.moderationStatus)"
                    compact
                  />
                </div>
                <p v-if="!reply.deleted" class="entity-discussion-comment__body">{{ reply.body }}</p>
                <p v-if="moderationReasonVisible(reply)" class="life-moderation-detail life-moderation-detail--comment">
                  <strong>{{ t('discussion.moderationReason') }}</strong>
                  <span>{{ reply.moderationReason }}</span>
                </p>
                <div v-if="!reply.deleted" class="entity-discussion-comment__actions">
                  <button
                    class="life-icon-button life-icon-button--flat"
                    type="button"
                    :aria-label="commentLikeLabel(reply)"
                    :aria-pressed="reply.myLiked"
                    :disabled="!canLikeComment(reply) || likeBusyId === reply.id"
                    @click="toggleCommentLike(reply)"
                  >
                    <Icon :icon="iconReactionLike" class="ui-icon" aria-hidden="true" />
                    <span class="life-comment__action-count">{{ reply.likeCount }}</span>
                    <span class="life-action-tooltip" role="tooltip">{{ t('discussion.commentLikeCount', { count: reply.likeCount }) }}</span>
                  </button>
                  <button
                    v-if="canRetryModeration(reply)"
                    class="life-icon-button life-icon-button--flat"
                    type="button"
                    :aria-label="t('discussion.moderationRetry')"
                    :disabled="moderationBusyId === reply.id"
                    @click="retryModeration(reply)"
                  >
                    <Icon :icon="iconWarning" class="ui-icon" aria-hidden="true" />
                    <span class="life-action-tooltip" role="tooltip">
                      {{ moderationBusyId === reply.id ? t('discussion.moderationRetrying') : t('discussion.moderationRetry') }}
                    </span>
                  </button>
                  <button
                    v-if="canManageComment(reply)"
                    class="life-icon-button life-icon-button--flat life-icon-button--danger"
                    type="button"
                    :aria-label="t('discussion.deleteComment')"
                    @click="deleteComment(reply)"
                  >
                    <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                    <span class="life-action-tooltip" role="tooltip">{{ t('discussion.deleteComment') }}</span>
                  </button>
                </div>
                <p v-if="commentErrors[likeKey(reply.id)]" class="entity-discussion-form__error" role="alert">
                  {{ commentErrors[likeKey(reply.id)] }}
                </p>
                <p v-if="commentErrors[commentKey(reply.id)]" class="entity-discussion-form__error" role="alert">
                  {{ commentErrors[commentKey(reply.id)] }}
                </p>
              </div>
            </article>
          </div>
        </div>
      </article>

      <div v-if="hasMoreComments" class="life-feed__retry">
        <button
          class="ui-button ui-button--ghost ui-button--small"
          type="button"
          :disabled="loadingMore"
          @click="loadDiscussion(false)"
        >
          <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
          {{ loadingMore ? t('common.loading') : t('discussion.loadMore') }}
        </button>
      </div>
    </div>

    <div v-else class="entity-discussion-empty">
      <Icon :icon="iconComment" class="entity-discussion-empty__icon" aria-hidden="true" />
      <div>
        <h3>{{ t('discussion.empty') }}</h3>
        <p>{{ t('discussion.emptyHint') }}</p>
      </div>
    </div>
  </section>
</template>
