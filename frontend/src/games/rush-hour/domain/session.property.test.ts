// Propriété de la partie vérifiée avec fast-check sur des suites de coups tirées au hasard : quoi que fasse le joueur,
// « Annuler » autant de fois que de coups ramène exactement au plateau de départ (P3), et regrouper les glissements
// d'un même véhicule (R6) ne compte jamais plus de coups qu'il n'y a eu de glissements.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { ManualClock } from '../testing/manualClock'
import { getLevel } from './levels'
import { moveRange } from './moves'
import { GameSession } from './session'

// Une suite de choix : quel véhicule (indice), quel glissement parmi ceux possibles (fraction de l'amplitude).
const choices = fc.array(fc.tuple(fc.nat(), fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true })), {
  maxLength: 30,
})

describe('GameSession (propriétés)', () => {
  test.each([1, 10, 20])('niveau %i : après n’importe quels coups légaux, tout annuler ramène au départ', (level) => {
    fc.assert(
      fc.property(choices, (steps) => {
        // Arrange
        const map = getLevel(level).map
        const session = new GameSession(map, new ManualClock())
        const start = session.board

        // Act : chaque choix devient un glissement légal (non nul) d'un véhicule
        let slides = 0
        for (const [pick, fraction] of steps) {
          if (session.solved) break
          const vehicle = session.board.vehicles[pick % session.board.vehicles.length]
          const { min, max } = moveRange(session.board, vehicle.id)
          const deltas = [...Array(max - min + 1).keys()].map((i) => min + i).filter((d) => d !== 0)
          if (deltas.length === 0) continue
          session.move(vehicle.id, deltas[Math.floor(fraction * deltas.length)])
          slides++
        }
        const played = session.moveCount
        for (let i = 0; i < played; i++) session.undo()

        // Assert
        expect(played).toBeLessThanOrEqual(slides)
        expect(session.moveCount).toBe(0)
        expect(session.board).toEqual(start)
      }),
      { numRuns: 100 },
    )
  })
})
