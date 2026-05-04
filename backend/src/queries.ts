import { parseIdList, parseMatchMode, sqlForRelationFilter } from './filter.ts';
import { pool, query, queryOne } from './db.ts';
import {
  isUploadImagePath,
  linkEntityImageUpload,
  listEntityImageUploads,
  uploadImageUrl,
  uploadPublicBaseUrl
} from './uploads.ts';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import {
  requestAiModerationReview,
  type AiModerationStatus
} from './aiModeration.ts';
import { createLifePostReactionNotification, createUserFollowNotification } from './notifications.ts';

type QueryValue = string | string[] | undefined;

type QueryParams = Record<string, QueryValue>;

type DbClient = PoolClient;
type DataToolScope = 'pokemon' | 'habitats' | 'items' | 'artifacts' | 'recipes' | 'checklist';
type DataToolScopeSummary = {
  scope: DataToolScope;
  count: number;
};
type DataToolRows = Record<string, unknown>[];
type DataToolScopeData = Record<string, DataToolRows | undefined>;
type DataToolsBundle = {
  version: 1;
  exportedAt: string;
  scopes: DataToolScope[];
  data: Partial<Record<DataToolScope, DataToolScopeData>>;
};
type GlobalSearchGroupType =
  | 'pokemon'
  | 'habitats'
  | 'items'
  | 'ancient-artifacts'
  | 'recipes'
  | 'daily-checklist'
  | 'life'
  | 'users';
type GlobalSearchItem = {
  id: number;
  type: GlobalSearchGroupType;
  title: string;
  url: string;
  summary: string | null;
  meta: string | null;
  image: EntityImageValue | PokemonImage | null;
};
type GlobalSearchGroup = {
  type: GlobalSearchGroupType;
  items: GlobalSearchItem[];
};
type GlobalSearchResults = {
  query: string;
  groups: GlobalSearchGroup[];
};

type TranslationField = 'name' | 'title' | 'details' | 'genus' | 'effect' | 'mosslaxEffect';
type TranslationInput = Record<string, Partial<Record<TranslationField, unknown>>>;
type EntityType =
  | 'pokemon'
  | 'pokemon-types'
  | 'skills'
  | 'environments'
  | 'favorite-things'
  | 'item-categories'
  | 'item-usages'
  | 'acquisition-methods'
  | 'items'
  | 'ancient-artifacts'
  | 'maps'
  | 'habitats'
  | 'daily-checklist-items'
  | 'life-tags'
  | 'game-versions'
  | 'dish-categories'
  | 'dish-flavors'
  | 'dishes';

type ConfigType =
  | 'pokemon-types'
  | 'skills'
  | 'environments'
  | 'favorite-things'
  | 'acquisition-methods'
  | 'maps'
  | 'life-tags'
  | 'game-versions'
  | 'dish-flavors';

type ConfigDefinition = {
  table: string;
  entityType: EntityType;
  hasItemDrop?: boolean;
  hasDefault?: boolean;
  hasRateable?: boolean;
  hasChangeLog?: boolean;
};
type SortableContentType = 'pokemon' | 'items' | 'ancient-artifacts' | 'recipes' | 'habitats';
type SortableContentDefinition = {
  table: string;
  entityType: SortableContentType;
};

type IdQuantity = {
  itemId: number;
  quantity: number;
};

type SkillItemDrop = {
  skillId: number;
  itemId: number;
};

type PokemonStats = {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
};

type PokemonImage = {
  path: string;
  url: string;
  style: string;
  version: string;
  variant: string;
  description: string;
  source?: 'sprite' | 'upload';
};

type EntityImageValue = {
  path: string;
  url: string;
};

type PokemonImageCandidate = Omit<PokemonImage, 'url'>;

type PokemonImageOptionsResult = {
  id: number;
  identifier: string;
  images: PokemonImage[];
};

type PokemonPayload = {
  dataId: number | null;
  dataIdentifier: string;
  displayId: number;
  isEventItem: boolean;
  name: string;
  genus: string;
  details: string;
  heightInches: number;
  weightPounds: number;
  translations: TranslationInput;
  typeIds: number[];
  stats: PokemonStats;
  environmentId: number;
  skillIds: number[];
  favoriteThingIds: number[];
  skillItemDrops: SkillItemDrop[];
  image: PokemonImage | null;
};

type PokemonFetchResult = {
  id: number;
  identifier: string;
  name: string;
  genus: string;
  heightInches: number;
  weightPounds: number;
  translations: TranslationInput;
  typeIds: number[];
  stats: PokemonStats;
};

type PokemonFetchOption = {
  id: number;
  identifier: string;
  name: string;
};

type CsvRow = Record<string, string>;
type PokemonCsvData = {
  pokemonRows: CsvRow[];
  pokemonByLookup: Map<string, CsvRow>;
  namesByPokemonId: Map<number, CsvRow>;
  genusByPokemonId: Map<number, CsvRow>;
  typesById: Map<number, CsvRow>;
  canonicalTypeRows: CsvRow[];
};

type ItemPayload = {
  name: string;
  details: string;
  translations: TranslationInput;
  categoryId: number;
  categoryKey: string;
  usageId: number | null;
  usageKey: string | null;
  dyeable: boolean;
  dualDyeable: boolean;
  patternEditable: boolean;
  noRecipe: boolean;
  isEventItem: boolean;
  acquisitionMethodIds: number[];
  tagIds: number[];
  imagePath: string;
  insertBeforeItemId: number | null;
  insertAfterItemId: number | null;
};

type AncientArtifactPayload = {
  name: string;
  details: string;
  translations: TranslationInput;
  categoryId: number;
  categoryKey: string;
  tagIds: number[];
  imagePath: string;
};

type RecipePayload = {
  itemId: number;
  acquisitionMethodIds: number[];
  materials: IdQuantity[];
};

type DishCategoryPayload = {
  name: string;
  effect: string;
  translations: TranslationInput;
  cookwareItemId: number;
  mainMaterialItemId: number;
  totalMaterialQuantity: number;
};

type DishPayload = {
  categoryId: number;
  itemId: number;
  flavorId: number;
  secondaryMaterialItemIds: number[];
  pokemonSkillId: number | null;
  mosslaxEffect: string;
  translations: TranslationInput;
};

type DailyChecklistPayload = {
  title: string;
  translations: TranslationInput;
};

type LifePostPayload = {
  body: string;
  categoryId: number;
  gameVersionId: number | null;
  languageCode: string | null;
};

type LifeCommentPayload = {
  body: string;
  languageCode: string | null;
};

