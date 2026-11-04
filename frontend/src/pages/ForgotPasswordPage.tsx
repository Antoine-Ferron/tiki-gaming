import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Field } from '@/components/Field'
import { apiPost, toFormErrors } from '@/lib/api'
import { forgotPasswordSchema, validate, type FieldErrors } from '@/lib/validation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const result = validate(forgotPasswordSchema, { email })
    setFieldErrors('errors' in result ? result.errors : {})
    if ('errors' in result) return
    try {
      await apiPost('/auth/password/forgot', result.data)
      setSent(true)
    } catch (err) {
      const { fields, message } = toFormErrors(err, ['email'])
      setFieldErrors(fields)
      setError(message)
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
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h1>Mot de passe oublié</h1>
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        error={fieldErrors.email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit">Envoyer le lien</button>
      <p className="muted">
        <Link to="/login">Retour à la connexion</Link>
      </p>
    </form>
  )
}
