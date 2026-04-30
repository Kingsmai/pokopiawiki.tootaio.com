import { createRouter, createWebHistory } from 'vue-router';
import PokemonList from '../views/PokemonList.vue';
import PokemonDetail from '../views/PokemonDetail.vue';
import HabitatList from '../views/HabitatList.vue';
import HabitatDetail from '../views/HabitatDetail.vue';
import ItemsList from '../views/ItemsList.vue';
import ItemDetail from '../views/ItemDetail.vue';
import RecipeDetail from '../views/RecipeDetail.vue';
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
    { path: '/pokemon/:id', component: PokemonDetail },
    { path: '/habitats', component: HabitatList },
    { path: '/habitats/:id', component: HabitatDetail },
    { path: '/items', component: ItemsList },
    { path: '/items/:id', component: ItemDetail },
    { path: '/recipes/:id', component: RecipeDetail },
    { path: '/admin', component: AdminView },
    { path: '/login', component: LoginView },
    { path: '/register', component: RegisterView },
    { path: '/verify-email', component: VerifyEmailView }
  ],
  scrollBehavior: () => ({ top: 0 })
});

router.beforeEach(async (to) => {
  if (to.path !== '/admin') {
    return true;
  }

  if (!getAuthToken()) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  try {
    await api.me();
    return true;
  } catch {
    setAuthToken(null);
    return { path: '/login', query: { redirect: to.fullPath } };
  }
});
