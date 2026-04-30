<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../services/api';

const route = useRoute();
const busy = ref(true);
const message = ref('');
const errorMessage = ref('');

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : '';

  if (!token) {
    busy.value = false;
    errorMessage.value = '验证链接无效或已过期';
    return;
  }

  try {
    const response = await api.verifyEmail(token);
    message.value = response.message;
  } catch (error) {
    errorMessage.value = error instanceof Error && error.message ? error.message : '邮箱验证失败';
  } finally {
    busy.value = false;
  }
});
</script>

<template>
  <section class="auth-page">
    <div class="auth-panel">
      <div class="page-header">
        <div>
          <h1 class="page-title">邮箱验证</h1>
          <p class="page-subtitle">完成验证后即可登录</p>
        </div>
      </div>

      <p v-if="busy" class="auth-message">正在验证邮箱</p>
      <p v-else-if="message" class="auth-message">{{ message }}</p>
      <p v-else class="auth-message error">{{ errorMessage }}</p>

      <RouterLink class="primary-button" to="/login">去登录</RouterLink>
    </div>
  </section>
</template>
