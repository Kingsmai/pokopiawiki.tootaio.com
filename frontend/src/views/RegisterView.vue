<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../services/api';

const email = ref('');
const displayName = ref('');
const password = ref('');
const busy = ref(false);
const message = ref('');
const errorMessage = ref('');

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
    errorMessage.value = error instanceof Error && error.message ? error.message : '注册失败';
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
          <h1 class="page-title">注册</h1>
          <p class="page-subtitle">创建账号后需要完成邮箱验证</p>
        </div>
      </div>

      <form class="auth-form" @submit.prevent="submitRegister">
        <div class="field">
          <label for="register-email">邮箱</label>
          <input id="register-email" v-model="email" autocomplete="email" required type="email" />
        </div>

        <div class="field">
          <label for="register-display-name">显示名</label>
          <input id="register-display-name" v-model="displayName" autocomplete="nickname" maxlength="40" required />
        </div>

        <div class="field">
          <label for="register-password">密码</label>
          <input
            id="register-password"
            v-model="password"
            autocomplete="new-password"
            minlength="8"
            required
            type="password"
          />
        </div>

        <p v-if="message" class="auth-message">{{ message }}</p>
        <p v-if="errorMessage" class="auth-message error">{{ errorMessage }}</p>

        <button class="primary-button" :disabled="busy" type="submit">
          {{ busy ? '发送中' : '发送验证邮件' }}
        </button>
      </form>

      <p class="auth-switch">
        已有账号？
        <RouterLink to="/login">登录</RouterLink>
      </p>
    </div>
  </section>
</template>
