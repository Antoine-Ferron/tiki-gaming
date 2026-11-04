import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Tests de contrat (Pact, consumer-driven) : le vrai code du front appelle un faux backend qui note chaque
// requête et la réponse attendue dans pacts/tiki-frontend-tiki-backend.json. Le backend rejoue ce contrat
// (PactProviderTest) : une API qui change de forme casse la CI avant d'atteindre le front en production.
export default defineConfig((env) =>
  mergeConfig(
    { ...viteConfig(env), test: undefined },
    defineConfig({
      test: {
        include: ['tests/contract/**/*.pact.test.ts'],
        environment: 'jsdom',
        // Un seul fichier de contrat, écrit à la fin de chaque fichier de test : pas d'écritures concurrentes.
        fileParallelism: false,
      },
    }),
  ),
)
