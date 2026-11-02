import type { GameProps } from '../types'
import { FLEET } from './logic'

/**
 * Règles de jeu et tests en place (voir ./logic.ts et ./logic.test.ts).
 * Interface de jeu à venir.
 */
export default function BatailleNavaleGame({ ctx: _ctx }: GameProps) {
  return (
    <div className="card">
      <h2>Bataille navale</h2>
      <p className="muted">
        Flotte : {FLEET.map((s) => `${s.name} (${s.size})`).join(', ')}. Interface à venir.
      </p>
    </div>
  )
}
