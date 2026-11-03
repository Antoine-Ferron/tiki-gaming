import type { Cost } from './cards'
import type { Resource } from './ports'

export interface WonderStage {
  cost: Cost
  points?: number
  coins?: number
  shields?: number
}

export interface Wonder {
  name: string
  /** Ressource produite par le plateau dès le début de la partie. */
  resource: Resource
  /** Étapes à construire dans l'ordre, chacune avec une carte posée face cachée. */
  stages: WonderStage[]
}

/** Plateaux merveille de la version contre IA (créations du jeu). Voir docs/games/sdv-civilisation/regles.md */
export const WONDERS: Wonder[] = [
  {
    name: 'Temple d’Ysar',
    resource: 'ore',
    stages: [
      { cost: { resources: ['ore'] }, points: 3 },
      { cost: { resources: ['wood', 'wood'] }, shields: 2 },
      { cost: { resources: ['stone', 'stone', 'glass'] }, points: 7 },
    ],
  },
  {
    name: 'Phare de Sélène',
    resource: 'glass',
    stages: [
      { cost: { resources: ['wood'] }, points: 3 },
      { cost: { resources: ['stone', 'stone'] }, coins: 6 },
      { cost: { resources: ['ore', 'ore', 'glass'] }, points: 7 },
    ],
  },
  {
    name: 'Jardins de Mirah',
    resource: 'wood',
    stages: [
      { cost: { resources: ['wood'] }, points: 3 },
      { cost: { resources: ['ore', 'ore'] }, shields: 2 },
      { cost: { resources: ['stone', 'stone', 'stone'] }, points: 7 },
    ],
  },
  {
    name: 'Citadelle d’Orkan',
    resource: 'stone',
    stages: [
      { cost: { resources: ['stone'] }, points: 3 },
      { cost: { resources: ['glass', 'wood'] }, coins: 6 },
      { cost: { resources: ['wood', 'wood', 'ore'] }, points: 7 },
    ],
  },
]
