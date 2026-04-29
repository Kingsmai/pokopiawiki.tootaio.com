import { createRouter, createWebHistory } from 'vue-router';
import PokemonList from '../views/PokemonList.vue';
import PokemonDetail from '../views/PokemonDetail.vue';
import HabitatList from '../views/HabitatList.vue';
import HabitatDetail from '../views/HabitatDetail.vue';
import ItemsList from '../views/ItemsList.vue';
import ItemDetail from '../views/ItemDetail.vue';
import RecipeDetail from '../views/RecipeDetail.vue';
import AdminView from '../views/AdminView.vue';

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
    { path: '/admin', component: AdminView }
  ],
  scrollBehavior: () => ({ top: 0 })
});
