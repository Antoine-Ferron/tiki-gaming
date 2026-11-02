import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { USERNAME_PATTERN } from '@/lib/validation'
import type { Profile } from '@/auth/AuthContext'

export default function ProfilePage() {
  const { profile } = useAuth()
  if (!profile) return <p className="muted">Chargement du profil…</p>
  return <ProfileForm key={profile.id} profile={profile} />
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { user, refreshProfile } = useAuth()
  const [username, setUsername] = useState(profile.username)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ username }).eq('id', profile.id)
    if (error) {
      const taken = error.code === '23505'
      setMessage({ type: 'error', text: taken ? 'Ce pseudo est déjà pris.' : error.message })
      return
    }
    await refreshProfile()
    setMessage({ type: 'ok', text: 'Profil mis à jour.' })
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h1>Mon profil</h1>
      <p className="muted">{user?.email}</p>
      <label>
        Pseudo
        <input required pattern={USERNAME_PATTERN} value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      {message && <p className={message.type === 'ok' ? 'success' : 'error'}>{message.text}</p>}
      <button type="submit">Enregistrer</button>
      <p className="muted"><Link to="/update-password">Changer de mot de passe</Link></p>
    </form>
  )
}
