import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import PokemonList from '../views/PokemonList.vue';
import PokemonDetail from '../views/PokemonDetail.vue';
import HabitatList from '../views/HabitatList.vue';
import HabitatDetail from '../views/HabitatDetail.vue';
import ItemsList from '../views/ItemsList.vue';
import ItemDetail from '../views/ItemDetail.vue';
import AncientArtifactList from '../views/AncientArtifactList.vue';
import AncientArtifactDetail from '../views/AncientArtifactDetail.vue';
import RecipeList from '../views/RecipeList.vue';
import RecipeDetail from '../views/RecipeDetail.vue';
import DailyChecklistView from '../views/DailyChecklistView.vue';
import LifeView from '../views/LifeView.vue';
import ProjectUpdatesView from '../views/ProjectUpdatesView.vue';
import LegalView from '../views/LegalView.vue';
import ComingSoonView from '../views/ComingSoonView.vue';
import AdminView from '../views/AdminView.vue';
import ForgotPasswordView from '../views/ForgotPasswordView.vue';
import LoginView from '../views/LoginView.vue';
import UserProfileView from '../views/UserProfileView.vue';
import RegisterView from '../views/RegisterView.vue';
import ResetPasswordView from '../views/ResetPasswordView.vue';
import VerifyEmailView from '../views/VerifyEmailView.vue';
import { api, getAuthToken, setAuthToken } from '../services/api';
import type { RouteSeoConfig } from '../seo';

