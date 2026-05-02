<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PageHeader from '../components/PageHeader.vue';
import Skeleton from '../components/Skeleton.vue';
import StatusBadge from '../components/StatusBadge.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { iconProfile, iconSave } from '../icons';
import { api, notifyAuthChange, type AuthUser } from '../services/api';

const { t } = useI18n();
const user = ref<AuthUser | null>(null);
const displayName = ref('');
const loading = ref(true);
const busy = ref(false);
const message = ref('');
const errorMessage = ref('');

const trimmedDisplayName = computed(() => displayName.value.trim());
const hasChanges = computed(() => {
  const currentUser = user.value;
  if (!currentUser) return false;
  return trimmedDisplayName.value !== currentUser.displayName;
});
const profileInitial = computed(() => {
  const name = user.value?.displayName.trim() || user.value?.email.trim() || '';
  return name.charAt(0).toUpperCase();
});

async function loadProfile() {
  loading.value = true;
  message.value = '';
  errorMessage.value = '';

  try {
    const response = await api.me();
    user.value = response.user;
    displayName.value = response.user.displayName;
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('errors.loadFailed');
  } finally {
    loading.value = false;
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
    user.value = response.user;
    displayName.value = response.user.displayName;
    message.value = t('pages.profile.saved');
    notifyAuthChange();
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('pages.profile.saveFailed');
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void loadProfile();
});
</script>

<template>
  <section class="profile-page">
    <PageHeader :title="t('pages.profile.title')" :subtitle="t('pages.profile.subtitle')">
      <template #kicker>{{ t('auth.accountAccess') }}</template>
    </PageHeader>

    <div v-if="loading" class="profile-layout" aria-busy="true" :aria-label="t('pages.profile.loading')">
      <section class="profile-card profile-card--identity" aria-hidden="true">
        <div class="profile-identity">
          <Skeleton variant="box" width="58px" height="58px" />
          <div class="profile-identity__copy">
            <Skeleton width="160px" height="28px" />
            <Skeleton width="220px" />
          </div>
        </div>
      </section>
      <section class="profile-card" aria-hidden="true">
        <Skeleton width="180px" height="28px" />
        <div class="auth-form">
          <div class="field">
            <Skeleton width="110px" />
            <Skeleton variant="box" height="44px" />
          </div>
          <div class="field">
            <Skeleton width="70px" />
            <Skeleton variant="box" height="44px" />
          </div>
          <Skeleton variant="box" width="120px" height="42px" />
        </div>
      </section>
    </div>

    <div v-else-if="user" class="profile-layout">
      <section class="profile-card profile-card--identity" :aria-label="t('pages.profile.accountSummary')">
        <div class="profile-identity">
          <div class="profile-avatar" aria-hidden="true">{{ profileInitial }}</div>
          <div class="profile-identity__copy">
            <h2>{{ user.displayName }}</h2>
            <p>{{ user.email }}</p>
          </div>
        </div>
        <StatusBadge
          :label="user.emailVerified ? t('pages.profile.emailVerified') : t('pages.profile.emailUnverified')"
          :tone="user.emailVerified ? 'success' : 'warning'"
        />
      </section>

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
            <input id="profile-email" class="profile-readonly-input" :value="user.email" readonly type="email" />
          </div>

          <StatusMessage v-if="message" variant="success">{{ message }}</StatusMessage>
          <StatusMessage v-if="errorMessage" variant="danger">{{ errorMessage }}</StatusMessage>

          <button class="ui-button ui-button--primary" :disabled="busy || !hasChanges" type="submit">
            <Icon :icon="iconSave" class="ui-icon" aria-hidden="true" />
            {{ busy ? t('common.saving') : t('common.save') }}
          </button>
        </form>
      </section>
    </div>

    <StatusMessage v-else-if="errorMessage" variant="danger" :duration="0">{{ errorMessage }}</StatusMessage>
  </section>
</template>
