<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AuthUser, Language } from '../services/api';
import PokeBallMark from './PokeBallMark.vue';

defineProps<{
  currentUser: AuthUser | null;
  languages: Language[];
  locale: string;
  navItems: Array<{ label: string; to: string }>;
}>();

const emit = defineEmits<{
  logout: [];
  'update:locale': [value: string];
}>();

const { t } = useI18n();
const translateIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="m12.65 15.65l-2.85-2.8q.7-.8 1.225-1.75t.825-2.1H15V7h-5V5H8v2H3v2h6.95q-.275.8-.687 1.5T8.3 11.8q-.5-.55-.875-1.125T6.8 9h-2q.35.95.913 1.763T7 13.2l-5.65 5.55L2.75 20l5.55-5.55l3.45 3.4zm5.1 4.35L17 18h-3.5l-.75 2h-2l3.5-9h2l3.5 9zm-2.15-4h2.8L17 12.25z"/>'
};
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
              <Icon :icon="translateIcon" class="language-menu__icon" aria-hidden="true" />
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
              {{ t('nav.logout') }}
            </button>
          </template>
          <template v-else>
            <RouterLink class="ui-button ui-button--ghost ui-button--small" to="/login">{{ t('nav.login') }}</RouterLink>
            <RouterLink class="ui-button ui-button--primary ui-button--small" to="/register">{{ t('nav.register') }}</RouterLink>
          </template>
        </div>
      </div>
    </header>

    <main class="page">
      <slot></slot>
    </main>
  </div>
</template>
