/**
 * Commandes clavier de LemurTiki (EF-7.3) : traduit les touches en commandes du domaine.
 */
import type { Input } from './domain/game'

export type Command = 'left' | 'right' | 'pause'

/** Q / D sur un clavier AZERTY, A / D en QWERTY, plus les flèches ; Échap ou P pour la pause. */
const KEYS: Record<string, Command> = {
  arrowleft: 'left',
  q: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  escape: 'pause',
  p: 'pause',
}

/** Commande d'une touche (`KeyboardEvent.key`), ou null si elle ne sert pas au jeu. */
export function commandOf(key: string): Command | null {
  return KEYS[key.toLowerCase()] ?? null
}

/** Direction voulue d'après les touches tenues. */
export function inputOf(held: ReadonlySet<string>): Input {
  const commands = [...held].map(commandOf)
  return { left: commands.includes('left'), right: commands.includes('right') }
}
