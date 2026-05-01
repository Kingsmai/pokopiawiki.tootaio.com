import { parseIdList, parseMatchMode, sqlForRelationFilter } from './filter.ts';
import { pool, query, queryOne } from './db.ts';
import type { PoolClient } from 'pg';

type QueryValue = string | string[] | undefined;

type QueryParams = Record<string, QueryValue>;

type DbClient = PoolClient;

type ConfigType =
  | 'skills'
  | 'environments'
  | 'favorite-things'
  | 'item-categories'
  | 'item-usages'
  | 'acquisition-methods'
  | 'maps';

type ConfigDefinition = {
  table: string;
  order: string;
  hasItemDrop?: boolean;
};

type IdQuantity = {
  itemId: number;
  quantity: number;
};

type SkillItemDrop = {
  skillId: number;
  itemId: number;
};

type PokemonPayload = {
  id: number;
  name: string;
  environmentId: number;
  skillIds: number[];
  favoriteThingIds: number[];
  skillItemDrops: SkillItemDrop[];
};

type ItemPayload = {
  name: string;
  categoryId: number;
  usageId: number | null;
  dyeable: boolean;
  dualDyeable: boolean;
  patternEditable: boolean;
  noRecipe: boolean;
  acquisitionMethodIds: number[];
  tagIds: number[];
};

type RecipePayload = {
  itemId: number;
  acquisitionMethodIds: number[];
  materials: IdQuantity[];
};

type DailyChecklistPayload = {
  title: string;
};

