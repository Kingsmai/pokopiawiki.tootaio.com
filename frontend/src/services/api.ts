import { getCurrentLocale } from '../i18n';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const authTokenKey = 'pokopia_auth_token';
const authChangeEvent = 'pokopia-auth-change';

export type TranslationField = 'name' | 'title' | 'details' | 'genus';
export type TranslationMap = Record<string, Partial<Record<TranslationField, string>>>;

export interface Language {
  code: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export interface NamedEntity {
  id: number;
  name: string;
  baseName?: string;
  translations?: TranslationMap;
}

export interface Skill extends NamedEntity {
  hasItemDrop: boolean;
}

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
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

export type EditHistoryAction = 'create' | 'update' | 'delete';

export interface EditChange {
  label: string;
  before: string;
  after: string;
}

export interface EditHistoryEntry {
  action: EditHistoryAction;
  changes: EditChange[];
  createdAt: string;
  user: UserSummary | null;
}

export interface Pokemon extends EditInfo {
  id: number;
  name: string;
  baseName?: string;
  genus: string;
  baseGenus?: string;
  details: string;
  baseDetails?: string;
  heightInches: number;
  heightMeters: number;
  weightPounds: number;
  weightKg: number;
  translations?: TranslationMap;
  types: NamedEntity[];
  stats: PokemonStats;
  environment: NamedEntity;
  skills: Skill[];
  favorite_things: NamedEntity[];
}

export interface PokemonDetail extends Pokemon {
  skills: Array<Skill & { itemDrop: NamedEntity | null }>;
  favoriteThingItems: Array<NamedEntity & { category: NamedEntity; tags: NamedEntity[] }>;
  editHistory: EditHistoryEntry[];
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
  baseName?: string;
  translations?: TranslationMap;
  recipe: Array<NamedEntity & { quantity: number }>;
  pokemon?: NamedEntity[];
}

export interface HabitatDetail extends Habitat {
  editHistory: EditHistoryEntry[];
  pokemon: Array<NamedEntity & {
    time_of_day: string;
    weather: string;
    rarity: number;
    map: NamedEntity;
  }>;
}

export interface RecipeSummary extends EditInfo {
  id: number;
}

export interface RecipeUsage {
  id: number;
  name: string;
  materials: Array<NamedEntity & { quantity: number }>;
}

export interface HabitatUsage {
  id: number;
  name: string;
  recipe: Array<NamedEntity & { quantity: number }>;
}

export interface Item extends EditInfo {
  id: number;
  name: string;
  baseName?: string;
  translations?: TranslationMap;
  category: NamedEntity;
  usage: NamedEntity | null;
  customization: {
    dyeable: boolean;
    dualDyeable: boolean;
    patternEditable: boolean;
  };
  noRecipe: boolean;
  tags: NamedEntity[];
  recipe: RecipeSummary | null;
}

export interface ItemDetail extends Item {
  acquisitionMethods: NamedEntity[];
  recipe: RecipeDetail | null;
  relatedRecipes: RecipeUsage[];
  relatedHabitats: HabitatUsage[];
  editHistory: EditHistoryEntry[];
  droppedByPokemon: Array<{
    pokemon: NamedEntity;
    skill: NamedEntity;
  }>;
}

export interface Recipe extends EditInfo {
  id: number;
  name: string;
  materials: Array<NamedEntity & { quantity: number }>;
}

export interface DailyChecklistItem {
  id: number;
  title: string;
  baseTitle?: string;
  translations?: TranslationMap;
}

export interface LifePost {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: UserSummary | null;
  updatedBy: UserSummary | null;
  comments: LifeComment[];
}

export interface LifeComment {
  id: number;
  postId: number;
  parentCommentId: number | null;
  body: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: UserSummary | null;
  replies: LifeComment[];
}

export interface RecipeDetail extends Recipe {
  acquisition_methods: NamedEntity[];
  editHistory: EditHistoryEntry[];
  item: NamedEntity;
}

export interface Options {
  pokemonTypes: NamedEntity[];
  skills: Skill[];
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
  | 'pokemon-types'
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
  genus: string;
  details: string;
  heightInches: number;
  weightPounds: number;
  translations?: TranslationMap;
  typeIds: number[];
  stats: PokemonStats;
  environmentId: number;
  skillIds: number[];
  favoriteThingIds: number[];
  skillItemDrops: Array<{ skillId: number; itemId: number }>;
}

export interface ItemPayload {
  name: string;
  translations?: TranslationMap;
  categoryId: number;
  usageId: number | null;
  dyeable: boolean;
  dualDyeable: boolean;
  patternEditable: boolean;
  noRecipe: boolean;
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
  translations?: TranslationMap;
  recipeItems: Array<{ itemId: number; quantity: number }>;
  pokemonAppearances: Array<{
    pokemonId: number;
    mapIds: number[];
    timeOfDays: string[];
    weathers: string[];
    rarity: number;
  }>;
}

export interface DailyChecklistPayload {
  title: string;
  translations?: TranslationMap;
}

export interface LifePostPayload {
  body: string;
}

export interface LifeCommentPayload {
  body: string;
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

function requestHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'X-Locale': getCurrentLocale(),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
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

