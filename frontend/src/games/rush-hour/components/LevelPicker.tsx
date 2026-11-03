import { type Difficulty } from '../domain/difficulty'
import { levels } from '../domain/levels'
import { isUnlocked } from '../domain/progress'
import { totalScore } from '../domain/score'
import type { Progress } from '../services/progress'

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'facile', label: 'Facile' },
  { id: 'moyen', label: 'Moyen' },
  { id: 'difficile', label: 'Difficile' },
]

type LevelPickerProps = {
  progress: Progress
  onPick: (levelId: number) => void
  onGenerate: (difficulty: Difficulty) => void
}

/**
 * Écran de choix. Niveaux : un niveau s'ouvre quand le précédent est terminé (N3), on rejoue un niveau terminé (N4).
 * Génération : un plateau nouveau par difficulté (G1), hors classement, avec ses statistiques (S4).
 */
export function LevelPicker({ progress: { best, generated }, onPick, onGenerate }: LevelPickerProps) {
  return (
    <>
      <h2>Niveaux</h2>
      <p className="muted">Score total : {totalScore(best)} points</p>
      <div className="rush-hour-levels">
        {levels.map(({ id }) => {
          const open = isUnlocked(best, id)
          const status = id in best ? `${best[id]} points` : open ? 'à jouer' : 'fermé'
          return (
            <button
              key={id}
              type="button"
              className={`rush-hour-level${id in best ? ' rush-hour-level-done' : ''}`}
              disabled={!open}
              aria-label={`Niveau ${id}, ${status}`}
              onClick={() => onPick(id)}
            >
              <span className="rush-hour-level-number">{id}</span>
              <span className="rush-hour-level-status">{open ? status : '🔒'}</span>
            </button>
          )
        })}
      </div>

      <h2 className="rush-hour-section">Génération</h2>
      <p className="muted">Un plateau nouveau à chaque partie. Il ne compte pas au classement.</p>
      <div className="rush-hour-actions">
        {DIFFICULTIES.map(({ id, label }) => (
          <button key={id} type="button" className="small" onClick={() => onGenerate(id)}>
            {label}
          </button>
        ))}
      </div>
      {DIFFICULTIES.map(({ id, label }) => {
        const stats = generated?.[id]
        if (!stats) return null
        return (
          <p key={id} className="muted">
            {label} : {stats.won} plateau{stats.won > 1 ? 'x' : ''} réussi{stats.won > 1 ? 's' : ''}, record{' '}
            {stats.best} points
          </p>
        )
      })}
    </>
  )
}
