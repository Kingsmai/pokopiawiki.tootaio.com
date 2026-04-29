export type MatchMode = 'any' | 'all';

export function parseIdList(value: unknown): number[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function parseMatchMode(value: unknown): MatchMode {
  return value === 'all' ? 'all' : 'any';
}

export function sqlForRelationFilter(
  ids: number[],
  mode: MatchMode,
  relationTable: string,
  ownerColumn: string,
  targetColumn: string,
  ownerExpression: string,
  params: unknown[]
): string {
  if (ids.length === 0) {
    return '';
  }

  params.push(ids);
  const paramIndex = params.length;

  if (mode === 'all') {
    return `(
      SELECT count(DISTINCT ${targetColumn})
      FROM ${relationTable}
      WHERE ${ownerColumn} = ${ownerExpression}
        AND ${targetColumn} = ANY($${paramIndex}::int[])
    ) = ${ids.length}`;
  }

  return `EXISTS (
    SELECT 1
    FROM ${relationTable}
    WHERE ${ownerColumn} = ${ownerExpression}
      AND ${targetColumn} = ANY($${paramIndex}::int[])
  )`;
}
