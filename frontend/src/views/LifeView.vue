<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import FilterPanel from '../components/FilterPanel.vue';
import Modal from '../components/Modal.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import TagsSelect from '../components/TagsSelect.vue';
import {
  iconAdd,
  iconCancel,
  iconChevronDown,
  iconComment,
  iconDelete,
  iconEdit,
  iconLife,
  iconReactionFun,
  iconReactionHelpful,
  iconReactionLike,
  iconReactionThanks,
  iconReply,
  iconSave,
  iconSearch,
  iconWarning
} from '../icons';
import {
  api,
  getAuthToken,
  onAuthTokenChange,
  setAuthToken,
  type AuthUser,
  type LifeComment,
  type LifePost,
  type LifeReactionType,
  type NamedEntity
} from '../services/api';

type LifeCommentPageState = {
  items: LifeComment[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
  loading: boolean;
  loadingMore: boolean;
  loaded: boolean;
  error: string;
};

const { locale, t } = useI18n();
const posts = ref<LifePost[]>([]);
const lifeTags = ref<NamedEntity[]>([]);
const currentUser = ref<AuthUser | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const authReady = ref(false);
const busy = ref(false);
const searchDraft = ref('');
const submittedSearch = ref('');
const activeTagId = ref('all');
const body = ref('');
const selectedTagIds = ref<string[]>([]);
const editingPostId = ref<number | null>(null);
const postModalOpen = ref(false);
const formError = ref('');
const loadError = ref('');
const commentBodies = ref<Record<number, string>>({});
const replyBodies = ref<Record<number, string>>({});
const replyTargetId = ref<number | null>(null);
const expandedComments = ref<Record<number, boolean>>({});
const commentPages = ref<Record<number, LifeCommentPageState>>({});
const commentBusyKey = ref('');
const commentErrors = ref<Record<string, string>>({});
const reactionPickerPostId = ref<number | null>(null);
const reactionBusyPostId = ref<number | null>(null);
const reactionErrors = ref<Record<number, string>>({});
const bodyInput = ref<HTMLTextAreaElement | null>(null);
const loadMoreSentinel = ref<HTMLElement | null>(null);
const lifePostPageSize = 20;
const lifeCommentPageSize = 20;
const bodyMaxLength = 2000;
const commentMaxLength = 1000;
const skeletonPostCount = 3;
const loadingMoreSkeletonCount = 2;
let removeAuthListener: (() => void) | null = null;
let feedObserver: IntersectionObserver | null = null;
let postsRequestId = 0;
const nextCursor = ref<string | null>(null);
const hasMorePosts = ref(false);
const loadMorePaused = ref(false);
const allTagValue = 'all';

const reactionOptions = [
  { type: 'like', icon: iconReactionLike, labelKey: 'pages.life.reactionLike' },
  { type: 'helpful', icon: iconReactionHelpful, labelKey: 'pages.life.reactionHelpful' },
  { type: 'fun', icon: iconReactionFun, labelKey: 'pages.life.reactionFun' },
  { type: 'thanks', icon: iconReactionThanks, labelKey: 'pages.life.reactionThanks' }
] as const satisfies ReadonlyArray<{ type: LifeReactionType; icon: string; labelKey: string }>;

function can(permissionKey: string) {
  return currentUser.value?.permissions.includes(permissionKey) === true;
}

const canPost = computed(() => can('life.posts.create'));
const canComment = computed(() => can('life.comments.create'));
const canReact = computed(() => can('life.reactions.set'));
const charactersLeft = computed(() => Math.max(0, bodyMaxLength - body.value.length));
const isEditing = computed(() => editingPostId.value !== null);
const searchQuery = computed(() => submittedSearch.value.trim());
const selectedFeedTagId = computed(() => {
  const tagId = Number(activeTagId.value);
  return activeTagId.value === allTagValue || !Number.isInteger(tagId) || tagId <= 0 ? undefined : tagId;
});
const tagFilterOptions = computed<TabOption[]>(() => [
  { value: allTagValue, label: t('pages.life.allTags') },
  ...lifeTags.value.map((tag) => ({ value: String(tag.id), label: tag.name }))
]);
const postModalTitle = computed(() => (isEditing.value ? t('pages.life.editPost') : t('pages.life.newPost')));
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

async function loadLifeTags() {
  try {
    const options = await api.options();
    lifeTags.value = options.lifeTags;

    if (activeTagId.value !== allTagValue && !lifeTags.value.some((tag) => String(tag.id) === activeTagId.value)) {
      activeTagId.value = allTagValue;
    }
  } catch (error) {
    loadError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  }
}

async function loadPosts() {
  const requestId = ++postsRequestId;
  loading.value = true;
  loadingMore.value = false;
  loadError.value = '';
  nextCursor.value = null;
  hasMorePosts.value = false;
  loadMorePaused.value = false;

  try {
    const page = await api.lifePosts({ limit: lifePostPageSize, search: searchQuery.value, tagId: selectedFeedTagId.value });
    if (requestId !== postsRequestId) {
      return;
    }
    posts.value = page.items;
    expandedComments.value = {};
    commentPages.value = {};
    nextCursor.value = page.nextCursor;
    hasMorePosts.value = page.hasMore;
  } catch (error) {
    if (requestId === postsRequestId) {
      loadError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
    }
  } finally {
    if (requestId === postsRequestId) {
      loading.value = false;
    }
  }
}

async function loadMorePosts() {
  if (loading.value || loadingMore.value || loadMorePaused.value || !hasMorePosts.value) {
    return;
  }

  const cursor = nextCursor.value;
  if (!cursor) {
    hasMorePosts.value = false;
    return;
  }

  const requestId = postsRequestId;
  loadingMore.value = true;
  loadError.value = '';

  try {
    const page = await api.lifePosts({ cursor, limit: lifePostPageSize, search: searchQuery.value, tagId: selectedFeedTagId.value });
    if (requestId !== postsRequestId) {
      return;
    }

    const existingIds = new Set(posts.value.map((post) => post.id));
    posts.value = [...posts.value, ...page.items.filter((post) => !existingIds.has(post.id))];
    nextCursor.value = page.nextCursor;
    hasMorePosts.value = page.hasMore;
  } catch (error) {
    if (requestId === postsRequestId) {
      loadError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
      loadMorePaused.value = true;
    }
  } finally {
    if (requestId === postsRequestId) {
      loadingMore.value = false;
    }
  }
}

function resetForm() {
  body.value = '';
  selectedTagIds.value = [];
  editingPostId.value = null;
  formError.value = '';
}

function payload() {
  return {
    body: body.value.trim(),
    tagIds: selectedLifeTagIds()
  };
}

function selectedLifeTagIds() {
  return selectedTagIds.value.map((tagId) => Number(tagId)).filter((tagId) => Number.isInteger(tagId) && tagId > 0);
}

function submitSearch() {
  const nextSearch = searchDraft.value.trim();
  if (nextSearch === submittedSearch.value && !loadError.value) {
    return;
  }

  submittedSearch.value = nextSearch;
  void loadPosts();
}

function clearSearch() {
  const hadSubmittedSearch = Boolean(submittedSearch.value);
  if (!searchDraft.value && !hadSubmittedSearch) {
    return;
  }

  searchDraft.value = '';
  submittedSearch.value = '';

  if (hadSubmittedSearch) {
    void loadPosts();
  }
}

function retryLoadMore() {
  loadMorePaused.value = false;
  void loadMorePosts();
}

function matchesCurrentFilters(post: LifePost) {
  const keyword = searchQuery.value.toLowerCase();
  const tagId = selectedFeedTagId.value;
  const matchesSearch = keyword === '' || post.body.toLowerCase().includes(keyword);
  const matchesTag = tagId === undefined || post.tags.some((tag) => tag.id === tagId);
  return matchesSearch && matchesTag;
}

function openCreatePostModal() {
  resetForm();
  postModalOpen.value = true;
  void nextTick(() => bodyInput.value?.focus());
}

function closePostModal() {
  if (busy.value) {
    return;
  }

  postModalOpen.value = false;
  resetForm();
}

async function submitPost() {
  if (!body.value.trim()) {
    formError.value = t('pages.life.bodyRequired');
    bodyInput.value?.focus();
    return;
  }

  if (selectedLifeTagIds().length === 0) {
    formError.value = t('pages.life.tagRequired');
    document.getElementById('life-post-tags')?.focus();
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
      if (matchesCurrentFilters(created)) {
        posts.value = [created, ...posts.value];
      }
    }
    resetForm();
    postModalOpen.value = false;
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
  return (currentUser.value?.id === post.author?.id && can('life.posts.update')) || can('life.posts.update-any');
}

function canDeletePost(post: LifePost) {
  return (currentUser.value?.id === post.author?.id && can('life.posts.delete')) || can('life.posts.delete-any');
}

function canManageComment(comment: LifeComment) {
  return !comment.deleted && ((currentUser.value?.id === comment.author?.id && can('life.comments.delete')) || can('life.comments.delete-any'));
}

function commentKey(postId: number) {
  return `post-${postId}`;
}

function replyKey(commentId: number) {
  return `reply-${commentId}`;
}

function initialCommentPage(post: LifePost): LifeCommentPageState {
  return {
    items: post.commentPreview,
    nextCursor: null,
    hasMore: post.commentCount > post.commentPreview.reduce((count, comment) => count + 1 + comment.replies.length, 0),
    total: post.commentCount,
    loading: false,
    loadingMore: false,
    loaded: false,
    error: ''
  };
}

function commentPage(post: LifePost) {
  return commentPages.value[post.id] ?? initialCommentPage(post);
}

function setCommentPage(postId: number, page: LifeCommentPageState) {
  commentPages.value = {
    ...commentPages.value,
    [postId]: page
  };
}

function commentsForPost(post: LifePost) {
  return commentPage(post).items;
}

function commentCount(post: LifePost) {
  return commentPage(post).total;
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
  if (!matchesCurrentFilters(updatedPost)) {
    posts.value = posts.value.filter((post) => post.id !== updatedPost.id);
    return;
  }

  const existingComments = commentPages.value[updatedPost.id];
  if (existingComments) {
    setCommentPage(updatedPost.id, {
      ...existingComments,
      total: updatedPost.commentCount
    });
  }
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

function mergeComments(existing: LifeComment[], incoming: LifeComment[]) {
  const ids = new Set(existing.map((comment) => comment.id));
  return [...existing, ...incoming.filter((comment) => !ids.has(comment.id))];
}

async function loadComments(post: LifePost, reset = false) {
  const existing = commentPage(post);
  if (existing.loading || existing.loadingMore || (!reset && existing.loaded && !existing.hasMore)) {
    return;
  }

  const cursor = reset || !existing.loaded ? null : existing.nextCursor;
  setCommentPage(post.id, {
    ...existing,
    items: reset || !existing.loaded ? [] : existing.items,
    loading: reset || !existing.loaded,
    loadingMore: !reset && existing.loaded,
    error: ''
  });

  try {
    const page = await api.lifeComments(post.id, { limit: lifeCommentPageSize, cursor });
    const nextItems = reset || !existing.loaded ? page.items : mergeComments(existing.items, page.items);
    setCommentPage(post.id, {
      items: nextItems,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total: page.total,
      loading: false,
      loadingMore: false,
      loaded: true,
      error: ''
    });
    post.commentCount = page.total;
  } catch (error) {
    setCommentPage(post.id, {
      ...existing,
      loading: false,
      loadingMore: false,
      error: error instanceof Error && error.message ? error.message : t('errors.loadFailed')
    });
  }
}

function toggleComments(post: LifePost) {
  const expanded = !areCommentsExpanded(post.id);
  setCommentsExpanded(post.id, expanded);
  if (expanded) {
    void loadComments(post);
  }
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

function updateCommentPage(post: LifePost, updater: (page: LifeCommentPageState) => LifeCommentPageState) {
  setCommentPage(post.id, updater(commentPage(post)));
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
  return canReact.value && reactionBusyPostId.value === null;
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
  selectedTagIds.value = post.tags.map((tag) => String(tag.id));
  formError.value = '';
  postModalOpen.value = true;
  void nextTick(() => bodyInput.value?.focus());
}

async function deletePost(post: LifePost) {
  if (!window.confirm(t('pages.life.deleteConfirm'))) {
    return;
  }

  loadError.value = '';

  try {
    await api.deleteLifePost(post.id);
    posts.value = posts.value.filter((item) => item.id !== post.id);
    if (editingPostId.value === post.id) {
      resetForm();
      postModalOpen.value = false;
    }
  } catch (error) {
    loadError.value = error instanceof Error && error.message ? error.message : t('pages.life.deleteFailed');
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
    const nextTotal = commentCount(post) + 1;
    post.commentCount = nextTotal;
    updateCommentPage(post, (page) => ({
      ...page,
      items: mergeComments(page.items, [comment]),
      total: nextTotal,
      loaded: page.loaded || areCommentsExpanded(post.id)
    }));
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
    const nextTotal = commentCount(post) + 1;
    post.commentCount = nextTotal;
    comment.replies.push(reply);
    updateCommentPage(post, (page) => ({
      ...page,
      total: nextTotal
    }));
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
    markCommentDeleted(commentsForPost(post), comment.id);
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

function disconnectFeedObserver() {
  feedObserver?.disconnect();
  feedObserver = null;
}

function observeLoadMore() {
  disconnectFeedObserver();

  if (loading.value || loadingMore.value || loadMorePaused.value || !hasMorePosts.value || !loadMoreSentinel.value) {
    return;
  }

  if (typeof IntersectionObserver === 'undefined') {
    void loadMorePosts();
    return;
  }

  feedObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMorePosts();
      }
    },
    { rootMargin: '360px 0px' }
  );
  feedObserver.observe(loadMoreSentinel.value);
}

watch([loadMoreSentinel, hasMorePosts, loading, loadingMore, loadMorePaused], observeLoadMore, { flush: 'post' });
watch(activeTagId, () => {
  void loadPosts();
});
watch(locale, () => {
  void loadLifeTags();
  void loadPosts();
});

onMounted(() => {
  document.addEventListener('click', closeReactionPickerFromDocument);
  document.addEventListener('keydown', closeReactionPickerFromKeyboard);
  void loadCurrentUser();
  void loadLifeTags();
  void loadPosts();
  removeAuthListener = onAuthTokenChange(() => {
    void loadCurrentUser();
    void loadPosts();
  });
});

onUnmounted(() => {
  document.removeEventListener('click', closeReactionPickerFromDocument);
  document.removeEventListener('keydown', closeReactionPickerFromKeyboard);
  disconnectFeedObserver();
  removeAuthListener?.();
});
</script>

<template>
  <section class="page-stack life-page">
    <PageHeader :title="t('pages.life.title')" :subtitle="t('pages.life.subtitle')">
      <template #kicker>{{ t('pages.life.kicker') }}</template>
    </PageHeader>

    <FilterPanel class="life-toolbar">
      <form class="life-toolbar__search" role="search" @submit.prevent="submitSearch">
        <div class="field life-toolbar__field">
          <label for="life-search">{{ t('pages.life.search') }}</label>
          <div class="life-search-control">
            <input id="life-search" v-model="searchDraft" type="search" :placeholder="t('pages.life.searchPlaceholder')" />
            <button
              v-if="searchDraft || submittedSearch"
              class="life-search-control__clear"
              type="button"
              :aria-label="t('pages.life.clearSearch')"
              @click="clearSearch"
            >
              <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
            </button>
          </div>
        </div>
        <button class="ui-button ui-button--ghost" type="submit">
          <Icon :icon="iconSearch" class="ui-icon" aria-hidden="true" />
          {{ t('common.search') }}
        </button>
      </form>

      <div class="life-toolbar__actions">
        <button class="ui-button ui-button--primary" :disabled="!authReady" type="button" @click="openCreatePostModal">
          <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
          {{ t('pages.life.newPost') }}
        </button>
      </div>
    </FilterPanel>

    <StatusMessage v-if="loadError" variant="danger" :duration="0">{{ loadError }}</StatusMessage>

    <Modal
      :open="postModalOpen"
      :title="postModalTitle"
      :subtitle="t('pages.life.composerPrompt')"
      :close-label="t('common.close')"
      size="wide"
      @close="closePostModal"
    >
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
            :maxlength="bodyMaxLength"
            :placeholder="t('pages.life.bodyPlaceholder')"
            required
          ></textarea>
          <span class="life-form__counter">{{ t('pages.life.charactersLeft', { count: charactersLeft }) }}</span>
        </div>

        <div class="field">
          <label for="life-post-tags">{{ t('pages.life.tags') }}</label>
          <TagsSelect
            id="life-post-tags"
            v-model="selectedTagIds"
            :options="lifeTags"
            :placeholder="t('pages.life.tagPlaceholder')"
            :search-placeholder="t('pages.life.searchTags')"
            dropdown-strategy="fixed"
          />
        </div>

        <p v-if="formError" class="life-form__error" role="alert">{{ formError }}</p>

        <div class="life-form__actions">
          <button class="ui-button ui-button--primary" :disabled="busy || !body.trim()" type="submit">
            <Icon :icon="isEditing ? iconSave : iconLife" class="ui-icon" aria-hidden="true" />
            {{ submitLabel }}
          </button>
          <button class="ui-button ui-button--ghost" :disabled="busy" type="button" @click="closePostModal">
            <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
            {{ t('common.cancel') }}
          </button>
        </div>
      </form>

      <div v-else class="life-auth-note">
        <p>{{ currentUser ? t('pages.life.verifyPrompt') : t('pages.life.loginPrompt') }}</p>
        <RouterLink v-if="!currentUser" class="ui-button ui-button--primary" :to="{ path: '/login', query: { redirect: '/life' } }">
          {{ t('nav.login') }}
        </RouterLink>
      </div>
    </Modal>

    <Tabs id="life-tag-filter" v-model="activeTagId" :tabs="tagFilterOptions" :label="t('pages.life.tags')" />

    <section class="life-feed" :aria-busy="loading || loadingMore" :aria-label="t('pages.life.kicker')">
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
                <RouterLink v-if="post.author" class="user-profile-link" :to="`/profile/${post.author.id}`">
                  {{ post.author.displayName }}
                </RouterLink>
                <strong v-else>{{ t('pages.life.byUnknown') }}</strong>
                <span>
                  <time :datetime="post.createdAt">{{ formatPostTime(post.createdAt) }}</time>
                  <template v-if="post.updatedAt !== post.createdAt"> - {{ t('pages.life.edited') }}</template>
                </span>
              </div>

              <div v-if="canManage(post) || canDeletePost(post)" class="life-post__actions">
                <button v-if="canManage(post)" class="life-icon-button" type="button" :aria-label="t('pages.life.editPost')" @click="startEdit(post)">
                  <Icon :icon="iconEdit" class="ui-icon" aria-hidden="true" />
                  <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.editPost') }}</span>
                </button>
                <button
                  v-if="canDeletePost(post)"
                  class="life-icon-button life-icon-button--danger"
                  type="button"
                  :aria-label="t('pages.life.deletePost')"
                  @click="deletePost(post)"
                >
                  <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                  <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.deletePost') }}</span>
                </button>
              </div>
            </header>

            <p class="life-post__body">{{ post.body }}</p>

            <div v-if="post.tags.length" class="life-post__tags" :aria-label="t('pages.life.tags')">
              <span v-for="tag in post.tags" :key="tag.id" class="life-post__tag">{{ tag.name }}</span>
            </div>

            <div class="life-post__engagement">
              <div class="life-post__engagement-actions">
                <div class="life-reactions">
                  <div class="life-reaction-control">
                    <button
                      class="life-icon-button life-reaction-trigger"
                      :class="{ 'is-active': post.myReaction !== null }"
                      type="button"
                      :aria-controls="`life-reactions-${post.id}`"
                      :aria-expanded="reactionPickerPostId === post.id"
                      :aria-label="reactionButtonLabel(post)"
                      :disabled="!canReact || reactionBusyPostId !== null"
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
                      :disabled="!canReact || reactionBusyPostId !== null"
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
                      :disabled="isReactionBusy(post.id)"
                      @click="toggleReaction(post, option.type)"
                    >
                      <Icon :icon="option.icon" class="ui-icon" aria-hidden="true" />
                      <span>{{ reactionLabel(option.type) }}</span>
                    </button>
                  </div>
                </div>

                <button
                  class="life-icon-button"
                  type="button"
                  :aria-controls="`life-comments-${post.id}`"
                  :aria-expanded="areCommentsExpanded(post.id)"
                  :aria-label="areCommentsExpanded(post.id) ? t('pages.life.hideComments') : t('pages.life.comment')"
                  @click="toggleComments(post)"
                >
                  <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
                  <span class="life-action-tooltip" role="tooltip">
                    {{ areCommentsExpanded(post.id) ? t('pages.life.hideComments') : t('pages.life.comment') }}
                  </span>
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
                      <span class="life-action-tooltip" role="tooltip">{{ reactionCountLabel(post, option.type) }}</span>
                    </span>
                  </template>
                </div>

                <button
                  class="life-metric-button"
                  type="button"
                  :aria-controls="`life-comments-${post.id}`"
                  :aria-expanded="areCommentsExpanded(post.id)"
                  :aria-label="t('pages.life.commentsCount', { count: commentCount(post) })"
                  @click="toggleComments(post)"
                >
                  <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
                  <span>{{ commentCount(post) }}</span>
                  <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.commentsCount', { count: commentCount(post) }) }}</span>
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

              <form v-if="canComment" class="life-comment-form" @submit.prevent="submitComment(post)">
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

              <div v-if="commentPage(post).loading && !commentsForPost(post).length" class="life-comment-list" :aria-label="t('pages.life.loadingComments')">
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

              <p v-else-if="commentPage(post).error" class="life-form__error" role="alert">{{ commentPage(post).error }}</p>

              <div v-else-if="commentsForPost(post).length" class="life-comment-list">
                <article
                  v-for="comment in commentsForPost(post)"
                  :key="comment.id"
                  class="life-comment"
                  :class="{ 'is-deleted': comment.deleted }"
                >
                  <div class="life-comment__main">
                    <div class="life-comment__avatar" aria-hidden="true">{{ commentInitial(comment) }}</div>
                    <div class="life-comment__content">
                      <div class="life-comment__meta">
                        <RouterLink v-if="!comment.deleted && comment.author" class="user-profile-link" :to="`/profile/${comment.author.id}`">
                          {{ comment.author.displayName }}
                        </RouterLink>
                        <strong v-else>{{ commentAuthorName(comment) }}</strong>
                        <time :datetime="comment.createdAt">{{ formatPostTime(comment.createdAt) }}</time>
                      </div>
                      <p v-if="!comment.deleted" class="life-comment__body">{{ comment.body }}</p>

                      <div v-if="!comment.deleted" class="life-comment__actions">
                        <button
                          v-if="canComment"
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
                          @click="deleteComment(post, comment)"
                        >
                          <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                          <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.deleteComment') }}</span>
                        </button>
                      </div>

                      <p v-if="commentErrors[replyKey(comment.id)]" class="life-form__error" role="alert">
                        {{ commentErrors[replyKey(comment.id)] }}
                      </p>

                      <form
                        v-if="canComment && replyTargetId === comment.id"
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
                              <RouterLink v-if="!reply.deleted && reply.author" class="user-profile-link" :to="`/profile/${reply.author.id}`">
                                {{ reply.author.displayName }}
                              </RouterLink>
                              <strong v-else>{{ commentAuthorName(reply) }}</strong>
                              <time :datetime="reply.createdAt">{{ formatPostTime(reply.createdAt) }}</time>
                            </div>
                            <p v-if="!reply.deleted" class="life-comment__body">{{ reply.body }}</p>
                            <div v-if="canManageComment(reply)" class="life-comment__actions">
                              <button
                                class="life-icon-button life-icon-button--flat life-icon-button--danger"
                                type="button"
                                :aria-label="t('pages.life.deleteComment')"
                                @click="deleteComment(post, reply)"
                              >
                                <Icon :icon="iconDelete" class="ui-icon" aria-hidden="true" />
                                <span class="life-action-tooltip" role="tooltip">{{ t('pages.life.deleteComment') }}</span>
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

              <div v-if="commentPage(post).hasMore && !commentPage(post).loading" class="life-feed__retry">
                <button
                  class="ui-button ui-button--ghost ui-button--small"
                  type="button"
                  :disabled="commentPage(post).loadingMore"
                  @click="loadComments(post)"
                >
                  <Icon :icon="iconChevronDown" class="ui-icon" aria-hidden="true" />
                  {{ commentPage(post).loadingMore ? t('common.loading') : t('pages.life.loadMoreComments') }}
                </button>
              </div>
            </section>
          </article>

          <article v-for="index in loadingMore ? loadingMoreSkeletonCount : 0" :key="`life-more-${index}`" class="life-post life-post--skeleton">
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

          <div v-if="hasMorePosts" ref="loadMoreSentinel" class="life-feed__sentinel" aria-hidden="true"></div>
          <div v-if="loadMorePaused && hasMorePosts" class="life-feed__retry">
            <button class="ui-button ui-button--ghost ui-button--small" type="button" @click="retryLoadMore">
              <Icon :icon="iconWarning" class="ui-icon" aria-hidden="true" />
              {{ t('pages.life.retryFeed') }}
            </button>
          </div>
        </div>

        <div v-else class="life-empty">
          <Icon :icon="searchQuery ? iconSearch : iconLife" class="life-empty__icon" aria-hidden="true" />
          <div class="life-empty__copy">
            <h2>{{ searchQuery ? t('pages.life.searchEmpty') : t('pages.life.empty') }}</h2>
            <p>{{ searchQuery ? t('pages.life.searchEmptyHint') : t('pages.life.emptyHint') }}</p>
          </div>
          <button v-if="searchQuery" class="ui-button ui-button--ghost" type="button" @click="clearSearch">
            <Icon :icon="iconCancel" class="ui-icon" aria-hidden="true" />
            {{ t('pages.life.clearSearch') }}
          </button>
          <button v-else class="ui-button ui-button--primary" :disabled="!authReady" type="button" @click="openCreatePostModal">
            <Icon :icon="iconAdd" class="ui-icon" aria-hidden="true" />
            {{ t('pages.life.newPost') }}
          </button>
        </div>
    </section>
  </section>
</template>
