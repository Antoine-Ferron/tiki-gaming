const KEY = 'tiki.dame.match'

/** Seul l'UUID est mémorisé dans ce navigateur. Le plateau et le résultat restent côté serveur. */
export function savedMatch(): string | null {
  try {
    const id = localStorage.getItem(KEY)
    if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id
    return null
  } catch {
    return null
  }
}

export function rememberMatch(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    // Le jeu reste utilisable si le navigateur interdit le stockage ; la reprise ne sera pas disponible.
  }
}
