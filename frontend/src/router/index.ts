import { createRouter, createWebHistory } from 'vue-router';
import PokemonList from '../views/PokemonList.vue';
import PokemonDetail from '../views/PokemonDetail.vue';
import HabitatList from '../views/HabitatList.vue';
import HabitatDetail from '../views/HabitatDetail.vue';
import ItemsList from '../views/ItemsList.vue';
import ItemDetail from '../views/ItemDetail.vue';
import RecipeList from '../views/RecipeList.vue';
import RecipeDetail from '../views/RecipeDetail.vue';
import DailyChecklistView from '../views/DailyChecklistView.vue';
import LifeView from '../views/LifeView.vue';
import ComingSoonView from '../views/ComingSoonView.vue';
import AdminView from '../views/AdminView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import VerifyEmailView from '../views/VerifyEmailView.vue';
import { api, getAuthToken, setAuthToken } from '../services/api';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/pokemon' },
    { path: '/pokemon', name: 'pokemon-list', component: PokemonList },
    { path: '/pokemon/new', name: 'pokemon-new', component: PokemonList, meta: { requiresVerified: true, editorModal: true } },
    { path: '/pokemon/:id/edit', name: 'pokemon-edit', component: PokemonDetail, meta: { requiresVerified: true, editorModal: true } },
    { path: '/pokemon/:id', name: 'pokemon-detail', component: PokemonDetail },
    { path: '/habitats', name: 'habitat-list', component: HabitatList },
    { path: '/habitats/new', name: 'habitat-new', component: HabitatList, meta: { requiresVerified: true, editorModal: true } },
    { path: '/habitats/:id/edit', name: 'habitat-edit', component: HabitatDetail, meta: { requiresVerified: true, editorModal: true } },
    { path: '/habitats/:id', name: 'habitat-detail', component: HabitatDetail },
    { path: '/items', name: 'item-list', component: ItemsList },
    { path: '/items/new', name: 'item-new', component: ItemsList, meta: { requiresVerified: true, editorModal: true } },
    { path: '/items/:id/edit', name: 'item-edit', component: ItemDetail, meta: { requiresVerified: true, editorModal: true } },
    { path: '/items/:id', name: 'item-detail', component: ItemDetail },
    { path: '/recipes', name: 'recipe-list', component: RecipeList },
    { path: '/recipes/new', name: 'recipe-new', component: RecipeList, meta: { requiresVerified: true, editorModal: true } },
    { path: '/recipes/:id/edit', name: 'recipe-edit', component: RecipeDetail, meta: { requiresVerified: true, editorModal: true } },
    { path: '/recipes/:id', name: 'recipe-detail', component: RecipeDetail },
    { path: '/dish', name: 'dish', component: ComingSoonView, props: { page: 'dish' } },
    { path: '/events', name: 'events', component: ComingSoonView, props: { page: 'events' } },
    { path: '/actions', name: 'actions', component: ComingSoonView, props: { page: 'actions' } },
    { path: '/dream-island', name: 'dream-island', component: ComingSoonView, props: { page: 'dreamIsland' } },
    { path: '/clothes', name: 'clothes', component: ComingSoonView, props: { page: 'clothes' } },
    { path: '/checklist', component: DailyChecklistView },
    { path: '/life', component: LifeView },
    { path: '/admin', component: AdminView, meta: { requiresVerified: true } },
    { path: '/login', component: LoginView },
    { path: '/register', component: RegisterView },
    { path: '/verify-email', component: VerifyEmailView }
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.meta.editorModal === true || from.meta.editorModal === true) return false;
    return { top: 0 };
  }
});

router.beforeEach(async (to) => {
  if (!to.matched.some((record) => record.meta.requiresVerified === true)) {
    return true;
  }

  if (!getAuthToken()) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  try {
    const response = await api.me();
    return response.user.emailVerified ? true : { path: '/login', query: { redirect: to.fullPath } };
  } catch {
    setAuthToken(null);
    return { path: '/login', query: { redirect: to.fullPath } };
  }
});
