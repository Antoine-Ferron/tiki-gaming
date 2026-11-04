import { describe, expect, it } from 'vitest'
import { MissionRunner, type MissionContext } from './runner'

function ctx(over: Partial<MissionContext> & { pos?: { x: number; z: number } } = {}): MissionContext {
  return {
    playerPos: () => over.pos ?? { x: 0, z: 0 },
    inVehicle: over.inVehicle ?? (() => false),
    vehicleTag: over.vehicleTag ?? (() => null),
    alive: over.alive ?? (() => true),
    wanted: over.wanted ?? (() => 0),
  }
}

describe('MissionRunner', () => {
  it('advances goto steps when the player reaches the marker', () => {
    const r = new MissionRunner([
      { type: 'goto', text: 'a', pos: { x: 10, z: 0 }, radius: 3 },
      { type: 'goto', text: 'b', pos: { x: 50, z: 0 }, radius: 3 },
    ])
    expect(r.update(0.1, ctx({ pos: { x: 0, z: 0 } }))).toBe('running')
    expect(r.index).toBe(0)
    r.update(0.1, ctx({ pos: { x: 9, z: 1 } }))
    expect(r.index).toBe(1)
    expect(r.update(0.1, ctx({ pos: { x: 50, z: 0 } }))).toBe('success')
  })

  it('requires a vehicle when asked', () => {
    const r = new MissionRunner([{ type: 'goto', text: 'a', pos: { x: 0, z: 0 }, radius: 3, inVehicle: true }])
    expect(r.update(0.1, ctx())).toBe('running')
    expect(r.update(0.1, ctx({ inVehicle: () => true }))).toBe('success')
  })

  it('fails timed deliveries', () => {
    const r = new MissionRunner([{ type: 'deliver', text: 'd', pos: { x: 100, z: 0 }, radius: 3, timeLimit: 5 }])
    for (let i = 0; i < 49; i++) r.update(0.1, ctx())
    expect(r.status).toBe('running')
    expect(r.timeLeft!).toBeGreaterThan(0)
    for (let i = 0; i < 20; i++) r.update(0.1, ctx())
    expect(r.status).toBe('failed')
    expect(r.failReason).toBe('Temps écoulé')
  })

  it('handles vehicle steps and escapes', () => {
    let wanted = 2
    let tag: string | null = null
    const r = new MissionRunner([
      { type: 'enterVehicle', text: 'e', tag: 'special' },
      { type: 'escape', text: 'x' },
      { type: 'deliver', text: 'g', pos: { x: 0, z: 0 }, radius: 4, requireTag: 'special' },
    ])
    const c = ctx({ vehicleTag: () => tag, wanted: () => wanted })
    r.update(0.1, c)
    expect(r.index).toBe(0)
    tag = 'special'
    r.update(0.1, c)
    expect(r.index).toBe(1)
    r.update(0.1, c)
    expect(r.index).toBe(1)
    wanted = 0
    r.update(0.1, c)
    expect(r.update(0.1, c)).toBe('success')
  })

  it('fails when the required vehicle is destroyed', () => {
    const r = new MissionRunner([
      { type: 'deliver', text: 'g', pos: { x: 500, z: 0 }, radius: 4, requireTag: 'special' },
    ])
    expect(r.update(0.1, ctx({ alive: () => false }))).toBe('failed')
  })

  it('applies custom fail rules and step hooks', () => {
    const seen: number[] = []
    let far = false
    const r = new MissionRunner(
      [
        { type: 'wait', text: 'w', seconds: 0.05 },
        { type: 'destroy', text: 'kill', tag: 'target' },
      ],
      [{ reason: 'escaped', check: () => far }],
      (i) => seen.push(i),
    )
    r.update(0.1, ctx())
    expect(seen).toEqual([0, 1])
    far = true
    expect(r.update(0.1, ctx())).toBe('failed')
    expect(r.failReason).toBe('escaped')
  })

  it('eliminate completes when all tags are dead', () => {
    const dead = new Set<string>()
    const r = new MissionRunner([{ type: 'eliminate', text: 'k', tags: ['boss', 'guard'] }])
    const c = ctx({ alive: (t) => !dead.has(t) })
    dead.add('boss')
    expect(r.update(0.1, c)).toBe('running')
    dead.add('guard')
    expect(r.update(0.1, c)).toBe('success')
  })
})
