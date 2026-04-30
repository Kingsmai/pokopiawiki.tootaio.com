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
  select: string;
  order: string;
  hasSubcategory?: boolean;
};

type IdQuantity = {
  itemId: number;
  quantity: number;
};

type PokemonPayload = {
  id: number;
  name: string;
  environmentId: number;
  skillIds: number[];
  favoriteThingIds: number[];
};

type ItemPayload = {
  name: string;
  categoryId: number;
  usageId: number | null;
  dyeable: boolean;
  dualDyeable: boolean;
  patternEditable: boolean;
  acquisitionMethodIds: number[];
  tagIds: number[];
};

type RecipePayload = {
  itemId: number;
  acquisitionMethodIds: number[];
  materials: IdQuantity[];
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

const timeOfDays = ['早晨', '中午', '傍晚', '晚上'];
const weathers = ['晴天', '阴天', '雨天'];

const configDefinitions: Record<ConfigType, ConfigDefinition> = {
  skills: { table: 'skills', select: 'id, name, subcategory', order: 'name, subcategory', hasSubcategory: true },
  environments: { table: 'environments', select: 'id, name', order: 'name' },
  'favorite-things': { table: 'favorite_things', select: 'id, name', order: 'name' },
  'item-categories': { table: 'item_categories', select: 'id, name', order: 'name' },
  'item-usages': { table: 'item_usages', select: 'id, name', order: 'name' },
  'acquisition-methods': { table: 'acquisition_methods', select: 'id, name', order: 'name' },
  maps: { table: 'maps', select: 'id, name', order: 'name' }
};

function asString(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionSelect(tableName: string): Promise<Array<{ id: number; name: string }>> {
  return query(`SELECT id, name FROM ${tableName} ORDER BY name`);
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

function configSelect(definition: ConfigDefinition): string {
  return definition.hasSubcategory ? 'c.id, c.name, c.subcategory' : 'c.id, c.name';
}

function configOrder(definition: ConfigDefinition): string {
  return definition.order
    .split(', ')
    .map((column) => `c.${column}`)
    .join(', ');
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
  userId: number
): Promise<void> {
  await client.query(
    `
      INSERT INTO wiki_edit_logs (entity_type, entity_id, action, user_id)
      VALUES ($1, $2, $3, $4)
    `,
    [entityType, entityId, action, userId]
  );
}

const pokemonProjection = `
  SELECT
    p.id,
    p.name,
    ${auditSelect('p', 'pokemon_created_user', 'pokemon_updated_user')},
    json_build_object('id', e.id, 'name', e.name) AS environment,
    COALESCE((
      SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'subcategory', s.subcategory) ORDER BY s.name, s.subcategory)
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
    query<{ id: number; name: string; subcategory: string | null }>(
      'SELECT id, name, subcategory FROM skills ORDER BY name, subcategory'
    ),
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
  const subcategory = typeof payload.subcategory === 'string' && payload.subcategory.trim() ? payload.subcategory.trim() : null;

  const id = await withTransaction(async (client) => {
    const result = definition.hasSubcategory
      ? await client.query<{ id: number }>(
          `
            INSERT INTO ${definition.table} (name, subcategory, created_by_user_id, updated_by_user_id)
            VALUES ($1, $2, $3, $3)
            RETURNING id
          `,
          [name, subcategory, userId]
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
  const subcategory = typeof payload.subcategory === 'string' && payload.subcategory.trim() ? payload.subcategory.trim() : null;

  const updated = await withTransaction(async (client) => {
    const result = definition.hasSubcategory
      ? await client.query(
          `
            UPDATE ${definition.table}
            SET name = $1, subcategory = $2, updated_by_user_id = $3, updated_at = now()
            WHERE id = $4
          `,
          [name, subcategory, userId, id]
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

  const habitats = await query(
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
  );

  return { ...pokemon, habitats };
}

function cleanPokemonPayload(payload: Record<string, unknown>): PokemonPayload {
  const skillIds = cleanIds(payload.skillIds);
  const favoriteThingIds = cleanIds(payload.favoriteThingIds);

  if (skillIds.length > 2) {
    throw validationError('特长最多选择 2 个');
  }
  if (favoriteThingIds.length > 6) {
    throw validationError('喜欢的东西最多选择 6 个');
  }

  return {
    id: requirePositiveInteger(payload.id, '请输入 Pokemon ID'),
    name: cleanName(payload.name, '请输入 Pokemon 名字'),
    environmentId: requirePositiveInteger(payload.environmentId, '请选择喜欢的环境'),
    skillIds,
    favoriteThingIds
  };
}

async function replacePokemonRelations(client: DbClient, pokemonId: number, payload: PokemonPayload): Promise<void> {
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
    await recordEditLog(client, 'pokemon', id, 'update', userId);
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

  const pokemon = await query(
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
  );

  return { ...habitat, pokemon };
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

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      'UPDATE habitats SET name = $1, updated_by_user_id = $2, updated_at = now() WHERE id = $3',
      [cleanPayload.name, userId, id]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await replaceHabitatRelations(client, id, cleanPayload);
    await recordEditLog(client, 'habitats', id, 'update', userId);
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
    COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
      FROM item_favorite_things ift
      JOIN favorite_things t ON t.id = ift.favorite_thing_id
      WHERE ift.item_id = i.id
    ), '[]'::json) AS tags
  FROM items i
  JOIN item_categories c ON c.id = i.category_id
  LEFT JOIN item_usages u ON u.id = i.usage_id
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

  const [acquisitionMethods, recipe, relatedHabitats] = await Promise.all([
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
        SELECT h.id, h.name, hri.quantity
        FROM habitat_recipe_items hri
        JOIN habitats h ON h.id = hri.habitat_id
        WHERE hri.item_id = $1
        ORDER BY h.name
      `,
      [id]
    )
  ]);

  return { ...item, acquisitionMethods, recipe, relatedHabitats };
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
    acquisitionMethodIds: cleanIds(payload.acquisitionMethodIds),
    tagIds: cleanIds(payload.tagIds)
  };
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
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING id
      `,
      [
        cleanPayload.name,
        cleanPayload.categoryId,
        cleanPayload.usageId,
        cleanPayload.dyeable,
        cleanPayload.dualDyeable,
        cleanPayload.patternEditable,
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

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE items
        SET name = $1,
            category_id = $2,
            usage_id = $3,
            dyeable = $4,
            dual_dyeable = $5,
            pattern_editable = $6,
            updated_by_user_id = $7,
            updated_at = now()
        WHERE id = $8
      `,
      [
        cleanPayload.name,
        cleanPayload.categoryId,
        cleanPayload.usageId,
        cleanPayload.dyeable,
        cleanPayload.dualDyeable,
        cleanPayload.patternEditable,
        userId,
        id
      ]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await replaceItemRelations(client, id, cleanPayload);
    await recordEditLog(client, 'items', id, 'update', userId);
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
  return queryOne(
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

async function ensureItemExists(client: DbClient, itemId: number): Promise<void> {
  const result = await client.query('SELECT 1 FROM items WHERE id = $1', [itemId]);
  if (result.rowCount === 0) {
    throw validationError('请选择物品');
  }
}

export async function createRecipe(payload: Record<string, unknown>, userId: number) {
  const cleanPayload = cleanRecipePayload(payload);

  const id = await withTransaction(async (client) => {
    await ensureItemExists(client, cleanPayload.itemId);
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

  const updated = await withTransaction(async (client) => {
    await ensureItemExists(client, cleanPayload.itemId);
    const result = await client.query(
      'UPDATE recipes SET item_id = $1, updated_by_user_id = $2, updated_at = now() WHERE id = $3',
      [cleanPayload.itemId, userId, id]
    );
    if (result.rowCount === 0) {
      return false;
    }
    await replaceRecipeRelations(client, id, cleanPayload);
    await recordEditLog(client, 'recipes', id, 'update', userId);
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
