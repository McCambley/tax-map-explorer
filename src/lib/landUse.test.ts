import { describe, expect, it } from 'vitest';
import { landUseCategory, landUseLabel } from './landUse';

describe('landUse', () => {
  it('treats residential land codes as vacant', () => {
    expect(landUseCategory('22')).toBe('vacant');
  });
  it('falls back for unknown or missing codes', () => {
    expect(landUseCategory(null)).toBe('other');
    expect(landUseLabel('99', 'From CAMA')).toBe('From CAMA');
  });
});
