<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { iconClose, iconLogin, iconLogout, iconMenu, iconProfile, iconRegister, iconTranslate, type AppIcon } from '../icons';
import type { AuthUser, Language } from '../services/api';
import PokeBallMark from './PokeBallMark.vue';
import StatusBadge from './StatusBadge.vue';

defineProps<{
  currentUser: AuthUser | null;
  languages: Language[];
  locale: string;
  navItems: Array<{
    label: string;
    to: string;
    icon?: AppIcon;
    badge?: {
      label: string;
      tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
    };
  }>;
}>();

const emit = defineEmits<{
  logout: [];
  'update:locale': [value: string];
}>();

const { t } = useI18n();
const route = useRoute();
const copyrightYear = new Date().getFullYear();
const languageMenu = ref<HTMLElement | null>(null);
const languageMenuButton = ref<HTMLButtonElement | null>(null);
const languageMenuOpen = ref(false);
const sidebarOpen = ref(false);

function closeLanguageMenu() {
  languageMenuOpen.value = false;
}

function closeSidebar() {
  sidebarOpen.value = false;
  closeLanguageMenu();
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
  closeLanguageMenu();
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

function requestLogout() {
  closeSidebar();
  emit('logout');
}

function isNavActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

watch(sidebarOpen, (open) => {
  document.body.classList.toggle('lock-scroll', open);
});

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.body.classList.remove('lock-scroll');
});
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--sidebar-open': sidebarOpen }">
    <header class="mobile-topbar">
      <button
        class="sidebar-toggle"
        type="button"
        :aria-label="sidebarOpen ? t('nav.closeMenu') : t('nav.openMenu')"
        :aria-expanded="sidebarOpen"
        aria-controls="app-sidebar"
        @click="toggleSidebar"
      >
        <Icon :icon="sidebarOpen ? iconClose : iconMenu" class="ui-icon" aria-hidden="true" />
      </button>

      <RouterLink class="brand-lockup brand-lockup--mobile" to="/" aria-label="Pokopia Wiki" @click="closeSidebar">
        <PokeBallMark size="34px" />
        <span>
          <span class="pokemon-word">Pokopia</span>
          <span class="brand-subtitle">Community Wiki</span>
        </span>
      </RouterLink>
    </header>

    <button class="site-sidebar-scrim" type="button" :aria-label="t('nav.closeMenu')" @click="closeSidebar"></button>

    <aside id="app-sidebar" class="site-sidebar" :aria-label="t('nav.main')">
      <div class="site-sidebar__inner">
        <RouterLink class="brand-lockup" to="/" aria-label="Pokopia Wiki" @click="closeSidebar">
          <PokeBallMark size="42px" />
          <span>
            <span class="pokemon-word">Pokopia</span>
            <span class="brand-subtitle">Community Wiki</span>
          </span>
        </RouterLink>

        <nav class="side-nav" :aria-label="t('nav.main')">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            class="side-nav__link"
            :class="{ 'router-link-active': isNavActive(item.to) }"
            :to="item.to"
            @click="closeSidebar"
          >
            <Icon v-if="item.icon" :icon="item.icon" class="ui-icon side-nav__icon" aria-hidden="true" />
            <span class="side-nav__label">{{ item.label }}</span>
            <StatusBadge
              v-if="item.badge"
              class="side-nav__badge"
              :label="item.badge.label"
              :tone="item.badge.tone"
              compact
            />
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
            <RouterLink class="auth-user" to="/profile" :aria-label="t('nav.profile')" @click="closeSidebar">
              <Icon :icon="iconProfile" class="ui-icon auth-user__icon" aria-hidden="true" />
              <span class="auth-user__name">{{ currentUser.displayName || currentUser.email }}</span>
            </RouterLink>
            <button class="ui-button ui-button--ghost ui-button--small" type="button" @click="requestLogout">
              <Icon :icon="iconLogout" class="ui-icon" aria-hidden="true" />
              {{ t('nav.logout') }}
            </button>
          </template>
          <template v-else>
            <RouterLink class="ui-button ui-button--ghost ui-button--small" to="/login" @click="closeSidebar">
              <Icon :icon="iconLogin" class="ui-icon" aria-hidden="true" />
              {{ t('nav.login') }}
            </RouterLink>
            <RouterLink class="ui-button ui-button--primary ui-button--small" to="/register" @click="closeSidebar">
              <Icon :icon="iconRegister" class="ui-icon" aria-hidden="true" />
              {{ t('nav.register') }}
            </RouterLink>
          </template>
        </div>
      </div>
    </aside>

    <main class="page">
      <slot></slot>
    </main>

    <footer class="site-footer">
      <div class="site-footer__inner">
        <p class="site-footer__copyright">
          {{ t('legal.footer.copyright', { year: copyrightYear }) }}
        </p>
        <nav class="site-footer__links" :aria-label="t('legal.footer.linksLabel')">
          <RouterLink to="/privacy-policy" @click="closeSidebar">{{ t('legal.footer.privacy') }}</RouterLink>
          <RouterLink to="/terms-of-service" @click="closeSidebar">{{ t('legal.footer.terms') }}</RouterLink>
          <RouterLink to="/disclaimers" @click="closeSidebar">{{ t('legal.footer.disclaimers') }}</RouterLink>
        </nav>
        <p class="site-footer__notice">{{ t('legal.footer.notice') }}</p>
      </div>
    </footer>
  </div>
</template>
