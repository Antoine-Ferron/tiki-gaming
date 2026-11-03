import { levels } from '../domain/levels'
import { type BestScores, isUnlocked } from '../domain/progress'
import { totalScore } from '../domain/score'

type LevelPickerProps = {
  best: BestScores
  onPick: (levelId: number) => void
}

/** Écran de choix : un niveau s'ouvre quand le précédent est terminé (N3) ; on rejoue un niveau terminé (N4). */
export function LevelPicker({ best, onPick }: LevelPickerProps) {
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
    </>
  )
}
