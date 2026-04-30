<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from './components/AppShell.vue';
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
  <AppShell :current-user="currentUser" :nav-items="navItems" @logout="logout">
    <RouterView />
  </AppShell>
</template>
