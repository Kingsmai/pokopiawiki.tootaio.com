<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, getAuthToken, onAuthTokenChange, setAuthToken, type AuthUser } from './services/api';

const navItems = [
  { label: 'Pokemon', to: '/pokemon' },
  { label: '栖息地', to: '/habitats' },
  { label: '物品 / 材料单', to: '/items' },
  { label: '管理', to: '/admin' }
];

const router = useRouter();
const currentUser = ref<AuthUser | null>(null);
let removeAuthListener: (() => void) | null = null;

async function loadCurrentUser() {
  if (!getAuthToken()) {
    currentUser.value = null;
    return;
  }

  try {
    const response = await api.me();
    currentUser.value = response.user;
  } catch {
    currentUser.value = null;
    setAuthToken(null);
  }
}

async function logout() {
  try {
    await api.logout();
  } catch {
    // The local session is cleared even when the server session is already gone.
  }

  currentUser.value = null;
  setAuthToken(null);
  await router.push('/pokemon');
}

onMounted(() => {
  void loadCurrentUser();
  removeAuthListener = onAuthTokenChange(() => {
    void loadCurrentUser();
  });
});

onUnmounted(() => {
  removeAuthListener?.();
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-main">
        <RouterLink class="brand" to="/pokemon">Pokopia Wiki</RouterLink>
        <nav class="nav-tabs" aria-label="主导航">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>

      <div class="auth-actions">
        <template v-if="currentUser">
          <span class="auth-user">{{ currentUser.displayName || currentUser.email }}</span>
          <button class="plain-button" type="button" @click="logout">退出</button>
        </template>
        <template v-else>
          <RouterLink to="/login">登录</RouterLink>
          <RouterLink to="/register">注册</RouterLink>
        </template>
      </div>
    </header>

    <main class="page">
      <RouterView />
    </main>
  </div>
</template>
