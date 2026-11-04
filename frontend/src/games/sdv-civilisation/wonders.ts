import type { Cost } from './cards'
import type { Resource } from './ports'

export interface WonderStage {
  cost: Cost
  points?: number
  coins?: number
  shields?: number
}

/** Plateau merveille, tel que le serveur le décrit (catalogue : backend, Wonders.java). */
export interface Wonder {
  name: string
  /** Ressource produite par le plateau dès le début de la partie. */
  resource: Resource
  /** Étapes à construire dans l'ordre, chacune avec une carte posée face cachée. */
  stages: WonderStage[]
}
