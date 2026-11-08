// The town's 2024 revaluation listing (scripts/parse-reval.mjs). It has no
// map/lot IDs, so it is an owner index, not parcel data.

export interface RevalRow {
  id: number;
  owner: string;
  acres: number;
  land: number;
  total: number;
  /** Enrolled in NH Current Use (assessed at use value, not market value). */
  currentUse: boolean;
  continued: boolean;
}

export interface RevalData {
  metadata: { source: string; title: string; fetchedAt: string; rowCount: number; totalValue: number };
  rows: RevalRow[];
}

export type OwnerType = 'town' | 'federal' | 'state' | 'municipal' | 'entity' | 'trust' | 'individual';

export const OWNER_TYPE_LABELS: Record<OwnerType, string> = {
  town: 'Town of Jackson',
  federal: 'Federal',
  state: 'State',
  municipal: 'Other town',
  entity: 'Company / org',
  trust: 'Trust',
  individual: 'Individual',
};

export function ownerType(owner: string): OwnerType {
  const o = owner.toUpperCase();
  if (o === 'JACKSON, TOWN OF') return 'town';
  if (/^UNITED STATES\b/.test(o)) return 'federal';
  // The PDF truncates long names; the State of NH appears as just "NEW HAMPSHIRE".
  if (/^(STATE OF\b|NEW HAMPSHIRE$)/.test(o)) return 'state';
  if (/, TOWN OF$/.test(o)) return 'municipal';
  if (/\bTRUST(EE)?S?\b/.test(o)) return 'trust';
  // Owner names are "LAST, FIRST", so a comma usually means a person, but
  // "DUNDEE, LLC"-style names are companies.
  if (/\b(LLC|L\.L\.C|INC|CORP|CO|COMPANY|ASSOC|ASSOCIATION|CLUB|CHURCH|LP|LTD|PARTNERS|SOCIETY|CONDO|FOREST|PRECINCT|TOURING|VALLEY|CONSERVATION|FOUNDATION)\b/.test(o)) {
    return 'entity';
  }
  return o.includes(',') ? 'individual' : 'entity';
}

/** No building value: land-only (vacant, or building assessed elsewhere). */
export const isLandOnly = (r: RevalRow) => r.total > 0 && r.total === r.land && r.acres > 0;

export interface OwnerSummary {
  owner: string;
  type: OwnerType;
  rows: RevalRow[];
  acres: number;
  total: number;
}

export function groupByOwner(rows: RevalRow[]): OwnerSummary[] {
  const map = new Map<string, OwnerSummary>();
  for (const r of rows) {
    let s = map.get(r.owner);
    if (!s) map.set(r.owner, (s = { owner: r.owner, type: ownerType(r.owner), rows: [], acres: 0, total: 0 }));
    s.rows.push(r);
    s.acres += r.acres;
    s.total += r.total;
  }
  return [...map.values()];
}

export type RevalFilter = 'all' | 'town' | 'federal' | 'landOnly' | 'currentUse';

export const FILTER_LABELS: Record<RevalFilter, string> = {
  all: 'All',
  town: 'Town-owned',
  federal: 'Federal',
  landOnly: 'No buildings',
  currentUse: 'Current use',
};

export function filterRows(rows: RevalRow[], filter: RevalFilter, query: string): RevalRow[] {
  const q = query.trim().toUpperCase();
  return rows.filter((r) => {
    if (q && !r.owner.toUpperCase().includes(q)) return false;
    switch (filter) {
      case 'town':
        return ownerType(r.owner) === 'town';
      case 'federal':
        return ownerType(r.owner) === 'federal';
      case 'landOnly':
        return isLandOnly(r);
      case 'currentUse':
        return r.currentUse;
      default:
        return true;
    }
  });
}
