// Mutation testing (Stryker) : altère le code du cœur et vérifie que les tests le remarquent.
// npm run test:mutation — rapport HTML dans reports/mutation/mutation.html
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: [
    'src/games/domain/**/*.ts',
    'src/games/errors.ts',
    'src/games/scoreQueue.ts',
    'src/games/sdk.ts',
    'src/lib/validation.ts',
    'src/games/lemur/domain/**/*.ts',
    '!src/**/*.test.ts',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  // Le build échoue sous 75 % de mutants tués (exigence du cœur de la feature).
  thresholds: { high: 90, low: 80, break: 75 },
}