type DiscussionEntityType = 'pokemon' | 'items' | 'recipes' | 'habitats' | 'ancient-artifacts';
type DiscussionEntityDefinition = {
  table: string;
};
type EntityDiscussionCommentPayload = {
  body: string;
  languageCode: string | null;
};
type EntityDiscussionCommentRow = {
  id: number;
  entityType: DiscussionEntityType;
  entityId: number;
  parentCommentId: number | null;
  body: string;
  deleted: boolean;
  moderationStatus: AiModerationStatus;
  moderationLanguageCode: string | null;
  moderationReason: string | null;
  createdAt: Date;
  createdAtCursor?: string;
  updatedAt: Date;
  author: { id: number; displayName: string } | null;
  likeCount: number;
  replyCount: number;
  myLiked: boolean;
};
type EntityDiscussionComment = Omit<EntityDiscussionCommentRow, 'createdAtCursor'> & {
  replies: EntityDiscussionComment[];
};
type EntityDiscussionCommentsPage = {
  items: EntityDiscussionComment[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

type LifeReactionType = 'like' | 'helpful' | 'fun' | 'thanks';
type LifeReactionCounts = Record<LifeReactionType, number>;
type LifeReactionUser = {
  user: { id: number; displayName: string };
  reactionType: LifeReactionType;
  reactedAt: Date;
};
type LifeReactionUsersPage = {
  items: LifeReactionUser[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};
type LifeReactionUserCursor = {
  reactedAt: string;
  userId: number;
};

type LifeCommentRow = {
  id: number;
  postId: number;
  parentCommentId: number | null;
  body: string;
  deleted: boolean;
  moderationStatus: AiModerationStatus;
  moderationLanguageCode: string | null;
  moderationReason: string | null;
  createdAt: Date;
  createdAtCursor?: string;
  updatedAt: Date;
  author: { id: number; displayName: string } | null;
  likeCount: number;
  replyCount: number;
  myLiked: boolean;
};

type LifeComment = Omit<LifeCommentRow, 'createdAtCursor'> & {
  replies: LifeComment[];
};

type LifePostRow = {
  id: number;
  body: string;
  moderationStatus: AiModerationStatus;
  moderationLanguageCode: string | null;
  moderationReason: string | null;
  createdAt: Date;
  createdAtCursor: string;
  updatedAt: Date;
  author: { id: number; displayName: string } | null;
  updatedBy: { id: number; displayName: string } | null;
  category: { id: number; name: string; isRateable: boolean } | null;
  gameVersion: { id: number; name: string; changeLog: string } | null;
  ratingAverage: number | null;
  ratingCount: number;
};

type LifePost = Omit<LifePostRow, 'createdAtCursor'> & {
  commentPreview: LifeComment[];
  commentCount: number;
  reactionCounts: LifeReactionCounts;
  myReaction: LifeReactionType | null;
  myRating: number | null;
};

type LifePostCursor = {
  createdAt: string;
  id: number;
  ratingAverage?: number;
};

type LifePostSort = 'latest' | 'oldest' | 'top-rated';
type CommentSort = 'oldest' | 'latest' | 'most-liked' | 'most-replied';
type CommentCursor = {
  createdAt: string;
  id: number;
  count?: number;
};

type LifePostFilters = {
  authorId?: number;
  followedByUserId?: number;
};

type LifePostsPage = {
  items: LifePost[];
  nextCursor: string | null;
  hasMore: boolean;
};

type LifeCommentsPage = {
  items: LifeComment[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

type PublicProfileUser = {
  id: number;
  displayName: string;
  joinedAt: Date;
};

type PublicProfileStats = {
  wikiEdits: number;
  wikiCreates: number;
  wikiUpdates: number;
  wikiDeletes: number;
  imageUploads: number;
  lifePosts: number;
  lifeComments: number;
  lifeReactions: number;
  discussionComments: number;
};

type PublicProfileContribution = {
  contentType: string;
  total: number;
  creates: number;
  updates: number;
  deletes: number;
  lastContributedAt: Date | null;
};

type PublicProfileViewerRelation = 'none' | 'following' | 'followed-by' | 'friends';

type PublicProfileSocial = {
  followerCount: number;
  followingCount: number;
  friendCount: number;
  viewerRelation: PublicProfileViewerRelation;
};

type PublicUserProfile = {
  user: PublicProfileUser;
  stats: PublicProfileStats;
  social: PublicProfileSocial;
  contributions: PublicProfileContribution[];
};

type UserReactionActivity = {
  postId: number;
  reactionType: LifeReactionType;
  reactedAt: Date;
  post: LifePost;
};

type UserReactionActivityPage = {
  items: UserReactionActivity[];
  nextCursor: string | null;
  hasMore: boolean;
};

type UserCommentActivitySource = 'life' | 'discussion';

type UserCommentActivity = {
  id: number;
  source: UserCommentActivitySource;
  body: string;
  createdAt: Date;
  target: {
    type: 'life-post' | DiscussionEntityType;
    id: number;
    title: string;
    excerpt: string;
  };
};

type UserCommentActivityPage = {
  items: UserCommentActivity[];
  nextCursor: string | null;
  hasMore: boolean;
};

type UserCommentActivityCursor = LifePostCursor & {
  source: UserCommentActivitySource;
};

type HabitatPayload = {
  name: string;
  translations: TranslationInput;
  isEventItem: boolean;
  imagePath: string;
  recipeItems: IdQuantity[];
  pokemonAppearances: Array<{
    pokemonId: number;
    mapId: number;
    timeOfDay: string;
    weather: string;
    rarity: number;
  }>;
};

type LanguagePayload = {
  code: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

type ValidationError = Error & { statusCode: number };
type EditAction = 'create' | 'update' | 'delete';
type EditChange = {
  label: string;
  before: string;
  after: string;
};
type EditHistoryEntry = {
  action: EditAction;
  changes: EditChange[];
  createdAt: Date;
  user: { id: number; displayName: string } | null;
};
type TranslationChangeSource = {
  translations?: TranslationInput | null;
};
type PokemonChangeSource = {
  displayId: number;
  isEventItem: boolean;
  name: string;
  genus: string;
  details: string;
  heightInches: number;
  weightPounds: number;
  image: PokemonImage | null;
  types: Array<{ name: string }>;
  stats: PokemonStats;
  environment: { name: string };
  skills: Array<{ name: string; itemDrop?: { name: string } | null }>;
  favorite_things: Array<{ name: string }>;
} & TranslationChangeSource;
type ItemChangeSource = {
  name: string;
  details: string;
  isEventItem: boolean;
  image: EntityImageValue | null;
  category: { name: string };
  usage: { name: string } | null;
  customization: { dyeable: boolean; dualDyeable: boolean; patternEditable: boolean };
  noRecipe: boolean;
  acquisitionMethods: Array<{ name: string }>;
  tags: Array<{ name: string }>;
} & TranslationChangeSource;
type AncientArtifactChangeSource = {
  name: string;
  details: string;
  image: EntityImageValue | null;
  category: { name: string };
  tags: Array<{ name: string }>;
} & TranslationChangeSource;
type HabitatChangeSource = {
  name: string;
  isEventItem: boolean;
  image: EntityImageValue | null;
  recipe: Array<{ name: string; quantity: number }>;
  pokemon: Array<{ name: string; time_of_day: string; weather: string; rarity: number; map: { name: string } }>;
} & TranslationChangeSource;
type RecipeChangeSource = {
  item: { name: string };
  acquisition_methods: Array<{ name: string }>;
  materials: Array<{ name: string; quantity: number }>;
};

type DishCategoryChangeSource = {
  name: string;
  effect: string;
  translations?: TranslationInput;
  cookware: { name: string };
  mainMaterial: { name: string };
  totalMaterialQuantity: number;
};

type DishChangeSource = {
  category: { name: string };
  item: { name: string };
  flavor: { name: string };
  secondaryMaterials: Array<{ name: string }>;
  pokemonSkill: { name: string } | null;
  mosslaxEffect: string;
  translations?: TranslationInput;
};
type DailyChecklistChangeSource = {
  title: string;
} & TranslationChangeSource;
type ConfigChangeSource = {
  name: string;
  hasItemDrop?: boolean;
  isDefault?: boolean;
  isRateable?: boolean;
  changeLog?: string;
} & TranslationChangeSource;

const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];
const defaultLocale = 'en';
const localePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
const defaultLifePostLimit = 20;
const maxLifePostLimit = 50;
const defaultCommentLimit = 20;
const maxCommentLimit = 50;
const lifeCommentPreviewLimit = 2;
const lifeReactionTypes = ['like', 'helpful', 'fun', 'thanks'] as const;
const pokemonTypeIconIds = new Set(Array.from({ length: 19 }, (_value, index) => index + 1));
const pokemonSpriteBaseUrl = 'https://pokesprite.tootaio.com';
const pokemonSpriteRequestTimeoutMs = 2500;
const pokemonStatLabels: Array<{ key: keyof PokemonStats; label: string }> = [
  { key: 'hp', label: 'HP' },
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'specialAttack', label: 'Special Attack' },
  { key: 'specialDefense', label: 'Special Defense' },
  { key: 'speed', label: 'Speed' }
];

type SystemListOption = {
  id: number;
  key: string;
  labels: Record<typeof defaultLocale | 'zh-CN', string>;
};

const itemCategoryOptions = [
  { id: 1, key: 'furniture', labels: { en: 'Furniture', 'zh-CN': '家具' } },
  { id: 2, key: 'misc', labels: { en: 'Misc', 'zh-CN': '杂项' } },
  { id: 3, key: 'outdoor', labels: { en: 'Outdoor', 'zh-CN': '户外' } },
  { id: 4, key: 'utilities', labels: { en: 'Utilities', 'zh-CN': '实用工具' } },
  { id: 5, key: 'buildings', labels: { en: 'Buildings', 'zh-CN': '建筑' } },
  { id: 6, key: 'blocks', labels: { en: 'Blocks', 'zh-CN': '方块' } },
  { id: 7, key: 'kits', labels: { en: 'Kits', 'zh-CN': '套件' } },
  { id: 8, key: 'nature', labels: { en: 'Nature', 'zh-CN': '自然' } },
  { id: 9, key: 'food', labels: { en: 'Food', 'zh-CN': '食物' } },
  { id: 10, key: 'materials', labels: { en: 'Materials', 'zh-CN': '材料' } },
  { id: 11, key: 'key-items', labels: { en: 'Key Items', 'zh-CN': '关键物品' } },
  { id: 12, key: 'other', labels: { en: 'Other', 'zh-CN': '其他' } }
] as const satisfies readonly SystemListOption[];

const itemUsageOptions = [
  { id: 1, key: 'decoration', labels: { en: 'Decoration', 'zh-CN': '装饰' } },
  { id: 2, key: 'relaxation', labels: { en: 'Relaxation', 'zh-CN': '休闲' } },
  { id: 3, key: 'toy', labels: { en: 'Toy', 'zh-CN': '玩具' } },
  { id: 4, key: 'road', labels: { en: 'Road', 'zh-CN': '道路' } }
] as const satisfies readonly SystemListOption[];

const ancientArtifactCategoryOptions = [
  { id: 1, key: 'lost-relics-l', labels: { en: 'Lost Relics (L)', 'zh-CN': 'Lost Relics (L)' } },
  { id: 2, key: 'lost-relics-s', labels: { en: 'Lost Relics (S)', 'zh-CN': 'Lost Relics (S)' } },
  { id: 3, key: 'fossils', labels: { en: 'Fossils', 'zh-CN': '化石' } }
] as const satisfies readonly SystemListOption[];

const configDefinitions: Record<ConfigType, ConfigDefinition> = {
  'pokemon-types': { table: 'pokemon_types', entityType: 'pokemon-types' },
  skills: { table: 'skills', entityType: 'skills', hasItemDrop: true },
  environments: { table: 'environments', entityType: 'environments' },
  'favorite-things': { table: 'favorite_things', entityType: 'favorite-things' },
  'acquisition-methods': { table: 'acquisition_methods', entityType: 'acquisition-methods' },
  maps: { table: 'maps', entityType: 'maps' },
  'life-tags': { table: 'life_tags', entityType: 'life-tags', hasDefault: true, hasRateable: true },
  'game-versions': { table: 'game_versions', entityType: 'game-versions', hasChangeLog: true },
  'dish-flavors': { table: 'dish_flavors', entityType: 'dish-flavors' }
};

const sortableContentDefinitions: Record<SortableContentType, SortableContentDefinition> = {
  pokemon: { table: 'pokemon', entityType: 'pokemon' },
  items: { table: 'items', entityType: 'items' },
  'ancient-artifacts': { table: 'ancient_artifacts', entityType: 'ancient-artifacts' },
  recipes: { table: 'recipes', entityType: 'recipes' },
  habitats: { table: 'habitats', entityType: 'habitats' }
};

const discussionEntityDefinitions: Record<DiscussionEntityType, DiscussionEntityDefinition> = {
  pokemon: { table: 'pokemon' },
  items: { table: 'items' },
  recipes: { table: 'recipes' },
  habitats: { table: 'habitats' },
  'ancient-artifacts': { table: 'ancient_artifacts' }
};

let pokemonCsvDataCache: Promise<PokemonCsvData> | null = null;

function asString(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function cleanLocale(value: unknown): string {
  const locale = typeof value === 'string' ? value.trim() : '';
  return localePattern.test(locale) ? locale : defaultLocale;
}

function cleanModerationLanguageCode(value: unknown): string | null {
  const languageCode = typeof value === 'string' ? value.trim() : '';
  if (!languageCode || languageCode === 'all') {
    return null;
  }

  if (!localePattern.test(languageCode)) {
    throw validationError('server.validation.invalidField');
  }

  return languageCode;
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function uploadedImageJson(pathExpression: string): string {
  return `
    CASE WHEN ${pathExpression} <> '' THEN json_build_object(
      'path', ${pathExpression},
      'url', ${sqlLiteral(uploadPublicBaseUrl)} || ${pathExpression}
    ) ELSE NULL END
  `;
}

function pokemonImageJson(alias: string): string {
  return `
    CASE
      WHEN ${alias}.image_path LIKE '/sprites/%' THEN json_build_object(
        'path', ${alias}.image_path,
        'url', ${sqlLiteral(pokemonSpriteBaseUrl)} || ${alias}.image_path,
        'style', ${alias}.image_style,
        'version', ${alias}.image_version,
        'variant', ${alias}.image_variant,
        'description', ${alias}.image_description,
        'source', 'sprite'
      )
      WHEN ${alias}.image_path <> '' THEN json_build_object(
        'path', ${alias}.image_path,
        'url', ${sqlLiteral(uploadPublicBaseUrl)} || ${alias}.image_path,
        'style', 'Upload',
        'version', 'Community upload',
        'variant', ${alias}.name,
        'description', '',
        'source', 'upload'
      )
      ELSE NULL
    END
  `;
}

function imagePathLabel(path: string | null | undefined): string {
  const cleanPath = path?.trim() ?? '';
  if (cleanPath === '') {
    return '';
  }

  const parts = cleanPath.split('/');
  return parts.length >= 3 ? `${parts[1]} / ${parts[2]}` : cleanPath;
}

function localizedField(
  entityType: EntityType,
  entityIdExpression: string,
  baseExpression: string,
  fieldName: TranslationField,
  locale: string
): string {
  const entity = sqlLiteral(entityType);
  const field = sqlLiteral(fieldName);
  const requestedLocale = sqlLiteral(cleanLocale(locale));
  const defaultLocaleSql = sqlLiteral(defaultLocale);

  return `
    COALESCE(
      (
        SELECT et.value
        FROM entity_translations et
        WHERE et.entity_type = ${entity}
          AND et.entity_id = ${entityIdExpression}
          AND et.locale = ${requestedLocale}
          AND et.field_name = ${field}
      ),
      (
        SELECT et.value
        FROM entity_translations et
        WHERE et.entity_type = ${entity}
          AND et.entity_id = ${entityIdExpression}
          AND et.locale = ${defaultLocaleSql}
          AND et.field_name = ${field}
      ),
      ${baseExpression}
    )
  `;
}

function localizedName(entityType: EntityType, entityAlias: string, locale: string): string {
  return localizedField(entityType, `${entityAlias}.id`, `${entityAlias}.name`, 'name', locale);
}

function translationsSelect(entityType: EntityType, entityIdExpression: string): string {
  return `
    COALESCE((
      SELECT jsonb_object_agg(locale, fields)
      FROM (
        SELECT locale, jsonb_object_agg(field_name, value) AS fields
        FROM entity_translations
        WHERE entity_type = ${sqlLiteral(entityType)}
          AND entity_id = ${entityIdExpression}
        GROUP BY locale
      ) translation_rows
    ), '{}'::jsonb)
  `;
}

function cleanTranslations(value: unknown, allowedFields: TranslationField[]): TranslationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const translations: TranslationInput = {};
  const allowedFieldSet = new Set(allowedFields);

  for (const [locale, fields] of Object.entries(value as Record<string, unknown>)) {
    if (!localePattern.test(locale) || locale === defaultLocale || !fields || typeof fields !== 'object' || Array.isArray(fields)) {
      continue;
    }

    const cleanFields: Partial<Record<TranslationField, string>> = {};
    for (const [fieldName, fieldValue] of Object.entries(fields as Record<string, unknown>)) {
      if (!allowedFieldSet.has(fieldName as TranslationField) || typeof fieldValue !== 'string') {
        continue;
      }

      const cleanValue = fieldValue.trim();
      if (cleanValue !== '') {
        cleanFields[fieldName as TranslationField] = cleanValue;
      }
    }

    if (Object.keys(cleanFields).length > 0) {
      translations[locale] = cleanFields;
    }
  }

  return translations;
}

async function replaceEntityTranslations(
  client: DbClient,
  entityType: EntityType,
  entityId: number,
  translations: TranslationInput,
  fields: TranslationField[]
): Promise<void> {
  await client.query(
    `
      DELETE FROM entity_translations
      WHERE entity_type = $1
        AND entity_id = $2
        AND field_name = ANY($3::text[])
    `,
    [entityType, entityId, fields]
  );

  for (const [locale, translatedFields] of Object.entries(translations)) {
    for (const fieldName of fields) {
      const value = translatedFields[fieldName];
      if (typeof value !== 'string' || value.trim() === '') {
        continue;
      }

      await client.query(
        `
          INSERT INTO entity_translations (entity_type, entity_id, locale, field_name, value)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [entityType, entityId, locale, fieldName, value.trim()]
      );
    }
  }
}

async function deleteEntityTranslations(client: DbClient, entityType: EntityType, entityId: number): Promise<void> {
  await client.query('DELETE FROM entity_translations WHERE entity_type = $1 AND entity_id = $2', [entityType, entityId]);
}

function optionSelect(
  tableName: string,
  entityType: EntityType,
  locale: string
): Promise<Array<{ id: number; name: string }>> {
  const name = localizedName(entityType, 'o', locale);
  return query(`SELECT o.id, ${name} AS name FROM ${tableName} o ORDER BY ${orderByEntity('o')}`);
}

function systemListLabel(option: SystemListOption, locale: string): string {
  const clean = cleanLocale(locale) as keyof SystemListOption['labels'];
  return option.labels[clean] ?? option.labels[defaultLocale];
}

function systemListOptions(options: readonly SystemListOption[], locale: string): Array<{ id: number; key: string; name: string }> {
  return options.map((option) => ({ id: option.id, key: option.key, name: systemListLabel(option, locale) }));
}

function systemListOptionById(
  options: readonly SystemListOption[],
  id: number,
  message: string
): SystemListOption {
  const option = options.find((item) => item.id === id);
  if (!option) {
    throw validationError(message);
  }
  return option;
}

function systemListOptionByKey(options: readonly SystemListOption[], key: string | null | undefined): SystemListOption | null {
  return options.find((item) => item.key === key) ?? null;
}

function systemListNameByKey(options: readonly SystemListOption[], key: string | null | undefined, locale = defaultLocale): string | null {
  const option = systemListOptionByKey(options, key);
  return option ? systemListLabel(option, locale) : null;
}

function systemListIdSql(expression: string, options: readonly SystemListOption[]): string {
  const cases = options.map((option) => `WHEN ${sqlLiteral(option.key)} THEN ${option.id}`).join(' ');
  return `CASE ${expression} ${cases} ELSE NULL END`;
}

function systemListNameSql(expression: string, options: readonly SystemListOption[], locale: string): string {
  const cases = options
    .map((option) => `WHEN ${sqlLiteral(option.key)} THEN ${sqlLiteral(systemListLabel(option, locale))}`)
    .join(' ');
  return `CASE ${expression} ${cases} ELSE '' END`;
}

function systemListJsonSql(expression: string, options: readonly SystemListOption[], locale: string): string {
  return `json_build_object('id', ${systemListIdSql(expression, options)}, 'key', ${expression}, 'name', ${systemListNameSql(expression, options, locale)})`;
}

function lifeCategoryOptions(locale: string): Promise<Array<{ id: number; name: string; isDefault: boolean; isRateable: boolean }>> {
  const name = localizedName('life-tags', 'lc', locale);
  return query(
    `SELECT lc.id, ${name} AS name, lc.is_default AS "isDefault", lc.is_rateable AS "isRateable" FROM life_tags lc ORDER BY ${orderByEntity('lc')}`
  );
}

function gameVersionOptions(locale: string): Promise<Array<{ id: number; name: string; changeLog: string }>> {
  const name = localizedName('game-versions', 'gv', locale);
  return query(`SELECT gv.id, ${name} AS name, gv.change_log AS "changeLog" FROM game_versions gv ORDER BY ${orderByEntity('gv')}`);
}

function skillOptions(locale: string): Promise<Array<{ id: number; name: string; hasItemDrop: boolean }>> {
  const name = localizedName('skills', 's', locale);
  return query(`SELECT s.id, ${name} AS name, s.has_item_drop AS "hasItemDrop" FROM skills s ORDER BY ${orderByEntity('s')}`);
}

function auditSelect(entityAlias: string, createdAlias = 'created_user', updatedAlias = 'updated_user'): string {
  return `
    ${entityAlias}.created_at AS "createdAt",
    ${entityAlias}.updated_at AS "updatedAt",
    CASE
      WHEN ${createdAlias}.id IS NULL THEN NULL
      ELSE json_build_object('id', ${createdAlias}.id, 'displayName', ${createdAlias}.display_name)
    END AS "createdBy",
    CASE
      WHEN ${updatedAlias}.id IS NULL THEN NULL
      ELSE json_build_object('id', ${updatedAlias}.id, 'displayName', ${updatedAlias}.display_name)
    END AS "updatedBy"
  `;
}

function auditJoins(entityAlias: string, createdAlias = 'created_user', updatedAlias = 'updated_user'): string {
  return `
    LEFT JOIN users ${createdAlias} ON ${createdAlias}.id = ${entityAlias}.created_by_user_id
    LEFT JOIN users ${updatedAlias} ON ${updatedAlias}.id = ${entityAlias}.updated_by_user_id
  `;
}

function configOrder(): string {
  return orderByEntity('c');
}

function configSelect(definition: ConfigDefinition, locale: string): string {
  const name = localizedName(definition.entityType, 'c', locale);
  const translations = translationsSelect(definition.entityType, 'c.id');
  const columns = [`c.id`, `${name} AS name`, `c.name AS "baseName"`, `${translations} AS translations`];
  if (definition.hasItemDrop) {
    columns.push(`c.has_item_drop AS "hasItemDrop"`);
  }
  if (definition.hasDefault) {
    columns.push(`c.is_default AS "isDefault"`);
  }
  if (definition.hasRateable) {
    columns.push(`c.is_rateable AS "isRateable"`);
  }
  if (definition.hasChangeLog) {
    columns.push(`c.change_log AS "changeLog"`);
  }
  return columns.join(', ');
}

function validationError(message: string): ValidationError {
  const error = new Error(message) as ValidationError;
  error.statusCode = 400;
  return error;
}

function requirePositiveInteger(value: unknown, message: string): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw validationError(message);
  }
  return numberValue;
}

function optionalPositiveInteger(value: unknown, message: string): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return requirePositiveInteger(value, message);
}

function cleanName(value: unknown, message = 'server.validation.nameRequired'): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError(message);
  }
  return value.trim();
}

function cleanOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanUploadImagePath(value: unknown, entityType: 'items' | 'habitats' | 'ancient-artifacts'): string {
  const imagePath = cleanOptionalText(value);
  if (imagePath === '') {
    return '';
  }
  if (!isUploadImagePath(imagePath) || !imagePath.startsWith(`${entityType}/`)) {
    throw validationError('server.validation.imagePathInvalid');
  }
  return imagePath;
}

function cleanIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
}

function cleanIdValues(value: unknown): number[] {
  return cleanIds(Array.isArray(value) ? value : [value]);
}

function cleanPokemonStats(value: unknown): PokemonStats {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  return pokemonStatLabels.reduce((stats, stat) => {
    const numberValue = Number(row[stat.key] ?? 0);
    if (!Number.isInteger(numberValue) || numberValue < 0) {
      throw validationError('server.validation.statNonNegative');
    }

    return { ...stats, [stat.key]: numberValue };
  }, {} as PokemonStats);
}

function cleanNonNegativeNumber(value: unknown, message: string): number {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw validationError(message);
  }
  return numberValue;
}

function cleanQuantities(value: unknown): IdQuantity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = item as Partial<IdQuantity>;
      return {
        itemId: Number(row.itemId),
        quantity: Number(row.quantity)
      };
    })
    .filter((item) => Number.isInteger(item.itemId) && item.itemId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);
}

function cleanOptions(value: unknown, allowedValues: string[]): string[] {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.map((item) => String(item ?? '')).filter((item) => allowedValues.includes(item)))];
}

function orderByEntity(entityAlias: string): string {
  return `${entityAlias}.sort_order, ${entityAlias}.id`;
}

async function withTransaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function nextSortOrder(client: DbClient, tableName: string): Promise<number> {
  const result = await client.query<{ sortOrder: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 10 AS "sortOrder" FROM ${tableName}`
  );
  return result.rows[0]?.sortOrder ?? 10;
}

async function nextPokemonInternalId(
  client: DbClient,
  dataId: number | null
): Promise<number> {
  if (dataId !== null) {
    return dataId;
  }

  const result = await client.query<{ id: number }>(
    'SELECT COALESCE(MAX(id), 999999) + 1 AS id FROM pokemon WHERE id >= 1000000'
  );
  return result.rows[0]?.id ?? 1000000;
}

async function reorderTableRows(
  client: DbClient,
  tableName: string,
  entityType: string,
  ids: number[],
  userId: number
): Promise<void> {
  const existing = await client.query<{ id: number; sortOrder: number }>(
    `SELECT id, sort_order AS "sortOrder" FROM ${tableName} WHERE id = ANY($1::integer[])`,
    [ids]
  );

  if (existing.rowCount !== ids.length) {
    throw validationError('server.validation.recordMissing');
  }

  const sortOrders = new Map(existing.rows.map((row) => [row.id, row.sortOrder]));
  for (const [index, id] of ids.entries()) {
    const nextSortOrder = (index + 1) * 10;
    const previousSortOrder = sortOrders.get(id);
    if (previousSortOrder === nextSortOrder) {
      continue;
    }

    await client.query(
      `
        UPDATE ${tableName}
        SET sort_order = $1, updated_by_user_id = $2, updated_at = now()
        WHERE id = $3
      `,
      [nextSortOrder, userId, id]
    );
    const changes: EditChange[] = [];
    pushChange(changes, 'Sort order', String(previousSortOrder), String(nextSortOrder));
    await recordEditLog(client, entityType, id, 'update', userId, changes);
  }
}

async function recordEditLog(
  client: DbClient,
  entityType: string,
  entityId: number,
  action: EditAction,
  userId: number,
  changes: EditChange[] = []
): Promise<void> {
  await client.query(
    `
      INSERT INTO wiki_edit_logs (entity_type, entity_id, action, user_id, changes)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [entityType, entityId, action, userId, JSON.stringify(changes)]
  );
}

function cleanLanguagePayload(payload: Record<string, unknown>, requireCode: boolean): LanguagePayload {
  const code = typeof payload.code === 'string' ? payload.code.trim() : '';
  if (requireCode && !localePattern.test(code)) {
    throw validationError('server.validation.languageCodeInvalid');
  }

  const sortOrder = Number(payload.sortOrder ?? 0);

  return {
    code,
    name: cleanName(payload.name, 'server.validation.languageNameRequired'),
    enabled: payload.enabled !== false,
    isDefault: Boolean(payload.isDefault),
    sortOrder: Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0
  };
}

function requireLanguageCode(value: unknown): string {
  const code = typeof value === 'string' ? value.trim() : '';
  if (!localePattern.test(code)) {
    throw validationError('server.validation.languageCodeInvalid');
  }
  return code;
}

export async function listLanguages(includeDisabled = false) {
  return query<LanguagePayload>(
    `
      SELECT code, name, enabled, is_default AS "isDefault", sort_order AS "sortOrder"
      FROM languages
      ${includeDisabled ? '' : 'WHERE enabled = true'}
      ORDER BY sort_order, name
    `
  );
}

export async function createLanguage(payload: Record<string, unknown>) {
  const cleanPayload = cleanLanguagePayload(payload, true);
  if (cleanPayload.isDefault && cleanPayload.code !== defaultLocale) {
    throw validationError('server.validation.defaultLanguageMustBeEnglish');
  }
  if (!cleanPayload.enabled && cleanPayload.isDefault) {
    throw validationError('server.validation.defaultLanguageMustBeEnabled');
  }

  await withTransaction(async (client) => {
    if (cleanPayload.isDefault) {
      await client.query('UPDATE languages SET is_default = false');
    }

    await client.query(
      `
        INSERT INTO languages (code, name, enabled, is_default, sort_order)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [cleanPayload.code, cleanPayload.name, cleanPayload.enabled, cleanPayload.isDefault, cleanPayload.sortOrder]
    );
  });

  return listLanguages(true);
}

export async function updateLanguage(code: string, payload: Record<string, unknown>) {
  const locale = requireLanguageCode(code);
  const cleanPayload = cleanLanguagePayload({ ...payload, code: locale }, false);
  if (cleanPayload.isDefault && locale !== defaultLocale) {
    throw validationError('server.validation.defaultLanguageMustBeEnglish');
  }
  if (!cleanPayload.enabled && cleanPayload.isDefault) {
    throw validationError('server.validation.defaultLanguageMustBeEnabled');
  }

  await withTransaction(async (client) => {
    const current = await client.query<{ isDefault: boolean }>(
      'SELECT is_default AS "isDefault" FROM languages WHERE code = $1',
      [locale]
    );

    if (current.rowCount === 0) {
      throw validationError('server.validation.languageNotFound');
    }

    if (!cleanPayload.enabled && current.rows[0].isDefault) {
      throw validationError('server.validation.defaultLanguageMustBeEnabled');
    }

    if (current.rows[0].isDefault && !cleanPayload.isDefault) {
      throw validationError('server.validation.defaultLanguageRequired');
    }

    if (cleanPayload.isDefault) {
      await client.query('UPDATE languages SET is_default = false WHERE code <> $1', [locale]);
    }

    await client.query(
      `
        UPDATE languages
        SET name = $1,
            enabled = $2,
            is_default = $3,
            sort_order = $4
        WHERE code = $5
      `,
      [cleanPayload.name, cleanPayload.enabled, cleanPayload.isDefault, cleanPayload.sortOrder, locale]
    );
  });

  return listLanguages(true);
}

export async function deleteLanguage(code: string) {
  const locale = requireLanguageCode(code);
  if (locale === defaultLocale) {
    throw validationError('server.validation.defaultLanguageCannotBeDeleted');
  }

  return withTransaction(async (client) => {
    const result = await client.query<{ isDefault: boolean }>(
      'DELETE FROM languages WHERE code = $1 AND is_default = false RETURNING is_default AS "isDefault"',
      [locale]
    );
    return (result.rowCount ?? 0) > 0;
  });
}

export async function reorderLanguages(payload: Record<string, unknown>) {
  const codes = Array.isArray(payload.codes) ? payload.codes.map(requireLanguageCode) : [];
  if (codes.length === 0) {
    throw validationError('server.validation.selectLanguage');
  }

  await withTransaction(async (client) => {
    const existing = await client.query<{ code: string }>(
      'SELECT code FROM languages WHERE code = ANY($1::text[])',
      [codes]
    );

    if (existing.rowCount !== codes.length) {
      throw validationError('server.validation.languageDoesNotExist');
    }

    for (const [index, code] of codes.entries()) {
      await client.query(
        `
          UPDATE languages
          SET sort_order = $1
          WHERE code = $2
        `,
        [(index + 1) * 10, code]
      );
    }
  });

  return listLanguages(true);
}

function parseCsv(content: string, fileName: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"' && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value !== '')) {
      rows.push(row);
    }
  }

  const headers = rows[0]?.map((header) => header.replace(/^\uFEFF/, ''));
  if (!headers?.length) {
    throw validationError('server.validation.pokemonDataFileEmpty');
  }

  return rows.slice(1).map((values) =>
    headers.reduce<CsvRow>((record, header, index) => {
      record[header] = values[index] ?? '';
      return record;
    }, {})
  );
}

async function readPokemonDataFile(fileName: string): Promise<string> {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const directories = [
    process.env.POKOPIA_DATA_DIR ? resolve(process.env.POKOPIA_DATA_DIR) : '',
    resolve(process.cwd(), 'data'),
    resolve(process.cwd(), '..', 'data'),
    resolve(sourceDir, '..', 'data'),
    resolve(sourceDir, '..', '..', 'data')
  ].filter(Boolean);
  const uniqueDirectories = [...new Set(directories)];

  for (const directory of uniqueDirectories) {
    try {
      return await readFile(resolve(directory, fileName), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  throw validationError('server.validation.pokemonDataFileUnavailable');
}

function csvInteger(row: CsvRow, fieldName: string): number {
  const value = Number(row[fieldName]);
  return Number.isInteger(value) ? value : 0;
}

function csvNumber(row: CsvRow, fieldName: string): number {
  const value = Number(row[fieldName]);
  return Number.isFinite(value) ? value : 0;
}

function csvText(row: CsvRow, fieldName: string): string {
  return row[fieldName]?.trim() ?? '';
}

function indexRowsByNumber(rows: CsvRow[], fieldName: string): Map<number, CsvRow> {
  return rows.reduce((index, row) => {
    const id = csvInteger(row, fieldName);
    if (id > 0) {
      index.set(id, row);
    }
    return index;
  }, new Map<number, CsvRow>());
}

async function loadPokemonCsvData(): Promise<PokemonCsvData> {
  if (!pokemonCsvDataCache) {
    pokemonCsvDataCache = (async () => {
      const [pokemonContent, namesContent, genusContent, typesContent] = await Promise.all([
        readPokemonDataFile('pokemon_data.csv'),
        readPokemonDataFile('localized_pokemon_name.csv'),
        readPokemonDataFile('localized_pokemon_genus.csv'),
        readPokemonDataFile('localized_type_name.csv')
      ]);
      const pokemonRows = parseCsv(pokemonContent, 'pokemon_data.csv');
      const typeRows = parseCsv(typesContent, 'localized_type_name.csv');
      const pokemonByLookup = new Map<string, CsvRow>();

      for (const row of pokemonRows) {
        const id = csvInteger(row, 'id');
        const identifier = csvText(row, 'identifier').toLowerCase();
        if (id > 0) {
          pokemonByLookup.set(String(id), row);
        }
        if (identifier) {
          pokemonByLookup.set(identifier, row);
        }
      }

      return {
        pokemonRows,
        pokemonByLookup,
        namesByPokemonId: indexRowsByNumber(parseCsv(namesContent, 'localized_pokemon_name.csv'), 'pokemon_species_id'),
        genusByPokemonId: indexRowsByNumber(parseCsv(genusContent, 'localized_pokemon_genus.csv'), 'pokemon_species_id'),
        typesById: indexRowsByNumber(typeRows, 'type_id'),
        canonicalTypeRows: typeRows.filter((row) => pokemonTypeIconIds.has(csvInteger(row, 'type_id')))
      };
    })();
  }

  return pokemonCsvDataCache;
}

function pokemonDataLookupKey(value: unknown): string {
  const rawValue = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (rawValue === '') {
    throw validationError('server.validation.pokemonIdentifierRequired');
  }

  const numericValue = Number(rawValue);
  if (Number.isInteger(numericValue) && numericValue > 0) {
    return String(numericValue);
  }

  return rawValue.toLowerCase();
}

function languageCsvColumn(code: string): string | null {
  const [language, region = ''] = code.split('-');
  const languageKey = language.toLowerCase();
  const regionKey = region.toUpperCase();
  const directColumns: Record<string, string> = {
    de: 'de',
    en: 'en',
    es: 'es',
    fr: 'fr',
    it: 'it',
    ja: 'ja',
    ko: 'ko'
  };

  if (languageKey === 'zh') {
    return ['HK', 'MO', 'TW'].includes(regionKey) ? 'zh_hant' : 'zh_hans';
  }

  return directColumns[languageKey] ?? null;
}

function localizedCsvText(row: CsvRow, code: string): string {
  const column = languageCsvColumn(code);
  return column ? csvText(row, column) : '';
}

function defaultLanguage(languages: LanguagePayload[]): LanguagePayload | undefined {
  return languages.find((language) => language.isDefault) ?? languages.find((language) => language.code === defaultLocale) ?? languages[0];
}

function defaultCsvText(row: CsvRow, languages: LanguagePayload[], fallback: string): string {
  const defaultCode = defaultLanguage(languages)?.code ?? defaultLocale;
  return localizedCsvText(row, defaultCode) || localizedCsvText(row, defaultLocale) || fallback;
}

function pokemonSpriteUrl(path: string): string {
  return `${pokemonSpriteBaseUrl}${path}`;
}

function pokemonImageWithUrl(candidate: PokemonImageCandidate): PokemonImage {
  return { ...candidate, url: pokemonSpriteUrl(candidate.path), source: 'sprite' };
}

function pokemonImageCandidates(id: number): PokemonImageCandidate[] {
  return [
    {
      path: `/sprites/pokemon/other/official-artwork/${id}.png`,
      style: 'Official artwork',
      version: 'Official artwork',
      variant: 'Default',
      description: 'Large official artwork'
    },
    {
      path: `/sprites/pokemon/other/official-artwork/shiny/${id}.png`,
      style: 'Official artwork',
      version: 'Official artwork',
      variant: 'Shiny',
      description: 'Large shiny official artwork'
    },
    {
      path: `/sprites/pokemon/other/home/${id}.png`,
      style: 'Pokemon HOME',
      version: 'HOME',
      variant: 'Default',
      description: 'Modern HOME render'
    },
    {
      path: `/sprites/pokemon/other/home/shiny/${id}.png`,
      style: 'Pokemon HOME',
      version: 'HOME',
      variant: 'Shiny',
      description: 'Modern shiny HOME render'
    },
    {
      path: `/sprites/pokemon/other/home/female/${id}.png`,
      style: 'Pokemon HOME',
      version: 'HOME',
      variant: 'Female',
      description: 'Modern female HOME render'
    },
    {
      path: `/sprites/pokemon/other/home/shiny/female/${id}.png`,
      style: 'Pokemon HOME',
      version: 'HOME',
      variant: 'Shiny female',
      description: 'Modern shiny female HOME render'
    },
    {
      path: `/sprites/pokemon/other/dream-world/${id}.svg`,
      style: 'Dream World',
      version: 'Dream World',
      variant: 'Default',
      description: 'Dream World SVG artwork'
    },
    {
      path: `/sprites/pokemon/other/dream-world/female/${id}.svg`,
      style: 'Dream World',
      version: 'Dream World',
      variant: 'Female',
      description: 'Dream World female SVG artwork'
    },
    {
      path: `/sprites/pokemon/other/showdown/${id}.gif`,
      style: 'Pokemon Showdown',
      version: 'Showdown',
      variant: 'Front animated',
      description: 'Animated front battle sprite'
    },
    {
      path: `/sprites/pokemon/other/showdown/shiny/${id}.gif`,
      style: 'Pokemon Showdown',
      version: 'Showdown',
      variant: 'Shiny front animated',
      description: 'Animated shiny front battle sprite'
    },
    {
      path: `/sprites/pokemon/other/showdown/female/${id}.gif`,
      style: 'Pokemon Showdown',
      version: 'Showdown',
      variant: 'Female front animated',
      description: 'Animated female front battle sprite'
    },
    {
      path: `/sprites/pokemon/other/showdown/back/${id}.gif`,
      style: 'Pokemon Showdown',
      version: 'Showdown',
      variant: 'Back animated',
      description: 'Animated back battle sprite'
    },
    {
      path: `/sprites/pokemon/${id}.png`,
      style: 'Default sprite',
      version: 'PokeAPI',
      variant: 'Front',
      description: 'Compact front sprite'
    },
    {
      path: `/sprites/pokemon/shiny/${id}.png`,
      style: 'Default sprite',
      version: 'PokeAPI',
      variant: 'Shiny front',
      description: 'Compact shiny front sprite'
    },
    {
      path: `/sprites/pokemon/female/${id}.png`,
      style: 'Default sprite',
      version: 'PokeAPI',
      variant: 'Female front',
      description: 'Compact female front sprite'
    },
    {
      path: `/sprites/pokemon/back/${id}.png`,
      style: 'Default sprite',
      version: 'PokeAPI',
      variant: 'Back',
      description: 'Compact back sprite'
    },
    {
      path: `/sprites/pokemon/back/shiny/${id}.png`,
      style: 'Default sprite',
      version: 'PokeAPI',
      variant: 'Shiny back',
      description: 'Compact shiny back sprite'
    },
    {
      path: `/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`,
      style: 'Game version',
      version: 'Black / White',
      variant: 'Animated front',
      description: 'Generation V animated sprite'
    },
    {
      path: `/sprites/pokemon/versions/generation-v/black-white/animated/shiny/${id}.gif`,
      style: 'Game version',
      version: 'Black / White',
      variant: 'Animated shiny',
      description: 'Generation V animated shiny sprite'
    },
    {
      path: `/sprites/pokemon/versions/generation-v/black-white/${id}.png`,
      style: 'Game version',
      version: 'Black / White',
      variant: 'Front',
      description: 'Generation V front sprite'
    },
    {
      path: `/sprites/pokemon/versions/generation-vi/x-y/${id}.png`,
      style: 'Game version',
      version: 'X / Y',
      variant: 'Front',
      description: 'Generation VI front sprite'
    },
    {
      path: `/sprites/pokemon/versions/generation-vii/ultra-sun-ultra-moon/${id}.png`,
      style: 'Game version',
      version: 'Ultra Sun / Ultra Moon',
      variant: 'Front',
      description: 'Generation VII front sprite'
    },
    {
      path: `/sprites/pokemon/versions/generation-ix/scarlet-violet/${id}.png`,
      style: 'Game version',
      version: 'Scarlet / Violet',
      variant: 'Front',
      description: 'Generation IX front sprite'
    },
    {
      path: `/sprites/pokemon/versions/generation-iii/emerald/${id}.png`,
      style: 'Game version',
      version: 'Emerald',
      variant: 'Front',
      description: 'Generation III front sprite'
    },
    {
      path: `/sprites/pokemon/versions/generation-i/red-blue/${id}.png`,
      style: 'Game version',
      version: 'Red / Blue',
      variant: 'Front',
      description: 'Generation I front sprite'
    }
  ];
}

function pokemonImageLabel(image: PokemonImage | null | undefined): string {
  if (!image) {
    return '';
  }
  return image.source === 'upload' || isUploadImagePath(image.path) ? imagePathLabel(image.path) : `${image.style} - ${image.version} - ${image.variant}`;
}

function pokemonImageDataIdFromPath(path: string): number | null {
  const match = path.match(/^\/sprites\/pokemon\/(?:.+\/)?([1-9]\d*)\.(?:png|gif|svg)$/);
  if (!match) {
    return null;
  }

  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

function pokemonImageCandidateForPath(path: string): PokemonImage | null {
  const cleanPath = path.trim();
  const id = pokemonImageDataIdFromPath(cleanPath);
  if (!id) {
    return null;
  }

  const candidate = pokemonImageCandidates(id).find((item) => item.path === cleanPath);
  return candidate ? pokemonImageWithUrl(candidate) : null;
}

function cleanPokemonImage(value: unknown, displayId: number): PokemonImage | null {
  const path = typeof value === 'string' ? value.trim() : '';
  if (path === '') {
    return null;
  }

  if (isUploadImagePath(path)) {
    if (!path.startsWith('pokemon/')) {
      throw validationError('server.validation.imagePathInvalid');
    }
    return {
      path,
      url: uploadImageUrl(path),
      style: 'Upload',
      version: 'Community upload',
      variant: `#${displayId}`,
      description: '',
      source: 'upload'
    };
  }

  const image = pokemonImageCandidateForPath(path);
  if (!image) {
    throw validationError('server.validation.pokemonImagePathInvalid');
  }
  return image;
}

async function pokemonImageExists(candidate: PokemonImageCandidate): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), pokemonSpriteRequestTimeoutMs);

  try {
    const response = await fetch(pokemonSpriteUrl(candidate.path), { method: 'HEAD', signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function assignTranslation(translations: TranslationInput, locale: string, fieldName: TranslationField, value: string): void {
  if (!value) {
    return;
  }

  translations[locale] = {
    ...(translations[locale] ?? {}),
    [fieldName]: value
  };
}

function localizedCsvTranslations(
  rows: Array<{ row: CsvRow; fieldName: TranslationField }>,
  languages: LanguagePayload[]
): TranslationInput {
  const translations: TranslationInput = {};
  const defaultCode = defaultLanguage(languages)?.code ?? defaultLocale;

  for (const language of languages) {
    if (language.code === defaultCode) {
      continue;
    }

    for (const { row, fieldName } of rows) {
      assignTranslation(translations, language.code, fieldName, localizedCsvText(row, language.code));
    }
  }

  return cleanTranslations(translations, rows.map((row) => row.fieldName));
}

function fetchedPokemonStats(row: CsvRow): PokemonStats {
  return {
    hp: csvInteger(row, 'hp'),
    attack: csvInteger(row, 'atk'),
    defense: csvInteger(row, 'def'),
    specialAttack: csvInteger(row, 'sp_atk'),
    specialDefense: csvInteger(row, 'sp_def'),
    speed: csvInteger(row, 'spd')
  };
}

function fetchedPokemonTypeIds(row: CsvRow, data: PokemonCsvData): number[] {
  const typeIds = [csvInteger(row, 'type_1_id'), csvInteger(row, 'type_2_id')].filter((typeId) => typeId > 0);

  if (typeIds.length === 0 || typeIds.some((typeId) => !data.typesById.has(typeId) || !pokemonTypeIconIds.has(typeId))) {
    throw validationError('server.validation.pokemonTypeDataUnavailable');
  }

  return typeIds;
}

async function ensurePokemonTypeCatalog(
  client: DbClient,
  data: PokemonCsvData,
  languages: LanguagePayload[],
  userId: number
): Promise<void> {
  for (const row of data.canonicalTypeRows) {
    const typeId = csvInteger(row, 'type_id');
    const name = defaultCsvText(row, languages, csvText(row, 'identifier'));
    const translations = localizedCsvTranslations([{ row, fieldName: 'name' }], languages);
    const existing = await client.query<ConfigChangeSource>(
      `
        SELECT pt.name, ${translationsSelect('pokemon-types', 'pt.id')} AS translations
        FROM pokemon_types pt
        WHERE pt.id = $1
      `,
      [typeId]
    );

    if (existing.rowCount === 0) {
      await client.query(
        `
          INSERT INTO pokemon_types (
            id,
            name,
            sort_order,
            created_by_user_id,
            updated_by_user_id
          )
          VALUES ($1, $2, $3, $4, $4)
        `,
        [typeId, name, typeId * 10, userId]
      );
      await recordEditLog(client, 'pokemon-types', typeId, 'create', userId);
    } else {
      const changes = configEditChanges(
        { table: 'pokemon_types', entityType: 'pokemon-types' },
        existing.rows[0],
        { name, translations, hasItemDrop: false, isDefault: false, isRateable: false, changeLog: '' }
      );
      if (changes.length) {
        await client.query(
          `
            UPDATE pokemon_types
            SET name = $1,
                updated_by_user_id = $2,
                updated_at = now()
            WHERE id = $3
          `,
          [name, userId, typeId]
        );
        await recordEditLog(client, 'pokemon-types', typeId, 'update', userId, changes);
      }
    }

    await replaceEntityTranslations(client, 'pokemon-types', typeId, translations, ['name']);
  }

  await client.query(
    `
      SELECT setval(
        pg_get_serial_sequence('pokemon_types', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM pokemon_types), 1),
        true
      )
    `
  );
}

export async function fetchPokemonData(payload: Record<string, unknown>, userId: number): Promise<PokemonFetchResult> {
  const lookupKey = pokemonDataLookupKey(payload.identifier);
  const [data, languages] = await Promise.all([loadPokemonCsvData(), listLanguages()]);
  const pokemonRow = data.pokemonByLookup.get(lookupKey);

  if (!pokemonRow) {
    throw validationError('server.validation.pokemonDataNotFound');
  }

  const id = csvInteger(pokemonRow, 'id');
  const nameRow = data.namesByPokemonId.get(id) ?? pokemonRow;
  const genusRow = data.genusByPokemonId.get(id) ?? pokemonRow;
  const identifier = csvText(pokemonRow, 'identifier');
  const typeIds = fetchedPokemonTypeIds(pokemonRow, data);

  await withTransaction((client) => ensurePokemonTypeCatalog(client, data, languages, userId));

  return {
    id,
    identifier,
    name: defaultCsvText(nameRow, languages, identifier),
    genus: defaultCsvText(genusRow, languages, ''),
    heightInches: Math.round(csvNumber(pokemonRow, 'height_m') * 39.37007874015748 * 100) / 100,
    weightPounds: Math.round(csvNumber(pokemonRow, 'weight_kg') * 2.2046226218 * 10) / 10,
    translations: localizedCsvTranslations(
      [
        { row: nameRow, fieldName: 'name' },
        { row: genusRow, fieldName: 'genus' }
      ],
      languages
    ),
    typeIds,
    stats: fetchedPokemonStats(pokemonRow)
  };
}

export async function fetchPokemonImageOptions(payload: Record<string, unknown>): Promise<PokemonImageOptionsResult> {
  const lookupKey = pokemonDataLookupKey(payload.identifier);
  const data = await loadPokemonCsvData();
  const pokemonRow = data.pokemonByLookup.get(lookupKey);

  if (!pokemonRow) {
    throw validationError('server.validation.pokemonDataNotFound');
  }

  const id = csvInteger(pokemonRow, 'id');
  const images = (
    await Promise.all(
      pokemonImageCandidates(id).map(async (candidate) => (await pokemonImageExists(candidate) ? pokemonImageWithUrl(candidate) : null))
    )
  ).filter((image): image is PokemonImage => image !== null);

  return {
    id,
    identifier: csvText(pokemonRow, 'identifier'),
    images
  };
}

function pokemonFetchOption(row: CsvRow, data: PokemonCsvData, languages: LanguagePayload[], locale: string): PokemonFetchOption {
  const id = csvInteger(row, 'id');
  const identifier = csvText(row, 'identifier');
  const nameRow = data.namesByPokemonId.get(id) ?? row;

  return {
    id,
    identifier,
    name: localizedCsvText(nameRow, cleanLocale(locale)) || defaultCsvText(nameRow, languages, identifier)
  };
}

function pokemonFetchOptionMatches(
  row: CsvRow,
  data: PokemonCsvData,
  languages: LanguagePayload[],
  locale: string,
  search: string
): boolean {
  if (!search) {
    return true;
  }

  const id = csvInteger(row, 'id');
  const identifier = csvText(row, 'identifier');
  const nameRow = data.namesByPokemonId.get(id) ?? row;
  const defaultCode = defaultLanguage(languages)?.code ?? defaultLocale;
  const searchFields = [
    String(id),
    identifier,
    localizedCsvText(nameRow, cleanLocale(locale)),
    localizedCsvText(nameRow, defaultCode),
    localizedCsvText(nameRow, defaultLocale)
  ];
  const keyword = search.toLowerCase();

  return searchFields.some((field) => field.toLowerCase().includes(keyword));
}

export async function listPokemonFetchOptions(paramsQuery: QueryParams, locale = defaultLocale): Promise<PokemonFetchOption[]> {
  const search = asString(paramsQuery.search)?.trim() ?? '';
  const includeAll = asString(paramsQuery.all) === 'true';
  const [data, languages] = await Promise.all([loadPokemonCsvData(), listLanguages()]);
  const rows = data.pokemonRows.filter(
    (row) => csvInteger(row, 'id') > 0 && pokemonFetchOptionMatches(row, data, languages, locale, search)
  );

  return (includeAll ? rows : rows.slice(0, 20)).map((row) => pokemonFetchOption(row, data, languages, locale));
}

function displayValue(value: string | null | undefined): string {
  const cleanValue = value?.trim() ?? '';
  return cleanValue === '' ? 'None' : cleanValue;
}

function pushChange(changes: EditChange[], label: string, before: string | null | undefined, after: string | null | undefined): void {
  const beforeValue = displayValue(before);
  const afterValue = displayValue(after);

  if (beforeValue !== afterValue) {
    changes.push({ label, before: beforeValue, after: afterValue });
  }
}

const translationChangeLabels: Record<TranslationField, string> = {
  name: 'Name',
  title: 'Title',
  details: 'Details',
  genus: 'Genus',
  effect: 'Effect',
  mosslaxEffect: 'Mosslax effect'
};

function translationFieldValue(
  translations: TranslationInput | null | undefined,
  locale: string,
  field: TranslationField
): string | null {
  const value = translations?.[locale]?.[field];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function pushTranslationChanges(
  changes: EditChange[],
  before: TranslationInput | null | undefined,
  after: TranslationInput,
  fields: TranslationField[]
): void {
  const locales = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after)])]
    .filter((locale) => locale !== defaultLocale)
    .sort((a, b) => a.localeCompare(b));

  for (const locale of locales) {
    for (const field of fields) {
      pushChange(
        changes,
        `${translationChangeLabels[field]} (${locale})`,
        translationFieldValue(before, locale, field),
        translationFieldValue(after, locale, field)
      );
    }
  }
}

function boolValue(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function namedListValue(items: Array<{ name: string }> | null | undefined): string {
  if (!items?.length) {
    return 'None';
  }

  return [...new Set(items.map((item) => item.name))]
    .sort((a, b) => a.localeCompare(b))
    .join(' / ');
}

function quantityListValue(items: Array<{ name: string; quantity: number }> | null | undefined): string {
  if (!items?.length) {
    return 'None';
  }

  return items
    .map((item) => ({ name: item.name, value: `${item.name} x${item.quantity}` }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => item.value)
    .join(' / ');
}

function skillDropListValue(skills: Array<{ name: string; itemDrop?: { name: string } | null }> | null | undefined): string {
  const rows = skills
    ?.filter((skill) => skill.itemDrop)
    .map((skill) => `${skill.name}: ${skill.itemDrop?.name}`)
    .sort((a, b) => a.localeCompare(b)) ?? [];

  return rows.length ? rows.join(' / ') : 'None';
}

function pokemonStatsValue(stats: PokemonStats | null | undefined): string {
  return pokemonStatLabels.map((stat) => `${stat.label}: ${stats?.[stat.key] ?? 0}`).join(' / ');
}

function roundMeasure(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function formatFixedMeasure(value: number, precision: number): string {
  return value.toFixed(precision);
}

function feetInchesValue(inches: number): string {
  const totalInches = Math.round(inches);
  const feet = Math.floor(totalInches / 12);
  const remainingInches = totalInches - feet * 12;
  return `${feet}'${remainingInches}"`;
}

function pokemonHeightValue(inches: number | null | undefined): string {
  const value = inches ?? 0;
  return `${feetInchesValue(value)} / ${formatFixedMeasure(roundMeasure(value * 0.0254, 2), 2)} m`;
}

function pokemonWeightValue(pounds: number | null | undefined): string {
  const value = pounds ?? 0;
  return `${formatFixedMeasure(roundMeasure(value, 1), 1)} lb / ${formatFixedMeasure(roundMeasure(value * 0.45359237, 2), 2)} kg`;
}

function appearanceListValue(
  rows: Array<{ name: string; time_of_day: string; weather: string; rarity: number; map: { name: string } }> | null | undefined
): string {
  if (!rows?.length) {
    return 'None';
  }

  return rows
    .map((row) => `${row.name}: ${row.time_of_day} / ${row.weather} / ${row.rarity} stars / ${row.map.name}`)
    .sort((a, b) => a.localeCompare(b))
    .join(' / ');
}

async function entityNameMap(client: DbClient, tableName: string, ids: number[]): Promise<Map<number, string>> {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (!uniqueIds.length) {
    return new Map();
  }

  const result = await client.query<{ id: number; name: string }>(
    `SELECT id, name FROM ${tableName} WHERE id = ANY($1::integer[])`,
    [uniqueIds]
  );

  return new Map(result.rows.map((row) => [row.id, row.name]));
}

function namesFromIds(ids: number[], namesById: Map<number, string>): string {
  const names = [...new Set(ids)]
    .map((id) => namesById.get(id))
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b));

  return names.length ? names.join(' / ') : 'None';
}

async function quantityPayloadValue(client: DbClient, rows: IdQuantity[]): Promise<string> {
  const namesById = await entityNameMap(client, 'items', rows.map((row) => row.itemId));
  return quantityListValue(
    rows
      .map((row) => {
        const name = namesById.get(row.itemId);
        return name ? { name, quantity: row.quantity } : null;
      })
      .filter((row): row is { name: string; quantity: number } => row !== null)
  );
}

async function pokemonEditChanges(
  client: DbClient,
  before: PokemonChangeSource,
  after: PokemonPayload
): Promise<EditChange[]> {
  const changes: EditChange[] = [];
  const environmentNames = await entityNameMap(client, 'environments', [after.environmentId]);
  const typeNames = await entityNameMap(client, 'pokemon_types', after.typeIds);
  const skillNames = await entityNameMap(client, 'skills', after.skillIds);
  const favoriteThingNames = await entityNameMap(client, 'favorite_things', after.favoriteThingIds);
  const dropSkillNames = await entityNameMap(client, 'skills', after.skillItemDrops.map((drop) => drop.skillId));
  const dropItemNames = await entityNameMap(client, 'items', after.skillItemDrops.map((drop) => drop.itemId));
  const afterDrops = after.skillItemDrops
    .map((drop) => {
      const skillName = dropSkillNames.get(drop.skillId);
      const itemName = dropItemNames.get(drop.itemId);
      return skillName && itemName ? `${skillName}: ${itemName}` : null;
    })
    .filter((drop): drop is string => drop !== null)
    .sort((a, b) => a.localeCompare(b))
    .join(' / ');

  pushChange(changes, 'Name', before.name, after.name);
  pushChange(changes, 'Pokopia ID', String(before.displayId), String(after.displayId));
  pushChange(changes, 'Event Pokemon', boolValue(before.isEventItem), boolValue(after.isEventItem));
  pushChange(changes, 'Genus', before.genus, after.genus);
  pushChange(changes, 'Details', before.details, after.details);
  pushTranslationChanges(changes, before.translations, after.translations, ['name', 'genus', 'details']);
  pushChange(changes, 'Height', pokemonHeightValue(before.heightInches), pokemonHeightValue(after.heightInches));
  pushChange(changes, 'Weight', pokemonWeightValue(before.weightPounds), pokemonWeightValue(after.weightPounds));
  pushChange(changes, 'Image', pokemonImageLabel(before.image), pokemonImageLabel(after.image));
  pushChange(changes, 'Types', namedListValue(before.types), namesFromIds(after.typeIds, typeNames));
  pushChange(changes, 'Stats', pokemonStatsValue(before.stats), pokemonStatsValue(after.stats));
  pushChange(changes, 'Ideal Habitat', before.environment.name, environmentNames.get(after.environmentId));
  pushChange(changes, 'Specialities', namedListValue(before.skills), namesFromIds(after.skillIds, skillNames));
  pushChange(changes, 'Favourites', namedListValue(before.favorite_things), namesFromIds(after.favoriteThingIds, favoriteThingNames));
  pushChange(changes, 'Speciality drops', skillDropListValue(before.skills), afterDrops);

  return changes;
}

async function itemEditChanges(
  client: DbClient,
  before: ItemChangeSource,
  after: ItemPayload
): Promise<EditChange[]> {
  const changes: EditChange[] = [];
  const methodNames = await entityNameMap(client, 'acquisition_methods', after.acquisitionMethodIds);
  const tagNames = await entityNameMap(client, 'favorite_things', after.tagIds);

  pushChange(changes, 'Name', before.name, after.name);
  pushChange(changes, 'Description', before.details, after.details);
  pushTranslationChanges(changes, before.translations, after.translations, ['name', 'details']);
  pushChange(changes, 'Event item', boolValue(before.isEventItem), boolValue(after.isEventItem));
  pushChange(changes, 'Image', imagePathLabel(before.image?.path), imagePathLabel(after.imagePath));
  pushChange(changes, 'Category', before.category.name, systemListNameByKey(itemCategoryOptions, after.categoryKey));
  pushChange(changes, 'Usage', before.usage?.name, systemListNameByKey(itemUsageOptions, after.usageKey));
  pushChange(changes, 'Dyeable', boolValue(before.customization.dyeable), boolValue(after.dyeable));
  pushChange(changes, 'Dual dyeable', boolValue(before.customization.dualDyeable), boolValue(after.dualDyeable));
  pushChange(changes, 'Pattern editable', boolValue(before.customization.patternEditable), boolValue(after.patternEditable));
  pushChange(changes, 'No recipe', boolValue(before.noRecipe), boolValue(after.noRecipe));
  pushChange(changes, 'Acquisition methods', namedListValue(before.acquisitionMethods), namesFromIds(after.acquisitionMethodIds, methodNames));
  pushChange(changes, 'Tags', namedListValue(before.tags), namesFromIds(after.tagIds, tagNames));

  return changes;
}

async function ancientArtifactEditChanges(
  client: DbClient,
  before: AncientArtifactChangeSource,
  after: AncientArtifactPayload
): Promise<EditChange[]> {
  const changes: EditChange[] = [];
  const tagNames = await entityNameMap(client, 'favorite_things', after.tagIds);

  pushChange(changes, 'Name', before.name, after.name);
  pushChange(changes, 'Description', before.details, after.details);
  pushTranslationChanges(changes, before.translations, after.translations, ['name', 'details']);
  pushChange(changes, 'Image', imagePathLabel(before.image?.path), imagePathLabel(after.imagePath));
  pushChange(changes, 'Category', before.category.name, systemListNameByKey(ancientArtifactCategoryOptions, after.categoryKey));
  pushChange(changes, 'Tags', namedListValue(before.tags), namesFromIds(after.tagIds, tagNames));
  return changes;
}

async function habitatEditChanges(
  client: DbClient,
  before: HabitatChangeSource,
  after: HabitatPayload
): Promise<EditChange[]> {
  const changes: EditChange[] = [];
  const pokemonNames = await entityNameMap(client, 'pokemon', after.pokemonAppearances.map((row) => row.pokemonId));
  const mapNames = await entityNameMap(client, 'maps', after.pokemonAppearances.map((row) => row.mapId));
  const afterAppearances = after.pokemonAppearances
    .map((row) => {
      const pokemonName = pokemonNames.get(row.pokemonId);
      const mapName = mapNames.get(row.mapId);
      return pokemonName && mapName ? `${pokemonName}: ${row.timeOfDay} / ${row.weather} / ${row.rarity} stars / ${mapName}` : null;
    })
    .filter((row): row is string => row !== null)
    .sort((a, b) => a.localeCompare(b))
    .join(' / ');

  pushChange(changes, 'Name', before.name, after.name);
  pushTranslationChanges(changes, before.translations, after.translations, ['name']);
  pushChange(changes, 'Event Habitat', boolValue(before.isEventItem), boolValue(after.isEventItem));
  pushChange(changes, 'Image', imagePathLabel(before.image?.path), imagePathLabel(after.imagePath));
  pushChange(changes, 'Recipe', quantityListValue(before.recipe), await quantityPayloadValue(client, after.recipeItems));
  pushChange(changes, 'Possible Pokemon', appearanceListValue(before.pokemon), afterAppearances);

  return changes;
}

async function recipeEditChanges(
  client: DbClient,
  before: RecipeChangeSource,
  after: RecipePayload
): Promise<EditChange[]> {
  const changes: EditChange[] = [];
  const itemNames = await entityNameMap(client, 'items', [after.itemId]);
  const methodNames = await entityNameMap(client, 'acquisition_methods', after.acquisitionMethodIds);

  pushChange(changes, 'Item', before.item.name, itemNames.get(after.itemId));
  pushChange(changes, 'Acquisition methods', namedListValue(before.acquisition_methods), namesFromIds(after.acquisitionMethodIds, methodNames));
  pushChange(changes, 'Materials', quantityListValue(before.materials), await quantityPayloadValue(client, after.materials));

  return changes;
}

function dailyChecklistEditChanges(before: DailyChecklistChangeSource, after: DailyChecklistPayload): EditChange[] {
  const changes: EditChange[] = [];
  pushChange(changes, 'Title', before.title, after.title);
  pushTranslationChanges(changes, before.translations, after.translations, ['title']);
  return changes;
}

function configEditChanges(
  definition: ConfigDefinition,
  before: ConfigChangeSource,
  after: {
    name: string;
    translations: TranslationInput;
    hasItemDrop: boolean;
    isDefault: boolean;
    isRateable: boolean;
    changeLog: string;
  }
): EditChange[] {
  const changes: EditChange[] = [];
  pushChange(changes, 'Name', before.name, after.name);
  pushTranslationChanges(changes, before.translations, after.translations, ['name']);
  if (definition.hasItemDrop) {
    pushChange(changes, 'Has item drop', boolValue(Boolean(before.hasItemDrop)), boolValue(after.hasItemDrop));
  }
  if (definition.hasDefault) {
    pushChange(changes, 'Default category', boolValue(Boolean(before.isDefault)), boolValue(after.isDefault));
  }
  if (definition.hasRateable) {
    pushChange(changes, 'Rateable', boolValue(Boolean(before.isRateable)), boolValue(after.isRateable));
  }
  if (definition.hasChangeLog) {
    pushChange(changes, 'ChangeLog', before.changeLog, after.changeLog);
  }
  return changes;
}

function getEditHistory(entityType: string, entityId: number): Promise<EditHistoryEntry[]> {
  return query(
    `
      SELECT
        l.action,
        COALESCE(l.changes, '[]'::jsonb) AS changes,
        l.created_at AS "createdAt",
        CASE
          WHEN u.id IS NULL THEN NULL
          ELSE json_build_object('id', u.id, 'displayName', u.display_name)
        END AS user
      FROM wiki_edit_logs l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE l.entity_type = $1
        AND l.entity_id = $2
      ORDER BY l.created_at DESC, l.id DESC
    `,
    [entityType, entityId]
  );
}

function pokemonProjection(locale: string): string {
  const pokemonName = localizedName('pokemon', 'p', locale);
  const pokemonGenus = localizedField('pokemon', 'p.id', 'p.genus', 'genus', locale);
  const pokemonDetails = localizedField('pokemon', 'p.id', 'p.details', 'details', locale);
  const typeName = localizedName('pokemon-types', 'pt', locale);
  const environmentName = localizedName('environments', 'e', locale);
  const skillName = localizedName('skills', 's', locale);
  const favoriteThingName = localizedName('favorite-things', 'ft', locale);

  return `
    SELECT
      p.id,
      p.data_id AS "dataId",
      p.data_identifier AS "dataIdentifier",
      p.display_id AS "displayId",
      ${pokemonName} AS name,
      p.name AS "baseName",
      p.is_event_item AS "isEventItem",
      ${pokemonGenus} AS genus,
      p.genus AS "baseGenus",
      ${pokemonDetails} AS details,
      p.details AS "baseDetails",
      p.height_inches AS "heightInches",
      round((p.height_inches * 0.0254)::numeric, 2)::double precision AS "heightMeters",
      p.weight_pounds AS "weightPounds",
      round((p.weight_pounds * 0.45359237)::numeric, 2)::double precision AS "weightKg",
      ${pokemonImageJson('p')} AS image,
      json_build_object(
        'hp', p.hp,
        'attack', p.attack,
        'defense', p.defense,
        'specialAttack', p.special_attack,
        'specialDefense', p.special_defense,
        'speed', p.speed
      ) AS stats,
      ${translationsSelect('pokemon', 'p.id')} AS translations,
      ${auditSelect('p', 'pokemon_created_user', 'pokemon_updated_user')},
      json_build_object('id', e.id, 'name', ${environmentName}) AS environment,
      COALESCE((
        SELECT json_agg(json_build_object('id', pt.id, 'name', ${typeName}) ORDER BY ppt.slot_order)
        FROM pokemon_pokemon_types ppt
        JOIN pokemon_types pt ON pt.id = ppt.type_id
        WHERE ppt.pokemon_id = p.id
      ), '[]'::json) AS types,
      COALESCE((
        SELECT json_agg(json_build_object('id', s.id, 'name', ${skillName}, 'hasItemDrop', s.has_item_drop) ORDER BY ${orderByEntity('s')})
        FROM pokemon_skills ps
        JOIN skills s ON s.id = ps.skill_id
        WHERE ps.pokemon_id = p.id
      ), '[]'::json) AS skills,
      COALESCE((
        SELECT json_agg(json_build_object('id', ft.id, 'name', ${favoriteThingName}) ORDER BY ${orderByEntity('ft')})
        FROM pokemon_favorite_things pft
        JOIN favorite_things ft ON ft.id = pft.favorite_thing_id
        WHERE pft.pokemon_id = p.id
      ), '[]'::json) AS favorite_things
    FROM pokemon p
    JOIN environments e ON e.id = p.environment_id
    ${auditJoins('p', 'pokemon_created_user', 'pokemon_updated_user')}
  `;
}

export async function getOptions(locale = defaultLocale) {
  const [
    pokemonTypes,
    skills,
    environments,
    favoriteThings,
    acquisitionMethods,
    maps,
    lifeCategories,
    gameVersions,
    dishFlavors
  ] = await Promise.all([
    optionSelect('pokemon_types', 'pokemon-types', locale),
    skillOptions(locale),
    optionSelect('environments', 'environments', locale),
    optionSelect('favorite_things', 'favorite-things', locale),
    optionSelect('acquisition_methods', 'acquisition-methods', locale),
    optionSelect('maps', 'maps', locale),
    lifeCategoryOptions(locale),
    gameVersionOptions(locale),
    optionSelect('dish_flavors', 'dish-flavors', locale)
  ]);

  return {
    pokemonTypes,
    skills,
    environments,
    favoriteThings,
    itemCategories: systemListOptions(itemCategoryOptions, locale),
    itemUsages: systemListOptions(itemUsageOptions, locale),
    ancientArtifactCategories: systemListOptions(ancientArtifactCategoryOptions, locale),
    acquisitionMethods,
    itemTags: favoriteThings,
    maps,
    lifeCategories,
    gameVersions,
    dishFlavors
  };
}

function cleanDailyChecklistPayload(payload: Record<string, unknown>): DailyChecklistPayload {
  return {
    title: cleanName(payload.title, 'server.validation.taskRequired'),
    translations: cleanTranslations(payload.translations, ['title'])
  };
}

export async function listDailyChecklistItems(locale = defaultLocale) {
  const title = localizedField('daily-checklist-items', 'c.id', 'c.title', 'title', locale);
  return query(
    `
      SELECT c.id, ${title} AS title, c.title AS "baseTitle", ${translationsSelect('daily-checklist-items', 'c.id')} AS translations
      FROM daily_checklist_items c
      ORDER BY c.sort_order, c.id
    `
  );
}

export async function globalSearch(paramsQuery: QueryParams = {}, locale = defaultLocale): Promise<GlobalSearchResults> {
  const search = asString(paramsQuery.query)?.trim() ?? asString(paramsQuery.search)?.trim() ?? '';
  if (!search) {
    return { query: '', groups: [] };
  }

  const pattern = `%${search}%`;
  const limit = 5;
  const pokemonName = localizedName('pokemon', 'p', locale);
  const habitatName = localizedName('habitats', 'h', locale);
  const itemName = localizedName('items', 'i', locale);
  const itemCategoryName = systemListJsonSql('i.category_key', itemCategoryOptions, locale);
  const artifactName = localizedName('ancient-artifacts', 'a', locale);
  const artifactCategoryName = systemListJsonSql('a.category_key', ancientArtifactCategoryOptions, locale);
  const recipeItemName = localizedName('items', 'result_item', locale);
  const recipeMaterialName = localizedName('items', 'material_item', locale);
  const checklistTitle = localizedField('daily-checklist-items', 'c.id', 'c.title', 'title', locale);
  const lifeCategoryName = localizedName('life-tags', 'lc', locale);

  const [pokemon, habitats, items, artifacts, recipes, checklist, life, users] = await Promise.all([
    query<GlobalSearchItem>(
      `
        SELECT
          p.id,
          'pokemon' AS type,
          ${pokemonName} AS title,
          '/pokemon/' || p.id AS url,
          NULLIF(p.genus, '') AS summary,
          '#' || p.display_id::text AS meta,
          ${pokemonImageJson('p')} AS image
        FROM pokemon p
        WHERE ${pokemonName} ILIKE $1
        ORDER BY ${orderByEntity('p')}
        LIMIT $2
      `,
      [pattern, limit]
    ),
    query<GlobalSearchItem>(
      `
        SELECT
          h.id,
          'habitats' AS type,
          ${habitatName} AS title,
          '/habitats/' || h.id AS url,
          NULL AS summary,
          NULL AS meta,
          ${uploadedImageJson('h.image_path')} AS image
        FROM habitats h
        WHERE ${habitatName} ILIKE $1
        ORDER BY ${orderByEntity('h')}
        LIMIT $2
      `,
      [pattern, limit]
    ),
    query<GlobalSearchItem>(
      `
        SELECT
          i.id,
          'items' AS type,
          ${itemName} AS title,
          '/items/' || i.id AS url,
          NULLIF(i.details, '') AS summary,
          (${itemCategoryName}->>'name') AS meta,
          ${uploadedImageJson('i.image_path')} AS image
        FROM items i
        WHERE ${itemName} ILIKE $1
        ORDER BY ${orderByEntity('i')}
        LIMIT $2
      `,
      [pattern, limit]
    ),
    query<GlobalSearchItem>(
      `
        SELECT
          a.id,
          'ancient-artifacts' AS type,
          ${artifactName} AS title,
          '/ancient-artifacts/' || a.id AS url,
          NULLIF(a.details, '') AS summary,
          (${artifactCategoryName}->>'name') AS meta,
          ${uploadedImageJson('a.image_path')} AS image
        FROM ancient_artifacts a
        WHERE ${artifactName} ILIKE $1
        ORDER BY ${orderByEntity('a')}
        LIMIT $2
      `,
      [pattern, limit]
    ),
    query<GlobalSearchItem>(
      `
        SELECT
          r.id,
          'recipes' AS type,
          ${recipeItemName} AS title,
          '/recipes/' || r.id AS url,
          (
            SELECT string_agg(material_rows.name, ' / ' ORDER BY material_rows.name)
            FROM (
              SELECT DISTINCT ${recipeMaterialName} AS name
              FROM recipe_materials rm
              JOIN items material_item ON material_item.id = rm.item_id
              WHERE rm.recipe_id = r.id
            ) material_rows
          ) AS summary,
          NULL AS meta,
          ${uploadedImageJson('result_item.image_path')} AS image
        FROM recipes r
        JOIN items result_item ON result_item.id = r.item_id
        WHERE ${recipeItemName} ILIKE $1
          OR EXISTS (
            SELECT 1
            FROM recipe_materials rm
            JOIN items material_item ON material_item.id = rm.item_id
            WHERE rm.recipe_id = r.id
              AND ${recipeMaterialName} ILIKE $1
          )
        ORDER BY ${orderByEntity('r')}
        LIMIT $2
      `,
      [pattern, limit]
    ),
    query<GlobalSearchItem>(
      `
        SELECT
          c.id,
          'daily-checklist' AS type,
          ${checklistTitle} AS title,
          '/checklist' AS url,
          NULL AS summary,
          NULL AS meta,
          NULL AS image
        FROM daily_checklist_items c
        WHERE ${checklistTitle} ILIKE $1
        ORDER BY ${orderByEntity('c')}
        LIMIT $2
      `,
      [pattern, limit]
    ),
    query<GlobalSearchItem>(
      `
        SELECT
          lp.id,
          'life' AS type,
          LEFT(lp.body, 120) AS title,
          '/life/' || lp.id AS url,
          NULL AS summary,
          ${lifeCategoryName} AS meta,
          NULL AS image
        FROM life_posts lp
        LEFT JOIN life_tags lc ON lc.id = lp.category_id
        WHERE lp.deleted_at IS NULL
          AND lp.ai_moderation_status = 'approved'
          AND lp.body ILIKE $1
        ORDER BY lp.created_at DESC, lp.id DESC
        LIMIT $2
      `,
      [pattern, limit]
    ),
    query<GlobalSearchItem>(
      `
        SELECT
          u.id,
          'users' AS type,
          u.display_name AS title,
          '/profile/' || u.id AS url,
          NULL AS summary,
          NULL AS meta,
          NULL AS image
        FROM users u
        WHERE u.display_name ILIKE $1
        ORDER BY lower(u.display_name), u.id
        LIMIT $2
      `,
      [pattern, limit]
    )
  ]);

  const groups: GlobalSearchGroup[] = [
    { type: 'pokemon', items: pokemon },
    { type: 'habitats', items: habitats },
    { type: 'items', items: items },
    { type: 'ancient-artifacts', items: artifacts },
    { type: 'recipes', items: recipes },
    { type: 'daily-checklist', items: checklist },
    { type: 'life', items: life },
    { type: 'users', items: users }
  ];

  return { query: search, groups: groups.filter((group) => group.items.length > 0) };
}

async function getDailyChecklistItemById(id: number, locale = defaultLocale) {
  const title = localizedField('daily-checklist-items', 'c.id', 'c.title', 'title', locale);
  return queryOne(
    `
      SELECT c.id, ${title} AS title, c.title AS "baseTitle", ${translationsSelect('daily-checklist-items', 'c.id')} AS translations
      FROM daily_checklist_items c
      WHERE c.id = $1
    `,
    [id]
  );
}

export async function createDailyChecklistItem(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanDailyChecklistPayload(payload);

  const id = await withTransaction(async (client) => {
    const orderResult = await client.query<{ sortOrder: number }>(
      'SELECT COALESCE(MAX(sort_order), 0) + 10 AS "sortOrder" FROM daily_checklist_items'
    );
    const sortOrder = orderResult.rows[0]?.sortOrder ?? 10;

    const result = await client.query<{ id: number }>(
      `
        INSERT INTO daily_checklist_items (title, sort_order, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $3, $3)
        RETURNING id
      `,
      [cleanPayload.title, sortOrder, userId]
    );

    const createdId = result.rows[0].id;
    await replaceEntityTranslations(client, 'daily-checklist-items', createdId, cleanPayload.translations, ['title']);
    await recordEditLog(client, 'daily-checklist-items', createdId, 'create', userId);
    return createdId;
  });

  return getDailyChecklistItemById(id, locale);
}

export async function updateDailyChecklistItem(
  id: number,
  payload: Record<string, unknown>,
  userId: number,
  locale = defaultLocale
) {
  const cleanPayload = cleanDailyChecklistPayload(payload);
  const before = await getDailyChecklistItemById(id, defaultLocale);

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE daily_checklist_items
        SET title = $1, updated_by_user_id = $2, updated_at = now()
        WHERE id = $3
      `,
      [cleanPayload.title, userId, id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    await replaceEntityTranslations(client, 'daily-checklist-items', id, cleanPayload.translations, ['title']);
    const changes = before ? dailyChecklistEditChanges(before as DailyChecklistChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'daily-checklist-items', id, 'update', userId, changes);
    return true;
  });

  return updated ? getDailyChecklistItemById(id, locale) : null;
}

export async function reorderDailyChecklistItems(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const ids = cleanIds(payload.ids);
  if (ids.length === 0) {
    throw validationError('server.validation.selectTask');
  }

  await withTransaction(async (client) => {
    const existing = await client.query<{ id: number; sortOrder: number }>(
      'SELECT id, sort_order AS "sortOrder" FROM daily_checklist_items WHERE id = ANY($1::integer[])',
      [ids]
    );

    if (existing.rowCount !== ids.length) {
      throw validationError('server.validation.taskDoesNotExist');
    }

    const sortOrders = new Map(existing.rows.map((row) => [row.id, row.sortOrder]));
    for (const [index, id] of ids.entries()) {
      const nextSortOrder = (index + 1) * 10;
      const previousSortOrder = sortOrders.get(id);
      if (previousSortOrder === nextSortOrder) {
        continue;
      }

      await client.query(
        `
          UPDATE daily_checklist_items
          SET sort_order = $1, updated_by_user_id = $2, updated_at = now()
          WHERE id = $3
        `,
        [nextSortOrder, userId, id]
      );
      const changes: EditChange[] = [];
      pushChange(changes, 'Sort order', String(previousSortOrder), String(nextSortOrder));
      await recordEditLog(client, 'daily-checklist-items', id, 'update', userId, changes);
    }
  });

  return listDailyChecklistItems(locale);
}

export async function deleteDailyChecklistItem(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM daily_checklist_items WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await deleteEntityTranslations(client, 'daily-checklist-items', id);
    await recordEditLog(client, 'daily-checklist-items', id, 'delete', userId);
    return true;
  });
}

function cleanLifePostPayload(payload: Record<string, unknown>): LifePostPayload {
  const body = cleanName(payload.body, 'server.validation.postRequired');
  if (body.length > 2000) {
    throw validationError('server.validation.postTooLong');
  }
  const categoryId = requirePositiveInteger(payload.categoryId, 'server.validation.lifeCategoryRequired');
  const gameVersionId = optionalPositiveInteger(payload.gameVersionId, 'server.validation.gameVersionInvalid');

  return {
    body,
    categoryId,
    gameVersionId,
    languageCode: cleanModerationLanguageCode(payload.languageCode)
  };
}

function cleanLifeCommentPayload(payload: Record<string, unknown>): LifeCommentPayload {
  const body = cleanName(payload.body, 'server.validation.commentRequired');
  if (body.length > 1000) {
    throw validationError('server.validation.commentTooLong');
  }

  return { body, languageCode: cleanModerationLanguageCode(payload.languageCode) };
}

function emptyLifeReactionCounts(): LifeReactionCounts {
  return {
    like: 0,
    helpful: 0,
    fun: 0,
    thanks: 0
  };
}

function isLifeReactionType(value: unknown): value is LifeReactionType {
  return typeof value === 'string' && lifeReactionTypes.includes(value as LifeReactionType);
}

function cleanLifeReactionType(value: unknown): LifeReactionType {
  if (!isLifeReactionType(value)) {
    throw validationError('server.validation.reactionInvalid');
  }

  return value;
}

function cleanLifeReactionFilter(value: QueryValue): LifeReactionType | null {
  const reactionType = asString(value);
  if (!reactionType) {
    return null;
  }

  return cleanLifeReactionType(reactionType);
}

function cleanLifeRating(value: unknown): number {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw validationError('server.validation.ratingInvalid');
  }

  return rating;
}

function cleanUserCommentActivitySourceFilter(value: QueryValue): UserCommentActivitySource | null {
  const source = asString(value);
  if (!source) {
    return null;
  }

  if (source !== 'life' && source !== 'discussion') {
    throw validationError('server.validation.invalidField');
  }

  return source;
}

function cleanModerationLanguageFilter(value: QueryValue): string | null {
  return cleanModerationLanguageCode(asString(value));
}

function addModerationVisibilityCondition(
  conditions: string[],
  params: unknown[],
  alias: string,
  ownerColumn: string,
  userId: number | null,
  canViewAll: boolean
): void {
  if (canViewAll) {
    return;
  }

  if (userId !== null) {
    params.push(userId);
    conditions.push(`(${alias}.ai_moderation_status = 'approved' OR ${ownerColumn} = $${params.length})`);
    return;
  }

  conditions.push(`${alias}.ai_moderation_status = 'approved'`);
}

function moderationVisibilitySql(alias: string, ownerColumn: string, userId: number | null, canViewAll: boolean): string {
  if (canViewAll) {
    return 'true';
  }
  if (userId !== null) {
    return `(${alias}.ai_moderation_status = 'approved' OR ${ownerColumn} = ${userId})`;
  }
  return `${alias}.ai_moderation_status = 'approved'`;
}

function visibleLifeCommentSql(alias: string, ownerColumn: string, userId: number | null): string {
  return userId !== null ? `(${alias}.deleted_at IS NULL OR ${ownerColumn} = ${userId})` : `${alias}.deleted_at IS NULL`;
}

function addModerationLanguageCondition(
  conditions: string[],
  params: unknown[],
  alias: string,
  languageCode: string | null
): void {
  if (!languageCode) {
    return;
  }

  params.push(languageCode);
  conditions.push(`${alias}.ai_moderation_language_code = $${params.length}`);
}

function lifePostProjection(locale = defaultLocale): string {
  const categoryName = localizedName('life-tags', 'lc', locale);
  const gameVersionName = localizedName('game-versions', 'gv', locale);

  return `
    SELECT
      lp.id,
      lp.body,
      lp.ai_moderation_status AS "moderationStatus",
      lp.ai_moderation_language_code AS "moderationLanguageCode",
      lp.ai_moderation_reason AS "moderationReason",
      lp.created_at AS "createdAt",
      lp.created_at::text AS "createdAtCursor",
      lp.updated_at AS "updatedAt",
      CASE
        WHEN created_user.id IS NULL THEN NULL
        ELSE json_build_object('id', created_user.id, 'displayName', created_user.display_name)
      END AS author,
      CASE
        WHEN updated_user.id IS NULL THEN NULL
        ELSE json_build_object('id', updated_user.id, 'displayName', updated_user.display_name)
      END AS "updatedBy",
      CASE
        WHEN lc.id IS NULL THEN NULL
        ELSE json_build_object('id', lc.id, 'name', ${categoryName}, 'isRateable', lc.is_rateable)
      END AS category,
      CASE
        WHEN gv.id IS NULL THEN NULL
        ELSE json_build_object('id', gv.id, 'name', ${gameVersionName}, 'changeLog', gv.change_log)
      END AS "gameVersion",
      CASE
        WHEN rating_stats.rating_count = 0 THEN NULL
        ELSE rating_stats.rating_average::double precision
      END AS "ratingAverage",
      rating_stats.rating_count AS "ratingCount"
    FROM life_posts lp
    LEFT JOIN life_tags lc ON lc.id = lp.category_id
    LEFT JOIN game_versions gv ON gv.id = lp.game_version_id
    LEFT JOIN LATERAL (
      SELECT
        ROUND(AVG(lpr.rating)::numeric, 2) AS rating_average,
        COUNT(*)::integer AS rating_count
      FROM life_post_ratings lpr
      WHERE lpr.post_id = lp.id
    ) rating_stats ON true
    LEFT JOIN users created_user ON created_user.id = lp.created_by_user_id
    LEFT JOIN users updated_user ON updated_user.id = lp.updated_by_user_id
  `;
}

function cleanLifePostLimit(value: QueryValue): number {
  const rawLimit = asString(value);
  if (rawLimit === undefined || rawLimit === '') {
    return defaultLifePostLimit;
  }

  const limit = Number(rawLimit);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, maxLifePostLimit) : defaultLifePostLimit;
}

function cleanLifePostSort(value: QueryValue): LifePostSort {
  const sort = asString(value);
  return sort === 'oldest' || sort === 'top-rated' ? sort : 'latest';
}

function cleanRateableFilter(value: QueryValue): boolean | null {
  const rateable = asString(value);
  if (rateable === 'true') {
    return true;
  }
  if (rateable === 'false') {
    return false;
  }
  return null;
}

function cleanCommentLimit(value: QueryValue): number {
  const rawLimit = asString(value);
  if (rawLimit === undefined || rawLimit === '') {
    return defaultCommentLimit;
  }

  const limit = Number(rawLimit);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, maxCommentLimit) : defaultCommentLimit;
}

function cleanCommentSort(value: QueryValue): CommentSort {
  const sort = asString(value);
  return sort === 'latest' || sort === 'most-liked' || sort === 'most-replied' ? sort : 'oldest';
}

function decodeCommentCursor(value: QueryValue): CommentCursor | null {
  const rawCursor = asString(value);
  if (!rawCursor) {
    return null;
  }

  try {
    const cursor = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as Partial<CommentCursor>;
    const createdAt = typeof cursor.createdAt === 'string' ? cursor.createdAt : '';
    const id = Number(cursor.id);
    const count = cursor.count === undefined ? undefined : Number(cursor.count);

    if (
      !createdAt ||
      Number.isNaN(new Date(createdAt).getTime()) ||
      !Number.isInteger(id) ||
      id <= 0 ||
      (count !== undefined && (!Number.isInteger(count) || count < 0))
    ) {
      throw validationError('server.validation.cursorInvalid');
    }

    return { createdAt, id, count };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error;
    }
    throw validationError('server.validation.cursorInvalid');
  }
}

function encodeCommentCursor(comment: LifeCommentRow | EntityDiscussionCommentRow, sort: CommentSort): string {
  const count = sort === 'most-liked' ? comment.likeCount : sort === 'most-replied' ? comment.replyCount : undefined;
  return Buffer.from(JSON.stringify({ createdAt: comment.createdAtCursor, id: comment.id, count }), 'utf8').toString('base64url');
}

function commentSortOrder(alias: string, sort: CommentSort): string {
  if (sort === 'latest') {
    return `${alias}.created_at DESC, ${alias}.id DESC`;
  }
  if (sort === 'most-liked') {
    return `"likeCount" DESC, ${alias}.created_at DESC, ${alias}.id DESC`;
  }
  if (sort === 'most-replied') {
    return `"replyCount" DESC, ${alias}.created_at DESC, ${alias}.id DESC`;
  }
  return `${alias}.created_at, ${alias}.id`;
}

function addCommentCursorCondition(
  conditions: string[],
  params: unknown[],
  alias: string,
  cursor: CommentCursor,
  sort: CommentSort
): void {
  if (sort === 'latest') {
    params.push(cursor.createdAt, cursor.id);
    conditions.push(`(${alias}.created_at, ${alias}.id) < ($${params.length - 1}::timestamptz, $${params.length}::integer)`);
    return;
  }

  if (sort === 'most-liked' || sort === 'most-replied') {
    params.push(cursor.count ?? 0, cursor.createdAt, cursor.id);
    const countExpression = sort === 'most-liked' ? 'like_stats.like_count' : 'reply_stats.reply_count';
    conditions.push(`
      (
        ${countExpression} < $${params.length - 2}::integer
        OR (
          ${countExpression} = $${params.length - 2}::integer
          AND (${alias}.created_at, ${alias}.id) < ($${params.length - 1}::timestamptz, $${params.length}::integer)
        )
      )
    `);
    return;
  }

  params.push(cursor.createdAt, cursor.id);
  conditions.push(`(${alias}.created_at, ${alias}.id) > ($${params.length - 1}::timestamptz, $${params.length}::integer)`);
}

function decodeLifePostCursor(value: QueryValue): LifePostCursor | null {
  const rawCursor = asString(value);
  if (!rawCursor) {
    return null;
  }

  try {
    const cursor = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as Partial<LifePostCursor>;
    const createdAt = typeof cursor.createdAt === 'string' ? cursor.createdAt : '';
    const id = Number(cursor.id);
    const ratingAverage = cursor.ratingAverage === undefined ? undefined : Number(cursor.ratingAverage);

    if (
      !createdAt ||
      Number.isNaN(new Date(createdAt).getTime()) ||
      !Number.isInteger(id) ||
      id <= 0 ||
      (ratingAverage !== undefined && (Number.isNaN(ratingAverage) || ratingAverage < 0))
    ) {
      throw validationError('server.validation.cursorInvalid');
    }

    return { createdAt, id, ratingAverage };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error;
    }
    throw validationError('server.validation.cursorInvalid');
  }
}

function encodeLifePostCursor(post: LifePostRow): string {
  return Buffer.from(
    JSON.stringify({ createdAt: post.createdAtCursor, id: post.id, ratingAverage: post.ratingAverage ?? 0 }),
    'utf8'
  ).toString('base64url');
}

function encodeProfileCursor(cursor: LifePostCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeLifeReactionUserCursor(value: QueryValue): LifeReactionUserCursor | null {
  const rawCursor = asString(value);
  if (!rawCursor) {
    return null;
  }

  try {
    const cursor = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as Partial<LifeReactionUserCursor>;
    const reactedAt = typeof cursor.reactedAt === 'string' ? cursor.reactedAt : '';
    const userId = Number(cursor.userId);

    if (!reactedAt || Number.isNaN(new Date(reactedAt).getTime()) || !Number.isInteger(userId) || userId <= 0) {
      throw validationError('server.validation.cursorInvalid');
    }

    return { reactedAt, userId };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error;
    }
    throw validationError('server.validation.cursorInvalid');
  }
}

function encodeLifeReactionUserCursor(cursor: LifeReactionUserCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeUserCommentActivityCursor(value: QueryValue): UserCommentActivityCursor | null {
  const rawCursor = asString(value);
  if (!rawCursor) {
    return null;
  }

  try {
    const cursor = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as Partial<UserCommentActivityCursor>;
    const createdAt = typeof cursor.createdAt === 'string' ? cursor.createdAt : '';
    const id = Number(cursor.id);
    const source = cursor.source;

    if (
      !createdAt ||
      Number.isNaN(new Date(createdAt).getTime()) ||
      !Number.isInteger(id) ||
      id <= 0 ||
      (source !== 'life' && source !== 'discussion')
    ) {
      throw validationError('server.validation.cursorInvalid');
    }

    return { createdAt, id, source };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error;
    }
    throw validationError('server.validation.cursorInvalid');
  }
}

function encodeUserCommentActivityCursor(cursor: UserCommentActivityCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function hydrateLifePost(
  post: LifePostRow,
  commentPreviewByPost: Map<number, LifeComment[]>,
  commentCountsByPost: Map<number, number>,
  countsByPost: Map<number, LifeReactionCounts>,
  myReactionsByPost: Map<number, LifeReactionType>,
  myRatingsByPost: Map<number, number>
): LifePost {
  return {
    id: post.id,
    body: post.body,
    moderationStatus: post.moderationStatus,
    moderationLanguageCode: post.moderationLanguageCode,
    moderationReason: post.moderationReason,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author,
    updatedBy: post.updatedBy,
    category: post.category,
    gameVersion: post.gameVersion,
    ratingAverage: post.ratingAverage,
    ratingCount: post.ratingCount,
    commentPreview: commentPreviewByPost.get(post.id) ?? [],
    commentCount: commentCountsByPost.get(post.id) ?? 0,
    reactionCounts: countsByPost.get(post.id) ?? emptyLifeReactionCounts(),
    myReaction: myReactionsByPost.get(post.id) ?? null,
    myRating: myRatingsByPost.get(post.id) ?? null
  };
}

function lifeCommentProjection(whereClause: string, userId: number | null = null, canViewAll = false): string {
  const myLikedExpression =
    userId === null
      ? 'false'
      : `EXISTS (SELECT 1 FROM life_comment_likes my_like WHERE my_like.comment_id = lc.id AND my_like.user_id = ${userId})`;
  const replyVisibility = [
    'reply.parent_comment_id = lc.id',
    visibleLifeCommentSql('reply', 'reply.created_by_user_id', userId),
    moderationVisibilitySql('reply', 'reply.created_by_user_id', userId, canViewAll)
  ].join(' AND ');

  return `
    SELECT
      lc.id,
      lc.post_id AS "postId",
      lc.parent_comment_id AS "parentCommentId",
      lc.body,
      lc.deleted_at IS NOT NULL AS deleted,
      lc.ai_moderation_status AS "moderationStatus",
      lc.ai_moderation_language_code AS "moderationLanguageCode",
      lc.ai_moderation_reason AS "moderationReason",
      lc.created_at AS "createdAt",
      lc.created_at::text AS "createdAtCursor",
      lc.updated_at AS "updatedAt",
      CASE WHEN comment_user.id IS NULL THEN NULL ELSE json_build_object('id', comment_user.id, 'displayName', comment_user.display_name) END AS author,
      like_stats.like_count AS "likeCount",
      reply_stats.reply_count AS "replyCount",
      ${myLikedExpression} AS "myLiked"
    FROM life_post_comments lc
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS like_count
      FROM life_comment_likes lcl
      WHERE lcl.comment_id = lc.id
    ) like_stats ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS reply_count
      FROM life_post_comments reply
      WHERE ${replyVisibility}
    ) reply_stats ON true
    LEFT JOIN users comment_user ON comment_user.id = lc.created_by_user_id
    ${whereClause}
  `;
}

function visibleLifeCommentExpression(alias: string, ownerColumn: string, userParamIndex: number | null): string {
  return userParamIndex !== null ? `(${alias}.deleted_at IS NULL OR ${ownerColumn} = $${userParamIndex})` : `${alias}.deleted_at IS NULL`;
}

function addVisibleLifeCommentCondition(conditions: string[], params: unknown[], userId: number | null): void {
  const userParamIndex = params.length + 1;
  if (userId !== null) {
    params.push(userId);
  }
  conditions.push(visibleLifeCommentExpression('lc', 'lc.created_by_user_id', userId === null ? null : userParamIndex));
  conditions.push(`
    (
      lc.parent_comment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM life_post_comments parent_comment
        WHERE parent_comment.id = lc.parent_comment_id
          AND ${visibleLifeCommentExpression('parent_comment', 'parent_comment.created_by_user_id', userId === null ? null : userParamIndex)}
      )
    )
  `);
}

function buildLifeCommentTree(rows: LifeCommentRow[]): LifeComment[] {
  const comments = new Map<number, LifeComment>();
  const topLevelComments: LifeComment[] = [];

  for (const row of rows) {
    const { createdAtCursor: _createdAtCursor, ...comment } = row;
    comments.set(row.id, { ...comment, replies: [] });
  }

  for (const comment of comments.values()) {
    if (comment.parentCommentId === null) {
      topLevelComments.push(comment);
      continue;
    }

    const parent = comments.get(comment.parentCommentId);
    if (parent?.parentCommentId === null) {
      parent.replies.push(comment);
    } else {
      topLevelComments.push(comment);
    }
  }

  return topLevelComments;
}

async function lifeCommentCountsForPosts(
  postIds: number[],
  userId: number | null,
  canViewAll: boolean
): Promise<Map<number, number>> {
  const countsByPost = new Map<number, number>();
  for (const postId of postIds) {
    countsByPost.set(postId, 0);
  }

  if (postIds.length === 0) {
    return countsByPost;
  }

  const params: unknown[] = [postIds];
  const conditions = ['lc.post_id = ANY($1::integer[])'];
  addVisibleLifeCommentCondition(conditions, params, userId);
  addModerationVisibilityCondition(conditions, params, 'lc', 'lc.created_by_user_id', userId, canViewAll);

  const rows = await query<{ postId: number; total: number }>(
    `
      SELECT post_id AS "postId", COUNT(*)::integer AS total
      FROM life_post_comments lc
      WHERE ${conditions.join(' AND ')}
      GROUP BY post_id
    `,
    params
  );

  for (const row of rows) {
    countsByPost.set(row.postId, row.total);
  }

  return countsByPost;
}

async function lifeCommentPreviewForPosts(
  postIds: number[],
  userId: number | null,
  canViewAll: boolean
): Promise<Map<number, LifeComment[]>> {
  const commentsByPost = new Map<number, LifeComment[]>();
  if (postIds.length === 0) {
    return commentsByPost;
  }

  const params: unknown[] = [postIds];
  const previewConditions = ['lc.post_id = ANY($1::integer[])', 'lc.parent_comment_id IS NULL'];
  addVisibleLifeCommentCondition(previewConditions, params, userId);
  addModerationVisibilityCondition(previewConditions, params, 'lc', 'lc.created_by_user_id', userId, canViewAll);
  params.push(lifeCommentPreviewLimit);

  const rows = await query<LifeCommentRow>(
    `
      WITH preview_top AS (
        SELECT id
        FROM (
          SELECT
            lc.id,
            ROW_NUMBER() OVER (PARTITION BY lc.post_id ORDER BY lc.created_at DESC, lc.id DESC) AS preview_rank
          FROM life_post_comments lc
          WHERE ${previewConditions.join(' AND ')}
        ) ranked
        WHERE preview_rank <= $${params.length}
      )
      ${lifeCommentProjection('WHERE lc.id IN (SELECT id FROM preview_top)', userId, canViewAll)}
      ORDER BY lc.post_id, lc.created_at, lc.id
    `,
    params
  );

  for (const postId of postIds) {
    commentsByPost.set(postId, buildLifeCommentTree(rows.filter((comment) => comment.postId === postId)));
  }

  return commentsByPost;
}

export async function listLifeComments(
  postIdValue: number,
  paramsQuery: QueryParams = {},
  userId: number | null = null,
  canViewAll = false
): Promise<LifeCommentsPage | null> {
  const postId = requirePositiveInteger(postIdValue, 'server.validation.recordInvalid');
  const cursor = decodeCommentCursor(paramsQuery.cursor);
  const limit = cleanCommentLimit(paramsQuery.limit);
  const languageCode = cleanModerationLanguageFilter(paramsQuery.language);
  const sort = cleanCommentSort(paramsQuery.sort);
  const postParams: unknown[] = [postId];
  const postConditions = ['lp.id = $1', 'lp.deleted_at IS NULL'];
  addModerationVisibilityCondition(postConditions, postParams, 'lp', 'lp.created_by_user_id', userId, canViewAll);
  const exists = await queryOne<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM life_posts lp
        WHERE ${postConditions.join(' AND ')}
      ) AS exists
    `,
    postParams
  );

  if (exists?.exists !== true) {
    return null;
  }

  const params: unknown[] = [postId];
  const topLevelConditions = ['lc.post_id = $1', 'lc.parent_comment_id IS NULL'];
  addVisibleLifeCommentCondition(topLevelConditions, params, userId);
  addModerationVisibilityCondition(topLevelConditions, params, 'lc', 'lc.created_by_user_id', userId, canViewAll);
  addModerationLanguageCondition(topLevelConditions, params, 'lc', languageCode);

  if (cursor) {
    addCommentCursorCondition(topLevelConditions, params, 'lc', cursor, sort);
  }

  params.push(limit + 1);
  const topLevelRows = await query<LifeCommentRow>(
    `
      ${lifeCommentProjection(`WHERE ${topLevelConditions.join(' AND ')}`, userId, canViewAll)}
      ORDER BY ${commentSortOrder('lc', sort)}
      LIMIT $${params.length}
    `,
    params
  );
  const hasMore = topLevelRows.length > limit;
  const topLevelComments = hasMore ? topLevelRows.slice(0, limit) : topLevelRows;
  const topLevelIds = topLevelComments.map((comment) => comment.id);
  const replyRows = topLevelIds.length
    ? await (async () => {
        const replyParams: unknown[] = [topLevelIds];
        const replyConditions = ['lc.parent_comment_id = ANY($1::integer[])'];
        addVisibleLifeCommentCondition(replyConditions, replyParams, userId);
        addModerationVisibilityCondition(replyConditions, replyParams, 'lc', 'lc.created_by_user_id', userId, canViewAll);
        addModerationLanguageCondition(replyConditions, replyParams, 'lc', languageCode);
        return query<LifeCommentRow>(
          `
            ${lifeCommentProjection(`WHERE ${replyConditions.join(' AND ')}`, userId, canViewAll)}
            ORDER BY lc.created_at, lc.id
          `,
          replyParams
        );
      })()
    : [];
  const totalParams: unknown[] = [postId];
  const totalConditions = ['lc.post_id = $1'];
  addVisibleLifeCommentCondition(totalConditions, totalParams, userId);
  addModerationVisibilityCondition(totalConditions, totalParams, 'lc', 'lc.created_by_user_id', userId, canViewAll);
  addModerationLanguageCondition(totalConditions, totalParams, 'lc', languageCode);
  const total = await queryOne<{ total: number }>(
    `
      SELECT COUNT(*)::integer AS total
      FROM life_post_comments lc
      WHERE ${totalConditions.join(' AND ')}
    `,
    totalParams
  );

  return {
    items: buildLifeCommentTree([...topLevelComments, ...replyRows]),
    nextCursor:
      hasMore && topLevelComments.length > 0
        ? encodeCommentCursor(topLevelComments[topLevelComments.length - 1], sort)
        : null,
    hasMore,
    total: total?.total ?? 0
  };
}

async function lifeReactionsForPosts(
  postIds: number[],
  userId: number | null
): Promise<{
  countsByPost: Map<number, LifeReactionCounts>;
  myReactionsByPost: Map<number, LifeReactionType>;
}> {
  const countsByPost = new Map<number, LifeReactionCounts>();
  const myReactionsByPost = new Map<number, LifeReactionType>();

  for (const postId of postIds) {
    countsByPost.set(postId, emptyLifeReactionCounts());
  }

  if (postIds.length === 0) {
    return { countsByPost, myReactionsByPost };
  }

  const countRows = await query<{ postId: number; reactionType: LifeReactionType; count: number }>(
    `
      SELECT
        post_id AS "postId",
        reaction_type AS "reactionType",
        COUNT(*)::integer AS count
      FROM life_post_reactions
      WHERE post_id = ANY($1::integer[])
      GROUP BY post_id, reaction_type
    `,
    [postIds]
  );

  for (const row of countRows) {
    const counts = countsByPost.get(row.postId);
    if (counts && isLifeReactionType(row.reactionType)) {
      counts[row.reactionType] = row.count;
    }
  }

  if (userId !== null) {
    const myRows = await query<{ postId: number; reactionType: LifeReactionType }>(
      `
        SELECT post_id AS "postId", reaction_type AS "reactionType"
        FROM life_post_reactions
        WHERE post_id = ANY($1::integer[])
          AND user_id = $2
      `,
      [postIds, userId]
    );

    for (const row of myRows) {
      if (isLifeReactionType(row.reactionType)) {
        myReactionsByPost.set(row.postId, row.reactionType);
      }
    }
  }

  return { countsByPost, myReactionsByPost };
}

export async function listLifePostReactionUsers(
  postIdValue: number,
  paramsQuery: QueryParams = {},
  userId: number | null = null,
  canViewAll = false
): Promise<LifeReactionUsersPage | null> {
  const postId = requirePositiveInteger(postIdValue, 'server.validation.recordInvalid');
  const cursor = decodeLifeReactionUserCursor(paramsQuery.cursor);
  const limit = cleanLifePostLimit(paramsQuery.limit);
  const reactionType = cleanLifeReactionFilter(paramsQuery.reactionType);
  const postParams: unknown[] = [postId];
  const postConditions = ['lp.id = $1', 'lp.deleted_at IS NULL'];
  addModerationVisibilityCondition(postConditions, postParams, 'lp', 'lp.created_by_user_id', userId, canViewAll);
  const exists = await queryOne<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM life_posts lp
        WHERE ${postConditions.join(' AND ')}
      ) AS exists
    `,
    postParams
  );

  if (exists?.exists !== true) {
    return null;
  }

  const params: unknown[] = [postId];
  const conditions = ['lpr.post_id = $1'];
  if (reactionType) {
    params.push(reactionType);
    conditions.push(`lpr.reaction_type = $${params.length}`);
  }
  if (cursor) {
    params.push(cursor.reactedAt, cursor.userId);
    conditions.push(`(lpr.updated_at, lpr.user_id) < ($${params.length - 1}::timestamptz, $${params.length}::integer)`);
  }

  params.push(limit + 1);
  const rows = await query<{
    userId: number;
    displayName: string;
    reactionType: LifeReactionType;
    reactedAt: Date;
    reactedAtCursor: string;
  }>(
    `
      SELECT
        u.id AS "userId",
        u.display_name AS "displayName",
        lpr.reaction_type AS "reactionType",
        lpr.updated_at AS "reactedAt",
        lpr.updated_at::text AS "reactedAtCursor"
      FROM life_post_reactions lpr
      JOIN users u ON u.id = lpr.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY lpr.updated_at DESC, lpr.user_id DESC
      LIMIT $${params.length}
    `,
    params
  );
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const totalParams: unknown[] = [postId];
  const totalConditions = ['post_id = $1'];
  if (reactionType) {
    totalParams.push(reactionType);
    totalConditions.push(`reaction_type = $${totalParams.length}`);
  }
  const total = await queryOne<{ total: number }>(
    `
      SELECT COUNT(*)::integer AS total
      FROM life_post_reactions
      WHERE ${totalConditions.join(' AND ')}
    `,
    totalParams
  );

  return {
    items: items.map((item) => ({
      user: { id: item.userId, displayName: item.displayName },
      reactionType: item.reactionType,
      reactedAt: item.reactedAt
    })),
    nextCursor:
      hasMore && items.length > 0
        ? encodeLifeReactionUserCursor({
            reactedAt: items[items.length - 1].reactedAtCursor,
            userId: items[items.length - 1].userId
          })
        : null,
    hasMore,
    total: total?.total ?? 0
  };
}

async function lifeRatingsForPosts(postIds: number[], userId: number | null): Promise<Map<number, number>> {
  const myRatingsByPost = new Map<number, number>();

  if (postIds.length === 0 || userId === null) {
    return myRatingsByPost;
  }

  const rows = await query<{ postId: number; rating: number }>(
    `
      SELECT post_id AS "postId", rating
      FROM life_post_ratings
      WHERE post_id = ANY($1::integer[])
        AND user_id = $2
    `,
    [postIds, userId]
  );

  for (const row of rows) {
    myRatingsByPost.set(row.postId, row.rating);
  }

  return myRatingsByPost;
}

async function getLifeCommentById(id: number, userId: number | null = null, canViewAll = false): Promise<LifeComment | null> {
  const row = await queryOne<LifeCommentRow>(
    `
      ${lifeCommentProjection('WHERE lc.id = $1', userId, canViewAll)}
    `,
    [id]
  );

  if (!row) {
    return null;
  }

  const { createdAtCursor: _createdAtCursor, ...comment } = row;
  return { ...comment, replies: [] };
}

async function listLifePostsWithFilters(
  paramsQuery: QueryParams = {},
  userId: number | null = null,
  locale = defaultLocale,
  filters: LifePostFilters = {},
  canViewAll = false
): Promise<LifePostsPage> {
  const cursor = decodeLifePostCursor(paramsQuery.cursor);
  const limit = cleanLifePostLimit(paramsQuery.limit);
  const sort = cleanLifePostSort(paramsQuery.sort);
  const search = asString(paramsQuery.search)?.trim();
  const categoryIdValue = asString(paramsQuery.categoryId)?.trim();
  const gameVersionIdValue = asString(paramsQuery.gameVersionId)?.trim();
  const rateable = cleanRateableFilter(paramsQuery.rateable);
  const languageCode = cleanModerationLanguageFilter(paramsQuery.language);
  const params: unknown[] = [];
  const conditions: string[] = ['lp.deleted_at IS NULL'];

  if (filters.authorId !== undefined) {
    params.push(filters.authorId);
    conditions.push(`lp.created_by_user_id = $${params.length}`);
  }

  if (filters.followedByUserId !== undefined) {
    params.push(filters.followedByUserId);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM user_follows uf
        WHERE uf.follower_user_id = $${params.length}
          AND uf.followed_user_id = lp.created_by_user_id
      )
    `);
  }

  addModerationVisibilityCondition(conditions, params, 'lp', 'lp.created_by_user_id', userId, canViewAll);
  addModerationLanguageCondition(conditions, params, 'lp', languageCode);

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`lp.body ILIKE $${params.length}`);
  }

  if (categoryIdValue) {
    const categoryId = requirePositiveInteger(categoryIdValue, 'server.validation.lifeCategoryInvalid');
    params.push(categoryId);
    conditions.push(`lp.category_id = $${params.length}`);
  }

  if (gameVersionIdValue && gameVersionIdValue !== 'all') {
    const gameVersionId = requirePositiveInteger(gameVersionIdValue, 'server.validation.gameVersionInvalid');
    params.push(gameVersionId);
    conditions.push(`lp.game_version_id = $${params.length}`);
  }

  if (rateable !== null) {
    params.push(rateable);
    conditions.push(`lc.is_rateable = $${params.length}`);
  }

  if (cursor) {
    if (sort === 'top-rated') {
      params.push(cursor.ratingAverage ?? 0, cursor.createdAt, cursor.id);
      conditions.push(
        `(COALESCE(rating_stats.rating_average, 0), lp.created_at, lp.id) < ($${params.length - 2}::numeric, $${params.length - 1}::timestamptz, $${params.length}::integer)`
      );
    } else {
      params.push(cursor.createdAt, cursor.id);
      conditions.push(
        `(lp.created_at, lp.id) ${sort === 'oldest' ? '>' : '<'} ($${params.length - 1}::timestamptz, $${params.length}::integer)`
      );
    }
  }

  const orderClause =
    sort === 'top-rated'
      ? 'ORDER BY COALESCE(rating_stats.rating_average, 0) DESC, lp.created_at DESC, lp.id DESC'
      : `ORDER BY lp.created_at ${sort === 'oldest' ? 'ASC' : 'DESC'}, lp.id ${sort === 'oldest' ? 'ASC' : 'DESC'}`;
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit + 1);
  const rows = await query<LifePostRow>(
    `
      ${lifePostProjection(locale)}
      ${whereClause}
      ${orderClause}
      LIMIT $${params.length}
    `,
    params
  );
  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;

  const postIds = posts.map((post) => post.id);
  const commentPreviewByPost = await lifeCommentPreviewForPosts(postIds, userId, canViewAll);
  const commentCountsByPost = await lifeCommentCountsForPosts(postIds, userId, canViewAll);
  const { countsByPost, myReactionsByPost } = await lifeReactionsForPosts(postIds, userId);
  const myRatingsByPost = await lifeRatingsForPosts(postIds, userId);

  return {
    items: posts.map((post) =>
      hydrateLifePost(post, commentPreviewByPost, commentCountsByPost, countsByPost, myReactionsByPost, myRatingsByPost)
    ),
    nextCursor: hasMore && posts.length > 0 ? encodeLifePostCursor(posts[posts.length - 1]) : null,
    hasMore
  };
}

