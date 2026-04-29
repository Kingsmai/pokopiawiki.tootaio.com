const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export interface NamedEntity {
  id: number;
  name: string;
}

export interface Skill extends NamedEntity {
  subcategory: string | null;
}

export interface Pokemon {
  id: number;
  name: string;
  environment: NamedEntity;
  skills: Skill[];
  favorite_things: NamedEntity[];
}

export interface PokemonDetail extends Pokemon {
  habitats: Array<{
    id: number;
    name: string;
    time_of_day: string;
    weather: string;
    rarity: number;
    map: NamedEntity;
  }>;
}

export interface Habitat {
  id: number;
  name: string;
  recipe: Array<NamedEntity & { quantity: number }>;
  pokemon?: NamedEntity[];
}

export interface HabitatDetail extends Habitat {
  pokemon: Array<NamedEntity & {
    time_of_day: string;
    weather: string;
    rarity: number;
    map: NamedEntity;
  }>;
}

export interface Item {
  id: number;
  name: string;
  category: NamedEntity;
  usage: NamedEntity;
  customization: {
    dyeable: boolean;
    dualDyeable: boolean;
    patternEditable: boolean;
  };
  tags: NamedEntity[];
}

export interface ItemDetail extends Item {
  acquisitionMethods: NamedEntity[];
  recipe: RecipeDetail | null;
  relatedHabitats: Array<NamedEntity & { quantity: number }>;
}

export interface Recipe {
  id: number;
  name: string;
  materials: Array<NamedEntity & { quantity: number }>;
}

export interface RecipeDetail extends Recipe {
  acquisition_methods: NamedEntity[];
}

export interface Options {
  skills: Skill[];
  environments: NamedEntity[];
  favoriteThings: NamedEntity[];
  itemCategories: NamedEntity[];
  itemUsages: NamedEntity[];
  itemTags: NamedEntity[];
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  options: () => getJson<Options>('/api/options'),
  pokemon: (params: Record<string, string | number | undefined>) =>
    getJson<Pokemon[]>(`/api/pokemon${buildQuery(params)}`),
  pokemonDetail: (id: string | number) => getJson<PokemonDetail>(`/api/pokemon/${id}`),
  habitats: () => getJson<Habitat[]>('/api/habitats'),
  habitatDetail: (id: string | number) => getJson<HabitatDetail>(`/api/habitats/${id}`),
  items: (params: Record<string, string | number | undefined>) =>
    getJson<Item[]>(`/api/items${buildQuery(params)}`),
  itemDetail: (id: string | number) => getJson<ItemDetail>(`/api/items/${id}`),
  recipes: () => getJson<Recipe[]>('/api/recipes'),
  recipeDetail: (id: string | number) => getJson<RecipeDetail>(`/api/recipes/${id}`)
};
