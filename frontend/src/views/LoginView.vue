<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, setAuthToken } from '../services/api';

const route = useRoute();
const router = useRouter();
const email = ref('');
const password = ref('');
const busy = ref(false);
const errorMessage = ref('');

async function submitLogin() {
  busy.value = true;
  errorMessage.value = '';

  try {
    const response = await api.login({
      email: email.value,
      password: password.value
    });
    setAuthToken(response.token);

    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/pokemon';
    await router.push(redirect);
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : '登录失败';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-panel">
      <div class="page-header">
        <div>
          <h1 class="page-title">登录</h1>
          <p class="page-subtitle">使用已验证邮箱进入 Pokopia Wiki</p>
        </div>
      </div>

      <form class="auth-form" @submit.prevent="submitLogin">
        <div class="field">
          <label for="login-email">邮箱</label>
          <input id="login-email" v-model="email" autocomplete="email" required type="email" />
        </div>

        <div class="field">
          <label for="login-password">密码</label>
          <input id="login-password" v-model="password" autocomplete="current-password" required type="password" />
        </div>

        <p v-if="errorMessage" class="auth-message error">{{ errorMessage }}</p>

        <button class="primary-button" :disabled="busy" type="submit">
          {{ busy ? '登录中' : '登录' }}
        </button>
      </form>

      <p class="auth-switch">
        还没有账号？
        <RouterLink to="/register">注册</RouterLink>
      </p>
    </div>
  </section>
</template>
