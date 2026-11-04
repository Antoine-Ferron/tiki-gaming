import { useEffect, useId, useRef, type ReactNode } from 'react'

/** Fenêtre pour les informations avancées (règles, journal, cité d'un voisin). Se ferme avec le bouton ou Échap. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sdv-civilisation-overlay">
      <div className="sdv-civilisation-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sdv-civilisation-dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} type="button" className="sdv-civilisation-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
