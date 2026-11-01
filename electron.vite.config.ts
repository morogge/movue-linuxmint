import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const root = resolve(__dirname);

export default defineConfig({
  // Laufzeit-Abhängigkeiten (z. B. better-sqlite3 mit nativem Modul) nicht einbündeln
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve(root, 'src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve(root, 'src/shared') } }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve(root, 'src/shared') } },
    plugins: [react()],
    // Hilfe-Seiten (help/) und CHANGELOG.md liegen außerhalb von src/renderer
    server: { fs: { allow: [root] } }
  }
});
