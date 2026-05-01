<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PageHeader from '../components/PageHeader.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { api } from '../services/api';

const email = ref('');
const displayName = ref('');
const password = ref('');
const busy = ref(false);
const message = ref('');
const errorMessage = ref('');
const { t } = useI18n();

async function submitRegister() {
  busy.value = true;
  message.value = '';
  errorMessage.value = '';

  try {
    const response = await api.register({
      email: email.value,
      displayName: displayName.value,
      password: password.value
    });
    message.value = response.message;
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('auth.registerFailed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-panel">
      <PageHeader :title="t('auth.registerTitle')" :subtitle="t('auth.registerSubtitle')">
        <template #kicker>Trainer Pass</template>
      </PageHeader>

      <form class="auth-form" @submit.prevent="submitRegister">
        <div class="field">
          <label for="register-email">{{ t('auth.email') }}</label>
          <input id="register-email" v-model="email" autocomplete="email" required type="email" />
        </div>

        <div class="field">
          <label for="register-display-name">{{ t('auth.displayName') }}</label>
          <input id="register-display-name" v-model="displayName" autocomplete="nickname" maxlength="40" required />
        </div>

        <div class="field">
          <label for="register-password">{{ t('auth.password') }}</label>
          <input
            id="register-password"
            v-model="password"
            autocomplete="new-password"
            minlength="8"
            required
            type="password"
          />
        </div>

        <StatusMessage v-if="message" variant="success">{{ message }}</StatusMessage>
        <StatusMessage v-if="errorMessage" variant="danger">{{ errorMessage }}</StatusMessage>

        <button class="ui-button ui-button--primary" :disabled="busy" type="submit">
          {{ busy ? t('auth.sending') : t('auth.sendVerification') }}
        </button>
      </form>

      <p class="auth-switch">
        {{ t('auth.hasAccount') }}
        <RouterLink to="/login">{{ t('nav.login') }}</RouterLink>
      </p>
    </div>
  </section>
</template>
