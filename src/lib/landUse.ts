// NH DRA state land-use codes (sluc) as they appear in Jackson's CAMA data,
// grouped into a few categories that matter for housing work.
export type LandUseCategory = 'residential' | 'multifamily' | 'vacant' | 'commercial' | 'other';

const CODES: Record<string, { label: string; category: LandUseCategory }> = {
  '11': { label: 'Single Family Home', category: 'residential' },
  '12': { label: 'Multi Family 2-4 Units', category: 'multifamily' },
  '14': { label: 'Single Res Condo Unit', category: 'residential' },
  '17': { label: 'Mfg Housing With Land', category: 'residential' },
  '19': { label: 'Unclassified Improved Residential', category: 'residential' },
  '20': { label: 'Residential Building Only', category: 'residential' },
  '22': { label: 'Residential Land', category: 'vacant' },
  '26': { label: 'Mixed Use Commercial/Industrial Land', category: 'vacant' },
  '27': { label: 'Unclassified Land', category: 'vacant' },
  '33': { label: 'Commercial Land & Building', category: 'commercial' },
  '44': { label: 'Commercial Condo', category: 'commercial' },
  '57': { label: 'Unclassified Other', category: 'other' },
  '58': { label: 'Garage/Storage Unit', category: 'other' },
  '60': { label: 'Other', category: 'other' },
};

export const CATEGORY_COLORS: Record<LandUseCategory, string> = {
  residential: '#4f7cac',
  multifamily: '#8a5cb8',
  vacant: '#d9a521',
  commercial: '#c4553b',
  other: '#7d8a80',
};

export const CATEGORY_LABELS: Record<LandUseCategory, string> = {
  residential: 'Residential',
  multifamily: 'Multi-family',
  vacant: 'Vacant land',
  commercial: 'Commercial',
  other: 'Other / unknown',
};

export function landUseCategory(code: string | null): LandUseCategory {
  return (code && CODES[code]?.category) || 'other';
}

export function landUseLabel(code: string | null, fallback?: string | null): string {
  return (code && CODES[code]?.label) || fallback || 'Unknown';
}

/** MapLibre `match` expression coloring parcels by land-use category. */
export function categoryColorExpression(): unknown[] {
  const expr: unknown[] = ['match', ['get', 'landUseCode']];
  for (const [code, { category }] of Object.entries(CODES)) expr.push(code, CATEGORY_COLORS[category]);
  expr.push(CATEGORY_COLORS.other);
  return expr;
}