  return `Request failed (${response.status})`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: requestHeaders()
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
      ...requestHeaders()
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
    headers: requestHeaders()
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
}

async function deleteJson(path: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'DELETE',
    headers: requestHeaders()
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
}

export const api = {
  languages: () => getJson<Language[]>('/api/languages'),
  adminLanguages: () => getJson<Language[]>('/api/admin/languages'),
  createLanguage: (payload: Omit<Language, 'sortOrder'> & { sortOrder?: number }) =>
    sendJson<Language[]>('/api/admin/languages', 'POST', payload),
  updateLanguage: (code: string, payload: Partial<Language> & { name: string }) =>
    sendJson<Language[]>(`/api/admin/languages/${code}`, 'PUT', payload),
  reorderLanguages: (codes: string[]) => sendJson<Language[]>('/api/admin/languages/order', 'PUT', { codes }),
  deleteLanguage: (code: string) => deleteJson(`/api/admin/languages/${code}`),
  register: (payload: RegisterPayload) => sendJson<{ message: string }>('/api/auth/register', 'POST', payload),
  verifyEmail: (token: string) =>
    sendJson<{ message: string; user: AuthUser }>('/api/auth/verify-email', 'POST', { token }),
  login: (payload: LoginPayload) => sendJson<AuthResponse>('/api/auth/login', 'POST', payload),
  me: () => getJson<{ user: AuthUser }>('/api/auth/me'),
  logout: () => postEmpty('/api/auth/logout'),
  options: () => getJson<Options>('/api/options'),
  dailyChecklist: () => getJson<DailyChecklistItem[]>('/api/daily-checklist'),
  lifePosts: () => getJson<LifePost[]>('/api/life-posts'),
  createLifePost: (payload: LifePostPayload) => sendJson<LifePost>('/api/life-posts', 'POST', payload),
  updateLifePost: (id: string | number, payload: LifePostPayload) =>
    sendJson<LifePost>(`/api/life-posts/${id}`, 'PUT', payload),
  deleteLifePost: (id: string | number) => deleteJson(`/api/life-posts/${id}`),
  createLifeComment: (postId: string | number, payload: LifeCommentPayload) =>
    sendJson<LifeComment>(`/api/life-posts/${postId}/comments`, 'POST', payload),
  createLifeCommentReply: (postId: string | number, commentId: string | number, payload: LifeCommentPayload) =>
    sendJson<LifeComment>(`/api/life-posts/${postId}/comments/${commentId}/replies`, 'POST', payload),
  deleteLifeComment: (id: string | number) => deleteJson(`/api/life-comments/${id}`),
  createDailyChecklistItem: (payload: DailyChecklistPayload) =>
    sendJson<DailyChecklistItem>('/api/admin/daily-checklist', 'POST', payload),
  updateDailyChecklistItem: (id: string | number, payload: DailyChecklistPayload) =>
    sendJson<DailyChecklistItem>(`/api/admin/daily-checklist/${id}`, 'PUT', payload),
  reorderDailyChecklistItems: (ids: number[]) =>
    sendJson<DailyChecklistItem[]>('/api/admin/daily-checklist/order', 'PUT', { ids }),
  deleteDailyChecklistItem: (id: string | number) => deleteJson(`/api/admin/daily-checklist/${id}`),
  config: (type: ConfigType) => getJson<Array<Skill | NamedEntity>>(`/api/admin/config/${type}`),
  createConfig: (type: ConfigType, payload: { name: string; translations?: TranslationMap; hasItemDrop?: boolean }) =>
    sendJson<Skill | NamedEntity>(`/api/admin/config/${type}`, 'POST', payload),
  reorderConfig: (type: ConfigType, ids: number[]) =>
    sendJson<Array<Skill | NamedEntity>>(`/api/admin/config/${type}/order`, 'PUT', { ids }),
  updateConfig: (type: ConfigType, id: number, payload: { name: string; translations?: TranslationMap; hasItemDrop?: boolean }) =>
    sendJson<Skill | NamedEntity>(`/api/admin/config/${type}/${id}`, 'PUT', payload),
  deleteConfig: (type: ConfigType, id: number) => deleteJson(`/api/admin/config/${type}/${id}`),
  pokemon: (params: Record<string, string | number | undefined>) =>
    getJson<Pokemon[]>(`/api/pokemon${buildQuery(params)}`),
  pokemonDetail: (id: string | number) => getJson<PokemonDetail>(`/api/pokemon/${id}`),
  createPokemon: (payload: PokemonPayload) => sendJson<PokemonDetail>('/api/pokemon', 'POST', payload),
  updatePokemon: (id: string | number, payload: PokemonPayload) =>
    sendJson<PokemonDetail>(`/api/pokemon/${id}`, 'PUT', payload),
  deletePokemon: (id: string | number) => deleteJson(`/api/pokemon/${id}`),
  reorderPokemon: (ids: number[]) => sendJson<Pokemon[]>('/api/admin/pokemon/order', 'PUT', { ids }),
  habitats: () => getJson<Habitat[]>('/api/habitats'),
  habitatDetail: (id: string | number) => getJson<HabitatDetail>(`/api/habitats/${id}`),
  createHabitat: (payload: HabitatPayload) => sendJson<HabitatDetail>('/api/habitats', 'POST', payload),
  updateHabitat: (id: string | number, payload: HabitatPayload) =>
    sendJson<HabitatDetail>(`/api/habitats/${id}`, 'PUT', payload),
  deleteHabitat: (id: string | number) => deleteJson(`/api/habitats/${id}`),
  reorderHabitats: (ids: number[]) => sendJson<Habitat[]>('/api/admin/habitats/order', 'PUT', { ids }),
  items: (params: Record<string, string | number | undefined>) =>
    getJson<Item[]>(`/api/items${buildQuery(params)}`),
  itemDetail: (id: string | number) => getJson<ItemDetail>(`/api/items/${id}`),
  createItem: (payload: ItemPayload) => sendJson<ItemDetail>('/api/items', 'POST', payload),
  updateItem: (id: string | number, payload: ItemPayload) => sendJson<ItemDetail>(`/api/items/${id}`, 'PUT', payload),
  deleteItem: (id: string | number) => deleteJson(`/api/items/${id}`),
  reorderItems: (ids: number[]) => sendJson<Item[]>('/api/admin/items/order', 'PUT', { ids }),
  recipes: (params: Record<string, string | number | undefined> = {}) =>
    getJson<Recipe[]>(`/api/recipes${buildQuery(params)}`),
  recipeDetail: (id: string | number) => getJson<RecipeDetail>(`/api/recipes/${id}`),
  createRecipe: (payload: RecipePayload) => sendJson<RecipeDetail>('/api/recipes', 'POST', payload),
  updateRecipe: (id: string | number, payload: RecipePayload) =>
    sendJson<RecipeDetail>(`/api/recipes/${id}`, 'PUT', payload),
  deleteRecipe: (id: string | number) => deleteJson(`/api/recipes/${id}`),
  reorderRecipes: (ids: number[]) => sendJson<Recipe[]>('/api/admin/recipes/order', 'PUT', { ids })
};
