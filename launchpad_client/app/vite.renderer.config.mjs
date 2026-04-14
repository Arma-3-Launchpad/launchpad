import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.resolve(__dirname, '../renderer');
const launchpadClientRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  root: rendererRoot,
  base: './',
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
  ],
  server: {
    fs: {
      allow: [launchpadClientRoot, repoRoot],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8111',
        changeOrigin: true,
      },
    },
  },
});