const seo = (config: RouteSeoConfig) => config;

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { seo: seo({ titleKey: 'pages.home.title', descriptionKey: 'pages.home.subtitle', canonicalPath: '/' }) } },
    {
      path: '/pokemon',
      name: 'pokemon-list',
      component: PokemonList,
      props: { eventOnly: false },
      meta: { seo: seo({ titleKey: 'pages.pokemon.title', descriptionKey: 'pages.pokemon.subtitle' }) }
    },
    {
      path: '/pokemon/new',
      name: 'pokemon-new',
      component: PokemonList,
      props: { eventOnly: false },
      meta: {
        requiredPermission: 'pokemon.create',
        editorModal: true,
        seo: seo({ titleKey: 'pages.pokemon.newTitle', descriptionKey: 'pages.pokemon.editSubtitle', canonicalPath: '/pokemon', noindex: true })
      }
    },
    {
      path: '/event-pokemon',
      name: 'event-pokemon-list',
      component: PokemonList,
      props: { eventOnly: true },
      meta: { seo: seo({ titleKey: 'pages.eventPokemon.title', descriptionKey: 'pages.eventPokemon.subtitle', canonicalPath: '/event-pokemon' }) }
    },
    {
      path: '/event-pokemon/new',
      name: 'event-pokemon-new',
      component: PokemonList,
      props: { eventOnly: true },
      meta: {
        requiredPermission: 'pokemon.create',
        editorModal: true,
        seo: seo({ titleKey: 'pages.eventPokemon.newTitle', descriptionKey: 'pages.eventPokemon.editSubtitle', canonicalPath: '/event-pokemon', noindex: true })
      }
    },
    {
      path: '/pokemon/:id/edit',
      name: 'pokemon-edit',
      component: PokemonDetail,
      meta: {
        requiredPermission: 'pokemon.update',
        editorModal: true,
        seo: seo({
          titleKey: 'pages.pokemon.editKicker',
          descriptionKey: 'pages.pokemon.editSubtitle',
          canonicalPath: (route) => `/pokemon/${String(route.params.id)}`,
          noindex: true
        })
      }
    },
    { path: '/pokemon/:id', name: 'pokemon-detail', component: PokemonDetail, meta: { seo: seo({ titleKey: 'pages.pokemon.detailKicker', descriptionKey: 'pages.pokemon.subtitle' }) } },
    {
      path: '/habitats',
      name: 'habitat-list',
      component: HabitatList,
      props: { eventOnly: false },
      meta: { seo: seo({ titleKey: 'pages.habitats.title', descriptionKey: 'pages.habitats.subtitle' }) }
    },
    {
      path: '/habitats/new',
      name: 'habitat-new',
      component: HabitatList,
      props: { eventOnly: false },
      meta: {
        requiredPermission: 'habitats.create',
        editorModal: true,
        seo: seo({ titleKey: 'pages.habitats.newTitle', descriptionKey: 'pages.habitats.editSubtitle', canonicalPath: '/habitats', noindex: true })
      }
    },
    {
      path: '/event-habitats',
      name: 'event-habitat-list',
      component: HabitatList,
      props: { eventOnly: true },
      meta: { seo: seo({ titleKey: 'pages.eventHabitats.title', descriptionKey: 'pages.eventHabitats.subtitle', canonicalPath: '/event-habitats' }) }
    },
    {
      path: '/event-habitats/new',
      name: 'event-habitat-new',
      component: HabitatList,
      props: { eventOnly: true },
      meta: {
        requiredPermission: 'habitats.create',
        editorModal: true,
        seo: seo({ titleKey: 'pages.eventHabitats.newTitle', descriptionKey: 'pages.eventHabitats.editSubtitle', canonicalPath: '/event-habitats', noindex: true })
      }
    },
    {
      path: '/habitats/:id/edit',
      name: 'habitat-edit',
      component: HabitatDetail,
      meta: {
        requiredPermission: 'habitats.update',
        editorModal: true,
        seo: seo({
          titleKey: 'pages.habitats.detailKicker',
          descriptionKey: 'pages.habitats.editSubtitle',
          canonicalPath: (route) => `/habitats/${String(route.params.id)}`,
          noindex: true
        })
      }
    },
    { path: '/habitats/:id', name: 'habitat-detail', component: HabitatDetail, meta: { seo: seo({ titleKey: 'pages.habitats.detailKicker', descriptionKey: 'pages.habitats.subtitle' }) } },
    {
      path: '/items',
      name: 'item-list',
      component: ItemsList,
      props: { eventOnly: false },
      meta: { seo: seo({ titleKey: 'pages.items.title', descriptionKey: 'pages.items.subtitle' }) }
    },
    {
      path: '/items/new',
      name: 'item-new',
      component: ItemsList,
      props: { eventOnly: false },
      meta: {
        requiredPermission: 'items.create',
        editorModal: true,
        seo: seo({ titleKey: 'pages.items.newTitle', descriptionKey: 'pages.items.editSubtitle', canonicalPath: '/items', noindex: true })
      }
    },
    {
      path: '/event-items',
      name: 'event-item-list',
      component: ItemsList,
      props: { eventOnly: true },
      meta: { seo: seo({ titleKey: 'pages.eventItems.title', descriptionKey: 'pages.eventItems.subtitle', canonicalPath: '/event-items' }) }
    },
    {
      path: '/event-items/new',
      name: 'event-item-new',
      component: ItemsList,
      props: { eventOnly: true },
      meta: {
        requiredPermission: 'items.create',
        editorModal: true,
        seo: seo({ titleKey: 'pages.eventItems.newTitle', descriptionKey: 'pages.eventItems.editSubtitle', canonicalPath: '/event-items', noindex: true })
      }
    },
    {
      path: '/items/:id/edit',
      name: 'item-edit',
      component: ItemDetail,
      meta: {
        requiredPermission: 'items.update',
        editorModal: true,
        seo: seo({
          titleKey: 'pages.items.editKicker',
          descriptionKey: 'pages.items.editSubtitle',
          canonicalPath: (route) => `/items/${String(route.params.id)}`,
          noindex: true
        })
      }
    },
    { path: '/items/:id', name: 'item-detail', component: ItemDetail, meta: { seo: seo({ titleKey: 'pages.items.detailKicker', descriptionKey: 'pages.items.subtitle' }) } },
    {
      path: '/ancient-artifacts',
      name: 'ancient-artifact-list',
      component: AncientArtifactList,
      meta: { seo: seo({ titleKey: 'pages.ancientArtifacts.title', descriptionKey: 'pages.ancientArtifacts.subtitle' }) }
    },
    {
      path: '/ancient-artifacts/new',
      name: 'ancient-artifact-new',
      component: AncientArtifactList,
      meta: {
        requiredPermission: 'ancient-artifacts.create',
        editorModal: true,
        seo: seo({
          titleKey: 'pages.ancientArtifacts.newTitle',
          descriptionKey: 'pages.ancientArtifacts.editSubtitle',
          canonicalPath: '/ancient-artifacts',
          noindex: true
        })
      }
    },
    {
      path: '/ancient-artifacts/:id/edit',
      name: 'ancient-artifact-edit',
      component: AncientArtifactDetail,
      meta: {
        requiredPermission: 'ancient-artifacts.update',
        editorModal: true,
        seo: seo({
          titleKey: 'pages.ancientArtifacts.editKicker',
          descriptionKey: 'pages.ancientArtifacts.editSubtitle',
          canonicalPath: (route) => `/ancient-artifacts/${String(route.params.id)}`,
          noindex: true
        })
      }
    },
    {
      path: '/ancient-artifacts/:id',
      name: 'ancient-artifact-detail',
      component: AncientArtifactDetail,
      meta: { seo: seo({ titleKey: 'pages.ancientArtifacts.detailKicker', descriptionKey: 'pages.ancientArtifacts.subtitle' }) }
    },
    { path: '/recipes', name: 'recipe-list', component: RecipeList, meta: { seo: seo({ titleKey: 'pages.recipes.title', descriptionKey: 'pages.recipes.subtitle' }) } },
    {
      path: '/recipes/new',
      name: 'recipe-new',
      component: RecipeList,
      meta: {
        requiredPermission: 'recipes.create',
        editorModal: true,
        seo: seo({ titleKey: 'pages.recipes.newTitle', descriptionKey: 'pages.recipes.editSubtitle', canonicalPath: '/recipes', noindex: true })
      }
    },
    {
      path: '/recipes/:id/edit',
      name: 'recipe-edit',
      component: RecipeDetail,
      meta: {
        requiredPermission: 'recipes.update',
        editorModal: true,
        seo: seo({
          titleKey: 'pages.recipes.editKicker',
          descriptionKey: 'pages.recipes.editSubtitle',
          canonicalPath: (route) => `/recipes/${String(route.params.id)}`,
          noindex: true
        })
      }
    },
    { path: '/recipes/:id', name: 'recipe-detail', component: RecipeDetail, meta: { seo: seo({ titleKey: 'pages.recipes.detailKicker', descriptionKey: 'pages.recipes.subtitle' }) } },
    {
      path: '/automation',
      name: 'automation',
      component: ComingSoonView,
      props: { page: 'automation' },
      meta: { seo: seo({ titleKey: 'pages.comingSoon.sections.automation.title', descriptionKey: 'pages.comingSoon.sections.automation.subtitle', noindex: true }) }
    },
    {
      path: '/dish',
      name: 'dish',
      component: ComingSoonView,
      props: { page: 'dish' },
      meta: { seo: seo({ titleKey: 'pages.comingSoon.sections.dish.title', descriptionKey: 'pages.comingSoon.sections.dish.subtitle', noindex: true }) }
    },
    {
      path: '/events',
      name: 'events',
      component: ComingSoonView,
      props: { page: 'events' },
      meta: { seo: seo({ titleKey: 'pages.comingSoon.sections.events.title', descriptionKey: 'pages.comingSoon.sections.events.subtitle', noindex: true }) }
    },
    {
      path: '/actions',
      name: 'actions',
      component: ComingSoonView,
      props: { page: 'actions' },
      meta: { seo: seo({ titleKey: 'pages.comingSoon.sections.actions.title', descriptionKey: 'pages.comingSoon.sections.actions.subtitle', noindex: true }) }
    },
    {
      path: '/dream-island',
      name: 'dream-island',
      component: ComingSoonView,
      props: { page: 'dreamIsland' },
      meta: { seo: seo({ titleKey: 'pages.comingSoon.sections.dreamIsland.title', descriptionKey: 'pages.comingSoon.sections.dreamIsland.subtitle', noindex: true }) }
    },
    {
      path: '/clothes',
      name: 'clothes',
      component: ComingSoonView,
      props: { page: 'clothes' },
      meta: { seo: seo({ titleKey: 'pages.comingSoon.sections.clothes.title', descriptionKey: 'pages.comingSoon.sections.clothes.subtitle', noindex: true }) }
    },
    { path: '/checklist', component: DailyChecklistView, meta: { seo: seo({ titleKey: 'pages.checklist.title', descriptionKey: 'pages.checklist.subtitle' }) } },
    { path: '/life', component: LifeView, meta: { seo: seo({ titleKey: 'pages.life.title', descriptionKey: 'pages.life.subtitle' }) } },
    {
      path: '/project-updates',
      component: ProjectUpdatesView,
      meta: {
        seo: seo({
          titleKey: 'pages.projectUpdates.title',
          descriptionKey: 'pages.projectUpdates.subtitle',
          canonicalPath: '/project-updates'
        })
      }
    },
    {
      path: '/privacy-policy',
      component: LegalView,
      props: { page: 'privacy' },
      meta: { seo: seo({ titleKey: 'pages.legal.privacy.title', descriptionKey: 'pages.legal.privacy.subtitle', canonicalPath: '/privacy-policy' }) }
    },
    {
      path: '/terms-of-service',
      component: LegalView,
      props: { page: 'terms' },
      meta: { seo: seo({ titleKey: 'pages.legal.terms.title', descriptionKey: 'pages.legal.terms.subtitle', canonicalPath: '/terms-of-service' }) }
    },
    {
      path: '/disclaimers',
      component: LegalView,
      props: { page: 'disclaimers' },
      meta: { seo: seo({ titleKey: 'pages.legal.disclaimers.title', descriptionKey: 'pages.legal.disclaimers.subtitle', canonicalPath: '/disclaimers' }) }
    },
    { path: '/admin', component: AdminView, meta: { requiredPermission: 'admin.access', seo: seo({ titleKey: 'pages.admin.title', descriptionKey: 'pages.admin.subtitle', noindex: true }) } },
    { path: '/profile', component: UserProfileView, meta: { requiresAuth: true, seo: seo({ titleKey: 'pages.profile.title', descriptionKey: 'pages.profile.subtitle', noindex: true }) } },
    { path: '/profile/:id', component: UserProfileView, meta: { seo: seo({ titleKey: 'pages.profile.title', descriptionKey: 'pages.profile.publicSubtitle' }) } },
    { path: '/login', component: LoginView, meta: { seo: seo({ titleKey: 'auth.loginTitle', descriptionKey: 'auth.loginSubtitle', noindex: true }) } },
    { path: '/forgot-password', component: ForgotPasswordView, meta: { seo: seo({ titleKey: 'auth.requestResetTitle', descriptionKey: 'auth.requestResetSubtitle', noindex: true }) } },
    { path: '/reset-password', component: ResetPasswordView, meta: { seo: seo({ titleKey: 'auth.resetTitle', descriptionKey: 'auth.resetSubtitle', noindex: true }) } },
    { path: '/register', component: RegisterView, meta: { seo: seo({ titleKey: 'auth.registerTitle', descriptionKey: 'auth.registerSubtitle', noindex: true }) } },
    { path: '/verify-email', component: VerifyEmailView, meta: { seo: seo({ titleKey: 'auth.verifyTitle', descriptionKey: 'auth.verifySubtitle', noindex: true }) } }
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
