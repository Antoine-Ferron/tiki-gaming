import type { Card } from './cards'
import { payment, type Action, type GameState } from './game'
import type { CurrencyConverter } from './ports'

/** Intérêt d'une carte pour l'IA : points, boucliers et science d'abord, puis ressources et pièces. */
function value(card: Card): number {
  return (
    (card.points ?? 0) +
    2 * (card.shields ?? 0) +
    (card.science ? 3 : 0) +
    (card.produces?.length ?? 0) +
    (card.coins ?? 0) / 3
  )
}

/** IA basique : construit la carte payable la plus intéressante, sinon défausse la moins intéressante. */
export function chooseAction(state: GameState, index: number, converter: CurrencyConverter): Action {
  const byValue = [...state.hands[index]].sort((a, b) => value(b) - value(a))
  const best = byValue.find((card) => payment(state, index, card, converter).ok)
  return best ? { type: 'build', card: best.name } : { type: 'discard', card: byValue[byValue.length - 1].name }
}
