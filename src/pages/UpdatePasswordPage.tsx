import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'

export default function UpdatePasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setError(error.message)
    navigate('/profile', { replace: true })
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h1>Nouveau mot de passe</h1>
      <label>
        Mot de passe
        <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Enregistrer</button>
    </form>
  )
}
