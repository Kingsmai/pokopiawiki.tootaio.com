<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import {
  iconChevronDown,
  iconChevronRight,
  iconClose,
  iconLogin,
  iconLogout,
  iconMenu,
  iconProfile,
  iconRegister,
  iconTranslate,
  type AppIcon
} from '../icons';
import type { AuthUser, Language } from '../services/api';
import NotificationBell from './NotificationBell.vue';
import PokeBallMark from './PokeBallMark.vue';
import StatusBadge from './StatusBadge.vue';

type NavBadge = {
  label: string;
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
};

type NavLinkItem = {
  label: string;
  to: string;
  icon?: AppIcon;
  badge?: NavBadge;
};

type NavGroupItem = {
  key: string;
  label: string;
  icon?: AppIcon;
  children: NavLinkItem[];
};

type NavItem = NavLinkItem | NavGroupItem;

type SidebarTooltip = {
  label: string;
  top: number;
  left: number;
};

defineProps<{
  currentUser: AuthUser | null;
  languages: Language[];
  locale: string;
  navItems: NavItem[];
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
const sideNav = ref<HTMLElement | null>(null);
const languageMenuOpen = ref(false);
const sidebarOpen = ref(false);
const sidebarCollapsed = ref(false);
const expandedNavGroups = ref<Set<string>>(new Set());
const sidebarTooltip = ref<SidebarTooltip | null>(null);
const sidebarTooltipTarget = ref<HTMLElement | null>(null);

function closeLanguageMenu() {
  languageMenuOpen.value = false;
}

function clearSidebarTooltipTarget() {
  sidebarTooltipTarget.value?.removeAttribute('aria-describedby');
}

function hideSidebarTooltip() {
  clearSidebarTooltipTarget();
  sidebarTooltipTarget.value = null;
  sidebarTooltip.value = null;
}

function closeSidebar() {
  sidebarOpen.value = false;
  closeLanguageMenu();
  hideSidebarTooltip();
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
  closeLanguageMenu();
  hideSidebarTooltip();
}

function toggleSidebarCollapsed() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  closeLanguageMenu();
  hideSidebarTooltip();
}

function toggleNavGroup(key: string) {
  const nextGroups = new Set(expandedNavGroups.value);
  if (nextGroups.has(key)) {
    nextGroups.delete(key);
  } else {
    nextGroups.add(key);
  }
  expandedNavGroups.value = nextGroups;
  closeLanguageMenu();
  hideSidebarTooltip();
}

function toggleLanguageMenu() {
  languageMenuOpen.value = !languageMenuOpen.value;
  hideSidebarTooltip();
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

function isDesktopSidebar() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 901px)').matches;
}

function canShowSidebarTooltip(collapsedOnly = true) {
  return isDesktopSidebar() && (!collapsedOnly || sidebarCollapsed.value);
}

function setSidebarTooltip(label: string, target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  clearSidebarTooltipTarget();
  sidebarTooltipTarget.value = target;
  target.setAttribute('aria-describedby', 'sidebar-tooltip');
  sidebarTooltip.value = {
    label,
    top: rect.top + rect.height / 2,
    left: rect.right + 10
  };
}

function showSidebarTooltip(label: string, event: MouseEvent | FocusEvent, collapsedOnly = true) {
  if (!canShowSidebarTooltip(collapsedOnly) || languageMenuOpen.value) {
    return;
  }

  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    setSidebarTooltip(label, target);
  }
}

function updateSidebarTooltipPosition() {
  const target = sidebarTooltipTarget.value;
  const currentTooltip = sidebarTooltip.value;
  if (!target || !currentTooltip || !canShowSidebarTooltip()) {
    hideSidebarTooltip();
    return;
  }

  if (sideNav.value?.contains(target)) {
    const navRect = sideNav.value.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (targetRect.bottom < navRect.top || targetRect.top > navRect.bottom) {
      hideSidebarTooltip();
      return;
    }
  }

  setSidebarTooltip(currentTooltip.label, target);
}

function isNavActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

function isNavGroup(item: NavItem): item is NavGroupItem {
  return 'children' in item;
}

function isNavGroupActive(item: NavGroupItem) {
  return item.children.some((child) => isNavActive(child.to));
}

function isNavGroupExpanded(item: NavGroupItem) {
  return expandedNavGroups.value.has(item.key) || isNavGroupActive(item);
}

function navItemKey(item: NavItem) {
  return isNavGroup(item) ? item.key : item.to;
}

watch(sidebarOpen, (open) => {
  document.body.classList.toggle('lock-scroll', open);
});