export async function listLifePosts(
  paramsQuery: QueryParams = {},
  userId: number | null = null,
  locale = defaultLocale,
  canViewAll = false
): Promise<LifePostsPage> {
  return listLifePostsWithFilters(paramsQuery, userId, locale, {}, canViewAll);
}

export async function listFollowingLifePosts(
  userId: number,
  paramsQuery: QueryParams = {},
  locale = defaultLocale,
  canViewAll = false
): Promise<LifePostsPage> {
  return listLifePostsWithFilters(paramsQuery, userId, locale, { followedByUserId: userId }, canViewAll);
}

async function getPublicProfileUser(userIdValue: number): Promise<PublicProfileUser | null> {
  const userId = requirePositiveInteger(userIdValue, 'server.validation.recordInvalid');
  return queryOne<PublicProfileUser>(
    `
      SELECT
        id,
        display_name AS "displayName",
        created_at AS "joinedAt"
      FROM users
      WHERE id = $1
    `,
    [userId]
  );
}

function publicContributionType(entityType: string): string {
  return entityType === 'daily-checklist-items' ? 'daily-checklist' : entityType;
}

async function getPublicProfileSocial(userId: number, viewerUserId: number | null): Promise<PublicProfileSocial> {
  const social = await queryOne<
    Omit<PublicProfileSocial, 'viewerRelation'> & {
      viewerFollows: boolean;
      targetFollowsViewer: boolean;
    }
  >(
    `
      SELECT
        COALESCE((SELECT COUNT(*)::integer FROM user_follows WHERE followed_user_id = $1), 0) AS "followerCount",
        COALESCE((SELECT COUNT(*)::integer FROM user_follows WHERE follower_user_id = $1), 0) AS "followingCount",
        COALESCE((
          SELECT COUNT(*)::integer
          FROM user_follows outgoing
          WHERE outgoing.follower_user_id = $1
            AND EXISTS (
              SELECT 1
              FROM user_follows incoming
              WHERE incoming.follower_user_id = outgoing.followed_user_id
                AND incoming.followed_user_id = $1
            )
        ), 0) AS "friendCount",
        CASE
          WHEN $2::integer IS NULL OR $2::integer = $1 THEN false
          ELSE EXISTS (
            SELECT 1
            FROM user_follows
            WHERE follower_user_id = $2::integer
              AND followed_user_id = $1
          )
        END AS "viewerFollows",
        CASE
          WHEN $2::integer IS NULL OR $2::integer = $1 THEN false
          ELSE EXISTS (
            SELECT 1
            FROM user_follows
            WHERE follower_user_id = $1
              AND followed_user_id = $2::integer
          )
        END AS "targetFollowsViewer"
    `,
    [userId, viewerUserId]
  );

  const viewerRelation =
    social?.viewerFollows && social.targetFollowsViewer
      ? 'friends'
      : social?.viewerFollows
        ? 'following'
        : social?.targetFollowsViewer
          ? 'followed-by'
          : 'none';

  return {
    followerCount: social?.followerCount ?? 0,
    followingCount: social?.followingCount ?? 0,
    friendCount: social?.friendCount ?? 0,
    viewerRelation
  };
}

