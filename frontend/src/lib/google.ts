// Connexion et inscription Google : le backend mémorise la page de retour puis lance l'OAuth2 Google. Un compte
// Supabase est créé au premier passage (findOrCreateUser), d'où le même point d'entrée pour les deux pages.

/** URL qui démarre l'OAuth2 Google ; `redirect` est la page de l'application où revenir une fois connecté. */
export function googleAuthUrl(redirect: string): string {
  return `/api/auth/google?redirect=${encodeURIComponent(redirect)}`
}

/** Quitte l'application pour la page de consentement Google. */
export function startGoogleAuth(redirect: string): void {
  window.location.assign(googleAuthUrl(redirect))
}
