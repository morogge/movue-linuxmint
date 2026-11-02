import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Baut das Metadaten-Paket aus Wikidata – nur in der Action „Metadaten“, nicht bei npm test
export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: {
    include: ['scripts/metadaten/baue.ts'],
    environment: 'node',
    testTimeout: 120 * 60 * 1000
  }
});
