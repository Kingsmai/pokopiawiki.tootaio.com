<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import LifeRatingControl from '../components/LifeRatingControl.vue';
import LifeReactionUsersModal from '../components/LifeReactionUsersModal.vue';
import LoadMoreSentinel from '../components/LoadMoreSentinel.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusBadge from '../components/StatusBadge.vue';
import StatusMessage from '../components/StatusMessage.vue';
import {
  iconBack,
  iconCancel,
  iconChevronDown,
  iconComment,
  iconDelete,
  iconLife,
  iconReactionFun,
  iconReactionHelpful,
  iconReactionLike,
  iconReactionThanks,
  iconReply,
  iconUndo,
  iconVersion,
  iconWarning
} from '../icons';
import {
  api,
  getAuthToken,
  moderationUpdateEvent,
  onAuthTokenChange,
  setAuthToken,
  type AiModerationStatus,
  type AuthUser,
  type CommentSort,
  type LifeComment,
  type LifePost,
  type LifeReactionType,
  type ModerationUpdateDetail
} from '../services/api';
import { resolvedSeoHead, resolveSeo } from '../seo';

const { locale, t } = useI18n();
const route = useRoute();
const post = ref<LifePost | null>(null);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const loadError = ref('');
const comments = ref<LifeComment[]>([]);
const commentsNextCursor = ref<string | null>(null);
const commentsHasMore = ref(false);
const commentsTotal = ref(0);
const commentsLoading = ref(false);
const commentsLoadingMore = ref(false);
const commentsLoaded = ref(false);
const commentsError = ref('');
const activeCommentSort = ref<CommentSort>('oldest');
const commentBodies = ref<Record<number, string>>({});
const replyBodies = ref<Record<number, string>>({});
const replyTargetId = ref<number | null>(null);
const commentBusyKey = ref('');
const commentErrors = ref<Record<string, string>>({});
const reactionPickerPostId = ref<number | null>(null);
const reactionBusyPostId = ref<number | null>(null);
const reactionErrors = ref<Record<number, string>>({});
const ratingBusyPostId = ref<number | null>(null);
const ratingErrors = ref<Record<number, string>>({});
const moderationBusyPostId = ref<number | null>(null);
const moderationErrors = ref<Record<number, string>>({});
const reactionUsersModal = ref<{ postId: number; reactionType: LifeReactionType | null } | null>(null);
const lifeCommentPageSize = 20;
const commentMaxLength = 1000;
let removeAuthListener: (() => void) | null = null;

const reactionOptions = [
  { type: 'like', icon: iconReactionLike, labelKey: 'pages.life.reactionLike' },
  { type: 'helpful', icon: iconReactionHelpful, labelKey: 'pages.life.reactionHelpful' },
  { type: 'fun', icon: iconReactionFun, labelKey: 'pages.life.reactionFun' },
  { type: 'thanks', icon: iconReactionThanks, labelKey: 'pages.life.reactionThanks' }
] as const satisfies ReadonlyArray<{ type: LifeReactionType; icon: string; labelKey: string }>;

function can(permissionKey: string) {
  return currentUser.value?.permissions.includes(permissionKey) === true;
}

const canComment = computed(() => can('life.comments.create'));
const canLikeComments = computed(() => can('life.comments.like'));
const canReact = computed(() => can('life.reactions.set'));
const canRate = computed(() => can('life.ratings.set'));
const canCommentOnPost = computed(() => canComment.value && post.value?.moderationStatus === 'approved');
const commentSortOptions = computed<Array<{ value: CommentSort; label: string }>>(() => [
  { value: 'oldest', label: t('pages.life.sortOldest') },
  { value: 'latest', label: t('pages.life.sortLatest') },
  { value: 'most-liked', label: t('pages.life.sortMostLiked') },
  { value: 'most-replied', label: t('pages.life.sortMostReplied') }
]);

function routePostId() {
  const value = route.params.id;
  return Array.isArray(value) ? value[0] : value;
}

function summaryText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

async function loadCurrentUser() {
  if (!getAuthToken()) {
    currentUser.value = null;
    return;
  }

  try {
    const response = await api.me();
    currentUser.value = response.user;
  } catch {
    currentUser.value = null;
    setAuthToken(null);
  }
}

function commentTreeCount(items: LifeComment[]) {
  return items.reduce((count, item) => count + 1 + item.replies.length, 0);
}

function resetCommentsFromPost(nextPost: LifePost) {
  comments.value = nextPost.commentPreview;
  commentsNextCursor.value = null;
  commentsHasMore.value = nextPost.commentCount > commentTreeCount(nextPost.commentPreview);
  commentsTotal.value = nextPost.commentCount;
  commentsLoaded.value = false;
  commentsError.value = '';
  commentBodies.value = {};
  replyBodies.value = {};
  replyTargetId.value = null;
  commentErrors.value = {};
}

const { data: initialPost } = await useAsyncData<LifePost | null>(
  `life-post-detail:${String(routePostId())}:${locale.value}`,
  async () => {
    const id = routePostId();
    if (!id) {
      return null;
    }

    try {
      return await api.lifePost(id);
    } catch {
      return null;
    }
  },
  { default: () => null }
);

