import { entryName, sameOutcome, trace, type Grid } from './engine'
import type { ProbeResult } from './api'
import { lightName, plural } from './labels'

type ProbeLogProps = {
  results: ProbeResult[]
  size: number
  /** Carte du joueur confrontée à chaque tir ; null une fois l'étage terminé. */
  guess: Grid | null
  selectedIndex: number | null
  onSelect(entry: number): void
  onHover(entry: number | null): void
}

/** Journal des tirs de l'étage, du plus récent au plus ancien. */
export function ProbeLog({ results, size, guess, selectedIndex, onSelect, onHover }: ProbeLogProps) {
  if (results.length === 0) {
    return (
      <p className="muted">
        {guess === null
          ? 'Aucun tir sur cet étage.'
          : "Aucun tir pour l'instant. Clique une entrée sur le bord de la galerie."}
      </p>
    )
  }

  const explained =
    guess === null ? null : results.map((result) => sameOutcome(result, trace(guess, size, result.entry)))
  const count = explained?.filter(Boolean).length ?? 0
  const newestFirst = results.map((result, index) => ({ result, index })).reverse()

  return (
    <>
      {explained && (
        <p className="muted prismine-log-summary">
          Ta carte explique {count} {count > 1 ? 'tirs' : 'tir'} sur {results.length}.
        </p>
      )}
      <ol className="prismine-log">
        {newestFirst.map(({ result, index }) => (
          <li key={index}>
            <button
              type="button"
              className="prismine-log-item"
              aria-pressed={selectedIndex === index}
              onClick={() => onSelect(result.entry)}
              onMouseEnter={() => onHover(result.entry)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(result.entry)}
              onBlur={() => onHover(null)}
            >
              <span className={`prismine-badge${result.revealed ? ' prismine-badge-revealed' : ''}`}>{index + 1}</span>
              <span className="prismine-log-text">
                {entryName(result.entry, size)} → {result.exit === null ? 'absorbé' : entryName(result.exit, size)}
                <span className="muted">
                  {' · '}
                  <span className={`prismine-swatch prismine-light-${result.color}`} aria-hidden="true" />
                  {lightName(result.color)}
                  {' · '}
                  {plural(result.bounces, 'rebond')}
                  {result.revealed && ' · révélé'}
                </span>
              </span>
              {explained &&
                (explained[index] ? (
                  <span className="prismine-ok">
                    ✓<span className="prismine-sr"> expliqué par ta carte</span>
                  </span>
                ) : (
                  <span className="prismine-ko">
                    ✗<span className="prismine-sr"> pas expliqué par ta carte</span>
                  </span>
                ))}
            </button>
          </li>
        ))}
      </ol>
    </>
  )
}
