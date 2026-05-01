<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { iconLogin, iconLogout, iconRegister, iconTranslate, type AppIcon } from '../icons';
import type { AuthUser, Language } from '../services/api';
import PokeBallMark from './PokeBallMark.vue';

defineProps<{
  currentUser: AuthUser | null;
  languages: Language[];
  locale: string;
  navItems: Array<{ label: string; to: string; icon?: AppIcon }>;
}>();

const emit = defineEmits<{
  logout: [];
  'update:locale': [value: string];
}>();

const { t } = useI18n();
const languageMenu = ref<HTMLElement | null>(null);
const languageMenuButton = ref<HTMLButtonElement | null>(null);
const languageMenuOpen = ref(false);

function closeLanguageMenu() {
  languageMenuOpen.value = false;
}

function toggleLanguageMenu() {
  languageMenuOpen.value = !languageMenuOpen.value;
}

function selectLocale(value: string) {
  emit('update:locale', value);
  closeLanguageMenu();
  languageMenuButton.value?.focus();
}

function onDocumentPointerDown(event: PointerEvent) {
  if (languageMenu.value && !languageMenu.value.contains(event.target as Node)) {
    closeLanguageMenu();
  }
}

function onLanguageMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeLanguageMenu();
    languageMenuButton.value?.focus();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
});
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <div class="container top-nav">
        <RouterLink class="brand-lockup" to="/pokemon" aria-label="Pokopia Wiki">
          <PokeBallMark size="42px" />
          <span>
            <span class="pokemon-word">Pokopia</span>
            <span class="brand-subtitle">Community Wiki</span>
          </span>
        </RouterLink>

        <nav class="nav-links" :aria-label="t('nav.main')">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
            <Icon v-if="item.icon" :icon="item.icon" class="ui-icon nav-links__icon" aria-hidden="true" />
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="auth-actions">
          <div ref="languageMenu" class="language-menu" @keydown="onLanguageMenuKeydown">
            <button
              ref="languageMenuButton"
              class="language-menu__trigger"
              type="button"
              :aria-label="t('nav.language')"
              :aria-expanded="languageMenuOpen"
              aria-haspopup="menu"
              @click="toggleLanguageMenu"
            >
              <Icon :icon="iconTranslate" class="language-menu__icon" aria-hidden="true" />
              <span class="language-menu__glyph" aria-hidden="true">文/A</span>
            </button>

            <div v-if="languageMenuOpen" class="language-menu__dropdown" role="menu">
              <button
                v-for="language in languages"
                :key="language.code"
                class="language-menu__item"
                :class="{ active: language.code === locale }"
                type="button"
                role="menuitemradio"
                :aria-checked="language.code === locale"
                @click="selectLocale(language.code)"
              >
                <span>{{ language.name }}</span>
                <span class="language-menu__code">{{ language.code }}</span>
              </button>
            </div>
          </div>
          <template v-if="currentUser">
            <span class="auth-user">{{ currentUser.displayName || currentUser.email }}</span>
            <button class="ui-button ui-button--ghost ui-button--small" type="button" @click="$emit('logout')">
              <Icon :icon="iconLogout" class="ui-icon" aria-hidden="true" />
              {{ t('nav.logout') }}
            </button>
          </template>
          <template v-else>
            <RouterLink class="ui-button ui-button--ghost ui-button--small" to="/login">
              <Icon :icon="iconLogin" class="ui-icon" aria-hidden="true" />
              {{ t('nav.login') }}
            </RouterLink>
            <RouterLink class="ui-button ui-button--primary ui-button--small" to="/register">
              <Icon :icon="iconRegister" class="ui-icon" aria-hidden="true" />
              {{ t('nav.register') }}
            </RouterLink>
          </template>
        </div>
      </div>
    </header>

    <main class="page">
      <slot></slot>
    </main>
  </div>
</template>
