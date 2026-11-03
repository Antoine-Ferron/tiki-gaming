import { describe, expect, it } from 'vitest'
import { GameLoop } from './loop'
import { FIXED_DT } from './config'

describe('GameLoop', () => {
  it('runs a fixed number of ticks regardless of frame rate', () => {
    const loop = new GameLoop()
    let ticks = 0
    loop.add({ name: 't', update: () => ticks++ })
    // 1 second at 144 fps
    for (let i = 0; i < 144; i++) loop.advance(1 / 144)
    expect(ticks).toBeGreaterThanOrEqual(59)
    expect(ticks).toBeLessThanOrEqual(60)
  })

  it('always passes the fixed dt to update', () => {
    const loop = new GameLoop()
    const dts: number[] = []
    loop.add({ name: 't', update: (dt) => dts.push(dt) })
    loop.advance(0.1)
    expect(dts.every((d) => d === FIXED_DT)).toBe(true)
  })

  it('clamps huge frames (tab switch) to avoid spiral of death', () => {
    const loop = new GameLoop()
    expect(loop.advance(10)).toBeLessThanOrEqual(Math.ceil(0.25 / FIXED_DT))
  })

  it('does not tick when paused and still renders', () => {
    const loop = new GameLoop()
    let ticks = 0
    let renders = 0
    loop.add({ name: 't', update: () => ticks++, render: () => renders++ })
    loop.paused = true
    loop.advance(1)
    expect(ticks).toBe(0)
    expect(renders).toBe(1)
  })

  it('provides alpha in [0, 1)', () => {
    const loop = new GameLoop()
    let alpha = -1
    loop.add({ name: 't', render: (a) => (alpha = a) })
    loop.advance(FIXED_DT * 1.5)
    expect(alpha).toBeGreaterThanOrEqual(0)
    expect(alpha).toBeLessThan(1)
  })

  it('remove() unregisters a system', () => {
    const loop = new GameLoop()
    let ticks = 0
    const off = loop.add({ name: 't', update: () => ticks++ })
    off()
    loop.advance(0.1)
    expect(ticks).toBe(0)
  })
})
