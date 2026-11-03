import { describe, expect, test } from 'vitest'
import { gameAccess, type AccessInput } from './access'

const base: AccessInput = { gameExists: true, mode: 'solo', authLoading: false, loggedIn: false, profileLoaded: false }

// Table de décision : chaque ligne est une combinaison de conditions et l'action attendue.
describe('gameAccess', () => {
  test.each<[string, Partial<AccessInput>, ReturnType<typeof gameAccess>]>([
    ['jeu inconnu', { gameExists: false }, 'not-found'],
    ['jeu inconnu, même pendant le chargement', { gameExists: false, authLoading: true }, 'not-found'],
    ['session en cours de chargement', { authLoading: true }, 'loading'],
    ['connecté, profil pas encore chargé', { loggedIn: true }, 'loading'],
    ['solo, invité', {}, 'guest'],
    ['solo, connecté avec profil', { loggedIn: true, profileLoaded: true }, 'player'],
    ['compte requis, invité', { mode: 'multiplayer' }, 'login'],
    ['compte requis, chargement', { mode: 'multiplayer', authLoading: true }, 'loading'],
    ['compte requis, connecté avec profil', { mode: 'multiplayer', loggedIn: true, profileLoaded: true }, 'player'],
    ['compte requis, connecté sans profil', { mode: 'multiplayer', loggedIn: true }, 'loading'],
  ])('%s → %s', (_, input, expected) => {
    expect(gameAccess({ ...base, ...input })).toBe(expected)
  })
})
