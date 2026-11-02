import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { apiPost } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await apiPost('/auth/password/forgot', { email })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (sent) {
    return (
      <div className="card">
        <h1>Email envoyé</h1>
        <p>
          Si un compte existe pour <strong>{email}</strong>, tu recevras un lien de réinitialisation.
        </p>
      </div>
    )
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h1>Mot de passe oublié</h1>
      <label>
        Email
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Envoyer le lien</button>
      <p className="muted">
        <Link to="/login">Retour à la connexion</Link>
      </p>
    </form>
  )
}