export async function getPublicUserProfile(userIdValue: number, viewerUserId: number | null = null): Promise<PublicUserProfile | null> {
  const user = await getPublicProfileUser(userIdValue);
  if (!user) {
    return null;
  }

  const stats = await queryOne<PublicProfileStats>(
    `
      SELECT
        COALESCE((SELECT COUNT(*)::integer FROM wiki_edit_logs WHERE user_id = $1), 0) AS "wikiEdits",
        COALESCE((SELECT COUNT(*)::integer FROM wiki_edit_logs WHERE user_id = $1 AND action = 'create'), 0) AS "wikiCreates",
        COALESCE((SELECT COUNT(*)::integer FROM wiki_edit_logs WHERE user_id = $1 AND action = 'update'), 0) AS "wikiUpdates",
        COALESCE((SELECT COUNT(*)::integer FROM wiki_edit_logs WHERE user_id = $1 AND action = 'delete'), 0) AS "wikiDeletes",
        COALESCE((SELECT COUNT(*)::integer FROM entity_image_uploads WHERE created_by_user_id = $1), 0) AS "imageUploads",
        COALESCE((
          SELECT COUNT(*)::integer
          FROM life_posts
          WHERE created_by_user_id = $1
            AND deleted_at IS NULL
            AND ai_moderation_status = 'approved'
        ), 0) AS "lifePosts",
        COALESCE((
          SELECT COUNT(*)::integer
          FROM life_post_comments lc
          JOIN life_posts lp ON lp.id = lc.post_id
          WHERE lc.created_by_user_id = $1
            AND lc.deleted_at IS NULL
            AND lp.deleted_at IS NULL
            AND lc.ai_moderation_status = 'approved'
            AND lp.ai_moderation_status = 'approved'
        ), 0) AS "lifeComments",
        COALESCE((
          SELECT COUNT(*)::integer
          FROM life_post_reactions lpr
          JOIN life_posts lp ON lp.id = lpr.post_id
          WHERE lpr.user_id = $1
            AND lp.deleted_at IS NULL
            AND lp.ai_moderation_status = 'approved'
        ), 0) AS "lifeReactions",
        COALESCE((
          SELECT COUNT(*)::integer
          FROM entity_discussion_comments
          WHERE created_by_user_id = $1
            AND deleted_at IS NULL
            AND ai_moderation_status = 'approved'
        ), 0) AS "discussionComments"
    `,
    [user.id]
  );

  const contributions = await query<PublicProfileContribution>(
    `
      SELECT
        entity_type AS "contentType",
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE action = 'create')::integer AS creates,
        COUNT(*) FILTER (WHERE action = 'update')::integer AS updates,
        COUNT(*) FILTER (WHERE action = 'delete')::integer AS deletes,
        MAX(created_at) AS "lastContributedAt"
      FROM wiki_edit_logs
      WHERE user_id = $1
      GROUP BY entity_type
      ORDER BY total DESC, "lastContributedAt" DESC, entity_type
    `,
    [user.id]
  );

  const social = await getPublicProfileSocial(user.id, viewerUserId);

  return {
    user,
    stats: stats ?? {
      wikiEdits: 0,
      wikiCreates: 0,
      wikiUpdates: 0,
      wikiDeletes: 0,
      imageUploads: 0,
      lifePosts: 0,
      lifeComments: 0,
      lifeReactions: 0,
      discussionComments: 0
    },
    social,
    contributions: contributions.map((item) => ({
      ...item,
      contentType: publicContributionType(item.contentType)
    }))
  };
}

export async function followUser(followerUserId: number, followedUserIdValue: number): Promise<PublicUserProfile | null> {
  const followedUserId = requirePositiveInteger(followedUserIdValue, 'server.validation.recordInvalid');
  if (followerUserId === followedUserId) {
    throw validationError('server.validation.cannotFollowSelf');
  }

  const followedUser = await getPublicProfileUser(followedUserId);
  if (!followedUser) {
    return null;
  }

  const inserted = await queryOne<{ inserted: boolean }>(
    `
      INSERT INTO user_follows (follower_user_id, followed_user_id)
      VALUES ($1, $2)
      ON CONFLICT (follower_user_id, followed_user_id) DO NOTHING
      RETURNING true AS inserted
    `,
    [followerUserId, followedUser.id]
  );

  if (inserted?.inserted === true) {
    await createUserFollowNotification(followerUserId, followedUser.id);
  }

  return getPublicUserProfile(followedUser.id, followerUserId);
}

export async function unfollowUser(followerUserId: number, followedUserIdValue: number): Promise<PublicUserProfile | null> {
  const followedUserId = requirePositiveInteger(followedUserIdValue, 'server.validation.recordInvalid');
  if (followerUserId === followedUserId) {
    throw validationError('server.validation.cannotFollowSelf');
  }

  const followedUser = await getPublicProfileUser(followedUserId);
  if (!followedUser) {
    return null;
  }

  await query(
    `
      DELETE FROM user_follows
      WHERE follower_user_id = $1
        AND followed_user_id = $2
    `,
    [followerUserId, followedUser.id]
  );

  return getPublicUserProfile(followedUser.id, followerUserId);
}

export async function listUserLifePosts(
  userIdValue: number,
  paramsQuery: QueryParams = {},
  viewerUserId: number | null = null,
  locale = defaultLocale,
  canViewAll = false
): Promise<LifePostsPage | null> {
  const user = await getPublicProfileUser(userIdValue);
  if (!user) {
    return null;
  }

  return listLifePostsWithFilters(paramsQuery, viewerUserId, locale, { authorId: user.id }, canViewAll);
}

async function hydrateLifePostsById(
  postIds: number[],
  viewerUserId: number | null,
  locale: string,
  canViewAll = false
): Promise<Map<number, LifePost>> {
  const postById = new Map<number, LifePost>();
  if (postIds.length === 0) {
    return postById;
  }

  const params: unknown[] = [postIds];
  const conditions = ['lp.id = ANY($1::integer[])', 'lp.deleted_at IS NULL'];
  addModerationVisibilityCondition(conditions, params, 'lp', 'lp.created_by_user_id', viewerUserId, canViewAll);
  const posts = await query<LifePostRow>(
    `
      ${lifePostProjection(locale)}
      WHERE ${conditions.join(' AND ')}
    `,
    params
  );
  const commentPreviewByPost = await lifeCommentPreviewForPosts(postIds, viewerUserId, canViewAll);
  const commentCountsByPost = await lifeCommentCountsForPosts(postIds, viewerUserId, canViewAll);
  const { countsByPost, myReactionsByPost } = await lifeReactionsForPosts(postIds, viewerUserId);
  const myRatingsByPost = await lifeRatingsForPosts(postIds, viewerUserId);

  for (const post of posts) {
    postById.set(post.id, hydrateLifePost(post, commentPreviewByPost, commentCountsByPost, countsByPost, myReactionsByPost, myRatingsByPost));
  }

  return postById;
}

export async function listUserReactionActivities(
  userIdValue: number,
  paramsQuery: QueryParams = {},
  viewerUserId: number | null = null,
  locale = defaultLocale
): Promise<UserReactionActivityPage | null> {
  const user = await getPublicProfileUser(userIdValue);
  if (!user) {
    return null;
  }

  const cursor = decodeLifePostCursor(paramsQuery.cursor);
  const limit = cleanLifePostLimit(paramsQuery.limit);
  const reactionType = cleanLifeReactionFilter(paramsQuery.reactionType);
  const params: unknown[] = [user.id];
  const conditions = ['lpr.user_id = $1', 'lp.deleted_at IS NULL', "lp.ai_moderation_status = 'approved'"];

  if (reactionType) {
    params.push(reactionType);
    conditions.push(`lpr.reaction_type = $${params.length}`);
  }

  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    conditions.push(`(lpr.updated_at, lpr.post_id) < ($${params.length - 1}::timestamptz, $${params.length}::integer)`);
  }

  params.push(limit + 1);
  const rows = await query<{
    postId: number;
    reactionType: LifeReactionType;
    reactedAt: Date;
    reactedAtCursor: string;
  }>(
    `
      SELECT
        lpr.post_id AS "postId",
        lpr.reaction_type AS "reactionType",
        lpr.updated_at AS "reactedAt",
        lpr.updated_at::text AS "reactedAtCursor"
      FROM life_post_reactions lpr
      JOIN life_posts lp ON lp.id = lpr.post_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY lpr.updated_at DESC, lpr.post_id DESC
      LIMIT $${params.length}
    `,
    params
  );
  const hasMore = rows.length > limit;
  const activities = hasMore ? rows.slice(0, limit) : rows;
  const postById = await hydrateLifePostsById(
    activities.map((activity) => activity.postId),
    viewerUserId,
    locale
  );

  return {
    items: activities.flatMap((activity) => {
      const post = postById.get(activity.postId);
      return post
        ? [
            {
              postId: activity.postId,
              reactionType: activity.reactionType,
              reactedAt: activity.reactedAt,
              post
            }
          ]
        : [];
    }),
    nextCursor:
      hasMore && activities.length > 0
        ? encodeProfileCursor({
            createdAt: activities[activities.length - 1].reactedAtCursor,
            id: activities[activities.length - 1].postId
          })
        : null,
    hasMore
  };
}

