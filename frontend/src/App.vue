<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import AppShell from './components/AppShell.vue';
import {
  iconAction,
  iconAdmin,
  iconArtifact,
  iconAutomation,
  iconChecklist,
  iconClothes,
  iconDish,
  iconDreamIsland,
  iconEvent,
  iconHabitat,
  iconHome,
  iconItem,
  iconLife,
  iconPokemon,
  iconRecipe
} from './icons';
import { getCurrentLocale, loadSystemWordings, onLocaleChange, setCurrentLocale } from './i18n';
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

function inDevBadge() {
  return { label: t('common.inDev'), tone: 'info' as const };
}

function can(permissionKey: string) {
  return currentUser.value?.permissions.includes(permissionKey) === true;
}

const navItems = computed(() => {
  const items = [
    { label: t('nav.home'), to: '/', icon: iconHome },
    { label: t('nav.pokemon'), to: '/pokemon', icon: iconPokemon },
    { label: t('nav.eventPokemon'), to: '/event-pokemon', icon: iconEvent },
    { label: t('nav.habitats'), to: '/habitats', icon: iconHabitat },
    { label: t('nav.eventHabitats'), to: '/event-habitats', icon: iconEvent },
    { label: t('nav.items'), to: '/items', icon: iconItem },
    { label: t('nav.eventItems'), to: '/event-items', icon: iconEvent },
    { label: t('nav.ancientArtifacts'), to: '/ancient-artifacts', icon: iconArtifact },
    { label: t('nav.recipes'), to: '/recipes', icon: iconRecipe },
    { label: t('nav.automation'), to: '/automation', icon: iconAutomation, badge: inDevBadge() },
    { label: t('nav.dish'), to: '/dish', icon: iconDish, badge: inDevBadge() },
    { label: t('nav.events'), to: '/events', icon: iconEvent, badge: inDevBadge() },
    { label: t('nav.actions'), to: '/actions', icon: iconAction, badge: inDevBadge() },
    { label: t('nav.dreamIsland'), to: '/dream-island', icon: iconDreamIsland, badge: inDevBadge() },
    { label: t('nav.clothes'), to: '/clothes', icon: iconClothes, badge: inDevBadge() },
    { label: t('nav.checklist'), to: '/checklist', icon: iconChecklist },
    { label: t('nav.life'), to: '/life', icon: iconLife }
  ];

  if (can('admin.access')) {
    items.push({ label: t('nav.admin'), to: '/admin', icon: iconAdmin });
  }

  return items;
});

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
  await router.push('/');
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

    await loadSystemWordings(getCurrentLocale());
  } catch {
    // Keep the built-in language list when the API is not ready yet.
  }
}

async function updateLocale(value: string) {
  await loadSystemWordings(value);
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
