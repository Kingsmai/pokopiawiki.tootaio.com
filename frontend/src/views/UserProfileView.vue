<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import LoadMoreSentinel from '../components/LoadMoreSentinel.vue';
import LifeReactionUsersModal from '../components/LifeReactionUsersModal.vue';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusBadge from '../components/StatusBadge.vue';
import StatusMessage from '../components/StatusMessage.vue';
import Tabs, { type TabOption } from '../components/Tabs.vue';
import {
  iconComment,
  iconCopy,
  iconExternal,
  iconKey,
  iconLife,
  iconProfile,
  iconReactionFun,
  iconReactionHelpful,
  iconReactionLike,
  iconReactionThanks,
  iconReferral,
  iconSave
} from '../icons';
import {
  api,
  getAuthToken,
  notifyAuthChange,
  setAuthToken,
  type AuthUser,
  type DiscussionEntityType,
  type LifePost,
  type LifeReactionType,
  type ProfileCommentSource,
  type PublicUserProfile,
  type ReferralSummary,
  type UserCommentActivity,
  type UserReactionActivity
} from '../services/api';

type ProfileTab = 'feeds' | 'contributions' | 'reactions' | 'comments' | 'account';
type PrimaryContributionFilter = 'pokemon' | 'items' | 'ancient-artifacts' | 'recipes' | 'habitats' | 'daily-checklist';
type ContributionFilter = 'all' | PrimaryContributionFilter | 'config';
type ReactionFilter = 'all' | LifeReactionType;
type CommentFilter = 'all' | ProfileCommentSource;

const primaryContributionFilters: PrimaryContributionFilter[] = [
  'pokemon',
  'items',
  'ancient-artifacts',
  'recipes',
  'habitats',
  'daily-checklist'
];

const { locale, t } = useI18n();
const route = useRoute();
const currentUser = ref<AuthUser | null>(null);
const profile = ref<PublicUserProfile | null>(null);
const referral = ref<ReferralSummary | null>(null);
const displayName = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const activeTab = ref<ProfileTab>('feeds');
const contributionFilter = ref<ContributionFilter>('all');
const reactionFilter = ref<ReactionFilter>('all');
const commentFilter = ref<CommentFilter>('all');
const loading = ref(true);
const busy = ref(false);
const passwordBusy = ref(false);
const followBusy = ref(false);
const message = ref('');
const errorMessage = ref('');
const passwordMessage = ref('');
const passwordErrorMessage = ref('');
const followErrorMessage = ref('');
const referralSummaryMessage = ref('');
const referralSummaryErrorMessage = ref('');
const referralMessage = ref('');
const referralErrorMessage = ref('');
const feeds = ref<LifePost[]>([]);
const feedsCursor = ref<string | null>(null);
const feedsHasMore = ref(false);
const feedsLoading = ref(false);
const feedsError = ref('');
const reactions = ref<UserReactionActivity[]>([]);
const reactionsCursor = ref<string | null>(null);
const reactionsHasMore = ref(false);
const reactionsLoading = ref(false);
const reactionsError = ref('');
const comments = ref<UserCommentActivity[]>([]);
const commentsCursor = ref<string | null>(null);
const commentsHasMore = ref(false);
const commentsLoading = ref(false);
const commentsError = ref('');
const reactionUsersModal = ref<{ postId: number; reactionType: LifeReactionType | null } | null>(null);
const activityLimit = 10;
let profileRequestId = 0;