export async function listUserCommentActivities(
  userIdValue: number,
  paramsQuery: QueryParams = {},
  locale = defaultLocale
): Promise<UserCommentActivityPage | null> {
  const user = await getPublicProfileUser(userIdValue);
  if (!user) {
    return null;
  }

  const cursor = decodeUserCommentActivityCursor(paramsQuery.cursor);
  const limit = cleanLifePostLimit(paramsQuery.limit);
  const sourceFilter = cleanUserCommentActivitySourceFilter(paramsQuery.source);
  const pokemonName = localizedName('pokemon', 'p', locale);
  const itemName = localizedName('items', 'i', locale);
  const recipeItemName = localizedName('items', 'recipe_item', locale);
  const habitatName = localizedName('habitats', 'h', locale);
  const artifactName = localizedName('ancient-artifacts', 'a', locale);
  const params: unknown[] = [user.id];
  const outerConditions: string[] = [];

  if (sourceFilter) {
    params.push(sourceFilter);
    outerConditions.push(`source = $${params.length}`);
  }

  if (cursor) {
    params.push(cursor.createdAt, cursor.source, cursor.id);
    outerConditions.push(
      `(created_at, source, id) < ($${params.length - 2}::timestamptz, $${params.length - 1}::text, $${params.length}::integer)`
    );
  }

  params.push(limit + 1);
  const outerWhere = outerConditions.length ? `WHERE ${outerConditions.join(' AND ')}` : '';
  const rows = await query<{
    id: number;
    source: UserCommentActivitySource;
    body: string;
    createdAt: Date;
    createdAtCursor: string;
    targetType: 'life-post' | DiscussionEntityType;
    targetId: number;
    targetTitle: string;
    targetExcerpt: string;
  }>(
    `
      WITH activity AS (
        SELECT
          'life'::text AS source,
          lc.id,
          lc.body,
          lc.created_at,
          lc.created_at::text AS cursor_at,
          'life-post'::text AS target_type,
          lp.id AS target_id,
          COALESCE(post_user.display_name, '') AS target_title,
          lp.body AS target_excerpt
        FROM life_post_comments lc
        JOIN life_posts lp ON lp.id = lc.post_id
        LEFT JOIN users post_user ON post_user.id = lp.created_by_user_id
        WHERE lc.created_by_user_id = $1
          AND lc.deleted_at IS NULL
          AND lp.deleted_at IS NULL
          AND lc.ai_moderation_status = 'approved'
          AND lp.ai_moderation_status = 'approved'

        UNION ALL

        SELECT
          'discussion'::text AS source,
          edc.id,
          edc.body,
          edc.created_at,
          edc.created_at::text AS cursor_at,
          edc.entity_type AS target_type,
          edc.entity_id AS target_id,
          COALESCE(
            CASE edc.entity_type
              WHEN 'pokemon' THEN ${pokemonName}
              WHEN 'items' THEN ${itemName}
              WHEN 'recipes' THEN ${recipeItemName}
              WHEN 'habitats' THEN ${habitatName}
              WHEN 'ancient-artifacts' THEN ${artifactName}
              ELSE ''
            END,
            ''
          ) AS target_title,
          ''::text AS target_excerpt
        FROM entity_discussion_comments edc
        LEFT JOIN pokemon p ON edc.entity_type = 'pokemon' AND p.id = edc.entity_id
        LEFT JOIN items i ON edc.entity_type = 'items' AND i.id = edc.entity_id
        LEFT JOIN recipes r ON edc.entity_type = 'recipes' AND r.id = edc.entity_id
        LEFT JOIN items recipe_item ON recipe_item.id = r.item_id
        LEFT JOIN habitats h ON edc.entity_type = 'habitats' AND h.id = edc.entity_id
        LEFT JOIN ancient_artifacts a ON edc.entity_type = 'ancient-artifacts' AND a.id = edc.entity_id
        WHERE edc.created_by_user_id = $1
          AND edc.deleted_at IS NULL
          AND edc.ai_moderation_status = 'approved'
      )
      SELECT
        source,
        id,
        body,
        created_at AS "createdAt",
        cursor_at AS "createdAtCursor",
        target_type AS "targetType",
        target_id AS "targetId",
        target_title AS "targetTitle",
        target_excerpt AS "targetExcerpt"
      FROM activity
      ${outerWhere}
      ORDER BY created_at DESC, source DESC, id DESC
      LIMIT $${params.length}
    `,
    params
  );
  const hasMore = rows.length > limit;
  const activities = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: activities.map((activity) => ({
      id: activity.id,
      source: activity.source,
      body: activity.body,
      createdAt: activity.createdAt,
      target: {
        type: activity.targetType,
        id: activity.targetId,
        title: activity.targetTitle,
        excerpt: activity.targetExcerpt
      }
    })),
    nextCursor:
      hasMore && activities.length > 0
        ? encodeUserCommentActivityCursor({
            createdAt: activities[activities.length - 1].createdAtCursor,
            id: activities[activities.length - 1].id,
            source: activities[activities.length - 1].source
          })
        : null,
    hasMore
  };
}

async function getLifePostById(
  id: number,
  userId: number | null = null,
  locale = defaultLocale,
  options: { enforceVisibility?: boolean; canViewAll?: boolean } = {}
): Promise<LifePost | null> {
  const params: unknown[] = [id];
  const conditions = ['lp.id = $1', 'lp.deleted_at IS NULL'];

  if (options.enforceVisibility) {
    addModerationVisibilityCondition(conditions, params, 'lp', 'lp.created_by_user_id', userId, options.canViewAll === true);
  }

  const post = await queryOne<LifePostRow>(
    `
      ${lifePostProjection(locale)}
      WHERE ${conditions.join(' AND ')}
    `,
    params
  );

  if (!post) {
    return null;
  }

  const canViewAll = options.canViewAll === true;
  const commentPreviewByPost = await lifeCommentPreviewForPosts([post.id], userId, canViewAll);
  const commentCountsByPost = await lifeCommentCountsForPosts([post.id], userId, canViewAll);
  const { countsByPost, myReactionsByPost } = await lifeReactionsForPosts([post.id], userId);
  const myRatingsByPost = await lifeRatingsForPosts([post.id], userId);
  return hydrateLifePost(post, commentPreviewByPost, commentCountsByPost, countsByPost, myReactionsByPost, myRatingsByPost);
}

export async function getLifePost(
  idValue: number,
  userId: number | null = null,
  locale = defaultLocale,
  canViewAll = false
): Promise<LifePost | null> {
  const id = requirePositiveInteger(idValue, 'server.validation.recordInvalid');
  return getLifePostById(id, userId, locale, { enforceVisibility: true, canViewAll });
}

async function ensureLifeCategory(client: DbClient, categoryId: number): Promise<void> {
  const result = await client.query<{ id: number }>('SELECT id FROM life_tags WHERE id = $1', [categoryId]);
  if (result.rowCount === 0) {
    throw validationError('server.validation.lifeCategoryInvalid');
  }
}

async function ensureGameVersion(client: DbClient, gameVersionId: number | null): Promise<void> {
  if (gameVersionId === null) {
    return;
  }

  const result = await client.query<{ id: number }>('SELECT id FROM game_versions WHERE id = $1', [gameVersionId]);
  if (result.rowCount === 0) {
    throw validationError('server.validation.gameVersionInvalid');
  }
}

async function replaceLifePostCategoryLink(client: DbClient, postId: number, categoryId: number): Promise<void> {
  await client.query('DELETE FROM life_post_tags WHERE post_id = $1', [postId]);
  await client.query(
    `
      INSERT INTO life_post_tags (post_id, tag_id)
      VALUES ($1, $2)
    `,
    [postId, categoryId]
  );
}

export async function createLifePost(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanLifePostPayload(payload);

  const id = await withTransaction(async (client) => {
    await ensureLifeCategory(client, cleanPayload.categoryId);
    await ensureGameVersion(client, cleanPayload.gameVersionId);
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO life_posts (
          body,
          category_id,
          game_version_id,
          ai_moderation_status,
          ai_moderation_language_code,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, 'reviewing', NULL, $4, $4)
        RETURNING id
      `,
      [cleanPayload.body, cleanPayload.categoryId, cleanPayload.gameVersionId, userId]
    );

    const createdId = result.rows[0].id;
    await replaceLifePostCategoryLink(client, createdId, cleanPayload.categoryId);
    return createdId;
  });

  await requestAiModerationReview({ type: 'life-post', id }, { languageCode: cleanPayload.languageCode, resetRetries: true });
  return getLifePostById(id, userId, locale);
}

export async function updateLifePost(
  id: number,
  payload: Record<string, unknown>,
  userId: number,
  locale = defaultLocale,
  allowAny = false
) {
  const cleanPayload = cleanLifePostPayload(payload);

  const updatedId = await withTransaction(async (client) => {
    await ensureLifeCategory(client, cleanPayload.categoryId);
    await ensureGameVersion(client, cleanPayload.gameVersionId);
    const result = await client.query<{ id: number }>(
      `
        UPDATE life_posts
        SET body = $1,
            category_id = $2,
            game_version_id = $3,
            ai_moderation_status = 'reviewing',
            ai_moderation_language_code = NULL,
            ai_moderation_content_hash = NULL,
            ai_moderation_checked_at = NULL,
            ai_moderation_retry_count = 0,
            ai_moderation_updated_at = now(),
            updated_by_user_id = $4,
            updated_at = now()
        WHERE id = $5
          AND ($6 = true OR created_by_user_id = $4)
          AND deleted_at IS NULL
        RETURNING id
      `,
      [cleanPayload.body, cleanPayload.categoryId, cleanPayload.gameVersionId, userId, id, allowAny]
    );

    const resultId = result.rows[0]?.id ?? null;
    if (resultId === null) {
      return null;
    }

    await replaceLifePostCategoryLink(client, resultId, cleanPayload.categoryId);
    return resultId;
  });

  if (updatedId) {
    await requestAiModerationReview(
      { type: 'life-post', id: updatedId },
      { languageCode: cleanPayload.languageCode, resetRetries: true }
    );
  }

  return updatedId ? getLifePostById(updatedId, userId, locale) : null;
}

export async function deleteLifePost(id: number, userId: number, allowAny = false) {
  const result = await queryOne<{ id: number }>(
    `
      UPDATE life_posts
      SET deleted_at = now(),
          deleted_by_user_id = $2,
          updated_by_user_id = $2,
          updated_at = now()
      WHERE id = $1
        AND ($3 = true OR created_by_user_id = $2)
        AND deleted_at IS NULL
      RETURNING id
    `,
    [id, userId, allowAny]
  );

  return Boolean(result);
}

export async function retryLifePostModeration(id: number, userId: number, locale = defaultLocale, allowAny = false) {
  const postId = requirePositiveInteger(id, 'server.validation.recordInvalid');
  const row = await queryOne<{ id: number }>(
    `
      SELECT id
      FROM life_posts
      WHERE id = $1
        AND ($3 = true OR created_by_user_id = $2)
        AND deleted_at IS NULL
        AND ai_moderation_status IN ('unreviewed', 'rejected', 'failed')
    `,
    [postId, userId, allowAny]
  );

  if (!row) {
    return null;
  }

  await requestAiModerationReview({ type: 'life-post', id: postId }, { incrementRetries: true });
  return getLifePostById(postId, userId, locale);
}

export async function setLifePostReaction(
  postId: number,
  payload: Record<string, unknown>,
  userId: number,
  locale = defaultLocale
) {
  const reactionType = cleanLifeReactionType(payload.reactionType);

  const result = await queryOne<{ postId: number }>(
    `
      INSERT INTO life_post_reactions (post_id, user_id, reaction_type)
      SELECT $1, $2, $3
      WHERE EXISTS (
        SELECT 1
        FROM life_posts
        WHERE id = $1
          AND deleted_at IS NULL
          AND ai_moderation_status = 'approved'
      )
      ON CONFLICT (post_id, user_id)
      DO UPDATE SET reaction_type = EXCLUDED.reaction_type, updated_at = now()
      RETURNING post_id AS "postId"
    `,
    [postId, userId, reactionType]
  );

  if (result) {
    await createLifePostReactionNotification(result.postId, userId);
  }

  return result ? getLifePostById(result.postId, userId, locale) : null;
}

export async function deleteLifePostReaction(postId: number, userId: number, locale = defaultLocale) {
  await queryOne<{ postId: number }>(
    `
      DELETE FROM life_post_reactions
      WHERE post_id = $1
        AND user_id = $2
        AND EXISTS (
          SELECT 1
          FROM life_posts
          WHERE id = $1
            AND deleted_at IS NULL
            AND ai_moderation_status = 'approved'
        )
      RETURNING post_id AS "postId"
    `,
    [postId, userId]
  );

  return getLifePostById(postId, userId, locale);
}

export async function setLifePostRating(
  postId: number,
  payload: Record<string, unknown>,
  userId: number,
  locale = defaultLocale
) {
  const rating = cleanLifeRating(payload.rating);

  const result = await queryOne<{ postId: number }>(
    `
      INSERT INTO life_post_ratings (post_id, user_id, rating)
      SELECT $1, $2, $3
      FROM life_posts lp
      JOIN life_tags lt ON lt.id = lp.category_id
      WHERE lp.id = $1
        AND lp.deleted_at IS NULL
        AND lp.ai_moderation_status = 'approved'
        AND lt.is_rateable = true
      ON CONFLICT (post_id, user_id)
      DO UPDATE SET rating = EXCLUDED.rating, updated_at = now()
      RETURNING post_id AS "postId"
    `,
    [postId, userId, rating]
  );

  return result ? getLifePostById(result.postId, userId, locale) : null;
}

export async function deleteLifePostRating(postId: number, userId: number, locale = defaultLocale) {
  const result = await queryOne<{ postId: number }>(
    `
      DELETE FROM life_post_ratings
      WHERE post_id = $1
        AND user_id = $2
        AND EXISTS (
          SELECT 1
          FROM life_posts lp
          JOIN life_tags lt ON lt.id = lp.category_id
          WHERE lp.id = $1
            AND lp.deleted_at IS NULL
            AND lp.ai_moderation_status = 'approved'
            AND lt.is_rateable = true
        )
      RETURNING post_id AS "postId"
    `,
    [postId, userId]
  );

  return result ? getLifePostById(postId, userId, locale) : null;
}

export async function createLifeComment(postId: number, payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanLifeCommentPayload(payload);

  const result = await queryOne<{ id: number }>(
    `
      INSERT INTO life_post_comments (post_id, body, ai_moderation_status, ai_moderation_language_code, created_by_user_id)
      SELECT $1, $2, 'reviewing', NULL, $3
      WHERE EXISTS (
        SELECT 1
        FROM life_posts
        WHERE id = $1
          AND deleted_at IS NULL
          AND ai_moderation_status = 'approved'
      )
      RETURNING id
    `,
    [postId, cleanPayload.body, userId]
  );

  if (result) {
    await requestAiModerationReview(
      { type: 'life-comment', id: result.id },
      { languageCode: cleanPayload.languageCode, resetRetries: true }
    );
  }

  return result ? getLifeCommentById(result.id, userId, false) : null;
}

export async function createLifeCommentReply(
  postId: number,
  commentId: number,
  payload: Record<string, unknown>,
  userId: number
) {
  const cleanPayload = cleanLifeCommentPayload(payload);

  const result = await queryOne<{ id: number }>(
    `
      INSERT INTO life_post_comments (
        post_id,
        parent_comment_id,
        body,
        ai_moderation_status,
        ai_moderation_language_code,
        created_by_user_id
      )
      SELECT lc.post_id, lc.id, $3, 'reviewing', NULL, $4
      FROM life_post_comments lc
      JOIN life_posts lp ON lp.id = lc.post_id
      WHERE lc.post_id = $1
        AND lc.id = $2
        AND lc.parent_comment_id IS NULL
        AND lc.deleted_at IS NULL
        AND lc.ai_moderation_status = 'approved'
        AND lp.deleted_at IS NULL
        AND lp.ai_moderation_status = 'approved'
      RETURNING id
    `,
    [postId, commentId, cleanPayload.body, userId]
  );

  if (result) {
    await requestAiModerationReview(
      { type: 'life-comment', id: result.id },
      { languageCode: cleanPayload.languageCode, resetRetries: true }
    );
  }

  return result ? getLifeCommentById(result.id, userId, false) : null;
}

export async function deleteLifeComment(id: number, userId: number, allowAny = false) {
  const result = await queryOne<{ id: number }>(
    `
      UPDATE life_post_comments
      SET deleted_at = now(), deleted_by_user_id = $2, updated_at = now()
      WHERE id = $1
        AND ($3 = true OR created_by_user_id = $2)
        AND deleted_at IS NULL
      RETURNING id
    `,
    [id, userId, allowAny]
  );

  return Boolean(result);
}

export async function restoreLifeComment(id: number, userId: number) {
  const commentId = requirePositiveInteger(id, 'server.validation.commentInvalid');
  const result = await queryOne<{ id: number }>(
    `
      UPDATE life_post_comments
      SET deleted_at = NULL, deleted_by_user_id = NULL, updated_at = now()
      WHERE id = $1
        AND created_by_user_id = $2
        AND deleted_at IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM life_posts lp
          WHERE lp.id = life_post_comments.post_id
            AND lp.deleted_at IS NULL
        )
      RETURNING id
    `,
    [commentId, userId]
  );

  return result ? getLifeCommentById(result.id, userId, false) : null;
}

export async function retryLifeCommentModeration(id: number, userId: number, allowAny = false) {
  const commentId = requirePositiveInteger(id, 'server.validation.commentInvalid');
  const row = await queryOne<{ id: number }>(
    `
      SELECT id
      FROM life_post_comments
      WHERE id = $1
        AND ($3 = true OR created_by_user_id = $2)
        AND deleted_at IS NULL
        AND ai_moderation_status IN ('unreviewed', 'rejected', 'failed')
    `,
    [commentId, userId, allowAny]
  );

  if (!row) {
    return null;
  }

  await requestAiModerationReview({ type: 'life-comment', id: commentId }, { incrementRetries: true });
  return getLifeCommentById(commentId, userId, allowAny);
}

async function approvedLifeCommentExists(commentId: number): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    `
      SELECT lc.id
      FROM life_post_comments lc
      JOIN life_posts lp ON lp.id = lc.post_id
      WHERE lc.id = $1
        AND lc.deleted_at IS NULL
        AND lc.ai_moderation_status = 'approved'
        AND lp.deleted_at IS NULL
        AND lp.ai_moderation_status = 'approved'
    `,
    [commentId]
  );

  return Boolean(row);
}

export async function setLifeCommentLike(id: number, userId: number): Promise<LifeComment | null> {
  const commentId = requirePositiveInteger(id, 'server.validation.commentInvalid');
  if (!(await approvedLifeCommentExists(commentId))) {
    return null;
  }

  await queryOne<{ commentId: number }>(
    `
      INSERT INTO life_comment_likes (comment_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (comment_id, user_id) DO NOTHING
      RETURNING comment_id AS "commentId"
    `,
    [commentId, userId]
  );

  return getLifeCommentById(commentId, userId);
}

export async function deleteLifeCommentLike(id: number, userId: number): Promise<LifeComment | null> {
  const commentId = requirePositiveInteger(id, 'server.validation.commentInvalid');
  if (!(await approvedLifeCommentExists(commentId))) {
    return null;
  }

  await queryOne<{ commentId: number }>(
    `
      DELETE FROM life_comment_likes
      WHERE comment_id = $1
        AND user_id = $2
      RETURNING comment_id AS "commentId"
    `,
    [commentId, userId]
  );

  return getLifeCommentById(commentId, userId);
}

function cleanDiscussionEntityType(value: unknown): DiscussionEntityType {
  if (typeof value !== 'string' || !Object.hasOwn(discussionEntityDefinitions, value)) {
    throw validationError('server.validation.entityTypeInvalid');
  }

  return value as DiscussionEntityType;
}

function cleanEntityDiscussionCommentPayload(payload: Record<string, unknown>): EntityDiscussionCommentPayload {
  const body = cleanName(payload.body, 'server.validation.commentRequired');
  if (body.length > 1000) {
    throw validationError('server.validation.commentTooLong');
  }

  return { body, languageCode: cleanModerationLanguageCode(payload.languageCode) };
}

async function entityDiscussionExists(
  client: Pick<DbClient, 'query'>,
  entityType: DiscussionEntityType,
  entityId: number
): Promise<boolean> {
  const definition = discussionEntityDefinitions[entityType];
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM ${definition.table} WHERE id = $1) AS exists`,
    [entityId]
  );

  return result.rows[0]?.exists === true;
}

function entityDiscussionCommentProjection(whereClause: string, userId: number | null = null, canViewAll = false): string {
  const myLikedExpression =
    userId === null
      ? 'false'
      : `EXISTS (
          SELECT 1
          FROM entity_discussion_comment_likes my_like
          WHERE my_like.comment_id = edc.id AND my_like.user_id = ${userId}
        )`;
  const replyVisibility = [
    'reply.parent_comment_id = edc.id',
    'reply.deleted_at IS NULL',
    moderationVisibilitySql('reply', 'reply.created_by_user_id', userId, canViewAll)
  ].join(' AND ');

  return `
    SELECT
      edc.id,
      edc.entity_type AS "entityType",
      edc.entity_id AS "entityId",
      edc.parent_comment_id AS "parentCommentId",
      CASE WHEN edc.deleted_at IS NULL THEN edc.body ELSE '' END AS body,
      edc.deleted_at IS NOT NULL AS deleted,
      edc.ai_moderation_status AS "moderationStatus",
      edc.ai_moderation_language_code AS "moderationLanguageCode",
      edc.ai_moderation_reason AS "moderationReason",
      edc.created_at AS "createdAt",
      edc.created_at::text AS "createdAtCursor",
      edc.updated_at AS "updatedAt",
      CASE
        WHEN edc.deleted_at IS NOT NULL OR comment_user.id IS NULL THEN NULL
        ELSE json_build_object('id', comment_user.id, 'displayName', comment_user.display_name)
      END AS author,
      like_stats.like_count AS "likeCount",
      reply_stats.reply_count AS "replyCount",
      ${myLikedExpression} AS "myLiked"
    FROM entity_discussion_comments edc
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS like_count
      FROM entity_discussion_comment_likes edcl
      WHERE edcl.comment_id = edc.id
    ) like_stats ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS reply_count
      FROM entity_discussion_comments reply
      WHERE ${replyVisibility}
    ) reply_stats ON true
    LEFT JOIN users comment_user ON comment_user.id = edc.created_by_user_id
    ${whereClause}
  `;
}

function buildEntityDiscussionCommentTree(rows: EntityDiscussionCommentRow[]): EntityDiscussionComment[] {
  const comments = new Map<number, EntityDiscussionComment>();
  const topLevelComments: EntityDiscussionComment[] = [];

  for (const row of rows) {
    const { createdAtCursor: _createdAtCursor, ...comment } = row;
    comments.set(row.id, { ...comment, replies: [] });
  }

  for (const comment of comments.values()) {
    if (comment.parentCommentId === null) {
      topLevelComments.push(comment);
      continue;
    }

    const parent = comments.get(comment.parentCommentId);
    if (parent?.parentCommentId === null) {
      parent.replies.push(comment);
    } else {
      topLevelComments.push(comment);
    }
  }

  return topLevelComments;
}

async function getEntityDiscussionCommentById(
  id: number,
  userId: number | null = null,
  canViewAll = false
): Promise<EntityDiscussionComment | null> {
  const row = await queryOne<EntityDiscussionCommentRow>(
    `
      ${entityDiscussionCommentProjection('WHERE edc.id = $1', userId, canViewAll)}
    `,
    [id]
  );

  if (!row) {
    return null;
  }

  const { createdAtCursor: _createdAtCursor, ...comment } = row;
  return { ...comment, replies: [] };
}

export async function listEntityDiscussionComments(
  entityTypeValue: string,
  entityIdValue: number,
  paramsQuery: QueryParams = {},
  userId: number | null = null,
  canViewAll = false
): Promise<EntityDiscussionCommentsPage | null> {
  const entityType = cleanDiscussionEntityType(entityTypeValue);
  const entityId = requirePositiveInteger(entityIdValue, 'server.validation.recordInvalid');
  const cursor = decodeCommentCursor(paramsQuery.cursor);
  const limit = cleanCommentLimit(paramsQuery.limit);
  const languageCode = cleanModerationLanguageFilter(paramsQuery.language);
  const sort = cleanCommentSort(paramsQuery.sort);

  if (!(await entityDiscussionExists(pool, entityType, entityId))) {
    return null;
  }

  const params: unknown[] = [entityType, entityId];
  const topLevelConditions = ['edc.entity_type = $1', 'edc.entity_id = $2', 'edc.parent_comment_id IS NULL'];
  addModerationVisibilityCondition(topLevelConditions, params, 'edc', 'edc.created_by_user_id', userId, canViewAll);
  addModerationLanguageCondition(topLevelConditions, params, 'edc', languageCode);

  if (cursor) {
    addCommentCursorCondition(topLevelConditions, params, 'edc', cursor, sort);
  }

  params.push(limit + 1);
  const topLevelRows = await query<EntityDiscussionCommentRow>(
    `
      ${entityDiscussionCommentProjection(`WHERE ${topLevelConditions.join(' AND ')}`, userId, canViewAll)}
      ORDER BY ${commentSortOrder('edc', sort)}
      LIMIT $${params.length}
    `,
    params
  );
  const hasMore = topLevelRows.length > limit;
  const topLevelComments = hasMore ? topLevelRows.slice(0, limit) : topLevelRows;
  const topLevelIds = topLevelComments.map((comment) => comment.id);
  const replyRows = topLevelIds.length
    ? await (async () => {
        const replyParams: unknown[] = [topLevelIds];
        const replyConditions = ['edc.parent_comment_id = ANY($1::integer[])'];
        addModerationVisibilityCondition(replyConditions, replyParams, 'edc', 'edc.created_by_user_id', userId, canViewAll);
        addModerationLanguageCondition(replyConditions, replyParams, 'edc', languageCode);
        return query<EntityDiscussionCommentRow>(
          `
            ${entityDiscussionCommentProjection(`WHERE ${replyConditions.join(' AND ')}`, userId, canViewAll)}
            ORDER BY edc.created_at, edc.id
          `,
          replyParams
        );
      })()
    : [];
  const totalParams: unknown[] = [entityType, entityId];
  const totalConditions = ['edc.entity_type = $1', 'edc.entity_id = $2'];
  addModerationVisibilityCondition(totalConditions, totalParams, 'edc', 'edc.created_by_user_id', userId, canViewAll);
  addModerationLanguageCondition(totalConditions, totalParams, 'edc', languageCode);
  const total = await queryOne<{ total: number }>(
    `
      SELECT COUNT(*)::integer AS total
      FROM entity_discussion_comments edc
      WHERE ${totalConditions.join(' AND ')}
    `,
    totalParams
  );

  return {
    items: buildEntityDiscussionCommentTree([...topLevelComments, ...replyRows]),
    nextCursor:
      hasMore && topLevelComments.length > 0
        ? encodeCommentCursor(topLevelComments[topLevelComments.length - 1], sort)
        : null,
    hasMore,
    total: total?.total ?? 0
  };
}

export async function createEntityDiscussionComment(
  entityTypeValue: string,
  entityIdValue: number,
  payload: Record<string, unknown>,
  userId: number
): Promise<EntityDiscussionComment | null> {
  const entityType = cleanDiscussionEntityType(entityTypeValue);
  const entityId = requirePositiveInteger(entityIdValue, 'server.validation.recordInvalid');
  const cleanPayload = cleanEntityDiscussionCommentPayload(payload);

  const id = await withTransaction(async (client) => {
    if (!(await entityDiscussionExists(client, entityType, entityId))) {
      return null;
    }

    const result = await client.query<{ id: number }>(
      `
        INSERT INTO entity_discussion_comments (
          entity_type,
          entity_id,
          body,
          ai_moderation_status,
          ai_moderation_language_code,
          created_by_user_id
        )
        VALUES ($1, $2, $3, 'reviewing', NULL, $4)
        RETURNING id
      `,
      [entityType, entityId, cleanPayload.body, userId]
    );

    return result.rows[0].id;
  });

  if (id) {
    await requestAiModerationReview(
      { type: 'discussion-comment', id },
      { languageCode: cleanPayload.languageCode, resetRetries: true }
    );
  }

  return id ? getEntityDiscussionCommentById(id, userId, false) : null;
}

export async function createEntityDiscussionReply(
  entityTypeValue: string,
  entityIdValue: number,
  commentIdValue: number,
  payload: Record<string, unknown>,
  userId: number
): Promise<EntityDiscussionComment | null> {
  const entityType = cleanDiscussionEntityType(entityTypeValue);
  const entityId = requirePositiveInteger(entityIdValue, 'server.validation.recordInvalid');
  const commentId = requirePositiveInteger(commentIdValue, 'server.validation.commentInvalid');
  const cleanPayload = cleanEntityDiscussionCommentPayload(payload);

  const id = await withTransaction(async (client) => {
    if (!(await entityDiscussionExists(client, entityType, entityId))) {
      return null;
    }

    const result = await client.query<{ id: number }>(
      `
        INSERT INTO entity_discussion_comments (
          entity_type,
          entity_id,
          parent_comment_id,
          body,
          ai_moderation_status,
          ai_moderation_language_code,
          created_by_user_id
        )
        SELECT edc.entity_type, edc.entity_id, edc.id, $4, 'reviewing', NULL, $5
        FROM entity_discussion_comments edc
        WHERE edc.entity_type = $1
          AND edc.entity_id = $2
          AND edc.id = $3
          AND edc.parent_comment_id IS NULL
          AND edc.deleted_at IS NULL
          AND edc.ai_moderation_status = 'approved'
        RETURNING id
      `,
      [entityType, entityId, commentId, cleanPayload.body, userId]
    );

    return result.rows[0]?.id ?? null;
  });

  if (id) {
    await requestAiModerationReview(
      { type: 'discussion-comment', id },
      { languageCode: cleanPayload.languageCode, resetRetries: true }
    );
  }

  return id ? getEntityDiscussionCommentById(id, userId, false) : null;
}

export async function deleteEntityDiscussionComment(id: number, userId: number, allowAny = false): Promise<boolean> {
  const commentId = requirePositiveInteger(id, 'server.validation.commentInvalid');
  const result = await queryOne<{ id: number }>(
    `
      UPDATE entity_discussion_comments
      SET deleted_at = now(),
          deleted_by_user_id = $2,
          updated_at = now()
      WHERE id = $1
        AND ($3 = true OR created_by_user_id = $2)
        AND deleted_at IS NULL
      RETURNING id
    `,
    [commentId, userId, allowAny]
  );

  return Boolean(result);
}

export async function retryEntityDiscussionCommentModeration(
  id: number,
  userId: number,
  allowAny = false
): Promise<EntityDiscussionComment | null> {
  const commentId = requirePositiveInteger(id, 'server.validation.commentInvalid');
  const row = await queryOne<{ id: number }>(
    `
      SELECT id
      FROM entity_discussion_comments
      WHERE id = $1
        AND ($3 = true OR created_by_user_id = $2)
        AND deleted_at IS NULL
        AND ai_moderation_status IN ('unreviewed', 'rejected', 'failed')
    `,
    [commentId, userId, allowAny]
  );

  if (!row) {
    return null;
  }

  await requestAiModerationReview({ type: 'discussion-comment', id: commentId }, { incrementRetries: true });
  return getEntityDiscussionCommentById(commentId, userId, allowAny);
}

async function approvedEntityDiscussionCommentExists(commentId: number): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    `
      SELECT id
      FROM entity_discussion_comments
      WHERE id = $1
        AND deleted_at IS NULL
        AND ai_moderation_status = 'approved'
    `,
    [commentId]
  );

  return Boolean(row);
}

export async function setEntityDiscussionCommentLike(id: number, userId: number): Promise<EntityDiscussionComment | null> {
  const commentId = requirePositiveInteger(id, 'server.validation.commentInvalid');
  if (!(await approvedEntityDiscussionCommentExists(commentId))) {
    return null;
  }

  await queryOne<{ commentId: number }>(
    `
      INSERT INTO entity_discussion_comment_likes (comment_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (comment_id, user_id) DO NOTHING
      RETURNING comment_id AS "commentId"
    `,
    [commentId, userId]
  );

  return getEntityDiscussionCommentById(commentId, userId);
}

export async function deleteEntityDiscussionCommentLike(id: number, userId: number): Promise<EntityDiscussionComment | null> {
  const commentId = requirePositiveInteger(id, 'server.validation.commentInvalid');
  if (!(await approvedEntityDiscussionCommentExists(commentId))) {
    return null;
  }

  await queryOne<{ commentId: number }>(
    `
      DELETE FROM entity_discussion_comment_likes
      WHERE comment_id = $1
        AND user_id = $2
      RETURNING comment_id AS "commentId"
    `,
    [commentId, userId]
  );

  return getEntityDiscussionCommentById(commentId, userId);
}

async function deleteEntityDiscussionCommentsForEntity(
  client: DbClient,
  entityType: DiscussionEntityType,
  entityId: number
): Promise<void> {
  await client.query(
    `
      DELETE FROM entity_discussion_comments
      WHERE entity_type = $1
        AND entity_id = $2
    `,
    [entityType, entityId]
  );
}

export function isConfigType(type: string): type is ConfigType {
  return Object.hasOwn(configDefinitions, type);
}

export async function listConfig(type: ConfigType, locale = defaultLocale) {
  const definition = configDefinitions[type];
  return query(
    `
      SELECT ${configSelect(definition, locale)}, ${auditSelect('c')}
      FROM ${definition.table} c
      ${auditJoins('c')}
      ORDER BY ${configOrder()}
    `
  );
}

async function getConfigById(type: ConfigType, id: number, locale = defaultLocale) {
  const definition = configDefinitions[type];
  return queryOne(
    `
      SELECT ${configSelect(definition, locale)}, ${auditSelect('c')}
      FROM ${definition.table} c
      ${auditJoins('c')}
      WHERE c.id = $1
    `,
    [id]
  );
}

