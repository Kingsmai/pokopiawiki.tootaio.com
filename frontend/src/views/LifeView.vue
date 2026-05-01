<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { iconCancel, iconDelete, iconEdit, iconLife, iconSave } from '../icons';
import {
  api,
  getAuthToken,
  onAuthTokenChange,
  setAuthToken,
  type AuthUser,
  type LifePost
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
const bodyInput = ref<HTMLTextAreaElement | null>(null);
const skeletonPostCount = 3;
let removeAuthListener: (() => void) | null = null;

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
      posts.value = posts.value.map((post) => (post.id === updated.id ? updated : post));
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
        </article>
      </div>

      <p v-else class="status">{{ t('pages.life.empty') }}</p>
    </section>
  </section>
</template>
