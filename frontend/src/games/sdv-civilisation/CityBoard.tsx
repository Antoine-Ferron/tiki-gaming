import {
  AGES,
  CATEGORIES,
  COLOR_ORDER,
  costIcons,
  costText,
  duel,
  effectIcons,
  effectText,
  RESOURCES,
  SCIENCE_NAMES,
  signed,
  stageIcons,
  stageText,
} from './cardText'
import type { PlayerState, ResourceNeed } from './game'
import { CostIcons, GameIcon, IconRow } from './GameIcon'
import type { Resource } from './ports'

function counts<T extends string>(items: T[]): [T, number][] {
  const map = new Map<T, number>()
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1)
  return [...map]
}

/** Pièces gagnées ou perdues au dernier tour (rien si le solde n'a pas bougé) ; la clé du tour rejoue l'animation. */
export function CoinDelta({ coins }: { coins: number }) {
  if (coins === 0) return null
  return (
    <span className={`sdv-civilisation-delta sdv-civilisation-${coins > 0 ? 'gain' : 'loss'}`}>{signed(coins)}</span>
  )
}

/**
 * Production d'un joueur : capacité disponible à chaque tour, jamais consommée. Trait plein pour la sienne,
 * pointillés pour celle d'un voisin (achetable). Les ressources de `highlight` sont mises en évidence.
 */
export function ProductionTokens(props: { player: PlayerState; variant: 'own' | 'buy'; highlight?: Resource[] }) {
  const { player, variant, highlight = [] } = props
  const produced = counts<Resource>(player.production)
  const label = produced.map(([r, n]) => `${n} ${RESOURCES[r]}`).join(', ')
  return (
    <span
      className={`sdv-civilisation-tokens sdv-civilisation-tokens-${variant}`}
      role="img"
      aria-label={`Produit ${label}`}
    >
      {produced.map(([resource, n]) => (
        <span
          // La clé change avec la quantité : un nouveau compte rejoue l'animation de production.
          key={`${resource}-${n}`}
          className={`sdv-civilisation-token${highlight.includes(resource) ? ' sdv-civilisation-token-used' : ''}`}
          title={RESOURCES[resource]}
        >
          <GameIcon k={resource} size={22} />
          {variant === 'buy' ? `×${n}` : n}
        </span>
      ))}
    </span>
  )
}

