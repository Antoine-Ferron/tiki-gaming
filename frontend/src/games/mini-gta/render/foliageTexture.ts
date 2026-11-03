import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'
import { Rng } from '../core/rng'

/**
 * Procedural foliage atlas (1024²), alpha-tested cards:
 *  - [0,0.5]×[0.5,1]   deciduous leaf cluster
 *  - [0.5,1]×[0.5,1]   conifer branch (needles)
 *  - [0,1]×[0,0.5]     palm frond (rib + leaflets), length along U
 */
export const ATLAS = {
  leaf: { u0: 0, v0: 0.5, u1: 0.5, v1: 1 },
  conifer: { u0: 0.5, v0: 0.5, u1: 1, v1: 1 },
  frond: { u0: 0, v0: 0, u1: 1, v1: 0.5 },
}

let cached: CanvasTexture | null = null

export function foliageAtlas(): CanvasTexture {
  if (cached) return cached
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const rng = new Rng(2024)
  const leafColor = (k: number) => {
    const h = 85 + rng.range(-14, 18)
    const s = 38 + rng.range(-8, 14)
    const l = 24 + k * 14 + rng.range(-5, 6)
    return `hsl(${h}, ${s}%, ${l}%)`
  }

  // --- Deciduous cluster (top-left, canvas y down = texture v up after flipY)
  const drawLeaf = (x: number, y: number, len: number, w: number, a: number, col: string) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(a)
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(w, len * 0.45, 0, len)
    ctx.quadraticCurveTo(-w, len * 0.45, 0, 0)
    ctx.fill()
    ctx.strokeStyle = 'rgba(20,35,10,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 2)
    ctx.lineTo(0, len * 0.9)
    ctx.stroke()
    ctx.restore()
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, 512, 512)
  ctx.clip()
  // Twigs
  ctx.strokeStyle = '#4a3523'
  ctx.lineWidth = 4
  for (let k = 0; k < 6; k++) {
    ctx.beginPath()
    ctx.moveTo(256, 500)
    ctx.quadraticCurveTo(256 + rng.range(-80, 80), 300, 256 + rng.range(-200, 200), rng.range(60, 220))
    ctx.stroke()
  }
  for (let i = 0; i < 260; i++) {
    const r = Math.sqrt(rng.next()) * 220
    const a = rng.range(0, Math.PI * 2)
    const x = 256 + Math.cos(a) * r
    const y = 250 + Math.sin(a) * r * 0.9
    const depth = 1 - r / 240
    drawLeaf(
      x,
      y,
      rng.range(34, 54),
      rng.range(12, 18),
      rng.range(0, Math.PI * 2),
      leafColor(0.4 + depth * 0.8 + rng.range(-0.2, 0.2)),
    )
  }
  ctx.restore()

  // --- Conifer branch (top-right)
  ctx.save()
  ctx.beginPath()
  ctx.rect(512, 0, 512, 512)
  ctx.clip()
  ctx.translate(512, 0)
  ctx.strokeStyle = '#3d2c1c'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(256, 500)
  ctx.lineTo(256, 20)
  ctx.stroke()
  for (let i = 0; i < 1400; i++) {
    const t = rng.next()
    const y = 20 + t * 470
    const side = rng.chance(0.5) ? 1 : -1
    const spread = (1 - Math.abs(t - 0.55) * 1.2) * 230
    const len = rng.range(0.4, 1) * spread
    ctx.strokeStyle = `hsl(${120 + rng.range(-12, 12)}, ${30 + rng.range(0, 15)}%, ${16 + rng.range(0, 14)}%)`
    ctx.lineWidth = rng.range(2, 3.5)
    ctx.beginPath()
    ctx.moveTo(256, y)
    ctx.lineTo(256 + side * len, y + len * 0.45)
    ctx.stroke()
  }
  ctx.restore()

  // --- Palm frond (bottom half): rib along x, leaflets on both sides
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 512, 1024, 512)
  ctx.clip()
  ctx.translate(0, 512)
  ctx.strokeStyle = '#6b6a3a'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(10, 256)
  ctx.lineTo(1010, 256)
  ctx.stroke()
  for (let x = 40; x < 1000; x += 9) {
    const t = x / 1000
    const len = Math.sin(Math.min(1, t * 1.3) * Math.PI) * 230 + 20
    for (const side of [-1, 1]) {
      ctx.strokeStyle = `hsl(${88 + rng.range(-10, 10)}, ${40 + rng.range(-8, 10)}%, ${22 + rng.range(-4, 10)}%)`
      ctx.lineWidth = rng.range(6, 9)
      ctx.beginPath()
      ctx.moveTo(x, 256)
      ctx.quadraticCurveTo(x + 30, 256 + side * len * 0.5, x + 55, 256 + side * len)
      ctx.stroke()
    }
  }
  ctx.restore()

  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearMipmapLinearFilter
  tex.anisotropy = 8
  cached = tex
  return tex
}
