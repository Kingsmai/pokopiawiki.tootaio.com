<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PageHeader from '../components/PageHeader.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { iconMail } from '../icons';
import { api } from '../services/api';

const { t } = useI18n();
const email = ref('');
const busy = ref(false);
const message = ref('');
const errorMessage = ref('');

async function submitResetRequest() {
  busy.value = true;
  message.value = '';
  errorMessage.value = '';

  try {
    const response = await api.requestPasswordReset({ email: email.value });
    message.value = response.message;
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('auth.requestResetFailed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-panel">
      <PageHeader :title="t('auth.requestResetTitle')" :subtitle="t('auth.requestResetSubtitle')">
        <template #kicker>{{ t('auth.accountAccess') }}</template>
      </PageHeader>

      <form class="auth-form" @submit.prevent="submitResetRequest">
        <div class="field">
          <label for="forgot-password-email">{{ t('auth.email') }}</label>
          <input id="forgot-password-email" v-model="email" autocomplete="email" required type="email" />
        </div>

        <StatusMessage v-if="message" variant="success">{{ message }}</StatusMessage>
        <StatusMessage v-if="errorMessage" variant="danger">{{ errorMessage }}</StatusMessage>

        <button class="ui-button ui-button--primary" :disabled="busy" type="submit">
          <Icon :icon="iconMail" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('auth.sending') : t('auth.sendResetLink') }}
        </button>
      </form>

      <p class="auth-switch">
        <RouterLink to="/login">{{ t('auth.goLogin') }}</RouterLink>
      </p>
    </div>
  </section>
</template>
