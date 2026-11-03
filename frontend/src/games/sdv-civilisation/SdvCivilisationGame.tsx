import { useEffect, useState, type CSSProperties } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { fillWithBots } from './bots'
import { neighbours, type Player } from './setup'
import './sdv-civilisation.css'

const AGES = ['I', 'II', 'III']
const HAND_SIZE = 7
// Distance des sièges au centre de la table, en % de sa taille.
const SEAT_RADIUS = 44

/**
 * Place le siège `index` autour de la table : le joueur 0 en bas, les suivants dans le sens inverse des
 * aiguilles d'une montre, pour que le voisin de droite (index + 1) soit à droite à l'écran.
 */
function seatPosition(index: number, count: number): CSSProperties {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  return {
    left: `${50 + SEAT_RADIUS * Math.cos(angle)}%`,
    top: `${50 - SEAT_RADIUS * Math.sin(angle)}%`,
  }
}

function seatLabel(seat: Player, isMe: boolean, left: Player, right: Player): string {
  const name = isMe ? `${seat.name} (toi)` : seat.name
  const coins = `${seat.coins} pièce${seat.coins > 1 ? 's' : ''}`
  return `${name}, ${coins}, voisin de gauche ${left.name}, voisin de droite ${right.name}`
}

/**
 * Premier écran : la table de jeu, sans partie jouable pour l'instant.
 * Le joueur connecté est assis avec des IA, en attendant le multijoueur.
 */
export default function SdvCivilisationGame({ ctx }: GameProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
  }, [ctx])

  const players = fillWithBots([ctx.player?.username ?? 'Toi'])

  return (
    <div className="sdv-civilisation">
      <div className="card sdv-civilisation-board">
        <div className="sdv-civilisation-table">
          <div className="sdv-civilisation-felt">
            <p className="sdv-civilisation-age">Âge I</p>
            <p className="sdv-civilisation-turn">Tour 1 / 6</p>
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
                  <span className="sdv-civilisation-avatar" aria-hidden="true">
                    {seat.isBot ? 'IA' : seat.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="sdv-civilisation-name" aria-hidden="true">
                    {isMe ? 'Toi' : seat.name}
                  </span>
                  <span className="sdv-civilisation-coins" aria-hidden="true">
                    <span className="sdv-civilisation-coin" />
                    {seat.coins}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="sdv-civilisation-hand">
          <p className="muted">Ta main · {HAND_SIZE} cartes</p>
          <div className="sdv-civilisation-cards">
            {Array.from({ length: HAND_SIZE }, (_, i) => (
              <span key={i} className="sdv-civilisation-card" role="img" aria-label="Carte face cachée" />
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