type HabitatPayload = {
  name: string;
  recipeItems: IdQuantity[];
  pokemonAppearances: Array<{
    pokemonId: number;
    mapId: number;
    timeOfDay: string;
    weather: string;
    rarity: number;
  }>;
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
  name: string;
  environment: { name: string };
  skills: Array<{ name: string; itemDrop?: { name: string } | null }>;
  favorite_things: Array<{ name: string }>;
};
type ItemChangeSource = {
  name: string;
  category: { name: string };
  usage: { name: string } | null;
  customization: { dyeable: boolean; dualDyeable: boolean; patternEditable: boolean };
  noRecipe: boolean;
  acquisitionMethods: Array<{ name: string }>;
  tags: Array<{ name: string }>;
};
type HabitatChangeSource = {
  name: string;
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

const configDefinitions: Record<ConfigType, ConfigDefinition> = {
  skills: { table: 'skills', order: 'name', hasItemDrop: true },
  environments: { table: 'environments', order: 'name' },
  'favorite-things': { table: 'favorite_things', order: 'name' },
  'item-categories': { table: 'item_categories', order: 'name' },
  'item-usages': { table: 'item_usages', order: 'name' },
  'acquisition-methods': { table: 'acquisition_methods', order: 'name' },
  maps: { table: 'maps', order: 'name' }
};

function asString(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionSelect(tableName: string): Promise<Array<{ id: number; name: string }>> {
  return query(`SELECT id, name FROM ${tableName} ORDER BY name`);
}

function skillOptions(): Promise<Array<{ id: number; name: string; hasItemDrop: boolean }>> {
  return query('SELECT id, name, has_item_drop AS "hasItemDrop" FROM skills ORDER BY name');
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

function configOrder(definition: ConfigDefinition): string {
  return definition.order
    .split(', ')
    .map((column) => `c.${column}`)
    .join(', ');
}

function configSelect(definition: ConfigDefinition): string {
  return definition.hasItemDrop ? 'c.id, c.name, c.has_item_drop AS "hasItemDrop"' : 'c.id, c.name';
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

function cleanName(value: unknown, message = '请输入名称'): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError(message);
  }
  return value.trim();
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

function displayValue(value: string | null | undefined): string {
  const cleanValue = value?.trim() ?? '';
  return cleanValue === '' ? '无' : cleanValue;
}

function pushChange(changes: EditChange[], label: string, before: string | null | undefined, after: string | null | undefined): void {
  const beforeValue = displayValue(before);
  const afterValue = displayValue(after);

  if (beforeValue !== afterValue) {
    changes.push({ label, before: beforeValue, after: afterValue });
  }
}

function boolValue(value: boolean): string {
  return value ? '是' : '否';
}

function namedListValue(items: Array<{ name: string }> | null | undefined): string {
  if (!items?.length) {
    return '无';
  }

  return [...new Set(items.map((item) => item.name))]
    .sort((a, b) => a.localeCompare(b))
    .join(' / ');
}

function quantityListValue(items: Array<{ name: string; quantity: number }> | null | undefined): string {
  if (!items?.length) {
    return '无';
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
    .map((skill) => `${skill.name}：${skill.itemDrop?.name}`)
    .sort((a, b) => a.localeCompare(b)) ?? [];

  return rows.length ? rows.join(' / ') : '无';
}

function appearanceListValue(
  rows: Array<{ name: string; time_of_day: string; weather: string; rarity: number; map: { name: string } }> | null | undefined
): string {
  if (!rows?.length) {
    return '无';
  }

  return rows
    .map((row) => `${row.name}：${row.time_of_day} / ${row.weather} / ${row.rarity} 星 / ${row.map.name}`)
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

  return names.length ? names.join(' / ') : '无';
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
  const skillNames = await entityNameMap(client, 'skills', after.skillIds);
  const favoriteThingNames = await entityNameMap(client, 'favorite_things', after.favoriteThingIds);
  const dropSkillNames = await entityNameMap(client, 'skills', after.skillItemDrops.map((drop) => drop.skillId));
  const dropItemNames = await entityNameMap(client, 'items', after.skillItemDrops.map((drop) => drop.itemId));
  const afterDrops = after.skillItemDrops
    .map((drop) => {
      const skillName = dropSkillNames.get(drop.skillId);
      const itemName = dropItemNames.get(drop.itemId);
      return skillName && itemName ? `${skillName}：${itemName}` : null;
    })
    .filter((drop): drop is string => drop !== null)
    .sort((a, b) => a.localeCompare(b))
    .join(' / ');

  pushChange(changes, '名字', before.name, after.name);
  pushChange(changes, '喜欢的环境', before.environment.name, environmentNames.get(after.environmentId));
  pushChange(changes, '特长', namedListValue(before.skills), namesFromIds(after.skillIds, skillNames));
  pushChange(changes, '喜欢的东西', namedListValue(before.favorite_things), namesFromIds(after.favoriteThingIds, favoriteThingNames));
  pushChange(changes, '特长掉落物', skillDropListValue(before.skills), afterDrops);

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

  pushChange(changes, '名称', before.name, after.name);
  pushChange(changes, '分类', before.category.name, categoryNames.get(after.categoryId));
  pushChange(changes, '用途', before.usage?.name, after.usageId ? usageNames.get(after.usageId) : null);
  pushChange(changes, '可染色', boolValue(before.customization.dyeable), boolValue(after.dyeable));
  pushChange(changes, '可双区染色', boolValue(before.customization.dualDyeable), boolValue(after.dualDyeable));
  pushChange(changes, '可改花纹', boolValue(before.customization.patternEditable), boolValue(after.patternEditable));
  pushChange(changes, '无材料单', boolValue(before.noRecipe), boolValue(after.noRecipe));
  pushChange(changes, '入手方式', namedListValue(before.acquisitionMethods), namesFromIds(after.acquisitionMethodIds, methodNames));
  pushChange(changes, '标签', namedListValue(before.tags), namesFromIds(after.tagIds, tagNames));

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
      return pokemonName && mapName ? `${pokemonName}：${row.timeOfDay} / ${row.weather} / ${row.rarity} 星 / ${mapName}` : null;
    })
    .filter((row): row is string => row !== null)
    .sort((a, b) => a.localeCompare(b))
    .join(' / ');

  pushChange(changes, '名称', before.name, after.name);
  pushChange(changes, '配方', quantityListValue(before.recipe), await quantityPayloadValue(client, after.recipeItems));
  pushChange(changes, '可能出现的宝可梦', appearanceListValue(before.pokemon), afterAppearances);

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

  pushChange(changes, '物品', before.item.name, itemNames.get(after.itemId));
  pushChange(changes, '入手方式', namedListValue(before.acquisition_methods), namesFromIds(after.acquisitionMethodIds, methodNames));
  pushChange(changes, '需要材料', quantityListValue(before.materials), await quantityPayloadValue(client, after.materials));

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

const pokemonProjection = `
  SELECT
    p.id,
    p.name,
    ${auditSelect('p', 'pokemon_created_user', 'pokemon_updated_user')},
    json_build_object('id', e.id, 'name', e.name) AS environment,
    COALESCE((
      SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'hasItemDrop', s.has_item_drop) ORDER BY s.name)
      FROM pokemon_skills ps
      JOIN skills s ON s.id = ps.skill_id
      WHERE ps.pokemon_id = p.id
    ), '[]'::json) AS skills,
    COALESCE((
      SELECT json_agg(json_build_object('id', ft.id, 'name', ft.name) ORDER BY ft.name)
      FROM pokemon_favorite_things pft
      JOIN favorite_things ft ON ft.id = pft.favorite_thing_id
      WHERE pft.pokemon_id = p.id
    ), '[]'::json) AS favorite_things
  FROM pokemon p
  JOIN environments e ON e.id = p.environment_id
  ${auditJoins('p', 'pokemon_created_user', 'pokemon_updated_user')}
`;

export async function getOptions() {
  const [
    skills,
    environments,
    favoriteThings,
    itemCategories,
    itemUsages,
    acquisitionMethods,
    maps
  ] = await Promise.all([
    skillOptions(),
    optionSelect('environments'),
    optionSelect('favorite_things'),
    optionSelect('item_categories'),
    optionSelect('item_usages'),
    optionSelect('acquisition_methods'),
    optionSelect('maps')
  ]);

  return {
    skills,
    environments,
    favoriteThings,
    itemCategories,
    itemUsages,
    acquisitionMethods,
    itemTags: favoriteThings,
    maps
  };
}

function cleanDailyChecklistPayload(payload: Record<string, unknown>): DailyChecklistPayload {
  return {
    title: cleanName(payload.title, '请输入 Task')
  };
}

export async function listDailyChecklistItems() {
  return query(
    `
      SELECT c.id, c.title
      FROM daily_checklist_items c
      ORDER BY c.sort_order, c.id
    `
  );
}

async function getDailyChecklistItemById(id: number) {
  return queryOne(
    `
      SELECT c.id, c.title
      FROM daily_checklist_items c
      WHERE c.id = $1
    `,
    [id]
  );
}

export async function createDailyChecklistItem(payload: Record<string, unknown>, userId: number) {
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
    await recordEditLog(client, 'daily-checklist-items', createdId, 'create', userId);
    return createdId;
  });

  return getDailyChecklistItemById(id);
}

export async function updateDailyChecklistItem(id: number, payload: Record<string, unknown>, userId: number) {
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

    await recordEditLog(client, 'daily-checklist-items', id, 'update', userId);
    return true;
  });

  return updated ? getDailyChecklistItemById(id) : null;
}

