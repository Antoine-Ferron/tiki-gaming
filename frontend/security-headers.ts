// En-têtes de sécurité HTTP du front buildé. Appliqués par `vite preview` ; l'hébergement de production
// doit envoyer les mêmes (voir README, « Contraintes pour le déploiement »). Vérifiés par le scan ZAP (quality/).

/** Content-Security-Policy : uniquement la même origine (front + /api du backend) et le Supabase du projet. */
export function contentSecurityPolicy(supabaseUrl: string): string {
  const supabase = new URL(supabaseUrl)
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    // Vignettes servies par le front (/games/<slug>/…) ; Supabase pour un futur Storage (avatars).
    'img-src': ["'self'", 'data:', supabase.origin],
    'font-src': ["'self'"],
    'connect-src': ["'self'", supabase.origin, `wss://${supabase.host}`],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

export function securityHeaders(supabaseUrl: string): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(supabaseUrl),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  }
}
