import type { CardColor } from './cards'
import { costIcons, costText, duel, effectIcons, RESOURCES, SCIENCE_NAMES, stageIcons, stageText } from './cardText'
import { production, shields, type PlayerState } from './game'
import { CostIcons, GameIcon, IconRow } from './GameIcon'
import type { Resource } from './ports'
import { scienceScore } from './score'

const COLOR_ORDER: CardColor[] = ['brown', 'grey', 'blue', 'red', 'green', 'yellow', 'purple']
const AGES = ['I', 'II', 'III']

/** Nombre avec son signe : « +3 », « −1 », « 0 ». */
const signed = (n: number) => n.toLocaleString('fr-FR', { signDisplay: 'exceptZero' })

function counts<T extends string>(items: T[]): [T, number][] {
  const map = new Map<T, number>()
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1)
  return [...map]
}

/**
 * Production d'un joueur : capacité disponible à chaque tour, jamais consommée. Trait plein pour la sienne,
 * pointillés pour celle d'un voisin, achetable.
 */
export function ProductionTokens({ player, variant }: { player: PlayerState; variant: 'own' | 'buy' }) {
  const produced = counts<Resource>(production(player))
  const label = produced.map(([r, n]) => `${n} ${RESOURCES[r]}`).join(', ')
  return (
    <span
      className={`sdv-civilisation-tokens sdv-civilisation-tokens-${variant}`}
      role="img"
      aria-label={`Produit ${label}`}
    >
      {produced.map(([resource, n]) => (
        <span key={resource} className="sdv-civilisation-token" title={RESOURCES[resource]}>
          <GameIcon k={resource} size={18} />
          {variant === 'buy' ? `×${n}` : n}
        </span>
      ))}
    </span>
  )
}

/** Bâtiments construits, rangés par couleur. */
export function BuiltCards({ player, label }: { player: PlayerState; label: string }) {
  const built = [...player.built].sort((a, b) => COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color))
  return (
    <ul className="sdv-civilisation-built" aria-label={label}>
      {built.length === 0 && <li className="muted">Aucune carte construite.</li>}
      {built.map((card, i) => (
        <li key={i} className={`sdv-civilisation-tile sdv-civilisation-card-${card.color}`}>
          <IconRow items={effectIcons(card)} size={16} />
          {card.name}
        </li>
      ))}
    </ul>
  )
}

/** Plateau du joueur, en face de lui : merveille, production, trésor, armée, science et bâtiments par couleur. */
export function CityBoard(props: { player: PlayerState; left: PlayerState; right: PlayerState; lastCoins: number }) {
  const { player, left, right, lastCoins } = props
  const symbols = player.built.map((card) => card.science)
  const count = (s: string) => symbols.filter((x) => x === s).length
  const [tablets, gears, compasses] = [count('tablet'), count('gear'), count('compass')]
  const mine = shields(player)

  return (
    <section className="sdv-civilisation-city" aria-labelledby="sdv-civilisation-city-title">
      <div className="sdv-civilisation-city-wonder">
        <h2 id="sdv-civilisation-city-title">Ta cité · {player.name}</h2>
        <div className="sdv-civilisation-wonder-head">
          <span className="sdv-civilisation-wonder-art">
            <GameIcon k="wonder" size={32} />
          </span>
          <span>
            <strong>{player.wonder.name}</strong>
            <span className="sdv-civilisation-muted">
              produit <GameIcon k={player.wonder.resource} size={14} /> {RESOURCES[player.wonder.resource]}
            </span>
          </span>
        </div>
        <ol aria-label="Étapes de ta merveille" className="sdv-civilisation-stages">
          {player.wonder.stages.map((stage, i) => {
            const state = i < player.stagesBuilt ? 'built' : i === player.stagesBuilt ? 'next' : 'later'
            return (
              <li
                key={i}
                className={`sdv-civilisation-stage-${state}`}
                aria-label={`Étape ${i + 1}${state === 'built' ? ' (bâtie)' : ''} : ${costText(stage.cost)}, ${stageText(stage)}`}
              >
                <span className="sdv-civilisation-stage-slot" aria-hidden="true" />
                <span className="sdv-civilisation-stage-label">
                  {state === 'built' ? '✓' : ''} Étape {i + 1}
                </span>
                <CostIcons resources={costIcons(stage.cost)} size={18} />
                <span aria-hidden="true">→</span>
                <IconRow items={stageIcons(stage)} size={18} />
              </li>
            )
          })}
        </ol>
      </div>

      <div className="sdv-civilisation-city-block">
        <h3>Production · chaque tour</h3>
        <ProductionTokens player={player} variant="own" />
        <p className="sdv-civilisation-muted">Une capacité, pas un stock : rien n’est consommé.</p>
        <h3>Trésor</h3>
        <p className="sdv-civilisation-treasury">
          <GameIcon k="coin" size={26} />
          <strong>{player.coins}</strong> pièces
          {lastCoins !== 0 && (
            <span className={lastCoins > 0 ? 'sdv-civilisation-gain' : 'sdv-civilisation-loss'}>
              {signed(lastCoins)} ce tour
            </span>
          )}
        </p>
      </div>

      <div className="sdv-civilisation-city-block">
        <h3>Armée · un duel par voisin</h3>
        <p className="sdv-civilisation-shields">
          <GameIcon k="shield" size={22} />
          <strong>{mine}</strong> boucliers
        </p>
        <ul aria-label="Duels" className="sdv-civilisation-duels">
          {[
            { dir: `← ${left.name}`, other: left },
            { dir: `${right.name} →`, other: right },
          ].map(({ dir, other }) => {
            const result = duel(mine, shields(other))
            return (
              <li key={dir} className={`sdv-civilisation-duel-${result.kind}`}>
                <span>{dir}</span>
                <span>
                  {mine} vs {shields(other)}
                </span>
                <strong>{result.label}</strong>
              </li>
            )
          })}
        </ul>
        <ul aria-label="Jetons militaires" className="sdv-civilisation-medals">
          {player.tokens.map((token, i) => (
            <li key={i} className={`sdv-civilisation-duel-${duel(token.value, 0).kind}`}>
              {AGES[token.age - 1]} · {signed(token.value)} {token.against}
            </li>
          ))}
        </ul>
      </div>

      <div className="sdv-civilisation-city-block">
        <h3>Science</h3>
        <ul aria-label="Symboles de science" className="sdv-civilisation-science">
          {(['tablet', 'gear', 'compass'] as const).map((symbol) => (
            <li key={symbol} aria-label={`${SCIENCE_NAMES[symbol]} : ${count(symbol)}`}>
              <GameIcon k={symbol} size={22} />
              <strong>{count(symbol)}</strong>
              <span>{SCIENCE_NAMES[symbol]}</span>
            </li>
          ))}
        </ul>
        <p className="sdv-civilisation-muted">
          Séries complètes : {Math.min(tablets, gears, compasses)} · estimation{' '}
          <strong>{scienceScore(tablets, gears, compasses)} pts</strong>
        </p>
      </div>

      <div className="sdv-civilisation-city-block sdv-civilisation-city-cards">
        <h3>Bâtiments · par couleur</h3>
        <BuiltCards player={player} label="Tes cartes construites" />
      </div>
    </section>
  )
}