export async function reorderDailyChecklistItems(payload: Record<string, unknown>, userId: number) {
  const ids = cleanIds(payload.ids);
  if (ids.length === 0) {
    throw validationError('请选择 Task');
  }

  await withTransaction(async (client) => {
    const existing = await client.query<{ id: number }>(
      'SELECT id FROM daily_checklist_items WHERE id = ANY($1::integer[])',
      [ids]
    );

    if (existing.rowCount !== ids.length) {
      throw validationError('Task 不存在');
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

  return listDailyChecklistItems();
}

export async function deleteDailyChecklistItem(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM daily_checklist_items WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await recordEditLog(client, 'daily-checklist-items', id, 'delete', userId);
    return true;
  });
}

export function isConfigType(type: string): type is ConfigType {
  return Object.hasOwn(configDefinitions, type);
}

export async function listConfig(type: ConfigType) {
  const definition = configDefinitions[type];
  return query(
    `
      SELECT ${configSelect(definition)}, ${auditSelect('c')}
      FROM ${definition.table} c
      ${auditJoins('c')}
      ORDER BY ${configOrder(definition)}
    `
  );
}

async function getConfigById(type: ConfigType, id: number) {
  const definition = configDefinitions[type];
  return queryOne(
    `
      SELECT ${configSelect(definition)}, ${auditSelect('c')}
      FROM ${definition.table} c
      ${auditJoins('c')}
      WHERE c.id = $1
    `,
    [id]
  );
}

export async function createConfig(type: ConfigType, payload: Record<string, unknown>, userId: number) {
  const definition = configDefinitions[type];
  const name = cleanName(payload.name);
  const hasItemDrop = definition.hasItemDrop ? Boolean(payload.hasItemDrop) : false;

  const id = await withTransaction(async (client) => {
    const result = definition.hasItemDrop
      ? await client.query<{ id: number }>(
          `
            INSERT INTO ${definition.table} (name, has_item_drop, created_by_user_id, updated_by_user_id)
            VALUES ($1, $2, $3, $3)
            RETURNING id
          `,
          [name, hasItemDrop, userId]
        )
      : await client.query<{ id: number }>(
          `
            INSERT INTO ${definition.table} (name, created_by_user_id, updated_by_user_id)
            VALUES ($1, $2, $2)
            RETURNING id
          `,
          [name, userId]
        );

    const createdId = result.rows[0].id;
    await recordEditLog(client, type, createdId, 'create', userId);
    return createdId;
  });

  return getConfigById(type, id);
}

export async function updateConfig(type: ConfigType, id: number, payload: Record<string, unknown>, userId: number) {
  const definition = configDefinitions[type];
  const name = cleanName(payload.name);
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

    await recordEditLog(client, type, id, 'update', userId);
    return true;
  });

  return updated ? getConfigById(type, id) : null;
}

