import { useEffect, useRef } from 'react'

/** Règles de la version contre IA, résumées pour le joueur. Se ferme avec le bouton ou la touche Échap. */
export function RulesDialog({ onClose }: { onClose: () => void }) {
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
      <div className="sdv-civilisation-dialog" role="dialog" aria-modal="true" aria-labelledby="sdv-civilisation-rules">
        <h2 id="sdv-civilisation-rules">Règles du jeu</h2>
        <h3>But</h3>
        <p>Après 3 âges de 6 tours, le joueur qui a le plus de points de victoire gagne.</p>
        <h3>À chaque tour</h3>
        <ol>
          <li>Choisis une carte de ta main ; les IA choisissent en même temps que toi.</li>
          <li>
            <strong>Construis-la</strong> en payant son coût, ou <strong>défausse-la</strong> pour gagner 3 pièces.
          </li>
          <li>Les mains passent ensuite au voisin : à gauche aux âges I et III, à droite à l’âge II.</li>
        </ol>
        <h3>Payer une carte</h3>
        <p>
          Tes cartes marron et grises produisent des ressources à chaque tour. Une ressource qui te manque est achetée 2
          pièces à un voisin qui la produit. Une même carte ne se construit qu’une fois.
        </p>
        <h3>Fin d’âge et score</h3>
        <ul>
          <li>
            Boucliers : bats chaque voisin pour gagner 1, 3 puis 5 points selon l’âge ; une défaite coûte 1 point.
          </li>
          <li>Bâtiments bleus : leurs points. Trésor : 1 point par tranche de 3 pièces.</li>
          <li>Science : chaque symbole compte au carré, plus 7 points par série tablette + roue + compas.</li>
        </ul>
        <button ref={closeRef} type="button" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  )
}
