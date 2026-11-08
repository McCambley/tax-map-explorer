import { CATEGORY_COLORS, CATEGORY_LABELS, landUseCategory, landUseLabel } from '../lib/landUse';
import type { ParcelProps } from '../types';

interface Props {
  parcel: ParcelProps;
  onClose: () => void;
  onOpenOwners?: () => void;
}

const JACKSON_TAX_MAPS = 'https://www.jackson-nh.gov/departments/assessing/tax-maps/';
const AVITAR_KIOSK = 'https://data.avitarassociates.com/logon.aspx';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ParcelPanel({ parcel: p, onClose, onOpenOwners }: Props) {
  const category = landUseCategory(p.landUseCode);
  const mapLot = [p.map, p.lot?.replace(/^0+/, '')].filter(Boolean).join('-');
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.labelLat},${p.labelLng}`;

  return (
    <aside className="panel" aria-label="Parcel details">
      <header>
        <div>
          <h2>{p.address ?? 'No street address'}</h2>
          <span className="chip" style={{ background: CATEGORY_COLORS[category] }}>
            {CATEGORY_LABELS[category]}
          </span>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <dl>
        <Row label="Map / Lot" value={mapLot || null} />
        <Row label="Parcel ID" value={p.displayId} />
        <Row label="Land use" value={`${landUseLabel(p.landUseCode, p.landUseDesc)}${p.landUseCode ? ` (${p.landUseCode})` : ''}`} />
        <Row label="Area (GIS)" value={`${p.gisAcres.toLocaleString()} acres`} />
        <Row label="Neighborhood" value={p.neighborhood} />
        <Row label="Units on parcel" value={p.units > 1 ? `${p.units} (${p.unitIds.join(', ')})` : null} />
      </dl>

      <section className="pending">
        <h3>Ownership, assessed value &amp; taxes</h3>
        <p>
          Not linked to this parcel yet. The town's 2024 revaluation list has owners and values but no map/lot
          numbers, so it can't be matched to parcels reliably.
        </p>
        {onOpenOwners && (
          <button className="link-btn" onClick={onOpenOwners}>
            Search the owner index ›
          </button>
        )}
      </section>

      <footer>
        <a href={navUrl} target="_blank" rel="noreferrer">Directions</a>
        <a href={AVITAR_KIOSK} target="_blank" rel="noreferrer">Avitar assessing kiosk</a>
        <a href={JACKSON_TAX_MAPS} target="_blank" rel="noreferrer">Town tax maps</a>
      </footer>
    </aside>
  );
}
