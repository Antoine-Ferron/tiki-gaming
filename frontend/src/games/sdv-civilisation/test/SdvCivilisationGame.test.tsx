// @vitest-environment jsdom
import { Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GameError } from '@/games/errors'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import { ApiError } from '@/lib/api'
import sdvCivilisation from '..'
import type { GameView } from '../game'
import { TurnConflict } from '../ports'
import { SdvCivilisationBoard } from '../SdvCivilisationGame'
import { contract, FakeGameServer } from './fakes'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const status = () => document.querySelector('.sdv-civilisation-status')!.textContent
const banner = () => screen.getByRole('status').textContent
const city = () => screen.getByRole('region', { name: 'Ta civilisation' })
const hand = () => screen.getAllByRole('button', { pressed: false })
const timer = () => screen.getByRole('timer')

function renderBoard(server: FakeGameServer, scores = new FakeScores({ id: 'p1', username: 'alice' })) {
  const ctx = createGameContext(sdvCivilisation, { id: 'p1', username: 'alice' }, fakeDeps({ scores }))
  render(<SdvCivilisationBoard ctx={ctx} server={server} tempo="off" />)
}

// Étant donné une partie commencée avec la Citadelle d’Orkan (fake : le serveur répond avec les vues du contrat)
async function started(plays: GameView[] = []) {
  const server = new FakeGameServer({ plays })
  renderBoard(server)
  const choose = await screen.findByRole('button', { name: 'Choisir Citadelle d’Orkan' })
  // La réponse du serveur arrive dans act : l'écran et ses effets (minuteur) sont à jour avant la suite du test.
  await act(async () => fireEvent.click(choose))
  return server
}

