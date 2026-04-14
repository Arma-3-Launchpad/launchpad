import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs so opening dist/index.html via file:// (see launchpad_server/__main__.py) resolves JS/CSS correctly.
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
      // Grammars live under repo `launchpad_server/thirdparty/syntax` (imported from src).
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8111',
        changeOrigin: true,
      },
    },
  },
})
