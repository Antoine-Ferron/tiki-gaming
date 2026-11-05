import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    server: { proxy: { '/api': { target: 'http://localhost:18080', xfwd: true } } },
  }),
)
