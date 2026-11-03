// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { CursorSwarm } from './CursorSwarm'

// jsdom n'a ni canvas ni matchMedia : on les remplace par des doublures qui enregistrent les appels.
const frames: FrameRequestCallback[] = []
const drawing = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  setTransform: vi.fn(),
  fillStyle: '',
  globalCompositeOperation: '',
}

function stubBrowser({ reducedMotion = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reducedMotion && query.includes('reduce') }))
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawing as unknown as CanvasRenderingContext2D)
}

function nextFrame(now: number) {
  frames.shift()?.(now)
}

beforeEach(() => {
  frames.length = 0
  vi.clearAllMocks()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('CursorSwarm', () => {
  test('canvas décoratif : ignoré des lecteurs d’écran', () => {
    const { container } = render(<CursorSwarm />)

    expect(container.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true')
  })

  test('dessine une particule par image et enchaîne les images', () => {
    stubBrowser()
    render(<CursorSwarm />)

    nextFrame(16)
    expect(drawing.arc).toHaveBeenCalledTimes(42)
    expect(frames).toHaveLength(1)
  })

  test('suit le pointeur, puis se promène quand il quitte la page', () => {
    stubBrowser()
    let seed = 1 // aléatoire reproductible (LCG), comme dans swarm.test.ts
    vi.spyOn(Math, 'random').mockImplementation(() => (seed = (seed * 16807) % 2147483647) / 2147483647)
    render(<CursorSwarm />)

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 20 }))
    for (let t = 16; t < 2000; t += 16) nextFrame(t)
    const near = drawing.arc.mock.calls.slice(-42).every(([x, y]) => Math.hypot(x - 10, y - 20) < 80)
    document.documentElement.dispatchEvent(new PointerEvent('pointerleave'))
    nextFrame(2016)

    expect(near).toBe(true)
    expect(frames).toHaveLength(1)
  })

  test('s’arrête et retire ses écouteurs au démontage', () => {
    stubBrowser()
    const removed = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<CursorSwarm />)

    unmount()

    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(removed.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['resize', 'pointermove']))
  })

  test('n’anime rien si le joueur a demandé moins d’animations', () => {
    stubBrowser({ reducedMotion: true })
    render(<CursorSwarm />)

    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled()
    expect(frames).toHaveLength(0)
  })
})
