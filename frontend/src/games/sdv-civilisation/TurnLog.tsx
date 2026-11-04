import type { Age } from './cards'
import { AGES, signed } from './cardText'
import type { PlayerState, TurnEvent } from './game'

/** Un tour joué, gardé pour le journal de la partie. */
export interface TurnRecord {
  age: Age
  turn: number
  events: TurnEvent[]
  conflicts: number[] | null
}

const VERBS: Record<TurnEvent['action'], [string, string]> = {
  build: ['as construit', 'a construit'],
  wonder: ['as bâti une étape de merveille avec', 'a bâti une étape de merveille avec'],
  discard: ['as défaussé', 'a défaussé'],
}

function coinsText(coins: number): string {
  return `${signed(coins)} pièce${Math.abs(coins) > 1 ? 's' : ''}`
}

/** Journal de la partie, du tour le plus récent au plus ancien : une ligne par joueur, puis les conflits. */
export function TurnLog({ history, players, me }: { history: TurnRecord[]; players: PlayerState[]; me: number }) {
  const name = (player: number) => (player === me ? 'Tu' : players[player].name)
  return (
    <section className="sdv-civilisation-log" aria-labelledby="sdv-civilisation-log-title">
      <h3 id="sdv-civilisation-log-title">Journal</h3>
      {history.length === 0 && <p className="muted">Les actions de chaque tour s’afficheront ici.</p>}
      <ol className="sdv-civilisation-log-turns">
        {history.map((record) => (
          <li key={`${record.age}-${record.turn}`}>
            <p className="sdv-civilisation-log-title">
              Âge {AGES[record.age - 1]} · Tour {record.turn}
            </p>
            <ul aria-label={`Âge ${AGES[record.age - 1]}, tour ${record.turn}`}>
              {record.events.map(({ player, action, card, coins }) => (
                <li key={player} className={player === me ? 'sdv-civilisation-me' : undefined}>
                  <span className="sdv-civilisation-log-who">
                    {name(player)} {VERBS[action][player === me ? 0 : 1]}{' '}
                  </span>
                  <span className={`sdv-civilisation-log-card sdv-civilisation-card-${card.color}`}>{card.name}</span>
                  {coins !== 0 && (
                    <span className={`sdv-civilisation-log-coins${coins > 0 ? ' sdv-civilisation-gain' : ''}`}>
                      {' '}
                      {coinsText(coins)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {record.conflicts && (
              <p className="sdv-civilisation-log-conflicts">
                <strong>Conflits :</strong>{' '}
                {record.conflicts
                  .map((tokens, player) => `${player === me ? 'toi' : players[player].name} ${signed(tokens)}`)
                  .join(' · ')}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
