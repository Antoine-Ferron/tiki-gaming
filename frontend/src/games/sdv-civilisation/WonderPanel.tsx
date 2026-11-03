import { costText, RESOURCES, stageText } from './cardText'
import type { PlayerState } from './game'

/** Plateau merveille du joueur : ressource produite et étapes, bâties ou à venir. */
export function WonderPanel({ player }: { player: PlayerState }) {
  const { wonder, stagesBuilt } = player
  return (
    <section className="sdv-civilisation-wonder-panel" aria-labelledby="sdv-civilisation-wonder-title">
      <h3 id="sdv-civilisation-wonder-title">Ta merveille : {wonder.name}</h3>
      <p className="muted">Produit 1 {RESOURCES[wonder.resource]} à chaque tour.</p>
      <ol>
        {wonder.stages.map((stage, i) => {
          const state = i < stagesBuilt ? 'built' : i === stagesBuilt ? 'next' : 'later'
          return (
            <li key={i} className={`sdv-civilisation-stage-${state}`}>
              <span aria-hidden="true">{state === 'built' ? '✓' : i + 1}</span> {costText(stage.cost)} →{' '}
              <strong>{stageText(stage)}</strong>
              {state === 'built' && <span className="sdv-civilisation-sr-only"> (bâtie)</span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
