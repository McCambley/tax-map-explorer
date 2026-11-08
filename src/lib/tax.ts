// Jackson 2025 tax rates, $ per $1,000 of assessed value
// (source: jackson-nh.gov property_tax_rate_info_2025.pdf).
export const TAX_YEAR = 2025;
export const TAX_RATE = 8.61;
export const WATER_PRECINCT_RATE = 2.09;

export function estimateAnnualTax(assessedValue: number, inWaterPrecinct = false): number {
  const rate = TAX_RATE + (inWaterPrecinct ? WATER_PRECINCT_RATE : 0);
  return Math.round((assessedValue / 1000) * rate);
}
