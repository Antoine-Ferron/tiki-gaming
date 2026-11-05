import existing from './playwright.bang-real.config.ts'
import { defineConfig } from '@playwright/test'
export default defineConfig({ ...existing, testMatch: 'controle-limites.spec.ts', outputDir: 'test-results-controle' })
