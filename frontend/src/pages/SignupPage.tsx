import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { Field } from '@/components/Field'
import { apiPost, toFormErrors } from '@/lib/api'
import { signupSchema, validate, type FieldErrors, USERNAME_HINT, PASSWORD_HINT } from '@/lib/validation'

export default function SignupPage() {
  const navigate = useNavigate()
  const { refreshSession } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const result = validate(signupSchema, { username, email, password })
    setFieldErrors('errors' in result ? result.errors : {})
    if ('errors' in result) return
    setBusy(true)
    try {
      const { confirmationRequired } = await apiPost<{ confirmationRequired: boolean }>('/auth/signup', result.data)
      if (confirmationRequired) return setPendingConfirmation(true) // confirmation email activée sur le projet
      await refreshSession()
      void navigate('/', { replace: true })
    } catch (err) {
      const { fields, message } = toFormErrors(err, ['username', 'email', 'password'])
      setFieldErrors(fields)
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  if (pendingConfirmation) {
    return (
      <div className="card">
        <h1>Vérifie tes emails</h1>
        <p>
          Un lien de confirmation a été envoyé à <strong>{email}</strong>.
        </p>
      </div>
    )
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h1>Inscription</h1>
      <Field
        label="Pseudo"
        hint={USERNAME_HINT}
        autoComplete="username"
        value={username}
        error={fieldErrors.username}
        onChange={(e) => setUsername(e.target.value)}
      />
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
        hint={PASSWORD_HINT}
        autoComplete="new-password"
        value={password}
        error={fieldErrors.password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Création…' : 'Créer mon compte'}
      </button>
      <p className="muted">
        Déjà inscrit ? <Link to="/login">Se connecter</Link>
      </p>
    </form>
  )
}
