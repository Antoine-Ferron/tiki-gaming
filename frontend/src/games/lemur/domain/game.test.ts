import { describe, expect, test } from 'vitest'
import { BRANCH_HEIGHT, BRANCH_WIDTH, JUMP_SPEED, MAKI_SIZE, step, WORLD_WIDTH } from './game'
import { aGame } from '../testing/builders'

const NO_INPUT = { left: false, right: false }

/** Le maki descend juste au-dessus d'une branche (dessus à y = 100) et le jeu avance d'une image. */
function bouncesOn(branchX: number, makiX: number): boolean {
  // Arrange
  const state = aGame({
    maki: { x: makiX, y: 102, vy: -200 },
    branches: [{ x: branchX, y: 100 - BRANCH_HEIGHT }],
  })
  // Act
  const next = step(state, NO_INPUT)
  // Assert (lu par l'appelant)
  return next.maki.vy === JUMP_SPEED
}

describe('contact entre le maki et une branche (EF-1.6)', () => {
  const half = MAKI_SIZE / 2 // 15 px
  const left = 100
  const right = left + BRANCH_WIDTH // 170

  // Le corps du maki couvre [x - 15, x + 15] : il touche la branche [100, 170] si x est dans ]85, 185[.
  test.each([
    { cas: 'corps juste à gauche, arêtes qui se touchent', x: left - half, attendu: false },
    { cas: 'corps qui mord de 1 px sur le bord gauche', x: left - half + 1, attendu: true },
    { cas: 'centre au-dessus de la branche', x: (left + right) / 2, attendu: true },
    { cas: 'corps qui mord de 1 px sur le bord droit', x: right + half - 1, attendu: true },
    { cas: 'corps juste à droite, arêtes qui se touchent', x: right + half, attendu: false },
  ])('$cas (x = $x) → rebond : $attendu', ({ x, attendu }) => {
    expect(bouncesOn(left, x)).toBe(attendu)
  })

  // Branche collée au bord gauche [0, 70] ; le maki à cheval sur le bord droit déborde à gauche.
  test.each([
    { cas: 'à cheval sur le bord, arêtes qui se touchent', x: WORLD_WIDTH - half, attendu: false },
    { cas: 'à cheval sur le bord, déborde de 1 px', x: WORLD_WIDTH - half + 1, attendu: true },
    { cas: 'à cheval sur le bord, déborde largement', x: WORLD_WIDTH - 5, attendu: true },
  ])('bord relié — $cas (x = $x) → rebond : $attendu', ({ x, attendu }) => {
    expect(bouncesOn(0, x)).toBe(attendu)
  })
})
