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

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const status = () => document.querySelector('.sdv-civilisation-status')!.textContent
const city = () => screen.getByRole('region', { name: 'Ta civilisation' })
const journal = (turn: string) => {
  click('Journal')
  return within(screen.getByRole('list', { name: turn })).getAllByRole('listitem')
}

function renderBoard() {
  const alice = { id: 'p1', username: 'alice' }
  const ctx = createGameContext(sdvCivilisation, alice, fakeDeps({ scores: new FakeScores(alice) }))
  render(<SdvCivilisationBoard ctx={ctx} shuffler={identityShuffler} tempo="off" />)
  return ctx
}

// Fake : scores en mémoire. Stub : le mélangeur garde l'ordre (main de départ connue, IA 1 verre, IA 2 bois).
function setup() {
  const ctx = renderBoard()
  click('Choisir Temple d’Ysar')
  return ctx
}

describe('SdvCivilisationGame', () => {
  it('fait choisir la merveille, puis montre les voisins, la civilisation du joueur et sa main', () => {
    setup()

    const left = screen.getByRole('region', { name: 'Voisin de gauche : IA 2' })
    const right = screen.getByRole('region', { name: 'Voisin de droite : IA 1' })
    expect(within(left).getByRole('img', { name: 'Produit 1 bois' })).toBeTruthy()
    expect(within(right).getByRole('img', { name: 'Produit 1 verre' })).toBeTruthy()
    expect(within(city()).getByRole('img', { name: 'Produit 1 minerai' })).toBeTruthy()
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(7)
    click('Journal')
    expect(screen.getByText('Les actions de chaque tour s’afficheront ici.')).toBeTruthy()
  })

  it('détaille ce qui manque pour construire une carte', () => {
    setup()

    click(/^Bains/)

    expect(screen.getByRole('button', { name: /^Bains .*Ressources manquantes$/ })).toBeTruthy()
    const build = screen.getByRole('button', { name: /^Construire Bains/ })
    expect(build.hasAttribute('disabled')).toBe(true)
    expect(build.textContent).toContain('1 pierre manquant')
    expect(within(city()).getByText('manque 1')).toBeTruthy()
  })

  it('met en évidence la ressource achetée au voisin et construit la carte', () => {
    setup()

    click(/^Palissade/)
    expect(screen.getByRole('button', { name: /^Construire Palissade/ }).textContent).toContain('1 bois acheté à IA 2')
    const left = screen.getByRole('region', { name: 'Voisin de gauche : IA 2' })
    expect(left.querySelector('.sdv-civilisation-token-used')).toBeTruthy()
    click(/^Construire Palissade/)

    expect(within(city()).getByRole('listitem', { name: 'Palissade : 1 bouclier' })).toBeTruthy()
    expect(status()).toBe('Âge I · Tour 2 / 6Les mains passent ← vers la gauche')
  })

  it('construit en achetant au voisin de droite et l’écrit au journal', () => {
    setup()

    click(/^Atelier/)
    expect(screen.getByRole('button', { name: /^Construire Atelier/ }).textContent).toContain('1 verre acheté à IA 1')
    click(/^Construire Atelier/)

    expect(within(city()).getByRole('listitem', { name: 'roue : 1' })).toBeTruthy()
    expect(within(city()).getByText(/[-−]2/)).toBeTruthy()
    const turn = journal('Âge I, tour 1')
    expect(turn).toHaveLength(3)
    expect(turn[0].textContent).toBe('Tu as construit Atelier −2 pièces')
  })

  it('bâtit une étape de merveille avec la carte choisie', () => {
    setup()

    click(/^Bains/)
    expect(screen.getByRole('button', { name: /^Bâtir l’étape 1/ }).textContent).toContain('1 minerai : tu le produis')
    click(/^Bâtir l’étape 1 de ta merveille/)

    expect(within(city()).getByRole('listitem', { name: /^Étape 1 \(bâtie\)/ })).toBeTruthy()
    expect(journal('Âge I, tour 1')[0].textContent).toBe('Tu as bâti une étape de merveille avec Bains')
  })

  it('ouvre la cité d’un voisin', () => {
    setup()

    click(/^Chantier/)
    click(/^Construire Chantier/)
    click('Voir la cité de IA 1')

    const dialog = screen.getByRole('dialog', { name: 'Cité de IA 1' })
    expect(within(dialog).getByRole('list', { name: 'Bâtiments de IA 1' })).toBeTruthy()
    click('Fermer')
    click('Voir la cité de IA 2')
    expect(screen.getByRole('dialog', { name: 'Cité de IA 2' })).toBeTruthy()
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
    click('Journal')
    expect(screen.getAllByText('Conflits :')).toHaveLength(3)
    click('Fermer')
    click('Rejouer')
    click('Choisir Phare de Sélène')
    expect(status()).toBe('Âge I · Tour 1 / 6Les mains passent ← vers la gauche')
    playToTheEnd()

    expect(await screen.findByText('alice', { selector: '.name' })).toBeTruthy()
    expect(submitScore).toHaveBeenCalledTimes(2)
  })

  it('affiche les règles, avant comme pendant la partie, et les referme avec Échap ou le bouton', () => {
    renderBoard()

    click('Règles')
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: 'Règles du jeu' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    click('Choisir Temple d’Ysar')
    click('Règles')
    click('Fermer')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('chargé depuis le catalogue, laisse l’invité choisir sa merveille et affiche une erreur de classement', async () => {
    const scores = new FakeScores()
    scores.leaderboard = () => Promise.reject(new GameError('network', 'Classement indisponible.'))
    const Game = sdvCivilisation.component
    render(
      <Suspense>
        <Game ctx={createGameContext(sdvCivilisation, null, fakeDeps({ scores }))} />
      </Suspense>,
    )

    expect(await screen.findByText('Classement indisponible.')).toBeTruthy()
    click('Choisir Jardins de Mirah')
    expect(city().textContent).toContain('Jardins de Mirah')
  })

  it('entre et sort du plein écran', () => {
    // jsdom n'implémente pas l'API Fullscreen : on la simule.
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
    const requestFullscreen = vi.fn(() => Promise.resolve())
    const exitFullscreen = vi.fn(() => Promise.resolve())
    HTMLElement.prototype.requestFullscreen = requestFullscreen
    document.exitFullscreen = exitFullscreen
    // Au lancement de la partie, la page défile jusqu'au plateau (absent de jsdom : on le simule ici).
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    setup()
    expect(scrollIntoView).toHaveBeenCalledOnce()

    click('Plein écran')
    const board = document.querySelector('.sdv-civilisation')
    Object.defineProperty(document, 'fullscreenElement', { value: board, configurable: true })
    fireEvent(document, new Event('fullscreenchange'))
    click('Quitter le plein écran')

    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(exitFullscreen).toHaveBeenCalledOnce()
  })
})
