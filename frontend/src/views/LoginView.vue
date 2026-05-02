<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import StatusMessage from '../components/StatusMessage.vue';
import { iconLogin } from '../icons';
import { api, setAuthToken } from '../services/api';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const email = ref('');
const password = ref('');
const rememberMe = ref(false);
const busy = ref(false);
const errorMessage = ref('');

async function submitLogin() {
  busy.value = true;
  errorMessage.value = '';

  try {
    const response = await api.login({
      email: email.value,
      password: password.value,
      rememberMe: rememberMe.value
    });
    setAuthToken(response.token, { persistent: rememberMe.value });

    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/pokemon';
    await router.push(redirect);
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : t('auth.loginFailed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-panel">
      <PageHeader :title="t('auth.loginTitle')" :subtitle="t('auth.loginSubtitle')">
        <template #kicker>{{ t('auth.accountAccess') }}</template>
      </PageHeader>

      <form class="auth-form" @submit.prevent="submitLogin">
        <div class="field">
          <label for="login-email">{{ t('auth.email') }}</label>
          <input id="login-email" v-model="email" autocomplete="email" required type="email" />
        </div>

        <div class="field">
          <label for="login-password">{{ t('auth.password') }}</label>
          <input id="login-password" v-model="password" autocomplete="current-password" required type="password" />
        </div>

        <div class="auth-options">
          <label class="check-row auth-options__remember">
            <input v-model="rememberMe" type="checkbox" />
            {{ t('auth.rememberMe') }}
          </label>
          <RouterLink to="/forgot-password">{{ t('auth.forgotPassword') }}</RouterLink>
        </div>

        <StatusMessage v-if="errorMessage" variant="danger">{{ errorMessage }}</StatusMessage>

        <button class="ui-button ui-button--primary" :disabled="busy" type="submit">
          <Icon :icon="iconLogin" class="ui-icon" aria-hidden="true" />
          {{ busy ? t('auth.loggingIn') : t('nav.login') }}
        </button>
      </form>

      <p class="auth-switch">
        {{ t('auth.noAccount') }}
        <RouterLink to="/register">{{ t('nav.register') }}</RouterLink>
      </p>
    </div>
  </section>
</template>
