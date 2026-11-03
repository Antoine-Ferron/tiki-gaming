import { defineConfig, devices } from '@playwright/test'

// Tests E2E : parcours du lobby dans un vrai navigateur. Le backend Java et Supabase sont simulés par
// interception réseau (e2e/fixtures.ts) : les tests sont déterministes et ne touchent aucune vraie donnée.
const PORT = 5199

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', locale: 'fr-FR' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    // Les variables déjà définies priment sur frontend/.env : le front parle à un Supabase fictif.
    env: { VITE_SUPABASE_URL: 'https://supabase.e2e.test', VITE_SUPABASE_ANON_KEY: 'e2e-anon-key' },
  },
})
