import type { Json } from '@/lib/database.types'
import type { KeyValueStorage, SaveStore } from '../ports'

/** localStorage, ou null s'il est inaccessible (navigation privée stricte, cookies bloqués…). */
export function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Sauvegarde invitée, sur l'appareil. Un stockage indisponible ou plein ne bloque jamais la partie :
 * la sauvegarde est simplement perdue.
 */
export function localSaves(storage: KeyValueStorage | null): SaveStore {
  const key = (gameSlug: string) => `tiki:guest-save:${gameSlug}`
  return {
    async load(gameSlug) {
      try {
        const raw = storage?.getItem(key(gameSlug))
        return raw ? (JSON.parse(raw) as Json) : null
      } catch {
        return null
      }
    },

    async save(gameSlug, data) {
      try {
        storage?.setItem(key(gameSlug), JSON.stringify(data))
      } catch {
        // stockage plein ou refusé : la partie continue sans sauvegarde
      }
    },

    async clear(gameSlug) {
      try {
        storage?.removeItem(key(gameSlug))
      } catch {
        // idem
      }
    },
  }
}
