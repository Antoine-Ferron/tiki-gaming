import { clamp, lerp } from '../core/math'
import { MAP_HALF, TERRAIN_RES } from './constants'

export interface Polyline {
  points: { x: number; z: number }[]
  width: number
}

/**
 * Grille de hauteurs de (n+1)² échantillons, index = ix * (n+1) + iz : exactement le format du
 * heightfield Rapier (lignes le long de Z, colonnes le long de X). Calculée par le backend.
 */
export class Terrain {
  constructor(
    readonly heights: Float32Array,
    readonly n: number,
  ) {
    if (heights.length !== (n + 1) * (n + 1))
      throw new Error(`Grille de hauteurs invalide : ${heights.length} pour n=${n}`)
  }

  heightAt(x: number, z: number): number {
    const fx = clamp((x + MAP_HALF) / TERRAIN_RES, 0, this.n - 1e-6)
    const fz = clamp((z + MAP_HALF) / TERRAIN_RES, 0, this.n - 1e-6)
    const ix = Math.floor(fx)
    const iz = Math.floor(fz)
    const tx = fx - ix
    const tz = fz - iz
    const N = this.n + 1
    const h00 = this.heights[ix * N + iz]
    const h10 = this.heights[(ix + 1) * N + iz]
    const h01 = this.heights[ix * N + iz + 1]
    const h11 = this.heights[(ix + 1) * N + iz + 1]
    // Assez proche de la triangulation de Rapier avec une interpolation bilinéaire.
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz)
  }
}
