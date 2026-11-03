import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Tests d'intégration : vraie base PostgreSQL (image Supabase de prod) dans un conteneur éphémère,
// démarré une seule fois pour toute la suite (globalSetup), migrations du dépôt rejouées sur base vide.
// La config de `npm test` exclut tests/** : on repart de la config Vite sans sa section test.
export default mergeConfig(
  { ...viteConfig, test: undefined },
  defineConfig({
    test: {
      include: ['tests/integration/**/*.test.ts'],
      globalSetup: ['tests/integration/globalSetup.ts'],
      hookTimeout: 180_000,
      testTimeout: 30_000,
      // Une seule base partagée : les fichiers passent l'un après l'autre, chaque test dans sa transaction.
      fileParallelism: false,
    },
  }),
)
