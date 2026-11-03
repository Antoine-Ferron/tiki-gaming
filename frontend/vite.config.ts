import { fileURLToPath, URL } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Le backend Java est servi sur la même origine que le front (cookie de session first-party).
const backend = { target: 'http://localhost:8080', xfwd: true }

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Tests d'intégration (Docker) et E2E : lancés par leurs propres commandes, pas par `npm test`.
  test: { exclude: [...configDefaults.exclude, 'tests/**', 'e2e/**'] },
  server: {
    proxy: {
      '/api': backend,
      '/oauth2': backend,
      '/login/oauth2': backend,
    },
  },
})
