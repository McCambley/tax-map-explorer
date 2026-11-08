import { describe, expect, it } from 'vitest';
import { estimateAnnualTax } from './tax';

describe('estimateAnnualTax', () => {
  it('matches the town worked example for a $500k home', () => {
    expect(estimateAnnualTax(500_000)).toBe(4305);
    expect(estimateAnnualTax(500_000, true)).toBe(5350);
  });
});