if (initialPost.value) {
  post.value = initialPost.value;
  resetCommentsFromPost(initialPost.value);
}
const initialPostLoaded = ref(initialPost.value !== null);
loading.value = !initialPostLoaded.value;
const postSeo = computed(() =>
  post.value
    ? resolveSeo({
        title: `${summaryText(post.value.body, 64) || t('pages.life.detailTitle')} - ${t('pages.life.title')}`,
        description: summaryText(post.value.body, 155) || t('pages.life.detailSubtitle'),
        canonicalPath: `/life/${post.value.id}`
      })
    : null
);

useHead(() => (postSeo.value ? resolvedSeoHead(postSeo.value) : {}));

async function loadPost() {
  const id = routePostId();
  if (!id) {
    return;
  }

  loading.value = true;
  loadError.value = '';
  post.value = null;

  try {
    const nextPost = await api.lifePost(id);
    post.value = nextPost;
    resetCommentsFromPost(nextPost);
    initialPostLoaded.value = true;
    void loadComments(true);
  } catch (error) {
    loadError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
    initialPostLoaded.value = true;
  } finally {
    loading.value = false;
  }
}

function mergeComments(existing: LifeComment[], incoming: LifeComment[]) {
  const ids = new Set(existing.map((comment) => comment.id));
  return [...existing, ...incoming.filter((comment) => !ids.has(comment.id))];
}

function replaceCommentInTree(items: LifeComment[], updated: LifeComment): boolean {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item) {
      continue;
    }
    if (item.id === updated.id) {
      items[index] = { ...updated, replies: item.replies };
      return true;
    }

    if (replaceCommentInTree(item.replies, updated)) {
      return true;
    }
  }

  return false;
}

async function loadComments(reset = false) {
  const currentPost = post.value;
  if (!currentPost || commentsLoading.value || commentsLoadingMore.value || (!reset && commentsLoaded.value && !commentsHasMore.value)) {
    return;
  }

  const cursor = reset || !commentsLoaded.value ? null : commentsNextCursor.value;
  commentsLoading.value = reset || !commentsLoaded.value;
  commentsLoadingMore.value = !reset && commentsLoaded.value;
  commentsError.value = '';

  if (reset || !commentsLoaded.value) {
    comments.value = [];
  }

  try {
    const page = await api.lifeComments(currentPost.id, { limit: lifeCommentPageSize, cursor, sort: activeCommentSort.value });
    comments.value = reset || !commentsLoaded.value ? page.items : mergeComments(comments.value, page.items);
    commentsNextCursor.value = page.nextCursor;
    commentsHasMore.value = page.hasMore;
    commentsTotal.value = page.total;
    commentsLoaded.value = true;
    currentPost.commentCount = page.total;
  } catch (error) {
    commentsError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    commentsLoading.value = false;
    commentsLoadingMore.value = false;
  }
}

function commentKey(postId: number) {
  return `post-${postId}`;
}

function replyKey(commentId: number) {
  return `reply-${commentId}`;
}

function likeKey(commentId: number) {
  return `like-${commentId}`;
}

function handleCommentSortChange(event: Event) {
  if (event.target instanceof HTMLSelectElement) {
    activeCommentSort.value = event.target.value as CommentSort;
    void loadComments(true);
  }
}

function isCommentBusy(key: string) {
  return commentBusyKey.value === key;
}

function isReactionBusy(postId: number) {
  return reactionBusyPostId.value === postId;
}

function isRatingBusy(postId: number) {
  return ratingBusyPostId.value === postId;
}

function canManage(currentPost: LifePost) {
  return (currentUser.value?.id === currentPost.author?.id && can('life.posts.update')) || can('life.posts.update-any');
}

function canManageComment(comment: LifeComment) {
  return !comment.deleted && ((currentUser.value?.id === comment.author?.id && can('life.comments.delete')) || can('life.comments.delete-any'));
}

function canRestoreComment(comment: LifeComment) {
  return comment.deleted && currentUser.value?.id === comment.author?.id && can('life.comments.delete');
}

function canLikeComment(comment: LifeComment) {
  return canLikeComments.value && !comment.deleted && comment.moderationStatus === 'approved';
}

function canRetryCommentModeration(comment: LifeComment) {
  return (
    !comment.deleted &&
    comment.moderationStatus !== 'approved' &&
    comment.moderationStatus !== 'reviewing' &&
    (currentUser.value?.id === comment.author?.id || can('life.comments.delete-any'))
  );
}

function canSeeCommentModeration(comment: LifeComment) {
  return moderationStatusVisible(comment.moderationStatus) && (currentUser.value?.id === comment.author?.id || can('life.comments.delete-any'));
}

function canUseReactions() {
  return canReact.value && reactionBusyPostId.value === null;
}

function canUseRatings(currentPost: LifePost) {
  return canRate.value && ratingBusyPostId.value === null && currentPost.moderationStatus === 'approved' && currentPost.category?.isRateable === true;
}

function reactionTotal(currentPost: LifePost) {
  return reactionOptions.reduce((count, option) => count + (currentPost.reactionCounts[option.type] ?? 0), 0);
}

function reactionLabel(type: LifeReactionType) {
  return t(reactionOptions.find((option) => option.type === type)?.labelKey ?? 'pages.life.react');
}

function reactionIcon(type: LifeReactionType | null) {
  return reactionOptions.find((option) => option.type === type)?.icon ?? iconReactionLike;
}

function reactionButtonLabel(currentPost: LifePost) {
  return currentPost.myReaction ? reactionLabel(currentPost.myReaction) : t('pages.life.reactionLike');
}

