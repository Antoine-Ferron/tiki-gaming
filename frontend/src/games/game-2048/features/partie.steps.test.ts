import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import { moveGrid, type Direction } from '../domain/board'
import { keepPlaying, play, type GameState } from '../domain/game'
import type { TileSpawner } from '../domain/spawner'

const feature = await loadFeature('src/games/game-2048/features/partie.feature', { language: 'fr' })

const directions: Record<string, Direction> = { gauche: 'left', droite: 'right', haut: 'up', bas: 'down' }

/** "2 . 4 ." → [2, 0, 4, 0] ; une grille est une ligne de texte par rangée. */
const parseLine = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .map((cell) => (cell === '.' ? 0 : Number(cell)))
const parseGrid = (text: string) => text.trim().split('\n').map(parseLine)

/** Stub : pose la tuile choisie par le scénario sur la dernière case vide (ordre de lecture). */
function lastEmptyCell(value: number): TileSpawner {
  return {
    spawn(grid) {
      const next = grid.map((row) => [...row])
      const cells = next.flatMap((row, r) => row.flatMap((v, c) => (v === 0 ? [[r, c]] : [])))
      const last = cells.at(-1)
      if (last) next[last[0]][last[1]] = value
      return next
    },
  }
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let game: GameState
  let before: GameState
  let spawner: { spawn: ReturnType<typeof vi.fn<TileSpawner['spawn']>> }
  let line: number[][]
  let points: number

  function start(text: string, overrides: Partial<GameState> = {}) {
    game = { grid: parseGrid(text), score: 0, moves: 0, status: 'playing', continued: false, ...overrides }
    // Spy sur le stub : par défaut, un 2 apparaît sur la dernière case vide.
    spawner = { spawn: vi.fn(lastEmptyCell(2).spawn) }
  }

  function playTowards(direction: string) {
    before = game
    game = play(game, directions[direction], spawner)
  }

  const nextTileIs = (_: unknown, value: number) => {
    spawner.spawn.mockImplementation(lastEmptyCell(value).spawn)
  }

  ScenarioOutline(
    'Les tuiles glissent et fusionnent une seule fois par coup',
    ({ Given, When, Then, And }, variables) => {
      Given('une ligne "<avant>"', () => {
        line = [parseLine(variables.avant)]
      })
      When('le joueur la fait glisser vers la <direction>', () => {
        const result = moveGrid(line, directions[variables.direction])
        line = result.grid
        points = result.points
      })
      Then('la ligne devient "<après>"', () => {
        expect(line[0]).toEqual(parseLine(variables['après']))
      })
      And('le coup rapporte <points> points', () => {
        expect(points).toBe(Number(variables.points))
      })
    },
  )

  Scenario('Un coup qui bouge des tuiles fait apparaître une nouvelle tuile', ({ Given, And, When, Then }) => {
    Given('la grille', (_, grid: string) => start(grid))
    And('la prochaine tuile sera un {int} sur la dernière case vide', nextTileIs)
    When('le joueur joue vers la {word}', (_, direction: string) => playTowards(direction))
    Then('la grille devient', (_, grid: string) => {
      expect(game.grid).toEqual(parseGrid(grid))
    })
    And('le score est de {int} points', (_, score: number) => {
      expect(game.score).toBe(score)
    })
  })

  Scenario('Un coup qui ne bouge aucune tuile ne compte pas', ({ Given, When, Then, And }) => {
    Given('la grille', (_, grid: string) => start(grid))
    When('le joueur joue vers la {word}', (_, direction: string) => playTowards(direction))
    Then('la grille ne change pas', () => {
      expect(game.grid).toEqual(before.grid)
    })
    And("aucune nouvelle tuile n'apparaît", () => {
      expect(spawner.spawn).not.toHaveBeenCalled()
    })
    And('le score est de {int} points', (_, score: number) => {
      expect(game.score).toBe(score)
    })
  })

  Scenario('Le score additionne les points de chaque coup', ({ Given, And, When, Then }) => {
    Given('la grille', (_, grid: string) => start(grid))
    And('un score de {int} points', (_, score: number) => {
      game = { ...game, score }
    })
    When('le joueur joue vers la {word}', (_, direction: string) => playTowards(direction))
    Then('le score est de {int} points', (_, score: number) => {
      expect(game.score).toBe(score)
    })
  })

  Scenario('Créer la tuile 2048 fait gagner la partie', ({ Given, When, Then }) => {
    Given('la grille', (_, grid: string) => start(grid))
    When('le joueur joue vers la {word}', (_, direction: string) => playTowards(direction))
    Then('la partie est gagnée', () => {
      expect(game.status).toBe('won')
    })
  })

  Scenario('Après avoir continué, on ne gagne pas une deuxième fois', ({ Given, And, When, Then }) => {
    let continued = false
    Given('une partie déjà gagnée où le joueur a choisi de continuer', () => {
      continued = true
    })
    And('la grille', (_, grid: string) => {
      start(grid, { status: 'won' })
      if (continued) game = keepPlaying(game)
    })
    When('le joueur joue vers la {word}', (_, direction: string) => playTowards(direction))
    Then('la partie est en cours', () => {
      expect(game.status).toBe('playing')
    })
  })

  Scenario('Une grille pleine sans fusion possible fait perdre la partie', ({ Given, And, When, Then }) => {
    Given('la grille', (_, grid: string) => start(grid))
    And('la prochaine tuile sera un {int} sur la dernière case vide', nextTileIs)
    When('le joueur joue vers la {word}', (_, direction: string) => playTowards(direction))
    Then('la grille devient', (_, grid: string) => {
      expect(game.grid).toEqual(parseGrid(grid))
    })
    And('la partie est perdue', () => {
      expect(game.status).toBe('lost')
    })
  })

  Scenario('Une grille pleine avec une fusion possible continue', ({ Given, And, When, Then }) => {
    Given('la grille', (_, grid: string) => start(grid))
    And('la prochaine tuile sera un {int} sur la dernière case vide', nextTileIs)
    When('le joueur joue vers la {word}', (_, direction: string) => playTowards(direction))
    Then('la partie est en cours', () => {
      expect(game.status).toBe('playing')
    })
  })
})
