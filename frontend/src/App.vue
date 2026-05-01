<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import AppShell from './components/AppShell.vue';
import { getCurrentLocale, onLocaleChange, setCurrentLocale } from './i18n';
import { api, getAuthToken, onAuthTokenChange, setAuthToken, type AuthUser, type Language } from './services/api';

const { t, locale } = useI18n();

const router = useRouter();
const currentUser = ref<AuthUser | null>(null);
const languages = ref<Language[]>([
  { code: 'en', name: 'English', enabled: true, isDefault: true, sortOrder: 10 },
  { code: 'zh-CN', name: '简体中文', enabled: true, isDefault: false, sortOrder: 20 }
]);
let removeAuthListener: (() => void) | null = null;
let removeLocaleListener: (() => void) | null = null;

const navItems = computed(() => [
  { label: t('nav.pokemon'), to: '/pokemon' },
  { label: t('nav.habitats'), to: '/habitats' },
  { label: t('nav.items'), to: '/items' },
  { label: t('nav.recipes'), to: '/recipes' },
  { label: t('nav.checklist'), to: '/checklist' },
  { label: t('nav.admin'), to: '/admin' }
]);

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

async function loadLanguages() {
  try {
    const loadedLanguages = await api.languages();
    if (loadedLanguages.length) {
      languages.value = loadedLanguages;
    }

    if (!languages.value.some((language) => language.code === getCurrentLocale() && language.enabled)) {
      setCurrentLocale('en');
    }
  } catch {
    // Keep the built-in language list when the API is not ready yet.
  }
}

function updateLocale(value: string) {
  setCurrentLocale(value);
}

onMounted(() => {
  void loadLanguages();
  void loadCurrentUser();
  removeAuthListener = onAuthTokenChange(() => {
    void loadCurrentUser();
  });
  removeLocaleListener = onLocaleChange(() => {
    void loadLanguages();
  });
});

onUnmounted(() => {
  removeAuthListener?.();
  removeLocaleListener?.();
});
</script>

<template>
  <AppShell
    :current-user="currentUser"
    :languages="languages"
    :locale="locale"
    :nav-items="navItems"
    @logout="logout"
    @update:locale="updateLocale"
  >
    <RouterView :key="locale" />
  </AppShell>
</template>
