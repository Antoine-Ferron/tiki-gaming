import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { PostgrestError } from '@supabase/supabase-js'
import { useAuth } from '@/auth/AuthContext'
import { Field } from '@/components/Field'
import { logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import { profileSchema, validate, type FieldErrors } from '@/lib/validation'
import type { Profile } from '@/auth/AuthContext'

/** Traduit le refus de Postgres en message lisible (contrainte unique ou CHECK sur le pseudo). */
function profileErrors(error: PostgrestError): { fields: FieldErrors; message: string | null } {
  if (error.code === '23505') return { fields: { username: 'Ce pseudo est déjà pris.' }, message: null }
  if (error.code === '23514') return { fields: { username: 'Ce pseudo n’est pas accepté.' }, message: null }
  logger.error({ err: error }, 'Mise à jour du profil impossible')
  return { fields: {}, message: 'Impossible d’enregistrer le profil. Réessaie plus tard.' }
}

export default function ProfilePage() {
  const { profile } = useAuth()
  if (!profile) return <p className="muted">Chargement du profil…</p>
  return <ProfileForm key={profile.id} profile={profile} />
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { user, refreshProfile } = useAuth()
  const [username, setUsername] = useState(profile.username)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const result = validate(profileSchema, { username })
    if ('errors' in result) return setFieldErrors(result.errors)
    setFieldErrors({})
    setUsername(result.data.username)

    const { error } = await supabase.from('profiles').update(result.data).eq('id', profile.id)
    if (error) {
      const { fields, message } = profileErrors(error)
      setFieldErrors(fields)
      if (message) setMessage({ type: 'error', text: message })
      return
    }
    await refreshProfile()
    setMessage({ type: 'ok', text: 'Profil mis à jour.' })
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h1>Mon profil</h1>
      <p className="muted">{user?.email}</p>
      <Field
        label="Pseudo"
        hint="3 à 24 caractères : lettres sans accent, chiffres et _"
        autoComplete="username"
        value={username}
        error={fieldErrors.username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {message && <p className={message.type === 'ok' ? 'success' : 'error'}>{message.text}</p>}
      <button type="submit">Enregistrer</button>
      <p className="muted">
        <Link to="/update-password">Changer de mot de passe</Link>
      </p>
    </form>
  )
}
