import type { CityData } from '../world/city'
import { AIRFIELD, MAP_HALF, MAP_SIZE, WATER_LEVEL } from '../world/constants'
import { mapColors } from './palette'

export const MAP_PX = 2048
const S = MAP_PX / MAP_SIZE

export const toMap = (x: number, z: number) => ({ x: (x + MAP_HALF) * S, y: (z + MAP_HALF) * S })

let cached: HTMLCanvasElement | null = null

/** Pre-rendered top-down map (terrain, blocks, buildings, roads). */
export function mapImage(city: CityData): HTMLCanvasElement {
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = c.height = MAP_PX
  const ctx = c.getContext('2d')!
  // Terrain at 8 m resolution, upscaled.
  const N = 256
  const t = document.createElement('canvas')
  t.width = t.height = N
  const tctx = t.getContext('2d')!
  const img = tctx.createImageData(N, N)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = -MAP_HALF + (i + 0.5) * (MAP_SIZE / N)
      const z = -MAP_HALF + (j + 0.5) * (MAP_SIZE / N)
      const h = city.terrain.heightAt(x, z)
      let r: number, g: number, b: number
      if (h < WATER_LEVEL) {
        const d = Math.min(1, -h / 9)
        ;[r, g, b] = [40 - d * 20, 90 - d * 30, 120 - d * 20]
      } else {
        const k = Math.min(1, h / 80)
        ;[r, g, b] = [70 + k * 60, 95 + k * 40, 60 + k * 30]
      }
      const o = (j * N + i) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = 255
    }
  }
  tctx.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(t, 0, 0, MAP_PX, MAP_PX)

  for (const b of city.blocks) {
    const p = toMap(b.x0, b.z0)
    ctx.fillStyle = b.park ? mapColors.park : b.district === 'port' ? mapColors.portBlock : mapColors.block
    ctx.fillRect(p.x, p.y, (b.x1 - b.x0) * S, (b.z1 - b.z0) * S)
  }
  ctx.fillStyle = mapColors.apron
  const a = toMap(AIRFIELD.apronX - 45, AIRFIELD.apronZ - 70)
  ctx.fillRect(a.x, a.y, 90 * S, 140 * S)
  for (const b of city.buildings) {
    ctx.save()
    const p = toMap(b.x, b.z)
    ctx.translate(p.x, p.y)
    ctx.rotate(-b.rot)
    ctx.fillStyle = b.special ? mapColors.specialBuilding : mapColors.building
    ctx.fillRect(-b.hw * S, -b.hd * S, b.hw * 2 * S, b.hd * 2 * S)
    ctx.restore()
  }
  // Roads
  const g = city.roads.graph
  ctx.lineCap = 'round'
  for (const pass of [0, 1]) {
    for (const e of g.edges) {
      const p0 = toMap(g.nodes[e.a].x, g.nodes[e.a].z)
      const p1 = toMap(g.nodes[e.b].x, g.nodes[e.b].z)
      ctx.strokeStyle = pass === 0 ? mapColors.roadEdge : e.kind === 'highway' ? mapColors.highway : mapColors.road
      ctx.lineWidth = e.width * S * (pass === 0 ? 1.15 : 0.8)
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.stroke()
    }
  }
  const r0 = toMap(AIRFIELD.runwayX, AIRFIELD.minZ)
  ctx.fillStyle = mapColors.runway
  ctx.fillRect(r0.x - (AIRFIELD.width / 2) * S, r0.y, AIRFIELD.width * S, (AIRFIELD.maxZ - AIRFIELD.minZ) * S)
  cached = c
  return c
}
