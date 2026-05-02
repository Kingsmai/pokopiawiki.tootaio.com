<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { iconCancel, iconComment, iconDelete, iconReply } from '../icons';
import {
  api,
  getAuthToken,
  onAuthTokenChange,
  setAuthToken,
  type AuthUser,
  type DiscussionEntityType,
  type EntityDiscussionComment
} from '../services/api';
import Skeleton from './Skeleton.vue';

const props = defineProps<{
  entityType: DiscussionEntityType;
  entityId: string | number;
}>();

const { locale, t } = useI18n();
const comments = ref<EntityDiscussionComment[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const authReady = ref(false);
const body = ref('');
const replyBodies = ref<Record<number, string>>({});
const replyTargetId = ref<number | null>(null);
const busyKey = ref('');
const loadError = ref('');
const formError = ref('');
const commentErrors = ref<Record<string, string>>({});
const commentInput = ref<HTMLTextAreaElement | null>(null);
const commentMaxLength = 1000;
let requestId = 0;
let removeAuthListener: (() => void) | null = null;

const canComment = computed(() => currentUser.value?.emailVerified === true);
const charactersLeft = computed(() => Math.max(0, commentMaxLength - body.value.length));
const commentTotal = computed(() => comments.value.reduce((total, comment) => total + 1 + comment.replies.length, 0));

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

async function loadDiscussion() {
  const nextRequestId = ++requestId;
  loading.value = true;
  loadError.value = '';

  try {
    const rows = await api.entityDiscussion(props.entityType, props.entityId);
    if (nextRequestId === requestId) {
      comments.value = rows;
    }
  } catch (error) {
    if (nextRequestId === requestId) {
      loadError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
    }
  } finally {
    if (nextRequestId === requestId) {
      loading.value = false;
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
  return !comment.deleted && currentUser.value?.id === comment.author?.id;
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
    const comment = await api.createEntityDiscussionComment(props.entityType, props.entityId, { body: nextBody });
    comments.value = [...comments.value, comment];
    body.value = '';
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
    const reply = await api.createEntityDiscussionReply(props.entityType, props.entityId, comment.id, { body: nextBody });
    comment.replies.push(reply);
    cancelReply(comment.id);
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('discussion.replyFailed'));
  } finally {
    busyKey.value = '';
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
    void loadDiscussion();
  }
);

onMounted(() => {
  void loadCurrentUser();
  void loadDiscussion();
  removeAuthListener = onAuthTokenChange(() => {
    void loadCurrentUser();
  });
});

onUnmounted(() => {
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
            <strong>{{ commentAuthorName(comment) }}</strong>
            <time :datetime="comment.createdAt">{{ formatDateTime(comment.createdAt) }}</time>
          </div>
          <p v-if="!comment.deleted" class="entity-discussion-comment__body">{{ comment.body }}</p>

          <div v-if="!comment.deleted" class="entity-discussion-comment__actions">
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
                  <strong>{{ commentAuthorName(reply) }}</strong>
                  <time :datetime="reply.createdAt">{{ formatDateTime(reply.createdAt) }}</time>
                </div>
                <p v-if="!reply.deleted" class="entity-discussion-comment__body">{{ reply.body }}</p>
                <div v-if="canManageComment(reply)" class="entity-discussion-comment__actions">
                  <button
                    class="life-icon-button life-icon-button--flat life-icon-button--danger"
                    type="button"
                    :aria-label="t('discussion.deleteComment')"
                    @click="deleteComment(reply)"
                  >
                    <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                    <span class="life-action-tooltip" role="tooltip">{{ t('discussion.deleteComment') }}</span>
                  </button>
                </div>
                <p v-if="commentErrors[commentKey(reply.id)]" class="entity-discussion-form__error" role="alert">
                  {{ commentErrors[commentKey(reply.id)] }}
                </p>
              </div>
            </article>
          </div>
        </div>
      </article>
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
