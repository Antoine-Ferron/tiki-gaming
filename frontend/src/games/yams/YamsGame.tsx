import type { GameProps } from '../types'
import { CATEGORY_LABELS, LOWER_CATEGORIES, UPPER_CATEGORIES } from './logic'
import './yams.css'

/**
 * Écran du Yams — squelette.
 * Aucune règle ici : tout le calcul vient de ./logic.ts, couvert par logic.test.ts.
 * À brancher au fur et à mesure que les cycles TDD passent au vert.
 */
export default function YamsGame({ ctx }: GameProps) {
  return (
    <div className="yams">
      <p className="muted">
        {ctx.isGuest ? 'Tu joues en invité : ton score ne sera pas classé.' : `Bonne partie, ${ctx.player?.username} !`}
      </p>

      <div className="card yams-sheet">
        <h2>Feuille de score</h2>
        <ul className="yams-categories">
          {[...UPPER_CATEGORIES, ...LOWER_CATEGORIES].map((category) => (
            <li key={category} className="yams-category">
              <span>{CATEGORY_LABELS[category]}</span>
              <span className="muted">—</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="notice">Les dés et la saisie des combinaisons arrivent avec les prochains cycles TDD.</p>
    </div>
  )
}
