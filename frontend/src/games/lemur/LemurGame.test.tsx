// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import lemur from '.'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import type { GameContext } from '../types'
import LemurGame from './LemurGame'

// La boucle de jeu tourne sur de faux minuteurs (requestAnimationFrame compris) : le temps est piloté par le test.
// Le tirage au sort est fixé (Stub) : 0,5 pose chaque branche sous le maki, qui grimpe tout seul ;
// 0 les pose toutes au bord gauche, loin du maki, qui rebondit sur place jusqu'à ce que la fossa l'attrape.
const CLIMBS = () => 0.5
const STAYS = () => 0

const player = { id: 'p1', username: 'alice' }
const guest = () => createGameContext(lemur, null, fakeDeps())

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom ne dessine pas : le rendu canvas est testé à part (render.test.ts).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function play(ctx: GameContext, random: () => number) {
  render(<LemurGame ctx={ctx} random={random} />)
  fireEvent.click(screen.getByRole('button', { name: 'Jouer' }))
}

/** Fait passer `ms` millisecondes de jeu, puis laisse se terminer l'envoi du score s'il y en a un. */
async function wait(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

const heightShown = () => Number(/(\d+) m/.exec(screen.getByText(/^Hauteur/).textContent ?? '')?.[1])

describe('écran de LemurTiki', () => {
  it('présente le jeu, ses commandes et un bouton Jouer, chargé comme sur la plateforme (EF-7.1)', async () => {
    vi.useRealTimers()
    const Game = lemur.component

    render(
      <Suspense fallback={null}>
        <Game ctx={guest()} />
      </Suspense>,
    )

    expect(await screen.findByRole('heading', { name: 'LemurTiki' })).toBeInTheDocument()
    expect(screen.getByText(/grimpe le baobab/i)).toBeInTheDocument()
    expect(screen.getByText(/Q \/ D/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jouer' })).toBeInTheDocument()
  })

  it('Jouer lance une partie à 0 m, et le maki grimpe tout seul de branche en branche (EF-7.2)', async () => {
    play(guest(), CLIMBS)
    expect(screen.getByText('Hauteur : 0 m')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /maki/i })).toBeInTheDocument()

    await wait(5000)

    expect(heightShown()).toBeGreaterThan(20)
  })

  it('Échap met la partie en pause et la fige, P la reprend (EF-7.3, EF-7.5)', async () => {
    play(guest(), CLIMBS)
    await wait(2000)

    fireEvent.keyDown(window, { key: 'Escape' })
    const frozen = heightShown()
    await wait(3000)

    expect(screen.getByRole('heading', { name: 'Pause' })).toBeInTheDocument()
    expect(heightShown()).toBe(frozen)

    fireEvent.keyDown(window, { key: 'p' })
    await wait(3000)

    expect(screen.queryByRole('heading', { name: 'Pause' })).not.toBeInTheDocument()
    expect(heightShown()).toBeGreaterThan(frozen)
  })

  it('le bouton Reprendre relance une partie en pause (EF-7.5)', async () => {
    play(guest(), CLIMBS)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }))

    expect(screen.queryByRole('heading', { name: 'Pause' })).not.toBeInTheDocument()
  })

  it('se met en pause tout seul quand l’onglet est masqué (EF-7.6)', async () => {
    play(guest(), CLIMBS)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    fireEvent(document, new Event('visibilitychange'))

    expect(screen.getByRole('heading', { name: 'Pause' })).toBeInTheDocument()
  })

  it('quand la fossa attrape le maki, l’écran de fin donne la cause, le score et invite l’invité à se connecter (EF-7.7, EF-8.3)', async () => {
    play(guest(), STAYS)

    await wait(20_000)

    expect(screen.getByRole('heading', { name: 'Partie terminée' })).toBeInTheDocument()
    expect(screen.getByText('La fossa t’a attrapé !')).toBeInTheDocument()
    expect(screen.getByText(/^Score : \d+$/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Connecte-toi pour apparaître au classement.')
  })

  it('Rejouer relance une nouvelle partie à 0 m en un clic (EF-7.7)', async () => {
    play(guest(), STAYS)
    await wait(20_000)

    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }))

    expect(screen.queryByRole('heading', { name: 'Partie terminée' })).not.toBeInTheDocument()
    expect(screen.getByText('Hauteur : 0 m')).toBeInTheDocument()
  })

  it('envoie une seule fois le score d’un joueur connecté à la fin de la partie (EF-8.1)', async () => {
    const scores = new FakeScores(player)
    play(createGameContext(lemur, player, fakeDeps({ scores })), STAYS)

    await wait(30_000)

    expect(scores.rows).toHaveLength(1)
    expect(scores.rows[0]).toMatchObject({ gameSlug: 'lemur', metadata: { cause: 'fossa' } })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
