import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { apiPost } from '@/lib/api'

const GOOGLE_ERRORS: Record<string, string> = {
  google: 'La connexion avec Google a échoué. Réessaie.',
  'google-email': 'Ton compte Google doit avoir une adresse email vérifiée.',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { refreshSession } = useAuth()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(GOOGLE_ERRORS[searchParams.get('error') ?? ''] ?? null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiPost('/auth/login', { email, password })
      await refreshSession()
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function handleGoogleLogin() {
    setBusy(true)
    window.location.assign(`/api/auth/google?redirect=${encodeURIComponent(from)}`)
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h1>Connexion</h1>
      <button type="button" onClick={handleGoogleLogin} disabled={busy}>
        Se connecter avec Google
      </button>
      <p className="muted">ou</p>
      <label>
        Email
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Mot de passe
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Connexion…' : 'Se connecter'}
      </button>
      <p className="muted">
        <Link to="/forgot-password">Mot de passe oublié ?</Link> · <Link to="/signup">Créer un compte</Link>
      </p>
    </form>
  )
}
