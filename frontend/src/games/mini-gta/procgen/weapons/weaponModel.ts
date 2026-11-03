/* v8 ignore file -- rendu visuel (WebGL, shaders, géométries, canvas) : vérifié à l'écran, sans règle de jeu. Voir docs/games/mini-gta/regles.md § 6. */
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Mesh, SphereGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { metalPropMaterial } from '../../render/materials'
import type { WeaponId } from '../../systems/weapons'

type Col = [number, number, number]
const DARK: Col = [0.08, 0.08, 0.09]
const STEEL: Col = [0.3, 0.31, 0.33]
const WOOD: Col = [0.38, 0.22, 0.1]

function part(g: BufferGeometry, c: Col) {
  const geo = g.toNonIndexed()
  geo.deleteAttribute('uv')
  const n = geo.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set(c, i * 3)
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return geo
}
const b = (w: number, h: number, l: number, x: number, y: number, z: number, c: Col) =>
  part(new BoxGeometry(w, h, l).translate(x, y, z), c)

const cache = new Map<WeaponId, BufferGeometry | null>()

/** Geometry with the barrel along +Z and the grip at the origin. */
function geometry(id: WeaponId): BufferGeometry | null {
  if (cache.has(id)) return cache.get(id)!
  let parts: BufferGeometry[]
  switch (id) {
    case 'pistol':
      parts = [b(0.035, 0.11, 0.04, 0, -0.04, 0, DARK), b(0.04, 0.05, 0.2, 0, 0.03, 0.06, STEEL)]
      break
    case 'rifle':
      parts = [
        b(0.05, 0.08, 0.55, 0, 0.03, 0.18, DARK),
        b(0.03, 0.03, 0.25, 0, 0.04, 0.55, STEEL),
        b(0.04, 0.14, 0.05, 0, -0.06, 0.12, DARK),
        b(0.045, 0.09, 0.22, 0, 0.0, -0.18, DARK),
        b(0.03, 0.05, 0.12, 0, 0.1, 0.15, DARK),
      ]
      break
    case 'shotgun':
      parts = [
        b(0.05, 0.07, 0.5, 0, 0.03, 0.2, STEEL),
        b(0.05, 0.06, 0.3, 0, -0.02, 0.3, WOOD),
        b(0.05, 0.1, 0.28, 0, -0.01, -0.15, WOOD),
      ]
      break
    case 'sniper':
      parts = [
        b(0.045, 0.07, 0.75, 0, 0.03, 0.25, DARK),
        b(0.025, 0.025, 0.3, 0, 0.04, 0.75, STEEL),
        part(new CylinderGeometry(0.03, 0.03, 0.3, 8).rotateX(Math.PI / 2).translate(0, 0.11, 0.2), DARK),
        b(0.045, 0.1, 0.25, 0, -0.01, -0.2, WOOD),
      ]
      break
    case 'bat':
      parts = [part(new CylinderGeometry(0.035, 0.018, 0.85, 8).rotateX(Math.PI / 2).translate(0, 0, 0.36), WOOD)]
      break
    case 'grenade':
      parts = [part(new SphereGeometry(0.045, 8, 6).translate(0, 0, 0.03), [0.2, 0.28, 0.15])]
      break
    default:
      cache.set(id, null)
      return null
  }
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  cache.set(id, g)
  return g
}

/** Mesh to parent to the right hand bone (hand points down -Y in rest pose). */
export function buildWeaponMesh(id: WeaponId): Mesh | null {
  const g = geometry(id)
  if (!g) return null
  const m = new Mesh(g, metalPropMaterial)
  m.rotation.x = Math.PI / 2
  m.position.set(0, -0.08, 0.02)
  m.castShadow = true
  return m
}
