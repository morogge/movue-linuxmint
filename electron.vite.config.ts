import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

const root = resolve(__dirname);

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': resolve(root, 'src/shared') } }
  },
  preload: {
    resolve: { alias: { '@shared': resolve(root, 'src/shared') } }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve(root, 'src/shared') } },
    plugins: [react()],
    // Hilfe-Seiten (help/) und CHANGELOG.md liegen außerhalb von src/renderer
    server: { fs: { allow: [root] } }
  }
});
