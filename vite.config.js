import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Identifiant du build : publié dans /version.json et compilé dans l'appli
// (src/services/appVersion.js) pour que les onglets restés sur une ancienne
// version se mettent à jour d'eux-mêmes.
const BUILD_ID = Date.now().toString(36)

const versionFile = {
  name: 'fmt-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID, date: new Date().toISOString() }) })
  },
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    versionFile,
  ],
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
  },
  // expose OPENROUTER_API_KEY from .env to the client (dashboard translation
  // calls run in-browser) alongside the standard VITE_ variables
  envPrefix: ['VITE_', 'OPENROUTER_'],
  test: {
    environment: 'node',
    globals: false,
    // pdfIngest.test.js uses node:test (run: node --test src/services/pdfIngest.test.js)
    // api/ has its own vitest config (cd api && npm test)
    exclude: [...configDefaults.exclude, '**/pdfIngest.test.js', 'api/**'],
  },
})