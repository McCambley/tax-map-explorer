/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:phone` serves over HTTPS on the LAN: phone browsers only
// expose GPS (navigator.geolocation) to secure origins.
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the site from /tax-map-explorer/ (set in the deploy workflow).
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  test: { include: ['src/**/*.test.ts'] },
}));