const routeProfileId = computed(() => {
  const value = route.params.id;
  return Array.isArray(value) ? value[0] : value;
});
const isAccountRoute = computed(() => !routeProfileId.value);
const canShowAccount = computed(() => {
  return isAccountRoute.value && currentUser.value !== null && profile.value?.user.id === currentUser.value.id;
});
const trimmedDisplayName = computed(() => displayName.value.trim());
const hasChanges = computed(() => {
  const user = currentUser.value;
  if (!user || !canShowAccount.value) return false;
  return trimmedDisplayName.value !== user.displayName;
});
const canFollowProfile = computed(() => {
  const user = currentUser.value;
  const target = profile.value?.user;
  return Boolean(user && target && user.id !== target.id && user.permissions.includes('users.follow'));
});
const followButtonLabel = computed(() => {
  const relation = profile.value?.social.viewerRelation ?? 'none';
  if (relation === 'friends') return t('pages.profile.friend');
  if (relation === 'following') return t('pages.profile.following');
  if (relation === 'followed-by') return t('pages.profile.followBack');
  return t('pages.profile.follow');
});
const profileInitial = computed(() => {
  const name = profile.value?.user.displayName.trim() || currentUser.value?.displayName.trim() || '';
  return name.charAt(0).toUpperCase() || '#';
});
const pageTitle = computed(() => profile.value?.user.displayName ?? t('pages.profile.title'));
const pageSubtitle = computed(() => (isAccountRoute.value ? t('pages.profile.subtitle') : t('pages.profile.publicSubtitle')));
const tabs = computed<TabOption[]>(() => {
  const baseTabs: TabOption[] = [
    { value: 'feeds', label: t('pages.profile.tabFeeds') },
    { value: 'contributions', label: t('pages.profile.tabContributions') },
    { value: 'reactions', label: t('pages.profile.tabReactions') },
    { value: 'comments', label: t('pages.profile.tabComments') }
  ];

  return canShowAccount.value ? [...baseTabs, { value: 'account', label: t('pages.profile.tabAccount') }] : baseTabs;
});
const contributionFilterTabs = computed<TabOption[]>(() => [
  { value: 'all', label: t('common.all') },
  { value: 'pokemon', label: t('nav.pokemon') },
  { value: 'items', label: t('nav.items') },
  { value: 'recipes', label: t('nav.recipes') },
  { value: 'habitats', label: t('nav.habitats') },
  { value: 'daily-checklist', label: t('nav.checklist') },
  { value: 'config', label: t('pages.profile.contributionConfig') }
]);
const reactionFilterTabs = computed<TabOption[]>(() => [
  { value: 'all', label: t('common.all') },
  { value: 'like', label: reactionLabel('like') },
  { value: 'helpful', label: reactionLabel('helpful') },
  { value: 'fun', label: reactionLabel('fun') },
  { value: 'thanks', label: reactionLabel('thanks') }
]);
const commentFilterTabs = computed<TabOption[]>(() => [
  { value: 'all', label: t('common.all') },
  { value: 'life', label: t('pages.profile.lifeCommentCategory') },
  { value: 'discussion', label: t('pages.profile.discussionCommentCategory') }
]);
const headlineStats = computed(() => {
  const stats = profile.value?.stats;
  return [
    { label: t('pages.profile.lifePosts'), value: stats?.lifePosts ?? 0 },
    { label: t('pages.profile.wikiEdits'), value: stats?.wikiEdits ?? 0 },
    { label: t('pages.profile.lifeReactions'), value: stats?.lifeReactions ?? 0 },
    { label: t('pages.profile.commentsMade'), value: (stats?.lifeComments ?? 0) + (stats?.discussionComments ?? 0) }
  ];
});
const wikiStats = computed(() => {
  const stats = profile.value?.stats;
  return [
    { label: t('pages.profile.wikiEdits'), value: stats?.wikiEdits ?? 0 },
    { label: t('pages.profile.wikiCreates'), value: stats?.wikiCreates ?? 0 },
    { label: t('pages.profile.wikiUpdates'), value: stats?.wikiUpdates ?? 0 },
    { label: t('pages.profile.wikiDeletes'), value: stats?.wikiDeletes ?? 0 },
    { label: t('pages.profile.imageUploads'), value: stats?.imageUploads ?? 0 }
  ];
});
const communityStats = computed(() => {
  const stats = profile.value?.stats;
  return [
    { label: t('pages.profile.lifePosts'), value: stats?.lifePosts ?? 0 },
    { label: t('pages.profile.lifeComments'), value: stats?.lifeComments ?? 0 },
    { label: t('pages.profile.lifeReactions'), value: stats?.lifeReactions ?? 0 },
    { label: t('pages.profile.discussionComments'), value: stats?.discussionComments ?? 0 }
  ];
});
const socialStats = computed(() => {
  const social = profile.value?.social;
  return [
    { label: t('pages.profile.followers'), value: social?.followerCount ?? 0 },
    { label: t('pages.profile.followingCount'), value: social?.followingCount ?? 0 },
    { label: t('pages.profile.friends'), value: social?.friendCount ?? 0 }
  ];
});
const filteredContributions = computed(() => {
  const items = profile.value?.contributions ?? [];
  if (contributionFilter.value === 'all') {
    return items;
  }

  return items.filter((item) => contributionCategory(item.contentType) === contributionFilter.value);
});

watch(
  tabs,
  (nextTabs) => {
    if (!nextTabs.some((tab) => tab.value === activeTab.value)) {
      activeTab.value = 'feeds';
    }
  },
  { immediate: true }
);

watch(
  () => activeTab.value,
  () => {
    void loadActiveTab();
  }
);

watch(
  () => reactionFilter.value,
  () => {
    resetReactions();
    if (activeTab.value === 'reactions') {
      void loadReactions(true);
    }
  }
);

watch(
  () => commentFilter.value,
  () => {
    resetComments();
    if (activeTab.value === 'comments') {
      void loadComments(true);
    }
  }
);

watch(
  () => route.fullPath,
  () => {
    void loadProfile();
  }
);

function resetFeeds() {
  feeds.value = [];
  feedsCursor.value = null;
  feedsHasMore.value = false;
  feedsError.value = '';
}

function resetReactions() {
  reactions.value = [];
  reactionsCursor.value = null;
  reactionsHasMore.value = false;
  reactionsError.value = '';
}

