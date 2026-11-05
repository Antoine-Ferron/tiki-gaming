/**
 * Adaptateur React de LemurTiki : boucle d'images, clavier, canvas et écrans. Toute la logique est dans domain/.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameProps } from '../types'
import { finishGame, type Finish } from './application/finish'
import { commandOf, inputOf } from './controls'
import { advance } from './domain/advance'
import type { Random } from './domain/branches'
import { type GameOver, type GameState, PX_PER_METER, STEP_S, VIEW_HEIGHT, WORLD_WIDTH } from './domain/game'
import { score } from './domain/score'
import { createGame } from './domain/start'
import { draw } from './render'
import './lemur.css'

type Props = GameProps & { random?: Random }
type Phase = 'menu' | 'playing' | 'paused' | 'over'

const STEP_MS = STEP_S * 1000
/** Au-delà, l'onglet a dormi : on ne rattrape pas des secondes d'un coup. */
const MAX_FRAME_MS = 250
const CAUSES: Record<GameOver, string> = {
  fall: 'Tu es tombé du baobab.',
  fossa: 'La fossa t’a attrapé !',
}

const metersOf = (state: GameState) => Math.floor(state.peakY / PX_PER_METER)

export default function LemurGame({ ctx, random = Math.random }: Readonly<Props>) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [hud, setHud] = useState({ height: 0, score: 0 })
  const [finish, setFinish] = useState<Finish | null>(null)
  const [cause, setCause] = useState<GameOver>('fall')
  const game = useRef<GameState>(createGame(random))
  const elapsed = useRef(0)
  const held = useRef(new Set<string>())
  const canvas = useRef<HTMLCanvasElement>(null)

  const start = useCallback(() => {
    game.current = createGame(random)
    elapsed.current = 0
    held.current.clear()
    setHud({ height: 0, score: 0 })
    setFinish(null)
    setPhase('playing')
  }, [random])

  // Boucle d'images : pas de temps fixe (ENF-2), React ne se re-rend que quand l'affichage change (ENF-3).
  useEffect(() => {
    if (phase !== 'playing') return
    let last: number | null = null
    let pending = 0
    let frame = 0
    const tick = (now: number) => {
      pending += last === null ? 0 : Math.min(now - last, MAX_FRAME_MS)
      last = now
      while (pending >= STEP_MS && !game.current.over) {
        game.current = advance(game.current, inputOf(held.current), random)
        elapsed.current += STEP_MS
        pending -= STEP_MS
      }
      const state = game.current
      const surface = canvas.current?.getContext('2d')
      if (surface) draw(surface, state)
      setHud((h) =>
        h.height === metersOf(state) && h.score === score(state) ? h : { height: metersOf(state), score: score(state) },
      )
      if (state.over) {
        setCause(state.over)
        setPhase('over')
        void finishGame(state, ctx, Math.round(elapsed.current)).then(setFinish)
      } else {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, ctx, random])

  // Clavier : direction tenue, et pause qui bascule (EF-7.3, EF-7.5).
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'paused') return
    const down = (e: KeyboardEvent) => {
      const command = commandOf(e.key)
      if (!command) return
      e.preventDefault()
      if (command === 'pause') {
        if (!e.repeat) setPhase((p) => (p === 'playing' ? 'paused' : 'playing'))
      } else {
        held.current.add(e.key)
      }
    }
    const up = (e: KeyboardEvent) => held.current.delete(e.key)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [phase])

  // EF-7.6 : onglet masqué, partie en pause.
  useEffect(() => {
    if (phase !== 'playing') return
    const onHide = () => {
      if (document.visibilityState === 'hidden') setPhase('paused')
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [phase])

  if (phase === 'menu') {
    return (
      <section className="lemur lemur-menu">
        <h2>LemurTiki</h2>
        <p>Grimpe le baobab de branche en branche avec le maki, sans te faire rattraper par la fossa.</p>
        <ul className="lemur-help">
          <li>Le maki rebondit tout seul sur les branches.</li>
          <li>Flèches ou Q / D (A / D en QWERTY) pour le diriger ; les bords de l’écran sont reliés.</li>
          <li>Échap ou P pour la pause.</li>
        </ul>
        <button type="button" className="lemur-play" onClick={start}>
          Jouer
        </button>
      </section>
    )
  }

  return (
    <section className="lemur">
      {phase !== 'over' && (
        <div className="lemur-hud">
          <p>Hauteur : {hud.height} m</p>
          <p>Score : {hud.score}</p>
          {phase === 'playing' && (
            <button type="button" onClick={() => setPhase('paused')}>
              Pause
            </button>
          )}
        </div>
      )}
      <div className="lemur-stage">
        <canvas
          ref={canvas}
          className="lemur-canvas"
          width={WORLD_WIDTH}
          height={VIEW_HEIGHT}
          role="img"
          aria-label={`Le maki grimpe le baobab, à ${hud.height} m`}
        />
        {phase === 'paused' && (
          <div className="lemur-overlay">
            <h3>Pause</h3>
            <button type="button" onClick={() => setPhase('playing')}>
              Reprendre
            </button>
          </div>
        )}
        {phase === 'over' && (
          <div className="lemur-overlay">
            <h3>Partie terminée</h3>
            <p>{CAUSES[cause]}</p>
            <p>Score : {hud.score}</p>
            <p>Hauteur atteinte : {hud.height} m</p>
            {finish?.message && <p role="status">{finish.message}</p>}
            <button type="button" onClick={start}>
              Rejouer
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
