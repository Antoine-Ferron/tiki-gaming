// @vitest-environment jsdom
import { Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GameError } from '@/games/errors'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import sdvCivilisation from '..'
import { SdvCivilisationBoard } from '../SdvCivilisationGame'
import { identityShuffler } from './fakes'

afterEach(cleanup)

// Fake : scores en mémoire. Stub : le mélangeur garde l'ordre du catalogue (main de départ connue).
function setup() {
  const alice = { id: 'p1', username: 'alice' }
  const ctx = createGameContext(sdvCivilisation, alice, fakeDeps({ scores: new FakeScores(alice) }))
  render(<SdvCivilisationBoard ctx={ctx} shuffler={identityShuffler} />)
  return ctx
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const status = () => document.querySelector('.sdv-civilisation-status')!.textContent

describe('SdvCivilisationGame', () => {
  it('assoit le joueur autour de la table avec deux IA et lui montre sa main', () => {
    setup()

    const seats = within(screen.getByRole('list', { name: 'Table de jeu' })).getAllByRole('listitem')
    expect(seats.map((seat) => seat.getAttribute('aria-label'))).toEqual([
      'alice (toi), 3 pièces, voisin de gauche IA 2, voisin de droite IA 1',
      'IA 1, 3 pièces, voisin de gauche alice, voisin de droite IA 2',
      'IA 2, 3 pièces, voisin de gauche IA 1, voisin de droite alice',
    ])
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(7)
  })

  it('explique pourquoi une carte ne peut pas être construite', () => {
    setup()

    click(/^Bains/)

    // Le motif est annoncé sur la carte elle-même (court) et sur le bouton d'action (complet).
    expect(screen.getByRole('button', { name: /^Bains .*Ressources manquantes$/ })).toBeTruthy()
    const build = screen.getByRole('button', { name: /^Construire Bains/ })
    expect(build.hasAttribute('disabled')).toBe(true)
    expect(build.textContent).toContain('Il te manque des ressources.')
  })

  it('construit la carte choisie pendant que les IA jouent', () => {
    setup()

    click(/^Chantier/)
    click(/^Construire Chantier/)

    const turn = within(screen.getByRole('list', { name: 'Âge I, tour 1' })).getAllByRole('listitem')
    expect(turn).toHaveLength(3)
    expect(turn[0].textContent).toBe('Tu as construit Chantier')
    expect(status()).toBe('Âge I · Tour 2 / 6')
  })

  it('bâtit une étape de merveille avec la carte choisie', () => {
    setup()

    click(/^Bains/)
    click(/^Bâtir l’étape 1 de ta merveille/)

    expect(screen.getByText('(bâtie)')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Âge I, tour 1' })).getAllByRole('listitem')[0].textContent).toBe(
      'Tu as bâti une étape de merveille avec Bains',
    )
  })

  it('envoie le score à chaque fin de partie et affiche un échec d’envoi', async () => {
    const ctx = setup()
    // Mock : le premier envoi échoue, le second passe par le vrai SDK (et ses scores en mémoire).
    const submitScore = vi
      .spyOn(ctx, 'submitScore')
      .mockRejectedValueOnce(new GameError('network', 'Envoi impossible.'))
    const playToTheEnd = () => {
      while (!screen.queryByText('Fin de partie')) {
        // Les cartes de la main sont les seuls boutons à bascule (aria-pressed).
        fireEvent.click(screen.getAllByRole('button', { pressed: false })[0])
        click(/^Défausser/)
      }
    }

    playToTheEnd()
    expect(await screen.findByText('Envoi impossible.')).toBeTruthy()
    click('Rejouer')
    expect(status()).toBe('Âge I · Tour 1 / 6')
    playToTheEnd()

    expect(await screen.findByText('alice', { selector: '.name' })).toBeTruthy()
    expect(submitScore).toHaveBeenCalledTimes(2)
  })

  it('affiche les règles et les referme avec Échap ou le bouton', () => {
    setup()

    click('Règles du jeu')
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: 'Règles du jeu' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    click('Règles du jeu')
    click('Fermer')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('chargé depuis le catalogue, assoit l’invité sous le nom « Toi » et affiche une erreur de classement', async () => {
    const scores = new FakeScores()
    scores.leaderboard = () => Promise.reject(new GameError('network', 'Classement indisponible.'))
    const Game = sdvCivilisation.component
    render(
      <Suspense>
        <Game ctx={createGameContext(sdvCivilisation, null, fakeDeps({ scores }))} />
      </Suspense>,
    )

    expect(await screen.findByText('Classement indisponible.')).toBeTruthy()
    expect(screen.getByText('Toi')).toBeTruthy()
  })

  it('entre et sort du plein écran', () => {
    // jsdom n'implémente pas l'API Fullscreen : on la simule.
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
    const requestFullscreen = vi.fn(() => Promise.resolve())
    const exitFullscreen = vi.fn(() => Promise.resolve())
    HTMLElement.prototype.requestFullscreen = requestFullscreen
    document.exitFullscreen = exitFullscreen
    setup()

    click('Plein écran')
    const board = document.querySelector('.sdv-civilisation')
    Object.defineProperty(document, 'fullscreenElement', { value: board, configurable: true })
    fireEvent(document, new Event('fullscreenchange'))
    click('Quitter le plein écran')

    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(exitFullscreen).toHaveBeenCalledOnce()
  })
})