function reactionOptionLabel(currentPost: LifePost, type: LifeReactionType) {
  return currentPost.myReaction === type ? t('pages.life.removeReaction') : reactionLabel(type);
}

function reactionCountLabel(currentPost: LifePost, type: LifeReactionType) {
  return t('pages.life.reactionCountLabel', {
    reaction: reactionLabel(type),
    count: currentPost.reactionCounts[type] ?? 0
  });
}

function commentLikeLabel(comment: LifeComment) {
  return comment.myLiked ? t('pages.life.unlikeComment') : t('pages.life.likeComment');
}

function openReactionUsersModal(postId: number, reactionType: LifeReactionType | null = null) {
  reactionUsersModal.value = { postId, reactionType };
}

function closeReactionUsersModal() {
  reactionUsersModal.value = null;
}

function moderationLabel(status: AiModerationStatus) {
  const labels: Record<AiModerationStatus, string> = {
    unreviewed: t('pages.life.moderationUnreviewed'),
    reviewing: t('pages.life.moderationReviewing'),
    approved: t('pages.life.moderationApproved'),
    rejected: t('pages.life.moderationRejected'),
    failed: t('pages.life.moderationFailed')
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

function moderationStatusVisible(status: AiModerationStatus) {
  return status !== 'approved';
}

function canRetryModeration(currentPost: LifePost) {
  return currentPost.moderationStatus !== 'approved' && currentPost.moderationStatus !== 'reviewing' && canManage(currentPost);
}

function moderationReasonVisible(status: AiModerationStatus, reason: string | null) {
  return (status === 'rejected' || status === 'failed') && reason !== null && reason.trim() !== '';
}

function replacePost(updatedPost: LifePost) {
  post.value = updatedPost;
  commentsTotal.value = updatedPost.commentCount;
}

function updateLifeCommentModeration(
  items: LifeComment[],
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

    if (updateLifeCommentModeration(comment.replies, commentId, status, languageCode, reason)) {
      return true;
    }
  }

  return false;
}

function isModerationUpdateEvent(event: Event): event is CustomEvent<ModerationUpdateDetail> {
  return event instanceof CustomEvent && event.detail?.type === 'moderation.updated';
}

function handleModerationUpdate(event: Event) {
  if (!isModerationUpdateEvent(event) || !post.value) {
    return;
  }

  const { target, moderationStatus, moderationLanguageCode, moderationReason } = event.detail;
  if (target.type === 'life-post' && target.lifePostId === post.value.id) {
    post.value = {
      ...post.value,
      moderationStatus,
      moderationLanguageCode,
      moderationReason
    };
    return;
  }

  if (target.type !== 'life-comment' || target.lifePostId !== post.value.id || target.lifeCommentId === null) {
    return;
  }

  const updated = updateLifeCommentModeration(
    comments.value,
    target.lifeCommentId,
    moderationStatus,
    moderationLanguageCode,
    moderationReason
  );
  if (updated) {
    comments.value = [...comments.value];
  } else if (moderationStatus === 'approved') {
    void loadComments(true);
  }
}

async function retryPostModeration(currentPost: LifePost) {
  moderationBusyPostId.value = currentPost.id;
  const nextErrors = { ...moderationErrors.value };
  delete nextErrors[currentPost.id];
  moderationErrors.value = nextErrors;

  try {
    replacePost(await api.retryLifePostModeration(currentPost.id));
  } catch (error) {
    moderationErrors.value = {
      ...moderationErrors.value,
      [currentPost.id]: error instanceof Error && error.message ? error.message : t('pages.life.moderationRetryFailed')
    };
  } finally {
    moderationBusyPostId.value = null;
  }
}

function closeReactionPicker() {
  reactionPickerPostId.value = null;
}

function toggleReactionPicker(postId: number) {
  if (!canUseReactions()) {
    return;
  }

  clearReactionError(postId);
  reactionPickerPostId.value = reactionPickerPostId.value === postId ? null : postId;
}

function closeReactionPickerFromDocument(event: MouseEvent) {
  if (reactionPickerPostId.value === null || !(event.target instanceof Element)) {
    return;
  }

  if (!event.target.closest('.life-reactions')) {
    closeReactionPicker();
  }
}

function closeReactionPickerFromKeyboard(event: KeyboardEvent) {
  if (event.key === 'Escape' && reactionPickerPostId.value !== null) {
    closeReactionPicker();
  }
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

async function toggleDefaultReaction(currentPost: LifePost) {
  await toggleReaction(currentPost, 'like');
}

async function toggleReaction(currentPost: LifePost, reactionType: LifeReactionType) {
  if (!canUseReactions() || currentPost.moderationStatus !== 'approved') {
    return;
  }

  reactionBusyPostId.value = currentPost.id;
  clearReactionError(currentPost.id);

  try {
    const updatedPost =
      currentPost.myReaction === reactionType
        ? await api.deleteLifeReaction(currentPost.id)
        : await api.setLifeReaction(currentPost.id, reactionType);
    replacePost(updatedPost);
    reactionPickerPostId.value = null;
  } catch (error) {
    setReactionError(currentPost.id, error instanceof Error && error.message ? error.message : t('pages.life.reactionFailed'));
  } finally {
    reactionBusyPostId.value = null;
  }
}

async function toggleRating(currentPost: LifePost, rating: number) {
  if (!canUseRatings(currentPost)) {
    return;
  }

  ratingBusyPostId.value = currentPost.id;
  clearRatingError(currentPost.id);

  try {
    const updatedPost =
      currentPost.myRating === rating ? await api.deleteLifeRating(currentPost.id) : await api.setLifeRating(currentPost.id, rating);
    replacePost(updatedPost);
  } catch (error) {
    setRatingError(currentPost.id, error instanceof Error && error.message ? error.message : t('pages.life.ratingFailed'));
  } finally {
    ratingBusyPostId.value = null;
  }
}

function setReactionError(postId: number, message: string) {
  reactionErrors.value = { ...reactionErrors.value, [postId]: message };
}

function clearReactionError(postId: number) {
  const nextErrors = { ...reactionErrors.value };
  delete nextErrors[postId];
  reactionErrors.value = nextErrors;
}

function setRatingError(postId: number, message: string) {
  ratingErrors.value = { ...ratingErrors.value, [postId]: message };
}

function clearRatingError(postId: number) {
  const nextErrors = { ...ratingErrors.value };
  delete nextErrors[postId];
  ratingErrors.value = nextErrors;
}

function setCommentError(key: string, message: string) {
  commentErrors.value = { ...commentErrors.value, [key]: message };
}

function clearCommentError(key: string) {
  const nextErrors = { ...commentErrors.value };
  delete nextErrors[key];
  commentErrors.value = nextErrors;
}

async function submitComment(currentPost: LifePost) {
  const key = commentKey(currentPost.id);
  const nextBody = (commentBodies.value[currentPost.id] ?? '').trim();
  if (!nextBody) {
    setCommentError(key, t('pages.life.commentRequired'));
    return;
  }

  commentBusyKey.value = key;
  clearCommentError(key);

  try {
    const comment = await api.createLifeComment(currentPost.id, {
      body: nextBody,
      languageCode: currentPost.moderationLanguageCode
    });
    comments.value = mergeComments(comments.value, [comment]);
    commentsTotal.value += 1;
    currentPost.commentCount = commentsTotal.value;
    commentsLoaded.value = true;
    commentBodies.value[currentPost.id] = '';
    if (activeCommentSort.value !== 'oldest') {
      void loadComments(true);
    }
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('pages.life.commentFailed'));
  } finally {
    commentBusyKey.value = '';
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

async function submitReply(currentPost: LifePost, comment: LifeComment) {
  const key = replyKey(comment.id);
  const nextBody = (replyBodies.value[comment.id] ?? '').trim();
  if (!nextBody) {
    setCommentError(key, t('pages.life.commentRequired'));
    return;
  }

  commentBusyKey.value = key;
  clearCommentError(key);

  try {
    const reply = await api.createLifeCommentReply(currentPost.id, comment.id, {
      body: nextBody,
      languageCode: comment.moderationLanguageCode ?? currentPost.moderationLanguageCode
    });
    comment.replies.push(reply);
    comment.replyCount += 1;
    commentsTotal.value += 1;
    currentPost.commentCount = commentsTotal.value;
    commentsLoaded.value = true;
    cancelReply(comment.id);
    if (activeCommentSort.value === 'most-replied') {
      void loadComments(true);
    }
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('pages.life.replyFailed'));
  } finally {
    commentBusyKey.value = '';
  }
}

function countCommentBranch(comment: LifeComment): number {
  return 1 + comment.replies.reduce((total, reply) => total + countCommentBranch(reply), 0);
}

function removeCommentFromTree(items: LifeComment[], id: number): number {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item) {
      continue;
    }
    if (item.id === id) {
      const removedCount = countCommentBranch(item);
      items.splice(index, 1);
      return removedCount;
    }

    const removedCount = removeCommentFromTree(item.replies, id);
    if (removedCount > 0) {
      return removedCount;
    }
  }

  return 0;
}

