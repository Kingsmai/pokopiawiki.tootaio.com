import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseIdList, parseMatchMode, sqlForRelationFilter } from '../src/filter.ts';

describe('filter helpers', () => {
  it('parses comma separated ids and drops invalid values', () => {
    assert.deepEqual(parseIdList('1, 2, x, -1, 3'), [1, 2, 3]);
  });

  it('defaults match mode to any', () => {
    assert.equal(parseMatchMode('all'), 'all');
    assert.equal(parseMatchMode('anything'), 'any');
    assert.equal(parseMatchMode(undefined), 'any');
  });

  it('builds relation filters with bound array parameters', () => {
    const params: unknown[] = [];
    const sql = sqlForRelationFilter(
      [1, 2],
      'all',
      'pokemon_skills',
      'pokemon_id',
      'skill_id',
      'p.id',
      params
    );

    assert.equal(params.length, 1);
    assert.deepEqual(params[0], [1, 2]);
    assert.match(sql, /count\(DISTINCT skill_id\)/);
    assert.match(sql, /= 2/);
  });
});
