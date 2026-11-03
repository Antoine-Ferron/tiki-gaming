import type { GameState } from './game'

function coinsText(coins: number): string {
  return `${coins > 0 ? '+' : '−'}${Math.abs(coins)} pièce${Math.abs(coins) > 1 ? 's' : ''}`
}

/** Journal du dernier tour : une ligne par joueur, puis le résultat des conflits en fin d'âge. */
export function TurnLog({ game, me }: { game: GameState; me: number }) {
  if (game.lastTurn.length === 0) return null
  return (
    <section className="sdv-civilisation-log" aria-labelledby="sdv-civilisation-log-title">
      <h3 id="sdv-civilisation-log-title">Dernier tour</h3>
      <ul aria-label="Dernier tour">
        {game.lastTurn.map(({ player, action, card, coins }) => {
          const isMe = player === me
          const who = isMe ? 'Tu' : game.players[player].name
          const verb = action === 'build' ? 'construit' : 'défaussé'
          return (
            <li key={player} className={isMe ? 'sdv-civilisation-me' : undefined}>
              <span className="sdv-civilisation-log-who">
                {who} {isMe ? 'as' : 'a'} {verb}{' '}
              </span>
              <span className={`sdv-civilisation-log-card sdv-civilisation-card-${card.color}`}>{card.name}</span>
              {coins !== 0 && (
                <span className={`sdv-civilisation-log-coins${coins > 0 ? ' sdv-civilisation-gain' : ''}`}>
                  {' '}
                  {coinsText(coins)}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {game.conflicts && (
        <>
          <h3>Conflits de fin d’âge</h3>
          <ul aria-label="Conflits de fin d’âge">
            {game.conflicts.map((tokens, player) => (
              <li key={player}>
                {player === me ? 'Toi' : game.players[player].name} :{' '}
                <strong>
                  {tokens > 0 ? `+${tokens}` : tokens} point{Math.abs(tokens) > 1 ? 's' : ''}
                </strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
