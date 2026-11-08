import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

/** Properties written by scripts/fetch-parcels.mjs. */
export interface ParcelProps {
  parcelId: number;
  displayId: string | null;
  nhGisId: string | null;
  address: string | null;
  landUseCode: string | null;
  landUseDesc: string | null;
  neighborhood: string | null;
  map: string | null;
  lot: string | null;
  sub: string | null;
  units: number;
  unitIds: string[];
  gisAcres: number;
  labelLng: number;
  labelLat: number;
}

export type ParcelFeature = Feature<Polygon | MultiPolygon, ParcelProps>;
export type ParcelCollection = FeatureCollection<Polygon | MultiPolygon, ParcelProps> & {
  metadata: { source: string; fetchedAt: string; parcelCount: number; camaRecordCount: number };
};
