import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { apiPost } from '@/lib/api'

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
  const [error, setError] = useState<string | null>(recovery.error)
  const [busy, setBusy] = useState(false)

  if (loading) return <p className="muted">Chargement…</p>
  if (!recovery.token && !recovery.error && !user) return <Navigate to="/login" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (recovery.token) {
        await apiPost('/auth/password/reset', { accessToken: recovery.token, password })
        await refreshSession()
      } else {
        await apiPost('/auth/password', { password })
      }
      navigate('/profile', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h1>Nouveau mot de passe</h1>
      <label>
        Mot de passe
        <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>Enregistrer</button>
    </form>
  )
}
