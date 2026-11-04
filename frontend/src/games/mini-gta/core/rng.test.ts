import { describe, expect, it } from 'vitest'
import { Rng, hashString } from './rng'

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(42)
    const b = new Rng(42)
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })

  it('differs between seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next())
  })

  it('stays within bounds', () => {
    const rng = new Rng(7)
    for (let i = 0; i < 10_000; i++) {
      const f = rng.next()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      const n = rng.int(3, 6)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(6)
    }
  })

  it('int covers the full inclusive range', () => {
    const rng = new Rng(9)
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) seen.add(rng.int(0, 3))
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })

  it('fork gives independent, reproducible streams', () => {
    const a = new Rng(5).fork('roads')
    const b = new Rng(5).fork('roads')
    const c = new Rng(5).fork('buildings')
    const va = a.next()
    expect(va).toBe(b.next())
    expect(va).not.toBe(c.next())
  })

  it('hashString is stable', () => {
    expect(hashString('minigta')).toBe(hashString('minigta'))
    expect(hashString('a')).not.toBe(hashString('b'))
  })
})
