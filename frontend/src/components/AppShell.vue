<script setup lang="ts">
import type { AuthUser } from '../services/api';
import PokeBallMark from './PokeBallMark.vue';

defineProps<{
  currentUser: AuthUser | null;
  navItems: Array<{ label: string; to: string }>;
}>();

defineEmits<{
  logout: [];
}>();
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

        <nav class="nav-links" aria-label="主导航">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="auth-actions">
          <template v-if="currentUser">
            <span class="auth-user">{{ currentUser.displayName || currentUser.email }}</span>
            <button class="ui-button ui-button--ghost ui-button--small" type="button" @click="$emit('logout')">退出</button>
          </template>
          <template v-else>
            <RouterLink class="ui-button ui-button--ghost ui-button--small" to="/login">登录</RouterLink>
            <RouterLink class="ui-button ui-button--primary ui-button--small" to="/register">注册</RouterLink>
          </template>
        </div>
      </div>
    </header>

    <main class="page">
      <slot></slot>
    </main>
  </div>
</template>
