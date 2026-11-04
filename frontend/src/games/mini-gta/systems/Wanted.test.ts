import { describe, expect, it } from 'vitest'
import { WantedLevel } from './Wanted'

describe('WantedLevel', () => {
  it('ignores unwitnessed crimes', () => {
    const w = new WantedLevel()
    w.commit('killCivilian', 0, 0, false)
    expect(w.stars).toBe(0)
  })

  it('escalates with crimes', () => {
    const w = new WantedLevel()
    w.commit('shooting', 0, 0, true)
    expect(w.stars).toBe(1)
    w.commit('killCop', 0, 0, true)
    expect(w.stars).toBe(2)
    for (let i = 0; i < 4; i++) w.commit('killCop', 0, 0, true)
    expect(w.stars).toBe(5)
    w.commit('killCop', 0, 0, true)
    expect(w.stars).toBe(5)
  })

  it('stays wanted while seen and resets the search center', () => {
    const w = new WantedLevel()
    w.commit('killCivilian', 0, 0, true)
    for (let t = 0; t < 600; t++) w.update(0.1, true, 50, 60)
    expect(w.stars).toBeGreaterThan(0)
    expect(w.lastSeen).toEqual({ x: 50, z: 60 })
    expect(w.searching).toBe(false)
  })

  it('is lost after hiding long enough', () => {
    const w = new WantedLevel()
    w.commit('killCivilian', 0, 0, true)
    const stars = w.stars
    let lost = false
    let t = 0
    while (!lost && t < 200) {
      lost = w.update(0.1, false, 10, 10)
      t += 0.1
    }
    expect(lost).toBe(true)
    expect(w.stars).toBe(0)
    expect(t).toBeCloseTo(12 + stars * 6, 0)
  })

  it('is lost faster outside the search circle', () => {
    const inside = new WantedLevel()
    const outside = new WantedLevel()
    for (const w of [inside, outside]) w.commit('killCivilian', 0, 0, true)
    let ti = 0
    let to = 0
    while (!inside.update(0.1, false, 5, 5)) ti += 0.1
    while (!outside.update(0.1, false, 1000, 1000)) to += 0.1
    expect(to).toBeLessThan(ti)
  })

  it('setMinimum raises but never lowers', () => {
    const w = new WantedLevel()
    w.setMinimum(2, 0, 0)
    expect(w.stars).toBe(2)
    w.setMinimum(1, 0, 0)
    expect(w.stars).toBe(2)
  })
})
