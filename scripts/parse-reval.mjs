// Parses the town's 2024 revaluation listing (owner, acres, land value, total
// value) into public/data/reval-2024.json.
//
// The PDF is a two-column, positionally laid out report sorted by owner. It has
// NO map/lot IDs, so rows can't be reliably joined to parcels; the app uses it
// as a searchable owner index plus acreage-based *candidate* matches.
//
// Usage: npm run data:reval
import { writeFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const PDF_URL = 'https://www.jackson-nh.gov/wp-content/uploads/2025/10/town_values_2024_reval.pdf';
const OUT = new URL('../public/data/reval-2024.json', import.meta.url);

// x-positions (PDF points) of the left column; the right column is offset.
const RIGHT_COLUMN_X = 300;
const RIGHT_COLUMN_OFFSET = 288;
const HEADER_Y = 745;
const ROW_TOLERANCE = 2.5;

const num = (s) => Number(s.replace(/,/g, ''));

/** Turns positioned text items into rows of { owner, acres, land, total, currentUse }. */
export function rowsFromItems(items) {
  const cells = [];
  for (const it of items) {
    const str = it.str.trim();
    const [x, y] = [it.transform[4], it.transform[5]];
    if (!str || y >= HEADER_Y) continue;
    const right = x >= RIGHT_COLUMN_X;
    cells.push({ str, col: right ? 1 : 0, x: right ? x - RIGHT_COLUMN_OFFSET : x, y });
  }

  const rows = [];
  for (const col of [0, 1]) {
    const lines = [];
    for (const c of cells.filter((c) => c.col === col).sort((a, b) => b.y - a.y)) {
      const line = lines.find((l) => Math.abs(l.y - c.y) <= ROW_TOLERANCE);
      if (line) line.cells.push(c);
      else lines.push({ y: c.y, cells: [c] });
    }
    for (const { cells: lc } of lines.sort((a, b) => b.y - a.y)) {
      const owner = lc.filter((c) => c.x < 130).sort((a, b) => a.x - b.x).map((c) => c.str).join(' ').trim();
      const pick = (lo, hi) => lc.find((c) => c.x >= lo && c.x < hi && /^[\d,.]+$/.test(c.str))?.str;
      const acres = pick(130, 185);
      const land = pick(185, 224);
      const total = pick(240, 300);
      if (acres == null || land == null || total == null) continue;
      rows.push({
        owner: owner || null,
        acres: num(acres),
        land: num(land),
        total: num(total),
        currentUse: lc.some((c) => c.str === 'cu' && c.x >= 222 && c.x < 240),
      });
    }
  }
  return rows;
}

/** Rows without an owner are additional parcels of the owner above. */
export function fillOwners(rows) {
  let last = null;
  return rows.map((r) => {
    if (r.owner) last = r.owner;
    return { ...r, owner: r.owner ?? last, continued: !r.owner };
  });
}

async function main() {
  const res = await fetch(PDF_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${PDF_URL}`);
  const doc = await getDocument({ data: new Uint8Array(await res.arrayBuffer()), verbosity: 0 }).promise;
  const raw = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    raw.push(...rowsFromItems((await page.getTextContent()).items));
  }
  const rows = fillOwners(raw).map((r, i) => ({ id: i, ...r }));
  const out = {
    metadata: {
      source: PDF_URL,
      title: 'Jackson Values 12/11/2024 (2024 revaluation)',
      fetchedAt: new Date().toISOString(),
      rowCount: rows.length,
      totalValue: rows.reduce((s, r) => s + r.total, 0),
    },
    rows,
  };
  await writeFile(OUT, JSON.stringify(out));
  console.log(`Wrote ${rows.length} rows from ${doc.numPages} pages to ${OUT.pathname}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