describe('SdvCivilisationGame', () => {
  it('propose les merveilles du serveur, commence la partie et montre voisins, civilisation et main', async () => {
    // Quand le joueur choisit la Citadelle d’Orkan
    const server = await started()

    // Alors le serveur commence la partie, et l'écran montre la table qu'il a renvoyée
    expect(server.start).toHaveBeenCalledWith('Citadelle d’Orkan')
    const left = screen.getByRole('region', { name: 'Voisin de gauche : IA 2' })
    const right = screen.getByRole('region', { name: 'Voisin de droite : IA 1' })
    expect(within(left).getByRole('img', { name: 'Produit 1 verre' })).toBeTruthy()
    expect(within(right).getByRole('img', { name: 'Produit 1 minerai' })).toBeTruthy()
    expect(within(city()).getByRole('img', { name: 'Produit 1 pierre' })).toBeTruthy()
    expect(hand()).toHaveLength(7)
    expect(status()).toBe('Âge I · Tour 1 / 6Les mains passent ← vers la gauche')
  })

  it('reprend la partie en cours, enregistrée par le serveur', async () => {
    // Étant donné une partie en cours au tour 2
    renderBoard(new FakeGameServer({ saved: contract.turnTwo }))

    // Alors l'écran la reprend directement, sans repasser par le choix de la merveille
    expect(await screen.findByText('Partie reprise : âge I, tour 2.')).toBeTruthy()
    expect(status()).toContain('Tour 2 / 6')
    expect(hand()).toHaveLength(6)
    expect(within(city()).getByRole('listitem', { name: 'Atelier : Science : roue' })).toBeTruthy()
  })

  it('détaille le prix calculé par le serveur et lui envoie le coup choisi', async () => {
    const server = await started([contract.turnTwo])

    // Quand le joueur regarde la Palissade, puis l'Atelier
    click(/^Palissade/)
    expect(screen.getByRole('button', { name: /^Construire Palissade/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: /^Construire Palissade/ }).textContent).toContain('1 bois manquant')
    click(/^Atelier/)
    expect(screen.getByRole('button', { name: /^Construire Atelier/ }).textContent).toContain('1 verre acheté à IA 2')
    const left = screen.getByRole('region', { name: 'Voisin de gauche : IA 2' })
    expect(left.querySelector('.sdv-civilisation-token-used')).toBeTruthy()

    // Et qu'il construit l'Atelier
    await act(async () => click(/^Construire Atelier/))

    // Alors le serveur reçoit la carte en position 6 pour la version 1, et l'écran passe au tour 2
    expect(server.play).toHaveBeenCalledWith(6, 'build', 1)
    expect(status()).toContain('Tour 2 / 6')
    expect(within(city()).getByRole('listitem', { name: 'roue : 1' })).toBeTruthy()
    click('Journal')
    expect(within(screen.getByRole('list', { name: 'Âge I, tour 1' })).getAllByRole('listitem')[0].textContent).toBe(
      'Tu as construit Atelier +2 pièces',
    )
  })

  it('affiche le refus du serveur pour un coup interdit, sans changer de tour', async () => {
    const server = await started()
    // Stub : le serveur refuse le coup
    server.play.mockRejectedValueOnce(new ApiError(400, 'Tu as déjà construit cette carte.'))

    click(/^Chantier/)
    await act(async () => click(/^Construire Chantier/))

    expect(screen.getByText('Tu as déjà construit cette carte.')).toBeTruthy()
    expect(status()).toContain('Tour 1 / 6')
  })

  it('se resynchronise quand le tour a déjà avancé côté serveur (409)', async () => {
    const server = await started()
    // Stub : le coup arrive après l'expiration du minuteur
    server.play.mockRejectedValueOnce(
      new TurnConflict('Temps écoulé : une carte de ta main a été défaussée au hasard.', contract.turnTwo),
    )

    click(/^Chantier/)
    await act(async () => click(/^Défausser/))

    expect(screen.getByText('Temps écoulé : une carte de ta main a été défaussée au hasard.')).toBeTruthy()
    expect(status()).toContain('Tour 2 / 6')
  })

  it('affiche le minuteur du tour et laisse le serveur défausser une carte à l’expiration', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const server = await started()

    // Alors le joueur voit le temps qui lui reste, en alerte dans les 10 dernières secondes
    expect(timer().textContent).toBe('1:00')
    act(() => vi.advanceTimersByTime(50_000))
    expect(timer().textContent).toBe('0:10')
    expect(timer().className).toContain('sdv-civilisation-timer-warning')

    // Quand le temps est écoulé, mais que l'horloge du serveur a une demi-seconde de retard
    server.saved = { ...contract.start, remainingMs: 500 }
    await act(async () => vi.advanceTimersByTime(10_000))
    expect(server.current).toHaveBeenCalledTimes(2)
    expect(status()).toContain('Tour 1 / 6')

    // Alors l'écran redemande la partie juste après : le serveur a défaussé une carte au hasard
    server.saved = contract.turnTwo
    await act(async () => vi.advanceTimersByTime(600))
    expect(server.current).toHaveBeenCalledTimes(3)
    expect(status()).toContain('Tour 2 / 6')
    expect(banner()).toBe('Temps écoulé : une carte de ta main a été défaussée au hasard.')
  })

  it('abandonne la partie et revient au choix de la merveille', async () => {
    const server = await started()

    await act(async () => click('Abandonner'))

    expect(server.abandon).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Choisir Citadelle d’Orkan' })).toBeTruthy()
    // Et les règles restent consultables avant de rejouer
    click('Règles')
    expect(screen.getByRole('dialog', { name: 'Règles du jeu' })).toBeTruthy()
  })

  it('revient au choix de la merveille si la partie a disparu quand le minuteur expire', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const server = await started()

    // Quand la partie a été abandonnée depuis un autre onglet, puis que le minuteur expire
    server.saved = null
    await act(async () => vi.advanceTimersByTime(60_000))

    // Alors l'écran revient au choix de la merveille
    expect(screen.getByRole('button', { name: 'Choisir Citadelle d’Orkan' })).toBeTruthy()
  })

  it('à l’âge II, la nouvelle main arrive du voisin de gauche', async () => {
    renderBoard(new FakeGameServer({ saved: { ...contract.ageTwo, turn: 2 } }))

    expect(await screen.findByText('Main reçue de IA 2')).toBeTruthy()
  })

  it('montre le classement final du serveur, rafraîchit celui de la plateforme et propose de rejouer', async () => {
    // Spy : le classement de la plateforme est relu quand la partie se termine (le serveur a enregistré le score)
    const scores = new FakeScores({ id: 'p1', username: 'alice' })
    const leaderboard = vi.spyOn(scores, 'leaderboard')
    renderBoard(new FakeGameServer({ saved: contract.over }), scores)

    expect(await screen.findByText('Fin de partie')).toBeTruthy()
    expect(screen.getByText('IA 2 gagne la partie.')).toBeTruthy()
    expect(leaderboard).toHaveBeenCalledTimes(2)
    click('Journal')
    click('Fermer')
    click('Rejouer')
    expect(screen.getByRole('button', { name: 'Choisir Citadelle d’Orkan' })).toBeTruthy()
  })

  it('ouvre la cité d’un voisin, les règles, et passe en plein écran', async () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
    const requestFullscreen = vi.fn(() => Promise.resolve())
    const exitFullscreen = vi.fn(() => Promise.resolve())
    HTMLElement.prototype.requestFullscreen = requestFullscreen
    document.exitFullscreen = exitFullscreen
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    await started()
    expect(scrollIntoView).toHaveBeenCalledOnce()

    click('Voir la cité de IA 1')
    expect(
      within(screen.getByRole('dialog', { name: 'Cité de IA 1' })).getByRole('list', { name: 'Bâtiments de IA 1' }),
    )
    click('Fermer')
    click('Voir la cité de IA 2')
    fireEvent.keyDown(document, { key: 'Escape' })
    click('Règles')
    expect(screen.getByRole('dialog', { name: 'Règles du jeu' })).toBeTruthy()
    click('Fermer')

    click('Plein écran')
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.querySelector('.sdv-civilisation'),
      configurable: true,
    })
    fireEvent(document, new Event('fullscreenchange'))
    click('Quitter le plein écran')
    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(exitFullscreen).toHaveBeenCalledOnce()
  })

  it('affiche une erreur si le serveur est injoignable au chargement', async () => {
    // Stub : le serveur ne répond pas
    const server = new FakeGameServer()
    server.current.mockRejectedValueOnce(
      new ApiError(0, 'Le serveur est injoignable. Vérifie ta connexion et réessaie.'),
    )
    renderBoard(server)

    expect(await screen.findByText('Le serveur est injoignable. Vérifie ta connexion et réessaie.')).toBeTruthy()
  })

  it('affiche chaque refus du serveur : merveilles, nouvelle partie, abandon, fin du minuteur', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Stubs : chaque appel échoue une fois avec son message
    const server = new FakeGameServer()
    server.wonders.mockRejectedValueOnce(new ApiError(502, 'Merveilles indisponibles.'))
    renderBoard(server)
    expect(await screen.findByText('Merveilles indisponibles.')).toBeTruthy()
    cleanup()

    const again = await started()
    again.abandon.mockRejectedValueOnce(new ApiError(502, 'Abandon impossible.'))
    await act(async () => click('Abandonner'))
    expect(screen.getByText('Abandon impossible.')).toBeTruthy()

    again.current.mockRejectedValueOnce(new ApiError(0, 'Serveur injoignable.'))
    await act(async () => vi.advanceTimersByTime(60_000))
    expect(screen.getByText('Serveur injoignable.')).toBeTruthy()

    await act(async () => click('Abandonner'))
    again.start.mockRejectedValueOnce(new ApiError(502, 'Partie impossible à créer.'))
    await act(async () => click('Choisir Citadelle d’Orkan'))
    expect(screen.getByText('Partie impossible à créer.')).toBeTruthy()
  })

  it('chargé depuis le catalogue, parle au vrai serveur HTTP et affiche une erreur de classement', async () => {
    // Stub : fetch répond comme le backend (aucune partie en cours), le classement est indisponible
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/wonders') ? Response.json(contract.wonders) : new Response(null, { status: 204 }),
      ),
    )
    const scores = new FakeScores()
    scores.leaderboard = () => Promise.reject(new GameError('network', 'Classement indisponible.'))
    const Game = sdvCivilisation.component
    render(
      <Suspense>
        <Game ctx={createGameContext(sdvCivilisation, null, fakeDeps({ scores }))} />
      </Suspense>,
    )

    expect(await screen.findByText('Classement indisponible.')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Choisir Jardins de Mirah' })).toBeTruthy()
  })
})