watch(sidebarCollapsed, (collapsed) => {
  if (!collapsed) {
    hideSidebarTooltip();
  }
});

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('resize', updateSidebarTooltipPosition);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  window.removeEventListener('resize', updateSidebarTooltipPosition);
  document.body.classList.remove('lock-scroll');
  hideSidebarTooltip();
});
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--sidebar-open': sidebarOpen,
      'app-shell--sidebar-collapsed': sidebarCollapsed
    }"
  >
    <header class="site-topbar">
      <div class="site-topbar__inner">
        <div class="site-topbar__brand">
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

          <RouterLink class="brand-lockup brand-lockup--topbar" to="/" aria-label="Pokopia Wiki" @click="closeSidebar">
            <PokeBallMark size="34px" />
            <span>
              <span class="pokemon-word">Pokopia</span>
              <span class="brand-subtitle">Community Wiki</span>
            </span>
          </RouterLink>
        </div>

        <div class="site-topbar__spacer" aria-hidden="true"></div>

        <div class="topbar-actions">
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
            <NotificationBell :current-user="currentUser" />
            <RouterLink class="auth-user" to="/profile" :aria-label="t('nav.profile')" @click="closeSidebar">
              <Icon :icon="iconProfile" class="ui-icon auth-user__icon" aria-hidden="true" />
              <span class="auth-user__name">{{ currentUser.displayName || currentUser.email }}</span>
            </RouterLink>
            <button
              class="ui-button ui-button--ghost ui-button--small topbar-actions__icon-button"
              type="button"
              :aria-label="t('nav.logout')"
              @click="requestLogout"
            >
              <Icon :icon="iconLogout" class="ui-icon" aria-hidden="true" />
            </button>
          </template>

          <template v-else>
            <RouterLink
              class="ui-button ui-button--ghost ui-button--small topbar-actions__icon-button"
              to="/login"
              :aria-label="t('nav.login')"
              @click="closeSidebar"
            >
              <Icon :icon="iconLogin" class="ui-icon" aria-hidden="true" />
            </RouterLink>
            <RouterLink
              class="ui-button ui-button--primary ui-button--small topbar-actions__icon-button"
              to="/register"
              :aria-label="t('nav.register')"
              @click="closeSidebar"
            >
              <Icon :icon="iconRegister" class="ui-icon" aria-hidden="true" />
            </RouterLink>
          </template>
        </div>
      </div>
    </header>

    <button class="site-sidebar-scrim" type="button" :aria-label="t('nav.closeMenu')" @click="closeSidebar"></button>

    <aside id="app-sidebar" class="site-sidebar" :aria-label="t('nav.main')">
      <div class="site-sidebar__inner">
        <div class="site-sidebar__header">
          <RouterLink class="brand-lockup" to="/" aria-label="Pokopia Wiki" @click="closeSidebar">
            <PokeBallMark size="42px" />
            <span>
              <span class="pokemon-word">Pokopia</span>
              <span class="brand-subtitle">Community Wiki</span>
            </span>
          </RouterLink>

          <button
            class="sidebar-collapse-toggle"
            type="button"
            :aria-label="sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')"
            :aria-expanded="!sidebarCollapsed"
            aria-controls="app-sidebar"
            @focus="showSidebarTooltip(sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar'), $event, false)"
            @blur="hideSidebarTooltip"
            @pointerenter="showSidebarTooltip(sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar'), $event, false)"
            @pointerleave="hideSidebarTooltip"
            @click="toggleSidebarCollapsed"
          >
            <Icon
              :icon="iconChevronRight"
              class="ui-icon sidebar-collapse-toggle__icon"
              :class="{ 'sidebar-collapse-toggle__icon--expanded': !sidebarCollapsed }"
              aria-hidden="true"
            />
          </button>
        </div>

        <nav ref="sideNav" class="side-nav" :aria-label="t('nav.main')" @scroll="updateSidebarTooltipPosition">
          <template v-for="item in navItems" :key="navItemKey(item)">
            <div v-if="isNavGroup(item)" class="side-nav__group" :class="{ 'side-nav__group--active': isNavGroupActive(item) }">
              <button
                class="side-nav__link side-nav__group-trigger"
                :class="{ 'router-link-active': isNavGroupActive(item) }"
                type="button"
                :aria-expanded="isNavGroupExpanded(item)"
                :aria-controls="`side-nav-group-${item.key}`"
                :aria-label="item.label"
                @focus="showSidebarTooltip(item.label, $event)"
                @blur="hideSidebarTooltip"
                @pointerenter="showSidebarTooltip(item.label, $event)"
                @pointerleave="hideSidebarTooltip"
                @click="toggleNavGroup(item.key)"
              >
                <Icon v-if="item.icon" :icon="item.icon" class="ui-icon side-nav__icon" aria-hidden="true" />
                <span class="side-nav__label">{{ item.label }}</span>
                <Icon
                  :icon="isNavGroupExpanded(item) ? iconChevronDown : iconChevronRight"
                  class="ui-icon side-nav__chevron"
                  aria-hidden="true"
                />
              </button>
              <div v-if="isNavGroupExpanded(item)" :id="`side-nav-group-${item.key}`" class="side-nav__children">
                <RouterLink
                  v-for="child in item.children"
                  :key="child.to"
                  class="side-nav__link side-nav__link--child"
                  :class="{ 'router-link-active': isNavActive(child.to) }"
                  :to="child.to"
                  :aria-label="child.label"
                  @focus="showSidebarTooltip(child.label, $event)"
                  @blur="hideSidebarTooltip"
                  @pointerenter="showSidebarTooltip(child.label, $event)"
                  @pointerleave="hideSidebarTooltip"
                  @click="closeSidebar"
                >
                  <Icon v-if="child.icon" :icon="child.icon" class="ui-icon side-nav__icon" aria-hidden="true" />
                  <span class="side-nav__label">{{ child.label }}</span>
                  <StatusBadge
                    v-if="child.badge"
                    class="side-nav__badge"
                    :label="child.badge.label"
                    :tone="child.badge.tone"
                    compact
                  />
                </RouterLink>
              </div>
            </div>

            <RouterLink
              v-else
              class="side-nav__link"
              :class="{ 'router-link-active': isNavActive(item.to) }"
              :to="item.to"
              :aria-label="item.label"
              @focus="showSidebarTooltip(item.label, $event)"
              @blur="hideSidebarTooltip"
              @pointerenter="showSidebarTooltip(item.label, $event)"
              @pointerleave="hideSidebarTooltip"
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
          </template>
        </nav>
      </div>
    </aside>

    <div
      v-if="sidebarTooltip"
      id="sidebar-tooltip"
      class="sidebar-tooltip"
      role="tooltip"
      :style="{ top: `${sidebarTooltip.top}px`, left: `${sidebarTooltip.left}px` }"
    >
      {{ sidebarTooltip.label }}
    </div>

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
