import { useMemo, useState } from 'react';
import {
  FILTER_LABELS,
  OWNER_TYPE_LABELS,
  filterRows,
  groupByOwner,
  isLandOnly,
  type RevalData,
  type RevalFilter,
} from '../lib/reval';
import { estimateAnnualTax } from '../lib/tax';

interface Props {
  data: RevalData;
  onClose: () => void;
}

type Sort = 'value' | 'acres' | 'name';
const MAX_OWNERS = 150;

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const acres = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac`;

export function OwnersPanel({ data, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RevalFilter>('all');
  const [sort, setSort] = useState<Sort>('value');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => filterRows(data.rows, filter, query), [data, filter, query]);
  const owners = useMemo(() => {
    const groups = groupByOwner(rows);
    const cmp = {
      value: (a: (typeof groups)[0], b: (typeof groups)[0]) => b.total - a.total,
      acres: (a: (typeof groups)[0], b: (typeof groups)[0]) => b.acres - a.acres,
      name: (a: (typeof groups)[0], b: (typeof groups)[0]) => a.owner.localeCompare(b.owner),
    }[sort];
    return groups.sort(cmp);
  }, [rows, sort]);
  const totals = useMemo(
    () => rows.reduce((t, r) => ({ acres: t.acres + r.acres, value: t.value + r.total }), { acres: 0, value: 0 }),
    [rows],
  );

  return (
    <aside className="panel owners" aria-label="Owner index">
      <header>
        <div>
          <h2>Owner index</h2>
          <p className="muted">2024 revaluation listing · not linked to map parcels</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <input
        className="search"
        type="search"
        placeholder="Search owner (e.g. TOWN OF, LLC, SMITH)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search owners"
      />
      <div className="filters" role="group" aria-label="Filters">
        {(Object.keys(FILTER_LABELS) as RevalFilter[]).map((f) => (
          <button key={f} className={`pill ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="summary">
        <span data-testid="owners-summary">
          {owners.length.toLocaleString()} {owners.length === 1 ? 'owner' : 'owners'} · {rows.length.toLocaleString()}{' '}
          {rows.length === 1 ? 'holding' : 'holdings'} · {acres(totals.acres)} · {usd(totals.value)}
        </span>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="value">By value</option>
          <option value="acres">By acres</option>
          <option value="name">By name</option>
        </select>
      </div>

      <ul className="owner-list">
        {owners.slice(0, MAX_OWNERS).map((o) => (
          <li key={o.owner}>
            <button className="owner-row" onClick={() => setOpen(open === o.owner ? null : o.owner)} aria-expanded={open === o.owner}>
              <span className="owner-name">
                {o.owner}
                <small>{OWNER_TYPE_LABELS[o.type]}</small>
              </span>
              <span className="owner-nums">
                {o.rows.length > 1 && <small>{o.rows.length} holdings</small>}
                {acres(o.acres)}
                <strong>{usd(o.total)}</strong>
              </span>
            </button>
            {open === o.owner && (
              <table className="holdings">
                <thead>
                  <tr>
                    <th>Acres</th>
                    <th>Land</th>
                    <th>Total</th>
                    <th>Est. tax</th>
                  </tr>
                </thead>
                <tbody>
                  {[...o.rows].sort((a, b) => b.total - a.total).map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.acres.toLocaleString()}
                        {r.currentUse && <span className="tag" title="Current Use: assessed at use value, not market value">CU</span>}
                        {isLandOnly(r) && <span className="tag land" title="No building value">land</span>}
                      </td>
                      <td>{usd(r.land)}</td>
                      <td>{usd(r.total)}</td>
                      <td>{usd(estimateAnnualTax(r.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </li>
        ))}
      </ul>
      {owners.length > MAX_OWNERS && <p className="muted">Showing the first {MAX_OWNERS}. Refine the search to see more.</p>}
      <p className="muted fine">
        Source: <a href={data.metadata.source} target="_blank" rel="noreferrer">{data.metadata.title}</a>. Owner names
        are truncated in the original. Est. tax uses the 2025 rate without the water precinct or exemptions.
      </p>
    </aside>
  );
}
