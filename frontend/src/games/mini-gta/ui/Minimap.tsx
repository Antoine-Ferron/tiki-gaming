import { useEffect, useRef } from 'react'
import { getGame } from '../game/GameRoot'
import { gpsPath, gpsTarget } from './gps'
import { mapImage, MAP_PX, toMap } from './mapImage'
import { MAP_SIZE } from '../world/constants'
import { mapColors } from './palette'

const SIZE = 210

/** Rotating minimap: map, GPS route, blips, wanted search area. */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const game = getGame()
      const canvas = ref.current
      if (!game || !canvas) return
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      const ctx = canvas.getContext('2d')!
      const img = mapImage(game.city)
      const p = game.player.position
      const v = game.player.vehicle
      // Pixels on screen per map pixel.
      const metersPerPx = MAP_SIZE / MAP_PX
      const radiusM = v ? 140 + Math.min(220, Math.abs(v.speed) * 6) : 110
      const zoom = (SIZE / 2 / radiusM) * metersPerPx
      const yaw = game.cameraCtl.yaw
      const mp = toMap(p.x, p.z)
      ctx.save()
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.beginPath()
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = mapColors.background
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.translate(SIZE / 2, SIZE / 2)
      ctx.rotate(yaw + Math.PI)
      ctx.scale(zoom, zoom)
      ctx.translate(-mp.x, -mp.y)
      ctx.drawImage(img, 0, 0)

      // Wanted search area
      const w = game.police.wanted
      if (w.stars > 0) {
        const c = toMap(w.lastSeen.x, w.lastSeen.z)
        const blink = Math.floor(now / 400) % 2 === 0
        ctx.fillStyle = blink ? mapColors.searchRed : mapColors.searchBlue
        ctx.beginPath()
        ctx.arc(c.x, c.y, w.searchRadius / metersPerPx, 0, Math.PI * 2)
        ctx.fill()
      }
      // GPS route
      const route = gpsPath(game, dt)
      const target = gpsTarget(game)
      if (route.length) {
        ctx.strokeStyle = target?.kind === 'mission' ? mapColors.mission : mapColors.waypoint
        ctx.lineWidth = 7 / metersPerPx
        ctx.lineJoin = 'round'
        ctx.beginPath()
        const s = toMap(p.x, p.z)
        ctx.moveTo(s.x, s.y)
        for (const q of route) {
          const m = toMap(q.x, q.z)
          ctx.lineTo(m.x, m.y)
        }
        ctx.stroke()
      }
      ctx.restore()

      // Blips (screen space, unrotated glyphs)
      const cosr = Math.cos(yaw + Math.PI)
      const sinr = Math.sin(yaw + Math.PI)
      const scale = zoom / metersPerPx
      const toScreen = (x: number, z: number, clamp = false) => {
        const dx = (x - p.x) * scale
        const dz = (z - p.z) * scale
        let sx = dx * cosr - dz * sinr
        let sy = dx * sinr + dz * cosr
        const len = Math.hypot(sx, sy)
        const max = SIZE / 2 - 9
        if (len > max) {
          if (!clamp) return null
          sx = (sx / len) * max
          sy = (sy / len) * max
        }
        return { x: SIZE / 2 + sx, y: SIZE / 2 + sy }
      }
      const dot = (x: number, z: number, color: string, r = 4, clamp = false) => {
        const s = toScreen(x, z, clamp)
        if (!s) return
        ctx.fillStyle = color
        ctx.strokeStyle = mapColors.outline
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      const glyph = (x: number, z: number, text: string, color: string, clamp = true) => {
        const s = toScreen(x, z, clamp)
        if (!s) return
        ctx.fillStyle = mapColors.glyphText
        ctx.beginPath()
        ctx.arc(s.x, s.y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = color
        ctx.font = 'bold 11px system-ui'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, s.x, s.y + 0.5)
      }
      const L = game.city.locations
      glyph(L.safehouseDoor.x, L.safehouseDoor.z, '⌂', mapColors.safehouse)
      glyph(L.gunshopDoor.x, L.gunshopDoor.z, '✦', mapColors.gunshop, false)
      glyph(L.hospital.x, L.hospital.z, 'H', mapColors.hospital, false)
      glyph(L.policeStation.x, L.policeStation.z, 'P', mapColors.police, false)
      glyph(L.heliSpawn.x, L.heliSpawn.z, '✈', mapColors.airfield, false)
      if (!game.missions.active)
        for (const d of game.missions.available()) glyph(d.giver.x, d.giver.z, 'M', mapColors.mission)
      for (const it of game.pickups.list()) dot(it.x, it.z, mapColors.pickup, 2.5)
      for (const a of game.police.actors())
        if (!a.dead)
          dot(a.position.x, a.position.z, Math.floor(now / 250) % 2 ? mapColors.sirenRed : mapColors.sirenBlue, 3.5)
      for (const veh of game.vehicles)
        if (veh.tags.has('police') && !veh.destroyed)
          dot(
            veh.position.x,
            veh.position.z,
            Math.floor(now / 250) % 2 ? mapColors.sirenRed : mapColors.sirenBlue,
            4.5,
            true,
          )
      for (const a of game.missions.actors()) if (!a.dead) dot(a.position.x, a.position.z, mapColors.enemy, 3.5)
      if (target) {
        const s = toScreen(target.x, target.z, true)
        if (s) {
          ctx.fillStyle = target.kind === 'mission' ? mapColors.mission : mapColors.waypoint
          ctx.strokeStyle = mapColors.outline
          ctx.beginPath()
          ctx.arc(s.x, s.y, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
      // Player arrow
      const h = v ? v.heading() : game.player.actor.heading
      const rel = h - yaw
      ctx.save()
      ctx.translate(SIZE / 2, SIZE / 2)
      ctx.rotate(-rel)
      ctx.fillStyle = mapColors.player
      ctx.strokeStyle = mapColors.outline
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.lineTo(6, 7)
      ctx.lineTo(0, 3)
      ctx.lineTo(-6, 7)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      // North marker
      const n = toScreen(p.x, p.z - 10000, true)
      if (n) {
        ctx.fillStyle = mapColors.player
        ctx.font = 'bold 12px system-ui'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('N', n.x, n.y)
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} className="mini-gta-minimap" width={SIZE} height={SIZE} />
}
