import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: { include: ['src/games/bang/**/*.test.{ts,tsx}'] },
  }),
)
