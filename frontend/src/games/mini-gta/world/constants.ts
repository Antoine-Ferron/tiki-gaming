/** World layout (meters). X = east, Z = south, Y = up. North is -Z. */
export const MAP_HALF = 1024
export const MAP_SIZE = MAP_HALF * 2
export const TERRAIN_RES = 4
export const TERRAIN_CELLS = MAP_SIZE / TERRAIN_RES
export const CHUNK_SIZE = 256
export const CHUNKS_PER_SIDE = MAP_SIZE / CHUNK_SIZE
export const WATER_LEVEL = -0.6
export const LANE_WIDTH = 3.5
export const SIDEWALK_WIDTH = 4
export const SLAB_HEIGHT = 0.15

export const RING = { minX: -760, maxX: 760, minZ: -560, maxZ: 860, radius: 70 }
export const PORT = { maxX: -420, minZ: 200, quayMinZ: 260, quayMaxZ: 760 }
export const AIRFIELD = { runwayX: 905, minZ: -420, maxZ: 520, width: 46, apronX: 835, apronZ: 0 }

export type RoadKind = 'street' | 'avenue' | 'highway' | 'hill'

export type District = 'downtown' | 'commercial' | 'suburb' | 'port' | 'hills' | 'airfield'

export function shoreX(z: number): number {
  if (z > PORT.quayMinZ && z < PORT.quayMaxZ) return -830
  return -830 + 16 * Math.sin(z * 0.006) + 9 * Math.sin(z * 0.017 + 1)
}

export function chunkIndexOf(x: number, z: number): number {
  const cx = Math.min(CHUNKS_PER_SIDE - 1, Math.max(0, Math.floor((x + MAP_HALF) / CHUNK_SIZE)))
  const cz = Math.min(CHUNKS_PER_SIDE - 1, Math.max(0, Math.floor((z + MAP_HALF) / CHUNK_SIZE)))
  return cz * CHUNKS_PER_SIDE + cx
}

export function chunkCenter(index: number): { x: number; z: number } {
  const cx = index % CHUNKS_PER_SIDE
  const cz = Math.floor(index / CHUNKS_PER_SIDE)
  return {
    x: -MAP_HALF + (cx + 0.5) * CHUNK_SIZE,
    z: -MAP_HALF + (cz + 0.5) * CHUNK_SIZE,
  }
}
