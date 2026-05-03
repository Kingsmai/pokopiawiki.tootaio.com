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

type QueryValue = string | string[] | undefined;

type QueryParams = Record<string, QueryValue>;

type DbClient = PoolClient;

type TranslationField = 'name' | 'title' | 'details' | 'genus';
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
  | 'maps'
  | 'habitats'
  | 'daily-checklist-items'
  | 'life-tags';

type ConfigType =
  | 'pokemon-types'
  | 'skills'
  | 'environments'
  | 'favorite-things'
  | 'item-categories'
  | 'item-usages'
  | 'acquisition-methods'
  | 'maps'
  | 'life-tags';

type ConfigDefinition = {
  table: string;
  entityType: EntityType;
  hasItemDrop?: boolean;
};
type SortableContentType = 'pokemon' | 'items' | 'recipes' | 'habitats';
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
  translations: TranslationInput;
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
};

type RecipePayload = {
  itemId: number;
  acquisitionMethodIds: number[];
  materials: IdQuantity[];
};

type DailyChecklistPayload = {
  title: string;
  translations: TranslationInput;
};

type LifePostPayload = {
  body: string;
  tagIds: number[];
};

type LifeCommentPayload = {
  body: string;
};

type DiscussionEntityType = 'pokemon' | 'items' | 'recipes' | 'habitats';
type DiscussionEntityDefinition = {
  table: string;
};
type EntityDiscussionCommentPayload = {
  body: string;
};
type EntityDiscussionCommentRow = {
  id: number;
  entityType: DiscussionEntityType;
  entityId: number;
  parentCommentId: number | null;
  body: string;
  deleted: boolean;
  createdAt: Date;
  createdAtCursor?: string;
  updatedAt: Date;
  author: { id: number; displayName: string } | null;
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

type LifeCommentRow = {
  id: number;
  postId: number;
  parentCommentId: number | null;
  body: string;
  deleted: boolean;
  createdAt: Date;
  createdAtCursor?: string;
  updatedAt: Date;
  author: { id: number; displayName: string } | null;
};

type LifeComment = Omit<LifeCommentRow, 'createdAtCursor'> & {
  replies: LifeComment[];
};

type LifePostRow = {
  id: number;
  body: string;
  createdAt: Date;
  createdAtCursor: string;
  updatedAt: Date;
  author: { id: number; displayName: string } | null;
  updatedBy: { id: number; displayName: string } | null;
  tags: Array<{ id: number; name: string }>;
};

type LifePost = Omit<LifePostRow, 'createdAtCursor'> & {
  commentPreview: LifeComment[];
  commentCount: number;
  reactionCounts: LifeReactionCounts;
  myReaction: LifeReactionType | null;
};

type LifePostCursor = {
  createdAt: string;
  id: number;
};

type LifePostFilters = {
  authorId?: number;
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

type PublicUserProfile = {
  user: PublicProfileUser;
  stats: PublicProfileStats;
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
};
type ItemChangeSource = {
  name: string;
  isEventItem: boolean;
  image: EntityImageValue | null;
  category: { name: string };
  usage: { name: string } | null;
  customization: { dyeable: boolean; dualDyeable: boolean; patternEditable: boolean };
  noRecipe: boolean;
  acquisitionMethods: Array<{ name: string }>;
  tags: Array<{ name: string }>;
};
type HabitatChangeSource = {
  name: string;
  isEventItem: boolean;
  image: EntityImageValue | null;
  recipe: Array<{ name: string; quantity: number }>;
  pokemon: Array<{ name: string; time_of_day: string; weather: string; rarity: number; map: { name: string } }>;
};
type RecipeChangeSource = {
  item: { name: string };
  acquisition_methods: Array<{ name: string }>;
  materials: Array<{ name: string; quantity: number }>;
};

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

const configDefinitions: Record<ConfigType, ConfigDefinition> = {
  'pokemon-types': { table: 'pokemon_types', entityType: 'pokemon-types' },
  skills: { table: 'skills', entityType: 'skills', hasItemDrop: true },
  environments: { table: 'environments', entityType: 'environments' },
  'favorite-things': { table: 'favorite_things', entityType: 'favorite-things' },
  'item-categories': { table: 'item_categories', entityType: 'item-categories' },
  'item-usages': { table: 'item_usages', entityType: 'item-usages' },
  'acquisition-methods': { table: 'acquisition_methods', entityType: 'acquisition-methods' },
  maps: { table: 'maps', entityType: 'maps' },
  'life-tags': { table: 'life_tags', entityType: 'life-tags' }
};

const sortableContentDefinitions: Record<SortableContentType, SortableContentDefinition> = {
  pokemon: { table: 'pokemon', entityType: 'pokemon' },
  items: { table: 'items', entityType: 'items' },
  recipes: { table: 'recipes', entityType: 'recipes' },
  habitats: { table: 'habitats', entityType: 'habitats' }
};

const discussionEntityDefinitions: Record<DiscussionEntityType, DiscussionEntityDefinition> = {
  pokemon: { table: 'pokemon' },
  items: { table: 'items' },
  recipes: { table: 'recipes' },
  habitats: { table: 'habitats' }
};

let pokemonCsvDataCache: Promise<PokemonCsvData> | null = null;

function asString(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function cleanLocale(value: unknown): string {
  const locale = typeof value === 'string' ? value.trim() : '';
  return localePattern.test(locale) ? locale : defaultLocale;
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
  return definition.hasItemDrop
    ? `c.id, ${name} AS name, c.name AS "baseName", ${translations} AS translations, c.has_item_drop AS "hasItemDrop"`
    : `c.id, ${name} AS name, c.name AS "baseName", ${translations} AS translations`;
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

function cleanName(value: unknown, message = 'server.validation.nameRequired'): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError(message);
  }
  return value.trim();
}

function cleanOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanUploadImagePath(value: unknown, entityType: 'items' | 'habitats'): string {
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

async function nextPokemonInternalId(client: DbClient, displayId: number, isEventItem: boolean): Promise<number> {
  if (isEventItem) {
    const result = await client.query<{ id: number }>(
      'SELECT COALESCE(MAX(id), 999999) + 1 AS id FROM pokemon WHERE id >= 1000000'
    );
    const nextId = result.rows[0]?.id ?? 1000000;
    return nextId === displayId ? nextId + 1 : nextId;
  }

  if (!isEventItem) {
    const preferredId = await client.query<{ id: number }>('SELECT id FROM pokemon WHERE id = $1', [displayId]);
    if (preferredId.rowCount === 0) {
      return displayId;
    }
  }

  const result = await client.query<{ id: number }>(
    'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM pokemon WHERE id <> $1',
    [displayId]
  );
  const nextId = result.rows[0]?.id ?? 1;
  return nextId === displayId ? nextId + 1 : nextId;
}

async function reorderTableRows(
  client: DbClient,
  tableName: string,
  entityType: string,
  ids: number[],
  userId: number
): Promise<void> {
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM ${tableName} WHERE id = ANY($1::integer[])`,
    [ids]
  );

  if (existing.rowCount !== ids.length) {
    throw validationError('server.validation.recordMissing');
  }

  for (const [index, id] of ids.entries()) {
    await client.query(
      `
        UPDATE ${tableName}
        SET sort_order = $1, updated_by_user_id = $2, updated_at = now()
        WHERE id = $3
      `,
      [(index + 1) * 10, userId, id]
    );
    await recordEditLog(client, entityType, id, 'update', userId);
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

function pokemonImageCandidateForPath(id: number, path: string): PokemonImage | null {
  const cleanPath = path.trim();
  const candidate = pokemonImageCandidates(id).find((item) => item.path === cleanPath);
  return candidate ? pokemonImageWithUrl(candidate) : null;
}

function cleanPokemonImage(value: unknown, pokemonId: number): PokemonImage | null {
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
      variant: `#${pokemonId}`,
      description: '',
      source: 'upload'
    };
  }

  const image = pokemonImageCandidateForPath(pokemonId, path);
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
    const existing = await client.query<{ name: string }>('SELECT name FROM pokemon_types WHERE id = $1', [typeId]);

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
    } else if (existing.rows[0].name !== name) {
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
      await recordEditLog(client, 'pokemon-types', typeId, 'update', userId, [
        { label: 'Name', before: existing.rows[0].name, after: name }
      ]);
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
  const [data, languages] = await Promise.all([loadPokemonCsvData(), listLanguages()]);

  return data.pokemonRows
    .filter((row) => csvInteger(row, 'id') > 0 && pokemonFetchOptionMatches(row, data, languages, locale, search))
    .slice(0, 20)
    .map((row) => pokemonFetchOption(row, data, languages, locale));
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
  pushChange(changes, 'Pokemon ID', String(before.displayId), String(after.displayId));
  pushChange(changes, 'Event item', boolValue(before.isEventItem), boolValue(after.isEventItem));
  pushChange(changes, 'Genus', before.genus, after.genus);
  pushChange(changes, 'Details', before.details, after.details);
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
  const categoryNames = await entityNameMap(client, 'item_categories', [after.categoryId]);
  const usageNames = await entityNameMap(client, 'item_usages', after.usageId ? [after.usageId] : []);
  const methodNames = await entityNameMap(client, 'acquisition_methods', after.acquisitionMethodIds);
  const tagNames = await entityNameMap(client, 'favorite_things', after.tagIds);

  pushChange(changes, 'Name', before.name, after.name);
  pushChange(changes, 'Event item', boolValue(before.isEventItem), boolValue(after.isEventItem));
  pushChange(changes, 'Image', imagePathLabel(before.image?.path), imagePathLabel(after.imagePath));
  pushChange(changes, 'Category', before.category.name, categoryNames.get(after.categoryId));
  pushChange(changes, 'Usage', before.usage?.name, after.usageId ? usageNames.get(after.usageId) : null);
  pushChange(changes, 'Dyeable', boolValue(before.customization.dyeable), boolValue(after.dyeable));
  pushChange(changes, 'Dual dyeable', boolValue(before.customization.dualDyeable), boolValue(after.dualDyeable));
  pushChange(changes, 'Pattern editable', boolValue(before.customization.patternEditable), boolValue(after.patternEditable));
  pushChange(changes, 'No recipe', boolValue(before.noRecipe), boolValue(after.noRecipe));
  pushChange(changes, 'Acquisition methods', namedListValue(before.acquisitionMethods), namesFromIds(after.acquisitionMethodIds, methodNames));
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
  pushChange(changes, 'Event item', boolValue(before.isEventItem), boolValue(after.isEventItem));
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
    itemCategories,
    itemUsages,
    acquisitionMethods,
    maps,
    lifeTags
  ] = await Promise.all([
    optionSelect('pokemon_types', 'pokemon-types', locale),
    skillOptions(locale),
    optionSelect('environments', 'environments', locale),
    optionSelect('favorite_things', 'favorite-things', locale),
    optionSelect('item_categories', 'item-categories', locale),
    optionSelect('item_usages', 'item-usages', locale),
    optionSelect('acquisition_methods', 'acquisition-methods', locale),
    optionSelect('maps', 'maps', locale),
    optionSelect('life_tags', 'life-tags', locale)
  ]);

  return {
    pokemonTypes,
    skills,
    environments,
    favoriteThings,
    itemCategories,
    itemUsages,
    acquisitionMethods,
    itemTags: favoriteThings,
    maps,
    lifeTags
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
    await recordEditLog(client, 'daily-checklist-items', id, 'update', userId);
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
    const existing = await client.query<{ id: number }>(
      'SELECT id FROM daily_checklist_items WHERE id = ANY($1::integer[])',
      [ids]
    );

    if (existing.rowCount !== ids.length) {
      throw validationError('server.validation.taskDoesNotExist');
    }

    for (const [index, id] of ids.entries()) {
      await client.query(
        `
          UPDATE daily_checklist_items
          SET sort_order = $1, updated_by_user_id = $2, updated_at = now()
          WHERE id = $3
        `,
        [(index + 1) * 10, userId, id]
      );
      await recordEditLog(client, 'daily-checklist-items', id, 'update', userId);
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
  const tagIds = cleanIds(payload.tagIds);
  if (tagIds.length === 0) {
    throw validationError('server.validation.lifeTagRequired');
  }

  return {
    body,
    tagIds
  };
}

function cleanLifeCommentPayload(payload: Record<string, unknown>): LifeCommentPayload {
  const body = cleanName(payload.body, 'server.validation.commentRequired');
  if (body.length > 1000) {
    throw validationError('server.validation.commentTooLong');
  }

  return { body };
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

function lifePostProjection(locale = defaultLocale): string {
  const tagName = localizedName('life-tags', 'lt', locale);

  return `
    SELECT
      lp.id,
      lp.body,
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
      COALESCE((
        SELECT json_agg(json_build_object('id', lt.id, 'name', ${tagName}) ORDER BY ${orderByEntity('lt')})
        FROM life_post_tags lpt
        JOIN life_tags lt ON lt.id = lpt.tag_id
        WHERE lpt.post_id = lp.id
      ), '[]'::json) AS tags
    FROM life_posts lp
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

function cleanCommentLimit(value: QueryValue): number {
  const rawLimit = asString(value);
  if (rawLimit === undefined || rawLimit === '') {
    return defaultCommentLimit;
  }

  const limit = Number(rawLimit);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, maxCommentLimit) : defaultCommentLimit;
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

    if (!createdAt || Number.isNaN(new Date(createdAt).getTime()) || !Number.isInteger(id) || id <= 0) {
      throw validationError('server.validation.cursorInvalid');
    }

    return { createdAt, id };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      throw error;
    }
    throw validationError('server.validation.cursorInvalid');
  }
}

function encodeLifePostCursor(post: LifePostRow): string {
  return Buffer.from(JSON.stringify({ createdAt: post.createdAtCursor, id: post.id }), 'utf8').toString('base64url');
}

function encodeProfileCursor(cursor: LifePostCursor): string {
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
  myReactionsByPost: Map<number, LifeReactionType>
): LifePost {
  return {
    id: post.id,
    body: post.body,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author,
    updatedBy: post.updatedBy,
    tags: post.tags,
    commentPreview: commentPreviewByPost.get(post.id) ?? [],
    commentCount: commentCountsByPost.get(post.id) ?? 0,
    reactionCounts: countsByPost.get(post.id) ?? emptyLifeReactionCounts(),
    myReaction: myReactionsByPost.get(post.id) ?? null
  };
}

function lifeCommentProjection(whereClause: string): string {
  return `
    SELECT
      lc.id,
      lc.post_id AS "postId",
      lc.parent_comment_id AS "parentCommentId",
      CASE WHEN lc.deleted_at IS NULL THEN lc.body ELSE '' END AS body,
      lc.deleted_at IS NOT NULL AS deleted,
      lc.created_at AS "createdAt",
      lc.created_at::text AS "createdAtCursor",
      lc.updated_at AS "updatedAt",
      CASE
        WHEN lc.deleted_at IS NOT NULL OR comment_user.id IS NULL THEN NULL
        ELSE json_build_object('id', comment_user.id, 'displayName', comment_user.display_name)
      END AS author
    FROM life_post_comments lc
    LEFT JOIN users comment_user ON comment_user.id = lc.created_by_user_id
    ${whereClause}
  `;
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

async function lifeCommentCountsForPosts(postIds: number[]): Promise<Map<number, number>> {
  const countsByPost = new Map<number, number>();
  for (const postId of postIds) {
    countsByPost.set(postId, 0);
  }

  if (postIds.length === 0) {
    return countsByPost;
  }

  const rows = await query<{ postId: number; total: number }>(
    `
      SELECT post_id AS "postId", COUNT(*)::integer AS total
      FROM life_post_comments
      WHERE post_id = ANY($1::integer[])
      GROUP BY post_id
    `,
    [postIds]
  );

  for (const row of rows) {
    countsByPost.set(row.postId, row.total);
  }

  return countsByPost;
}

async function lifeCommentPreviewForPosts(postIds: number[]): Promise<Map<number, LifeComment[]>> {
  const commentsByPost = new Map<number, LifeComment[]>();
  if (postIds.length === 0) {
    return commentsByPost;
  }

  const rows = await query<LifeCommentRow>(
    `
      WITH preview_top AS (
        SELECT id
        FROM (
          SELECT
            lc.id,
            ROW_NUMBER() OVER (PARTITION BY lc.post_id ORDER BY lc.created_at DESC, lc.id DESC) AS preview_rank
          FROM life_post_comments lc
          WHERE lc.post_id = ANY($1::integer[])
            AND lc.parent_comment_id IS NULL
        ) ranked
        WHERE preview_rank <= $2
      )
      ${lifeCommentProjection('WHERE lc.id IN (SELECT id FROM preview_top)')}
      ORDER BY lc.post_id, lc.created_at, lc.id
    `,
    [postIds, lifeCommentPreviewLimit]
  );

  for (const postId of postIds) {
    commentsByPost.set(postId, buildLifeCommentTree(rows.filter((comment) => comment.postId === postId)));
  }

  return commentsByPost;
}

export async function listLifeComments(postIdValue: number, paramsQuery: QueryParams = {}): Promise<LifeCommentsPage | null> {
  const postId = requirePositiveInteger(postIdValue, 'server.validation.recordInvalid');
  const cursor = decodeLifePostCursor(paramsQuery.cursor);
  const limit = cleanCommentLimit(paramsQuery.limit);
  const exists = await queryOne<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM life_posts
        WHERE id = $1
          AND deleted_at IS NULL
      ) AS exists
    `,
    [postId]
  );

  if (exists?.exists !== true) {
    return null;
  }

  const params: unknown[] = [postId];
  const topLevelConditions = ['lc.post_id = $1', 'lc.parent_comment_id IS NULL'];

  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    topLevelConditions.push(`(lc.created_at, lc.id) > ($${params.length - 1}::timestamptz, $${params.length}::integer)`);
  }

  params.push(limit + 1);
  const topLevelRows = await query<LifeCommentRow>(
    `
      ${lifeCommentProjection(`WHERE ${topLevelConditions.join(' AND ')}`)}
      ORDER BY lc.created_at, lc.id
      LIMIT $${params.length}
    `,
    params
  );
  const hasMore = topLevelRows.length > limit;
  const topLevelComments = hasMore ? topLevelRows.slice(0, limit) : topLevelRows;
  const topLevelIds = topLevelComments.map((comment) => comment.id);
  const replyRows = topLevelIds.length
    ? await query<LifeCommentRow>(
        `
          ${lifeCommentProjection('WHERE lc.parent_comment_id = ANY($1::integer[])')}
          ORDER BY lc.created_at, lc.id
        `,
        [topLevelIds]
      )
    : [];
  const total = await queryOne<{ total: number }>(
    `
      SELECT COUNT(*)::integer AS total
      FROM life_post_comments
      WHERE post_id = $1
    `,
    [postId]
  );

  return {
    items: buildLifeCommentTree([...topLevelComments, ...replyRows]),
    nextCursor:
      hasMore && topLevelComments.length > 0
        ? encodeProfileCursor({
            createdAt:
              topLevelComments[topLevelComments.length - 1].createdAtCursor ??
              topLevelComments[topLevelComments.length - 1].createdAt.toISOString(),
            id: topLevelComments[topLevelComments.length - 1].id
          })
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

async function getLifeCommentById(id: number): Promise<LifeComment | null> {
  const row = await queryOne<LifeCommentRow>(
    `
      ${lifeCommentProjection('WHERE lc.id = $1')}
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
  filters: LifePostFilters = {}
): Promise<LifePostsPage> {
  const cursor = decodeLifePostCursor(paramsQuery.cursor);
  const limit = cleanLifePostLimit(paramsQuery.limit);
  const search = asString(paramsQuery.search)?.trim();
  const tagIdValue = asString(paramsQuery.tagId)?.trim();
  const params: unknown[] = [];
  const conditions: string[] = ['lp.deleted_at IS NULL'];

  if (filters.authorId !== undefined) {
    params.push(filters.authorId);
    conditions.push(`lp.created_by_user_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`lp.body ILIKE $${params.length}`);
  }

  if (tagIdValue) {
    const tagId = requirePositiveInteger(tagIdValue, 'server.validation.tagInvalid');
    params.push(tagId);
    conditions.push(`EXISTS (
      SELECT 1
      FROM life_post_tags lpt_filter
      WHERE lpt_filter.post_id = lp.id
        AND lpt_filter.tag_id = $${params.length}
    )`);
  }

  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    conditions.push(`(lp.created_at, lp.id) < ($${params.length - 1}::timestamptz, $${params.length}::integer)`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit + 1);
  const rows = await query<LifePostRow>(
    `
      ${lifePostProjection(locale)}
      ${whereClause}
      ORDER BY lp.created_at DESC, lp.id DESC
      LIMIT $${params.length}
    `,
    params
  );
  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;

  const postIds = posts.map((post) => post.id);
  const commentPreviewByPost = await lifeCommentPreviewForPosts(postIds);
  const commentCountsByPost = await lifeCommentCountsForPosts(postIds);
  const { countsByPost, myReactionsByPost } = await lifeReactionsForPosts(postIds, userId);

  return {
    items: posts.map((post) => hydrateLifePost(post, commentPreviewByPost, commentCountsByPost, countsByPost, myReactionsByPost)),
    nextCursor: hasMore && posts.length > 0 ? encodeLifePostCursor(posts[posts.length - 1]) : null,
    hasMore
  };
}

export async function listLifePosts(
  paramsQuery: QueryParams = {},
  userId: number | null = null,
  locale = defaultLocale
): Promise<LifePostsPage> {
  return listLifePostsWithFilters(paramsQuery, userId, locale);
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

export async function getPublicUserProfile(userIdValue: number): Promise<PublicUserProfile | null> {
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
        COALESCE((SELECT COUNT(*)::integer FROM life_posts WHERE created_by_user_id = $1 AND deleted_at IS NULL), 0) AS "lifePosts",
        COALESCE((
          SELECT COUNT(*)::integer
          FROM life_post_comments lc
          JOIN life_posts lp ON lp.id = lc.post_id
          WHERE lc.created_by_user_id = $1
            AND lc.deleted_at IS NULL
            AND lp.deleted_at IS NULL
        ), 0) AS "lifeComments",
        COALESCE((
          SELECT COUNT(*)::integer
          FROM life_post_reactions lpr
          JOIN life_posts lp ON lp.id = lpr.post_id
          WHERE lpr.user_id = $1
            AND lp.deleted_at IS NULL
        ), 0) AS "lifeReactions",
        COALESCE((
          SELECT COUNT(*)::integer
          FROM entity_discussion_comments
          WHERE created_by_user_id = $1
            AND deleted_at IS NULL
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
    contributions: contributions.map((item) => ({
      ...item,
      contentType: publicContributionType(item.contentType)
    }))
  };
}

export async function listUserLifePosts(
  userIdValue: number,
  paramsQuery: QueryParams = {},
  viewerUserId: number | null = null,
  locale = defaultLocale
): Promise<LifePostsPage | null> {
  const user = await getPublicProfileUser(userIdValue);
  if (!user) {
    return null;
  }

  return listLifePostsWithFilters(paramsQuery, viewerUserId, locale, { authorId: user.id });
}

async function hydrateLifePostsById(
  postIds: number[],
  viewerUserId: number | null,
  locale: string
): Promise<Map<number, LifePost>> {
  const postById = new Map<number, LifePost>();
  if (postIds.length === 0) {
    return postById;
  }

  const posts = await query<LifePostRow>(
    `
      ${lifePostProjection(locale)}
      WHERE lp.id = ANY($1::integer[])
        AND lp.deleted_at IS NULL
    `,
    [postIds]
  );
  const commentPreviewByPost = await lifeCommentPreviewForPosts(postIds);
  const commentCountsByPost = await lifeCommentCountsForPosts(postIds);
  const { countsByPost, myReactionsByPost } = await lifeReactionsForPosts(postIds, viewerUserId);

  for (const post of posts) {
    postById.set(post.id, hydrateLifePost(post, commentPreviewByPost, commentCountsByPost, countsByPost, myReactionsByPost));
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
  const conditions = ['lpr.user_id = $1', 'lp.deleted_at IS NULL'];

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
        WHERE edc.created_by_user_id = $1
          AND edc.deleted_at IS NULL
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

async function getLifePostById(id: number, userId: number | null = null, locale = defaultLocale): Promise<LifePost | null> {
  const post = await queryOne<LifePostRow>(
    `
      ${lifePostProjection(locale)}
      WHERE lp.id = $1
        AND lp.deleted_at IS NULL
    `,
    [id]
  );

  if (!post) {
    return null;
  }

  const commentPreviewByPost = await lifeCommentPreviewForPosts([post.id]);
  const commentCountsByPost = await lifeCommentCountsForPosts([post.id]);
  const { countsByPost, myReactionsByPost } = await lifeReactionsForPosts([post.id], userId);
  return hydrateLifePost(post, commentPreviewByPost, commentCountsByPost, countsByPost, myReactionsByPost);
}

async function replaceLifePostTags(client: DbClient, postId: number, tagIds: number[]): Promise<void> {
  await client.query('DELETE FROM life_post_tags WHERE post_id = $1', [postId]);

  for (const tagId of tagIds) {
    await client.query(
      `
        INSERT INTO life_post_tags (post_id, tag_id)
        VALUES ($1, $2)
      `,
      [postId, tagId]
    );
  }
}

export async function createLifePost(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  const cleanPayload = cleanLifePostPayload(payload);

  const id = await withTransaction(async (client) => {
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO life_posts (body, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $2)
        RETURNING id
      `,
      [cleanPayload.body, userId]
    );

    const createdId = result.rows[0].id;
    await replaceLifePostTags(client, createdId, cleanPayload.tagIds);
    return createdId;
  });

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
    const result = await client.query<{ id: number }>(
      `
        UPDATE life_posts
        SET body = $1, updated_by_user_id = $2, updated_at = now()
        WHERE id = $3
          AND ($4 = true OR created_by_user_id = $2)
          AND deleted_at IS NULL
        RETURNING id
      `,
      [cleanPayload.body, userId, id, allowAny]
    );

    const resultId = result.rows[0]?.id ?? null;
    if (resultId === null) {
      return null;
    }

    await replaceLifePostTags(client, resultId, cleanPayload.tagIds);
    return resultId;
  });

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
      )
      ON CONFLICT (post_id, user_id)
      DO UPDATE SET reaction_type = EXCLUDED.reaction_type, updated_at = now()
      RETURNING post_id AS "postId"
    `,
    [postId, userId, reactionType]
  );

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
        )
      RETURNING post_id AS "postId"
    `,
    [postId, userId]
  );

  return getLifePostById(postId, userId, locale);
}

export async function createLifeComment(postId: number, payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanLifeCommentPayload(payload);

  const result = await queryOne<{ id: number }>(
    `
      INSERT INTO life_post_comments (post_id, body, created_by_user_id)
      SELECT $1, $2, $3
      WHERE EXISTS (
        SELECT 1
        FROM life_posts
        WHERE id = $1
          AND deleted_at IS NULL
      )
      RETURNING id
    `,
    [postId, cleanPayload.body, userId]
  );

  return result ? getLifeCommentById(result.id) : null;
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
      INSERT INTO life_post_comments (post_id, parent_comment_id, body, created_by_user_id)
      SELECT lc.post_id, lc.id, $3, $4
      FROM life_post_comments lc
      JOIN life_posts lp ON lp.id = lc.post_id
      WHERE lc.post_id = $1
        AND lc.id = $2
        AND lc.parent_comment_id IS NULL
        AND lc.deleted_at IS NULL
        AND lp.deleted_at IS NULL
      RETURNING id
    `,
    [postId, commentId, cleanPayload.body, userId]
  );

  return result ? getLifeCommentById(result.id) : null;
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

  return { body };
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

function entityDiscussionCommentProjection(whereClause: string): string {
  return `
    SELECT
      edc.id,
      edc.entity_type AS "entityType",
      edc.entity_id AS "entityId",
      edc.parent_comment_id AS "parentCommentId",
      CASE WHEN edc.deleted_at IS NULL THEN edc.body ELSE '' END AS body,
      edc.deleted_at IS NOT NULL AS deleted,
      edc.created_at AS "createdAt",
      edc.created_at::text AS "createdAtCursor",
      edc.updated_at AS "updatedAt",
      CASE
        WHEN edc.deleted_at IS NOT NULL OR comment_user.id IS NULL THEN NULL
        ELSE json_build_object('id', comment_user.id, 'displayName', comment_user.display_name)
      END AS author
    FROM entity_discussion_comments edc
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

async function getEntityDiscussionCommentById(id: number): Promise<EntityDiscussionComment | null> {
  const row = await queryOne<EntityDiscussionCommentRow>(
    `
      ${entityDiscussionCommentProjection('WHERE edc.id = $1')}
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
  paramsQuery: QueryParams = {}
): Promise<EntityDiscussionCommentsPage | null> {
  const entityType = cleanDiscussionEntityType(entityTypeValue);
  const entityId = requirePositiveInteger(entityIdValue, 'server.validation.recordInvalid');
  const cursor = decodeLifePostCursor(paramsQuery.cursor);
  const limit = cleanCommentLimit(paramsQuery.limit);

  if (!(await entityDiscussionExists(pool, entityType, entityId))) {
    return null;
  }

  const params: unknown[] = [entityType, entityId];
  const topLevelConditions = ['edc.entity_type = $1', 'edc.entity_id = $2', 'edc.parent_comment_id IS NULL'];

  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    topLevelConditions.push(`(edc.created_at, edc.id) > ($${params.length - 1}::timestamptz, $${params.length}::integer)`);
  }

  params.push(limit + 1);
  const topLevelRows = await query<EntityDiscussionCommentRow>(
    `
      ${entityDiscussionCommentProjection(`WHERE ${topLevelConditions.join(' AND ')}`)}
      ORDER BY edc.created_at, edc.id
      LIMIT $${params.length}
    `,
    params
  );
  const hasMore = topLevelRows.length > limit;
  const topLevelComments = hasMore ? topLevelRows.slice(0, limit) : topLevelRows;
  const topLevelIds = topLevelComments.map((comment) => comment.id);
  const replyRows = topLevelIds.length
    ? await query<EntityDiscussionCommentRow>(
        `
          ${entityDiscussionCommentProjection('WHERE edc.parent_comment_id = ANY($1::integer[])')}
          ORDER BY edc.created_at, edc.id
        `,
        [topLevelIds]
      )
    : [];
  const total = await queryOne<{ total: number }>(
    `
      SELECT COUNT(*)::integer AS total
      FROM entity_discussion_comments
      WHERE entity_type = $1
        AND entity_id = $2
    `,
    [entityType, entityId]
  );

  return {
    items: buildEntityDiscussionCommentTree([...topLevelComments, ...replyRows]),
    nextCursor:
      hasMore && topLevelComments.length > 0
        ? encodeProfileCursor({
            createdAt:
              topLevelComments[topLevelComments.length - 1].createdAtCursor ??
              topLevelComments[topLevelComments.length - 1].createdAt.toISOString(),
            id: topLevelComments[topLevelComments.length - 1].id
          })
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
        INSERT INTO entity_discussion_comments (entity_type, entity_id, body, created_by_user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [entityType, entityId, cleanPayload.body, userId]
    );

    return result.rows[0].id;
  });

  return id ? getEntityDiscussionCommentById(id) : null;
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
          created_by_user_id
        )
        SELECT edc.entity_type, edc.entity_id, edc.id, $4, $5
        FROM entity_discussion_comments edc
        WHERE edc.entity_type = $1
          AND edc.entity_id = $2
          AND edc.id = $3
          AND edc.parent_comment_id IS NULL
          AND edc.deleted_at IS NULL
        RETURNING id
      `,
      [entityType, entityId, commentId, cleanPayload.body, userId]
    );

    return result.rows[0]?.id ?? null;
  });

  return id ? getEntityDiscussionCommentById(id) : null;
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

  const id = await withTransaction(async (client) => {
    const sortOrder = await nextSortOrder(client, definition.table);
    const result = definition.hasItemDrop
      ? await client.query<{ id: number }>(
          `
            INSERT INTO ${definition.table} (name, has_item_drop, sort_order, created_by_user_id, updated_by_user_id)
            VALUES ($1, $2, $3, $4, $4)
            RETURNING id
          `,
          [name, hasItemDrop, sortOrder, userId]
        )
      : await client.query<{ id: number }>(
          `
            INSERT INTO ${definition.table} (name, sort_order, created_by_user_id, updated_by_user_id)
            VALUES ($1, $2, $3, $3)
            RETURNING id
          `,
          [name, sortOrder, userId]
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

  const updated = await withTransaction(async (client) => {
    const result = definition.hasItemDrop
      ? await client.query(
          `
            UPDATE ${definition.table}
            SET name = $1, has_item_drop = $2, updated_by_user_id = $3, updated_at = now()
            WHERE id = $4
          `,
          [name, hasItemDrop, userId, id]
        )
      : await client.query(
          `
            UPDATE ${definition.table}
            SET name = $1, updated_by_user_id = $2, updated_at = now()
            WHERE id = $3
          `,
          [name, userId, id]
        );

    if (result.rowCount === 0) {
      return false;
    }

    if (definition.hasItemDrop && !hasItemDrop) {
      await client.query('DELETE FROM pokemon_skill_item_drops WHERE skill_id = $1', [id]);
    }

    await replaceEntityTranslations(client, definition.entityType, id, translations, ['name']);
    await recordEditLog(client, type, id, 'update', userId);
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

export async function reorderRecipes(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  await reorderContent('recipes', payload, userId);
  return listRecipes({}, locale);
}

export async function reorderHabitats(payload: Record<string, unknown>, userId: number, locale = defaultLocale) {
  await reorderContent('habitats', payload, userId);
  return listHabitats(locale);
}

export async function listPokemon(paramsQuery: QueryParams, locale = defaultLocale) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const search = asString(paramsQuery.search)?.trim();
  const environmentId = Number(asString(paramsQuery.environmentId));
  const skillIds = parseIdList(asString(paramsQuery.skillIds));
  const favoriteThingIds = parseIdList(asString(paramsQuery.favoriteThingIds));

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
  const categoryName = localizedName('item-categories', 'c', locale);
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
          json_build_object('id', c.id, 'name', ${categoryName}) AS category,
          json_agg(json_build_object('id', ft.id, 'name', ${tagName}) ORDER BY ${orderByEntity('ft')}) AS tags
        FROM pokemon_favorite_things pft
        JOIN item_favorite_things ift ON ift.favorite_thing_id = pft.favorite_thing_id
        JOIN favorite_things ft ON ft.id = pft.favorite_thing_id
        JOIN items i ON i.id = ift.item_id
        JOIN item_categories c ON c.id = i.category_id
        WHERE pft.pokemon_id = $1
        GROUP BY i.id, i.name, i.image_path, i.sort_order, c.id, c.name, c.sort_order
        ORDER BY ${orderByEntity('c')}, ${orderByEntity('i')}
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

  const id = await withTransaction(async (client) => {
    const pokemonId = await nextPokemonInternalId(client, cleanPayload.displayId, cleanPayload.isEventItem);
    const sortOrder = await nextSortOrder(client, 'pokemon');
    await client.query(
      `
        INSERT INTO pokemon (
          id,
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22)
      `,
      [
        pokemonId,
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
  const before = await getPokemon(id, defaultLocale);

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE pokemon
        SET
          display_id = $1,
          name = $2,
          is_event_item = $3,
          genus = $4,
          details = $5,
          height_inches = $6,
          weight_pounds = $7,
          environment_id = $8,
          hp = $9,
          attack = $10,
          defense = $11,
          special_attack = $12,
          special_defense = $13,
          speed = $14,
          image_path = $15,
          image_style = $16,
          image_version = $17,
          image_variant = $18,
          image_description = $19,
          updated_by_user_id = $20,
          updated_at = now()
        WHERE id = $21
      `,
      [
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

export async function listHabitats(locale = defaultLocale) {
  const habitatName = localizedName('habitats', 'h', locale);
  const itemName = localizedName('items', 'i', locale);
  const pokemonName = localizedName('pokemon', 'p', locale);

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
    ORDER BY ${orderByEntity('h')}
  `);
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
  const categoryName = localizedName('item-categories', 'c', locale);
  const usageName = localizedName('item-usages', 'u', locale);
  const tagName = localizedName('favorite-things', 't', locale);

  return `
    SELECT
      i.id,
      ${itemName} AS name,
      i.name AS "baseName",
      i.is_event_item AS "isEventItem",
      ${translationsSelect('items', 'i.id')} AS translations,
      ${auditSelect('i', 'item_created_user', 'item_updated_user')},
      ${uploadedImageJson('i.image_path')} AS image,
      json_build_object('id', c.id, 'name', ${categoryName}) AS category,
      CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'name', ${usageName}) END AS usage,
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
    JOIN item_categories c ON c.id = i.category_id
    LEFT JOIN item_usages u ON u.id = i.usage_id
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
  const tagIds = parseIdList(asString(paramsQuery.tagIds));
  const search = asString(paramsQuery.search)?.trim();
  const recipeOrder = asString(paramsQuery.recipeOrder) === '1';

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`${localizedName('items', 'i', locale)} ILIKE $${params.length}`);
  }

  if (Number.isInteger(categoryId) && categoryId > 0) {
    params.push(categoryId);
    conditions.push(`i.category_id = $${params.length}`);
  }

  if (Number.isInteger(usageId) && usageId > 0) {
    params.push(usageId);
    conditions.push(`i.usage_id = $${params.length}`);
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
  const resultItemCategoryName = localizedName('item-categories', 'result_category', locale);
  const resultItemUsageName = localizedName('item-usages', 'result_usage', locale);
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
            'category', json_build_object('id', result_category.id, 'name', ${resultItemCategoryName}),
            'usage', CASE
              WHEN result_usage.id IS NULL THEN NULL
              ELSE json_build_object('id', result_usage.id, 'name', ${resultItemUsageName})
            END
          ) AS item
        FROM recipes r
        JOIN items result_item ON result_item.id = r.item_id
        JOIN item_categories result_category ON result_category.id = result_item.category_id
        LEFT JOIN item_usages result_usage ON result_usage.id = result_item.usage_id
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
  const usageId = payload.usageId === null || payload.usageId === '' || payload.usageId === undefined
    ? null
    : requirePositiveInteger(payload.usageId, 'server.validation.usageRequired');

  return {
    name: cleanName(payload.name, 'server.validation.itemNameRequired'),
    translations: cleanTranslations(payload.translations, ['name']),
    categoryId: requirePositiveInteger(payload.categoryId, 'server.validation.categoryRequired'),
    usageId,
    dyeable: Boolean(payload.dyeable),
    dualDyeable: Boolean(payload.dualDyeable),
    patternEditable: Boolean(payload.patternEditable),
    noRecipe: Boolean(payload.noRecipe),
    isEventItem: Boolean(payload.isEventItem),
    acquisitionMethodIds: cleanIds(payload.acquisitionMethodIds),
    tagIds: cleanIds(payload.tagIds),
    imagePath: cleanUploadImagePath(payload.imagePath, 'items')
  };
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
          category_id,
          usage_id,
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        RETURNING id
      `,
      [
        cleanPayload.name,
        cleanPayload.categoryId,
        cleanPayload.usageId,
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
    await replaceEntityTranslations(client, 'items', itemId, cleanPayload.translations, ['name']);
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
            category_id = $2,
            usage_id = $3,
            dyeable = $4,
            dual_dyeable = $5,
            pattern_editable = $6,
            no_recipe = $7,
            is_event_item = $8,
            image_path = $9,
            updated_by_user_id = $10,
            updated_at = now()
        WHERE id = $11
      `,
      [
        cleanPayload.name,
        cleanPayload.categoryId,
        cleanPayload.usageId,
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
    await replaceEntityTranslations(client, 'items', id, cleanPayload.translations, ['name']);
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

export async function listRecipes(paramsQuery: QueryParams = {}, locale = defaultLocale) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const categoryId = Number(asString(paramsQuery.categoryId));
  const resultItemName = localizedName('items', 'result_item', locale);
  const materialItemName = localizedName('items', 'i', locale);

  if (Number.isInteger(categoryId) && categoryId > 0) {
    params.push(categoryId);
    conditions.push(`result_item.category_id = $${params.length}`);
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
  const resultItemCategoryName = localizedName('item-categories', 'result_category', locale);
  const resultItemUsageName = localizedName('item-usages', 'result_usage', locale);
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
          'category', json_build_object('id', result_category.id, 'name', ${resultItemCategoryName}),
          'usage', CASE
            WHEN result_usage.id IS NULL THEN NULL
            ELSE json_build_object('id', result_usage.id, 'name', ${resultItemUsageName})
          END
        ) AS item
      FROM recipes r
      JOIN items result_item ON result_item.id = r.item_id
      JOIN item_categories result_category ON result_category.id = result_item.category_id
      LEFT JOIN item_usages result_usage ON result_usage.id = result_item.usage_id
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
