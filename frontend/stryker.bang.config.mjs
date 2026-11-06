import shared from './stryker.config.mjs'

/** Mesure BANG! seule ; mêmes mutateurs et seuils que la campagne commune. */
export default {
  ...shared,
  mutate: ['src/games/bang/OnlineTable.tsx', 'src/games/bang/local.ts'],
  vitest: { configFile: 'vitest.bang-mutation.config.ts' },
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/bang/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/bang/mutation.json' },
  concurrency: 4,
}
