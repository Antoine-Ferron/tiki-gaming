import { describe, expect, it } from 'vitest'
import { cityFromDto, decodeFloat32 } from './city'
import { Navigation } from './navigation'
import { TERRAIN_CELLS } from './constants'

/** Encode un Float32Array comme le backend (petit-boutiste, base64). */
function encode(values: Float32Array): string {
  const bytes = new Uint8Array(values.length * 4)
  const view = new DataView(bytes.buffer)
  values.forEach((v, i) => view.setFloat32(i * 4, v, true))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** Monde minimal au format de GET /api/world : un carré de quatre rues. */
function tinyWorld() {
  const n = TERRAIN_CELLS
  const heights = new Float32Array((n + 1) * (n + 1))
  heights[256 * (n + 1) + 256] = 4 // un relief au centre de la carte
  const pts = [
    [0, 0],
    [200, 0],
    [200, 200],
    [0, 200],
  ]
  const nodes = pts.map(([x, z], id) => ({
    id,
    x,
    z,
    y: 0,
    edges: [id, (id + 3) % 4],
    light: false,
    lightOffset: 0,
    radius: 0,
    square: true,
  }))
  const edges = pts.map((_, id) => ({
    id,
    a: id,
    b: (id + 1) % 4,
    kind: 'street',
    lanes: 1,
    width: 12,
    speed: 13,
    length: 200,
  }))
  return {
    seed: 7,
    terrain: { n, heights: encode(heights) },
    roads: {
      nodes,
      edges,
      xs: [0, 200],
      zs: [0, 200],
      kindX: ['street', 'street'],
      kindZ: ['street', 'street'],
      hillLines: [],
      hillNodeIds: [],
      airfieldEnd: 0,
    },
    blocks: [],
    buildings: [],
    props: [],
    containers: [],
    cranes: [],
    parking: [],
    sidewalk: [],
    locations: { spawn: { x: 1, y: 0, z: 2, heading: 3 } },
  }
}

describe('cityFromDto', () => {
  it('décode le relief envoyé en Float32 base64', () => {
    const values = new Float32Array([0, 1.5, -9, 123.25])
    expect([...decodeFloat32(encode(values))]).toEqual([0, 1.5, -9, 123.25])
  })

  it('reconstruit un terrain interrogeable', () => {
    const city = cityFromDto(tinyWorld())
    expect(city.terrain.heightAt(0, 0)).toBeCloseTo(4)
    expect(city.terrain.heightAt(2, 0)).toBeCloseTo(2) // interpolation à mi-cellule
    expect(city.terrain.heightAt(500, 500)).toBe(0)
  })

  it('reconstruit un graphe routier exploitable par la navigation locale', () => {
    const city = cityFromDto(tinyWorld())
    const g = city.roads.graph
    expect(g.other(g.edges[0], 0).id).toBe(1)
    expect(g.lanePoint(g.edges[0], 1, 0, 100).x).toBeCloseTo(100)
    const nav = new Navigation(g)
    expect(nav.findPath(0, 2)).toHaveLength(3)
    expect(city.locations.spawn.heading).toBe(3)
  })

  it('refuse une grille de hauteurs de mauvaise taille', () => {
    const w = tinyWorld()
    w.terrain.heights = encode(new Float32Array(10))
    expect(() => cityFromDto(w)).toThrow(/Grille de hauteurs invalide/)
  })
})
