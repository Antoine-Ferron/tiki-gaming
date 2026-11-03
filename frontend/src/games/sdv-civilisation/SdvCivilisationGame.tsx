import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { fillWithBots } from './bots'
import { neighbours, type Player } from './setup'
import './sdv-civilisation.css'

const AGES = ['I', 'II', 'III']
const HAND_SIZE = 7
const WONDER_STAGES = 3
// Rayons de l'ellipse sur laquelle sont posés les sièges, en % de la table.
const SEAT_RADIUS_X = 41
const SEAT_RADIUS_Y = 39

/**
 * Place le siège `index` autour de la table : le joueur 0 en bas, les suivants dans le sens inverse des
 * aiguilles d'une montre, pour que le voisin de droite (index + 1) soit à droite à l'écran.
 */
function seatPosition(index: number, count: number): CSSProperties {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  return {
    left: `${50 + SEAT_RADIUS_X * Math.cos(angle)}%`,
    top: `${50 - SEAT_RADIUS_Y * Math.sin(angle)}%`,
  }
}

function seatLabel(seat: Player, isMe: boolean, left: Player, right: Player): string {
  const name = isMe ? `${seat.name} (toi)` : seat.name
  const coins = `${seat.coins} pièce${seat.coins > 1 ? 's' : ''}`
  return `${name}, ${coins}, voisin de gauche ${left.name}, voisin de droite ${right.name}`
}

/** Bascule le plateau en plein écran (API Fullscreen du navigateur). */
function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [ref])

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void ref.current?.requestFullscreen()
  }

  return { active, supported: Boolean(document.fullscreenEnabled), toggle }
}

/**
 * Premier écran : la table de jeu, sans partie jouable pour l'instant.
 * Le joueur connecté est assis avec des IA, en attendant le multijoueur.
 */
export default function SdvCivilisationGame({ ctx }: GameProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(boardRef)

  useEffect(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
  }, [ctx])

  const players = fillWithBots([ctx.player?.username ?? 'Toi'])

  return (
    <div className="sdv-civilisation">
      <div ref={boardRef} className="sdv-civilisation-board">
        <div className="sdv-civilisation-toolbar">
          <p className="sdv-civilisation-status">
            Tour <strong>1</strong> / 6
          </p>
          {fullscreen.supported && (
            <button type="button" className="small" onClick={fullscreen.toggle}>
              {fullscreen.active ? 'Quitter le plein écran' : 'Plein écran'}
            </button>
          )}
        </div>

        <div className="sdv-civilisation-table">
          <div className="sdv-civilisation-felt">
            <p className="sdv-civilisation-age">Âge I</p>
            <div className="sdv-civilisation-decks" aria-hidden="true">
              {AGES.map((age, index) => (
                <span
                  key={age}
                  className={`sdv-civilisation-deck${index === 0 ? ' sdv-civilisation-deck-current' : ''}`}
                >
                  {age}
                </span>
              ))}
            </div>
            <p className="sdv-civilisation-direction">
              <span aria-hidden="true">↻</span> Passage à gauche
            </p>
          </div>

          <ul className="sdv-civilisation-seats" aria-label="Table de jeu">
            {players.map((seat, index) => {
              const { left, right } = neighbours(players, index)
              const isMe = index === 0
              return (
                <li
                  key={seat.name}
                  className={`sdv-civilisation-seat${isMe ? ' sdv-civilisation-seat-me' : ''}`}
                  style={seatPosition(index, players.length)}
                  aria-label={seatLabel(seat, isMe, left, right)}
                >
                  <div className="sdv-civilisation-seat-head" aria-hidden="true">
                    <span className="sdv-civilisation-avatar">
                      {seat.isBot ? 'IA' : seat.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="sdv-civilisation-name">{isMe ? 'Toi' : seat.name}</span>
                  </div>
                  <div className="sdv-civilisation-stats" aria-hidden="true">
                    <span title="Pièces">
                      <span className="sdv-civilisation-coin" />
                      {seat.coins}
                    </span>
                    <span title="Boucliers">⚔ 0</span>
                  </div>
                  <div className="sdv-civilisation-wonder" aria-hidden="true" title="Étapes de merveille">
                    {Array.from({ length: WONDER_STAGES }, (_, i) => (
                      <span key={i} className="sdv-civilisation-stage" />
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="sdv-civilisation-hand">
          <p className="sdv-civilisation-hand-title">Ta main · {HAND_SIZE} cartes</p>
          <div className="sdv-civilisation-cards">
            {Array.from({ length: HAND_SIZE }, (_, i) => (
              <span
                key={i}
                className="sdv-civilisation-card"
                role="img"
                aria-label="Carte face cachée"
                style={{ '--sdv-civilisation-offset': i - (HAND_SIZE - 1) / 2 } as CSSProperties}
              />
            ))}
          </div>
        </div>

        <p className="notice">
          En attendant le multijoueur, les places libres sont prises par des IA. La partie n’est pas encore jouable.
        </p>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