function markOwnCommentDeleted(items: LifeComment[], id: number): boolean {
  for (const item of items) {
    if (item.id === id) {
      item.deleted = true;
      return true;
    }

    if (markOwnCommentDeleted(item.replies, id)) {
      return true;
    }
  }

  return false;
}

async function deleteComment(comment: LifeComment) {
  if (!window.confirm(t('pages.life.deleteCommentConfirm'))) {
    return;
  }

  const key = replyKey(comment.id);
  clearCommentError(key);

  try {
    await api.deleteLifeComment(comment.id);
    if (currentUser.value?.id === comment.author?.id) {
      markOwnCommentDeleted(comments.value, comment.id);
      comments.value = [...comments.value];
    } else {
      const removedCount = removeCommentFromTree(comments.value, comment.id);
      if (removedCount > 0) {
        comments.value = [...comments.value];
        commentsTotal.value = Math.max(0, commentsTotal.value - removedCount);
        if (post.value) {
          post.value.commentCount = commentsTotal.value;
        }
      }
    }
    if (replyTargetId.value === comment.id) {
      cancelReply(comment.id);
    }
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('pages.life.deleteCommentFailed'));
  }
}

async function restoreComment(comment: LifeComment) {
  const key = replyKey(comment.id);
  commentBusyKey.value = key;
  clearCommentError(key);

  try {
    const restored = await api.restoreLifeComment(comment.id);
    replaceCommentInTree(comments.value, restored);
    comments.value = [...comments.value];
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('pages.life.restoreCommentFailed'));
  } finally {
    commentBusyKey.value = '';
  }
}

