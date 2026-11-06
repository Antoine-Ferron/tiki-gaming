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

  // Frontière exacte du premier seuil (0,5) : une agression (1) l'atteint, la moitié d'une ne l'atteint pas.
  it.each([
    [0.49, 0],
    [0.5, 1],
    [4.99, 1],
    [5, 2],
    [36, 5],
  ])('heat %s gives %s star(s)', (heat, stars) => {
    expect(new WantedLevel().starsFor(heat)).toBe(stars)
  })

  it('a crime that raises the level moves the search to the crime and restarts the hiding timer', () => {
    const w = new WantedLevel()
    w.commit('assault', 0, 0, true)
    w.update(5, false, 0, 0)
    expect(w.searching).toBe(true)

    w.commit('killCop', 30, 40, true)

    expect(w.stars).toBe(2)
    expect(w.lastSeen).toEqual({ x: 30, z: 40 })
    expect(w.unseen).toBe(0)
    expect(w.searching).toBe(false)
  })

  it('a crime that keeps the same level leaves the search where it was', () => {
    const w = new WantedLevel()
    w.commit('assault', 0, 0, true)
    w.update(5, false, 0, 0)

    w.commit('assault', 30, 40, true)

    expect(w.stars).toBe(1)
    expect(w.lastSeen).toEqual({ x: 0, z: 0 })
    expect(w.unseen).toBe(5)
    expect(w.searching).toBe(true)
  })

  it('remembers the highest level reached, even after it is lost', () => {
    const w = new WantedLevel()
    w.commit('killCop', 0, 0, true)
    w.clear()

    w.commit('assault', 0, 0, true)

    expect(w.stars).toBe(1)
    expect(w.maxStars).toBe(2)
  })

  it('setMinimum sets the heat of that level, the search point and stops the search', () => {
    const w = new WantedLevel()
    w.commit('assault', 0, 0, true)
    w.update(5, false, 0, 0)

    w.setMinimum(3, 70, 80)

    expect(w.heat).toBe(12)
    expect(w.lastSeen).toEqual({ x: 70, z: 80 })
    expect(w.unseen).toBe(0)
    expect(w.searching).toBe(false)
    expect(w.maxStars).toBe(3)
  })

  it('setMinimum at the current level changes nothing', () => {
    const w = new WantedLevel()
    w.setMinimum(2, 0, 0)
    w.update(5, false, 0, 0)

    w.setMinimum(2, 70, 80)

    expect(w.lastSeen).toEqual({ x: 0, z: 0 })
    expect(w.unseen).toBe(5)
    expect(w.searching).toBe(true)
  })
})
