// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import demineur from '.'
import DemineurGame from './DemineurGame'
import { createGrid, type Cell, type Grid, type Rng } from './logic'

afterEach(cleanup)

/**
 * PRNG déterministe (seedé) : contrairement au Stub à valeur fixe de logic.test.ts, celui-ci doit
 * produire une séquence variée, sinon le placement de 10 mines distinctes boucle à l'infini.
 * Même seed = même séquence, reproductible entre deux instances indépendantes (mulberry32).
 */
function seededRng(seed: number): Rng {
  let state = seed
  return {
    next() {
      state |= 0
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

function findCell(grid: Grid, predicate: (cell: Cell) => boolean) {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (predicate(grid[row][col])) return { row, col }
    }
  }
  throw new Error('Aucune case ne correspond')
}

function cellButton(row: number, col: number) {
  return screen.getByRole('button', { name: `Case ${row + 1}, ${col + 1}` })
}

const player = { id: 'p1', username: 'alice' }
const SEED = 1

describe('DemineurGame', () => {
  it('révèle une case sûre au clic', () => {
    const reference = createGrid(9, 9, 10, seededRng(SEED))
    const safe = findCell(reference, (cell) => !cell.mine)
    const ctx = createGameContext(demineur, player, fakeDeps())
    render(<DemineurGame ctx={ctx} rng={seededRng(SEED)} />)

    const button = cellButton(safe.row, safe.col)
    fireEvent.click(button)

    expect(button).toBeDisabled()
  })

  it('révéler une mine perd la partie', () => {
    const reference = createGrid(9, 9, 10, seededRng(SEED))
    const mine = findCell(reference, (cell) => cell.mine)
    const ctx = createGameContext(demineur, player, fakeDeps())
    render(<DemineurGame ctx={ctx} rng={seededRng(SEED)} />)

    fireEvent.click(cellButton(mine.row, mine.col))

    expect(screen.getByText('Perdu')).toBeTruthy()
  })

  it('un clic droit pose un drapeau qui empêche la révélation', () => {
    const reference = createGrid(9, 9, 10, seededRng(SEED))
    const safe = findCell(reference, (cell) => !cell.mine)
    const ctx = createGameContext(demineur, player, fakeDeps())
    render(<DemineurGame ctx={ctx} rng={seededRng(SEED)} />)

    const button = cellButton(safe.row, safe.col)
    fireEvent.contextMenu(button)
    fireEvent.click(button)

    expect(button).not.toBeDisabled()
  })

  it('gagner la partie envoie le score', async () => {
    const reference = createGrid(9, 9, 10, seededRng(SEED))
    const scores = new FakeScores(player)
    const ctx = createGameContext(demineur, player, fakeDeps({ scores }))
    render(<DemineurGame ctx={ctx} rng={seededRng(SEED)} />)

    for (let row = 0; row < reference.length; row++) {
      for (let col = 0; col < reference[row].length; col++) {
        if (!reference[row][col].mine) fireEvent.click(cellButton(row, col))
      }
    }

    expect(screen.getByText('Gagné')).toBeTruthy()
    await vi.waitFor(() => expect(scores.rows).toHaveLength(1))
    expect(scores.rows[0].score).toBeGreaterThan(0)
    expect(await screen.findByText(player.username)).toBeTruthy()
  })

  it("invite l'invité à se connecter uniquement en fin de partie", () => {
    const reference = createGrid(9, 9, 10, seededRng(SEED))
    const mine = findCell(reference, (cell) => cell.mine)
    const ctx = createGameContext(demineur, null, fakeDeps())
    render(<DemineurGame ctx={ctx} rng={seededRng(SEED)} />)

    expect(screen.queryByText('Connecte-toi pour apparaître au classement.')).toBeNull()

    fireEvent.click(cellButton(mine.row, mine.col))

    expect(screen.getByText('Connecte-toi pour apparaître au classement.')).toBeTruthy()
  })
})
