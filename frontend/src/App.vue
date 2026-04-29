<script setup lang="ts">
const navItems = [
  { label: 'Pokemon', to: '/pokemon' },
  { label: '栖息地', to: '/habitats' },
  { label: '物品 / 材料单', to: '/items' }
];
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/pokemon">Pokopia Wiki</RouterLink>
      <nav class="nav-tabs" aria-label="主导航">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
          {{ item.label }}
        </RouterLink>
      </nav>
    </header>

    <main class="page">
      <RouterView />
    </main>
  </div>
</template>
