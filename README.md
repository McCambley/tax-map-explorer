# Jackson Tax Map Explorer

A mobile map of Jackson, NH tax parcels for the Jackson Housing Commission. Drive around town, see your position over parcel boundaries, and tap a parcel for its details.

## Run it

```sh
npm install
npm run dev          # desktop: http://localhost:5173
npm run dev:phone    # phone on the same Wi-Fi: open the https Network URL, accept the cert warning, allow location
```

## Data

- **Parcels:** [NH GRANIT Parcel Mosaic](https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer) (NH DRA). Refresh with `npm run data:parcels`.
- **Tax rate:** [Jackson 2025 property tax info](https://www.jackson-nh.gov/wp-content/uploads/2026/01/property_tax_rate_info_2025.pdf).
- **Basemaps:** [OpenFreeMap](https://openfreemap.org) and USGS The National Map imagery.

Parcel boundaries are GIS approximations, not surveys. Ownership and assessed values aren't loaded yet.
