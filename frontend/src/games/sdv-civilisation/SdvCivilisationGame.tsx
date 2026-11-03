import { useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { createPlayers, MIN_PLAYERS, neighbours } from './setup'
import './sdv-civilisation.css'

/**
 * Premier écran : la table de jeu, sans partie jouable pour l'instant.
 * Le joueur connecté est assis avec des places libres, en attendant le multijoueur.
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

  const me = ctx.player?.username ?? 'Toi'
  const seats = Array.from({ length: MIN_PLAYERS - 1 }, (_, i) => `Place libre ${i + 2}`)
  const players = createPlayers([me, ...seats])

  return (
    <div className="sdv-civilisation">
      <div className="card">
        <h2>Âge 1 · Tour 1</h2>
        <p className="muted">Les mains passent vers la gauche.</p>
        <table className="sdv-civilisation-table">
          <caption>Table de jeu</caption>
          <thead>
            <tr>
              <th scope="col">Joueur</th>
              <th scope="col">Pièces</th>
              <th scope="col">Voisin de gauche</th>
              <th scope="col">Voisin de droite</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              const { left, right } = neighbours(players, index)
              return (
                <tr key={player.name} className={index === 0 ? 'sdv-civilisation-me' : undefined}>
                  <th scope="row">{index === 0 ? `${player.name} (toi)` : player.name}</th>
                  <td>{player.coins}</td>
                  <td>{left.name}</td>
                  <td>{right.name}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="notice">En attente des autres joueurs : la partie n’est pas encore jouable.</p>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
