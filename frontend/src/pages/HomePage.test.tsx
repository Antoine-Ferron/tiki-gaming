// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { playerProfile, renderPage } from '@/auth/testing'
import { games } from '@/games/registry'
import HomePage from './HomePage'

afterEach(cleanup)

const titles = () => screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent)
const chip = (group: string, name: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('button', { name })

describe('HomePage', () => {
  test('salue le joueur connecté et affiche tout le catalogue', () => {
    renderPage(<HomePage />, { auth: { profile: playerProfile } })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Salut joueur_42 👋')
    expect(titles()).toEqual(games.map((g) => g.title))
    expect(chip('Catégorie', 'Tous').getAttribute('aria-pressed')).toBe('true')
  })

  test('applique les filtres présents dans l’adresse', () => {
    renderPage(<HomePage />, { url: '/?categorie=multi&theme=strategie', route: '/' })

    expect(titles()).toEqual(['SDV Civilisation'])
    expect(chip('Thème', 'Stratégie').getAttribute('aria-pressed')).toBe('true')
  })

  test('choisir un thème filtre la liste, « Tous » la rétablit', () => {
    renderPage(<HomePage />)

    fireEvent.click(chip('Thème', 'Réflexion'))
    expect(titles()).toEqual(['Rush Hour', 'Mastermind', 'Sudoku'])

    fireEvent.click(chip('Thème', 'Tous'))
    expect(titles()).toHaveLength(games.length)
  })

  test('aucun jeu ne correspond : le dit plutôt que d’afficher une grille vide', () => {
    // Aucun jeu de duel n'est classé « action » (les échecs, premier jeu de duel, sont en « stratégie »).
    renderPage(<HomePage />, { url: '/?categorie=duel&theme=action', route: '/' })

    expect(titles()).toEqual([])
    expect(screen.getByRole('status').textContent).toBe('Aucun jeu ne correspond à ces filtres.')
  })
})
