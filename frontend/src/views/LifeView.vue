<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import {
  iconCancel,
  iconComment,
  iconDelete,
  iconEdit,
  iconLife,
  iconReactionFun,
  iconReactionHelpful,
  iconReactionLike,
  iconReactionThanks,
  iconReply,
  iconSave
} from '../icons';
import {
  api,
  getAuthToken,
  onAuthTokenChange,
  setAuthToken,
  type AuthUser,
  type LifeComment,
  type LifePost,
  type LifeReactionType
} from '../services/api';

const { locale, t } = useI18n();
const posts = ref<LifePost[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const authReady = ref(false);
const busy = ref(false);
const body = ref('');
const editingPostId = ref<number | null>(null);
const formError = ref('');
const loadError = ref('');
const commentBodies = ref<Record<number, string>>({});
const replyBodies = ref<Record<number, string>>({});
const replyTargetId = ref<number | null>(null);
const expandedComments = ref<Record<number, boolean>>({});
const commentBusyKey = ref('');
const commentErrors = ref<Record<string, string>>({});
const reactionPickerPostId = ref<number | null>(null);
const reactionBusyPostId = ref<number | null>(null);
const reactionErrors = ref<Record<number, string>>({});
const bodyInput = ref<HTMLTextAreaElement | null>(null);
const skeletonPostCount = 3;
let removeAuthListener: (() => void) | null = null;

const reactionOptions = [
  { type: 'like', icon: iconReactionLike, labelKey: 'pages.life.reactionLike' },
  { type: 'helpful', icon: iconReactionHelpful, labelKey: 'pages.life.reactionHelpful' },
  { type: 'fun', icon: iconReactionFun, labelKey: 'pages.life.reactionFun' },
  { type: 'thanks', icon: iconReactionThanks, labelKey: 'pages.life.reactionThanks' }
] as const satisfies ReadonlyArray<{ type: LifeReactionType; icon: string; labelKey: string }>;

const canPost = computed(() => currentUser.value?.emailVerified === true);
const charactersLeft = computed(() => Math.max(0, 2000 - body.value.length));
const isEditing = computed(() => editingPostId.value !== null);
const submitLabel = computed(() => {
  if (busy.value) return isEditing.value ? t('pages.life.updating') : t('pages.life.publishing');
  return isEditing.value ? t('pages.life.update') : t('pages.life.publish');
});

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

async function loadPosts() {
  loading.value = true;
  loadError.value = '';

  try {
    posts.value = await api.lifePosts();
  } catch (error) {
    loadError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  body.value = '';
  editingPostId.value = null;
  formError.value = '';
}

function payload() {
  return {
    body: body.value.trim()
  };
}

async function submitPost() {
  if (!body.value.trim()) {
    formError.value = t('pages.life.bodyRequired');
    bodyInput.value?.focus();
    return;
  }

  busy.value = true;
  formError.value = '';

  try {
    if (editingPostId.value !== null) {
      const updated = await api.updateLifePost(editingPostId.value, payload());
      replacePost(updated);
    } else {
      const created = await api.createLifePost(payload());
      posts.value = [created, ...posts.value];
    }
    resetForm();
  } catch (error) {
    formError.value =
      error instanceof Error && error.message
        ? error.message
        : isEditing.value
          ? t('pages.life.saveFailed')
          : t('pages.life.postFailed');
  } finally {
    busy.value = false;
  }
}

function canManage(post: LifePost) {
  return currentUser.value?.id === post.author?.id;
}

function canManageComment(comment: LifeComment) {
  return !comment.deleted && currentUser.value?.id === comment.author?.id;
}

function commentKey(postId: number) {
  return `post-${postId}`;
}

function replyKey(commentId: number) {
  return `reply-${commentId}`;
}

function commentCount(post: LifePost) {
  return post.comments.reduce((count, comment) => count + 1 + comment.replies.length, 0);
}

function reactionTotal(post: LifePost) {
  return reactionOptions.reduce((count, option) => count + (post.reactionCounts[option.type] ?? 0), 0);
}

function reactionLabel(type: LifeReactionType) {
  return t(reactionOptions.find((option) => option.type === type)?.labelKey ?? 'pages.life.react');
}

function reactionIcon(type: LifeReactionType | null) {
  return reactionOptions.find((option) => option.type === type)?.icon ?? iconReactionLike;
}

function reactionButtonLabel(post: LifePost) {
  return post.myReaction ? reactionLabel(post.myReaction) : t('pages.life.reactionLike');
}

function reactionOptionLabel(post: LifePost, type: LifeReactionType) {
  return post.myReaction === type ? t('pages.life.removeReaction') : reactionLabel(type);
}

function reactionCountLabel(post: LifePost, type: LifeReactionType) {
  return t('pages.life.reactionCountLabel', {
    reaction: reactionLabel(type),
    count: post.reactionCounts[type] ?? 0
  });
}

function replacePost(updatedPost: LifePost) {
  posts.value = posts.value.map((post) => (post.id === updatedPost.id ? updatedPost : post));
}

function areCommentsExpanded(postId: number) {
  return expandedComments.value[postId] === true;
}

function setCommentsExpanded(postId: number, expanded: boolean) {
  expandedComments.value = {
    ...expandedComments.value,
    [postId]: expanded
  };
}

function toggleComments(postId: number) {
  setCommentsExpanded(postId, !areCommentsExpanded(postId));
}

function isCommentBusy(key: string) {
  return commentBusyKey.value === key;
}

function isReactionBusy(postId: number) {
  return reactionBusyPostId.value === postId;
}

function commentAuthorName(comment: LifeComment) {
  return comment.deleted ? t('pages.life.commentDeleted') : comment.author?.displayName ?? t('pages.life.byUnknown');
}

function commentInitial(comment: LifeComment) {
  const name = commentAuthorName(comment);
  return name.slice(0, 1).toUpperCase();
}

function setCommentError(key: string, message: string) {
  commentErrors.value = { ...commentErrors.value, [key]: message };
}

function clearCommentError(key: string) {
  const nextErrors = { ...commentErrors.value };
  delete nextErrors[key];
  commentErrors.value = nextErrors;
}

function setReactionError(postId: number, message: string) {
  reactionErrors.value = { ...reactionErrors.value, [postId]: message };
}

function clearReactionError(postId: number) {
  const nextErrors = { ...reactionErrors.value };
  delete nextErrors[postId];
  reactionErrors.value = nextErrors;
}

function canUseReactions() {
  return canPost.value && reactionBusyPostId.value === null;
}

function toggleReactionPicker(postId: number) {
  if (!canUseReactions()) {
    return;
  }

  clearReactionError(postId);
  reactionPickerPostId.value = reactionPickerPostId.value === postId ? null : postId;
}

function handleReactionContextMenu(event: MouseEvent, postId: number) {
  event.preventDefault();
  toggleReactionPicker(postId);
}

function handleReactionKeydown(event: KeyboardEvent, postId: number) {
  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) {
    return;
  }

  event.preventDefault();
  toggleReactionPicker(postId);
}

async function toggleDefaultReaction(post: LifePost) {
  await toggleReaction(post, 'like');
}

async function toggleReaction(post: LifePost, reactionType: LifeReactionType) {
  if (!canUseReactions()) {
    return;
  }

  reactionBusyPostId.value = post.id;
  clearReactionError(post.id);

  try {
    const updatedPost =
      post.myReaction === reactionType
        ? await api.deleteLifeReaction(post.id)
        : await api.setLifeReaction(post.id, reactionType);
    replacePost(updatedPost);
    reactionPickerPostId.value = null;
  } catch (error) {
    setReactionError(post.id, error instanceof Error && error.message ? error.message : t('pages.life.reactionFailed'));
  } finally {
    reactionBusyPostId.value = null;
  }
}

function startEdit(post: LifePost) {
  editingPostId.value = post.id;
  body.value = post.body;
  formError.value = '';
  void nextTick(() => bodyInput.value?.focus());
}

async function deletePost(post: LifePost) {
  if (!window.confirm(t('pages.life.deleteConfirm'))) {
    return;
  }

  formError.value = '';

  try {
    await api.deleteLifePost(post.id);
    posts.value = posts.value.filter((item) => item.id !== post.id);
    if (editingPostId.value === post.id) {
      resetForm();
    }
  } catch (error) {
    formError.value = error instanceof Error && error.message ? error.message : t('pages.life.deleteFailed');
  }
}

function startReply(comment: LifeComment) {
  replyTargetId.value = comment.id;
  clearCommentError(replyKey(comment.id));
}

function cancelReply(commentId: number) {
  replyTargetId.value = null;
  replyBodies.value[commentId] = '';
  clearCommentError(replyKey(commentId));
}

async function submitComment(post: LifePost) {
  const key = commentKey(post.id);
  const nextBody = (commentBodies.value[post.id] ?? '').trim();
  if (!nextBody) {
    setCommentError(key, t('pages.life.commentRequired'));
    return;
  }

  commentBusyKey.value = key;
  clearCommentError(key);

  try {
    const comment = await api.createLifeComment(post.id, { body: nextBody });
    post.comments.push(comment);
    commentBodies.value[post.id] = '';
    setCommentsExpanded(post.id, true);
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('pages.life.commentFailed'));
  } finally {
    commentBusyKey.value = '';
  }
}

