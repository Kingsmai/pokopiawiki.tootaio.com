import { parseIdList, parseMatchMode, sqlForRelationFilter } from './filter.ts';
import { query, queryOne } from './db.ts';

type QueryValue = string | string[] | undefined;

type QueryParams = Record<string, QueryValue>;

function asString(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionSelect(tableName: string): Promise<Array<{ id: number; name: string }>> {
  return query(`SELECT id, name FROM ${tableName} ORDER BY name`);
}

const pokemonProjection = `
  SELECT
    p.id,
    p.name,
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
`;

export async function getOptions() {
  const [skills, environments, favoriteThings, itemCategories, itemUsages, itemTags] = await Promise.all([
    query<{ id: number; name: string; subcategory: string | null }>(
      'SELECT id, name, subcategory FROM skills ORDER BY name, subcategory'
    ),
    optionSelect('environments'),
    optionSelect('favorite_things'),
    optionSelect('item_categories'),
    optionSelect('item_usages'),
    optionSelect('item_tags')
  ]);

  return {
    skills,
    environments,
    favoriteThings,
    itemCategories,
    itemUsages,
    itemTags
  };
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

export async function listHabitats() {
  return query(`
    SELECT
      h.id,
      h.name,
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
    ORDER BY h.name
  `);
}

export async function getHabitat(id: number) {
  const habitat = await queryOne(
    `
      SELECT
        h.id,
        h.name,
        COALESCE((
          SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'quantity', hri.quantity) ORDER BY i.name)
          FROM habitat_recipe_items hri
          JOIN items i ON i.id = hri.item_id
          WHERE hri.habitat_id = h.id
        ), '[]'::json) AS recipe
      FROM habitats h
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

const itemProjection = `
  SELECT
    i.id,
    i.name,
    json_build_object('id', c.id, 'name', c.name) AS category,
    json_build_object('id', u.id, 'name', u.name) AS usage,
    json_build_object(
      'dyeable', i.dyeable,
      'dualDyeable', i.dual_dyeable,
      'patternEditable', i.pattern_editable
    ) AS customization,
    COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
      FROM item_item_tags iit
      JOIN item_tags t ON t.id = iit.item_tag_id
      WHERE iit.item_id = i.id
    ), '[]'::json) AS tags
  FROM items i
  JOIN item_categories c ON c.id = i.category_id
  JOIN item_usages u ON u.id = i.usage_id
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
    'item_item_tags',
    'item_id',
    'item_tag_id',
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
          r.name,
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
          ), '[]'::json) AS materials
        FROM items i
        JOIN recipes r ON r.id = i.recipe_id
        WHERE i.id = $1
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

export async function listRecipes() {
  return query(`
    SELECT
      r.id,
      r.name,
      COALESCE((
        SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'quantity', rm.quantity) ORDER BY i.name)
        FROM recipe_materials rm
        JOIN items i ON i.id = rm.item_id
        WHERE rm.recipe_id = r.id
      ), '[]'::json) AS materials
    FROM recipes r
    ORDER BY r.name
  `);
}

export async function getRecipe(id: number) {
  return queryOne(
    `
      SELECT
        r.id,
        r.name,
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
        ), '[]'::json) AS materials
      FROM recipes r
      WHERE r.id = $1
    `,
    [id]
  );
}
