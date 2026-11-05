// Mutation testing (Stryker) : altère le code du cœur et vérifie que les tests le remarquent.
// npm run test:mutation — rapport HTML dans reports/mutation/mutation.html
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: [
    'src/games/tic-tac-toe/domain/**/*.ts',
    'src/games/domain/**/*.ts',
    // Rush Hour : le domaine pur et le calcul du glissé. Les niveaux et la réserve du générateur sont des données.
    'src/games/rush-hour/domain/*.ts',
    '!src/games/rush-hour/domain/{levels,generatorLayouts}.ts',
    'src/games/rush-hour/components/drag.ts',
    // MiniGTA : sauvegarde et score, session de la plateforme, missions, balistique et niveau de recherche.
    'src/games/mini-gta/domain/*.ts',
    'src/games/mini-gta/state/session.ts',
    'src/games/mini-gta/systems/missions/runner.ts',
    'src/games/mini-gta/systems/ballistics.ts',
    'src/games/mini-gta/systems/Wanted.ts',
    'src/games/errors.ts',
    'src/games/scoreQueue.ts',
    'src/games/sdk.ts',
    'src/lib/validation.ts',
    '!src/**/*.test.ts',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  // Le build échoue sous 75 % de mutants tués (exigence du cœur de la feature).
  thresholds: { high: 90, low: 80, break: 75 },
}
