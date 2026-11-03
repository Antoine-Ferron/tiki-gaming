import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { Field } from '@/components/Field'
import { apiPost, toFormErrors } from '@/lib/api'
import { newPasswordSchema, validate, type FieldErrors, PASSWORD_HINT } from '@/lib/validation'

// Le lien de réinitialisation Supabase revient ici avec #access_token=…&type=recovery (ou #error_description=…).
function readRecoveryHash() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  return {
    token: params.get('type') === 'recovery' ? params.get('access_token') : null,
    error: params.get('error_description'),
  }
}

export default function UpdatePasswordPage() {
  const navigate = useNavigate()
  const { user, loading, refreshSession } = useAuth()
  const [recovery] = useState(readRecoveryHash)
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(recovery.error)
  const [busy, setBusy] = useState(false)

  if (loading) return <p className="muted">Chargement…</p>
  if (!recovery.token && !recovery.error && !user) return <Navigate to="/login" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const result = validate(newPasswordSchema, { password })
    setFieldErrors('errors' in result ? result.errors : {})
    if ('errors' in result) return
    setBusy(true)
    try {
      if (recovery.token) {
        await apiPost('/auth/password/reset', { accessToken: recovery.token, ...result.data })
        await refreshSession()
      } else {
        await apiPost('/auth/password', result.data)
      }
      void navigate('/profile', { replace: true })
    } catch (err) {
      const { fields, message } = toFormErrors(err, ['password'])
      setFieldErrors(fields)
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h1>Nouveau mot de passe</h1>
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
        Enregistrer
      </button>
    </form>
  )
}