function resetComments() {
  comments.value = [];
  commentsCursor.value = null;
  commentsHasMore.value = false;
  commentsError.value = '';
}

function resetActivity() {
  resetFeeds();
  resetReactions();
  resetComments();
}

async function loadOptionalCurrentUser() {
  if (!getAuthToken()) {
    currentUser.value = null;
    return null;
  }

  try {
    const response = await api.me();
    currentUser.value = response.user;
    return response.user;
  } catch {
    currentUser.value = null;
    setAuthToken(null);
    return null;
  }
}

async function loadProfile() {
  const nextRequestId = ++profileRequestId;
  loading.value = true;
  message.value = '';
  errorMessage.value = '';
  passwordMessage.value = '';
  passwordErrorMessage.value = '';
  followErrorMessage.value = '';
  referralSummaryMessage.value = '';
  referralSummaryErrorMessage.value = '';
  referralMessage.value = '';
  referralErrorMessage.value = '';
  referral.value = null;
  profile.value = null;
  contributionFilter.value = 'all';
  reactionFilter.value = 'all';
  commentFilter.value = 'all';
  currentPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  resetActivity();

  try {
    let targetId = routeProfileId.value ?? '';

    if (isAccountRoute.value) {
      const response = await api.me();
      currentUser.value = response.user;
      targetId = String(response.user.id);
      displayName.value = response.user.displayName;

      try {
        const referralResponse = await api.referral();
        if (nextRequestId === profileRequestId) {
          referral.value = referralResponse.referral;
        }
      } catch {
        if (nextRequestId === profileRequestId) {
          referralErrorMessage.value = t('pages.profile.referralLoadFailed');
        }
      }
    } else {
      await loadOptionalCurrentUser();
    }

    const response = await api.publicProfile(targetId);
    if (nextRequestId !== profileRequestId) {
      return;
    }

    profile.value = response.profile;
    if (canShowAccount.value) {
      displayName.value = currentUser.value?.displayName ?? response.profile.user.displayName;
    }
    void loadActiveTab(true);
  } catch (error) {
    if (nextRequestId === profileRequestId) {
      profile.value = null;
      errorMessage.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
    }
  } finally {
    if (nextRequestId === profileRequestId) {
      loading.value = false;
    }
  }
}

async function toggleFollow() {
  const target = profile.value?.user;
  if (!target || !canFollowProfile.value || followBusy.value) {
    return;
  }

  followErrorMessage.value = '';
  followBusy.value = true;
  try {
    const relation = profile.value?.social.viewerRelation ?? 'none';
    const response = relation === 'following' || relation === 'friends'
      ? await api.unfollowUser(target.id)
      : await api.followUser(target.id);
    profile.value = response.profile;
  } catch (error) {
    followErrorMessage.value = error instanceof Error && error.message ? error.message : t('pages.profile.followFailed');
  } finally {
    followBusy.value = false;
  }
}

async function saveProfile() {
  message.value = '';
  errorMessage.value = '';

  if (!trimmedDisplayName.value) {
    errorMessage.value = t('pages.profile.displayNameRequired');
    return;
  }

  busy.value = true;
  try {
    const response = await api.updateMe({ displayName: trimmedDisplayName.value });
    currentUser.value = response.user;
    displayName.value = response.user.displayName;
    if (profile.value) {
      profile.value = {
        ...profile.value,
        user: {
          ...profile.value.user,
          displayName: response.user.displayName
        }
      };
    }
    message.value = t('pages.profile.saved');
    notifyAuthChange();
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('pages.profile.saveFailed');
  } finally {
    busy.value = false;
  }
}

async function savePassword() {
  passwordMessage.value = '';
  passwordErrorMessage.value = '';

  if (newPassword.value !== confirmPassword.value) {
    passwordErrorMessage.value = t('auth.passwordMismatch');
    return;
  }

  passwordBusy.value = true;
  try {
    const response = await api.changePassword({
      currentPassword: currentPassword.value,
      password: newPassword.value
    });
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    passwordMessage.value = response.message || t('pages.profile.passwordSaved');
  } catch (error) {
    passwordErrorMessage.value = error instanceof Error && error.message ? error.message : t('pages.profile.passwordSaveFailed');
  } finally {
    passwordBusy.value = false;
  }
}

function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();

  return copied ? Promise.resolve() : Promise.reject(new Error('Clipboard unavailable'));
}

async function copyReferralLink(surface: 'summary' | 'card' = 'card') {
  if (!referral.value) {
    return;
  }

  referralSummaryMessage.value = '';
  referralSummaryErrorMessage.value = '';
  referralMessage.value = '';
  referralErrorMessage.value = '';

  try {
    await writeClipboard(referral.value.url);
    if (surface === 'summary') {
      referralSummaryMessage.value = t('pages.profile.referralCopied');
    } else {
      referralMessage.value = t('pages.profile.referralCopied');
    }
  } catch {
    if (surface === 'summary') {
      referralSummaryErrorMessage.value = t('pages.profile.referralCopyFailed');
    } else {
      referralErrorMessage.value = t('pages.profile.referralCopyFailed');
    }
  }
}

