import type { Game } from './Game'

/**
 * Partie en cours, pour l'interface (HUD, menus, carte, chat). Module léger : l'importer ne charge pas le
 * moteur, contrairement à GameRoot qui la renseigne.
 */
let current: Game | null = null

export function getGame(): Game | null {
  return current
}

export function setGame(game: Game | null) {
  current = game
}
