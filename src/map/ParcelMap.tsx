import { useEffect, useRef, useState } from 'react';
import {
  Map as MLMap,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { FeatureCollection, Point } from 'geojson';
import type { Fix } from '../hooks/useGeolocation';
import { categoryColorExpression } from '../lib/landUse';
import type { ParcelCollection, ParcelProps } from '../types';

// Free, keyless basemaps: OpenFreeMap vector streets + USGS public-domain imagery.
const STREETS_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const USGS_IMAGERY =
  'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';
const JACKSON_CENTER: [number, number] = [-71.185, 44.15];
const FOLLOW_ZOOM = 16;

// MapLibre locates its worker relative to its own module URL, which breaks once
// Vite bundles it (dev pre-bundling and production alike). Point at it directly.
setWorkerUrl(workerUrl);

declare global {
  interface Window {
    /** Dev-only handle for Playwright tests (e2e/). */
    __parcelMap?: MLMap;
  }
}

export type Basemap = 'streets' | 'satellite';

interface Props {
  parcels: ParcelCollection;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  fix: Fix | null;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  basemap: Basemap;
  /** Parcel under the GPS position, for the "you are here" chip. */
  onCurrentParcel: (props: ParcelProps | null) => void;
}

function markerCollection(parcels: ParcelCollection): FeatureCollection<Point, { parcelId: number; address: string | null }> {
  return {
    type: 'FeatureCollection',
    features: parcels.features.map((f) => ({
      type: 'Feature',
      id: f.properties.parcelId,
      geometry: { type: 'Point', coordinates: [f.properties.labelLng, f.properties.labelLat] },
      properties: { parcelId: f.properties.parcelId, address: f.properties.address },
    })),
  };
}

export function ParcelMap({ parcels, selectedId, onSelect, fix, follow, onFollowChange, basemap, onCurrentParcel }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const meMarker = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  // Keep latest callbacks reachable from map event handlers bound once.
  const handlers = useRef({ onSelect, onFollowChange });
  handlers.current = { onSelect, onFollowChange };

  useEffect(() => {
    const map = new MLMap({
      container: container.current!,
      style: STREETS_STYLE,
      center: JACKSON_CENTER,
      zoom: 12.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (import.meta.env.DEV) window.__parcelMap = map;
    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'imperial' }), 'bottom-left');

    map.on('load', () => {
      map.addSource('imagery', {
        type: 'raster',
        tiles: [USGS_IMAGERY],
        tileSize: 256,
        maxzoom: 16,
        attribution: 'Imagery: USGS The National Map',
      });
      map.addLayer({ id: 'imagery', type: 'raster', source: 'imagery', layout: { visibility: 'none' } });

      map.addSource('parcels', {
        type: 'geojson',
        data: parcels,
        attribution: 'Parcels: NH GRANIT / NH DRA',
      });
      map.addSource('parcel-markers', { type: 'geojson', data: markerCollection(parcels) });

      map.addLayer({
        id: 'parcels-fill',
        type: 'fill',
        source: 'parcels',
        paint: {
          'fill-color': categoryColorExpression() as never,
          'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.45, 0.14],
        },
      });
      map.addLayer({
        id: 'parcels-line',
        type: 'line',
        source: 'parcels',
        paint: {
          'line-color': '#24352b',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 1.4],
          'line-opacity': 0.8,
        },
      });
      map.addLayer({
        id: 'parcels-selected',
        type: 'line',
        source: 'parcels',
        filter: ['==', ['id'], -1],
        paint: { 'line-color': '#ff6a00', 'line-width': 3 },
      });
      map.addLayer({
        id: 'parcel-markers',
        type: 'circle',
        source: 'parcel-markers',
        minzoom: 14,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 3.5, 17, 7],
          'circle-color': '#ffffff',
          'circle-stroke-color': '#24352b',
          'circle-stroke-width': 1.5,
        },
      });
      map.addLayer({
        id: 'parcel-labels',
        type: 'symbol',
        source: 'parcel-markers',
        minzoom: 16,
        layout: {
          'text-field': ['coalesce', ['get', 'address'], ''],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-font': ['Noto Sans Regular'],
          'text-optional': true,
        },
        paint: { 'text-color': '#1b2a21', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 },
      });

      const pick = (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.parcelId;
        if (typeof id === 'number') handlers.current.onSelect(id);
      };
      // Markers win over the polygon underneath them.
      map.on('click', 'parcel-markers', (e: MapLayerMouseEvent) => {
        e.preventDefault();
        pick(e);
      });
      map.on('click', 'parcels-fill', (e: MapLayerMouseEvent) => {
        if (!e.defaultPrevented) pick(e);
      });
      for (const layer of ['parcel-markers', 'parcels-fill']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }
      map.on('dragstart', () => handlers.current.onFollowChange(false));

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // The parcel collection is static for the life of the page.
  }, []);

  // Selection highlight.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.removeFeatureState({ source: 'parcels' });
    if (selectedId != null) map.setFeatureState({ source: 'parcels', id: selectedId }, { selected: true });
    map.setFilter('parcels-selected', ['==', ['id'], selectedId ?? -1]);
  }, [ready, selectedId]);

  // Basemap toggle: imagery sits above the vector basemap, below parcels.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const satellite = basemap === 'satellite';
    map.setLayoutProperty('imagery', 'visibility', satellite ? 'visible' : 'none');
    map.setPaintProperty('parcels-line', 'line-color', satellite ? '#fff6c2' : '#24352b');
    map.setPaintProperty('parcel-labels', 'text-color', satellite ? '#ffffff' : '#1b2a21');
    map.setPaintProperty('parcel-labels', 'text-halo-color', satellite ? '#000000' : '#ffffff');
  }, [ready, basemap]);

  // GPS marker, follow camera, and which parcel we're on.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!fix) {
      meMarker.current?.remove();
      meMarker.current = null;
      onCurrentParcel(null);
      return;
    }
    if (!meMarker.current) {
      const el = document.createElement('div');
      el.className = 'me-marker';
      el.innerHTML = '<div class="me-heading"></div><div class="me-dot"></div>';
      meMarker.current = new Marker({ element: el, rotationAlignment: 'map' })
        .setLngLat([fix.lng, fix.lat])
        .addTo(map);
    }
    meMarker.current.setLngLat([fix.lng, fix.lat]);
    const el = meMarker.current.getElement();
    el.classList.toggle('has-heading', fix.heading != null);
    if (fix.heading != null) meMarker.current.setRotation(fix.heading);

    if (follow) {
      map.easeTo({ center: [fix.lng, fix.lat], zoom: Math.max(map.getZoom(), FOLLOW_ZOOM), duration: 800 });
    }

    const hit = map.queryRenderedFeatures(map.project([fix.lng, fix.lat]), { layers: ['parcels-fill'] })[0];
    const props = hit ? parcels.features.find((f) => f.properties.parcelId === hit.properties.parcelId) : undefined;
    onCurrentParcel(props?.properties ?? null);
  }, [ready, fix, follow, parcels, onCurrentParcel]);

  return <div ref={container} className="map" />;
}
