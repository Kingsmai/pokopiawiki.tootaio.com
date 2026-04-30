const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const authTokenKey = 'pokopia_auth_token';
const authChangeEvent = 'pokopia-auth-change';

export interface NamedEntity {
  id: number;
  name: string;
}

export interface UserSummary {
  id: number;
  displayName: string;
}

export interface EditInfo {
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummary | null;
  updatedBy: UserSummary | null;
}

export interface Pokemon extends EditInfo {
  id: number;
  name: string;
  environment: NamedEntity;
  skills: NamedEntity[];
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

export interface Habitat extends EditInfo {
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

export interface Item extends EditInfo {
  id: number;
  name: string;
  category: NamedEntity;
  usage: NamedEntity | null;
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

export interface Recipe extends EditInfo {
  id: number;
  name: string;
  materials: Array<NamedEntity & { quantity: number }>;
}

export interface RecipeDetail extends Recipe {
  acquisition_methods: NamedEntity[];
  item: NamedEntity;
}

export interface Options {
  skills: NamedEntity[];
  environments: NamedEntity[];
  favoriteThings: NamedEntity[];
  itemCategories: NamedEntity[];
  itemUsages: NamedEntity[];
  acquisitionMethods: NamedEntity[];
  itemTags: NamedEntity[];
  maps: NamedEntity[];
}

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  displayName: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export type ConfigType =
  | 'skills'
  | 'environments'
  | 'favorite-things'
  | 'item-categories'
  | 'item-usages'
  | 'acquisition-methods'
  | 'maps';

export interface PokemonPayload {
  id: number;
  name: string;
  environmentId: number;
  skillIds: number[];
  favoriteThingIds: number[];
}

export interface ItemPayload {
  name: string;
  categoryId: number;
  usageId: number | null;
  dyeable: boolean;
  dualDyeable: boolean;
  patternEditable: boolean;
  acquisitionMethodIds: number[];
  tagIds: number[];
}

export interface RecipePayload {
  itemId: number;
  acquisitionMethodIds: number[];
  materials: Array<{ itemId: number; quantity: number }>;
}

export interface HabitatPayload {
  name: string;
  recipeItems: Array<{ itemId: number; quantity: number }>;
  pokemonAppearances: Array<{
    pokemonId: number;
    mapIds: number[];
    timeOfDays: string[];
    weathers: string[];
    rarity: number;
  }>;
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

export function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem(authTokenKey);
}

export function setAuthToken(token: string | null): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  if (token) {
    localStorage.setItem(authTokenKey, token);
  } else {
    localStorage.removeItem(authTokenKey);
  }

  window.dispatchEvent(new Event(authChangeEvent));
}

export function onAuthTokenChange(callback: () => void): () => void {
  window.addEventListener(authChangeEvent, callback);
  return () => window.removeEventListener(authChangeEvent, callback);
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: unknown };
    if (typeof data.message === 'string' && data.message.trim() !== '') {
      return data.message;
    }
  } catch {
    // Ignore invalid or empty error bodies and use the status fallback.
  }

  return `请求失败（${response.status}）`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function sendJson<T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function postEmpty(path: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
}

async function deleteJson(path: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'DELETE',
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
}

export const api = {
  register: (payload: RegisterPayload) => sendJson<{ message: string }>('/api/auth/register', 'POST', payload),
  verifyEmail: (token: string) =>
    sendJson<{ message: string; user: AuthUser }>('/api/auth/verify-email', 'POST', { token }),
  login: (payload: LoginPayload) => sendJson<AuthResponse>('/api/auth/login', 'POST', payload),
  me: () => getJson<{ user: AuthUser }>('/api/auth/me'),
  logout: () => postEmpty('/api/auth/logout'),
  options: () => getJson<Options>('/api/options'),
  config: (type: ConfigType) => getJson<NamedEntity[]>(`/api/admin/config/${type}`),
  createConfig: (type: ConfigType, payload: { name: string }) =>
    sendJson<NamedEntity>(`/api/admin/config/${type}`, 'POST', payload),
  updateConfig: (type: ConfigType, id: number, payload: { name: string }) =>
    sendJson<NamedEntity>(`/api/admin/config/${type}/${id}`, 'PUT', payload),
  deleteConfig: (type: ConfigType, id: number) => deleteJson(`/api/admin/config/${type}/${id}`),
  pokemon: (params: Record<string, string | number | undefined>) =>
    getJson<Pokemon[]>(`/api/pokemon${buildQuery(params)}`),
  pokemonDetail: (id: string | number) => getJson<PokemonDetail>(`/api/pokemon/${id}`),
  createPokemon: (payload: PokemonPayload) => sendJson<PokemonDetail>('/api/pokemon', 'POST', payload),
  updatePokemon: (id: string | number, payload: PokemonPayload) =>
    sendJson<PokemonDetail>(`/api/pokemon/${id}`, 'PUT', payload),
  deletePokemon: (id: string | number) => deleteJson(`/api/pokemon/${id}`),
  habitats: () => getJson<Habitat[]>('/api/habitats'),
  habitatDetail: (id: string | number) => getJson<HabitatDetail>(`/api/habitats/${id}`),
  createHabitat: (payload: HabitatPayload) => sendJson<HabitatDetail>('/api/habitats', 'POST', payload),
  updateHabitat: (id: string | number, payload: HabitatPayload) =>
    sendJson<HabitatDetail>(`/api/habitats/${id}`, 'PUT', payload),
  deleteHabitat: (id: string | number) => deleteJson(`/api/habitats/${id}`),
  items: (params: Record<string, string | number | undefined>) =>
    getJson<Item[]>(`/api/items${buildQuery(params)}`),
  itemDetail: (id: string | number) => getJson<ItemDetail>(`/api/items/${id}`),
  createItem: (payload: ItemPayload) => sendJson<ItemDetail>('/api/items', 'POST', payload),
  updateItem: (id: string | number, payload: ItemPayload) => sendJson<ItemDetail>(`/api/items/${id}`, 'PUT', payload),
  deleteItem: (id: string | number) => deleteJson(`/api/items/${id}`),
  recipes: (params: Record<string, string | number | undefined> = {}) =>
    getJson<Recipe[]>(`/api/recipes${buildQuery(params)}`),
  recipeDetail: (id: string | number) => getJson<RecipeDetail>(`/api/recipes/${id}`),
  createRecipe: (payload: RecipePayload) => sendJson<RecipeDetail>('/api/recipes', 'POST', payload),
  updateRecipe: (id: string | number, payload: RecipePayload) =>
    sendJson<RecipeDetail>(`/api/recipes/${id}`, 'PUT', payload),
  deleteRecipe: (id: string | number) => deleteJson(`/api/recipes/${id}`)
};
