import { describe, expect, test } from 'vitest'
import { filterGames, parseCatalogFilter } from './catalog'

const clicker = { slug: 'clicker', category: 'solo', theme: 'action' } as const
const sudoku = { slug: 'sudoku', category: 'solo', theme: 'reflexion' } as const
const civ = { slug: 'civ', category: 'multi', theme: 'strategie' } as const
const all = [clicker, sudoku, civ]

describe('filterGames', () => {
  test('sans filtre, garde tout le catalogue dans son ordre', () => {
    expect(filterGames(all, {})).toEqual(all)
  })

  test('filtre par catégorie', () => {
    expect(filterGames(all, { category: 'solo' })).toEqual([clicker, sudoku])
  })

  test('filtre par thème', () => {
    expect(filterGames(all, { theme: 'strategie' })).toEqual([civ])
  })

  test('combine catégorie et thème', () => {
    expect(filterGames(all, { category: 'solo', theme: 'reflexion' })).toEqual([sudoku])
  })

  test('aucun jeu ne correspond : liste vide', () => {
    expect(filterGames(all, { category: 'duel' })).toEqual([])
  })
})

describe('parseCatalogFilter', () => {
  test('lit la catégorie et le thème de l’adresse', () => {
    expect(parseCatalogFilter(new URLSearchParams('categorie=multi&theme=strategie'))).toEqual({
      category: 'multi',
      theme: 'strategie',
    })
  })

  test('ignore une valeur inconnue plutôt que de vider le catalogue', () => {
    expect(parseCatalogFilter(new URLSearchParams('categorie=coop&theme=toString'))).toEqual({})
  })

  test('sans paramètre, aucun filtre', () => {
    expect(parseCatalogFilter(new URLSearchParams())).toEqual({})
  })
})
