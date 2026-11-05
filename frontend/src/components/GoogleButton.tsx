import { startGoogleAuth } from '@/lib/google'

type GoogleButtonProps = { label: string; redirect: string; disabled?: boolean; onStart?: () => void }

/** Bouton qui ouvre la connexion Google, suivi du séparateur « ou » avant le formulaire email. */
export function GoogleButton({ label, redirect, disabled, onStart }: GoogleButtonProps) {
  return (
    <>
      <button
        type="button"
        className="secondary"
        disabled={disabled}
        onClick={() => {
          onStart?.()
          startGoogleAuth(redirect)
        }}
      >
        {label}
      </button>
      <p className="divider">ou</p>
    </>
  )
}
