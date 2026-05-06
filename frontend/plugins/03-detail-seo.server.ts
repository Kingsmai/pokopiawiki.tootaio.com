import { resolvedSeoHead, resolveSeo, type SeoConfig } from '../src/seo';
import { api } from '../src/services/api';

export default defineNuxtPlugin(async () => {
  const route = useRoute();
  const routeId = typeof route.params.id === 'string' && route.params.id.trim() !== '' ? route.params.id : null;
  if (!routeId || typeof route.name !== 'string') {
    return;
  }

  const nuxtApp = useNuxtApp();
  const t = (nuxtApp.$pokopiaI18n as { global: { t: (key: string, values?: Record<string, string | number>) => string } }).global.t;
  const seo = await detailSeo(String(route.name), routeId, t);
  if (seo) {
    useHead(resolvedSeoHead(resolveSeo(seo)));
  }
});

async function detailSeo(
  routeName: string,
  routeId: string,
  t: (key: string, values?: Record<string, string | number>) => string
): Promise<SeoConfig | null> {
  try {
    if (routeName === 'pokemon-detail') {
      const pokemon = await api.pokemonDetail(routeId);
      return {
        title: `${pokemon.name} - ${t(pokemon.isEventItem ? 'pages.eventPokemon.title' : 'pages.pokemon.title')}`,
        description: t('seo.pokemonDetailDescription', { name: pokemon.name }),
        canonicalPath: `/pokemon/${pokemon.id}`,
        image: pokemon.image?.url
      };
    }

    if (routeName === 'habitat-detail') {
      const habitat = await api.habitatDetail(routeId);
      return {
        title: `${habitat.name} - ${t(habitat.isEventItem ? 'pages.eventHabitats.title' : 'pages.habitats.title')}`,
        description: t('seo.habitatDetailDescription', { name: habitat.name }),
        canonicalPath: `/habitats/${habitat.id}`,
        image: habitat.image?.url
      };
    }

    if (routeName === 'item-detail' || routeName === 'ancient-artifact-detail') {
      const item = await api.itemDetail(routeId);
      const ancientArtifactRoute = routeName === 'ancient-artifact-detail';
      if (ancientArtifactRoute && !item.ancientArtifactCategory) {
        return null;
      }

      const titleKey = ancientArtifactRoute ? 'pages.ancientArtifacts.title' : item.isEventItem ? 'pages.eventItems.title' : 'pages.items.title';
      const descriptionKey = ancientArtifactRoute ? 'seo.ancientArtifactDetailDescription' : 'seo.itemDetailDescription';
      return {
        title: `${item.name} - ${t(titleKey)}`,
        description: t(descriptionKey, { name: item.name }),
        canonicalPath: ancientArtifactRoute ? `/ancient-artifacts/${item.id}` : `/items/${item.id}`,
        image: item.image?.url
      };
    }

    if (routeName === 'recipe-detail') {
      const recipe = await api.recipeDetail(routeId);
      return {
        title: `${recipe.name} - ${t('pages.recipes.title')}`,
        description: t('seo.recipeDetailDescription', { name: recipe.name }),
        canonicalPath: `/recipes/${recipe.id}`,
        image: recipe.item.image?.url
      };
    }
  } catch {
    return null;
  }

  return null;
}
