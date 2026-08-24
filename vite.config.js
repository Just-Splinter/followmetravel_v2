import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // expose OPENROUTER_API_KEY from .env to the client (dashboard translation
  // calls run in-browser) alongside the standard VITE_ variables
  envPrefix: ['VITE_', 'OPENROUTER_'],
  test: {
    environment: 'node',
    globals: false,
    // pdfIngest.test.js uses node:test (run: node --test src/services/pdfIngest.test.js)
    exclude: [...configDefaults.exclude, '**/pdfIngest.test.js'],
  },
})