async function retryCommentModeration(comment: LifeComment) {
  const key = replyKey(comment.id);
  commentBusyKey.value = key;
  clearCommentError(key);

  try {
    const updated = await api.retryLifeCommentModeration(comment.id);
    replaceCommentInTree(comments.value, updated);
    comments.value = [...comments.value];
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('pages.life.moderationRetryFailed'));
  } finally {
    commentBusyKey.value = '';
  }
}

async function toggleCommentLike(comment: LifeComment) {
  if (!canLikeComment(comment)) {
    return;
  }

  const key = likeKey(comment.id);
  commentBusyKey.value = key;
  clearCommentError(key);

  try {
    const updated = comment.myLiked ? await api.deleteLifeCommentLike(comment.id) : await api.setLifeCommentLike(comment.id);
    replaceCommentInTree(comments.value, updated);
    comments.value = [...comments.value];
    if (activeCommentSort.value === 'most-liked') {
      void loadComments(true);
    }
  } catch (error) {
    setCommentError(key, error instanceof Error && error.message ? error.message : t('pages.life.commentLikeFailed'));
  } finally {
    commentBusyKey.value = '';
  }
}

function commentAuthorName(comment: LifeComment) {
  return comment.author?.displayName ?? t('pages.life.byUnknown');
}

function commentInitial(comment: LifeComment) {
  return commentAuthorName(comment).slice(0, 1).toUpperCase();
}

