import { useId, type InputHTMLAttributes } from 'react'

type FieldProps = { label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>

/** Champ de formulaire avec son libellé, une aide facultative et le message d'erreur lié à l'input. */
export function Field({ label, error, hint, ...input }: FieldProps) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <label>
      {label}
      <input {...input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} />
      {hint && !error && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}
