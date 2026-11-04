// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GameError } from '@/games/errors'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import type { GameContext, Player } from '@/games/types'
import miniGta from '.'
import MiniGtaGame from './MiniGtaGame'
import type { MiniGtaSave } from './domain/save'

// La partie elle-même (WebGL) est remplacée par une doublure qui montre ce qu'elle reçoit et permet de quitter.
vi.mock('./MiniGtaPlay', () => ({
  default: ({ save, best, onExit }: { save: MiniGtaSave; best: number | null; onExit(p: MiniGtaSave): void }) => (
    <div>
      <p>
        Partie en cours : {save.money} $, record {best ?? 'aucun'}
      </p>
      <button onClick={() => onExit({ ...save, money: 2500, totalEarned: 3100, completedMissions: ['express'] })}>
        Quitter la partie
      </button>
    </div>
  ),
}))

const alice: Player = { id: 'p1', username: 'alice' }

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: query === '(pointer: fine)' })) as never
  window.innerWidth = 1280
})

afterEach(() => {
  cleanup()
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null })
})

function renderGame(ctx: GameContext) {
  render(<MiniGtaGame ctx={ctx} />)
}

describe('lancement d’une partie', () => {
  test('Jouer lance la partie dans la page, avec la sauvegarde, le record et le classement', async () => {
    const scores = new FakeScores(alice)
    await scores.insert('mini-gta', 1800, {})
    const ctx = createGameContext(miniGta, alice, fakeDeps({ scores }))
    const requestFullscreen = vi.fn(async () => {})
    document.documentElement.requestFullscreen = requestFullscreen
    renderGame(ctx)

    fireEvent.click(await screen.findByRole('button', { name: 'Jouer' }))

    expect(await screen.findByText('Partie en cours : 500 $, record 1800')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Classement' })).toBeTruthy()
    // Le plein écran se demande avec le bouton du jeu, jamais d'office.
    expect(requestFullscreen).not.toHaveBeenCalled()
  })

  test('invité : pas de record', async () => {
    renderGame(createGameContext(miniGta, null, fakeDeps()))

    fireEvent.click(await screen.findByRole('button', { name: 'Jouer' }))

    expect(await screen.findByText('Partie en cours : 500 $, record aucun')).toBeTruthy()
  })

  test('record injoignable : la partie se lance et le message s’affiche au retour', async () => {
    const scores = new FakeScores(alice)
    scores.leaderboard = async () => {
      throw new GameError('network', 'Serveur injoignable, réessaie plus tard.')
    }
    const ctx = createGameContext(miniGta, alice, fakeDeps({ scores }))
    ctx.getLeaderboard = async () => []
    renderGame(ctx)

    fireEvent.click(await screen.findByRole('button', { name: 'Jouer' }))
    expect(await screen.findByText('Partie en cours : 500 $, record aucun')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Quitter la partie' }))

    expect(await screen.findByText('Serveur injoignable, réessaie plus tard.')).toBeTruthy()
  })
})

describe('retour à l’accueil', () => {
  test('affiche la progression de la partie et propose de continuer', async () => {
    const ctx = createGameContext(miniGta, alice, fakeDeps())
    renderGame(ctx)
    fireEvent.click(await screen.findByRole('button', { name: 'Jouer' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Quitter la partie' }))

    expect(await screen.findByRole('button', { name: 'Continuer' })).toBeTruthy()
    expect(screen.getByText(/2\s500\s\$/)).toBeTruthy()
    expect(screen.getByText(/3\s100\s\$/)).toBeTruthy()
    expect(screen.getByText('1 / 4')).toBeTruthy()
  })

  test('quitte le plein écran et rafraîchit le classement', async () => {
    const scores = new FakeScores(alice)
    const ctx = createGameContext(miniGta, alice, fakeDeps({ scores }))
    const exitFullscreen = vi.fn(async () => {})
    document.exitFullscreen = exitFullscreen
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.body })
    renderGame(ctx)
    fireEvent.click(await screen.findByRole('button', { name: 'Jouer' }))
    await screen.findByText(/Partie en cours/)
    // Un score est enregistré pendant la partie.
    await scores.insert('mini-gta', 3100, {})

    fireEvent.click(screen.getByRole('button', { name: 'Quitter la partie' }))

    expect(await screen.findByText('3100')).toBeTruthy()
    expect(exitFullscreen).toHaveBeenCalled()
  })

  test('sauvegarde illisible (panne) : nouvelle partie et message', async () => {
    const ctx = createGameContext(miniGta, alice, fakeDeps())
    ctx.loadSave = async () => {
      throw new GameError('network', 'Sauvegarde injoignable.')
    }

    renderGame(ctx)

    expect(await screen.findByText('Sauvegarde injoignable.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Jouer' })).toBeTruthy()
  })
})