async function submitReply(post: LifePost, comment: LifeComment) {
  const key = replyKey(comment.id);
  const nextBody = (replyBodies.value[comment.id] ?? '').trim();
  if (!nextBody) {
    setCommentError(key, t('pages.life.commentRequired'));
    return;
  }

  commentBusyKey.value = key;
  clearCommentError(key);

  try {
    const reply = await api.createLifeCommentReply(post.id, comment.id, { body: nextBody });
    comment.replies.push(reply);
    setCommentsExpanded(post.id, true);
    cancelReply(comment.id);
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('pages.life.replyFailed'));
  } finally {
    commentBusyKey.value = '';
  }
}

function markCommentDeleted(comments: LifeComment[], id: number): boolean {
  for (const comment of comments) {
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

async function deleteComment(post: LifePost, comment: LifeComment) {
  if (!window.confirm(t('pages.life.deleteCommentConfirm'))) {
    return;
  }

  const key = replyKey(comment.id);
  clearCommentError(key);

  try {
    await api.deleteLifeComment(comment.id);
    markCommentDeleted(post.comments, comment.id);
    if (replyTargetId.value === comment.id) {
      cancelReply(comment.id);
    }
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('pages.life.deleteCommentFailed'));
  }
}

function formatPostTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function authorInitial(post: LifePost) {
  const name = post.author?.displayName.trim() || t('pages.life.byUnknown');
  return name.slice(0, 1).toUpperCase();
}

onMounted(() => {
  void loadCurrentUser();
  void loadPosts();
  removeAuthListener = onAuthTokenChange(() => {
    void loadCurrentUser();
    void loadPosts();
  });
});

onUnmounted(() => {
  removeAuthListener?.();
});
</script>

<template>
  <section class="page-stack life-page">
    <PageHeader :title="t('pages.life.title')" :subtitle="t('pages.life.subtitle')">
      <template #kicker>{{ t('pages.life.kicker') }}</template>
    </PageHeader>

    <StatusMessage v-if="loadError" variant="danger" :duration="0">{{ loadError }}</StatusMessage>

    <section class="life-composer" :aria-busy="!authReady || busy">
      <div class="life-composer__header">
        <h2>{{ t('pages.life.composerTitle') }}</h2>
        <p>{{ t('pages.life.composerPrompt') }}</p>
      </div>

      <div v-if="!authReady" class="life-composer__auth-skeleton" aria-hidden="true">
        <Skeleton variant="box" height="112px" />
        <Skeleton width="42%" />
      </div>

      <form v-else-if="canPost" class="life-form" @submit.prevent="submitPost">
        <div class="field">
          <label for="life-post-body">{{ t('pages.life.bodyLabel') }}</label>
          <textarea
            id="life-post-body"
            ref="bodyInput"
            v-model="body"
            maxlength="2000"
            :placeholder="t('pages.life.bodyPlaceholder')"
            required
          ></textarea>
          <span class="life-form__counter">{{ t('pages.life.charactersLeft', { count: charactersLeft }) }}</span>
        </div>

        <p v-if="formError" class="life-form__error" role="alert">{{ formError }}</p>

        <div class="life-form__actions">
          <button class="ui-button ui-button--primary" :disabled="busy || !body.trim()" type="submit">
            <Icon :icon="isEditing ? iconSave : iconLife" class="ui-icon" aria-hidden="true" />
            {{ submitLabel }}
          </button>
          <button v-if="isEditing" class="ui-button ui-button--ghost" :disabled="busy" type="button" @click="resetForm">
            <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
            {{ t('pages.life.cancelEdit') }}
          </button>
        </div>
      </form>

      <div v-else class="life-auth-note">
        <p>{{ currentUser ? t('pages.life.verifyPrompt') : t('pages.life.loginPrompt') }}</p>
        <RouterLink v-if="!currentUser" class="ui-button ui-button--primary" :to="{ path: '/login', query: { redirect: '/life' } }">
          {{ t('nav.login') }}
        </RouterLink>
      </div>
    </section>

    <section class="life-feed" :aria-busy="loading" :aria-label="t('pages.life.kicker')">
      <div v-if="loading" class="life-feed__list" :aria-label="t('pages.life.loading')">
        <article v-for="index in skeletonPostCount" :key="index" class="life-post life-post--skeleton">
          <div class="life-post__header">
            <Skeleton variant="box" width="46px" height="46px" />
            <div class="life-post__byline">
              <Skeleton width="138px" />
              <Skeleton width="96px" />
            </div>
          </div>
          <Skeleton width="94%" />
          <Skeleton width="76%" />
          <Skeleton width="52%" />
        </article>
      </div>

      <div v-else-if="posts.length" class="life-feed__list">
        <article v-for="post in posts" :key="post.id" class="life-post">
          <header class="life-post__header">
            <div class="life-post__avatar" aria-hidden="true">{{ authorInitial(post) }}</div>
            <div class="life-post__byline">
              <strong>{{ post.author?.displayName ?? t('pages.life.byUnknown') }}</strong>
              <span>
                <time :datetime="post.createdAt">{{ formatPostTime(post.createdAt) }}</time>
                <template v-if="post.updatedAt !== post.createdAt"> - {{ t('pages.life.edited') }}</template>
              </span>
            </div>

            <div v-if="canManage(post)" class="life-post__actions">
              <button class="ui-button ui-button--ghost ui-button--small" type="button" @click="startEdit(post)">
                <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
                {{ t('pages.life.editPost') }}
              </button>
              <button class="ui-button ui-button--ghost ui-button--small" type="button" @click="deletePost(post)">
                <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                {{ t('pages.life.deletePost') }}
              </button>
            </div>
          </header>

          <p class="life-post__body">{{ post.body }}</p>

          <div class="life-post__engagement">
            <div class="life-post__engagement-actions">
              <div class="life-reactions">
                <button
                  class="life-post__engagement-button life-reaction-trigger"
                  :class="{ 'is-active': post.myReaction !== null }"
                  type="button"
                  :aria-controls="`life-reactions-${post.id}`"
                  :aria-expanded="reactionPickerPostId === post.id"
                  :aria-label="reactionButtonLabel(post)"
                  :aria-describedby="`life-reaction-tooltip-${post.id}`"
                  :disabled="!canPost || reactionBusyPostId !== null"
                  @click="toggleDefaultReaction(post)"
                  @contextmenu="handleReactionContextMenu($event, post.id)"
                  @keydown="handleReactionKeydown($event, post.id)"
                >
                  <Icon :icon="reactionIcon(post.myReaction)" class="ui-icon" aria-hidden="true" />
                  <span :id="`life-reaction-tooltip-${post.id}`" class="life-reaction-tooltip" role="tooltip">
                    {{ reactionButtonLabel(post) }}
                  </span>
                </button>

                <div
                  v-if="reactionPickerPostId === post.id && canPost"
                  :id="`life-reactions-${post.id}`"
                  class="life-reaction-picker"
                  role="group"
                  :aria-label="t('pages.life.reactions')"
                >
                  <button
                    v-for="option in reactionOptions"
                    :key="option.type"
                    class="life-reaction-option"
                    :class="{ 'is-active': post.myReaction === option.type }"
                    type="button"
                    :aria-pressed="post.myReaction === option.type"
                    :aria-label="reactionOptionLabel(post, option.type)"
                    :aria-describedby="`life-reaction-option-tooltip-${post.id}-${option.type}`"
                    :disabled="isReactionBusy(post.id)"
                    @click="toggleReaction(post, option.type)"
                  >
                    <Icon :icon="option.icon" class="ui-icon" aria-hidden="true" />
                    <span
                      :id="`life-reaction-option-tooltip-${post.id}-${option.type}`"
                      class="life-reaction-tooltip"
                      role="tooltip"
                    >
                      {{ reactionOptionLabel(post, option.type) }}
                    </span>
                  </button>
                </div>
              </div>

              <button
                class="life-post__engagement-button"
                type="button"
                :aria-controls="`life-comments-${post.id}`"
                :aria-expanded="areCommentsExpanded(post.id)"
                @click="toggleComments(post.id)"
              >
                <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
                {{ areCommentsExpanded(post.id) ? t('pages.life.hideComments') : t('pages.life.comment') }}
              </button>
            </div>

            <div class="life-post__metrics">
              <div
                v-if="reactionTotal(post) > 0"
                class="life-reaction-summary"
                :aria-label="t('pages.life.reactionsCount', { count: reactionTotal(post) })"
              >
                <template v-for="option in reactionOptions" :key="option.type">
                  <span
                    v-if="post.reactionCounts[option.type] > 0"
                    class="life-reaction-summary__item"
                    :aria-label="reactionCountLabel(post, option.type)"
                  >
                    <Icon :icon="option.icon" class="ui-icon" aria-hidden="true" />
                    {{ post.reactionCounts[option.type] }}
                    <span class="life-reaction-tooltip" role="tooltip">{{ reactionCountLabel(post, option.type) }}</span>
                  </span>
                </template>
              </div>

              <button
                class="life-post__comment-count"
                type="button"
                :aria-controls="`life-comments-${post.id}`"
                :aria-expanded="areCommentsExpanded(post.id)"
                @click="toggleComments(post.id)"
              >
                {{ t('pages.life.commentsCount', { count: commentCount(post) }) }}
              </button>
            </div>
          </div>

          <p v-if="reactionErrors[post.id]" class="life-form__error" role="alert">{{ reactionErrors[post.id] }}</p>

          <section
            v-if="areCommentsExpanded(post.id)"
            :id="`life-comments-${post.id}`"
            class="life-comments"
            :aria-label="t('pages.life.comments')"
          >
            <div class="life-comments__header">
              <h3>{{ t('pages.life.comments') }}</h3>
              <span>{{ commentCount(post) }}</span>
            </div>

            <form v-if="canPost" class="life-comment-form" @submit.prevent="submitComment(post)">
              <div class="field">
                <label :for="`life-comment-${post.id}`">{{ t('pages.life.comment') }}</label>
                <textarea
                  :id="`life-comment-${post.id}`"
                  v-model="commentBodies[post.id]"
                  maxlength="1000"
                  :placeholder="t('pages.life.commentPlaceholder')"
                ></textarea>
              </div>
              <p v-if="commentErrors[commentKey(post.id)]" class="life-form__error" role="alert">
                {{ commentErrors[commentKey(post.id)] }}
              </p>
              <button
                class="ui-button ui-button--ghost ui-button--small"
                :disabled="isCommentBusy(commentKey(post.id)) || !(commentBodies[post.id] ?? '').trim()"
                type="submit"
              >
                <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
                {{ isCommentBusy(commentKey(post.id)) ? t('pages.life.postingComment') : t('pages.life.postComment') }}
              </button>
            </form>

            <div v-if="post.comments.length" class="life-comment-list">
              <article
                v-for="comment in post.comments"
                :key="comment.id"
                class="life-comment"
                :class="{ 'is-deleted': comment.deleted }"
              >
                <div class="life-comment__main">
                  <div class="life-comment__avatar" aria-hidden="true">{{ commentInitial(comment) }}</div>
                  <div class="life-comment__content">
                    <div class="life-comment__meta">
                      <strong>{{ commentAuthorName(comment) }}</strong>
                      <time :datetime="comment.createdAt">{{ formatPostTime(comment.createdAt) }}</time>
                    </div>
                    <p v-if="!comment.deleted" class="life-comment__body">{{ comment.body }}</p>

                    <div v-if="!comment.deleted" class="life-comment__actions">
                      <button v-if="canPost" class="life-comment__link-button" type="button" @click="startReply(comment)">
                        <Icon :icon="iconReply" class="ui-icon" aria-hidden="true" />
                        {{ t('pages.life.reply') }}
                      </button>
                      <button
                        v-if="canManageComment(comment)"
                        class="life-comment__link-button"
                        type="button"
                        @click="deleteComment(post, comment)"
                      >
                        <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                        {{ t('pages.life.deleteComment') }}
                      </button>
                    </div>

                    <p v-if="commentErrors[replyKey(comment.id)]" class="life-form__error" role="alert">
                      {{ commentErrors[replyKey(comment.id)] }}
                    </p>

                    <form
                      v-if="canPost && replyTargetId === comment.id"
                      class="life-comment-form life-comment-form--reply"
                      @submit.prevent="submitReply(post, comment)"
                    >
                      <div class="field">
                        <label :for="`life-reply-${comment.id}`">{{ t('pages.life.reply') }}</label>
                        <textarea
                          :id="`life-reply-${comment.id}`"
                          v-model="replyBodies[comment.id]"
                          maxlength="1000"
                          :placeholder="t('pages.life.commentReplyPlaceholder')"
                        ></textarea>
                      </div>
                      <div class="life-form__actions">
                        <button
                          class="ui-button ui-button--ghost ui-button--small"
                          :disabled="isCommentBusy(replyKey(comment.id)) || !(replyBodies[comment.id] ?? '').trim()"
                          type="submit"
                        >
                          <Icon :icon="iconReply" class="ui-icon" aria-hidden="true" />
                          {{ isCommentBusy(replyKey(comment.id)) ? t('pages.life.postingReply') : t('pages.life.postReply') }}
                        </button>
                        <button class="ui-button ui-button--ghost ui-button--small" type="button" @click="cancelReply(comment.id)">
                          <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
                          {{ t('pages.life.cancelReply') }}
                        </button>
                      </div>
                    </form>

                    <div v-if="comment.replies.length" class="life-comment-replies">
                      <article
                        v-for="reply in comment.replies"
                        :key="reply.id"
                        class="life-comment life-comment--reply"
                        :class="{ 'is-deleted': reply.deleted }"
                      >
                        <div class="life-comment__avatar" aria-hidden="true">{{ commentInitial(reply) }}</div>
                        <div class="life-comment__content">
                          <div class="life-comment__meta">
                            <strong>{{ commentAuthorName(reply) }}</strong>
                            <time :datetime="reply.createdAt">{{ formatPostTime(reply.createdAt) }}</time>
                          </div>
                          <p v-if="!reply.deleted" class="life-comment__body">{{ reply.body }}</p>
                          <div v-if="canManageComment(reply)" class="life-comment__actions">
                            <button class="life-comment__link-button" type="button" @click="deleteComment(post, reply)">
                              <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                              {{ t('pages.life.deleteComment') }}
                            </button>
                          </div>
                          <p v-if="commentErrors[replyKey(reply.id)]" class="life-form__error" role="alert">
                            {{ commentErrors[replyKey(reply.id)] }}
                          </p>
                        </div>
                      </article>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <p v-else class="life-comments__empty">{{ t('pages.life.noComments') }}</p>
          </section>
        </article>
      </div>

      <p v-else class="status">{{ t('pages.life.empty') }}</p>
    </section>
  </section>
</template>
