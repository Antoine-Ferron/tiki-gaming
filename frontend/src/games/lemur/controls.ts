/**
 * Commandes clavier de LemurTiki (EF-7.3) : traduit les touches en commandes du domaine.
 */
import type { Input } from './domain/game'

export type Command = 'left' | 'right' | 'pause'

/** Commande d'une touche (`KeyboardEvent.key`), ou null si elle ne sert pas au jeu. */
export function commandOf(_key: string): Command | null {
  return null
}

/** Direction voulue d'après les touches tenues. */
export function inputOf(_held: ReadonlySet<string>): Input {
  return { left: false, right: false }
}
