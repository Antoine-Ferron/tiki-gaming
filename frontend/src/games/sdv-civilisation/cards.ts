import type { Resource } from './ports'

export type Age = 1 | 2 | 3
export type CardColor = 'brown' | 'grey' | 'blue' | 'red' | 'green' | 'yellow' | 'purple'
export type ScienceSymbol = 'tablet' | 'gear' | 'compass'

export interface Cost {
  coins?: number
  resources?: Resource[]
}

/** Une carte bâtiment, telle que le serveur la décrit (catalogue : backend, Cards.java). */
export interface Card {
  name: string
  age: Age
  color: CardColor
  cost: Cost
  /** Bâtiment déjà construit qui rend celui-ci gratuit (chaîne de construction). */
  chainFrom?: string
  produces?: Resource[]
  points?: number
  shields?: number
  science?: ScienceSymbol
  coins?: number
  /** Guilde : 1 point par carte de ces couleurs chez les deux voisins. */
  guild?: CardColor[]
}
