import { createRouter, createWebHistory } from 'vue-router';
import PokemonList from '../views/PokemonList.vue';
import PokemonDetail from '../views/PokemonDetail.vue';
import PokemonEdit from '../views/PokemonEdit.vue';
import HabitatList from '../views/HabitatList.vue';
import HabitatDetail from '../views/HabitatDetail.vue';
import HabitatEdit from '../views/HabitatEdit.vue';
import ItemsList from '../views/ItemsList.vue';
import ItemDetail from '../views/ItemDetail.vue';
import ItemEdit from '../views/ItemEdit.vue';
import RecipeList from '../views/RecipeList.vue';
import RecipeDetail from '../views/RecipeDetail.vue';
import RecipeEdit from '../views/RecipeEdit.vue';
import DailyChecklistView from '../views/DailyChecklistView.vue';
import AdminView from '../views/AdminView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import VerifyEmailView from '../views/VerifyEmailView.vue';
import { api, getAuthToken, setAuthToken } from '../services/api';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/pokemon' },
    { path: '/pokemon', component: PokemonList },
    { path: '/pokemon/new', component: PokemonEdit, meta: { requiresVerified: true } },
    { path: '/pokemon/:id/edit', component: PokemonEdit, meta: { requiresVerified: true } },
    { path: '/pokemon/:id', component: PokemonDetail },
    { path: '/habitats', component: HabitatList },
    { path: '/habitats/new', component: HabitatEdit, meta: { requiresVerified: true } },
    { path: '/habitats/:id/edit', component: HabitatEdit, meta: { requiresVerified: true } },
    { path: '/habitats/:id', component: HabitatDetail },
    { path: '/items', component: ItemsList },
    { path: '/items/new', component: ItemEdit, meta: { requiresVerified: true } },
    { path: '/items/:id/edit', component: ItemEdit, meta: { requiresVerified: true } },
    { path: '/items/:id', component: ItemDetail },
    { path: '/recipes', component: RecipeList },
    { path: '/recipes/new', component: RecipeEdit, meta: { requiresVerified: true } },
    { path: '/recipes/:id/edit', component: RecipeEdit, meta: { requiresVerified: true } },
    { path: '/recipes/:id', component: RecipeDetail },
    { path: '/checklist', component: DailyChecklistView },
    { path: '/admin', component: AdminView, meta: { requiresVerified: true } },
    { path: '/login', component: LoginView },
    { path: '/register', component: RegisterView },
    { path: '/verify-email', component: VerifyEmailView }
  ],
  scrollBehavior: () => ({ top: 0 })
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