async function loadActiveTab(force = false) {
  if (!profile.value) {
    return;
  }

  if (activeTab.value === 'feeds' && (force || feeds.value.length === 0)) {
    await loadFeeds(true);
  } else if (activeTab.value === 'reactions' && (force || reactions.value.length === 0)) {
    await loadReactions(true);
  } else if (activeTab.value === 'comments' && (force || comments.value.length === 0)) {
    await loadComments(true);
  }
}

async function loadFeeds(reset = false) {
  if (!profile.value || feedsLoading.value) {
    return;
  }

  feedsLoading.value = true;
  feedsError.value = '';
  try {
    const page = await api.userLifePosts(profile.value.user.id, {
      cursor: reset ? null : feedsCursor.value,
      limit: activityLimit
    });
    feeds.value = reset ? page.items : [...feeds.value, ...page.items];
    feedsCursor.value = page.nextCursor;
    feedsHasMore.value = page.hasMore;
  } catch (error) {
    feedsError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    feedsLoading.value = false;
  }
}

async function loadReactions(reset = false) {
  if (!profile.value || reactionsLoading.value) {
    return;
  }

  reactionsLoading.value = true;
  reactionsError.value = '';
  try {
    const page = await api.userReactions(profile.value.user.id, {
      cursor: reset ? null : reactionsCursor.value,
      limit: activityLimit,
      reactionType: reactionFilter.value === 'all' ? undefined : reactionFilter.value
    });
    reactions.value = reset ? page.items : [...reactions.value, ...page.items];
    reactionsCursor.value = page.nextCursor;
    reactionsHasMore.value = page.hasMore;
  } catch (error) {
    reactionsError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    reactionsLoading.value = false;
  }
}

