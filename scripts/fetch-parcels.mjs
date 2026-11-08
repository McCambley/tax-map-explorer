// Downloads Jackson, NH parcel polygons + CAMA attributes from the NH GRANIT
// statewide Parcel Mosaic (maintained by NH DRA) and writes a single GeoJSON
// file the app loads at runtime: public/data/parcels.geojson
//
// Usage: npm run data:parcels
import { writeFile } from 'node:fs/promises';
import area from '@turf/area';
import pointOnFeature from '@turf/point-on-feature';

const SERVICE =
  'https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer';
const PARCELS_LAYER = 1;
const CAMA_TABLE = 3;
const PAGE_SIZE = 1000; // service max is 2000
const SQ_M_PER_ACRE = 4046.8564224;
const OUT = new URL('../public/data/parcels.geojson', import.meta.url);

async function queryAll(layer, where, extra = {}) {
  const features = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      where,
      outFields: '*',
      orderByFields: 'objectid',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: 'json',
      ...extra,
    });
    const res = await fetch(`${SERVICE}/${layer}/query`, { method: 'POST', body: params });
    if (!res.ok) throw new Error(`Layer ${layer}: HTTP ${res.status}`);
    const page = await res.json();
    if (page.error) throw new Error(`Layer ${layer}: ${page.error.message}`);
    features.push(...page.features);
    if (!page.exceededTransferLimit && page.features.length < PAGE_SIZE) return features;
  }
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const roundCoords = (c) => (typeof c[0] === 'number' ? c.map(round6) : c.map(roundCoords));
const clean = (v) => (typeof v === 'string' ? v.trim() || null : v ?? null);

const [parcels, cama] = await Promise.all([
  queryAll(PARCELS_LAYER, "town='JACKSON'", { outSR: '4326', f: 'geojson' }),
  queryAll(CAMA_TABLE, "townname='Jackson'"),
]);

const camaByParcel = new Map();
for (const { attributes: a } of cama) {
  if (!camaByParcel.has(a.parceloid)) camaByParcel.set(a.parceloid, []);
  camaByParcel.get(a.parceloid).push(a);
}

const features = parcels
  .filter((f) => f.geometry)
  .map((f) => {
    const p = f.properties;
    const records = camaByParcel.get(p.parceloid) ?? [];
    const primary = records[0] ?? {};
    const geometry = { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) };
    const label = pointOnFeature({ type: 'Feature', geometry, properties: {} }).geometry.coordinates;
    return {
      type: 'Feature',
      id: p.parceloid,
      geometry,
      properties: {
        parcelId: p.parceloid,
        displayId: clean(p.displayid),
        nhGisId: clean(p.nh_gis_id),
        address: clean(p.streetaddress),
        landUseCode: clean(p.sluc),
        landUseDesc: clean(primary.sluc_desc),
        neighborhood: clean(p.localnbc),
        map: clean(primary.map),
        lot: clean(primary.lot),
        sub: clean(primary.sub),
        // Condos/units share one polygon; keep every CAMA record on it.
        units: records.length,
        unitIds: records.map((r) => r.displayid).filter(Boolean),
        gisAcres: Math.round((area(geometry) / SQ_M_PER_ACRE) * 100) / 100,
        labelLng: round6(label[0]),
        labelLat: round6(label[1]),
      },
    };
  });

const out = {
  type: 'FeatureCollection',
  metadata: {
    source: `${SERVICE} (NH GRANIT Parcel Mosaic, NH DRA)`,
    fetchedAt: new Date().toISOString(),
    parcelCount: features.length,
    camaRecordCount: cama.length,
  },
  features,
};
await writeFile(OUT, JSON.stringify(out));
console.log(`Wrote ${features.length} parcels (${cama.length} CAMA records) to ${OUT.pathname}`);
