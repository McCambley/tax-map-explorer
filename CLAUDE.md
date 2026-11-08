# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A mobile-first web map of Jackson, NH tax parcels for the Jackson Housing Commission. The user drives around town, sees their GPS position over parcel outlines, and taps a parcel to see land use, size, ownership, assessed value, and taxes. The goal is spotting housing opportunities: underused or abandoned developments, cheap land or homes, and town-owned (possibly landlocked) land.

Roles: Claude writes all the code. The user is the product owner and reviews every change, so keep diffs focused and explain data-source caveats.

## Commands

- `npm run dev` starts the Vite dev server on desktop.
- `npm run dev:phone` serves over HTTPS on the LAN (self-signed cert). Phones only allow GPS on secure origins, so use this to test on a phone.
- `npm run build` runs the typecheck and a production build into `dist/`.
- `npm run typecheck` runs `tsc -b` only.
- `npm test` runs the Vitest unit tests (`src/**/*.test.ts`). Run a single file with `npx vitest run src/lib/tax.test.ts`, or a single test with `-t "<name>"`.
- `npm run test:e2e` runs the Playwright browser tests in `e2e/` against a dev server on port 5199, under a phone project and a desktop project. Run a single one with `npx playwright test -g "GPS" --project=phone`.
- `npm run data:parcels` re-downloads parcel data into `public/data/parcels.geojson`.
- `npm run data:reval` re-parses the town's revaluation PDF into `public/data/reval-2024.json`.

## Verifying changes

Run `npm run typecheck`, `npm test` and `npm run test:e2e`. Then look at the PNGs the e2e tests write to `e2e/screenshots/` (`<project>-<name>.png`, gitignored); reading them is how to check UI changes visually.
- In dev builds the map is exposed as `window.__parcelMap`. Tests use it to wait for `idle`, move the camera, and `project()` lng/lat to pixels for clicks.
- GPS is faked with `context.setGeolocation`.
- Headless Chromium renders WebGL with SwiftShader (launch args in `playwright.config.ts`).

## Architecture

The app is static, with no backend. All data is fetched ahead of time by Node scripts in `scripts/` and committed as static files under `public/data/`. The React app fetches those files at runtime.

**Data pipeline (`scripts/fetch-parcels.mjs`).** Parcels come from the NH GRANIT statewide Parcel Mosaic ArcGIS FeatureServer, maintained by NH DRA:
- Layer 1 has the polygons. Filter on `town='JACKSON'`, which is uppercase.
- Table 3 has the CAMA attributes. Filter on `townname='Jackson'`, which is mixed case.

The script joins the two on `parceloid` and pages through results (the service returns at most 2,000 records per request). It also computes geodesic acreage (`gisAcres`) and a label point (`labelLng`/`labelLat`), then writes a single GeoJSON file. The feature `id` is set to `parceloid`, and the map's feature-state selection depends on that. Condos have several CAMA records on one polygon, kept in `units`/`unitIds`. The property shape is `ParcelProps` in `src/types.ts`, and it must stay in sync with the script.

**Gaps in that data.** GRANIT has no owner names or assessed values. The town's assessing data is hosted by Avitar Associates: anonymous users get limited fields, and full property cards need a subscription. The town's 2024 revaluation PDF lists owner, acres, land value and total value, but it has no map/lot IDs. The proper fix is a CAMA export from the town, which would include map/lot. Any new assessing data source should be added as another script that writes into `public/data/` and is joined on the map/lot/sub IDs.

**Owner index (`scripts/parse-reval.mjs` → `src/lib/reval.ts`, `src/components/OwnersPanel.tsx`).** The revaluation PDF is parsed by text position using pdfjs-dist. The layout is two columns; the right column is offset 288pt, and each field sits in a fixed x-range. A row with no owner continues the owner above it. To check the parser, compare the number of rows per page with the number of cells in the "total" column. Matching rows to parcels by acreage was tested and found too ambiguous (about 1,500 of 1,593 parcels have several candidates), so the owner index stays a separate searchable list and is not joined to the map.

**Map (`src/map/ParcelMap.tsx`).** MapLibre GL v6 has no default export, so use named imports. It finds its web worker relative to its own module URL, which breaks once Vite bundles it, so the code calls `setWorkerUrl` with a `?url` import of `maplibre-gl-worker.mjs`. Don't remove that: without it the map never loads, in dev or in production. The map is created once on mount. Everything after that (selection, basemap, GPS) updates the existing map in `useEffect`s gated on `ready`; the style is never rebuilt. Map event handlers read the latest React callbacks through a ref.
- **Basemaps:** both are free and need no API key. OpenFreeMap vector "liberty" is the base style. USGS imagery is a raster layer layered above it and toggled with `visibility`; it isn't a style swap, because swapping would drop the custom layers. Text layers must use the style's fonts ("Noto Sans Regular/Bold/Italic").
- **Clicking:** each parcel has a clickable white marker at its label point (zoom ≥ 14), which takes priority over the polygon fill (`preventDefault`/`defaultPrevented`).
- **Land-use colors:** `src/lib/landUse.ts` maps NH DRA land-use codes (`sluc`) to housing-relevant categories and builds the MapLibre `match` color expression.

**GPS.** `src/hooks/useGeolocation.ts` wraps `watchPosition`. While follow mode is on, the camera follows the user; dragging the map turns follow off, and a Recenter button turns it back on. The map works out which parcel the user is standing on with `queryRenderedFeatures` and shows it as the "You're on" chip.

**Taxes.** Rates are in `src/lib/tax.ts` (2025: $8.61 per $1,000, plus $2.09 inside the water precinct). Update them each year when the DRA sets a new rate.
