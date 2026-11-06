// Mutation testing du seul Sudoku : npx stryker run stryker.sudoku.config.mjs
// Rapport HTML dans reports/mutation/sudoku.html. Même seuil bloquant (75 %) que stryker.config.mjs.
import base from './stryker.config.mjs'

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  ...base,
  mutate: ['src/games/sudoku/logic.ts', 'src/games/sudoku/mistakes.ts'],
  // Seuls les tests du Sudoku sont rejoués : plus rapide, et indépendant des autres jeux.
  vitest: { dir: 'src/games/sudoku' },
  htmlReporter: { fileName: 'reports/mutation/sudoku.html' },
}
