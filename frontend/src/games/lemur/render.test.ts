import { describe, expect, test } from 'vitest'
import { BRANCH_WIDTH, MAKI_SIZE, PX_PER_METER, VIEW_HEIGHT, WORLD_WIDTH } from './domain/game'
import { draw } from './render'
import { aGame } from './testing/builders'

type Rect = { color: string; x: number; y: number; w: number; h: number }

/** Faux contexte 2D (Fake) : garde chaque rectangle dessiné avec sa couleur, pour vérifier la scène sans navigateur. */
function fakeSurface() {
  const rects: Rect[] = []
  const surface = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ color: String(surface.fillStyle), x, y, w, h })
    },
  }
  return { surface: surface as unknown as CanvasRenderingContext2D, rects }
}

describe('rendu canvas de LemurTiki', () => {
  test('peint le ciel sur tout l’écran avant le reste', () => {
    const { surface, rects } = fakeSurface()

    draw(surface, aGame())

    expect(rects[0]).toMatchObject({ x: 0, y: 0, w: WORLD_WIDTH, h: VIEW_HEIGHT })
  })

  test('place une branche à l’écran selon la caméra : axe y du monde vers le haut, de l’écran vers le bas', () => {
    const { surface, rects } = fakeSurface()
    const state = aGame({ cameraY: 100 * PX_PER_METER, branches: [{ x: 50, y: 110 * PX_PER_METER }] })

    draw(surface, state)

    // 10 m au-dessus du bas de l'écran (100 px), dessus de la branche à 12 px de plus.
    expect(rects).toContainEqual(expect.objectContaining({ x: 50, w: BRANCH_WIDTH, y: VIEW_HEIGHT - 100 - 12 }))
  })

  test('dessine le maki centré sur sa position, les pieds sur sa hauteur', () => {
    const { surface, rects } = fakeSurface()

    draw(surface, aGame({ maki: { x: 180, y: 20, vy: 0 } }))

    expect(rects).toContainEqual(
      expect.objectContaining({ x: 180 - MAKI_SIZE / 2, y: VIEW_HEIGHT - 20 - MAKI_SIZE, w: MAKI_SIZE }),
    )
  })

  test('montre la fossa quand elle entre dans l’écran, et pas quand elle est encore dessous', () => {
    const visible = fakeSurface()
    const hidden = fakeSurface()

    draw(visible.surface, aGame({ fossaY: 50 }))
    draw(hidden.surface, aGame({ fossaY: -400 }))

    expect(visible.rects.length).toBe(hidden.rects.length + 1)
  })
})
