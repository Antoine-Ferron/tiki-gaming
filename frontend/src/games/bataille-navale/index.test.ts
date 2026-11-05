import { expect, test } from 'vitest'
import batailleNavale from './index'

test('déclare le jeu avec le slug, la catégorie et le mode attendus', () => {
  expect(batailleNavale.slug).toBe('bataille-navale')
  expect(batailleNavale.category).toBe('duel')
  expect(batailleNavale.mode).toBe('solo')
})
