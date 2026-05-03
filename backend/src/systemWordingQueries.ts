import { defaultLocale, systemWordingCatalogEntries, systemWordingFallback, type SystemWordingTree } from '../../system-wordings.ts';
import { pool, query } from './db.ts';

type SystemWordingSurface = 'frontend' | 'backend' | 'email';
type SystemWordingValueRow = {
  key: string;
  module: string;
  surface: SystemWordingSurface;
  description: string;
  placeholders: unknown;
  value: string;
  defaultValue: string;
  missing: boolean;
  updatedAt: Date | null;
  updatedBy: { id: number; displayName: string } | null;
};
type ValidationError = Error & { statusCode: number };

const localePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
const wordingKeyPattern = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/;
const placeholderPattern = /\{([A-Za-z0-9_]+)\}/g;
const surfaces = new Set<SystemWordingSurface>(['frontend', 'backend', 'email']);

function validationError(message: string): ValidationError {
  const error = new Error(message) as ValidationError;
  error.statusCode = 400;
  return error;
}

function cleanLocale(value: unknown): string {
  const locale = typeof value === 'string' ? value.trim() : '';
  return localePattern.test(locale) ? locale : defaultLocale;
}

function requireLocale(value: unknown): string {
  const locale = typeof value === 'string' ? value.trim() : '';
  if (!localePattern.test(locale)) {
    throw validationError('server.wordings.localeRequired');
  }
  return locale;
}

function requireWordingKey(value: unknown): string {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!wordingKeyPattern.test(key)) {
    throw validationError('server.wordings.keyNotFound');
  }
  return key;
}

function cleanSurface(value: unknown): SystemWordingSurface | '' {
  const surface = typeof value === 'string' ? value.trim() : '';
  return surfaces.has(surface as SystemWordingSurface) ? (surface as SystemWordingSurface) : '';
}

function collectPlaceholders(value: string): string[] {
  return [...new Set([...value.matchAll(placeholderPattern)].map((match) => match[1]))].sort();
}

function placeholdersMatch(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((placeholder, index) => placeholder === second[index]);
}

function interpolate(message: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce(
    (nextMessage, [key, value]) => nextMessage.replaceAll(`{${key}}`, String(value)),
    message
  );
}

function setNestedMessage(target: SystemWordingTree, key: string, value: string): void {
  const parts = key.split('.');
  let node = target;

  for (const part of parts.slice(0, -1)) {
    const current = node[part];
    if (typeof current !== 'object' || current === null) {
      node[part] = {};
    }
    node = node[part] as SystemWordingTree;
  }

  node[parts[parts.length - 1]] = value;
}

function nestedMessages(rows: Array<{ key: string; value: string }>): SystemWordingTree {
  const messages: SystemWordingTree = {};
  for (const row of rows) {
    setNestedMessage(messages, row.key, row.value);
  }
  return messages;
}

function normalizePlaceholders(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).sort() : [];
}

