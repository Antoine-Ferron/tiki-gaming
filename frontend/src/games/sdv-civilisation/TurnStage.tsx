import type { Step } from './animation'
import type { Age } from './cards'
import { AGES, duel, signed } from './cardText'
import { ME, type GameView } from './game'

/**
 * Fin d'âge racontée en grand, au milieu de l'écran : un duel puis l'autre, puis l'âge suivant (ou la fin de la
 * partie). `age` : l'âge qui se termine ; `after` : la partie telle que le serveur l'a renvoyée.
 */
export function TurnStage({ step, age, after }: { step: Step | undefined; age: Age; after: GameView }) {
  if (step === 'age') {
    return (
      <div className="sdv-civilisation-stage sdv-civilisation-stage-age" aria-label="Changement d’âge">
        <span className="sdv-civilisation-stage-kicker">Fin de l’âge {AGES[age - 1]}</span>
        <strong>{after.over ? 'Fin de la partie' : `Âge ${AGES[after.age - 1]}`}</strong>
      </div>
    )
  }
  if (step !== 'duel-left' && step !== 'duel-right') return null

  const me = after.players[ME]
  const shieldsOf = (name: string) => after.players.find((p) => p.name === name)!.shields
  return (
    <div className="sdv-civilisation-stage" aria-label="Conflits militaires">
      <span className="sdv-civilisation-stage-kicker">Conflits militaires · Âge {AGES[age - 1]}</span>
      <ul>
        {me.tokens.slice(-2, step === 'duel-left' ? -1 : undefined).map((token) => {
          const result = duel(token.value, 0)
          return (
            <li key={token.against} className={`sdv-civilisation-duel-${result.kind}`}>
              Contre {token.against} : {me.shields} contre {shieldsOf(token.against)} —{' '}
              <strong>
                {result.label}
                {token.value !== 0 && ` ${signed(token.value)}`}
              </strong>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