export async function createConfig(type: ConfigType, payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const definition = configDefinitions[type];
  const name = cleanName(payload.name);
  const translations = cleanTranslations(payload.translations, ['name']);
  const hasItemDrop = definition.hasItemDrop ? Boolean(payload.hasItemDrop) : false;
  const isDefault = definition.hasDefault ? Boolean(payload.isDefault) : false;
  const isRateable = definition.hasRateable ? Boolean(payload.isRateable) : false;
  const changeLog = definition.hasChangeLog ? cleanOptionalText(payload.changeLog) : '';

  const id = await withTransaction(async (client) => {
    const sortOrder = await nextSortOrder(client, definition.table);
    if (definition.hasDefault && isDefault) {
      await client.query(
        `UPDATE ${definition.table} SET is_default = false, updated_by_user_id = $1, updated_at = now() WHERE is_default = true`,
        [userId]
      );
    }
    const columns = ['name'];
    const values: unknown[] = [name];
    if (definition.hasItemDrop) {
      columns.push('has_item_drop');
      values.push(hasItemDrop);
    }
    if (definition.hasDefault) {
      columns.push('is_default');
      values.push(isDefault);
    }
    if (definition.hasRateable) {
      columns.push('is_rateable');
      values.push(isRateable);
    }
    if (definition.hasChangeLog) {
      columns.push('change_log');
      values.push(changeLog);
    }
    columns.push('sort_order', 'created_by_user_id', 'updated_by_user_id');
    values.push(sortOrder, userId, userId);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO ${definition.table} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING id
      `,
      values
    );

    const createdId = result.rows[0].id;
    await replaceEntityTranslations(client, definition.entityType, createdId, translations, ['name']);
    await recordEditLog(client, type, createdId, 'create', userId);
    return createdId;
  });

  return getConfigById(type, id, locale);
}

export async function reorderConfig(type: ConfigType, payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const definition = configDefinitions[type];
  const ids = cleanIds(payload.ids);
  if (ids.length === 0) {
    throw validationError('server.validation.selectRecord');
  }

  await withTransaction(async (client) => {
    await reorderTableRows(client, definition.table, type, ids, userId);
  });

  return listConfig(type, locale);
}

export async function updateConfig(
  type: ConfigType,
  id: number,
  payload: Record<string, unknown>,
  userId: number,
  locale = defaultLocale
) {
  const definition = configDefinitions[type];
  const name = cleanName(payload.name);
  const translations = cleanTranslations(payload.translations, ['name']);
  const hasItemDrop = definition.hasItemDrop ? Boolean(payload.hasItemDrop) : false;
  const isDefault = definition.hasDefault ? Boolean(payload.isDefault) : false;
  const isRateable = definition.hasRateable ? Boolean(payload.isRateable) : false;
  const changeLog = definition.hasChangeLog ? cleanOptionalText(payload.changeLog) : '';
  const before = await getConfigById(type, id, defaultLocale);

  const updated = await withTransaction(async (client) => {
    if (definition.hasDefault && isDefault) {
      await client.query(
        `UPDATE ${definition.table} SET is_default = false, updated_by_user_id = $2, updated_at = now() WHERE id <> $1 AND is_default = true`,
        [id, userId]
      );
    }

    const assignments = ['name = $1'];
    const values: unknown[] = [name];
    if (definition.hasItemDrop) {
      values.push(hasItemDrop);
      assignments.push(`has_item_drop = $${values.length}`);
    }
    if (definition.hasDefault) {
      values.push(isDefault);
      assignments.push(`is_default = $${values.length}`);
    }
    if (definition.hasRateable) {
      values.push(isRateable);
      assignments.push(`is_rateable = $${values.length}`);
    }
    if (definition.hasChangeLog) {
      values.push(changeLog);
      assignments.push(`change_log = $${values.length}`);
    }
    values.push(userId);
    assignments.push(`updated_by_user_id = $${values.length}`, 'updated_at = now()');
    values.push(id);
    const result = await client.query(
      `
        UPDATE ${definition.table}
        SET ${assignments.join(', ')}
        WHERE id = $${values.length}
      `,
      values
    );

    if (result.rowCount === 0) {
      return false;
    }

    if (definition.hasItemDrop && !hasItemDrop) {
      await client.query('DELETE FROM pokemon_skill_item_drops WHERE skill_id = $1', [id]);
    }

    await replaceEntityTranslations(client, definition.entityType, id, translations, ['name']);
    const changes = before
      ? configEditChanges(definition, before as ConfigChangeSource, { name, translations, hasItemDrop, isDefault, isRateable, changeLog })
      : [];
    await recordEditLog(client, type, id, 'update', userId, changes);
    return true;
  });

  return updated ? getConfigById(type, id, locale) : null;
}

export async function deleteConfig(type: ConfigType, id: number, userId: number) {
  const definition = configDefinitions[type];
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>(`DELETE FROM ${definition.table} WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await deleteEntityTranslations(client, definition.entityType, id);
    await recordEditLog(client, type, id, 'delete', userId);
    return true;
  });
}

async function reorderContent(type: SortableContentType, payload: Record<string, unknown>, userId: number): Promise<void> {
  const definition = sortableContentDefinitions[type];
  const ids = cleanIds(payload.ids);
  if (ids.length === 0) {
    throw validationError('server.validation.selectRecord');
  }

  await withTransaction(async (client) => {
    await reorderTableRows(client, definition.table, definition.entityType, ids, userId);
  });
}

export async function reorderPokemon(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  await reorderContent('pokemon', payload, userId);
  return listPokemon({}, locale);
}

export async function reorderItems(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  await reorderContent('items', payload, userId);
  return listItems({}, locale);
}

export async function reorderAncientArtifacts(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  await reorderContent('ancient-artifacts', payload, userId);
  return listAncientArtifacts({}, locale);
}

export async function reorderRecipes(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  await reorderContent('recipes', payload, userId);
  return listRecipes({}, locale);
}

export async function reorderHabitats(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  await reorderContent('habitats', payload, userId);
  return listHabitats({}, locale);
}

export async function listPokemon(paramsQuery: QueryParams, locale = defaultLocale) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const search = asString(paramsQuery.search)?.trim();
  const isEventItem = asString(paramsQuery.isEventItem);
  const environmentId = Number(asString(paramsQuery.environmentId));
  const skillIds = parseIdList(asString(paramsQuery.skillIds));
  const favoriteThingIds = parseIdList(asString(paramsQuery.favoriteThingIds));

  if (isEventItem === 'true' || isEventItem === 'false') {
    params.push(isEventItem === 'true');
    conditions.push(`p.is_event_item = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`${localizedName('pokemon', 'p', locale)} ILIKE $${params.length}`);
  }

  if (Number.isInteger(environmentId) && environmentId > 0) {
    params.push(environmentId);
    conditions.push(`p.environment_id = $${params.length}`);
  }

  const skillFilter = sqlForRelationFilter(
    skillIds,
    parseMatchMode(asString(paramsQuery.skillMode)),
    'pokemon_skills',
    'pokemon_id',
    'skill_id',
    'p.id',
    params
  );
  if (skillFilter) {
    conditions.push(skillFilter);
  }

  const favoriteThingFilter = sqlForRelationFilter(
    favoriteThingIds,
    parseMatchMode(asString(paramsQuery.favoriteThingMode)),
    'pokemon_favorite_things',
    'pokemon_id',
    'favorite_thing_id',
    'p.id',
    params
  );
  if (favoriteThingFilter) {
    conditions.push(favoriteThingFilter);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return query(`${pokemonProjection(locale)} ${whereClause} ORDER BY ${orderByEntity('p')}`, params);
}

export async function getPokemon(id: number, locale = defaultLocale) {
  const pokemon = await queryOne(`${pokemonProjection(locale)} WHERE p.id = $1`, [id]);
  if (!pokemon) {
    return null;
  }

  const habitatName = localizedName('habitats', 'h', locale);
  const mapName = localizedName('maps', 'm', locale);
  const itemName = localizedName('items', 'i', locale);
  const tagName = localizedName('favorite-things', 'ft', locale);
  const relatedPokemonName = localizedName('pokemon', 'related_pokemon', locale);
  const relatedEnvironmentName = localizedName('environments', 'related_environment', locale);
  const relatedSkillName = localizedName('skills', 'related_skill', locale);
  const relatedFavoriteThingName = localizedName('favorite-things', 'related_favorite_thing', locale);

  const [habitats, itemDrops, favoriteThingItems, relatedPokemon, editHistory, imageHistory] = await Promise.all([
    query(
      `
        SELECT
          h.id,
          ${habitatName} AS name,
          ${uploadedImageJson('h.image_path')} AS image,
          hp.time_of_day,
          hp.weather,
          hp.rarity,
          json_build_object('id', m.id, 'name', ${mapName}) AS map
        FROM habitat_pokemon hp
        JOIN habitats h ON h.id = hp.habitat_id
        JOIN maps m ON m.id = hp.map_id
        WHERE hp.pokemon_id = $1
        ORDER BY ${orderByEntity('h')}, hp.rarity, ${orderByEntity('m')}
      `,
      [id]
    ),
    query<{ skillId: number; id: number; name: string; image: EntityImageValue | null }>(
      `
        SELECT psid.skill_id AS "skillId", i.id, ${itemName} AS name, ${uploadedImageJson('i.image_path')} AS image
        FROM pokemon_skill_item_drops psid
        JOIN skills s ON s.id = psid.skill_id
        JOIN items i ON i.id = psid.item_id
        WHERE psid.pokemon_id = $1
          AND s.has_item_drop = true
        ORDER BY ${orderByEntity('s')}, ${orderByEntity('i')}
      `,
      [id]
    ),
    query(
      `
        SELECT
          i.id,
          ${itemName} AS name,
          ${uploadedImageJson('i.image_path')} AS image,
          ${systemListJsonSql('i.category_key', itemCategoryOptions, locale)} AS category,
          json_agg(json_build_object('id', ft.id, 'name', ${tagName}) ORDER BY ${orderByEntity('ft')}) AS tags
        FROM pokemon_favorite_things pft
        JOIN item_favorite_things ift ON ift.favorite_thing_id = pft.favorite_thing_id
        JOIN favorite_things ft ON ft.id = pft.favorite_thing_id
        JOIN items i ON i.id = ift.item_id
        WHERE pft.pokemon_id = $1
        GROUP BY i.id, i.name, i.image_path, i.category_key, i.sort_order
        ORDER BY i.category_key, ${orderByEntity('i')}
      `,
      [id]
    ),
    query(
      `
        WITH current_pokemon AS (
          SELECT p.id, p.environment_id
          FROM pokemon p
          WHERE p.id = $1
        ),
        current_favourites AS (
          SELECT pft.favorite_thing_id
          FROM pokemon_favorite_things pft
          WHERE pft.pokemon_id = $1
        ),
        scored_pokemon AS (
          SELECT
            related_pokemon.id,
            related_pokemon.sort_order,
            (related_pokemon.environment_id = current_pokemon.environment_id) AS "environmentMatches",
            COUNT(current_favourites.favorite_thing_id)::integer AS "favoriteThingMatchCount"
          FROM current_pokemon
          JOIN pokemon related_pokemon ON related_pokemon.id <> current_pokemon.id
          LEFT JOIN pokemon_favorite_things related_pokemon_favourite
            ON related_pokemon_favourite.pokemon_id = related_pokemon.id
          LEFT JOIN current_favourites
            ON current_favourites.favorite_thing_id = related_pokemon_favourite.favorite_thing_id
          GROUP BY related_pokemon.id, related_pokemon.sort_order, related_pokemon.environment_id, current_pokemon.environment_id
          HAVING related_pokemon.environment_id = current_pokemon.environment_id
            OR COUNT(current_favourites.favorite_thing_id) > 0
        )
        SELECT
          related_pokemon.id,
          related_pokemon.display_id AS "displayId",
          ${relatedPokemonName} AS name,
          related_pokemon.is_event_item AS "isEventItem",
          ${pokemonImageJson('related_pokemon')} AS image,
          json_build_object('id', related_environment.id, 'name', ${relatedEnvironmentName}) AS environment,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', related_skill.id,
                'name', ${relatedSkillName},
                'hasItemDrop', related_skill.has_item_drop
              )
              ORDER BY ${orderByEntity('related_skill')}
            )
            FROM pokemon_skills related_pokemon_skill
            JOIN skills related_skill ON related_skill.id = related_pokemon_skill.skill_id
            WHERE related_pokemon_skill.pokemon_id = related_pokemon.id
          ), '[]'::json) AS skills,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', related_favorite_thing.id,
                'name', ${relatedFavoriteThingName},
                'matches', EXISTS (
                  SELECT 1
                  FROM current_favourites
                  WHERE current_favourites.favorite_thing_id = related_favorite_thing.id
                )
              )
              ORDER BY ${orderByEntity('related_favorite_thing')}
            )
            FROM pokemon_favorite_things related_pokemon_favourite
            JOIN favorite_things related_favorite_thing ON related_favorite_thing.id = related_pokemon_favourite.favorite_thing_id
            WHERE related_pokemon_favourite.pokemon_id = related_pokemon.id
          ), '[]'::json) AS favorite_things
        FROM scored_pokemon
        JOIN pokemon related_pokemon ON related_pokemon.id = scored_pokemon.id
        JOIN environments related_environment ON related_environment.id = related_pokemon.environment_id
        ORDER BY scored_pokemon."environmentMatches" DESC, scored_pokemon."favoriteThingMatchCount" DESC, scored_pokemon.sort_order, related_pokemon.id
      `,
      [id]
    ),
    getEditHistory('pokemon', id),
    listEntityImageUploads('pokemon', id)
  ]);

  const dropsBySkill = itemDrops.reduce((itemsBySkill, item) => {
    itemsBySkill.set(item.skillId, { id: item.id, name: item.name, image: item.image });
    return itemsBySkill;
  }, new Map<number, { id: number; name: string; image: EntityImageValue | null }>());

  const skills = Array.isArray(pokemon.skills)
    ? pokemon.skills.map((skill: { id: number; name: string }) => ({
        ...skill,
        itemDrop: dropsBySkill.get(skill.id) ?? null
      }))
    : [];

  return { ...pokemon, skills, habitats, favoriteThingItems, relatedPokemon, editHistory, imageHistory };
}

function cleanPokemonPayload(payload: Record<string, unknown>): PokemonPayload {
  const cleanTypeIds = cleanIds(payload.typeIds);
  const typeIds = cleanTypeIds.slice(0, 2);
  const skillIds = cleanIds(payload.skillIds);
  const favoriteThingIds = cleanIds(payload.favoriteThingIds);
  const selectedSkillIds = new Set(skillIds);
  const skillItemDrops = new Map<string, SkillItemDrop>();

  if (typeIds.length === 0) {
    throw validationError('server.validation.typeMin');
  }
  if (cleanTypeIds.length > 2) {
    throw validationError('server.validation.typeMax');
  }
  if (skillIds.length > 2) {
    throw validationError('server.validation.skillMax');
  }
  if (favoriteThingIds.length > 6) {
    throw validationError('server.validation.favoriteMax');
  }

  if (Array.isArray(payload.skillItemDrops)) {
    for (const item of payload.skillItemDrops) {
      const row = item as Record<string, unknown>;
      const skillId = Number(row.skillId);
      const itemId = Number(row.itemId);

      if (!Number.isInteger(itemId) || itemId <= 0) {
        continue;
      }

      if (!Number.isInteger(skillId) || skillId <= 0 || !selectedSkillIds.has(skillId)) {
        throw validationError('server.validation.dropItemSelectedSkill');
      }

      skillItemDrops.set(String(skillId), { skillId, itemId });
    }
  }

  const displayId = requirePositiveInteger(payload.displayId, 'server.validation.pokemonIdRequired');

  return {
    dataId: optionalPositiveInteger(payload.dataId, 'server.validation.pokemonIdRequired'),
    dataIdentifier: cleanOptionalText(payload.dataIdentifier),
    displayId,
    isEventItem: Boolean(payload.isEventItem),
    name: cleanName(payload.name, 'server.validation.pokemonNameRequired'),
    genus: cleanOptionalText(payload.genus),
    details: cleanOptionalText(payload.details),
    heightInches: cleanNonNegativeNumber(payload.heightInches, 'server.validation.heightNonNegative'),
    weightPounds: cleanNonNegativeNumber(payload.weightPounds, 'server.validation.weightNonNegative'),
    translations: cleanTranslations(payload.translations, ['name', 'details', 'genus']),
    typeIds,
    stats: cleanPokemonStats(payload.stats),
    environmentId: requirePositiveInteger(payload.environmentId, 'server.validation.environmentRequired'),
    skillIds,
    favoriteThingIds,
    skillItemDrops: [...skillItemDrops.values()],
    image: cleanPokemonImage(payload.imagePath, displayId)
  };
}

async function normalizePokemonDataIdentity(payload: PokemonPayload): Promise<void> {
  if (payload.dataId === null) {
    payload.dataIdentifier = '';
    return;
  }

  const data = await loadPokemonCsvData();
  const pokemonRow = data.pokemonByLookup.get(String(payload.dataId));
  if (!pokemonRow) {
    throw validationError('server.validation.pokemonDataNotFound');
  }

  payload.dataIdentifier = csvText(pokemonRow, 'identifier');
}

async function replacePokemonRelations(client: DbClient, pokemonId: number, payload: PokemonPayload): Promise<void> {
  await client.query('DELETE FROM pokemon_skill_item_drops WHERE pokemon_id = $1', [pokemonId]);
  await client.query('DELETE FROM pokemon_pokemon_types WHERE pokemon_id = $1', [pokemonId]);
  await client.query('DELETE FROM pokemon_skills WHERE pokemon_id = $1', [pokemonId]);
  await client.query('DELETE FROM pokemon_favorite_things WHERE pokemon_id = $1', [pokemonId]);

  for (const [index, typeId] of payload.typeIds.entries()) {
    await client.query('INSERT INTO pokemon_pokemon_types (pokemon_id, type_id, slot_order) VALUES ($1, $2, $3)', [
      pokemonId,
      typeId,
      index + 1
    ]);
  }

  for (const skillId of payload.skillIds) {
    await client.query('INSERT INTO pokemon_skills (pokemon_id, skill_id) VALUES ($1, $2)', [pokemonId, skillId]);
  }

  for (const favoriteThingId of payload.favoriteThingIds) {
    await client.query('INSERT INTO pokemon_favorite_things (pokemon_id, favorite_thing_id) VALUES ($1, $2)', [
      pokemonId,
      favoriteThingId
    ]);
  }

  if (payload.skillItemDrops.length > 0) {
    const allowedDrops = await client.query<{ id: number }>(
      'SELECT id FROM skills WHERE id = ANY($1::integer[]) AND has_item_drop = true',
      [payload.skillItemDrops.map((drop) => drop.skillId)]
    );
    const allowedDropSkillIds = new Set(allowedDrops.rows.map((row) => row.id));

    if (payload.skillItemDrops.some((drop) => !allowedDropSkillIds.has(drop.skillId))) {
      throw validationError('server.validation.skillNoDrop');
    }
  }

  for (const drop of payload.skillItemDrops) {
    await client.query(
      'INSERT INTO pokemon_skill_item_drops (pokemon_id, skill_id, item_id) VALUES ($1, $2, $3)',
      [pokemonId, drop.skillId, drop.itemId]
    );
  }
}

export async function createPokemon(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanPokemonPayload(payload);
  await normalizePokemonDataIdentity(cleanPayload);

  const id = await withTransaction(async (client) => {
    const pokemonId = await nextPokemonInternalId(client, cleanPayload.dataId);
    const sortOrder = await nextSortOrder(client, 'pokemon');
    await client.query(
      `
        INSERT INTO pokemon (
          id,
          data_id,
          data_identifier,
          display_id,
          name,
          is_event_item,
          genus,
          details,
          height_inches,
          weight_pounds,
          environment_id,
          hp,
          attack,
          defense,
          special_attack,
          special_defense,
          speed,
          image_path,
          image_style,
          image_version,
          image_variant,
          image_description,
          sort_order,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $24)
      `,
      [
        pokemonId,
        cleanPayload.dataId,
        cleanPayload.dataIdentifier,
        cleanPayload.displayId,
        cleanPayload.name,
        cleanPayload.isEventItem,
        cleanPayload.genus,
        cleanPayload.details,
        cleanPayload.heightInches,
        cleanPayload.weightPounds,
        cleanPayload.environmentId,
        cleanPayload.stats.hp,
        cleanPayload.stats.attack,
        cleanPayload.stats.defense,
        cleanPayload.stats.specialAttack,
        cleanPayload.stats.specialDefense,
        cleanPayload.stats.speed,
        cleanPayload.image?.path ?? '',
        cleanPayload.image?.style ?? '',
        cleanPayload.image?.version ?? '',
        cleanPayload.image?.variant ?? '',
        cleanPayload.image?.description ?? '',
        sortOrder,
        userId
      ]
    );
    await linkEntityImageUpload(client, 'pokemon', pokemonId, cleanPayload.image?.path, cleanPayload.name);
    await replacePokemonRelations(client, pokemonId, cleanPayload);
    await replaceEntityTranslations(client, 'pokemon', pokemonId, cleanPayload.translations, ['name', 'details', 'genus']);
    await recordEditLog(client, 'pokemon', pokemonId, 'create', userId);
    return pokemonId;
  });
  return getPokemon(id, locale);
}

export async function updatePokemon(id: number, payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanPokemonPayload(payload);
  await normalizePokemonDataIdentity(cleanPayload);
  if (cleanPayload.dataId !== null && cleanPayload.dataId !== id) {
    throw validationError('server.validation.pokemonDataIdMismatch');
  }
  const before = await getPokemon(id, defaultLocale);

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE pokemon
        SET
          data_id = $1,
          data_identifier = $2,
          display_id = $3,
          name = $4,
          is_event_item = $5,
          genus = $6,
          details = $7,
          height_inches = $8,
          weight_pounds = $9,
          environment_id = $10,
          hp = $11,
          attack = $12,
          defense = $13,
          special_attack = $14,
          special_defense = $15,
          speed = $16,
          image_path = $17,
          image_style = $18,
          image_version = $19,
          image_variant = $20,
          image_description = $21,
          updated_by_user_id = $22,
          updated_at = now()
        WHERE id = $23
      `,
      [
        cleanPayload.dataId,
        cleanPayload.dataIdentifier,
        cleanPayload.displayId,
        cleanPayload.name,
        cleanPayload.isEventItem,
        cleanPayload.genus,
        cleanPayload.details,
        cleanPayload.heightInches,
        cleanPayload.weightPounds,
        cleanPayload.environmentId,
        cleanPayload.stats.hp,
        cleanPayload.stats.attack,
        cleanPayload.stats.defense,
        cleanPayload.stats.specialAttack,
        cleanPayload.stats.specialDefense,
        cleanPayload.stats.speed,
        cleanPayload.image?.path ?? '',
        cleanPayload.image?.style ?? '',
        cleanPayload.image?.version ?? '',
        cleanPayload.image?.variant ?? '',
        cleanPayload.image?.description ?? '',
        userId,
        id
      ]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await linkEntityImageUpload(client, 'pokemon', id, cleanPayload.image?.path, cleanPayload.name);
    await replacePokemonRelations(client, id, cleanPayload);
    await replaceEntityTranslations(client, 'pokemon', id, cleanPayload.translations, ['name', 'details', 'genus']);
    const changes = before ? await pokemonEditChanges(client, before as unknown as PokemonChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'pokemon', id, 'update', userId, changes);
    return true;
  });
  return updated ? getPokemon(id, locale) : null;
}

export async function deletePokemon(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM pokemon WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await deleteEntityDiscussionCommentsForEntity(client, 'pokemon', id);
    await deleteEntityTranslations(client, 'pokemon', id);
    await recordEditLog(client, 'pokemon', id, 'delete', userId);
    return true;
  });
}

export async function listHabitats(paramsQuery: QueryParams = {}, locale = defaultLocale) {
  const habitatName = localizedName('habitats', 'h', locale);
  const itemName = localizedName('items', 'i', locale);
  const pokemonName = localizedName('pokemon', 'p', locale);
  const params: unknown[] = [];
  const conditions: string[] = [];
  const isEventItem = asString(paramsQuery.isEventItem);

  if (isEventItem === 'true' || isEventItem === 'false') {
    params.push(isEventItem === 'true');
    conditions.push(`h.is_event_item = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return query(`
    SELECT
      h.id,
      ${habitatName} AS name,
      h.name AS "baseName",
      h.is_event_item AS "isEventItem",
      ${translationsSelect('habitats', 'h.id')} AS translations,
      ${auditSelect('h', 'habitat_created_user', 'habitat_updated_user')},
      ${uploadedImageJson('h.image_path')} AS image,
      COALESCE((
        SELECT json_agg(json_build_object('id', i.id, 'name', ${itemName}, 'quantity', hri.quantity) ORDER BY ${orderByEntity('i')})
        FROM habitat_recipe_items hri
        JOIN items i ON i.id = hri.item_id
        WHERE hri.habitat_id = h.id
      ), '[]'::json) AS recipe,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', pokemon_rows.id,
            'displayId', pokemon_rows.display_id,
            'name', pokemon_rows.name,
            'isEventItem', pokemon_rows.is_event_item
          )
          ORDER BY pokemon_rows.sort_order, pokemon_rows.id
        )
        FROM (
          SELECT DISTINCT p.id, p.display_id, ${pokemonName} AS name, p.is_event_item, p.sort_order
          FROM habitat_pokemon hp
          JOIN pokemon p ON p.id = hp.pokemon_id
          WHERE hp.habitat_id = h.id
        ) pokemon_rows
      ), '[]'::json) AS pokemon
    FROM habitats h
    ${auditJoins('h', 'habitat_created_user', 'habitat_updated_user')}
    ${whereClause}
    ORDER BY ${orderByEntity('h')}
  `, params);
}

export async function getHabitat(id: number, locale = defaultLocale) {
  const habitatName = localizedName('habitats', 'h', locale);
  const itemName = localizedName('items', 'i', locale);
  const pokemonName = localizedName('pokemon', 'p', locale);
  const mapName = localizedName('maps', 'm', locale);

  const habitat = await queryOne(
    `
      SELECT
        h.id,
        ${habitatName} AS name,
        h.name AS "baseName",
        h.is_event_item AS "isEventItem",
        ${translationsSelect('habitats', 'h.id')} AS translations,
        ${auditSelect('h', 'habitat_created_user', 'habitat_updated_user')},
        ${uploadedImageJson('h.image_path')} AS image,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', i.id,
              'name', ${itemName},
              'image', ${uploadedImageJson('i.image_path')},
              'quantity', hri.quantity
            )
            ORDER BY ${orderByEntity('i')}
          )
          FROM habitat_recipe_items hri
          JOIN items i ON i.id = hri.item_id
          WHERE hri.habitat_id = h.id
        ), '[]'::json) AS recipe
      FROM habitats h
      ${auditJoins('h', 'habitat_created_user', 'habitat_updated_user')}
      WHERE h.id = $1
    `,
    [id]
  );

  if (!habitat) {
    return null;
  }

  const [pokemon, editHistory, imageHistory] = await Promise.all([
    query(
      `
        SELECT
          p.id,
          p.display_id AS "displayId",
          ${pokemonName} AS name,
          p.is_event_item AS "isEventItem",
          ${pokemonImageJson('p')} AS image,
          hp.time_of_day,
          hp.weather,
          hp.rarity,
          json_build_object('id', m.id, 'name', ${mapName}) AS map
        FROM habitat_pokemon hp
        JOIN pokemon p ON p.id = hp.pokemon_id
        JOIN maps m ON m.id = hp.map_id
        WHERE hp.habitat_id = $1
        ORDER BY hp.rarity, ${orderByEntity('p')}, ${orderByEntity('m')}
      `,
      [id]
    ),
    getEditHistory('habitats', id),
    listEntityImageUploads('habitats', id)
  ]);

  return { ...habitat, pokemon, editHistory, imageHistory };
}

function cleanHabitatPayload(payload: Record<string, unknown>): HabitatPayload {
  const appearances = Array.isArray(payload.pokemonAppearances) ? payload.pokemonAppearances : [];
  const pokemonAppearances = new Map<string, HabitatPayload['pokemonAppearances'][number]>();

  for (const item of appearances) {
    const row = item as Record<string, unknown>;
    const pokemonId = Number(row.pokemonId);
    const mapIds = cleanIdValues(row.mapIds);
    const selectedTimeOfDays = cleanOptions(row.timeOfDays, timeOfDays);
    const selectedWeathers = cleanOptions(row.weathers, weathers);
    const rarity = Number(row.rarity);

    if (!Number.isInteger(pokemonId) || pokemonId <= 0 || !Number.isInteger(rarity) || rarity < 1 || rarity > 3) {
      continue;
    }

    for (const mapId of mapIds) {
      for (const timeOfDay of selectedTimeOfDays) {
        for (const weather of selectedWeathers) {
          pokemonAppearances.set(`${pokemonId}:${mapId}:${timeOfDay}:${weather}`, {
            pokemonId,
            mapId,
            timeOfDay,
            weather,
            rarity
          });
        }
      }
    }
  }

  return {
    name: cleanName(payload.name, 'server.validation.habitatNameRequired'),
    translations: cleanTranslations(payload.translations, ['name']),
    isEventItem: Boolean(payload.isEventItem),
    imagePath: cleanUploadImagePath(payload.imagePath, 'habitats'),
    recipeItems: cleanQuantities(payload.recipeItems),
    pokemonAppearances: [...pokemonAppearances.values()]
  };
}

async function replaceHabitatRelations(client: DbClient, habitatId: number, payload: HabitatPayload): Promise<void> {
  await client.query('DELETE FROM habitat_recipe_items WHERE habitat_id = $1', [habitatId]);
  await client.query('DELETE FROM habitat_pokemon WHERE habitat_id = $1', [habitatId]);

  for (const item of payload.recipeItems) {
    await client.query('INSERT INTO habitat_recipe_items (habitat_id, item_id, quantity) VALUES ($1, $2, $3)', [
      habitatId,
      item.itemId,
      item.quantity
    ]);
  }

  for (const item of payload.pokemonAppearances) {
    await client.query(
      `
        INSERT INTO habitat_pokemon (habitat_id, pokemon_id, map_id, time_of_day, weather, rarity)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [habitatId, item.pokemonId, item.mapId, item.timeOfDay, item.weather, item.rarity]
    );
  }
}

