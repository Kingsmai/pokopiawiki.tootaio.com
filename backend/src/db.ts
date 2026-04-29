import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;
type QueryResultRow = pg.QueryResultRow;

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://pokopia:pokopia@localhost:5432/pokopia';

export const pool = new Pool({
  connectionString: databaseUrl
});

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function initializeDatabase(): Promise<void> {
  const dbDir = path.join(process.cwd(), 'db');
  const schema = await readFile(path.join(dbDir, 'schema.sql'), 'utf8');
  const seed = await readFile(path.join(dbDir, 'seed.sql'), 'utf8');

  await pool.query(schema);
  await pool.query(seed);
}
