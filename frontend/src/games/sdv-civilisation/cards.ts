import type { Resource } from './ports'

export type Age = 1 | 2 | 3
export type CardColor = 'brown' | 'grey' | 'blue' | 'red' | 'green' | 'yellow' | 'purple'
export type ScienceSymbol = 'tablet' | 'gear' | 'compass'

export interface Cost {
  coins?: number
  resources?: Resource[]
}

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

/**
 * Catalogue de la version contre IA (créations du jeu) : 7 cartes par âge, chacune en un exemplaire par joueur.
 * Voir docs/games/sdv-civilisation/regles.md#version-contre-ia
 */
export const CARDS_BY_AGE: Record<Age, Card[]> = {
  1: [
    { name: 'Chantier', age: 1, color: 'brown', cost: {}, produces: ['wood'] },
    { name: 'Cavité', age: 1, color: 'brown', cost: {}, produces: ['stone'] },
    { name: 'Filon', age: 1, color: 'brown', cost: { coins: 1 }, produces: ['ore'] },
    { name: 'Verrerie', age: 1, color: 'grey', cost: {}, produces: ['glass'] },
    { name: 'Bains', age: 1, color: 'blue', cost: { resources: ['stone'] }, points: 3 },
    { name: 'Palissade', age: 1, color: 'red', cost: { resources: ['wood'] }, shields: 1 },
    { name: 'Atelier', age: 1, color: 'green', cost: { resources: ['glass'] }, science: 'gear' },
  ],
  2: [
    { name: 'Scierie', age: 2, color: 'brown', cost: { coins: 1 }, produces: ['wood', 'wood'] },
    { name: 'Carrière', age: 2, color: 'brown', cost: { coins: 1 }, produces: ['stone', 'stone'] },
    { name: 'Taverne', age: 2, color: 'yellow', cost: {}, coins: 5 },
    {
      name: 'Aqueduc',
      age: 2,
      color: 'blue',
      cost: { resources: ['stone', 'stone', 'stone'] },
      chainFrom: 'Bains',
      points: 5,
    },
    {
      name: 'Écuries',
      age: 2,
      color: 'red',
      cost: { resources: ['ore', 'wood'] },
      chainFrom: 'Palissade',
      shields: 2,
    },
    { name: 'Bibliothèque', age: 2, color: 'green', cost: { resources: ['stone', 'stone'] }, science: 'tablet' },
    { name: 'Dispensaire', age: 2, color: 'green', cost: { resources: ['ore', 'glass'] }, science: 'compass' },
  ],
  3: [
    {
      name: 'Panthéon',
      age: 3,
      color: 'blue',
      cost: { resources: ['stone', 'stone', 'ore', 'glass'] },
      chainFrom: 'Aqueduc',
      points: 7,
    },
    {
      name: 'Arsenal',
      age: 3,
      color: 'red',
      cost: { resources: ['wood', 'wood', 'ore'] },
      chainFrom: 'Écuries',
      shields: 3,
    },
    {
      name: 'Université',
      age: 3,
      color: 'green',
      cost: { resources: ['wood', 'wood', 'glass'] },
      chainFrom: 'Bibliothèque',
      science: 'tablet',
    },
    {
      name: 'Observatoire',
      age: 3,
      color: 'green',
      cost: { resources: ['ore', 'ore', 'glass'] },
      chainFrom: 'Atelier',
      science: 'gear',
    },
    {
      name: 'Académie',
      age: 3,
      color: 'green',
      cost: { resources: ['stone', 'stone', 'glass'] },
      chainFrom: 'Dispensaire',
      science: 'compass',
    },
    {
      name: 'Guilde des bâtisseurs',
      age: 3,
      color: 'purple',
      cost: { resources: ['stone', 'stone', 'ore'] },
      guild: ['brown', 'grey'],
    },
    {
      name: 'Guilde des magistrats',
      age: 3,
      color: 'purple',
      cost: { resources: ['wood', 'wood', 'glass'] },
      guild: ['blue'],
    },
  ],
}
