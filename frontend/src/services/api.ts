import { getCurrentLocale } from '../i18n';

let apiBaseUrl = 'http://localhost:3001';
const authTokenKey = 'pokopia_auth_token';
const authChangeEvent = 'pokopia-auth-change';

export type TranslationField = 'name' | 'title' | 'details' | 'genus' | 'effect' | 'mosslaxEffect';
export type TranslationMap = Record<string, Partial<Record<TranslationField, string>>>;

export interface Language {
  code: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export function setApiBaseUrl(value: unknown): void {
  if (typeof value === 'string' && value.trim() !== '') {
    apiBaseUrl = value.trim();
  }
}

export type SystemWordingSurface = 'frontend' | 'backend' | 'email';

export interface SystemWording {
  key: string;
  module: string;
  surface: SystemWordingSurface;
  description: string;
  placeholders: string[];
  value: string;
  defaultValue: string;
  missing: boolean;
  updatedAt: string | null;
  updatedBy: UserSummary | null;
}

export interface NamedEntity {
  id: number;
  name: string;
  baseName?: string;
  translations?: TranslationMap;
}

export interface LifeCategory extends NamedEntity {
  isDefault: boolean;
  isRateable: boolean;
}

export interface GameVersion extends NamedEntity {
  changeLog: string;
}

export interface Skill extends NamedEntity {
  hasItemDrop: boolean;
  hasTrading: boolean;
}

export type TradingPreference = 'like' | 'neutral';

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

export interface ProjectUpdatesRepository {
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  updatedAt: string | null;
}

export interface ProjectUpdateCommit {
  sha: string;
  shortSha: string;
  title: string;
  message: string;
  createdAt: string;
  authorName: string;
  url: string;
}

export interface ProjectUpdateRelease {
  tagName: string;
  name: string;
  publishedAt: string | null;
  url: string;
}

export interface ProjectCommitPage {
  items: ProjectUpdateCommit[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ProjectUpdates {
  repository: ProjectUpdatesRepository;
  commits: ProjectCommitPage;
  releases: ProjectUpdateRelease[];
}

export interface ProjectUpdatesParams {
  cursor?: string | null;
  limit?: number;
}

export interface ListPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PublicListParams {
  cursor?: string | null;
  limit?: number;
}

export type PublicListQueryParams = Record<string, string | number | boolean | null | undefined> & PublicListParams;

export interface EntityImage {
  path: string;
  url: string;
}

export interface EntityImageUpload extends EntityImage {
  id: number;
  uploadedAt: string;
  uploadedBy: UserSummary | null;
}

export type ImageUploadEntityType = 'pokemon' | 'items' | 'habitats' | 'ancient-artifacts';

export interface PokemonImage extends EntityImage {
  style: string;
  version: string;
  variant: string;
  description: string;
  source?: 'sprite' | 'upload';
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
  dataId?: number | null;
  dataIdentifier?: string;
  displayId: number;
  name: string;
  baseName?: string;
  isEventItem: boolean;
  genus: string;
  baseGenus?: string;
  details: string;
  baseDetails?: string;
  heightInches: number;
  heightMeters: number;
  weightPounds: number;
  weightKg: number;
  image: PokemonImage | null;
  translations?: TranslationMap;
  types: NamedEntity[];
  stats: PokemonStats;
  environment: NamedEntity;
  skills: Skill[];
  favorite_things: NamedEntity[];
}

export interface PokemonTradingItem extends NamedEntity {
  itemId: number;
  preference: TradingPreference;
  image?: EntityImage | null;
}

export interface RelatedPokemon {
  id: number;
  displayId: number;
  name: string;
  isEventItem: boolean;
  image?: PokemonImage | null;
  environment: NamedEntity;
  skills: Skill[];
  favorite_things: Array<NamedEntity & { matches: boolean }>;
}

export interface PokemonDetail extends Pokemon {
  skills: Array<Skill & { itemDrop: (NamedEntity & { image?: EntityImage | null }) | null }>;
  favoriteThingItems: Array<NamedEntity & { image?: EntityImage | null; category: NamedEntity; tags: NamedEntity[] }>;
  tradingItems: PokemonTradingItem[];
  relatedPokemon: RelatedPokemon[];
  editHistory: EditHistoryEntry[];
  imageHistory: EntityImageUpload[];
  habitats: Array<{
    id: number;
    name: string;
    image?: EntityImage | null;
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
  isEventItem: boolean;
  translations?: TranslationMap;
  image: EntityImage | null;
  recipe: Array<NamedEntity & { image?: EntityImage | null; quantity: number }>;
  pokemon?: NamedEntity[];
}

export interface HabitatDetail extends Habitat {
  editHistory: EditHistoryEntry[];
  imageHistory: EntityImageUpload[];
  pokemon: Array<NamedEntity & {
    displayId: number;
    isEventItem: boolean;
    image?: PokemonImage | null;
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
  image?: EntityImage | null;
  materials: Array<NamedEntity & { image?: EntityImage | null; quantity: number }>;
}

export interface HabitatUsage {
  id: number;
  name: string;
  image?: EntityImage | null;
  recipe: Array<NamedEntity & { image?: EntityImage | null; quantity: number }>;
}

export interface RecipeResultItem extends NamedEntity {
  image?: EntityImage | null;
  category?: NamedEntity;
  usage?: NamedEntity | null;
}

export interface Item extends EditInfo {
  id: number;
  name: string;
  baseName?: string;
  details: string;
  baseDetails?: string;
  basePrice: number | null;
  ancientArtifactCategory: NamedEntity | null;
  isEventItem: boolean;
  translations?: TranslationMap;
  image: EntityImage | null;
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

export interface AncientArtifact extends EditInfo {
  id: number;
  name: string;
  baseName?: string;
  details: string;
  baseDetails?: string;
  translations?: TranslationMap;
  category: NamedEntity;
  tags: NamedEntity[];
  image: EntityImage | null;
}

export interface AncientArtifactDetail extends AncientArtifact {
  editHistory: EditHistoryEntry[];
  imageHistory: EntityImageUpload[];
}

export interface ItemDetail extends Item {
  acquisitionMethods: NamedEntity[];
  recipe: RecipeDetail | null;
  relatedRecipes: RecipeUsage[];
  relatedHabitats: HabitatUsage[];
  possibleTags: ItemPossibleTags;
  editHistory: EditHistoryEntry[];
  imageHistory: EntityImageUpload[];
  droppedByPokemon: Array<{
    pokemon: NamedEntity & { displayId: number; isEventItem: boolean; image?: PokemonImage | null };
    skill: NamedEntity;
  }>;
}

export interface ItemPossibleTags {
  highlyLikely: NamedEntity[];
  possible: NamedEntity[];
  excluded: NamedEntity[];
  evidence: {
    likes: ItemPossibleTagEvidence[];
    neutral: ItemPossibleTagEvidence[];
  };
}

export interface ItemPossibleTagEvidence {
  pokemon: NamedEntity & { displayId: number; isEventItem: boolean; image?: PokemonImage | null };
  preference: TradingPreference;
  tags: NamedEntity[];
}

export interface Recipe extends EditInfo {
  id: number;
  name: string;
  materials: Array<NamedEntity & { image?: EntityImage | null; quantity: number }>;
}

export interface ItemLink extends NamedEntity {
  image?: EntityImage | null;
  category?: NamedEntity;
}

export interface Dish extends EditInfo {
  id: number;
  flavor: NamedEntity;
  mosslaxEffect: string;
  baseMosslaxEffect?: string;
  translations?: TranslationMap;
  category: NamedEntity;
  item: ItemLink;
  secondaryMaterials: ItemLink[];
  pokemonSkill: Skill | null;
}

export interface DishCategory extends EditInfo {
  id: number;
  name: string;
  baseName?: string;
  effect: string;
  baseEffect?: string;
  translations?: TranslationMap;
  cookware: ItemLink;
  mainMaterial: ItemLink;
  totalMaterialQuantity: number;
  dishes: Dish[];
}

export interface DailyChecklistItem {
  id: number;
  title: string;
  baseTitle?: string;
  translations?: TranslationMap;
}

export type GlobalSearchGroupType =
  | 'pokemon'
  | 'habitats'
  | 'items'
  | 'ancient-artifacts'
  | 'recipes'
  | 'daily-checklist'
  | 'life'
  | 'users';

export interface GlobalSearchItem {
  id: number;
  type: GlobalSearchGroupType;
  title: string;
  url: string;
  summary: string | null;
  meta: string | null;
  image: EntityImage | PokemonImage | null;
}

export interface GlobalSearchGroup {
  type: GlobalSearchGroupType;
  items: GlobalSearchItem[];
}

export interface GlobalSearchResults {
  query: string;
  groups: GlobalSearchGroup[];
}

export type DataToolScope = 'pokemon' | 'habitats' | 'items' | 'artifacts' | 'recipes' | 'checklist';

export interface DataToolScopeSummary {
  scope: DataToolScope;
  count: number;
}

export interface DataToolsSummary {
  scopes: DataToolScopeSummary[];
}

export interface DataToolsBundle {
  version: 1;
  exportedAt: string;
  scopes: DataToolScope[];
  data: Partial<Record<DataToolScope, Record<string, unknown[]>>>;
}

export type LifeReactionType = 'like' | 'helpful' | 'fun' | 'thanks';
export type LifeReactionCounts = Record<LifeReactionType, number>;
export type AiModerationStatus = 'unreviewed' | 'reviewing' | 'approved' | 'rejected' | 'failed';
export type NotificationType =
  | 'life_post_comment'
  | 'life_comment_reply'
  | 'discussion_comment_reply'
  | 'life_post_reaction'
  | 'user_follow'
  | 'moderation_result';
export type NotificationModerationStatus = Extract<AiModerationStatus, 'approved' | 'rejected' | 'failed'>;
export type NotificationTargetType = 'life-post' | 'life-comment' | 'discussion-comment' | 'profile-user';

export interface LifePost {
  id: number;
  body: string;
  moderationStatus: AiModerationStatus;
  moderationLanguageCode: string | null;
  moderationReason: string | null;
  createdAt: string;
  updatedAt: string;
  author: UserSummary | null;
  updatedBy: UserSummary | null;
  category: (NamedEntity & { isRateable: boolean }) | null;
  gameVersion: GameVersion | null;
  ratingAverage: number | null;
  ratingCount: number;
  myRating: number | null;
  commentPreview: LifeComment[];
  commentCount: number;
  reactionCounts: LifeReactionCounts;
  myReaction: LifeReactionType | null;
}

export interface LifePostsPage {
  items: LifePost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface LifePostsParams {
  cursor?: string | null;
  limit?: number;
  search?: string;
  categoryId?: string | number;
  language?: string;
  gameVersionId?: string | number;
  rateable?: boolean | null;
  sort?: 'latest' | 'oldest' | 'top-rated';
}

export interface CommentPageParams {
  cursor?: string | null;
  limit?: number;
  language?: string;
  sort?: CommentSort;
}

export type CommentSort = 'oldest' | 'latest' | 'most-liked' | 'most-replied';

export interface LifeComment {
  id: number;
  postId: number;
  parentCommentId: number | null;
  body: string;
  deleted: boolean;
  moderationStatus: AiModerationStatus;
  moderationLanguageCode: string | null;
  moderationReason: string | null;
  createdAt: string;
  updatedAt: string;
  author: UserSummary | null;
  likeCount: number;
  replyCount: number;
  myLiked: boolean;
  replies: LifeComment[];
}

export interface LifeCommentsPage {
  items: LifeComment[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface LifeReactionUser {
  user: UserSummary;
  reactionType: LifeReactionType;
  reactedAt: string;
}

export interface LifeReactionUsersPage {
  items: LifeReactionUser[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface LifeReactionUsersParams {
  cursor?: string | null;
  limit?: number;
  reactionType?: LifeReactionType;
}

export interface NotificationTarget {
  type: NotificationTargetType;
  id: number;
  path: string;
  lifePostId: number | null;
  profileUserId: number | null;
  lifeCommentId: number | null;
  discussionCommentId: number | null;
  entityType: DiscussionEntityType | null;
  entityId: number | null;
}

export interface NotificationItem {
  id: number;
  type: NotificationType;
  actor: UserSummary | null;
  target: NotificationTarget;
  reactionType: LifeReactionType | null;
  moderationStatus: NotificationModerationStatus | null;
  moderationReason: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsPage {
  items: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  unreadCount: number;
}

export interface NotificationsParams {
  cursor?: string | null;
  limit?: number;
}

export interface NotificationReadResponse {
  notification: NotificationItem | null;
  unreadCount: number;
}

export interface NotificationWsTicket {
  ticket: string;
  expiresAt: string;
}

export type NotificationWsMessage =
  | { type: 'notifications.connected'; unreadCount: number }
  | { type: 'notifications.created'; notification: NotificationItem; unreadCount: number }
  | { type: 'notifications.unread'; unreadCount: number }
  | {
      type: 'moderation.updated';
      target: NotificationTarget;
      moderationStatus: NotificationModerationStatus;
      moderationLanguageCode: string | null;
      moderationReason: string | null;
    };

export const moderationUpdateEvent = 'pokopia-moderation-update';

export type ModerationUpdateDetail = Extract<NotificationWsMessage, { type: 'moderation.updated' }>;

export interface RecipeDetail extends Recipe {
  acquisition_methods: NamedEntity[];
  editHistory: EditHistoryEntry[];
  item: RecipeResultItem;
}

export interface Options {
  pokemonTypes: NamedEntity[];
  skills: Skill[];
  environments: NamedEntity[];
  favoriteThings: NamedEntity[];
  itemCategories: NamedEntity[];
  itemUsages: NamedEntity[];
  ancientArtifactCategories: NamedEntity[];
  acquisitionMethods: NamedEntity[];
  itemTags: NamedEntity[];
  maps: NamedEntity[];
  lifeCategories: LifeCategory[];
  gameVersions: GameVersion[];
  dishFlavors: NamedEntity[];
}

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  emailVerified: boolean;
  roles: RoleSummary[];
  permissions: string[];
}

export interface ReferralSummary {
  code: string;
  url: string;
  verifiedReferralCount: number;
}

export interface PublicProfileUser extends UserSummary {
  joinedAt: string;
}

export interface PublicProfileStats {
  wikiEdits: number;
  wikiCreates: number;
  wikiUpdates: number;
  wikiDeletes: number;
  imageUploads: number;
  lifePosts: number;
  lifeComments: number;
  lifeReactions: number;
  discussionComments: number;
}

export interface PublicProfileContribution {
  contentType: string;
  total: number;
  creates: number;
  updates: number;
  deletes: number;
  lastContributedAt: string | null;
}

export type PublicProfileViewerRelation = 'none' | 'following' | 'followed-by' | 'friends';

export interface PublicProfileSocial {
  followerCount: number;
  followingCount: number;
  friendCount: number;
  viewerRelation: PublicProfileViewerRelation;
}

export interface PublicUserProfile {
  user: PublicProfileUser;
  stats: PublicProfileStats;
  social: PublicProfileSocial;
  contributions: PublicProfileContribution[];
}

export type ProfileCommentSource = 'life' | 'discussion';

export interface ProfileActivityParams {
  cursor?: string | null;
  limit?: number;
  reactionType?: LifeReactionType;
  source?: ProfileCommentSource;
}

export interface UserReactionActivity {
  postId: number;
  reactionType: LifeReactionType;
  reactedAt: string;
  post: LifePost;
}

export interface UserReactionActivityPage {
  items: UserReactionActivity[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface RoleSummary {
  id: number;
  key: string;
  name: string;
  level: number;
}

export interface RoleDetail extends RoleSummary {
  description: string;
  enabled: boolean;
  systemRole: boolean;
  permissionIds: number[];
}

export interface Permission {
  id: number;
  key: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  systemPermission: boolean;
}

export interface AdminUser extends AuthUser {
  roleIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface RolePayload {
  key?: string;
  name: string;
  description: string;
  level: number;
  enabled: boolean;
}

export interface PermissionPayload {
  key?: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

export interface UserProfilePayload {
  displayName: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload extends LoginPayload {
  displayName: string;
  referralCode?: string;
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
  | 'acquisition-methods'
  | 'maps'
  | 'life-tags'
  | 'game-versions'
  | 'dish-flavors';

export interface PokemonPayload {
  dataId?: number | null;
  dataIdentifier?: string;
  displayId: number;
  isEventItem: boolean;
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
  tradingItems: Array<{ itemId: number; preference: TradingPreference }>;
  imagePath: string;
}

export interface PokemonFetchResult {
  id: number;
  identifier: string;
  name: string;
  genus: string;
  heightInches: number;
  weightPounds: number;
  translations?: TranslationMap;
  typeIds: number[];
  stats: PokemonStats;
}

export interface PokemonFetchOption {
  id: number;
  identifier: string;
  name: string;
}

export interface PokemonImageOptionsResult {
  id: number;
  identifier: string;
  images: PokemonImage[];
}

export interface ItemPayload {
  name: string;
  details: string;
  basePrice: number | null;
  ancientArtifactCategoryId: number | null;
  translations?: TranslationMap;
  categoryId: number;
  usageId: number | null;
  dyeable: boolean;
  dualDyeable: boolean;
  patternEditable: boolean;
  noRecipe: boolean;
  isEventItem: boolean;
  acquisitionMethodIds: number[];
  tagIds: number[];
  imagePath: string;
  insertBeforeItemId?: number | null;
  insertAfterItemId?: number | null;
}

export interface AncientArtifactPayload {
  name: string;
  details: string;
  translations?: TranslationMap;
  categoryId: number;
  tagIds: number[];
  imagePath: string;
}

export interface RecipePayload {
  itemId: number;
  acquisitionMethodIds: number[];
  materials: Array<{ itemId: number; quantity: number }>;
}

export interface DishCategoryPayload {
  name: string;
  effect: string;
  translations?: TranslationMap;
  cookwareItemId: number;
  mainMaterialItemId: number;
  totalMaterialQuantity: number;
}

export interface DishPayload {
  categoryId: number;
  itemId: number;
  flavorId: number;
  secondaryMaterialItemIds: number[];
  pokemonSkillId: number | null;
  mosslaxEffect: string;
  translations?: TranslationMap;
}

export interface HabitatPayload {
  name: string;
  translations?: TranslationMap;
  isEventItem: boolean;
  imagePath: string;
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
  categoryId: number;
  gameVersionId?: number | null;
  languageCode?: string | null;
}

export interface LifeCommentPayload {
  body: string;
  languageCode?: string | null;
}

export type DiscussionEntityType = 'pokemon' | 'items' | 'recipes' | 'habitats' | 'ancient-artifacts';

export interface EntityDiscussionComment {
  id: number;
  entityType: DiscussionEntityType;
  entityId: number;
  parentCommentId: number | null;
  body: string;
  deleted: boolean;
  moderationStatus: AiModerationStatus;
  moderationLanguageCode: string | null;
  moderationReason: string | null;
  createdAt: string;
  updatedAt: string;
  author: UserSummary | null;
  likeCount: number;
  replyCount: number;
  myLiked: boolean;
  replies: EntityDiscussionComment[];
}

export interface EntityDiscussionCommentsPage {
  items: EntityDiscussionComment[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface UserCommentActivity {
  id: number;
  source: ProfileCommentSource;
  body: string;
  createdAt: string;
  target: {
    type: 'life-post' | DiscussionEntityType;
    id: number;
    title: string;
    excerpt: string;
  };
}

export interface UserCommentActivityPage {
  items: UserCommentActivity[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface EntityDiscussionCommentPayload {
  body: string;
  languageCode?: string | null;
}

export type AiModerationApiFormat = 'gemini-generate-content' | 'openai-chat-completions';
export type AiModerationAuthMode = 'query-key' | 'bearer-token';
export type RateLimitPolicyKey = 'accountWrite' | 'adminWrite' | 'communityReaction' | 'communityWrite' | 'fetch' | 'upload' | 'wikiWrite';

export interface AiModerationSettings {
  enabled: boolean;
  apiFormat: AiModerationApiFormat;
  authMode: AiModerationAuthMode;
  endpoint: string;
  model: string;
  requestsPerMinute: number;
  apiKeyConfigured: boolean;
  updatedAt: string;
  updatedBy: UserSummary | null;
}

export interface AiModerationSettingsPayload {
  enabled: boolean;
  apiFormat: AiModerationApiFormat;
  authMode: AiModerationAuthMode;
  endpoint: string;
  model: string;
  requestsPerMinute: number;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface RateLimitPolicySettings {
  maxRequests: number;
  timeWindowSeconds: number;
  cooldownSeconds: number;
}

export interface RateLimitSettings {
  policies: Record<RateLimitPolicyKey, RateLimitPolicySettings>;
  updatedAt: string | null;
  updatedBy: UserSummary | null;
}

export interface RateLimitSettingsPayload {
  policies: Record<RateLimitPolicyKey, RateLimitPolicySettings>;
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

function authStorage(type: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return type === 'local' ? window.localStorage : window.sessionStorage;
}

export function getAuthToken(): string | null {
  const sessionToken = authStorage('session')?.getItem(authTokenKey);
  return sessionToken ?? authStorage('local')?.getItem(authTokenKey) ?? null;
}

export function setAuthToken(token: string | null, options: { persistent?: boolean } = {}): void {
  const local = authStorage('local');
  const session = authStorage('session');

  if (token) {
    if (options.persistent === false) {
      session?.setItem(authTokenKey, token);
      local?.removeItem(authTokenKey);
    } else {
      local?.setItem(authTokenKey, token);
      session?.removeItem(authTokenKey);
    }
  } else {
    local?.removeItem(authTokenKey);
    session?.removeItem(authTokenKey);
  }

  notifyAuthChange();
}

export function onAuthTokenChange(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener(authChangeEvent, callback);
  return () => window.removeEventListener(authChangeEvent, callback);
}

export function notifyAuthChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(authChangeEvent));
  }
}

function requestHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'X-Locale': getCurrentLocale(),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export function notificationWebSocketUrl(ticket: string): string {
  const base = new URL(apiBaseUrl, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = '/api/notifications/ws';
  base.search = '';
  base.searchParams.set('ticket', ticket);
  return base.toString();
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

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: requestHeaders(),
    signal
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function sendJson<T>(path: string, method: 'PATCH' | 'POST' | 'PUT', body: unknown): Promise<T> {
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

async function sendFormData<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: requestHeaders(),
    body
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

async function deleteAndGetJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'DELETE',
    headers: requestHeaders()
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export const api = {
  globalSearch: (query: string, signal?: AbortSignal) =>
    getJson<GlobalSearchResults>(`/api/search${buildQuery({ query: query.trim() })}`, signal),
  languages: () => getJson<Language[]>('/api/languages'),
  projectUpdates: (params: ProjectUpdatesParams = {}) =>
    getJson<ProjectUpdates>(
      `/api/project-updates${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit
      })}`
    ),
  adminLanguages: () => getJson<Language[]>('/api/admin/languages'),
  createLanguage: (payload: Omit<Language, 'sortOrder'> & { sortOrder?: number }) =>
    sendJson<Language[]>('/api/admin/languages', 'POST', payload),
  updateLanguage: (code: string, payload: Partial<Language> & { name: string }) =>
    sendJson<Language[]>(`/api/admin/languages/${code}`, 'PUT', payload),
  reorderLanguages: (codes: string[]) => sendJson<Language[]>('/api/admin/languages/order', 'PUT', { codes }),
  deleteLanguage: (code: string) => deleteJson(`/api/admin/languages/${code}`),
  systemWordings: (params: { locale?: string; module?: string; surface?: string; missing?: string } = {}) =>
    getJson<SystemWording[]>(`/api/admin/system-wordings${buildQuery(params)}`),
  updateSystemWording: (key: string, payload: { locale: string; value: string }) =>
    sendJson<SystemWording[]>(`/api/admin/system-wordings/${encodeURIComponent(key)}`, 'PUT', payload),
  aiModerationSettings: () => getJson<AiModerationSettings>('/api/admin/ai-moderation'),
  updateAiModerationSettings: (payload: AiModerationSettingsPayload) =>
    sendJson<AiModerationSettings>('/api/admin/ai-moderation', 'PUT', payload),
  rateLimitSettings: () => getJson<RateLimitSettings>('/api/admin/rate-limits'),
  updateRateLimitSettings: (payload: RateLimitSettingsPayload) =>
    sendJson<RateLimitSettings>('/api/admin/rate-limits', 'PUT', payload),
  dataToolsSummary: () => getJson<DataToolsSummary>('/api/admin/data-tools/summary'),
  exportDataTools: (scopes: DataToolScope[]) => sendJson<DataToolsBundle>('/api/admin/data-tools/export', 'POST', { scopes }),
  importDataTools: (bundle: DataToolsBundle) => sendJson<DataToolsSummary>('/api/admin/data-tools/import', 'POST', { bundle }),
  importItemsCsvDataTools: (csv: string) => sendJson<DataToolsSummary>('/api/admin/data-tools/import-items-csv', 'POST', { csv }),
  importHabitatsCsvDataTools: (csv: string) => sendJson<DataToolsSummary>('/api/admin/data-tools/import-habitats-csv', 'POST', { csv }),
  wipeDataTools: (scopes: DataToolScope[]) => sendJson<DataToolsSummary>('/api/admin/data-tools/wipe', 'POST', { scopes }),
  register: (payload: RegisterPayload) => sendJson<{ message: string }>('/api/auth/register', 'POST', payload),
  verifyEmail: (token: string) =>
    sendJson<{ message: string; user: AuthUser }>('/api/auth/verify-email', 'POST', { token }),
  login: (payload: LoginPayload) => sendJson<AuthResponse>('/api/auth/login', 'POST', payload),
  requestPasswordReset: (payload: { email: string }) =>
    sendJson<{ message: string }>('/api/auth/request-password-reset', 'POST', payload),
  resetPassword: (payload: { token: string; password: string }) =>
    sendJson<{ message: string }>('/api/auth/reset-password', 'POST', payload),
  me: () => getJson<{ user: AuthUser }>('/api/auth/me'),
  updateMe: (payload: UserProfilePayload) => sendJson<{ user: AuthUser }>('/api/auth/me', 'PATCH', payload),
  changePassword: (payload: ChangePasswordPayload) =>
    sendJson<{ message: string }>('/api/auth/me/password', 'PATCH', payload),
  referral: () => getJson<{ referral: ReferralSummary }>('/api/auth/referral'),
  notifications: (params: NotificationsParams = {}) =>
    getJson<NotificationsPage>(
      `/api/notifications${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit
      })}`
    ),
  notificationWsTicket: () => sendJson<NotificationWsTicket>('/api/notifications/ws-ticket', 'POST', {}),
  markNotificationRead: (id: string | number) =>
    sendJson<NotificationReadResponse>(`/api/notifications/${id}/read`, 'POST', {}),
  markAllNotificationsRead: () => sendJson<{ unreadCount: number }>('/api/notifications/read-all', 'POST', {}),
  logout: () => postEmpty('/api/auth/logout'),
  publicProfile: (id: string | number) => getJson<{ profile: PublicUserProfile }>(`/api/users/${id}/profile`),
  followUser: (id: string | number) => sendJson<{ profile: PublicUserProfile }>(`/api/users/${id}/follow`, 'PUT', {}),
  unfollowUser: (id: string | number) => deleteAndGetJson<{ profile: PublicUserProfile }>(`/api/users/${id}/follow`),
  followingLifePosts: (params: LifePostsParams = {}) =>
    getJson<LifePostsPage>(
      `/api/life-posts/following${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit,
        search: params.search,
        categoryId: params.categoryId,
        language: params.language,
        gameVersionId: params.gameVersionId,
        rateable: params.rateable === null ? undefined : params.rateable,
        sort: params.sort
      })}`
    ),
  userLifePosts: (id: string | number, params: ProfileActivityParams = {}) =>
    getJson<LifePostsPage>(
      `/api/users/${id}/life-posts${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit
      })}`
    ),
  userReactions: (id: string | number, params: ProfileActivityParams = {}) =>
    getJson<UserReactionActivityPage>(
      `/api/users/${id}/reactions${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit,
        reactionType: params.reactionType
      })}`
    ),
  userComments: (id: string | number, params: ProfileActivityParams = {}) =>
    getJson<UserCommentActivityPage>(
      `/api/users/${id}/comments${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit,
        source: params.source
      })}`
    ),
  adminUsers: () => getJson<AdminUser[]>('/api/admin/users'),
  updateAdminUserRoles: (id: string | number, roleIds: number[]) =>
    sendJson<AdminUser[]>(`/api/admin/users/${id}/roles`, 'PUT', { roleIds }),
  roles: () => getJson<RoleDetail[]>('/api/admin/roles'),
  createRole: (payload: RolePayload & { key: string }) => sendJson<RoleDetail[]>('/api/admin/roles', 'POST', payload),
  updateRole: (id: string | number, payload: RolePayload) =>
    sendJson<RoleDetail[]>(`/api/admin/roles/${id}`, 'PUT', payload),
  updateRolePermissions: (id: string | number, permissionIds: number[]) =>
    sendJson<RoleDetail[]>(`/api/admin/roles/${id}/permissions`, 'PUT', { permissionIds }),
  deleteRole: (id: string | number) => deleteJson(`/api/admin/roles/${id}`),
  permissions: () => getJson<Permission[]>('/api/admin/permissions'),
  createPermission: (payload: PermissionPayload & { key: string }) =>
    sendJson<Permission[]>('/api/admin/permissions', 'POST', payload),
  updatePermission: (id: string | number, payload: PermissionPayload) =>
    sendJson<Permission[]>(`/api/admin/permissions/${id}`, 'PUT', payload),
  deletePermission: (id: string | number) => deleteJson(`/api/admin/permissions/${id}`),
  options: () => getJson<Options>('/api/options'),
  dailyChecklist: () => getJson<DailyChecklistItem[]>('/api/daily-checklist'),
  dailyChecklistPage: (params: PublicListParams = {}) =>
    getJson<ListPage<DailyChecklistItem>>(
      `/api/daily-checklist${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit
      })}`
    ),
  lifePosts: (params: LifePostsParams = {}) =>
    getJson<LifePostsPage>(
      `/api/life-posts${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit,
        search: params.search?.trim(),
        categoryId: params.categoryId,
        language: params.language,
        gameVersionId: params.gameVersionId,
        rateable: params.rateable === null ? undefined : params.rateable,
        sort: params.sort
      })}`
    ),
  lifePost: (id: string | number) => getJson<LifePost>(`/api/life-posts/${id}`),
  createLifePost: (payload: LifePostPayload) => sendJson<LifePost>('/api/life-posts', 'POST', payload),
  updateLifePost: (id: string | number, payload: LifePostPayload) =>
    sendJson<LifePost>(`/api/life-posts/${id}`, 'PUT', payload),
  retryLifePostModeration: (id: string | number) =>
    sendJson<LifePost>(`/api/life-posts/${id}/moderation/retry`, 'POST', {}),
  deleteLifePost: (id: string | number) => deleteJson(`/api/life-posts/${id}`),
  setLifeReaction: (id: string | number, reactionType: LifeReactionType) =>
    sendJson<LifePost>(`/api/life-posts/${id}/reaction`, 'PUT', { reactionType }),
  deleteLifeReaction: (id: string | number) => deleteAndGetJson<LifePost>(`/api/life-posts/${id}/reaction`),
  lifeReactionUsers: (id: string | number, params: LifeReactionUsersParams = {}) =>
    getJson<LifeReactionUsersPage>(
      `/api/life-posts/${id}/reactions${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit,
        reactionType: params.reactionType
      })}`
    ),
  setLifeRating: (id: string | number, rating: number) =>
    sendJson<LifePost>(`/api/life-posts/${id}/rating`, 'PUT', { rating }),
  deleteLifeRating: (id: string | number) => deleteAndGetJson<LifePost>(`/api/life-posts/${id}/rating`),
  createLifeComment: (postId: string | number, payload: LifeCommentPayload) =>
    sendJson<LifeComment>(`/api/life-posts/${postId}/comments`, 'POST', payload),
  lifeComments: (postId: string | number, params: CommentPageParams = {}) =>
    getJson<LifeCommentsPage>(
      `/api/life-posts/${postId}/comments${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit,
        language: params.language,
        sort: params.sort
      })}`
    ),
  createLifeCommentReply: (postId: string | number, commentId: string | number, payload: LifeCommentPayload) =>
    sendJson<LifeComment>(`/api/life-posts/${postId}/comments/${commentId}/replies`, 'POST', payload),
  retryLifeCommentModeration: (id: string | number) =>
    sendJson<LifeComment>(`/api/life-comments/${id}/moderation/retry`, 'POST', {}),
  restoreLifeComment: (id: string | number) => sendJson<LifeComment>(`/api/life-comments/${id}/restore`, 'POST', {}),
  setLifeCommentLike: (id: string | number) => sendJson<LifeComment>(`/api/life-comments/${id}/like`, 'PUT', {}),
  deleteLifeCommentLike: (id: string | number) => deleteAndGetJson<LifeComment>(`/api/life-comments/${id}/like`),
  deleteLifeComment: (id: string | number) => deleteJson(`/api/life-comments/${id}`),
  entityDiscussion: (entityType: DiscussionEntityType, entityId: string | number, params: CommentPageParams = {}) =>
    getJson<EntityDiscussionCommentsPage>(
      `/api/discussions/${entityType}/${entityId}/comments${buildQuery({
        cursor: params.cursor ?? undefined,
        limit: params.limit,
        language: params.language,
        sort: params.sort
      })}`
    ),
  createEntityDiscussionComment: (
    entityType: DiscussionEntityType,
    entityId: string | number,
    payload: EntityDiscussionCommentPayload
  ) => sendJson<EntityDiscussionComment>(`/api/discussions/${entityType}/${entityId}/comments`, 'POST', payload),
  createEntityDiscussionReply: (
    entityType: DiscussionEntityType,
    entityId: string | number,
    commentId: string | number,
    payload: EntityDiscussionCommentPayload
  ) => sendJson<EntityDiscussionComment>(`/api/discussions/${entityType}/${entityId}/comments/${commentId}/replies`, 'POST', payload),
  retryEntityDiscussionModeration: (id: string | number) =>
    sendJson<EntityDiscussionComment>(`/api/discussions/comments/${id}/moderation/retry`, 'POST', {}),
  setEntityDiscussionCommentLike: (id: string | number) =>
    sendJson<EntityDiscussionComment>(`/api/discussions/comments/${id}/like`, 'PUT', {}),
  deleteEntityDiscussionCommentLike: (id: string | number) =>
    deleteAndGetJson<EntityDiscussionComment>(`/api/discussions/comments/${id}/like`),
  deleteEntityDiscussionComment: (id: string | number) => deleteJson(`/api/discussions/comments/${id}`),
  uploadImage: (
    entityType: ImageUploadEntityType,
    payload: { file: File; entityName: string; entityId?: string | number | null }
  ) => {
    const body = new FormData();
    body.set('entityName', payload.entityName);
    if (payload.entityId) {
      body.set('entityId', String(payload.entityId));
    }
    body.set('file', payload.file);
    return sendFormData<EntityImageUpload>(`/api/uploads/${entityType}`, body);
  },
  createDailyChecklistItem: (payload: DailyChecklistPayload) =>
    sendJson<DailyChecklistItem>('/api/admin/daily-checklist', 'POST', payload),
  updateDailyChecklistItem: (id: string | number, payload: DailyChecklistPayload) =>
    sendJson<DailyChecklistItem>(`/api/admin/daily-checklist/${id}`, 'PUT', payload),
  reorderDailyChecklistItems: (ids: number[]) =>
    sendJson<DailyChecklistItem[]>('/api/admin/daily-checklist/order', 'PUT', { ids }),
  deleteDailyChecklistItem: (id: string | number) => deleteJson(`/api/admin/daily-checklist/${id}`),
  config: (type: ConfigType) => getJson<Array<Skill | LifeCategory | GameVersion | NamedEntity>>(`/api/admin/config/${type}`),
  createConfig: (
    type: ConfigType,
    payload: { name: string; translations?: TranslationMap; hasItemDrop?: boolean; hasTrading?: boolean; isDefault?: boolean; isRateable?: boolean; changeLog?: string }
  ) =>
    sendJson<Skill | LifeCategory | GameVersion | NamedEntity>(`/api/admin/config/${type}`, 'POST', payload),
  reorderConfig: (type: ConfigType, ids: number[]) =>
    sendJson<Array<Skill | LifeCategory | GameVersion | NamedEntity>>(`/api/admin/config/${type}/order`, 'PUT', { ids }),
  updateConfig: (
    type: ConfigType,
    id: number,
    payload: { name: string; translations?: TranslationMap; hasItemDrop?: boolean; hasTrading?: boolean; isDefault?: boolean; isRateable?: boolean; changeLog?: string }
  ) =>
    sendJson<Skill | LifeCategory | GameVersion | NamedEntity>(`/api/admin/config/${type}/${id}`, 'PUT', payload),
  deleteConfig: (type: ConfigType, id: number) => deleteJson(`/api/admin/config/${type}/${id}`),
  pokemon: (params: Record<string, string | number | boolean | undefined>) =>
    getJson<Pokemon[]>(`/api/pokemon${buildQuery(params)}`),
  pokemonPage: (params: PublicListQueryParams) =>
    getJson<ListPage<Pokemon>>(
      `/api/pokemon${buildQuery({
        ...params,
        cursor: params.cursor ?? undefined,
        limit: params.limit
      })}`
    ),
  pokemonDetail: (id: string | number) => getJson<PokemonDetail>(`/api/pokemon/${id}`),
  pokemonFetchOptions: (search: string, signal?: AbortSignal, all = false) =>
    getJson<PokemonFetchOption[]>(
      `/api/pokemon/fetch-options${buildQuery({ search: search.trim(), all: all ? true : undefined })}`,
      signal
    ),
  fetchPokemonData: (identifier: string) => sendJson<PokemonFetchResult>('/api/pokemon/fetch', 'POST', { identifier }),
  fetchPokemonImageOptions: (identifier: string) =>
    sendJson<PokemonImageOptionsResult>('/api/pokemon/image-options', 'POST', { identifier }),
  createPokemon: (payload: PokemonPayload) => sendJson<PokemonDetail>('/api/pokemon', 'POST', payload),
  updatePokemon: (id: string | number, payload: PokemonPayload) =>
    sendJson<PokemonDetail>(`/api/pokemon/${id}`, 'PUT', payload),
  deletePokemon: (id: string | number) => deleteJson(`/api/pokemon/${id}`),
  reorderPokemon: (ids: number[]) => sendJson<Pokemon[]>('/api/admin/pokemon/order', 'PUT', { ids }),
  habitats: (params: Record<string, string | number | boolean | undefined> = {}) =>
    getJson<Habitat[]>(`/api/habitats${buildQuery(params)}`),
  habitatsPage: (params: PublicListQueryParams = {}) =>
    getJson<ListPage<Habitat>>(
      `/api/habitats${buildQuery({
        ...params,
        cursor: params.cursor ?? undefined,
        limit: params.limit
      })}`
    ),
  habitatDetail: (id: string | number) => getJson<HabitatDetail>(`/api/habitats/${id}`),
  createHabitat: (payload: HabitatPayload) => sendJson<HabitatDetail>('/api/habitats', 'POST', payload),
  updateHabitat: (id: string | number, payload: HabitatPayload) =>
    sendJson<HabitatDetail>(`/api/habitats/${id}`, 'PUT', payload),
  deleteHabitat: (id: string | number) => deleteJson(`/api/habitats/${id}`),
  reorderHabitats: (ids: number[]) => sendJson<Habitat[]>('/api/admin/habitats/order', 'PUT', { ids }),
  items: (params: Record<string, string | number | boolean | undefined>) =>
    getJson<Item[]>(`/api/items${buildQuery(params)}`),
  itemsPage: (params: PublicListQueryParams) =>
    getJson<ListPage<Item>>(
      `/api/items${buildQuery({
        ...params,
        cursor: params.cursor ?? undefined,
        limit: params.limit
      })}`
    ),
  itemDetail: (id: string | number) => getJson<ItemDetail>(`/api/items/${id}`),
  createItem: (payload: ItemPayload) => sendJson<ItemDetail>('/api/items', 'POST', payload),
  updateItem: (id: string | number, payload: ItemPayload) => sendJson<ItemDetail>(`/api/items/${id}`, 'PUT', payload),
  deleteItem: (id: string | number) => deleteJson(`/api/items/${id}`),
  reorderItems: (ids: number[]) => sendJson<Item[]>('/api/admin/items/order', 'PUT', { ids }),
  ancientArtifacts: (params: Record<string, string | number | undefined> = {}) =>
    getJson<AncientArtifact[]>(`/api/ancient-artifacts${buildQuery(params)}`),
  ancientArtifactsPage: (params: PublicListQueryParams = {}) =>
    getJson<ListPage<AncientArtifact>>(
      `/api/ancient-artifacts${buildQuery({
        ...params,
        cursor: params.cursor ?? undefined,
        limit: params.limit
      })}`
    ),
  ancientArtifactDetail: (id: string | number) => getJson<AncientArtifactDetail>(`/api/ancient-artifacts/${id}`),
  createAncientArtifact: (payload: AncientArtifactPayload) =>
    sendJson<AncientArtifactDetail>('/api/ancient-artifacts', 'POST', payload),
  updateAncientArtifact: (id: string | number, payload: AncientArtifactPayload) =>
    sendJson<AncientArtifactDetail>(`/api/ancient-artifacts/${id}`, 'PUT', payload),
  deleteAncientArtifact: (id: string | number) => deleteJson(`/api/ancient-artifacts/${id}`),
  reorderAncientArtifacts: (ids: number[]) =>
    sendJson<AncientArtifact[]>('/api/admin/ancient-artifacts/order', 'PUT', { ids }),
  recipes: (params: Record<string, string | number | undefined> = {}) =>
    getJson<Recipe[]>(`/api/recipes${buildQuery(params)}`),
  recipesPage: (params: PublicListQueryParams = {}) =>
    getJson<ListPage<Recipe>>(
      `/api/recipes${buildQuery({
        ...params,
        cursor: params.cursor ?? undefined,
        limit: params.limit
      })}`
    ),
  recipeDetail: (id: string | number) => getJson<RecipeDetail>(`/api/recipes/${id}`),
  createRecipe: (payload: RecipePayload) => sendJson<RecipeDetail>('/api/recipes', 'POST', payload),
  updateRecipe: (id: string | number, payload: RecipePayload) =>
    sendJson<RecipeDetail>(`/api/recipes/${id}`, 'PUT', payload),
  deleteRecipe: (id: string | number) => deleteJson(`/api/recipes/${id}`),
  reorderRecipes: (ids: number[]) => sendJson<Recipe[]>('/api/admin/recipes/order', 'PUT', { ids }),
  dish: () => getJson<DishCategory[]>('/api/dish'),
  createDishCategory: (payload: DishCategoryPayload) => sendJson<DishCategory>('/api/admin/dish/categories', 'POST', payload),
  updateDishCategory: (id: string | number, payload: DishCategoryPayload) =>
    sendJson<DishCategory>(`/api/admin/dish/categories/${id}`, 'PUT', payload),
  deleteDishCategory: (id: string | number) => deleteJson(`/api/admin/dish/categories/${id}`),
  reorderDishCategories: (ids: number[]) => sendJson<DishCategory[]>('/api/admin/dish/categories/order', 'PUT', { ids }),
  createDish: (payload: DishPayload) => sendJson<Dish>('/api/admin/dish/dishes', 'POST', payload),
  updateDish: (id: string | number, payload: DishPayload) =>
    sendJson<Dish>(`/api/admin/dish/dishes/${id}`, 'PUT', payload),
  deleteDish: (id: string | number) => deleteJson(`/api/admin/dish/dishes/${id}`),
  reorderDishes: (ids: number[]) => sendJson<DishCategory[]>('/api/admin/dish/dishes/order', 'PUT', { ids })
};
