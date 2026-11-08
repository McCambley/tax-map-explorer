import { useCallback, useEffect, useMemo, useState } from 'react';
import { OwnersPanel } from './components/OwnersPanel';
import { ParcelPanel } from './components/ParcelPanel';
import { useGeolocation } from './hooks/useGeolocation';
import { CATEGORY_COLORS, CATEGORY_LABELS, type LandUseCategory } from './lib/landUse';
import type { RevalData } from './lib/reval';
import { ParcelMap, type Basemap } from './map/ParcelMap';
import type { ParcelCollection, ParcelProps } from './types';

export function App() {
  const [parcels, setParcels] = useState<ParcelCollection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [gpsOn, setGpsOn] = useState(false);
  const [follow, setFollow] = useState(true);
  const [basemap, setBasemap] = useState<Basemap>('streets');
  const [current, setCurrent] = useState<ParcelProps | null>(null);
  const [reval, setReval] = useState<RevalData | null>(null);
  const [ownersOpen, setOwnersOpen] = useState(false);
  const geo = useGeolocation(gpsOn);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/parcels.geojson`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setParcels)
      .catch((e: Error) => setLoadError(`Could not load parcels: ${e.message}`));
    // Optional: the owner index degrades to a hidden button if it fails.
    fetch(`${import.meta.env.BASE_URL}data/reval-2024.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setReval)
      .catch(() => setReval(null));
  }, []);

  const byId = useMemo(
    () => new Map(parcels?.features.map((f) => [f.properties.parcelId, f.properties]) ?? []),
    [parcels],
  );
  const selected = selectedId != null ? byId.get(selectedId) ?? null : null;
  const fix = geo.status === 'tracking' ? geo.fix : null;
  const onCurrentParcel = useCallback((p: ParcelProps | null) => setCurrent(p), []);

  // One side panel at a time.
  const selectParcel = (id: number | null) => {
    setSelectedId(id);
    if (id != null) setOwnersOpen(false);
  };
  const openOwners = () => {
    setSelectedId(null);
    setOwnersOpen(true);
  };

  const toggleGps = () => {
    setGpsOn((on) => !on);
    setFollow(true);
  };

  if (loadError) return <div className="splash">{loadError}</div>;
  if (!parcels) return <div className="splash">Loading Jackson parcels…</div>;

  return (
    <div className="app">
      <ParcelMap
        parcels={parcels}
        selectedId={selectedId}
        onSelect={selectParcel}
        fix={fix}
        follow={gpsOn && follow}
        onFollowChange={setFollow}
        basemap={basemap}
        onCurrentParcel={onCurrentParcel}
      />

      <div className="toolbar">
        <button className={gpsOn ? 'on' : ''} onClick={toggleGps}>
          {gpsOn ? 'GPS on' : 'Start GPS'}
        </button>
        {gpsOn && !follow && <button onClick={() => setFollow(true)}>Recenter</button>}
        <button onClick={() => setBasemap((b) => (b === 'streets' ? 'satellite' : 'streets'))}>
          {basemap === 'streets' ? 'Satellite' : 'Streets'}
        </button>
        {reval && (
          <button className={ownersOpen ? 'on' : ''} onClick={() => (ownersOpen ? setOwnersOpen(false) : openOwners())}>
            Owners
          </button>
        )}
      </div>

      {geo.status === 'locating' && <div className="status">Finding your location…</div>}
      {geo.status === 'error' && <div className="status error">{geo.message}</div>}
      {current && !selected && !ownersOpen && (
        <button className="status here" onClick={() => selectParcel(current.parcelId)}>
          You're on: <strong>{current.address ?? current.displayId}</strong> ›
        </button>
      )}

      {!selected && !ownersOpen && (
        <details className="legend" open={window.matchMedia('(min-width: 760px)').matches}>
          <summary>Legend</summary>
          <ul aria-label="Land use legend">
            {(Object.keys(CATEGORY_LABELS) as LandUseCategory[]).map((c) => (
              <li key={c}>
                <span style={{ background: CATEGORY_COLORS[c] }} />
                {CATEGORY_LABELS[c]}
              </li>
            ))}
          </ul>
        </details>
      )}

      {selected && (
        <ParcelPanel parcel={selected} onClose={() => setSelectedId(null)} onOpenOwners={reval ? openOwners : undefined} />
      )}
      {ownersOpen && reval && <OwnersPanel data={reval} onClose={() => setOwnersOpen(false)} />}
    </div>
  );
}
