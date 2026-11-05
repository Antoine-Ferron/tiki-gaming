import existing from './playwright.bang-real.config.ts'
import { defineConfig } from '@playwright/test'
export default defineConfig({ ...existing, testMatch: 'review.probe.spec.ts', outputDir: 'test-results-revue' })
