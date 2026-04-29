import { describe, expect, it } from 'vitest';
import { buildQuery } from './api';

describe('buildQuery', () => {
  it('keeps business filters and drops empty values', () => {
    expect(buildQuery({ search: '妙蛙', environmentId: 1, skillIds: '', usageId: undefined })).toBe(
      '?search=%E5%A6%99%E8%9B%99&environmentId=1'
    );
  });
});