/** Plateau de merveille : illustration, nom, production de départ et étapes (bâties, prochaine, à venir). */
export function WonderBoard({ player }: { player: PlayerState }) {
  const { wonder, stagesBuilt } = player
  return (
    <div className="sdv-civilisation-wonder">
      <div className="sdv-civilisation-wonder-head">
        <span className="sdv-civilisation-wonder-art" aria-hidden="true">
          <GameIcon k="wonder" size={44} />
        </span>
        <span>
          <strong>{wonder.name}</strong>
          <span className="sdv-civilisation-muted">
            Merveille · {stagesBuilt} / {wonder.stages.length} étapes
          </span>
        </span>
      </div>
      <ol aria-label="Étapes de la merveille" className="sdv-civilisation-stages">
        {wonder.stages.map((stage, i) => {
          const state = i < stagesBuilt ? 'built' : i === stagesBuilt ? 'next' : 'later'
          return (
            <li
              key={i}
              className={`sdv-civilisation-stage-${state}`}
              aria-label={`Étape ${i + 1}${state === 'built' ? ' (bâtie)' : ''} : ${costText(stage.cost)}, ${stageText(stage)}`}
            >
              <span className="sdv-civilisation-stage-title" aria-hidden="true">
                {state === 'built' ? '✓ Bâtie' : `Étape ${i + 1}`}
              </span>
              <span className="sdv-civilisation-stage-gain" aria-hidden="true">
                <IconRow items={stageIcons(stage)} size={24} />
              </span>
              <span className="sdv-civilisation-stage-cost" aria-hidden="true">
                <CostIcons resources={costIcons(stage.cost)} size={18} />
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Bâtiments construits, en colonnes par couleur, chacun avec son effet. */
export function CityCards({ player, label }: { player: PlayerState; label: string }) {
  const columns = COLOR_ORDER.map((color) => ({ color, cards: player.built.filter((c) => c.color === color) })).filter(
    (column) => column.cards.length > 0,
  )
  return (
    <div className="sdv-civilisation-citycards" aria-label={label} role="list">
      {columns.length === 0 && (
        <p className="sdv-civilisation-muted" role="listitem">
          Aucun bâtiment pour l’instant : les cartes construites viendront s’aligner ici, par couleur.
        </p>
      )}
      {columns.map(({ color, cards }) => (
        <div key={color} className={`sdv-civilisation-column sdv-civilisation-card-${color}`}>
          <span className="sdv-civilisation-column-head">
            <GameIcon k={CATEGORIES[color].icon} size={16} />
            {CATEGORIES[color].label}
          </span>
          {cards.map((card, i) => (
            <span
              key={i}
              className="sdv-civilisation-building"
              role="listitem"
              aria-label={`${card.name} : ${effectText(card)}`}
            >
              <strong>{card.name}</strong>
              <IconRow items={effectIcons(card)} size={18} />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

interface CityProps {
  player: PlayerState
  left: PlayerState
  right: PlayerState
  lastCoins: number
  /** Identifiant du tour affiché : les gains et pertes du tour réapparaissent à chaque nouveau tour. */
  stamp: string
  /** Détail du coût de la carte choisie, pour mettre en évidence les ressources utilisées et manquantes. */
  needs: ResourceNeed[]
}

/** Barre de ressources du joueur : production, or, armée et science, regroupés au même endroit. */
function ResourceBar({ player, left, right, lastCoins, stamp, needs }: CityProps) {
  const mine = player.shields
  const missing = needs.filter((need) => need.missing > 0)
  const symbols = player.built.map((card) => card.science)
  const count = (s: string) => symbols.filter((x) => x === s).length

  return (
    <div className="sdv-civilisation-bar">
      <div className="sdv-civilisation-bar-group">
        <span className="sdv-civilisation-bar-label">Tu produis · chaque tour</span>
        <span className="sdv-civilisation-bar-row">
          <ProductionTokens
            player={player}
            variant="own"
            highlight={needs.filter((n) => n.own > 0).map((n) => n.resource)}
          />
          {missing.map((need) => (
            <span key={need.resource} className="sdv-civilisation-token sdv-civilisation-token-missing">
              <GameIcon k={need.resource} size={22} />
              manque {need.missing}
            </span>
          ))}
        </span>
      </div>

      <div className="sdv-civilisation-bar-group">
        <span className="sdv-civilisation-bar-label">Trésor</span>
        <span className="sdv-civilisation-bar-row sdv-civilisation-big">
          <GameIcon k="coin" size={28} />
          <strong key={player.coins} className="sdv-civilisation-pop">
            {player.coins}
          </strong>
          <CoinDelta key={stamp} coins={lastCoins} />
        </span>
      </div>

      <div className="sdv-civilisation-bar-group">
        <span className="sdv-civilisation-bar-label">Armée · un duel par voisin</span>
        <span className="sdv-civilisation-bar-row">
          <span className="sdv-civilisation-big">
            <GameIcon k="shield" size={28} />
            <strong key={mine} className="sdv-civilisation-pop">
              {mine}
            </strong>
          </span>
          <ul aria-label="Duels" className="sdv-civilisation-duels">
            {[left, right].map((other) => {
              const result = duel(mine, other.shields)
              return (
                <li key={other.name} className={`sdv-civilisation-duel-${result.kind}`}>
                  {result.label} contre {other.name} ({mine} – {other.shields})
                </li>
              )
            })}
          </ul>
        </span>
        {player.tokens.length > 0 && (
          <ul aria-label="Jetons militaires" className="sdv-civilisation-medals">
            {player.tokens.map((token, i) => (
              <li key={i} className={`sdv-civilisation-duel-${duel(token.value, 0).kind}`}>
                Âge {AGES[token.age - 1]} : {signed(token.value)} ({token.against})
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sdv-civilisation-bar-group">
        <span className="sdv-civilisation-bar-label">Science · {player.sciencePoints} pts</span>
        <ul aria-label="Symboles de science" className="sdv-civilisation-science">
          {(['tablet', 'gear', 'compass'] as const).map((symbol) => (
            <li key={symbol} aria-label={`${SCIENCE_NAMES[symbol]} : ${count(symbol)}`} title={SCIENCE_NAMES[symbol]}>
              <GameIcon k={symbol} size={24} />
              <strong>{count(symbol)}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Zone A : la civilisation du joueur, cœur de l'écran. */
export function CityBoard(props: CityProps) {
  return (
    <section className="sdv-civilisation-city" aria-labelledby="sdv-civilisation-city-title">
      <h2 id="sdv-civilisation-city-title" className="sdv-civilisation-zone-title">
        Ta civilisation
      </h2>
      <WonderBoard player={props.player} />
      <div className="sdv-civilisation-city-main">
        <ResourceBar {...props} />
        <CityCards player={props.player} label="Tes bâtiments" />
      </div>
    </section>
  )
}
