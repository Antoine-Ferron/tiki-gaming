import { costIcons, costText, RESOURCES, stageIcons, stageText } from './cardText'
import { CostIcons, GameIcon, IconRow } from './GameIcon'
import { WONDERS, type Wonder } from './wonders'

/** Avant la partie : le joueur choisit son plateau merveille ; les IA reçoivent les autres au hasard. */
export function WonderPicker({ onPick }: { onPick: (wonder: Wonder) => void }) {
  return (
    <section className="sdv-civilisation-picker" aria-labelledby="sdv-civilisation-picker-title">
      <h2 id="sdv-civilisation-picker-title">Choisis ta merveille</h2>
      <p className="sdv-civilisation-muted">
        Elle produit une ressource dès le départ et se bâtit en 3 étapes, dans l’ordre. Les IA reçoivent les autres.
      </p>
      <ul className="sdv-civilisation-picker-list">
        {WONDERS.map((wonder) => (
          <li key={wonder.name}>
            <span className="sdv-civilisation-wonder-art">
              <GameIcon k="wonder" size={40} />
            </span>
            <h3>{wonder.name}</h3>
            <p className="sdv-civilisation-token-line">
              Produit <GameIcon k={wonder.resource} size={18} /> {RESOURCES[wonder.resource]}
            </p>
            <ol>
              {wonder.stages.map((stage, i) => (
                <li key={i} aria-label={`Étape ${i + 1} : ${costText(stage.cost)}, ${stageText(stage)}`}>
                  <CostIcons resources={costIcons(stage.cost)} size={16} />
                  <span aria-hidden="true"> → </span>
                  <IconRow items={stageIcons(stage)} size={16} />
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => onPick(wonder)}>
              Choisir {wonder.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
