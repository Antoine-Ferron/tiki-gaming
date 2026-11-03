// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { createTestGame, type TestGame } from '../game/testing/harness'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))

let t: TestGame
vi.mock('../game/current', () => ({ getGame: () => t?.game ?? null }))

beforeAll(async () => {
  t = await createTestGame()
}, 60_000)

afterAll(() => {
  cleanup()
  t?.dispose()
})

describe('carte et minimap', () => {
  test('la carte de la ville se dessine une seule fois puis est réutilisée', async () => {
    const { mapImage, toMap, MAP_PX } = await import('./mapImage')

    const first = mapImage(t.game.city)

    expect(mapImage(t.game.city)).toBe(first)
    const centre = toMap(0, 0)
    expect(centre.x).toBeCloseTo(MAP_PX / 2)
    expect(centre.y).toBeCloseTo(MAP_PX / 2)
  })

  test('la minimap se redessine à chaque image, recherche et itinéraire compris', async () => {
    const { Minimap } = await import('./Minimap')
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
    const p = t.game.player.position
    t.game.police.wanted.setMinimum(2, p.x, p.z)
    t.game.missions.start(t.game.missions.defs[0])

    const { container } = render(<Minimap />)
    act(() => {
      for (let i = 0; i < 3; i++) frames.shift()?.(performance.now() + i * 400)
    })

    expect(container.querySelector('canvas.mini-gta-minimap')).toBeTruthy()
    expect(frames.length).toBeGreaterThan(0)
  })
})
