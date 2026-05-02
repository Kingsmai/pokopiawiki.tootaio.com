<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { iconKey, iconLogin } from '../icons';
import { api } from '../services/api';

const { t } = useI18n();
const route = useRoute();
const password = ref('');
const confirmPassword = ref('');
const busy = ref(false);
const message = ref('');
const errorMessage = ref('');

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));

async function submitPasswordReset() {
  message.value = '';
  errorMessage.value = '';

  if (!token.value) {
    errorMessage.value = t('auth.invalidPasswordReset');
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = t('auth.passwordMismatch');
    return;
  }

  busy.value = true;

  try {
    const response = await api.resetPassword({ token: token.value, password: password.value });
    message.value = response.message;
    password.value = '';
    confirmPassword.value = '';
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('auth.resetFailed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-panel">
      <PageHeader :title="t('auth.resetTitle')" :subtitle="t('auth.resetSubtitle')">
        <template #kicker>{{ t('auth.accountAccess') }}</template>
      </PageHeader>

      <form v-if="!message" class="auth-form" @submit.prevent="submitPasswordReset">
        <div class="field">
          <label for="reset-password">{{ t('auth.newPassword') }}</label>
          <input
            id="reset-password"
            v-model="password"
            autocomplete="new-password"
            minlength="8"
            required
            type="password"
          />
        </div>

        <div class="field">
          <label for="reset-password-confirm">{{ t('auth.confirmPassword') }}</label>
          <input
            id="reset-password-confirm"
            v-model="confirmPassword"
            autocomplete="new-password"
            minlength="8"
            required
            type="password"
          />
        </div>

        <StatusMessage v-if="errorMessage" variant="danger">{{ errorMessage }}</StatusMessage>

        <button class="ui-button ui-button--primary" :disabled="busy" type="submit">
          <Icon :icon="iconKey" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('auth.resetting') : t('auth.resetPassword') }}
        </button>
      </form>

      <StatusMessage v-else variant="success">{{ message }}</StatusMessage>

      <RouterLink v-if="message" class="ui-button ui-button--ghost" to="/login">
        <Icon :icon="iconLogin" class="ui-icon" aria-hidden="true" />
        {{ t('auth.goLogin') }}
      </RouterLink>
    </div>
  </section>
</template>