export async function deleteConfig(type: ConfigType, id: number, userId: number) {
  const definition = configDefinitions[type];
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>(`DELETE FROM ${definition.table} WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await recordEditLog(client, type, id, 'delete', userId);
    return true;
  });
}

export async function listPokemon(paramsQuery: QueryParams) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const search = asString(paramsQuery.search)?.trim();
  const environmentId = Number(asString(paramsQuery.environmentId));
  const skillIds = parseIdList(asString(paramsQuery.skillIds));
  const favoriteThingIds = parseIdList(asString(paramsQuery.favoriteThingIds));

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`p.name ILIKE $${params.length}`);
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
  return query(`${pokemonProjection} ${whereClause} ORDER BY p.id`, params);
}

export async function getPokemon(id: number) {
  const pokemon = await queryOne(`${pokemonProjection} WHERE p.id = $1`, [id]);
  if (!pokemon) {
    return null;
  }

  const [habitats, itemDrops, favoriteThingItems, editHistory] = await Promise.all([
    query(
      `
        SELECT
          h.id,
          h.name,
          hp.time_of_day,
          hp.weather,
          hp.rarity,
          json_build_object('id', m.id, 'name', m.name) AS map
        FROM habitat_pokemon hp
        JOIN habitats h ON h.id = hp.habitat_id
        JOIN maps m ON m.id = hp.map_id
        WHERE hp.pokemon_id = $1
        ORDER BY h.name, hp.rarity, m.name
      `,
      [id]
    ),
    query<{ skillId: number; id: number; name: string }>(
      `
        SELECT psid.skill_id AS "skillId", i.id, i.name
        FROM pokemon_skill_item_drops psid
        JOIN skills s ON s.id = psid.skill_id
        JOIN items i ON i.id = psid.item_id
        WHERE psid.pokemon_id = $1
          AND s.has_item_drop = true
        ORDER BY psid.skill_id, i.name
      `,
      [id]
    ),
    query(
      `
        SELECT
          i.id,
          i.name,
          json_build_object('id', c.id, 'name', c.name) AS category,
          json_agg(json_build_object('id', ft.id, 'name', ft.name) ORDER BY ft.name) AS tags
        FROM pokemon_favorite_things pft
        JOIN item_favorite_things ift ON ift.favorite_thing_id = pft.favorite_thing_id
        JOIN favorite_things ft ON ft.id = pft.favorite_thing_id
        JOIN items i ON i.id = ift.item_id
        JOIN item_categories c ON c.id = i.category_id
        WHERE pft.pokemon_id = $1
        GROUP BY i.id, i.name, c.id, c.name
        ORDER BY c.name, i.name
      `,
      [id]
    ),
    getEditHistory('pokemon', id)
  ]);

  const dropsBySkill = itemDrops.reduce((itemsBySkill, item) => {
    itemsBySkill.set(item.skillId, { id: item.id, name: item.name });
    return itemsBySkill;
  }, new Map<number, { id: number; name: string }>());

  const skills = Array.isArray(pokemon.skills)
    ? pokemon.skills.map((skill: { id: number; name: string }) => ({
        ...skill,
        itemDrop: dropsBySkill.get(skill.id) ?? null
      }))
    : [];

  return { ...pokemon, skills, habitats, favoriteThingItems, editHistory };
}

function cleanPokemonPayload(payload: Record<string, unknown>): PokemonPayload {
  const skillIds = cleanIds(payload.skillIds);
  const favoriteThingIds = cleanIds(payload.favoriteThingIds);
  const selectedSkillIds = new Set(skillIds);
  const skillItemDrops = new Map<string, SkillItemDrop>();

  if (skillIds.length > 2) {
    throw validationError('特长最多选择 2 个');
  }
  if (favoriteThingIds.length > 6) {
    throw validationError('喜欢的东西最多选择 6 个');
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
        throw validationError('掉落物品必须关联已选择的特长');
      }

      skillItemDrops.set(String(skillId), { skillId, itemId });
    }
  }

  return {
    id: requirePositiveInteger(payload.id, '请输入 Pokemon ID'),
    name: cleanName(payload.name, '请输入 Pokemon 名字'),
    environmentId: requirePositiveInteger(payload.environmentId, '请选择喜欢的环境'),
    skillIds,
    favoriteThingIds,
    skillItemDrops: [...skillItemDrops.values()]
  };
}

async function replacePokemonRelations(client: DbClient, pokemonId: number, payload: PokemonPayload): Promise<void> {
  await client.query('DELETE FROM pokemon_skill_item_drops WHERE pokemon_id = $1', [pokemonId]);
  await client.query('DELETE FROM pokemon_skills WHERE pokemon_id = $1', [pokemonId]);
  await client.query('DELETE FROM pokemon_favorite_things WHERE pokemon_id = $1', [pokemonId]);

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
      throw validationError('该特长不能配置掉落物');
    }
  }

  for (const drop of payload.skillItemDrops) {
    await client.query(
      'INSERT INTO pokemon_skill_item_drops (pokemon_id, skill_id, item_id) VALUES ($1, $2, $3)',
      [pokemonId, drop.skillId, drop.itemId]
    );
  }
}

export async function createPokemon(payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanPokemonPayload(payload);

  const id = await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO pokemon (id, name, environment_id, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $3, $4, $4)
      `,
      [cleanPayload.id, cleanPayload.name, cleanPayload.environmentId, userId]
    );
    await replacePokemonRelations(client, cleanPayload.id, cleanPayload);
    await recordEditLog(client, 'pokemon', cleanPayload.id, 'create', userId);
    return cleanPayload.id;
  });
  return getPokemon(id);
}

