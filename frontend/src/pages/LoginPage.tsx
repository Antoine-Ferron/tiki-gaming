import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { CursorSwarm } from '@/components/CursorSwarm'
import { Field } from '@/components/Field'
import { apiPost, toFormErrors } from '@/lib/api'
import { loginSchema, validate, type FieldErrors } from '@/lib/validation'

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(GOOGLE_ERRORS[searchParams.get('error') ?? ''] ?? null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const result = validate(loginSchema, { email, password })
    setFieldErrors('errors' in result ? result.errors : {})
    if ('errors' in result) return
    setBusy(true)
    try {
      await apiPost('/auth/login', result.data)
      await refreshSession()
      void navigate(from, { replace: true })
    } catch (err) {
      const { fields, message } = toFormErrors(err, ['email', 'password'])
      setFieldErrors(fields)
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  function handleGoogleLogin() {
    setBusy(true)
    window.location.assign(`/api/auth/google?redirect=${encodeURIComponent(from)}`)
  }

  return (
    <div className="auth-page">
      <CursorSwarm />
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <h1>Connexion</h1>
        <button type="button" className="secondary" onClick={handleGoogleLogin} disabled={busy}>
          Se connecter avec Google
        </button>
        <p className="divider">ou</p>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={fieldErrors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="muted">
          <Link to="/forgot-password">Mot de passe oublié ?</Link> · <Link to="/signup">Créer un compte</Link>
        </p>
      </form>
    </div>
  )
}