function authorInitial(currentPost: LifePost) {
  const name = currentPost.author?.displayName.trim() || t('pages.life.byUnknown');
  return name.slice(0, 1).toUpperCase();
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

watch(
  () => route.params.id,
  () => {
    void loadPost();
  }
);

watch(locale, () => {
  void loadPost();
});

onMounted(() => {
  document.addEventListener('click', closeReactionPickerFromDocument);
  document.addEventListener('keydown', closeReactionPickerFromKeyboard);
  window.addEventListener(moderationUpdateEvent, handleModerationUpdate);
  const hadAuthToken = getAuthToken() !== null;
  void (async () => {
    await loadCurrentUser();
    if (!initialPostLoaded.value || hadAuthToken) {
      await loadPost();
    }
  })();
  removeAuthListener = onAuthTokenChange(() => {
    void loadCurrentUser();
    void loadPost();
  });
});

onUnmounted(() => {
  document.removeEventListener('click', closeReactionPickerFromDocument);
  document.removeEventListener('keydown', closeReactionPickerFromKeyboard);
  window.removeEventListener(moderationUpdateEvent, handleModerationUpdate);
  removeAuthListener?.();
});
</script>

<template>
  <section class="life-detail-page">
    <PageHeader :title="t('pages.life.detailTitle')" :subtitle="t('pages.life.detailSubtitle')">
      <template #kicker>{{ t('pages.life.detailKicker') }}</template>
      <template #actions>
        <RouterLink class="ui-button ui-button--ghost" to="/life">
          <Icon :icon="iconBack" class="ui-icon" aria-hidden="true" />
          {{ t('pages.life.backToLife') }}
        </RouterLink>
      </template>
    </PageHeader>

    <StatusMessage v-if="loadError" variant="danger" :duration="0">{{ loadError }}</StatusMessage>

    <LifeReactionUsersModal
      v-if="reactionUsersModal"
      :post-id="reactionUsersModal.postId"
      :initial-reaction-type="reactionUsersModal.reactionType"
      @close="closeReactionUsersModal"
    />

    <div class="life-detail-layout" :aria-busy="loading || commentsLoading">
      <article v-if="loading" class="life-post life-post--skeleton" aria-hidden="true">
        <div class="life-post__header">
          <Skeleton variant="box" width="46px" height="46px" />
          <div class="life-post__byline">
            <Skeleton width="140px" />
            <Skeleton width="180px" />
          </div>
        </div>
        <Skeleton width="90%" />
        <Skeleton width="68%" />
      </article>

      <article v-else-if="post" class="life-post life-post--detail">
        <header class="life-post__header">
          <div class="life-post__avatar" aria-hidden="true">{{ authorInitial(post) }}</div>
          <div class="life-post__byline">
            <RouterLink v-if="post.author" class="user-profile-link" :to="`/profile/${post.author.id}`">
              {{ post.author.displayName }}
            </RouterLink>
            <strong v-else>{{ t('pages.life.byUnknown') }}</strong>
            <span>
              <time :datetime="post.createdAt">{{ formatPostTime(post.createdAt) }}</time>
              <template v-if="post.updatedAt !== post.createdAt"> - {{ t('pages.life.edited') }}</template>
            </span>
          </div>
        </header>

        <p class="life-post__body">{{ post.body }}</p>

        <div v-if="post.category || post.gameVersion" class="life-post__tags" :aria-label="t('pages.life.postMeta')">
          <span v-if="post.category" class="life-post__tag">{{ post.category.name }}</span>
          <span v-if="post.gameVersion" class="life-post__tag life-post__tag--version">
            <Icon :icon="iconVersion" class="ui-icon" aria-hidden="true" />
            {{ post.gameVersion.name }}
          </span>
        </div>

        <details v-if="post.gameVersion?.changeLog" class="life-version-note">
          <summary>{{ t('pages.life.changeLog') }}</summary>
          <p>{{ post.gameVersion.changeLog }}</p>
        </details>

        <div class="life-post__engagement">
          <div class="life-post__engagement-actions">
            <LifeRatingControl
              v-if="post.category?.isRateable"
              :rating-average="post.ratingAverage"
              :rating-count="post.ratingCount"
              :my-rating="post.myRating"
              :disabled="!canUseRatings(post)"
              :busy="isRatingBusy(post.id)"
              @rate="toggleRating(post, $event)"
            />

            <div class="life-reactions">
              <div class="life-reaction-control">
                <button
                  class="life-icon-button life-reaction-trigger"
                  :class="{ 'is-active': post.myReaction !== null }"
                  type="button"
                  :aria-controls="`life-reactions-${post.id}`"
                  :aria-expanded="reactionPickerPostId === post.id"
                  :aria-label="reactionButtonLabel(post)"
                  :disabled="!canReact || post.moderationStatus !== 'approved' || reactionBusyPostId !== null"
                  @click="toggleDefaultReaction(post)"
                  @contextmenu="handleReactionContextMenu($event, post.id)"
                  @keydown="handleReactionKeydown($event, post.id)"
                >
                  <Icon :icon="reactionIcon(post.myReaction)" class="ui-icon" aria-hidden="true" />
                  <span class="life-action-tooltip" role="tooltip">{{ reactionButtonLabel(post) }}</span>
                </button>

                <button
                  class="life-icon-button life-reaction-menu-button"
                  type="button"
                  :aria-controls="`life-reactions-${post.id}`"
                  :aria-expanded="reactionPickerPostId === post.id"
                  :aria-label="t('pages.life.chooseReaction')"
                  :disabled="!canReact || post.moderationStatus !== 'approved' || reactionBusyPostId !== null"
                  @click="toggleReactionPicker(post.id)"
                  @contextmenu="handleReactionContextMenu($event, post.id)"
                  @keydown="handleReactionKeydown($event, post.id)"
                >
                  <Icon :icon="iconChevronDown" class="ui-icon" aria-hidden="true" />
                  <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.chooseReaction') }}</span>
                </button>
              </div>

              <div
                v-if="reactionPickerPostId === post.id && canReact"
                :id="`life-reactions-${post.id}`"
                class="life-reaction-picker"
                role="group"
                :aria-label="t('pages.life.reactionMenu')"
              >
                <button
                  v-for="option in reactionOptions"
                  :key="option.type"
                  class="life-reaction-option"
                  :class="{ 'is-active': post.myReaction === option.type }"
                  type="button"
                  :aria-pressed="post.myReaction === option.type"
                  :aria-label="reactionOptionLabel(post, option.type)"
                  :disabled="post.moderationStatus !== 'approved' || isReactionBusy(post.id)"
                  @click="toggleReaction(post, option.type)"
                >
                  <Icon :icon="option.icon" class="ui-icon" aria-hidden="true" />
                  <span>{{ reactionLabel(option.type) }}</span>
                </button>
              </div>
            </div>

            <div class="life-post__review-actions">
              <StatusBadge
                v-if="moderationStatusVisible(post.moderationStatus)"
                :label="moderationLabel(post.moderationStatus)"
                :tone="moderationTone(post.moderationStatus)"
                compact
              />
              <button
                v-if="canRetryModeration(post)"
                class="life-icon-button life-review-button"
                type="button"
                :aria-label="moderationBusyPostId === post.id ? t('pages.life.moderationRetrying') : t('pages.life.moderationRetry')"
                :disabled="moderationBusyPostId === post.id"
                @click="retryPostModeration(post)"
              >
                <Icon :icon="iconWarning" class="ui-icon" aria-hidden="true" />
                <span class="life-action-tooltip" role="tooltip">
                  {{ moderationBusyPostId === post.id ? t('pages.life.moderationRetrying') : t('pages.life.moderationRetry') }}
                </span>
              </button>
            </div>
          </div>

          <div class="life-post__metrics">
            <button
              v-if="reactionTotal(post) > 0"
              class="life-reaction-summary life-reaction-summary--button"
              type="button"
              :aria-label="t('pages.life.reactionsCount', { count: reactionTotal(post) })"
              @click="openReactionUsersModal(post.id)"
            >
              <template v-for="option in reactionOptions" :key="option.type">
                <span
                  v-if="post.reactionCounts[option.type] > 0"
                  class="life-reaction-summary__item"
                  :aria-label="reactionCountLabel(post, option.type)"
                >
                  <Icon :icon="option.icon" class="ui-icon" aria-hidden="true" />
                  {{ post.reactionCounts[option.type] }}
                  <span class="life-action-tooltip" role="tooltip">{{ reactionCountLabel(post, option.type) }}</span>
                </span>
              </template>
            </button>

            <span class="life-metric-button life-metric-button--static" :aria-label="t('pages.life.commentsCount', { count: commentsTotal })">
              <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
              <span>{{ commentsTotal }}</span>
            </span>
          </div>
        </div>

        <p v-if="canManage(post) && moderationReasonVisible(post.moderationStatus, post.moderationReason)" class="life-moderation-detail">
          <strong>{{ t('pages.life.moderationReason') }}</strong>
          <span>{{ post.moderationReason }}</span>
        </p>

        <p v-if="ratingErrors[post.id]" class="life-form__error" role="alert">{{ ratingErrors[post.id] }}</p>
        <p v-if="moderationErrors[post.id]" class="life-form__error" role="alert">{{ moderationErrors[post.id] }}</p>
        <p v-if="reactionErrors[post.id]" class="life-form__error" role="alert">{{ reactionErrors[post.id] }}</p>

        <section :id="`life-comments-${post.id}`" class="life-comments" :aria-label="t('pages.life.comments')">
          <div class="life-comments__header">
            <div>
              <h3>{{ t('pages.life.comments') }}</h3>
              <span>{{ commentsTotal }}</span>
            </div>
            <label class="life-comments__sort">
              <span>{{ t('pages.life.sort') }}</span>
              <select :value="activeCommentSort" @change="handleCommentSortChange">
                <option v-for="option in commentSortOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>

          <form v-if="canCommentOnPost" class="life-comment-form" @submit.prevent="submitComment(post)">
            <div class="field">
              <label :for="`life-comment-${post.id}`">{{ t('pages.life.comment') }}</label>
              <textarea
                :id="`life-comment-${post.id}`"
                v-model="commentBodies[post.id]"
                :maxlength="commentMaxLength"
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

          <div v-if="commentsLoading && !comments.length" class="life-comment-list" :aria-label="t('pages.life.loadingComments')">
            <article v-for="index in 2" :key="`life-comments-loading-${post.id}-${index}`" class="life-comment">
              <div class="life-comment__main">
                <Skeleton variant="box" width="36px" height="36px" />
                <div class="life-comment__content">
                  <Skeleton width="132px" />
                  <Skeleton width="86%" />
                </div>
              </div>
            </article>
          </div>

          <p v-else-if="commentsError" class="life-form__error" role="alert">{{ commentsError }}</p>

          <div v-else-if="comments.length" class="life-comment-list">
            <article
              v-for="comment in comments"
              :key="comment.id"
              class="life-comment"
              :class="{ 'is-deleted': comment.deleted }"
            >
              <div class="life-comment__main">
                <div class="life-comment__avatar" aria-hidden="true">{{ commentInitial(comment) }}</div>
                <div class="life-comment__content">
                  <div class="life-comment__meta">
                    <RouterLink v-if="comment.author" class="user-profile-link" :to="`/profile/${comment.author.id}`">
                      {{ comment.author.displayName }}
                    </RouterLink>
                    <strong v-else>{{ commentAuthorName(comment) }}</strong>
                    <time :datetime="comment.createdAt">{{ formatPostTime(comment.createdAt) }}</time>
                    <StatusBadge
                      v-if="canSeeCommentModeration(comment)"
                      :label="moderationLabel(comment.moderationStatus)"
                      :tone="moderationTone(comment.moderationStatus)"
                      compact
                    />
                  </div>
                  <p class="life-comment__body">{{ comment.body }}</p>
                  <p
                    v-if="canSeeCommentModeration(comment) && moderationReasonVisible(comment.moderationStatus, comment.moderationReason)"
                    class="life-moderation-detail life-moderation-detail--comment"
                  >
                    <strong>{{ t('pages.life.moderationReason') }}</strong>
                    <span>{{ comment.moderationReason }}</span>
                  </p>

                  <div v-if="!comment.deleted || canRestoreComment(comment)" class="life-comment__actions">
                    <button
                      v-if="!comment.deleted"
                      class="life-icon-button life-icon-button--flat"
                      type="button"
                      :aria-label="commentLikeLabel(comment)"
                      :aria-pressed="comment.myLiked"
                      :disabled="!canLikeComment(comment) || isCommentBusy(likeKey(comment.id))"
                      @click="toggleCommentLike(comment)"
                    >
                      <Icon :icon="iconReactionLike" class="ui-icon" aria-hidden="true" />
                      <span class="life-comment__action-count">{{ comment.likeCount }}</span>
                      <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.commentLikeCount', { count: comment.likeCount }) }}</span>
                    </button>
                    <button
                      v-if="!comment.deleted && canCommentOnPost"
                      class="life-icon-button life-icon-button--flat"
                      type="button"
                      :aria-label="t('pages.life.reply')"
                      @click="startReply(comment)"
                    >
                      <Icon :icon="iconReply" class="ui-icon" aria-hidden="true" />
                      <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.reply') }}</span>
                    </button>
                    <button
                      v-if="canManageComment(comment)"
                      class="life-icon-button life-icon-button--flat life-icon-button--danger"
                      type="button"
                      :aria-label="t('pages.life.deleteComment')"
                      @click="deleteComment(comment)"
                    >
                      <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                      <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.deleteComment') }}</span>
                    </button>
                    <button
                      v-if="canRestoreComment(comment)"
                      class="life-icon-button life-icon-button--flat"
                      type="button"
                      :aria-label="t('pages.life.restoreComment')"
                      :disabled="isCommentBusy(replyKey(comment.id))"
                      @click="restoreComment(comment)"
                    >
                      <Icon :icon="iconUndo" class="ui-icon" aria-hidden="true" />
                      <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.restoreComment') }}</span>
                    </button>
                    <button
                      v-if="canRetryCommentModeration(comment)"
                      class="life-icon-button life-icon-button--flat"
                      type="button"
                      :aria-label="isCommentBusy(replyKey(comment.id)) ? t('pages.life.moderationRetrying') : t('pages.life.moderationRetry')"
                      :disabled="isCommentBusy(replyKey(comment.id))"
                      @click="retryCommentModeration(comment)"
                    >
                      <Icon :icon="iconWarning" class="ui-icon" aria-hidden="true" />
                      <span class="life-action-tooltip" role="tooltip">
                        {{ isCommentBusy(replyKey(comment.id)) ? t('pages.life.moderationRetrying') : t('pages.life.moderationRetry') }}
                      </span>
                    </button>
                  </div>

                  <p v-if="commentErrors[likeKey(comment.id)]" class="life-form__error" role="alert">
                    {{ commentErrors[likeKey(comment.id)] }}
                  </p>
                  <p v-if="commentErrors[replyKey(comment.id)]" class="life-form__error" role="alert">
                    {{ commentErrors[replyKey(comment.id)] }}
                  </p>

                  <form
                    v-if="canCommentOnPost && replyTargetId === comment.id"
                    class="life-comment-form life-comment-form--reply"
                    @submit.prevent="submitReply(post, comment)"
                  >
                    <div class="field">
                      <label :for="`life-reply-${comment.id}`">{{ t('pages.life.reply') }}</label>
                      <textarea
                        :id="`life-reply-${comment.id}`"
                        v-model="replyBodies[comment.id]"
                        :maxlength="commentMaxLength"
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
                          <RouterLink v-if="reply.author" class="user-profile-link" :to="`/profile/${reply.author.id}`">
                            {{ reply.author.displayName }}
                          </RouterLink>
                          <strong v-else>{{ commentAuthorName(reply) }}</strong>
                          <time :datetime="reply.createdAt">{{ formatPostTime(reply.createdAt) }}</time>
                          <StatusBadge
                            v-if="canSeeCommentModeration(reply)"
                            :label="moderationLabel(reply.moderationStatus)"
                            :tone="moderationTone(reply.moderationStatus)"
                            compact
                          />
                        </div>
                        <p class="life-comment__body">{{ reply.body }}</p>
                        <p
                          v-if="canSeeCommentModeration(reply) && moderationReasonVisible(reply.moderationStatus, reply.moderationReason)"
                          class="life-moderation-detail life-moderation-detail--comment"
                        >
                          <strong>{{ t('pages.life.moderationReason') }}</strong>
                          <span>{{ reply.moderationReason }}</span>
                        </p>
                        <div v-if="!reply.deleted || canRestoreComment(reply)" class="life-comment__actions">
                          <button
                            v-if="!reply.deleted"
                            class="life-icon-button life-icon-button--flat"
                            type="button"
                            :aria-label="commentLikeLabel(reply)"
                            :aria-pressed="reply.myLiked"
                            :disabled="!canLikeComment(reply) || isCommentBusy(likeKey(reply.id))"
                            @click="toggleCommentLike(reply)"
                          >
                            <Icon :icon="iconReactionLike" class="ui-icon" aria-hidden="true" />
                            <span class="life-comment__action-count">{{ reply.likeCount }}</span>
                            <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.commentLikeCount', { count: reply.likeCount }) }}</span>
                          </button>
                          <button
                            v-if="canManageComment(reply)"
                            class="life-icon-button life-icon-button--flat life-icon-button--danger"
                            type="button"
                            :aria-label="t('pages.life.deleteComment')"
                            @click="deleteComment(reply)"
                          >
                            <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                            <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.deleteComment') }}</span>
                          </button>
                          <button
                            v-if="canRestoreComment(reply)"
                            class="life-icon-button life-icon-button--flat"
                            type="button"
                            :aria-label="t('pages.life.restoreComment')"
                            :disabled="isCommentBusy(replyKey(reply.id))"
                            @click="restoreComment(reply)"
                          >
                            <Icon :icon="iconUndo" class="ui-icon" aria-hidden="true" />
                            <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.restoreComment') }}</span>
                          </button>
                          <button
                            v-if="canRetryCommentModeration(reply)"
                            class="life-icon-button life-icon-button--flat"
                            type="button"
                            :aria-label="isCommentBusy(replyKey(reply.id)) ? t('pages.life.moderationRetrying') : t('pages.life.moderationRetry')"
                            :disabled="isCommentBusy(replyKey(reply.id))"
                            @click="retryCommentModeration(reply)"
                          >
                            <Icon :icon="iconWarning" class="ui-icon" aria-hidden="true" />
                            <span class="life-action-tooltip" role="tooltip">
                              {{ isCommentBusy(replyKey(reply.id)) ? t('pages.life.moderationRetrying') : t('pages.life.moderationRetry') }}
                            </span>
                          </button>
                        </div>
                        <p v-if="commentErrors[likeKey(reply.id)]" class="life-form__error" role="alert">
                          {{ commentErrors[likeKey(reply.id)] }}
                        </p>
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

          <LoadMoreSentinel :active="commentsHasMore && !commentsLoading" :disabled="commentsLoadingMore" @load="loadComments(false)" />
        </section>
      </article>

      <div v-else-if="!loadError" class="life-empty">
        <Icon :icon="iconLife" class="life-empty__icon" aria-hidden="true" />
        <div class="life-empty__copy">
          <h2>{{ t('pages.life.empty') }}</h2>
        </div>
      </div>
    </div>
  </section>
</template>