export async function updatePokemon(id: number, payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanPokemonPayload({ ...payload, id });
  const before = await getPokemon(id);

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE pokemon
        SET name = $1, environment_id = $2, updated_by_user_id = $3, updated_at = now()
        WHERE id = $4
      `,
      [cleanPayload.name, cleanPayload.environmentId, userId, id]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await replacePokemonRelations(client, id, cleanPayload);
    const changes = before ? await pokemonEditChanges(client, before as unknown as PokemonChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'pokemon', id, 'update', userId, changes);
    return true;
  });
  return updated ? getPokemon(id) : null;
}

export async function deletePokemon(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM pokemon WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await recordEditLog(client, 'pokemon', id, 'delete', userId);
    return true;
  });
}

export async function listHabitats() {
  return query(`
    SELECT
      h.id,
      h.name,
      ${auditSelect('h', 'habitat_created_user', 'habitat_updated_user')},
      COALESCE((
        SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'quantity', hri.quantity) ORDER BY i.name)
        FROM habitat_recipe_items hri
        JOIN items i ON i.id = hri.item_id
        WHERE hri.habitat_id = h.id
      ), '[]'::json) AS recipe,
      COALESCE((
        SELECT json_agg(DISTINCT jsonb_build_object('id', p.id, 'name', p.name))
        FROM habitat_pokemon hp
        JOIN pokemon p ON p.id = hp.pokemon_id
        WHERE hp.habitat_id = h.id
      ), '[]'::json) AS pokemon
    FROM habitats h
    ${auditJoins('h', 'habitat_created_user', 'habitat_updated_user')}
    ORDER BY h.name
  `);
}

export async function getHabitat(id: number) {
  const habitat = await queryOne(
    `
      SELECT
        h.id,
        h.name,
        ${auditSelect('h', 'habitat_created_user', 'habitat_updated_user')},
        COALESCE((
          SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'quantity', hri.quantity) ORDER BY i.name)
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

  const [pokemon, editHistory] = await Promise.all([
    query(
      `
        SELECT
          p.id,
          p.name,
          hp.time_of_day,
          hp.weather,
          hp.rarity,
          json_build_object('id', m.id, 'name', m.name) AS map
        FROM habitat_pokemon hp
        JOIN pokemon p ON p.id = hp.pokemon_id
        JOIN maps m ON m.id = hp.map_id
        WHERE hp.habitat_id = $1
        ORDER BY hp.rarity, p.id, m.name
      `,
      [id]
    ),
    getEditHistory('habitats', id)
  ]);

  return { ...habitat, pokemon, editHistory };
}

