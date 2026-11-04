import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import type { PostgrestError } from '@supabase/supabase-js'
import { useAuth } from '@/auth/AuthContext'
import { Field } from '@/components/Field'
import { apiDelete, toFormErrors } from '@/lib/api'
import { logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import { profileSchema, validate, type FieldErrors, USERNAME_HINT } from '@/lib/validation'
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
  return (
    <>
      <ProfileForm key={profile.id} profile={profile} />
      <DeleteAccount username={profile.username} />
    </>
  )
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
        hint={USERNAME_HINT}
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

/**
 * RGPD, droit à l'effacement : supprime le compte et tout ce qui s'y rattache (profil, scores, sauvegardes). Le
 * pseudo à retaper évite une suppression par erreur, puisqu'elle est définitive.
 */
function DeleteAccount({ username }: { username: string }) {
  const navigate = useNavigate()
  const { refreshSession } = useAuth()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await apiDelete('/auth/account')
    } catch (err) {
      setError(toFormErrors(err, []).message)
      setBusy(false)
      return
    }
    // Quitter le profil avant d'oublier la session : sinon la route protégée renvoie vers /login.
    void navigate('/', { replace: true, state: { accountDeleted: true } })
    await refreshSession()
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2>Supprimer mon compte</h2>
      <p className="muted">
        La suppression est définitive : ton profil, tes scores et tes sauvegardes sont effacés, et ton pseudo disparaît
        des classements.
      </p>
      <Field
        label={`Pour confirmer, tape ton pseudo (${username})`}
        autoComplete="off"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="danger" disabled={busy || confirmation !== username}>
        Supprimer définitivement mon compte
      </button>
    </form>
  )
}
