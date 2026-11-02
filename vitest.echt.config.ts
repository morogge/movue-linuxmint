import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Test gegen die echte Filmliste vom Server – nur in der Action „Echtdaten“, nicht bei npm test
export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: {
    include: [process.env.ECHT_NUR ?? 'tests/echt/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15 * 60 * 1000
  }
});
