// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GameError } from '@/games/errors'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import type { Player } from '@/games/types'
import miniGta from '.'
import MiniGtaGame from './MiniGtaGame'
import { newSave } from './domain/save'

const alice: Player = { id: 'p1', username: 'alice' }

function setDevice(finePointer: boolean, width: number) {
  window.matchMedia = ((query: string) => ({ matches: query === '(pointer: fine)' && finePointer })) as never
  window.innerWidth = width
}

function renderGame(player: Player | null, deps = fakeDeps()) {
  const ctx = createGameContext(miniGta, player, deps)
  render(<MiniGtaGame ctx={ctx} />)
  return { ctx, deps }
}

beforeEach(() => setDevice(true, 1280))
afterEach(cleanup)

describe('écran d’accueil MiniGTA', () => {
  test('invité sans sauvegarde : nouvelle partie et invitation à se connecter', async () => {
    renderGame(null)

    expect(await screen.findByRole('button', { name: 'Jouer' })).toBeTruthy()
    expect(screen.getByText(/Connecte-toi pour apparaître au classement/)).toBeTruthy()
  })

  test('connecté avec sauvegarde : propose de continuer et affiche la progression', async () => {
    const ctx = createGameContext(miniGta, alice, fakeDeps())
    await ctx.save({ ...newSave(), money: 1200, totalEarned: 4300 })

    render(<MiniGtaGame ctx={ctx} />)

    expect(await screen.findByRole('button', { name: 'Continuer' })).toBeTruthy()
    expect(screen.getByText(/1\s?200\s?\$/)).toBeTruthy()
    expect(screen.getByText(/4\s?300\s?\$/)).toBeTruthy()
    expect(screen.queryByText(/Connecte-toi/)).toBeNull()
  })

  test('sauvegarde corrompue : repart d’une nouvelle partie', async () => {
    const ctx = createGameContext(miniGta, alice, fakeDeps())
    await ctx.save({ version: 0 })

    render(<MiniGtaGame ctx={ctx} />)

    expect(await screen.findByRole('button', { name: 'Jouer' })).toBeTruthy()
  })

  test('classement : affiche les meilleurs scores', async () => {
    const scores = new FakeScores(alice)
    await scores.insert('mini-gta', 2500, {})

    renderGame(alice, fakeDeps({ scores }))

    expect(await screen.findByText('alice')).toBeTruthy()
    expect(screen.getByText('2500')).toBeTruthy()
  })

  test('classement injoignable : affiche le message du SDK sans bloquer le jeu', async () => {
    const scores = new FakeScores(alice)
    scores.leaderboard = async () => {
      throw new GameError('network', 'Serveur injoignable, réessaie plus tard.')
    }

    renderGame(alice, fakeDeps({ scores }))

    expect(await screen.findByText('Serveur injoignable, réessaie plus tard.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Jouer' })).toBeTruthy()
  })

  test('écran tactile : explique qu’il faut un ordinateur et masque Jouer', async () => {
    setDevice(false, 390)

    renderGame(null)

    expect(await screen.findByText(/se joue au clavier et à la souris, sur ordinateur/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Jouer|Continuer/ })).toBeNull()
  })
})
