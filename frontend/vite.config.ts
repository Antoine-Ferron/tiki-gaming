import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { securityHeaders } from './security-headers.ts'

// Le backend Java est servi sur la même origine que le front (cookie de session first-party).
const backend = { target: 'http://localhost:8080', xfwd: true }

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // sockjs-client (dépendance de @stomp/stompjs pour le socle WebSocket) référence le `global` de Node ;
  // Vite ne le fournit pas au navigateur, d'où « global is not defined » à la première connexion temps réel.
  define: { global: 'globalThis' },
  // Tests d'intégration (Docker) et E2E : lancés par leurs propres commandes, pas par `npm test`.
  test: {
    exclude: [...configDefaults.exclude, 'tests/**', 'e2e/**'],
    // `npm run test:coverage` : rapport lcov lu par SonarQube (coverage/lcov.info).
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/lib/database.types.ts',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/auth/testing.tsx',
      ],
      reporter: ['text-summary', 'lcov', 'html'],
      // Seuils bloquants (CI, job frontend). Le cœur du lobby doit rester couvert ; le global, juste sous
      // l'existant, empêche les régressions : le relever quand la couverture monte, jamais le baisser.
      thresholds: {
        lines: 78,
        branches: 80,
        functions: 75,
        statements: 79,
        '{src/games/domain/**,src/games/errors.ts,src/games/scoreQueue.ts,src/games/sdk.ts,src/lib/validation.ts}': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
      },
    },
  },
  preview: {
    // Scan ZAP (quality/) : le conteneur atteint `vite preview` sous ce nom d'hôte.
    allowedHosts: ['host.docker.internal'],
    // Pas en dev : la CSP bloquerait le rechargement à chaud de Vite.
    headers: securityHeaders(loadEnv(mode, process.cwd()).VITE_SUPABASE_URL || 'https://supabase.invalid'),
  },
  server: {
    proxy: {
      '/api': backend,
      '/oauth2': backend,
      '/login/oauth2': backend,
      '/ws': { ...backend, ws: true },
    },
  },
}))