export async function createHabitat(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanHabitatPayload(payload);

  const id = await withTransaction(async (client) => {
    const sortOrder = await nextSortOrder(client, 'habitats');
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO habitats (name, is_event_item, image_path, sort_order, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING id
      `,
      [cleanPayload.name, cleanPayload.isEventItem, cleanPayload.imagePath, sortOrder, userId]
    );
    const habitatId = result.rows[0].id;
    await linkEntityImageUpload(client, 'habitats', habitatId, cleanPayload.imagePath, cleanPayload.name);
    await replaceHabitatRelations(client, habitatId, cleanPayload);
    await replaceEntityTranslations(client, 'habitats', habitatId, cleanPayload.translations, ['name']);
    await recordEditLog(client, 'habitats', habitatId, 'create', userId);
    return habitatId;
  });
  return getHabitat(id, locale);
}

export async function updateHabitat(id: number, payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanHabitatPayload(payload);
  const before = await getHabitat(id, defaultLocale);

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      'UPDATE habitats SET name = $1, is_event_item = $2, image_path = $3, updated_by_user_id = $4, updated_at = now() WHERE id = $5',
      [cleanPayload.name, cleanPayload.isEventItem, cleanPayload.imagePath, userId, id]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await linkEntityImageUpload(client, 'habitats', id, cleanPayload.imagePath, cleanPayload.name);
    await replaceHabitatRelations(client, id, cleanPayload);
    await replaceEntityTranslations(client, 'habitats', id, cleanPayload.translations, ['name']);
    const changes = before ? await habitatEditChanges(client, before as unknown as HabitatChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'habitats', id, 'update', userId, changes);
    return true;
  });
  return updated ? getHabitat(id, locale) : null;
}

export async function deleteHabitat(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM habitats WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await deleteEntityDiscussionCommentsForEntity(client, 'habitats', id);
    await deleteEntityTranslations(client, 'habitats', id);
    await recordEditLog(client, 'habitats', id, 'delete', userId);
    return true;
  });
}

function itemProjection(locale: string): string {
  const itemName = localizedName('items', 'i', locale);
  const itemDetails = localizedField('items', 'i.id', 'i.details', 'details', locale);
  const tagName = localizedName('favorite-things', 't', locale);

  return `
    SELECT
      i.id,
      ${itemName} AS name,
      i.name AS "baseName",
      ${itemDetails} AS details,
      i.details AS "baseDetails",
      i.is_event_item AS "isEventItem",
      ${translationsSelect('items', 'i.id')} AS translations,
      ${auditSelect('i', 'item_created_user', 'item_updated_user')},
      ${uploadedImageJson('i.image_path')} AS image,
      ${systemListJsonSql('i.category_key', itemCategoryOptions, locale)} AS category,
      CASE
        WHEN i.usage_key IS NULL THEN NULL
        ELSE ${systemListJsonSql('i.usage_key', itemUsageOptions, locale)}
      END AS usage,
      json_build_object(
        'dyeable', i.dyeable,
        'dualDyeable', i.dual_dyeable,
        'patternEditable', i.pattern_editable
      ) AS customization,
      i.no_recipe AS "noRecipe",
      COALESCE((
        SELECT json_agg(json_build_object('id', t.id, 'name', ${tagName}) ORDER BY ${orderByEntity('t')})
        FROM item_favorite_things ift
        JOIN favorite_things t ON t.id = ift.favorite_thing_id
        WHERE ift.item_id = i.id
      ), '[]'::json) AS tags,
      CASE
        WHEN item_recipe.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', item_recipe.id,
          'createdAt', item_recipe.created_at,
          'updatedAt', item_recipe.updated_at,
          'createdBy', CASE
            WHEN recipe_created_user.id IS NULL THEN NULL
            ELSE json_build_object('id', recipe_created_user.id, 'displayName', recipe_created_user.display_name)
          END,
          'updatedBy', CASE
            WHEN recipe_updated_user.id IS NULL THEN NULL
            ELSE json_build_object('id', recipe_updated_user.id, 'displayName', recipe_updated_user.display_name)
          END
        )
      END AS recipe
    FROM items i
    LEFT JOIN recipes item_recipe ON item_recipe.item_id = i.id
    LEFT JOIN users recipe_created_user ON recipe_created_user.id = item_recipe.created_by_user_id
    LEFT JOIN users recipe_updated_user ON recipe_updated_user.id = item_recipe.updated_by_user_id
    ${auditJoins('i', 'item_created_user', 'item_updated_user')}
  `;
}

export async function listItems(paramsQuery: QueryParams, locale = defaultLocale) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const categoryId = Number(asString(paramsQuery.categoryId));
  const usageId = Number(asString(paramsQuery.usageId));
  const isEventItem = asString(paramsQuery.isEventItem);
  const tagIds = parseIdList(asString(paramsQuery.tagIds));
  const search = asString(paramsQuery.search)?.trim();
  const recipeOrder = asString(paramsQuery.recipeOrder) === '1';
  const categoryOption = Number.isInteger(categoryId) && categoryId > 0
    ? systemListOptionById(itemCategoryOptions, categoryId, 'server.validation.categoryRequired')
    : null;
  const usageOption = Number.isInteger(usageId) && usageId > 0
    ? systemListOptionById(itemUsageOptions, usageId, 'server.validation.usageRequired')
    : null;

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`${localizedName('items', 'i', locale)} ILIKE $${params.length}`);
  }

  if (isEventItem === 'true' || isEventItem === 'false') {
    params.push(isEventItem === 'true');
    conditions.push(`i.is_event_item = $${params.length}`);
  }

  if (categoryOption) {
    params.push(categoryOption.key);
    conditions.push(`i.category_key = $${params.length}`);
  }

  if (usageOption) {
    params.push(usageOption.key);
    conditions.push(`i.usage_key = $${params.length}`);
  }

  const tagFilter = sqlForRelationFilter(
    tagIds,
    'any',
    'item_favorite_things',
    'item_id',
    'favorite_thing_id',
    'i.id',
    params
  );
  if (tagFilter) {
    conditions.push(tagFilter);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = recipeOrder
    ? `ORDER BY CASE WHEN item_recipe.id IS NULL THEN 1 ELSE 0 END, item_recipe.sort_order, item_recipe.id, ${orderByEntity('i')}`
    : `ORDER BY ${orderByEntity('i')}`;
  return query(`${itemProjection(locale)} ${whereClause} ${orderClause}`, params);
}

export async function getItem(id: number, locale = defaultLocale) {
  const item = await queryOne(`${itemProjection(locale)} WHERE i.id = $1`, [id]);
  if (!item) {
    return null;
  }

  const acquisitionMethodName = localizedName('acquisition-methods', 'am', locale);
  const resultItemName = localizedName('items', 'result_item', locale);
  const materialItemName = localizedName('items', 'mi', locale);
  const habitatName = localizedName('habitats', 'h', locale);
  const recipeItemName = localizedName('items', 'recipe_item', locale);
  const pokemonName = localizedName('pokemon', 'p', locale);
  const skillName = localizedName('skills', 's', locale);

  const [acquisitionMethods, recipe, relatedRecipes, relatedHabitats, droppedByPokemon, editHistory, imageHistory] = await Promise.all([
    query(
      `
        SELECT am.id, ${acquisitionMethodName} AS name
        FROM item_acquisition_methods iam
        JOIN acquisition_methods am ON am.id = iam.acquisition_method_id
        WHERE iam.item_id = $1
        ORDER BY ${orderByEntity('am')}
      `,
      [id]
    ),
    queryOne(
      `
        SELECT
          r.id,
          ${resultItemName} AS name,
          ${auditSelect('r', 'recipe_created_user', 'recipe_updated_user')},
          COALESCE((
            SELECT json_agg(json_build_object('id', am.id, 'name', ${acquisitionMethodName}) ORDER BY ${orderByEntity('am')})
            FROM recipe_acquisition_methods ram
            JOIN acquisition_methods am ON am.id = ram.acquisition_method_id
            WHERE ram.recipe_id = r.id
          ), '[]'::json) AS acquisition_methods,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', mi.id,
                'name', ${materialItemName},
                'image', ${uploadedImageJson('mi.image_path')},
                'quantity', rm.quantity
              )
              ORDER BY ${orderByEntity('mi')}
            )
            FROM recipe_materials rm
            JOIN items mi ON mi.id = rm.item_id
            WHERE rm.recipe_id = r.id
          ), '[]'::json) AS materials,
          json_build_object(
            'id', result_item.id,
            'name', ${resultItemName},
            'image', ${uploadedImageJson('result_item.image_path')},
            'category', ${systemListJsonSql('result_item.category_key', itemCategoryOptions, locale)},
            'usage', CASE
              WHEN result_item.usage_key IS NULL THEN NULL
              ELSE ${systemListJsonSql('result_item.usage_key', itemUsageOptions, locale)}
            END
          ) AS item
        FROM recipes r
        JOIN items result_item ON result_item.id = r.item_id
        ${auditJoins('r', 'recipe_created_user', 'recipe_updated_user')}
        WHERE r.item_id = $1
      `,
      [id]
    ),
    query(
      `
        SELECT
          r.id,
          ${resultItemName} AS name,
          ${uploadedImageJson('result_item.image_path')} AS image,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', mi.id,
                'name', ${materialItemName},
                'image', ${uploadedImageJson('mi.image_path')},
                'quantity', recipe_material.quantity
              )
              ORDER BY ${orderByEntity('mi')}
            )
            FROM recipe_materials recipe_material
            JOIN items mi ON mi.id = recipe_material.item_id
            WHERE recipe_material.recipe_id = r.id
          ), '[]'::json) AS materials
        FROM recipe_materials used_material
        JOIN recipes r ON r.id = used_material.recipe_id
        JOIN items result_item ON result_item.id = r.item_id
        WHERE used_material.item_id = $1
        ORDER BY ${orderByEntity('r')}
      `,
      [id]
    ),
    query(
      `
        SELECT
          h.id,
          ${habitatName} AS name,
          ${uploadedImageJson('h.image_path')} AS image,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', recipe_item.id,
                'name', ${recipeItemName},
                'image', ${uploadedImageJson('recipe_item.image_path')},
                'quantity', recipe_item_row.quantity
              )
              ORDER BY ${orderByEntity('recipe_item')}
            )
            FROM habitat_recipe_items recipe_item_row
            JOIN items recipe_item ON recipe_item.id = recipe_item_row.item_id
            WHERE recipe_item_row.habitat_id = h.id
          ), '[]'::json) AS recipe
        FROM habitat_recipe_items used_item
        JOIN habitats h ON h.id = used_item.habitat_id
        WHERE used_item.item_id = $1
        ORDER BY ${orderByEntity('h')}
      `,
      [id]
    ),
    query(
      `
        SELECT
          json_build_object(
            'id', p.id,
            'displayId', p.display_id,
            'name', ${pokemonName},
            'isEventItem', p.is_event_item,
            'image', ${pokemonImageJson('p')}
          ) AS pokemon,
          json_build_object('id', s.id, 'name', ${skillName}) AS skill
        FROM pokemon_skill_item_drops psid
        JOIN pokemon p ON p.id = psid.pokemon_id
        JOIN skills s ON s.id = psid.skill_id
        WHERE psid.item_id = $1
          AND s.has_item_drop = true
        ORDER BY ${orderByEntity('p')}, ${orderByEntity('s')}
      `,
      [id]
    ),
    getEditHistory('items', id),
    listEntityImageUploads('items', id)
  ]);

  return { ...item, acquisitionMethods, recipe, relatedRecipes, relatedHabitats, droppedByPokemon, editHistory, imageHistory };
}

function cleanItemPayload(payload: Record<string, unknown>): ItemPayload {
  const categoryId = requirePositiveInteger(payload.categoryId, 'server.validation.categoryRequired');
  const usageId = payload.usageId === null || payload.usageId === '' || payload.usageId === undefined
    ? null
    : requirePositiveInteger(payload.usageId, 'server.validation.usageRequired');
  const insertBeforeItemId = cleanOptionalPositiveInteger(payload.insertBeforeItemId);
  const insertAfterItemId = cleanOptionalPositiveInteger(payload.insertAfterItemId);
  const category = systemListOptionById(itemCategoryOptions, categoryId, 'server.validation.categoryRequired');
  const usage = usageId === null ? null : systemListOptionById(itemUsageOptions, usageId, 'server.validation.usageRequired');

  if (insertBeforeItemId !== null && insertAfterItemId !== null) {
    throw validationError('server.validation.invalidField');
  }

  return {
    name: cleanName(payload.name, 'server.validation.itemNameRequired'),
    details: cleanOptionalText(payload.details),
    translations: cleanTranslations(payload.translations, ['name', 'details']),
    categoryId,
    categoryKey: category.key,
    usageId,
    usageKey: usage?.key ?? null,
    dyeable: Boolean(payload.dyeable),
    dualDyeable: Boolean(payload.dualDyeable),
    patternEditable: Boolean(payload.patternEditable),
    noRecipe: Boolean(payload.noRecipe),
    isEventItem: Boolean(payload.isEventItem),
    acquisitionMethodIds: cleanIds(payload.acquisitionMethodIds),
    tagIds: cleanIds(payload.tagIds),
    imagePath: cleanUploadImagePath(payload.imagePath, 'items'),
    insertBeforeItemId,
    insertAfterItemId
  };
}

function cleanOptionalPositiveInteger(value: unknown): number | null {
  if (value === null || value === '' || value === undefined) {
    return null;
  }

  return requirePositiveInteger(value, 'server.validation.invalidField');
}

async function orderedItemIds(client: DbClient, isEventItem: boolean): Promise<number[]> {
  const rows = await client.query<{ id: number }>(
    'SELECT id FROM items WHERE is_event_item = $1 ORDER BY sort_order, id',
    [isEventItem]
  );
  return rows.rows.map((row) => row.id);
}

async function ensureItemCanDisableRecipe(client: DbClient, itemId: number, noRecipe: boolean): Promise<void> {
  if (!noRecipe) {
    return;
  }

  const result = await client.query('SELECT 1 FROM recipes WHERE item_id = $1', [itemId]);
  if (result.rowCount && result.rowCount > 0) {
    throw validationError('server.validation.recipeFreeWithRecipe');
  }
}

async function replaceItemRelations(client: DbClient, itemId: number, payload: ItemPayload): Promise<void> {
  await client.query('DELETE FROM item_acquisition_methods WHERE item_id = $1', [itemId]);
  await client.query('DELETE FROM item_favorite_things WHERE item_id = $1', [itemId]);

  for (const methodId of payload.acquisitionMethodIds) {
    await client.query('INSERT INTO item_acquisition_methods (item_id, acquisition_method_id) VALUES ($1, $2)', [
      itemId,
      methodId
    ]);
  }

  for (const tagId of payload.tagIds) {
    await client.query('INSERT INTO item_favorite_things (item_id, favorite_thing_id) VALUES ($1, $2)', [
      itemId,
      tagId
    ]);
  }
}

export async function createItem(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanItemPayload(payload);

  const id = await withTransaction(async (client) => {
    const sortOrder = await nextSortOrder(client, 'items');
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO items (
          name,
          details,
          category_key,
          usage_key,
          dyeable,
          dual_dyeable,
          pattern_editable,
          no_recipe,
          is_event_item,
          image_path,
          sort_order,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
        RETURNING id
      `,
      [
        cleanPayload.name,
        cleanPayload.details,
        cleanPayload.categoryKey,
        cleanPayload.usageKey,
        cleanPayload.dyeable,
        cleanPayload.dualDyeable,
        cleanPayload.patternEditable,
        cleanPayload.noRecipe,
        cleanPayload.isEventItem,
        cleanPayload.imagePath,
        sortOrder,
        userId
      ]
    );
    const itemId = result.rows[0].id;
    await linkEntityImageUpload(client, 'items', itemId, cleanPayload.imagePath, cleanPayload.name);
    await replaceItemRelations(client, itemId, cleanPayload);
    await replaceEntityTranslations(client, 'items', itemId, cleanPayload.translations, ['name', 'details']);

    if (cleanPayload.insertBeforeItemId !== null || cleanPayload.insertAfterItemId !== null) {
      const targetId = cleanPayload.insertBeforeItemId ?? cleanPayload.insertAfterItemId;
      if (targetId === null) {
        throw validationError('server.validation.invalidField');
      }

      const orderedIds = await orderedItemIds(client, cleanPayload.isEventItem);
      const targetIndex = orderedIds.indexOf(targetId);
      if (targetIndex < 0) {
        throw validationError('server.validation.recordMissing');
      }

      const insertedIndex = orderedIds.indexOf(itemId);
      if (insertedIndex >= 0) {
        orderedIds.splice(insertedIndex, 1);
      }

      orderedIds.splice(targetIndex + (cleanPayload.insertAfterItemId !== null ? 1 : 0), 0, itemId);
      await reorderTableRows(client, 'items', 'items', orderedIds, userId);
    }

    await recordEditLog(client, 'items', itemId, 'create', userId);
    return itemId;
  });
  return getItem(id, locale);
}

export async function updateItem(id: number, payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanItemPayload(payload);
  const before = await getItem(id, defaultLocale);

  const updated = await withTransaction(async (client) => {
    await ensureItemCanDisableRecipe(client, id, cleanPayload.noRecipe);
    const result = await client.query(
      `
        UPDATE items
        SET name = $1,
            details = $2,
            category_key = $3,
            usage_key = $4,
            dyeable = $5,
            dual_dyeable = $6,
            pattern_editable = $7,
            no_recipe = $8,
            is_event_item = $9,
            image_path = $10,
            updated_by_user_id = $11,
            updated_at = now()
        WHERE id = $12
      `,
      [
        cleanPayload.name,
        cleanPayload.details,
        cleanPayload.categoryKey,
        cleanPayload.usageKey,
        cleanPayload.dyeable,
        cleanPayload.dualDyeable,
        cleanPayload.patternEditable,
        cleanPayload.noRecipe,
        cleanPayload.isEventItem,
        cleanPayload.imagePath,
        userId,
        id
      ]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await linkEntityImageUpload(client, 'items', id, cleanPayload.imagePath, cleanPayload.name);
    await replaceItemRelations(client, id, cleanPayload);
    await replaceEntityTranslations(client, 'items', id, cleanPayload.translations, ['name', 'details']);
    const changes = before ? await itemEditChanges(client, before as unknown as ItemChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'items', id, 'update', userId, changes);
    return true;
  });
  return updated ? getItem(id, locale) : null;
}

export async function deleteItem(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM items WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await deleteEntityDiscussionCommentsForEntity(client, 'items', id);
    await deleteEntityTranslations(client, 'items', id);
    await recordEditLog(client, 'items', id, 'delete', userId);
    return true;
  });
}

function ancientArtifactProjection(locale: string): string {
  const artifactName = localizedName('ancient-artifacts', 'a', locale);
  const artifactDetails = localizedField('ancient-artifacts', 'a.id', 'a.details', 'details', locale);
  const tagName = localizedName('favorite-things', 't', locale);

  return `
    SELECT
      a.id,
      ${artifactName} AS name,
      a.name AS "baseName",
      ${artifactDetails} AS details,
      a.details AS "baseDetails",
      ${translationsSelect('ancient-artifacts', 'a.id')} AS translations,
      ${systemListJsonSql('a.category_key', ancientArtifactCategoryOptions, locale)} AS category,
      ${uploadedImageJson('a.image_path')} AS image,
      COALESCE((
        SELECT json_agg(json_build_object('id', t.id, 'name', ${tagName}) ORDER BY ${orderByEntity('t')})
        FROM ancient_artifact_favorite_things aaft
        JOIN favorite_things t ON t.id = aaft.favorite_thing_id
        WHERE aaft.ancient_artifact_id = a.id
      ), '[]'::json) AS tags,
      ${auditSelect('a', 'artifact_created_user', 'artifact_updated_user')}
    FROM ancient_artifacts a
    ${auditJoins('a', 'artifact_created_user', 'artifact_updated_user')}
  `;
}

export async function listAncientArtifacts(paramsQuery: QueryParams = {}, locale = defaultLocale) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const search = asString(paramsQuery.search)?.trim();
  const categoryId = Number(asString(paramsQuery.categoryId));
  const tagIds = parseIdList(asString(paramsQuery.tagIds));
  const categoryOption = Number.isInteger(categoryId) && categoryId > 0
    ? systemListOptionById(ancientArtifactCategoryOptions, categoryId, 'server.validation.categoryRequired')
    : null;

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`${localizedName('ancient-artifacts', 'a', locale)} ILIKE $${params.length}`);
  }

  if (categoryOption) {
    params.push(categoryOption.key);
    conditions.push(`a.category_key = $${params.length}`);
  }

  const tagFilter = sqlForRelationFilter(
    tagIds,
    'any',
    'ancient_artifact_favorite_things',
    'ancient_artifact_id',
    'favorite_thing_id',
    'a.id',
    params
  );
  if (tagFilter) {
    conditions.push(tagFilter);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return query(`${ancientArtifactProjection(locale)} ${whereClause} ORDER BY ${orderByEntity('a')}`, params);
}

export async function getAncientArtifact(id: number, locale = defaultLocale) {
  const artifact = await queryOne(`${ancientArtifactProjection(locale)} WHERE a.id = $1`, [id]);
  if (!artifact) {
    return null;
  }

  const editHistory = await getEditHistory('ancient-artifacts', id);
  const imageHistory = await listEntityImageUploads('ancient-artifacts', id);
  return { ...artifact, editHistory, imageHistory };
}

function cleanAncientArtifactPayload(payload: Record<string, unknown>): AncientArtifactPayload {
  const categoryId = requirePositiveInteger(payload.categoryId, 'server.validation.categoryRequired');
  const category = systemListOptionById(ancientArtifactCategoryOptions, categoryId, 'server.validation.categoryRequired');

  return {
    name: cleanName(payload.name, 'server.validation.artifactNameRequired'),
    details: cleanOptionalText(payload.details),
    translations: cleanTranslations(payload.translations, ['name', 'details']),
    categoryId,
    categoryKey: category.key,
    tagIds: cleanIds(payload.tagIds),
    imagePath: cleanUploadImagePath(payload.imagePath, 'ancient-artifacts')
  };
}

async function replaceAncientArtifactRelations(client: DbClient, artifactId: number, payload: AncientArtifactPayload): Promise<void> {
  await client.query('DELETE FROM ancient_artifact_favorite_things WHERE ancient_artifact_id = $1', [artifactId]);

  for (const tagId of payload.tagIds) {
    await client.query(
      'INSERT INTO ancient_artifact_favorite_things (ancient_artifact_id, favorite_thing_id) VALUES ($1, $2)',
      [artifactId, tagId]
    );
  }
}

export async function createAncientArtifact(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanAncientArtifactPayload(payload);

  const id = await withTransaction(async (client) => {
    const sortOrder = await nextSortOrder(client, 'ancient_artifacts');
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO ancient_artifacts (
          name,
          details,
          category_key,
          image_path,
          sort_order,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        RETURNING id
      `,
      [
        cleanPayload.name,
        cleanPayload.details,
        cleanPayload.categoryKey,
        cleanPayload.imagePath,
        sortOrder,
        userId
      ]
    );
    const artifactId = result.rows[0].id;
    await linkEntityImageUpload(client, 'ancient-artifacts', artifactId, cleanPayload.imagePath, cleanPayload.name);
    await replaceAncientArtifactRelations(client, artifactId, cleanPayload);
    await replaceEntityTranslations(client, 'ancient-artifacts', artifactId, cleanPayload.translations, ['name', 'details']);
    await recordEditLog(client, 'ancient-artifacts', artifactId, 'create', userId);
    return artifactId;
  });

  return getAncientArtifact(id, locale);
}

export async function updateAncientArtifact(id: number, payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanAncientArtifactPayload(payload);
  const before = await getAncientArtifact(id, defaultLocale);

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE ancient_artifacts
        SET name = $1,
            details = $2,
            category_key = $3,
            image_path = $4,
            updated_by_user_id = $5,
            updated_at = now()
        WHERE id = $6
      `,
      [cleanPayload.name, cleanPayload.details, cleanPayload.categoryKey, cleanPayload.imagePath, userId, id]
    );
    if (result.rowCount === 0) {
      return false;
    }

    await linkEntityImageUpload(client, 'ancient-artifacts', id, cleanPayload.imagePath, cleanPayload.name);
    await replaceAncientArtifactRelations(client, id, cleanPayload);
    await replaceEntityTranslations(client, 'ancient-artifacts', id, cleanPayload.translations, ['name', 'details']);
    const changes = before ? await ancientArtifactEditChanges(client, before as unknown as AncientArtifactChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'ancient-artifacts', id, 'update', userId, changes);
    return true;
  });

  return updated ? getAncientArtifact(id, locale) : null;
}

export async function deleteAncientArtifact(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM ancient_artifacts WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await deleteEntityDiscussionCommentsForEntity(client, 'ancient-artifacts', id);
    await deleteEntityTranslations(client, 'ancient-artifacts', id);
    await recordEditLog(client, 'ancient-artifacts', id, 'delete', userId);
    return true;
  });
}

export async function listRecipes(paramsQuery: QueryParams = {}, locale = defaultLocale) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const categoryId = Number(asString(paramsQuery.categoryId));
  const categoryOption = Number.isInteger(categoryId) && categoryId > 0
    ? systemListOptionById(itemCategoryOptions, categoryId, 'server.validation.categoryRequired')
    : null;
  const resultItemName = localizedName('items', 'result_item', locale);
  const materialItemName = localizedName('items', 'i', locale);

  if (categoryOption) {
    params.push(categoryOption.key);
    conditions.push(`result_item.category_key = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return query(`
    SELECT
      r.id,
      ${resultItemName} AS name,
      ${auditSelect('r', 'recipe_created_user', 'recipe_updated_user')},
      COALESCE((
        SELECT json_agg(json_build_object('id', i.id, 'name', ${materialItemName}, 'quantity', rm.quantity) ORDER BY ${orderByEntity('i')})
        FROM recipe_materials rm
        JOIN items i ON i.id = rm.item_id
        WHERE rm.recipe_id = r.id
      ), '[]'::json) AS materials
    FROM recipes r
    JOIN items result_item ON result_item.id = r.item_id
    ${auditJoins('r', 'recipe_created_user', 'recipe_updated_user')}
    ${whereClause}
    ORDER BY ${orderByEntity('r')}
  `, params);
}

export async function getRecipe(id: number, locale = defaultLocale) {
  const resultItemName = localizedName('items', 'result_item', locale);
  const acquisitionMethodName = localizedName('acquisition-methods', 'am', locale);
  const materialItemName = localizedName('items', 'i', locale);

  const recipe = await queryOne(
    `
      SELECT
        r.id,
        ${resultItemName} AS name,
        ${auditSelect('r', 'recipe_created_user', 'recipe_updated_user')},
        COALESCE((
          SELECT json_agg(json_build_object('id', am.id, 'name', ${acquisitionMethodName}) ORDER BY ${orderByEntity('am')})
          FROM recipe_acquisition_methods ram
          JOIN acquisition_methods am ON am.id = ram.acquisition_method_id
          WHERE ram.recipe_id = r.id
        ), '[]'::json) AS acquisition_methods,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', i.id,
              'name', ${materialItemName},
              'image', ${uploadedImageJson('i.image_path')},
              'quantity', rm.quantity
            )
            ORDER BY ${orderByEntity('i')}
          )
          FROM recipe_materials rm
          JOIN items i ON i.id = rm.item_id
          WHERE rm.recipe_id = r.id
        ), '[]'::json) AS materials,
        json_build_object(
          'id', result_item.id,
          'name', ${resultItemName},
          'image', ${uploadedImageJson('result_item.image_path')},
          'category', ${systemListJsonSql('result_item.category_key', itemCategoryOptions, locale)},
          'usage', CASE
            WHEN result_item.usage_key IS NULL THEN NULL
            ELSE ${systemListJsonSql('result_item.usage_key', itemUsageOptions, locale)}
          END
        ) AS item
      FROM recipes r
      JOIN items result_item ON result_item.id = r.item_id
      ${auditJoins('r', 'recipe_created_user', 'recipe_updated_user')}
      WHERE r.id = $1
    `,
    [id]
  );

  if (!recipe) {
    return null;
  }

  const editHistory = await getEditHistory('recipes', id);
  return { ...recipe, editHistory };
}

function cleanRecipePayload(payload: Record<string, unknown>): RecipePayload {
  return {
    itemId: requirePositiveInteger(payload.itemId, 'server.validation.itemRequired'),
    acquisitionMethodIds: cleanIds(payload.acquisitionMethodIds),
    materials: cleanQuantities(payload.materials)
  };
}

async function replaceRecipeRelations(client: DbClient, recipeId: number, payload: RecipePayload): Promise<void> {
  await client.query('DELETE FROM recipe_acquisition_methods WHERE recipe_id = $1', [recipeId]);
  await client.query('DELETE FROM recipe_materials WHERE recipe_id = $1', [recipeId]);

  for (const methodId of payload.acquisitionMethodIds) {
    await client.query('INSERT INTO recipe_acquisition_methods (recipe_id, acquisition_method_id) VALUES ($1, $2)', [
      recipeId,
      methodId
    ]);
  }

  for (const material of payload.materials) {
    await client.query('INSERT INTO recipe_materials (recipe_id, item_id, quantity) VALUES ($1, $2, $3)', [
      recipeId,
      material.itemId,
      material.quantity
    ]);
  }
}

async function ensureItemCanHaveRecipe(client: DbClient, itemId: number): Promise<void> {
  const result = await client.query<{ no_recipe: boolean }>('SELECT no_recipe FROM items WHERE id = $1', [itemId]);
  if (result.rowCount === 0) {
    throw validationError('server.validation.itemRequired');
  }

  if (result.rows[0].no_recipe) {
    throw validationError('server.validation.recipeFreeItem');
  }
}

export async function createRecipe(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanRecipePayload(payload);

  const id = await withTransaction(async (client) => {
    await ensureItemCanHaveRecipe(client, cleanPayload.itemId);
    const sortOrder = await nextSortOrder(client, 'recipes');
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO recipes (item_id, sort_order, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $3, $3)
        RETURNING id
      `,
      [cleanPayload.itemId, sortOrder, userId]
    );
    const recipeId = result.rows[0].id;
    await replaceRecipeRelations(client, recipeId, cleanPayload);
    await recordEditLog(client, 'recipes', recipeId, 'create', userId);
    return recipeId;
  });
  return getRecipe(id, locale);
}

export async function updateRecipe(id: number, payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanRecipePayload(payload);
  const before = await getRecipe(id, defaultLocale);

  const updated = await withTransaction(async (client) => {
    await ensureItemCanHaveRecipe(client, cleanPayload.itemId);
    const result = await client.query(
      'UPDATE recipes SET item_id = $1, updated_by_user_id = $2, updated_at = now() WHERE id = $3',
      [cleanPayload.itemId, userId, id]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await replaceRecipeRelations(client, id, cleanPayload);
    const changes = before ? await recipeEditChanges(client, before as unknown as RecipeChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'recipes', id, 'update', userId, changes);
    return true;
  });
  return updated ? getRecipe(id, locale) : null;
}

export async function deleteRecipe(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM recipes WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await deleteEntityDiscussionCommentsForEntity(client, 'recipes', id);
    await recordEditLog(client, 'recipes', id, 'delete', userId);
    return true;
  });
}

function dishCategoryProjection(locale: string): string {
  const categoryName = localizedName('dish-categories', 'dc', locale);
  const categoryEffect = localizedField('dish-categories', 'dc.id', 'dc.effect', 'effect', locale);
  const cookwareName = localizedName('items', 'cookware_item', locale);
  const mainMaterialName = localizedName('items', 'main_material_item', locale);
  const dishItemName = localizedName('items', 'dish_item', locale);
  const flavorName = localizedName('dish-flavors', 'dish_flavor', locale);
  const secondaryMaterialName = localizedName('items', 'secondary_material_item', locale);
  const skillName = localizedName('skills', 'dish_skill', locale);
  const mosslaxEffect = localizedField('dishes', 'd.id', 'd.mosslax_effect', 'mosslaxEffect', locale);

  return `
    SELECT
      dc.id,
      ${categoryName} AS name,
      dc.name AS "baseName",
      ${categoryEffect} AS effect,
      dc.effect AS "baseEffect",
      dc.total_material_quantity AS "totalMaterialQuantity",
      ${translationsSelect('dish-categories', 'dc.id')} AS translations,
      ${auditSelect('dc', 'category_created_user', 'category_updated_user')},
      json_build_object(
        'id', cookware_item.id,
        'name', ${cookwareName},
        'image', ${uploadedImageJson('cookware_item.image_path')},
        'category', ${systemListJsonSql('cookware_item.category_key', itemCategoryOptions, locale)}
      ) AS cookware,
      json_build_object(
        'id', main_material_item.id,
        'name', ${mainMaterialName},
        'image', ${uploadedImageJson('main_material_item.image_path')},
        'category', ${systemListJsonSql('main_material_item.category_key', itemCategoryOptions, locale)}
      ) AS "mainMaterial",
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', d.id,
            'flavor', json_build_object('id', dish_flavor.id, 'name', ${flavorName}),
            'mosslaxEffect', ${mosslaxEffect},
            'baseMosslaxEffect', d.mosslax_effect,
            'translations', ${translationsSelect('dishes', 'd.id')},
            'createdAt', d.created_at,
            'updatedAt', d.updated_at,
            'createdBy', CASE
              WHEN dish_created_user.id IS NULL THEN NULL
              ELSE json_build_object('id', dish_created_user.id, 'displayName', dish_created_user.display_name)
            END,
            'updatedBy', CASE
              WHEN dish_updated_user.id IS NULL THEN NULL
              ELSE json_build_object('id', dish_updated_user.id, 'displayName', dish_updated_user.display_name)
            END,
            'category', json_build_object('id', dc.id, 'name', ${categoryName}),
            'item', json_build_object(
              'id', dish_item.id,
              'name', ${dishItemName},
              'image', ${uploadedImageJson('dish_item.image_path')},
              'category', ${systemListJsonSql('dish_item.category_key', itemCategoryOptions, locale)}
            ),
            'secondaryMaterials', COALESCE((
              SELECT json_agg(
                json_build_object(
                  'id', secondary_material_item.id,
                  'name', ${secondaryMaterialName},
                  'image', ${uploadedImageJson('secondary_material_item.image_path')},
                  'category', ${systemListJsonSql('secondary_material_item.category_key', itemCategoryOptions, locale)}
                )
                ORDER BY secondary_slots.slot
              )
              FROM (VALUES (d.secondary_material_1_item_id, 1), (d.secondary_material_2_item_id, 2)) AS secondary_slots(item_id, slot)
              JOIN items secondary_material_item ON secondary_material_item.id = secondary_slots.item_id
            ), '[]'::json),
            'pokemonSkill', CASE
              WHEN dish_skill.id IS NULL THEN NULL
              ELSE json_build_object('id', dish_skill.id, 'name', ${skillName}, 'hasItemDrop', dish_skill.has_item_drop)
            END
          )
          ORDER BY d.sort_order, d.id
        )
        FROM dishes d
        JOIN items dish_item ON dish_item.id = d.item_id
        JOIN dish_flavors dish_flavor ON dish_flavor.id = d.flavor_id
        LEFT JOIN skills dish_skill ON dish_skill.id = d.pokemon_skill_id
        LEFT JOIN users dish_created_user ON dish_created_user.id = d.created_by_user_id
        LEFT JOIN users dish_updated_user ON dish_updated_user.id = d.updated_by_user_id
        WHERE d.category_id = dc.id
      ), '[]'::json) AS dishes
    FROM dish_categories dc
    JOIN items cookware_item ON cookware_item.id = dc.cookware_item_id
    JOIN items main_material_item ON main_material_item.id = dc.main_material_item_id
    ${auditJoins('dc', 'category_created_user', 'category_updated_user')}
  `;
}

function dishProjection(locale: string): string {
  const categoryName = localizedName('dish-categories', 'dc', locale);
  const dishItemName = localizedName('items', 'dish_item', locale);
  const flavorName = localizedName('dish-flavors', 'dish_flavor', locale);
  const secondaryMaterialName = localizedName('items', 'secondary_material_item', locale);
  const skillName = localizedName('skills', 'dish_skill', locale);
  const mosslaxEffect = localizedField('dishes', 'd.id', 'd.mosslax_effect', 'mosslaxEffect', locale);

  return `
    SELECT
      d.id,
      json_build_object('id', dish_flavor.id, 'name', ${flavorName}) AS flavor,
      ${mosslaxEffect} AS "mosslaxEffect",
      d.mosslax_effect AS "baseMosslaxEffect",
      ${translationsSelect('dishes', 'd.id')} AS translations,
      ${auditSelect('d', 'dish_created_user', 'dish_updated_user')},
      json_build_object('id', dc.id, 'name', ${categoryName}) AS category,
      json_build_object(
        'id', dish_item.id,
        'name', ${dishItemName},
        'image', ${uploadedImageJson('dish_item.image_path')},
        'category', ${systemListJsonSql('dish_item.category_key', itemCategoryOptions, locale)}
      ) AS item,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', secondary_material_item.id,
            'name', ${secondaryMaterialName},
            'image', ${uploadedImageJson('secondary_material_item.image_path')},
            'category', ${systemListJsonSql('secondary_material_item.category_key', itemCategoryOptions, locale)}
          )
          ORDER BY secondary_slots.slot
        )
        FROM (VALUES (d.secondary_material_1_item_id, 1), (d.secondary_material_2_item_id, 2)) AS secondary_slots(item_id, slot)
        JOIN items secondary_material_item ON secondary_material_item.id = secondary_slots.item_id
      ), '[]'::json) AS "secondaryMaterials",
      CASE
        WHEN dish_skill.id IS NULL THEN NULL
        ELSE json_build_object('id', dish_skill.id, 'name', ${skillName}, 'hasItemDrop', dish_skill.has_item_drop)
      END AS "pokemonSkill"
    FROM dishes d
    JOIN dish_categories dc ON dc.id = d.category_id
    JOIN items dish_item ON dish_item.id = d.item_id
    JOIN dish_flavors dish_flavor ON dish_flavor.id = d.flavor_id
    LEFT JOIN skills dish_skill ON dish_skill.id = d.pokemon_skill_id
    ${auditJoins('d', 'dish_created_user', 'dish_updated_user')}
  `;
}

export async function listDish(locale = defaultLocale) {
  return query(`${dishCategoryProjection(locale)} ORDER BY ${orderByEntity('dc')}`);
}

async function getDishCategory(id: number, locale = defaultLocale) {
  return queryOne(`${dishCategoryProjection(locale)} WHERE dc.id = $1`, [id]);
}