async function loadComments(reset = false) {
  if (!profile.value || commentsLoading.value) {
    return;
  }

  commentsLoading.value = true;
  commentsError.value = '';
  try {
    const page = await api.userComments(profile.value.user.id, {
      cursor: reset ? null : commentsCursor.value,
      limit: activityLimit,
      source: commentFilter.value === 'all' ? undefined : commentFilter.value
    });
    comments.value = reset ? page.items : [...comments.value, ...page.items];
    commentsCursor.value = page.nextCursor;
    commentsHasMore.value = page.hasMore;
  } catch (error) {
    commentsError.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    commentsLoading.value = false;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium'
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function authorInitial(post: LifePost): string {
  const name = post.author?.displayName.trim() || t('pages.life.byUnknown');
  return name.slice(0, 1).toUpperCase();
}

function commentTotal(post: LifePost): number {
  return post.commentCount;
}

function reactionTotal(post: LifePost): number {
  return Object.values(post.reactionCounts).reduce((total, count) => total + count, 0);
}

function postExcerpt(post: LifePost): string {
  return post.body.length > 180 ? `${post.body.slice(0, 180).trim()}...` : post.body;
}

function reactionIcon(type: LifeReactionType) {
  return {
    like: iconReactionLike,
    helpful: iconReactionHelpful,
    fun: iconReactionFun,
    thanks: iconReactionThanks
  }[type];
}

function reactionLabel(type: LifeReactionType): string {
  return t(`pages.life.reaction${type.charAt(0).toUpperCase()}${type.slice(1)}`);
}

function openReactionUsersModal(postId: number, reactionType: LifeReactionType | null = null) {
  reactionUsersModal.value = { postId, reactionType };
}

function closeReactionUsersModal() {
  reactionUsersModal.value = null;
}

function contributionCategory(contentType: string): ContributionFilter {
  return primaryContributionFilters.includes(contentType as PrimaryContributionFilter)
    ? (contentType as PrimaryContributionFilter)
    : 'config';
}

function contentTypeLabel(contentType: string): string {
  const labels: Record<string, string> = {
    pokemon: t('nav.pokemon'),
    items: t('nav.items'),
    'ancient-artifacts': t('nav.ancientArtifacts'),
    recipes: t('nav.recipes'),
    habitats: t('nav.habitats'),
    'daily-checklist': t('nav.checklist'),
    'pokemon-types': t('config.pokemonTypes'),
    skills: t('config.skills'),
    environments: t('config.environments'),
    'favorite-things': t('config.favoriteThings'),
    'acquisition-methods': t('config.acquisitionMethods'),
    maps: t('config.maps'),
    'life-tags': t('config.lifeCategories')
  };
  return labels[contentType] ?? t('pages.profile.otherContributions');
}

function discussionTargetRoute(type: DiscussionEntityType, id: number): string {
  return {
    pokemon: `/pokemon/${id}`,
    items: `/items/${id}`,
    recipes: `/recipes/${id}`,
    habitats: `/habitats/${id}`,
    'ancient-artifacts': `/ancient-artifacts/${id}`
  }[type];
}

function commentTargetRoute(comment: UserCommentActivity): string {
  return comment.target.type === 'life-post' ? `/life/${comment.target.id}` : discussionTargetRoute(comment.target.type, comment.target.id);
}

function commentTargetTitle(comment: UserCommentActivity): string {
  if (comment.target.type === 'life-post') {
    return comment.target.title
      ? t('pages.profile.lifePostBy', { name: comment.target.title })
      : t('pages.profile.lifePostTarget');
  }

  return comment.target.title || contentTypeLabel(comment.target.type);
}

onMounted(() => {
  void loadProfile();
});
</script>

<template>
  <section class="profile-page">
    <PageHeader :title="pageTitle" :subtitle="pageSubtitle">
      <template #kicker>{{ isAccountRoute ? t('auth.accountAccess') : t('pages.profile.publicKicker') }}</template>
    </PageHeader>

    <div v-if="loading" class="profile-layout profile-layout--loading" aria-busy="true" :aria-label="t('pages.profile.loading')">
      <section class="profile-card profile-card--identity" aria-hidden="true">
        <div class="profile-identity">
          <Skeleton variant="box" width="58px" height="58px" />
          <div class="profile-identity__copy">
            <Skeleton width="160px" height="28px" />
            <Skeleton width="220px" />
          </div>
        </div>
      </section>
      <section class="profile-card profile-card--wide" aria-hidden="true">
        <Skeleton width="210px" height="28px" />
        <div class="profile-stat-grid">
          <Skeleton v-for="index in 4" :key="index" variant="box" height="74px" />
        </div>
      </section>
    </div>

    <StatusMessage v-else-if="errorMessage" variant="danger" :duration="0">{{ errorMessage }}</StatusMessage>

    <div v-else-if="profile" class="profile-public-layout">
      <section class="profile-card profile-hero" :aria-label="t('pages.profile.accountSummary')">
        <div class="profile-identity">
          <div class="profile-avatar" aria-hidden="true">{{ profileInitial }}</div>
          <div class="profile-identity__copy">
            <h2>{{ profile.user.displayName }}</h2>
            <p>{{ t('pages.profile.joinedAt', { date: formatDate(profile.user.joinedAt) }) }}</p>
          </div>
        </div>

        <StatusBadge
          v-if="canShowAccount && currentUser"
          :label="currentUser.emailVerified ? t('pages.profile.emailVerified') : t('pages.profile.emailUnverified')"
          :tone="currentUser.emailVerified ? 'success' : 'warning'"
        />

        <div v-if="canFollowProfile" class="profile-follow-actions">
          <button class="ui-button ui-button--blue" type="button" :disabled="followBusy" @click="toggleFollow">
            <Icon :icon="iconReferral" class="ui-icon" aria-hidden="true" />
            {{ followButtonLabel }}
          </button>
          <StatusMessage v-if="followErrorMessage" variant="danger" :duration="0">{{ followErrorMessage }}</StatusMessage>
        </div>

        <dl class="profile-stat-strip">
          <div v-for="item in headlineStats" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>

        <dl class="profile-stat-strip profile-stat-strip--social">
          <div v-for="item in socialStats" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>

        <div v-if="canShowAccount && referral" class="profile-referral-summary">
          <div>
            <span>{{ t('pages.profile.referralCode') }}</span>
            <strong>{{ referral.code }}</strong>
          </div>
          <button class="ui-button ui-button--blue" type="button" @click="copyReferralLink('summary')">
            <Icon :icon="iconCopy" class="ui-icon" aria-hidden="true" />
            {{ t('pages.profile.copyReferralLink') }}
          </button>
          <StatusMessage v-if="referralSummaryMessage" variant="success">{{ referralSummaryMessage }}</StatusMessage>
          <StatusMessage v-if="referralSummaryErrorMessage" variant="danger">{{ referralSummaryErrorMessage }}</StatusMessage>
        </div>
      </section>

      <Tabs id="profile-tabs" v-model="activeTab" :tabs="tabs" :label="t('pages.profile.tabsLabel')" />

      <LifeReactionUsersModal
        v-if="reactionUsersModal"
        :post-id="reactionUsersModal.postId"
        :initial-reaction-type="reactionUsersModal.reactionType"
        @close="closeReactionUsersModal"
      />

      <section v-if="activeTab === 'feeds'" class="profile-tab-panel" :aria-label="t('pages.profile.tabFeeds')">
        <StatusMessage v-if="feedsError" variant="danger" :duration="0">{{ feedsError }}</StatusMessage>

        <div v-if="feedsLoading && !feeds.length" class="life-feed__list" aria-hidden="true">
          <article v-for="index in 3" :key="index" class="life-post life-post--skeleton">
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
        </div>

        <div v-else-if="feeds.length" class="life-feed__list">
          <article v-for="post in feeds" :key="post.id" class="life-post profile-feed-card">
            <header class="life-post__header">
              <div class="life-post__avatar" aria-hidden="true">{{ authorInitial(post) }}</div>
              <div class="life-post__byline">
                <RouterLink v-if="post.author" class="user-profile-link" :to="`/profile/${post.author.id}`">
                  {{ post.author.displayName }}
                </RouterLink>
                <strong v-else>{{ t('pages.life.byUnknown') }}</strong>
                <span>
                  <time :datetime="post.createdAt">{{ formatDateTime(post.createdAt) }}</time>
                  <template v-if="post.updatedAt !== post.createdAt"> - {{ t('pages.life.edited') }}</template>
                </span>
              </div>
            </header>

            <p class="life-post__body">{{ post.body }}</p>

            <div v-if="post.category" class="life-post__tags" :aria-label="t('pages.life.category')">
              <span class="life-post__tag">{{ post.category.name }}</span>
            </div>

            <div class="profile-feed-card__metrics">
              <button
                class="profile-reaction-open-button"
                type="button"
                :aria-label="t('pages.life.reactionsCount', { count: reactionTotal(post) })"
                @click="openReactionUsersModal(post.id)"
              >
                <Icon :icon="iconReactionLike" class="ui-icon" aria-hidden="true" />
                {{ t('pages.life.reactionsCount', { count: reactionTotal(post) }) }}
              </button>
              <span>
                <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
                {{ t('pages.life.commentsCount', { count: commentTotal(post) }) }}
              </span>
              <RouterLink class="profile-feed-card__detail-link" :to="`/life/${post.id}`">
                <Icon :icon="iconExternal" class="ui-icon" aria-hidden="true" />
                {{ t('pages.life.viewPost') }}
              </RouterLink>
            </div>
          </article>

          <LoadMoreSentinel :active="feedsHasMore" :disabled="feedsLoading" @load="loadFeeds(false)" />
        </div>

        <div v-else class="profile-empty">
          <Icon :icon="iconLife" class="profile-empty__icon" aria-hidden="true" />
          <h2>{{ t('pages.profile.feedsEmpty') }}</h2>
        </div>
      </section>

      <section v-else-if="activeTab === 'contributions'" class="profile-tab-panel" :aria-label="t('pages.profile.tabContributions')">
        <div class="profile-section-grid">
          <section class="profile-card profile-card--soft" :aria-label="t('pages.profile.wikiContributionStats')">
            <div class="profile-card__header">
              <Icon :icon="iconProfile" class="profile-card__icon" aria-hidden="true" />
              <h2>{{ t('pages.profile.wikiContributionStats') }}</h2>
            </div>
            <dl class="profile-stat-grid">
              <div v-for="item in wikiStats" :key="item.label">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
          </section>

          <section class="profile-card profile-card--soft" :aria-label="t('pages.profile.communityStats')">
            <div class="profile-card__header">
              <Icon :icon="iconLife" class="profile-card__icon" aria-hidden="true" />
              <h2>{{ t('pages.profile.communityStats') }}</h2>
            </div>
            <dl class="profile-stat-grid">
              <div v-for="item in communityStats" :key="item.label">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <Tabs
          id="profile-contribution-filter"
          v-model="contributionFilter"
          class="profile-secondary-tabs"
          :tabs="contributionFilterTabs"
          :label="t('pages.profile.contributionFiltersLabel')"
        />

        <section class="profile-card profile-card--wide" :aria-label="t('pages.profile.contributionBreakdown')">
          <div class="profile-card__header">
            <Icon :icon="iconProfile" class="profile-card__icon" aria-hidden="true" />
            <h2>{{ t('pages.profile.contributionBreakdown') }}</h2>
          </div>

          <div v-if="filteredContributions.length" class="profile-contribution-list">
            <article v-for="item in filteredContributions" :key="item.contentType" class="profile-contribution-row">
              <div>
                <strong>{{ contentTypeLabel(item.contentType) }}</strong>
                <span v-if="item.lastContributedAt">{{ formatDateTime(item.lastContributedAt) }}</span>
              </div>
              <dl>
                <div>
                  <dt>{{ t('pages.profile.total') }}</dt>
                  <dd>{{ item.total }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.profile.wikiCreates') }}</dt>
                  <dd>{{ item.creates }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.profile.wikiUpdates') }}</dt>
                  <dd>{{ item.updates }}</dd>
                </div>
                <div>
                  <dt>{{ t('pages.profile.wikiDeletes') }}</dt>
                  <dd>{{ item.deletes }}</dd>
                </div>
              </dl>
            </article>
          </div>

          <div v-else class="profile-empty profile-empty--compact">
            <Icon :icon="iconProfile" class="profile-empty__icon" aria-hidden="true" />
            <h2>{{ profile.contributions.length ? t('pages.profile.contributionsFilterEmpty') : t('pages.profile.contributionsEmpty') }}</h2>
          </div>
        </section>
      </section>

      <section v-else-if="activeTab === 'reactions'" class="profile-tab-panel" :aria-label="t('pages.profile.tabReactions')">
        <StatusMessage v-if="reactionsError" variant="danger" :duration="0">{{ reactionsError }}</StatusMessage>

        <Tabs
          id="profile-reaction-filter"
          v-model="reactionFilter"
          class="profile-secondary-tabs"
          :tabs="reactionFilterTabs"
          :label="t('pages.profile.reactionFiltersLabel')"
        />

        <div v-if="reactionsLoading && !reactions.length" class="profile-activity-list" aria-hidden="true">
          <article v-for="index in 3" :key="index" class="profile-activity-card">
            <Skeleton width="180px" />
            <Skeleton width="90%" />
            <Skeleton width="64%" />
          </article>
        </div>

        <div v-else-if="reactions.length" class="profile-activity-list">
          <article v-for="activity in reactions" :key="`${activity.postId}-${activity.reactedAt}`" class="profile-activity-card">
            <header class="profile-activity-card__header">
              <button
                class="profile-reaction-open-button"
                type="button"
                :aria-label="reactionLabel(activity.reactionType)"
                @click="openReactionUsersModal(activity.post.id, activity.reactionType)"
              >
                <Icon :icon="reactionIcon(activity.reactionType)" class="ui-icon" aria-hidden="true" />
                {{ reactionLabel(activity.reactionType) }}
              </button>
              <time :datetime="activity.reactedAt">{{ formatDateTime(activity.reactedAt) }}</time>
            </header>

            <div class="profile-post-preview">
              <div class="profile-post-preview__meta">
                <RouterLink v-if="activity.post.author" class="user-profile-link" :to="`/profile/${activity.post.author.id}`">
                  {{ activity.post.author.displayName }}
                </RouterLink>
                <strong v-else>{{ t('pages.life.byUnknown') }}</strong>
                <span>{{ formatDateTime(activity.post.createdAt) }}</span>
              </div>
              <p>{{ postExcerpt(activity.post) }}</p>
              <RouterLink class="profile-post-preview__detail" :to="`/life/${activity.post.id}`">
                <Icon :icon="iconExternal" class="ui-icon" aria-hidden="true" />
                {{ t('pages.life.viewPost') }}
              </RouterLink>
            </div>
          </article>

          <LoadMoreSentinel :active="reactionsHasMore" :disabled="reactionsLoading" @load="loadReactions(false)" />
        </div>

        <div v-else class="profile-empty">
          <Icon :icon="iconReactionLike" class="profile-empty__icon" aria-hidden="true" />
          <h2>{{ reactionFilter === 'all' ? t('pages.profile.reactionsEmpty') : t('pages.profile.reactionsFilterEmpty') }}</h2>
        </div>
      </section>

      <section v-else-if="activeTab === 'comments'" class="profile-tab-panel" :aria-label="t('pages.profile.tabComments')">
        <StatusMessage v-if="commentsError" variant="danger" :duration="0">{{ commentsError }}</StatusMessage>

        <Tabs
          id="profile-comment-filter"
          v-model="commentFilter"
          class="profile-secondary-tabs"
          :tabs="commentFilterTabs"
          :label="t('pages.profile.commentFiltersLabel')"
        />

        <div v-if="commentsLoading && !comments.length" class="profile-activity-list" aria-hidden="true">
          <article v-for="index in 3" :key="index" class="profile-activity-card">
            <Skeleton width="180px" />
            <Skeleton width="94%" />
            <Skeleton width="60%" />
          </article>
        </div>

        <div v-else-if="comments.length" class="profile-activity-list">
          <article v-for="comment in comments" :key="`${comment.source}-${comment.id}`" class="profile-activity-card">
            <header class="profile-activity-card__header">
              <span>
                <Icon :icon="iconComment" class="ui-icon" aria-hidden="true" />
                {{ comment.source === 'life' ? t('pages.profile.lifeComment') : t('pages.profile.discussionComment') }}
              </span>
              <time :datetime="comment.createdAt">{{ formatDateTime(comment.createdAt) }}</time>
            </header>

            <p class="profile-comment-body">{{ comment.body }}</p>
            <RouterLink class="profile-comment-target" :to="commentTargetRoute(comment)">
              {{ commentTargetTitle(comment) }}
            </RouterLink>
            <p v-if="comment.target.excerpt" class="profile-comment-excerpt">{{ comment.target.excerpt }}</p>
          </article>

          <LoadMoreSentinel :active="commentsHasMore" :disabled="commentsLoading" @load="loadComments(false)" />
        </div>

        <div v-else class="profile-empty">
          <Icon :icon="iconComment" class="profile-empty__icon" aria-hidden="true" />
          <h2>{{ commentFilter === 'all' ? t('pages.profile.commentsEmpty') : t('pages.profile.commentsFilterEmpty') }}</h2>
        </div>
      </section>

      <section v-else-if="activeTab === 'account' && canShowAccount && currentUser" class="profile-tab-panel profile-account-grid">
        <section class="profile-card" :aria-label="t('pages.profile.profileDetails')">
          <div class="profile-card__header">
            <Icon :icon="iconProfile" class="profile-card__icon" aria-hidden="true" />
            <h2>{{ t('pages.profile.profileDetails') }}</h2>
          </div>

          <form class="auth-form" @submit.prevent="saveProfile">
            <div class="field">
              <label for="profile-display-name">{{ t('auth.displayName') }}</label>
              <input
                id="profile-display-name"
                v-model="displayName"
                autocomplete="nickname"
                maxlength="40"
                required
                :disabled="busy"
              />
              <small class="profile-field-note">{{ t('pages.profile.displayNameHint') }}</small>
            </div>

            <div class="field">
              <label for="profile-email">{{ t('auth.email') }}</label>
              <input id="profile-email" class="profile-readonly-input" :value="currentUser.email" readonly type="email" />
            </div>

            <StatusMessage v-if="message" variant="success">{{ message }}</StatusMessage>
            <StatusMessage v-if="errorMessage" variant="danger">{{ errorMessage }}</StatusMessage>

            <button class="ui-button ui-button--primary" :disabled="busy || !hasChanges" type="submit">
              <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
              {{ busy ? t('common.saving') : t('common.save') }}
            </button>
          </form>
        </section>

        <section class="profile-card profile-card--referral" :aria-label="t('pages.profile.referralTitle')">
          <div class="profile-card__header">
            <Icon :icon="iconReferral" class="profile-card__icon" aria-hidden="true" />
            <h2>{{ t('pages.profile.referralTitle') }}</h2>
          </div>

          <div v-if="referral" class="profile-referral">
            <div class="profile-referral__metric">
              <span>{{ t('pages.profile.verifiedReferralCount') }}</span>
              <strong>{{ referral.verifiedReferralCount }}</strong>
            </div>

            <div class="field">
              <label for="profile-referral-code">{{ t('pages.profile.referralCode') }}</label>
              <input id="profile-referral-code" class="profile-readonly-input profile-code-input" :value="referral.code" readonly />
            </div>

            <div class="field">
              <label for="profile-referral-url">{{ t('pages.profile.referralUrl') }}</label>
              <div class="profile-referral-link-row">
                <input id="profile-referral-url" class="profile-readonly-input" :value="referral.url" readonly />
                <button class="ui-button ui-button--blue" type="button" @click="copyReferralLink()">
                  <Icon :icon="iconCopy" class="ui-icon" aria-hidden="true" />
                  {{ t('pages.profile.copyReferralLink') }}
                </button>
              </div>
              <small class="profile-field-note">{{ t('pages.profile.referralHint') }}</small>
            </div>

            <StatusMessage v-if="referralMessage" variant="success">{{ referralMessage }}</StatusMessage>
            <StatusMessage v-if="referralErrorMessage" variant="danger">{{ referralErrorMessage }}</StatusMessage>
          </div>

          <StatusMessage v-else-if="referralErrorMessage" variant="danger" :duration="0">{{ referralErrorMessage }}</StatusMessage>
        </section>

        <section class="profile-card profile-card--password" :aria-label="t('pages.profile.passwordTitle')">
          <div class="profile-card__header">
            <Icon :icon="iconKey" class="profile-card__icon" aria-hidden="true" />
            <h2>{{ t('pages.profile.passwordTitle') }}</h2>
          </div>

          <form class="auth-form" @submit.prevent="savePassword">
            <div class="field">
              <label for="profile-current-password">{{ t('auth.currentPassword') }}</label>
              <input
                id="profile-current-password"
                v-model="currentPassword"
                autocomplete="current-password"
                required
                :disabled="passwordBusy"
                type="password"
              />
            </div>

            <div class="field">
              <label for="profile-new-password">{{ t('auth.newPassword') }}</label>
              <input
                id="profile-new-password"
                v-model="newPassword"
                autocomplete="new-password"
                minlength="8"
                required
                :disabled="passwordBusy"
                type="password"
              />
              <small class="profile-field-note">{{ t('pages.profile.passwordHint') }}</small>
            </div>

            <div class="field">
              <label for="profile-confirm-password">{{ t('auth.confirmPassword') }}</label>
              <input
                id="profile-confirm-password"
                v-model="confirmPassword"
                autocomplete="new-password"
                minlength="8"
                required
                :disabled="passwordBusy"
                type="password"
              />
            </div>

            <StatusMessage v-if="passwordMessage" variant="success">{{ passwordMessage }}</StatusMessage>
            <StatusMessage v-if="passwordErrorMessage" variant="danger">{{ passwordErrorMessage }}</StatusMessage>

            <button class="ui-button ui-button--primary" :disabled="passwordBusy" type="submit">
              <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
              {{ passwordBusy ? t('common.saving') : t('pages.profile.savePassword') }}
            </button>
          </form>
        </section>
      </section>
    </div>
  </section>
</template>
