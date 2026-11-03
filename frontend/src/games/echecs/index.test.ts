import { expect, test } from 'vitest'
import echecs from './index'

test('déclare le jeu avec le slug, la catégorie et le mode attendus', () => {
  expect(echecs.slug).toBe('echecs')
  expect(echecs.category).toBe('duel')
  expect(echecs.mode).toBe('solo')
})

test("n'a pas de limite de score (aucun score envoyé en V1)", () => {
  expect(echecs.scoreLimits).toBeUndefined()
})
