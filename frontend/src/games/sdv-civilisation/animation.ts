import type { GameState } from './game'

/** Vitesse des animations, choisie par le joueur : normales, rapides ou désactivées. */
export type Tempo = 'normal' | 'fast' | 'off'

export const TEMPOS: { value: Tempo; label: string }[] = [
  { value: 'normal', label: 'Normales' },
  { value: 'fast', label: 'Rapides' },
  { value: 'off', label: 'Désactivées' },
]

/** Multiplicateur des durées : 0 = pas de séquence, le nouvel état s'affiche aussitôt. */
export const TEMPO_FACTOR: Record<Tempo, number> = { normal: 1, fast: 0.45, off: 0 }

const STORAGE_KEY = 'sdv-civilisation-tempo'

/** Préférence du joueur, gardée dans son navigateur (absente ou illisible : animations normales). */
export function readTempo(): Tempo {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return TEMPOS.some((t) => t.value === stored) ? (stored as Tempo) : 'normal'
  } catch {
    return 'normal'
  }
}

export function saveTempo(tempo: Tempo): void {
  try {
    localStorage.setItem(STORAGE_KEY, tempo)
  } catch {
    // Stockage indisponible (navigation privée…) : la préférence vaut pour cette partie seulement.
  }
}

/**
 * Étapes d'un tour, dans l'ordre où le joueur les voit :
 * révélation des cartes jouées, départ des mains, mise à jour des civilisations,
 * puis en fin d'âge les deux duels l'un après l'autre et l'annonce de l'âge suivant (ou de la fin de partie).
 */
export type Step = 'reveal' | 'pass' | 'apply' | 'duel-left' | 'duel-right' | 'age'

/** Durées de chaque étape au tempo normal, en millisecondes. */
export const DURATIONS: Record<Step, number> = {
  reveal: 1100,
  pass: 600,
  apply: 900,
  'duel-left': 1100,
  'duel-right': 1100,
  age: 1200,
}

/** Tant que l'étape « apply » n'est pas atteinte, l'écran montre encore l'état de début de tour. */
export const APPLY_STEP = 2

export function turnSteps(after: GameState): Step[] {
  const steps: Step[] = ['reveal', 'pass', 'apply']
  if (after.conflicts) steps.push('duel-left', 'duel-right', 'age')
  return steps
}