export async function syncSystemWordingCatalog(): Promise<void> {
  const entries = systemWordingCatalogEntries();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const entry of entries) {
      await client.query(
        `
          INSERT INTO system_wording_keys (key, module, surface, description, placeholders)
          VALUES ($1, $2, $3, $4, $5::jsonb)
          ON CONFLICT (key) DO UPDATE
          SET module = EXCLUDED.module,
              surface = EXCLUDED.surface,
              description = EXCLUDED.description,
              placeholders = EXCLUDED.placeholders,
              updated_at = now()
        `,
        [entry.key, entry.module, entry.surface, entry.description, JSON.stringify(entry.placeholders)]
      );

      for (const [locale, value] of Object.entries(entry.values)) {
        await client.query(
          `
            INSERT INTO system_wording_values (key, locale, value)
            VALUES ($1, $2, $3)
            ON CONFLICT (key, locale) DO NOTHING
          `,
          [entry.key, locale, value]
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function systemMessage(
  locale: string,
  key: string,
  params: Record<string, string | number> = {}
): Promise<string> {
  const requestedLocale = cleanLocale(locale);

  try {
    const result = await pool.query<{ value: string }>(
      `
        SELECT COALESCE(requested.value, fallback.value) AS value
        FROM system_wording_keys k
        LEFT JOIN system_wording_values requested
          ON requested.key = k.key
          AND requested.locale = $2
        LEFT JOIN system_wording_values fallback
          ON fallback.key = k.key
          AND fallback.locale = $3
        WHERE k.key = $1
      `,
      [key, requestedLocale, defaultLocale]
    );
    const message = result.rows[0]?.value ?? systemWordingFallback(key, requestedLocale) ?? key;
    return interpolate(message, params);
  } catch {
    return interpolate(systemWordingFallback(key, requestedLocale) ?? key, params);
  }
}

export async function localizedStatusMessage(locale: string, message: string): Promise<string> {
  return message.startsWith('server.') || message.startsWith('email.') ? systemMessage(locale, message) : message;
}

export async function getSystemWordings(locale: string) {
  const requestedLocale = cleanLocale(locale);
  const rows = await query<{ key: string; value: string; missing: boolean }>(
    `
      SELECT
        k.key,
        COALESCE(requested.value, fallback.value, '') AS value,
        ($1 <> $2 AND requested.value IS NULL) AS missing
      FROM system_wording_keys k
      LEFT JOIN system_wording_values requested
        ON requested.key = k.key
        AND requested.locale = $1
      LEFT JOIN system_wording_values fallback
        ON fallback.key = k.key
        AND fallback.locale = $2
      WHERE k.enabled = true
      ORDER BY k.key
    `,
    [requestedLocale, defaultLocale]
  );

  return {
    locale: requestedLocale,
    fallbackLocale: defaultLocale,
    messages: nestedMessages(rows),
    missingKeys: rows.filter((row) => row.missing).map((row) => row.key)
  };
}

export async function listSystemWordingRows(filters: Record<string, unknown>) {
  const locale = cleanLocale(filters.locale);
  const module = typeof filters.module === 'string' ? filters.module.trim() : '';
  const surface = cleanSurface(filters.surface);
  const missingOnly = filters.missing === 'true' || filters.missing === true;

  return query<SystemWordingValueRow>(
    `
      SELECT
        k.key,
        k.module,
        k.surface,
        k.description,
        k.placeholders,
        COALESCE(requested.value, '') AS value,
        COALESCE(fallback.value, '') AS "defaultValue",
        ($1 <> $2 AND requested.value IS NULL) AS missing,
        requested.updated_at AS "updatedAt",
        CASE
          WHEN updated_user.id IS NULL THEN NULL
          ELSE json_build_object('id', updated_user.id, 'displayName', updated_user.display_name)
        END AS "updatedBy"
      FROM system_wording_keys k
      LEFT JOIN system_wording_values requested
        ON requested.key = k.key
        AND requested.locale = $1
      LEFT JOIN system_wording_values fallback
        ON fallback.key = k.key
        AND fallback.locale = $2
      LEFT JOIN users updated_user ON updated_user.id = requested.updated_by_user_id
      WHERE k.enabled = true
        AND ($3 = '' OR k.module = $3)
        AND ($4 = '' OR k.surface = $4)
        AND ($5 = false OR ($1 <> $2 AND requested.value IS NULL))
      ORDER BY k.module, k.key
    `,
    [locale, defaultLocale, module, surface, missingOnly]
  );
}

export async function updateSystemWordingValue(keyValue: string, payload: Record<string, unknown>, userId: number) {
  const key = requireWordingKey(keyValue);
  const locale = requireLocale(payload.locale);
  const value = typeof payload.value === 'string' ? payload.value.trim() : '';

  const keyRow = await pool.query<{ placeholders: unknown }>('SELECT placeholders FROM system_wording_keys WHERE key = $1', [key]);
  const placeholders = normalizePlaceholders(keyRow.rows[0]?.placeholders);
  if (keyRow.rowCount === 0) {
    throw validationError('server.wordings.keyNotFound');
  }

  if (locale === defaultLocale && value === '') {
    throw validationError('server.wordings.valueRequired');
  }

  if (value !== '' && !placeholdersMatch(placeholders, collectPlaceholders(value))) {
    throw validationError('server.wordings.placeholderMismatch');
  }

  const result = await pool.query<{ code: string }>('SELECT code FROM languages WHERE code = $1', [locale]);
  if (result.rowCount === 0) {
    throw validationError('server.wordings.localeRequired');
  }

  if (value === '') {
    await pool.query('DELETE FROM system_wording_values WHERE key = $1 AND locale = $2', [key, locale]);
  } else {
    await pool.query(
      `
        INSERT INTO system_wording_values (key, locale, value, created_by_user_id, updated_by_user_id)
        VALUES ($1, $2, $3, $4, $4)
        ON CONFLICT (key, locale) DO UPDATE
        SET value = EXCLUDED.value,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_at = now()
      `,
      [key, locale, value, userId]
    );
  }

  return listSystemWordingRows({ locale });
}