async function getDish(id: number, locale = defaultLocale) {
  return queryOne(`${dishProjection(locale)} WHERE d.id = $1`, [id]);
}

function cleanDishCategoryPayload(payload: Record<string, unknown>): DishCategoryPayload {
  const totalMaterialQuantity = requirePositiveInteger(payload.totalMaterialQuantity, 'server.validation.invalidField');
  if (totalMaterialQuantity < 2) {
    throw validationError('server.validation.invalidField');
  }

  return {
    name: cleanName(payload.name),
    effect: cleanName(payload.effect, 'server.validation.invalidField'),
    translations: cleanTranslations(payload.translations, ['name', 'effect']),
    cookwareItemId: requirePositiveInteger(payload.cookwareItemId, 'server.validation.itemRequired'),
    mainMaterialItemId: requirePositiveInteger(payload.mainMaterialItemId, 'server.validation.itemRequired'),
    totalMaterialQuantity
  };
}

function cleanDishPayload(payload: Record<string, unknown>): DishPayload {
  const secondaryMaterialItemIds = cleanIds(payload.secondaryMaterialItemIds).slice(0, 2);

  return {
    categoryId: requirePositiveInteger(payload.categoryId, 'server.validation.categoryRequired'),
    itemId: requirePositiveInteger(payload.itemId, 'server.validation.itemRequired'),
    flavorId: requirePositiveInteger(payload.flavorId, 'server.validation.invalidField'),
    secondaryMaterialItemIds,
    pokemonSkillId: optionalPositiveInteger(payload.pokemonSkillId, 'server.validation.invalidField'),
    mosslaxEffect: cleanName(payload.mosslaxEffect, 'server.validation.invalidField'),
    translations: cleanTranslations(payload.translations, ['mosslaxEffect'])
  };
}

async function ensureDishMaterialSlots(client: DbClient, payload: DishPayload): Promise<void> {
  const result = await client.query<{ totalMaterialQuantity: number; mainMaterialItemId: number }>(
    `
      SELECT
        total_material_quantity AS "totalMaterialQuantity",
        main_material_item_id AS "mainMaterialItemId"
      FROM dish_categories
      WHERE id = $1
    `,
    [payload.categoryId]
  );
  if (result.rowCount === 0) {
    throw validationError('server.validation.categoryRequired');
  }

  if (payload.secondaryMaterialItemIds.length > 1 && result.rows[0].totalMaterialQuantity <= 2) {
    throw validationError('server.validation.invalidField');
  }

  if (payload.secondaryMaterialItemIds.includes(result.rows[0].mainMaterialItemId)) {
    throw validationError('server.validation.invalidField');
  }
}

async function ensureDishCategoryMaterialSlots(client: DbClient, id: number, payload: DishCategoryPayload): Promise<void> {
  const result = await client.query<{ id: number }>(
    `
      SELECT id
      FROM dishes
      WHERE category_id = $1
        AND (
          ($2::integer <= 2 AND secondary_material_2_item_id IS NOT NULL)
          OR secondary_material_1_item_id = $3
          OR secondary_material_2_item_id = $3
        )
      LIMIT 1
    `,
    [id, payload.totalMaterialQuantity, payload.mainMaterialItemId]
  );
  if ((result.rowCount ?? 0) > 0) {
    throw validationError('server.validation.invalidField');
  }
}

async function dishCategoryEditChanges(
  client: DbClient,
  before: DishCategoryChangeSource,
  after: DishCategoryPayload
): Promise<EditChange[]> {
  const changes: EditChange[] = [];
  const itemNames = await entityNameMap(client, 'items', [after.cookwareItemId, after.mainMaterialItemId]);
  pushChange(changes, 'Name', before.name, after.name);
  pushTranslationChanges(changes, before.translations, after.translations, ['name', 'effect']);
  pushChange(changes, 'Cookware', before.cookware.name, itemNames.get(after.cookwareItemId));
  pushChange(changes, 'Main material', before.mainMaterial.name, itemNames.get(after.mainMaterialItemId));
  pushChange(changes, 'Total material quantity', String(before.totalMaterialQuantity), String(after.totalMaterialQuantity));
  pushChange(changes, 'Effect', before.effect, after.effect);
  return changes;
}

async function dishEditChanges(client: DbClient, before: DishChangeSource, after: DishPayload): Promise<EditChange[]> {
  const changes: EditChange[] = [];
  const categoryNames = await entityNameMap(client, 'dish_categories', [after.categoryId]);
  const itemNames = await entityNameMap(client, 'items', [after.itemId, ...after.secondaryMaterialItemIds]);
  const flavorNames = await entityNameMap(client, 'dish_flavors', [after.flavorId]);
  const skillNames = await entityNameMap(client, 'skills', after.pokemonSkillId ? [after.pokemonSkillId] : []);

  pushChange(changes, 'Category', before.category.name, categoryNames.get(after.categoryId));
  pushChange(changes, 'Dish item', before.item.name, itemNames.get(after.itemId));
  pushChange(changes, 'Flavor', before.flavor.name, flavorNames.get(after.flavorId));
  pushTranslationChanges(changes, before.translations, after.translations, ['mosslaxEffect']);
  pushChange(changes, 'Secondary materials', namedListValue(before.secondaryMaterials), namesFromIds(after.secondaryMaterialItemIds, itemNames));
  pushChange(changes, 'Pokemon speciality', before.pokemonSkill?.name, after.pokemonSkillId ? skillNames.get(after.pokemonSkillId) : null);
  pushChange(changes, 'Mosslax effect', before.mosslaxEffect, after.mosslaxEffect);
  return changes;
}

export async function createDishCategory(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanDishCategoryPayload(payload);
  const id = await withTransaction(async (client) => {
    const sortOrder = await nextSortOrder(client, 'dish_categories');
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO dish_categories (
          name,
          cookware_item_id,
          main_material_item_id,
          total_material_quantity,
          effect,
          sort_order,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING id
      `,
      [
        cleanPayload.name,
        cleanPayload.cookwareItemId,
        cleanPayload.mainMaterialItemId,
        cleanPayload.totalMaterialQuantity,
        cleanPayload.effect,
        sortOrder,
        userId
      ]
    );
    const categoryId = result.rows[0].id;
    await replaceEntityTranslations(client, 'dish-categories', categoryId, cleanPayload.translations, ['name', 'effect']);
    await recordEditLog(client, 'dish-categories', categoryId, 'create', userId);
    return categoryId;
  });
  return getDishCategory(id, locale);
}

export async function updateDishCategory(id: number, payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanDishCategoryPayload(payload);
  const before = await getDishCategory(id, defaultLocale);
  const updated = await withTransaction(async (client) => {
    await ensureDishCategoryMaterialSlots(client, id, cleanPayload);
    const result = await client.query(
      `
        UPDATE dish_categories
        SET name = $1,
            cookware_item_id = $2,
            main_material_item_id = $3,
            total_material_quantity = $4,
            effect = $5,
            updated_by_user_id = $6,
            updated_at = now()
        WHERE id = $7
      `,
      [
        cleanPayload.name,
        cleanPayload.cookwareItemId,
        cleanPayload.mainMaterialItemId,
        cleanPayload.totalMaterialQuantity,
        cleanPayload.effect,
        userId,
        id
      ]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await replaceEntityTranslations(client, 'dish-categories', id, cleanPayload.translations, ['name', 'effect']);
    const changes = before ? await dishCategoryEditChanges(client, before as unknown as DishCategoryChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'dish-categories', id, 'update', userId, changes);
    return true;
  });
  return updated ? getDishCategory(id, locale) : null;
}

export async function deleteDishCategory(id: number, userId: number) {
  return withTransaction(async (client) => {
    const childRows = await client.query<{ id: number }>('SELECT id FROM dishes WHERE category_id = $1', [id]);
    const result = await client.query<{ id: number }>('DELETE FROM dish_categories WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await client.query('DELETE FROM entity_translations WHERE entity_type = $1 AND entity_id = $2', ['dish-categories', id]);
    const childIds = childRows.rows.map((row) => row.id);
    if (childIds.length) {
      await client.query('DELETE FROM entity_translations WHERE entity_type = $1 AND entity_id = ANY($2::integer[])', [
        'dishes',
        childIds
      ]);
    }
    await recordEditLog(client, 'dish-categories', id, 'delete', userId);
    return true;
  });
}

export async function createDish(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanDishPayload(payload);
  const id = await withTransaction(async (client) => {
    await ensureDishMaterialSlots(client, cleanPayload);
    const sortOrder = await nextSortOrder(client, 'dishes');
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO dishes (
          category_id,
          item_id,
          flavor_id,
          secondary_material_1_item_id,
          secondary_material_2_item_id,
          pokemon_skill_id,
          mosslax_effect,
          sort_order,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        RETURNING id
      `,
      [
        cleanPayload.categoryId,
        cleanPayload.itemId,
        cleanPayload.flavorId,
        cleanPayload.secondaryMaterialItemIds[0] ?? null,
        cleanPayload.secondaryMaterialItemIds[1] ?? null,
        cleanPayload.pokemonSkillId,
        cleanPayload.mosslaxEffect,
        sortOrder,
        userId
      ]
    );
    const dishId = result.rows[0].id;
    await replaceEntityTranslations(client, 'dishes', dishId, cleanPayload.translations, ['mosslaxEffect']);
    await recordEditLog(client, 'dishes', dishId, 'create', userId);
    return dishId;
  });
  return getDish(id, locale);
}

export async function updateDish(id: number, payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanDishPayload(payload);
  const before = await getDish(id, defaultLocale);
  const updated = await withTransaction(async (client) => {
    await ensureDishMaterialSlots(client, cleanPayload);
    const result = await client.query(
      `
        UPDATE dishes
        SET category_id = $1,
            item_id = $2,
            flavor_id = $3,
            secondary_material_1_item_id = $4,
            secondary_material_2_item_id = $5,
            pokemon_skill_id = $6,
            mosslax_effect = $7,
            updated_by_user_id = $8,
            updated_at = now()
        WHERE id = $9
      `,
      [
        cleanPayload.categoryId,
        cleanPayload.itemId,
        cleanPayload.flavorId,
        cleanPayload.secondaryMaterialItemIds[0] ?? null,
        cleanPayload.secondaryMaterialItemIds[1] ?? null,
        cleanPayload.pokemonSkillId,
        cleanPayload.mosslaxEffect,
        userId,
        id
      ]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await replaceEntityTranslations(client, 'dishes', id, cleanPayload.translations, ['mosslaxEffect']);
    const changes = before ? await dishEditChanges(client, before as unknown as DishChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'dishes', id, 'update', userId, changes);
    return true;
  });
  return updated ? getDish(id, locale) : null;
}

export async function deleteDish(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM dishes WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await deleteEntityTranslations(client, 'dishes', id);
    await recordEditLog(client, 'dishes', id, 'delete', userId);
    return true;
  });
}

export async function reorderDishCategories(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const ids = cleanIds(payload.ids);
  if (ids.length === 0) {
    throw validationError('server.validation.selectRecord');
  }
  await withTransaction(async (client) => {
    await reorderTableRows(client, 'dish_categories', 'dish-categories', ids, userId);
  });
  return listDish(locale);
}

export async function reorderDishes(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const ids = cleanIds(payload.ids);
  if (ids.length === 0) {
    throw validationError('server.validation.selectRecord');
  }
  await withTransaction(async (client) => {
    await reorderTableRows(client, 'dishes', 'dishes', ids, userId);
  });
  return listDish(locale);
}

const dataToolScopes = ['pokemon', 'habitats', 'items', 'artifacts', 'recipes', 'checklist'] as const satisfies readonly DataToolScope[];
const dataToolMainTables: Record<DataToolScope, string> = {
  pokemon: 'pokemon',
  habitats: 'habitats',
  items: 'items',
  artifacts: 'ancient_artifacts',
  recipes: 'recipes',
  checklist: 'daily_checklist_items'
};

const dataToolColumns = {
  pokemon: [
    'id',
    'data_id',
    'data_identifier',
    'display_id',
    'name',
    'is_event_item',
    'genus',
    'details',
    'height_inches',
    'weight_pounds',
    'environment_id',
    'hp',
    'attack',
    'defense',
    'special_attack',
    'special_defense',
    'speed',
    'image_path',
    'image_style',
    'image_version',
    'image_variant',
    'image_description',
    'sort_order',
    'created_by_user_id',
    'updated_by_user_id',
    'created_at',
    'updated_at'
  ],
  pokemonTypeLinks: ['pokemon_id', 'type_id', 'slot_order'],
  pokemonSkills: ['pokemon_id', 'skill_id'],
  pokemonFavoriteThings: ['pokemon_id', 'favorite_thing_id'],
  pokemonSkillItemDrops: ['pokemon_id', 'skill_id', 'item_id'],
  habitats: ['id', 'name', 'is_event_item', 'image_path', 'sort_order', 'created_by_user_id', 'updated_by_user_id', 'created_at', 'updated_at'],
  habitatRecipeItems: ['habitat_id', 'item_id', 'quantity'],
  habitatPokemon: ['habitat_id', 'pokemon_id', 'map_id', 'time_of_day', 'weather', 'rarity'],
  items: [
    'id',
    'name',
    'details',
    'category_key',
    'usage_key',
    'dyeable',
    'dual_dyeable',
    'pattern_editable',
    'no_recipe',
    'is_event_item',
    'image_path',
    'sort_order',
    'created_by_user_id',
    'updated_by_user_id',
    'created_at',
    'updated_at'
  ],
  itemAcquisitionMethods: ['item_id', 'acquisition_method_id'],
  itemFavoriteThings: ['item_id', 'favorite_thing_id'],
  artifactFavoriteThings: ['ancient_artifact_id', 'favorite_thing_id'],
  artifacts: [
    'id',
    'name',
    'details',
    'category_key',
    'image_path',
    'sort_order',
    'created_by_user_id',
    'updated_by_user_id',
    'created_at',
    'updated_at'
  ],
  recipes: ['id', 'item_id', 'sort_order', 'created_by_user_id', 'updated_by_user_id', 'created_at', 'updated_at'],
  recipeAcquisitionMethods: ['recipe_id', 'acquisition_method_id'],
  recipeMaterials: ['recipe_id', 'item_id', 'quantity'],
  checklist: ['id', 'title', 'sort_order', 'created_by_user_id', 'updated_by_user_id', 'created_at', 'updated_at'],
  translations: ['entity_type', 'entity_id', 'locale', 'field_name', 'value'],
  editLogs: ['id', 'entity_type', 'entity_id', 'action', 'user_id', 'changes', 'created_at'],
  imageUploads: [
    'id',
    'entity_type',
    'entity_id',
    'entity_name',
    'path',
    'original_filename',
    'mime_type',
    'byte_size',
    'created_by_user_id',
    'created_at'
  ],
  discussionComments: [
    'id',
    'entity_type',
    'entity_id',
    'parent_comment_id',
    'body',
    'ai_moderation_status',
    'ai_moderation_language_code',
    'ai_moderation_content_hash',
    'ai_moderation_checked_at',
    'ai_moderation_retry_count',
    'ai_moderation_updated_at',
    'created_by_user_id',
    'deleted_by_user_id',
    'deleted_at',
    'created_at',
    'updated_at'
  ],
  discussionCommentLikes: ['comment_id', 'user_id', 'created_at']
} as const;

function isDataToolScope(value: unknown): value is DataToolScope {
  return typeof value === 'string' && dataToolScopes.includes(value as DataToolScope);
}

function normalizeDataToolScopes(scopes: DataToolScope[]): DataToolScope[] {
  const scopeSet = new Set(scopes);
  if (scopeSet.has('items')) {
    scopeSet.add('recipes');
  }
  return dataToolScopes.filter((scope) => scopeSet.has(scope));
}

function cleanDataToolScopes(value: unknown): DataToolScope[] {
  if (!Array.isArray(value)) {
    throw validationError('server.validation.dataToolScopeRequired');
  }

  const scopes: DataToolScope[] = [];
  for (const scope of value) {
    if (!isDataToolScope(scope)) {
      throw validationError('server.validation.dataToolScopeInvalid');
    }
    if (!scopes.includes(scope)) {
      scopes.push(scope);
    }
  }

  if (scopes.length === 0) {
    throw validationError('server.validation.dataToolScopeRequired');
  }
  return normalizeDataToolScopes(scopes);
}

function cleanDataToolsBundle(value: unknown): DataToolsBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('server.validation.dataToolBundleInvalid');
  }

  const bundle = value as Record<string, unknown>;
  if (bundle.version !== 1 || !bundle.data || typeof bundle.data !== 'object' || Array.isArray(bundle.data)) {
    throw validationError('server.validation.dataToolBundleInvalid');
  }

  return {
    version: 1,
    exportedAt: typeof bundle.exportedAt === 'string' ? bundle.exportedAt : new Date().toISOString(),
    scopes: cleanDataToolScopes(bundle.scopes),
    data: bundle.data as DataToolsBundle['data']
  };
}

function dataToolTableRows(data: DataToolScopeData | undefined, key: string): DataToolRows {
  const rows = data?.[key];
  if (rows === undefined) {
    return [];
  }
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw validationError('server.validation.dataToolBundleInvalid');
  }
  return rows as DataToolRows;
}

function dataToolDataWithRows(key: string, ...sources: Array<DataToolScopeData | undefined>): DataToolScopeData | undefined {
  return sources.find((source) => source?.[key] !== undefined);
}

async function tableRows(client: DbClient, sql: string, params: unknown[] = []): Promise<DataToolRows> {
  const result = await client.query<Record<string, unknown>>(sql, params);
  return result.rows;
}

function normalizeImportValue(column: string, value: unknown, row: Record<string, unknown>): unknown {
  if (value === undefined) {
    if (column === 'display_id' && typeof row.id === 'number') {
      return row.id;
    }
    if (column === 'details') {
      return '';
    }
    if (column === 'image_path') {
      return '';
    }
    if (column === 'category_key') {
      return 'other';
    }
    return null;
  }
  if (column === 'changes' && typeof value !== 'string') {
    return JSON.stringify(value ?? []);
  }
  return value;
}

async function insertRows(client: DbClient, tableName: string, columns: readonly string[], rows: DataToolRows): Promise<void> {
  for (const row of rows) {
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const values = columns.map((column) => normalizeImportValue(column, row[column], row));
    await client.query(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, values);
  }
}

async function resetIdentity(client: DbClient, tableName: string): Promise<void> {
  const result = await client.query<{ maxId: number | null }>(`SELECT MAX(id)::integer AS "maxId" FROM ${tableName}`);
  const maxId = result.rows[0]?.maxId ?? null;
  if (maxId === null) {
    await client.query(`ALTER TABLE ${tableName} ALTER COLUMN id RESTART WITH 1`);
    return;
  }

  await client.query('SELECT setval(pg_get_serial_sequence($1, $2), $3, true)', [tableName, 'id', maxId]);
}

async function resetDataToolIdentities(client: DbClient): Promise<void> {
  for (const tableName of [
    'daily_checklist_items',
    'items',
    'ancient_artifacts',
    'recipes',
    'habitats',
    'wiki_edit_logs',
    'entity_image_uploads',
    'entity_discussion_comments'
  ]) {
    await resetIdentity(client, tableName);
  }
}

async function deleteGenericEntityRows(client: DbClient, entityTypes: string[]): Promise<void> {
  await client.query('DELETE FROM entity_discussion_comments WHERE entity_type = ANY($1::text[])', [entityTypes]);
  await client.query('DELETE FROM entity_image_uploads WHERE entity_type = ANY($1::text[])', [entityTypes]);
  await client.query('DELETE FROM wiki_edit_logs WHERE entity_type = ANY($1::text[])', [entityTypes]);
  await client.query('DELETE FROM entity_translations WHERE entity_type = ANY($1::text[])', [entityTypes]);
}

async function wipeRecipesData(client: DbClient): Promise<void> {
  await deleteGenericEntityRows(client, ['recipes']);
  await client.query('DELETE FROM recipe_acquisition_methods');
  await client.query('DELETE FROM recipe_materials');
  await client.query('DELETE FROM recipes');
}

async function wipeItemsData(client: DbClient): Promise<void> {
  await wipeRecipesData(client);
  await deleteGenericEntityRows(client, ['items']);
  await client.query('DELETE FROM item_acquisition_methods');
  await client.query('DELETE FROM item_favorite_things');
  await client.query('DELETE FROM habitat_recipe_items');
  await client.query('DELETE FROM pokemon_skill_item_drops');
  await client.query('DELETE FROM items');
}

async function wipeAncientArtifactsData(client: DbClient): Promise<void> {
  await deleteGenericEntityRows(client, ['ancient-artifacts']);
  await client.query('DELETE FROM ancient_artifact_favorite_things');
  await client.query('DELETE FROM ancient_artifacts');
}

async function wipePokemonData(client: DbClient): Promise<void> {
  await deleteGenericEntityRows(client, ['pokemon']);
  await client.query('DELETE FROM habitat_pokemon');
  await client.query('DELETE FROM pokemon_skill_item_drops');
  await client.query('DELETE FROM pokemon_pokemon_types');
  await client.query('DELETE FROM pokemon_skills');
  await client.query('DELETE FROM pokemon_favorite_things');
  await client.query('DELETE FROM pokemon');
}

async function wipeHabitatsData(client: DbClient): Promise<void> {
  await deleteGenericEntityRows(client, ['habitats']);
  await client.query('DELETE FROM habitat_recipe_items');
  await client.query('DELETE FROM habitat_pokemon');
  await client.query('DELETE FROM habitats');
}

async function wipeChecklistData(client: DbClient): Promise<void> {
  await deleteGenericEntityRows(client, ['daily-checklist-items']);
  await client.query('DELETE FROM daily_checklist_items');
}

async function wipeDataToolScopes(client: DbClient, scopes: DataToolScope[], resetIdentities = true): Promise<void> {
  const scopeSet = new Set(scopes);
  if (scopeSet.has('items')) {
    await wipeItemsData(client);
  } else if (scopeSet.has('recipes')) {
    await wipeRecipesData(client);
  }
  if (scopeSet.has('artifacts')) {
    await wipeAncientArtifactsData(client);
  }
  if (scopeSet.has('pokemon')) {
    await wipePokemonData(client);
  }
  if (scopeSet.has('habitats')) {
    await wipeHabitatsData(client);
  }
  if (scopeSet.has('checklist')) {
    await wipeChecklistData(client);
  }
  if (resetIdentities) {
    await resetDataToolIdentities(client);
  }
}

async function exportGenericScopeData(client: DbClient, entityType: string, includeImages: boolean): Promise<DataToolScopeData> {
  const data: DataToolScopeData = {
    translations: await tableRows(client, 'SELECT * FROM entity_translations WHERE entity_type = $1 ORDER BY entity_id, locale, field_name', [entityType]),
    editLogs: await tableRows(client, 'SELECT * FROM wiki_edit_logs WHERE entity_type = $1 ORDER BY id', [entityType]),
    discussionComments: await tableRows(
      client,
      `
        SELECT *
        FROM entity_discussion_comments
        WHERE entity_type = $1
        ORDER BY parent_comment_id NULLS FIRST, id
      `,
      [entityType]
    ),
    discussionCommentLikes: await tableRows(
      client,
      `
        SELECT edcl.*
        FROM entity_discussion_comment_likes edcl
        JOIN entity_discussion_comments edc ON edc.id = edcl.comment_id
        WHERE edc.entity_type = $1
        ORDER BY edcl.comment_id, edcl.user_id
      `,
      [entityType]
    )
  };

  if (includeImages) {
    data.imageUploads = await tableRows(client, 'SELECT * FROM entity_image_uploads WHERE entity_type = $1 ORDER BY id', [entityType]);
  }

  return data;
}

async function exportScopeData(client: DbClient, scope: DataToolScope): Promise<DataToolScopeData> {
  if (scope === 'pokemon') {
    return {
      pokemon: await tableRows(client, 'SELECT * FROM pokemon ORDER BY sort_order, id'),
      pokemonTypeLinks: await tableRows(client, 'SELECT * FROM pokemon_pokemon_types ORDER BY pokemon_id, slot_order'),
      pokemonSkills: await tableRows(client, 'SELECT * FROM pokemon_skills ORDER BY pokemon_id, skill_id'),
      pokemonFavoriteThings: await tableRows(client, 'SELECT * FROM pokemon_favorite_things ORDER BY pokemon_id, favorite_thing_id'),
      pokemonSkillItemDrops: await tableRows(client, 'SELECT * FROM pokemon_skill_item_drops ORDER BY pokemon_id, skill_id'),
      habitatPokemon: await tableRows(client, 'SELECT * FROM habitat_pokemon ORDER BY habitat_id, pokemon_id, map_id, time_of_day, weather'),
      ...(await exportGenericScopeData(client, 'pokemon', true))
    };
  }

  if (scope === 'habitats') {
    return {
      habitats: await tableRows(client, 'SELECT * FROM habitats ORDER BY sort_order, id'),
      habitatRecipeItems: await tableRows(client, 'SELECT * FROM habitat_recipe_items ORDER BY habitat_id, item_id'),
      habitatPokemon: await tableRows(client, 'SELECT * FROM habitat_pokemon ORDER BY habitat_id, pokemon_id, map_id, time_of_day, weather'),
      ...(await exportGenericScopeData(client, 'habitats', true))
    };
  }

  if (scope === 'items') {
    return {
      items: await tableRows(client, 'SELECT * FROM items ORDER BY sort_order, id'),
      itemAcquisitionMethods: await tableRows(client, 'SELECT * FROM item_acquisition_methods ORDER BY item_id, acquisition_method_id'),
      itemFavoriteThings: await tableRows(client, 'SELECT * FROM item_favorite_things ORDER BY item_id, favorite_thing_id'),
      pokemonSkillItemDrops: await tableRows(client, 'SELECT * FROM pokemon_skill_item_drops ORDER BY pokemon_id, skill_id'),
      habitatRecipeItems: await tableRows(client, 'SELECT * FROM habitat_recipe_items ORDER BY habitat_id, item_id'),
      ...(await exportGenericScopeData(client, 'items', true))
    };
  }

  if (scope === 'artifacts') {
    return {
      artifacts: await tableRows(client, 'SELECT * FROM ancient_artifacts ORDER BY sort_order, id'),
      artifactFavoriteThings: await tableRows(
        client,
        'SELECT * FROM ancient_artifact_favorite_things ORDER BY ancient_artifact_id, favorite_thing_id'
      ),
      ...(await exportGenericScopeData(client, 'ancient-artifacts', true))
    };
  }

  if (scope === 'recipes') {
    return {
      recipes: await tableRows(client, 'SELECT * FROM recipes ORDER BY sort_order, id'),
      recipeAcquisitionMethods: await tableRows(client, 'SELECT * FROM recipe_acquisition_methods ORDER BY recipe_id, acquisition_method_id'),
      recipeMaterials: await tableRows(client, 'SELECT * FROM recipe_materials ORDER BY recipe_id, item_id'),
      ...(await exportGenericScopeData(client, 'recipes', false))
    };
  }

  return {
    checklist: await tableRows(client, 'SELECT * FROM daily_checklist_items ORDER BY sort_order, id'),
    translations: await tableRows(
      client,
      'SELECT * FROM entity_translations WHERE entity_type = $1 ORDER BY entity_id, locale, field_name',
      ['daily-checklist-items']
    ),
    editLogs: await tableRows(client, 'SELECT * FROM wiki_edit_logs WHERE entity_type = $1 ORDER BY id', ['daily-checklist-items'])
  };
}

async function importScopeMainRows(client: DbClient, bundle: DataToolsBundle): Promise<void> {
  const itemData = bundle.data.items;
  const artifactData = bundle.data.artifacts;
  const pokemonData = bundle.data.pokemon;
  const habitatData = bundle.data.habitats;
  const checklistData = bundle.data.checklist;
  const recipeData = bundle.data.recipes;

  await insertRows(client, 'items', dataToolColumns.items, dataToolTableRows(itemData, 'items'));
  await insertRows(client, 'ancient_artifacts', dataToolColumns.artifacts, dataToolTableRows(artifactData, 'artifacts'));
  await insertRows(client, 'pokemon', dataToolColumns.pokemon, dataToolTableRows(pokemonData, 'pokemon'));
  await insertRows(client, 'habitats', dataToolColumns.habitats, dataToolTableRows(habitatData, 'habitats'));
  await insertRows(client, 'daily_checklist_items', dataToolColumns.checklist, dataToolTableRows(checklistData, 'checklist'));
  await insertRows(client, 'recipes', dataToolColumns.recipes, dataToolTableRows(recipeData, 'recipes'));
}

async function importScopeRelationRows(client: DbClient, bundle: DataToolsBundle): Promise<void> {
  const itemData = bundle.data.items;
  const artifactData = bundle.data.artifacts;
  const pokemonData = bundle.data.pokemon;
  const habitatData = bundle.data.habitats;
  const recipeData = bundle.data.recipes;
  const pokemonDropData = dataToolDataWithRows('pokemonSkillItemDrops', pokemonData, itemData);
  const habitatRecipeData = dataToolDataWithRows('habitatRecipeItems', habitatData, itemData);
  const habitatPokemonData = dataToolDataWithRows('habitatPokemon', habitatData, pokemonData);

  await insertRows(client, 'item_acquisition_methods', dataToolColumns.itemAcquisitionMethods, dataToolTableRows(itemData, 'itemAcquisitionMethods'));
  await insertRows(client, 'item_favorite_things', dataToolColumns.itemFavoriteThings, dataToolTableRows(itemData, 'itemFavoriteThings'));
  await insertRows(
    client,
    'ancient_artifact_favorite_things',
    dataToolColumns.artifactFavoriteThings,
    dataToolTableRows(artifactData, 'artifactFavoriteThings')
  );
  await insertRows(client, 'pokemon_pokemon_types', dataToolColumns.pokemonTypeLinks, dataToolTableRows(pokemonData, 'pokemonTypeLinks'));
  await insertRows(client, 'pokemon_skills', dataToolColumns.pokemonSkills, dataToolTableRows(pokemonData, 'pokemonSkills'));
  await insertRows(client, 'pokemon_favorite_things', dataToolColumns.pokemonFavoriteThings, dataToolTableRows(pokemonData, 'pokemonFavoriteThings'));
  await insertRows(client, 'pokemon_skill_item_drops', dataToolColumns.pokemonSkillItemDrops, dataToolTableRows(pokemonDropData, 'pokemonSkillItemDrops'));
  await insertRows(client, 'recipe_acquisition_methods', dataToolColumns.recipeAcquisitionMethods, dataToolTableRows(recipeData, 'recipeAcquisitionMethods'));
  await insertRows(client, 'recipe_materials', dataToolColumns.recipeMaterials, dataToolTableRows(recipeData, 'recipeMaterials'));
  await insertRows(client, 'habitat_recipe_items', dataToolColumns.habitatRecipeItems, dataToolTableRows(habitatRecipeData, 'habitatRecipeItems'));
  await insertRows(client, 'habitat_pokemon', dataToolColumns.habitatPokemon, dataToolTableRows(habitatPokemonData, 'habitatPokemon'));
}

async function importGenericScopeRows(client: DbClient, bundle: DataToolsBundle): Promise<void> {
  for (const scope of bundle.scopes) {
    const data = bundle.data[scope];
    await insertRows(client, 'entity_translations', dataToolColumns.translations, dataToolTableRows(data, 'translations'));
    await insertRows(client, 'wiki_edit_logs', dataToolColumns.editLogs, dataToolTableRows(data, 'editLogs'));
    await insertRows(client, 'entity_image_uploads', dataToolColumns.imageUploads, dataToolTableRows(data, 'imageUploads'));
    await insertRows(client, 'entity_discussion_comments', dataToolColumns.discussionComments, dataToolTableRows(data, 'discussionComments'));
    await insertRows(
      client,
      'entity_discussion_comment_likes',
      dataToolColumns.discussionCommentLikes,
      dataToolTableRows(data, 'discussionCommentLikes')
    );
  }
}

async function importDataToolsBundle(client: DbClient, bundle: DataToolsBundle): Promise<void> {
  await importScopeMainRows(client, bundle);
  await importScopeRelationRows(client, bundle);
  await importGenericScopeRows(client, bundle);
  await resetDataToolIdentities(client);
}

export async function getAdminDataToolsSummary(): Promise<{ scopes: DataToolScopeSummary[] }> {
  const scopes: DataToolScopeSummary[] = [];
  for (const scope of dataToolScopes) {
    const result = await queryOne<{ count: number }>(`SELECT COUNT(*)::integer AS count FROM ${dataToolMainTables[scope]}`);
    scopes.push({ scope, count: result?.count ?? 0 });
  }
  return { scopes };
}

export async function exportAdminData(payload: Record<string, unknown>): Promise<DataToolsBundle> {
  const scopes = cleanDataToolScopes(payload.scopes);
  return withTransaction(async (client) => {
    const data: DataToolsBundle['data'] = {};
    for (const scope of scopes) {
      data[scope] = await exportScopeData(client, scope);
    }
    return { version: 1, exportedAt: new Date().toISOString(), scopes, data };
  });
}

export async function importAdminData(payload: Record<string, unknown>): Promise<{ scopes: DataToolScopeSummary[] }> {
  const bundle = cleanDataToolsBundle(payload.bundle);
  await withTransaction(async (client) => {
    await wipeDataToolScopes(client, bundle.scopes, false);
    await importDataToolsBundle(client, bundle);
  });
  return getAdminDataToolsSummary();
}

export async function wipeAdminData(payload: Record<string, unknown>): Promise<{ scopes: DataToolScopeSummary[] }> {
  const scopes = cleanDataToolScopes(payload.scopes);
  await withTransaction(async (client) => {
    await wipeDataToolScopes(client, scopes);
  });
  return getAdminDataToolsSummary();
}
