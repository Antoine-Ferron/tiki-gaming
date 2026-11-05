import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e-real',
  testMatch: [
    'bang.spec.ts',
    'review.probe.spec.ts',
    'controle-limites.spec.ts',
    'revue-lectures.spec.ts',
    'revue-geste.spec.ts',
    'controle-premiere-defausse.spec.ts',
  ],
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: { baseURL: 'http://localhost:5198', trace: 'on', locale: 'fr-FR' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'mvn -B -ntp -DskipTests -Dspring-boot.run.main-class=fr.tikigaming.games.bang.engine.BangBrowserApplication spring-boot:test-run',
      cwd: path.resolve(import.meta.dirname, '../backend'),
      url: 'http://localhost:18080/api/auth/session',
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: 'npx vite --config vite.bang-e2e.config.ts --port 5198 --strictPort',
      url: 'http://localhost:5198',
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: 'http://localhost:5198/api/test-supabase',
        VITE_SUPABASE_ANON_KEY: 'bang-browser-anon',
      },
    },
  ],
})
