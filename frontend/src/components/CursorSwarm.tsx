import { useEffect, useRef } from 'react'
import { createSwarm, stepSwarm } from '@/lib/swarm'

const COUNT = 42
const COLOR_TOKENS = ['--accent', '--cat-solo', '--cat-duel', '--cat-multi']

/**
 * Décor : un essaim de particules suit le curseur (ou le doigt). Sans pointeur, il se promène au milieu
 * de l'écran. Purement décoratif (aria-hidden, ne capte aucun clic) et absent si
 * `prefers-reduced-motion: reduce`.
 */
export function CursorSwarm() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // jsdom (tests) n'a ni matchMedia ni canvas : on s'arrête avant de les appeler.
    if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return

    const style = getComputedStyle(canvas)
    const colors = COLOR_TOKENS.map((token) => style.getPropertyValue(token).trim())
    const swarm = createSwarm(COUNT, { width: innerWidth, height: innerHeight })
    let pointer: { x: number; y: number } | null = null
    let frame = 0
    let last = performance.now()

    const resize = () => {
      const dpr = devicePixelRatio || 1
      canvas.width = innerWidth * dpr
      canvas.height = innerHeight * dpr
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (now: number) => {
      const t = now / 1000
      const target = pointer ?? {
        x: innerWidth / 2 + Math.cos(t * 0.7) * innerWidth * 0.3,
        y: innerHeight / 2 + Math.sin(t * 1.1) * innerHeight * 0.25,
      }
      stepSwarm(swarm, target, (now - last) / 1000)
      last = now

      // Efface en partie l'image précédente : les particules laissent une courte traînée.
      g.globalCompositeOperation = 'destination-out'
      g.fillStyle = 'rgba(0, 0, 0, 0.25)'
      g.fillRect(0, 0, innerWidth, innerHeight)
      g.globalCompositeOperation = 'lighter'
      swarm.forEach((p, i) => {
        g.fillStyle = colors[i % colors.length]
        g.beginPath()
        g.arc(p.x, p.y, 1.6 + (i % 3) * 0.7, 0, Math.PI * 2)
        g.fill()
      })
      frame = requestAnimationFrame(draw)
    }

    const onMove = (e: PointerEvent) => (pointer = { x: e.clientX, y: e.clientY })
    const onLeave = () => (pointer = null)
    resize()
    addEventListener('resize', resize)
    addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('resize', resize)
      removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return <canvas ref={ref} className="cursor-swarm" aria-hidden="true" />
}
