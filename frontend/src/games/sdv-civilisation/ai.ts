import type { Card } from './cards'
import { payment, wonderPayment, type Action, type GameState } from './game'
import type { CurrencyConverter } from './ports'

/** Intérêt d'une carte pour l'IA : points, boucliers, science et guildes d'abord, puis ressources et pièces. */
function value(card: Card): number {
  return (
    (card.points ?? 0) +
    2 * (card.shields ?? 0) +
    (card.science ? 3 : 0) +
    (card.guild ? 3 : 0) +
    (card.produces?.length ?? 0) +
    (card.coins ?? 0) / 3
  )
}

/**
 * IA basique : construit le bâtiment payable le plus intéressant ; sinon construit une étape de sa merveille avec
 * la carte la moins intéressante ; sinon la défausse.
 */
export function chooseAction(state: GameState, index: number, converter: CurrencyConverter): Action {
  const byValue = [...state.hands[index]].sort((a, b) => value(b) - value(a))
  const best = byValue.find((card) => payment(state, index, card, converter).ok)
  if (best) return { type: 'build', card: best.name }
  const worst = byValue[byValue.length - 1].name
  return { type: wonderPayment(state, index, converter).ok ? 'wonder' : 'discard', card: worst }
}