function cleanHabitatPayload(payload: Record<string, unknown>): HabitatPayload {
  const appearances = Array.isArray(payload.pokemonAppearances) ? payload.pokemonAppearances : [];
  const pokemonAppearances = new Map<string, HabitatPayload['pokemonAppearances'][number]>();

  for (const item of appearances) {
    const row = item as Record<string, unknown>;
    const pokemonId = Number(row.pokemonId);
    const mapIds = cleanIdValues(row.mapIds ?? row.mapId);
    const selectedTimeOfDays = cleanOptions(row.timeOfDays ?? row.timeOfDay, timeOfDays);
    const selectedWeathers = cleanOptions(row.weathers ?? row.weather, weathers);
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
    name: cleanName(payload.name, '请输入栖息地名字'),
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

export async function createHabitat(payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanHabitatPayload(payload);

  const id = await withTransaction(async (client) => {
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO habitats (name, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $2)
        RETURNING id
      `,
      [cleanPayload.name, userId]
    );
    const habitatId = result.rows[0].id;
    await replaceHabitatRelations(client, habitatId, cleanPayload);
    await recordEditLog(client, 'habitats', habitatId, 'create', userId);
    return habitatId;
  });
  return getHabitat(id);
}

export async function updateHabitat(id: number, payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanHabitatPayload(payload);
  const before = await getHabitat(id);

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      'UPDATE habitats SET name = $1, updated_by_user_id = $2, updated_at = now() WHERE id = $3',
      [cleanPayload.name, userId, id]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await replaceHabitatRelations(client, id, cleanPayload);
    const changes = before ? await habitatEditChanges(client, before as unknown as HabitatChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'habitats', id, 'update', userId, changes);
    return true;
  });
  return updated ? getHabitat(id) : null;
}

export async function deleteHabitat(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM habitats WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await recordEditLog(client, 'habitats', id, 'delete', userId);
    return true;
  });
}

const itemProjection = `
  SELECT
    i.id,
    i.name,
    ${auditSelect('i', 'item_created_user', 'item_updated_user')},
    json_build_object('id', c.id, 'name', c.name) AS category,
    CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'name', u.name) END AS usage,
    json_build_object(
      'dyeable', i.dyeable,
      'dualDyeable', i.dual_dyeable,
      'patternEditable', i.pattern_editable
    ) AS customization,
    i.no_recipe AS "noRecipe",
    COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
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

export async function listItems(paramsQuery: QueryParams) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const categoryId = Number(asString(paramsQuery.categoryId));
  const usageId = Number(asString(paramsQuery.usageId));
  const tagIds = parseIdList(asString(paramsQuery.tagIds));
  const search = asString(paramsQuery.search)?.trim();

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`i.name ILIKE $${params.length}`);
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
  return query(`${itemProjection} ${whereClause} ORDER BY c.name, i.name`, params);
}

export async function getItem(id: number) {
  const item = await queryOne(`${itemProjection} WHERE i.id = $1`, [id]);
  if (!item) {
    return null;
  }

  const [acquisitionMethods, recipe, relatedRecipes, relatedHabitats, droppedByPokemon, editHistory] = await Promise.all([
    query(
      `
        SELECT am.id, am.name
        FROM item_acquisition_methods iam
        JOIN acquisition_methods am ON am.id = iam.acquisition_method_id
        WHERE iam.item_id = $1
        ORDER BY am.name
      `,
      [id]
    ),
    queryOne(
      `
        SELECT
          r.id,
          result_item.name,
          ${auditSelect('r', 'recipe_created_user', 'recipe_updated_user')},
          COALESCE((
            SELECT json_agg(json_build_object('id', am.id, 'name', am.name) ORDER BY am.name)
            FROM recipe_acquisition_methods ram
            JOIN acquisition_methods am ON am.id = ram.acquisition_method_id
            WHERE ram.recipe_id = r.id
          ), '[]'::json) AS acquisition_methods,
          COALESCE((
            SELECT json_agg(json_build_object('id', mi.id, 'name', mi.name, 'quantity', rm.quantity) ORDER BY mi.name)
            FROM recipe_materials rm
            JOIN items mi ON mi.id = rm.item_id
            WHERE rm.recipe_id = r.id
          ), '[]'::json) AS materials,
          json_build_object('id', result_item.id, 'name', result_item.name) AS item
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
          result_item.name,
          COALESCE((
            SELECT json_agg(json_build_object('id', mi.id, 'name', mi.name, 'quantity', recipe_material.quantity) ORDER BY mi.name)
            FROM recipe_materials recipe_material
            JOIN items mi ON mi.id = recipe_material.item_id
            WHERE recipe_material.recipe_id = r.id
          ), '[]'::json) AS materials
        FROM recipe_materials used_material
        JOIN recipes r ON r.id = used_material.recipe_id
        JOIN items result_item ON result_item.id = r.item_id
        WHERE used_material.item_id = $1
        ORDER BY result_item.name
      `,
      [id]
    ),
    query(
      `
        SELECT
          h.id,
          h.name,
          COALESCE((
            SELECT json_agg(json_build_object('id', recipe_item.id, 'name', recipe_item.name, 'quantity', recipe_item_row.quantity) ORDER BY recipe_item.name)
            FROM habitat_recipe_items recipe_item_row
            JOIN items recipe_item ON recipe_item.id = recipe_item_row.item_id
            WHERE recipe_item_row.habitat_id = h.id
          ), '[]'::json) AS recipe
        FROM habitat_recipe_items used_item
        JOIN habitats h ON h.id = used_item.habitat_id
        WHERE used_item.item_id = $1
        ORDER BY h.name
      `,
      [id]
    ),
    query(
      `
        SELECT
          json_build_object('id', p.id, 'name', p.name) AS pokemon,
          json_build_object('id', s.id, 'name', s.name) AS skill
        FROM pokemon_skill_item_drops psid
        JOIN pokemon p ON p.id = psid.pokemon_id
        JOIN skills s ON s.id = psid.skill_id
        WHERE psid.item_id = $1
          AND s.has_item_drop = true
        ORDER BY p.id, s.name
      `,
      [id]
    ),
    getEditHistory('items', id)
  ]);

  return { ...item, acquisitionMethods, recipe, relatedRecipes, relatedHabitats, droppedByPokemon, editHistory };
}

function cleanItemPayload(payload: Record<string, unknown>): ItemPayload {
  const usageId = payload.usageId === null || payload.usageId === '' || payload.usageId === undefined
    ? null
    : requirePositiveInteger(payload.usageId, '请选择用途');

  return {
    name: cleanName(payload.name, '请输入物品名字'),
    categoryId: requirePositiveInteger(payload.categoryId, '请选择分类'),
    usageId,
    dyeable: Boolean(payload.dyeable),
    dualDyeable: Boolean(payload.dualDyeable),
    patternEditable: Boolean(payload.patternEditable),
    noRecipe: Boolean(payload.noRecipe),
    acquisitionMethodIds: cleanIds(payload.acquisitionMethodIds),
    tagIds: cleanIds(payload.tagIds)
  };
}

async function ensureItemCanDisableRecipe(client: DbClient, itemId: number, noRecipe: boolean): Promise<void> {
  if (!noRecipe) {
    return;
  }

  const result = await client.query('SELECT 1 FROM recipes WHERE item_id = $1', [itemId]);
  if (result.rowCount && result.rowCount > 0) {
    throw validationError('已有材料单的物品不能设置为无材料单');
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

export async function createItem(payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanItemPayload(payload);

  const id = await withTransaction(async (client) => {
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
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
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
        userId
      ]
    );
    const itemId = result.rows[0].id;
    await replaceItemRelations(client, itemId, cleanPayload);
    await recordEditLog(client, 'items', itemId, 'create', userId);
    return itemId;
  });
  return getItem(id);
}

export async function updateItem(id: number, payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanItemPayload(payload);
  const before = await getItem(id);

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
            updated_by_user_id = $8,
            updated_at = now()
        WHERE id = $9
      `,
      [
        cleanPayload.name,
        cleanPayload.categoryId,
        cleanPayload.usageId,
        cleanPayload.dyeable,
        cleanPayload.dualDyeable,
        cleanPayload.patternEditable,
        cleanPayload.noRecipe,
        userId,
        id
      ]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await replaceItemRelations(client, id, cleanPayload);
    const changes = before ? await itemEditChanges(client, before as unknown as ItemChangeSource, cleanPayload) : [];
    await recordEditLog(client, 'items', id, 'update', userId, changes);
    return true;
  });
  return updated ? getItem(id) : null;
}

export async function deleteItem(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM items WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await recordEditLog(client, 'items', id, 'delete', userId);
    return true;
  });
}

export async function listRecipes(paramsQuery: QueryParams = {}) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const categoryId = Number(asString(paramsQuery.categoryId));

  if (Number.isInteger(categoryId) && categoryId > 0) {
    params.push(categoryId);
    conditions.push(`result_item.category_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return query(`
    SELECT
      r.id,
      result_item.name,
      ${auditSelect('r', 'recipe_created_user', 'recipe_updated_user')},
      COALESCE((
        SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'quantity', rm.quantity) ORDER BY i.name)
        FROM recipe_materials rm
        JOIN items i ON i.id = rm.item_id
        WHERE rm.recipe_id = r.id
      ), '[]'::json) AS materials
    FROM recipes r
    JOIN items result_item ON result_item.id = r.item_id
    ${auditJoins('r', 'recipe_created_user', 'recipe_updated_user')}
    ${whereClause}
    ORDER BY result_item.name
  `, params);
}

export async function getRecipe(id: number) {
  const recipe = await queryOne(
    `
      SELECT
        r.id,
        result_item.name,
        ${auditSelect('r', 'recipe_created_user', 'recipe_updated_user')},
        COALESCE((
          SELECT json_agg(json_build_object('id', am.id, 'name', am.name) ORDER BY am.name)
          FROM recipe_acquisition_methods ram
          JOIN acquisition_methods am ON am.id = ram.acquisition_method_id
          WHERE ram.recipe_id = r.id
        ), '[]'::json) AS acquisition_methods,
        COALESCE((
          SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'quantity', rm.quantity) ORDER BY i.name)
          FROM recipe_materials rm
          JOIN items i ON i.id = rm.item_id
          WHERE rm.recipe_id = r.id
        ), '[]'::json) AS materials,
        json_build_object('id', result_item.id, 'name', result_item.name) AS item
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
    itemId: requirePositiveInteger(payload.itemId, '请选择物品'),
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
    throw validationError('请选择物品');
  }

  if (result.rows[0].no_recipe) {
    throw validationError('该物品已设置为无材料单');
  }
}

export async function createRecipe(payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanRecipePayload(payload);

  const id = await withTransaction(async (client) => {
    await ensureItemCanHaveRecipe(client, cleanPayload.itemId);
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO recipes (item_id, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $2)
        RETURNING id
      `,
      [cleanPayload.itemId, userId]
    );
    const recipeId = result.rows[0].id;
    await replaceRecipeRelations(client, recipeId, cleanPayload);
    await recordEditLog(client, 'recipes', recipeId, 'create', userId);
    return recipeId;
  });
  return getRecipe(id);
}

export async function updateRecipe(id: number, payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanRecipePayload(payload);
  const before = await getRecipe(id);

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
  return updated ? getRecipe(id) : null;
}

export async function deleteRecipe(id: number, userId: number) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>('DELETE FROM recipes WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return false;
    }

    await recordEditLog(client, 'recipes', id, 'delete', userId);
    return true;
  });
}
