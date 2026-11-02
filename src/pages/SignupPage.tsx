import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { USERNAME_PATTERN } from '@/lib/validation'


export default function SignupPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }, // lu par le trigger handle_new_user pour créer le profil
        emailRedirectTo: window.location.origin,
      },
    })
    setBusy(false)
    if (error) return setError(error.message)
    if (data.session) navigate('/', { replace: true })
    else setPendingConfirmation(true) // confirmation email activée sur le projet
  }

  if (pendingConfirmation) {
    return (
      <div className="card">
        <h1>Vérifiez vos emails</h1>
        <p>Un lien de confirmation a été envoyé à <strong>{email}</strong>.</p>
      </div>
    )
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h1>Inscription</h1>
      <label>
        Pseudo
        <input
          required
          pattern={USERNAME_PATTERN}
          title="3 à 24 caractères : lettres, chiffres, _"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label>
        Email
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Mot de passe
        <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
      <p className="muted">Déjà inscrit ? <Link to="/login">Se connecter</Link></p>
    </form>
  )
}
