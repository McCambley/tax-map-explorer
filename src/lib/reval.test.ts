import { describe, expect, it } from 'vitest';
import { filterRows, groupByOwner, isLandOnly, ownerType, type RevalRow } from './reval';

const row = (owner: string, acres: number, land: number, total: number, currentUse = false): RevalRow => ({
  id: 0,
  owner,
  acres,
  land,
  total,
  currentUse,
  continued: false,
});

describe('ownerType', () => {
  it.each([
    ['JACKSON, TOWN OF', 'town'],
    ['BARTLETT, TOWN OF', 'municipal'],
    ['UNITED STATES FOREST', 'federal'],
    ['68 DUNDEE, LLC', 'entity'],
    ['HORN, JOEL - TRUSTEE', 'trust'],
    ['ABBOTT, DAVID R.', 'individual'],
    ['JACKSON, MICHAEL A.', 'individual'],
    ['NEW HAMPSHIRE', 'state'],
    ['NEW HAMPSHIRE PUBLIC', 'entity'],
  ])('%s -> %s', (owner, type) => expect(ownerType(owner)).toBe(type));
});

describe('isLandOnly', () => {
  it('is true only when there is no building value', () => {
    expect(isLandOnly(row('A', 5, 100_000, 100_000))).toBe(true);
    expect(isLandOnly(row('A', 5, 100_000, 400_000))).toBe(false);
    expect(isLandOnly(row('A', 0, 37_500, 37_500))).toBe(false);
  });
});

describe('grouping and filtering', () => {
  const rows = [row('JACKSON, TOWN OF', 2, 5000, 5000), row('JACKSON, TOWN OF', 1, 10, 900), row('SMITH, JO', 1, 1, 1, true)];
  it('groups holdings per owner', () => {
    const [town] = groupByOwner(rows);
    expect(town).toMatchObject({ owner: 'JACKSON, TOWN OF', acres: 3, total: 5900 });
    expect(town.rows).toHaveLength(2);
  });
  it('filters by preset and case-insensitive owner search', () => {
    expect(filterRows(rows, 'town', '')).toHaveLength(2);
    expect(filterRows(rows, 'currentUse', '')).toHaveLength(1);
    expect(filterRows(rows, 'all', 'smith')).toHaveLength(1);
  });
});
