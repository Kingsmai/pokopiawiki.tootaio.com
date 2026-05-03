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
import ForgotPasswordView from '../views/ForgotPasswordView.vue';
import LoginView from '../views/LoginView.vue';
import UserProfileView from '../views/UserProfileView.vue';
import RegisterView from '../views/RegisterView.vue';
import ResetPasswordView from '../views/ResetPasswordView.vue';
import VerifyEmailView from '../views/VerifyEmailView.vue';
import { api, getAuthToken, setAuthToken } from '../services/api';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/pokemon' },
    { path: '/pokemon', name: 'pokemon-list', component: PokemonList },
    { path: '/pokemon/new', name: 'pokemon-new', component: PokemonList, meta: { requiredPermission: 'pokemon.create', editorModal: true } },
    { path: '/pokemon/:id/edit', name: 'pokemon-edit', component: PokemonDetail, meta: { requiredPermission: 'pokemon.update', editorModal: true } },
    { path: '/pokemon/:id', name: 'pokemon-detail', component: PokemonDetail },
    { path: '/habitats', name: 'habitat-list', component: HabitatList },
    { path: '/habitats/new', name: 'habitat-new', component: HabitatList, meta: { requiredPermission: 'habitats.create', editorModal: true } },
    { path: '/habitats/:id/edit', name: 'habitat-edit', component: HabitatDetail, meta: { requiredPermission: 'habitats.update', editorModal: true } },
    { path: '/habitats/:id', name: 'habitat-detail', component: HabitatDetail },
    { path: '/items', name: 'item-list', component: ItemsList },
    { path: '/items/new', name: 'item-new', component: ItemsList, meta: { requiredPermission: 'items.create', editorModal: true } },
    { path: '/items/:id/edit', name: 'item-edit', component: ItemDetail, meta: { requiredPermission: 'items.update', editorModal: true } },
    { path: '/items/:id', name: 'item-detail', component: ItemDetail },
    { path: '/recipes', name: 'recipe-list', component: RecipeList },
    { path: '/recipes/new', name: 'recipe-new', component: RecipeList, meta: { requiredPermission: 'recipes.create', editorModal: true } },
    { path: '/recipes/:id/edit', name: 'recipe-edit', component: RecipeDetail, meta: { requiredPermission: 'recipes.update', editorModal: true } },
    { path: '/recipes/:id', name: 'recipe-detail', component: RecipeDetail },
    { path: '/dish', name: 'dish', component: ComingSoonView, props: { page: 'dish' } },
    { path: '/events', name: 'events', component: ComingSoonView, props: { page: 'events' } },
    { path: '/actions', name: 'actions', component: ComingSoonView, props: { page: 'actions' } },
    { path: '/dream-island', name: 'dream-island', component: ComingSoonView, props: { page: 'dreamIsland' } },
    { path: '/clothes', name: 'clothes', component: ComingSoonView, props: { page: 'clothes' } },
    { path: '/checklist', component: DailyChecklistView },
    { path: '/life', component: LifeView },
    { path: '/admin', component: AdminView, meta: { requiredPermission: 'admin.access' } },
    { path: '/profile', component: UserProfileView, meta: { requiresAuth: true } },
    { path: '/login', component: LoginView },
    { path: '/forgot-password', component: ForgotPasswordView },
    { path: '/reset-password', component: ResetPasswordView },
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
  const requiredPermissions = to.matched
    .map((record) => record.meta.requiredPermission)
    .filter((permission): permission is string => typeof permission === 'string');
  const requiredAnyPermissions = to.matched.flatMap((record) =>
    Array.isArray(record.meta.requiredAnyPermission)
      ? record.meta.requiredAnyPermission.filter((permission): permission is string => typeof permission === 'string')
      : []
  );
  const requiresVerified = to.matched.some((record) => record.meta.requiresVerified === true) || requiredPermissions.length > 0 || requiredAnyPermissions.length > 0;
  const requiresAuth = requiresVerified || to.matched.some((record) => record.meta.requiresAuth === true);

  if (!requiresAuth) {
    return true;
  }

  if (!getAuthToken()) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  try {
    const response = await api.me();
    if (requiresVerified && !response.user.emailVerified) {
      return { path: '/login', query: { redirect: to.fullPath } };
    }

    const permissionSet = new Set(response.user.permissions);
    if (requiredPermissions.some((permission) => !permissionSet.has(permission))) {
      return { path: '/pokemon' };
    }
    if (requiredAnyPermissions.length && !requiredAnyPermissions.some((permission) => permissionSet.has(permission))) {
      return { path: '/pokemon' };
    }

    return true;
  } catch {
    setAuthToken(null);
    return { path: '/login', query: { redirect: to.fullPath } };
  }
});
