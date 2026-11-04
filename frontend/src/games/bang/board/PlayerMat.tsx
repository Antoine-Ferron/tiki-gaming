import { CharacterCard } from '../cards/CharacterCard'
import type { Character } from '../cards/characters'
import { RoleCard } from '../cards/RoleCard'
import type { Role } from '../cards/roles'
import { cardLabel, slug, type GameView, type ViewPlayer } from './view'

const ICONS = '/games/bang/icons'

/** Le tapis d'un joueur. Seul mon rôle et celui du Shérif sont connus : les autres restent cachés. */
export function PlayerMat({ player, view }: { player: ViewPlayer; view: GameView }) {
  const isMe = player.seat === view.seat
  const role = isMe ? view.role : player.role

  return (
    <section className="bang-mat" aria-label={`Tapis de la place ${player.seat}`}>
      <header>
        <h3>{isMe ? 'Devant toi' : `Place ${player.seat}`}</h3>
        <span className="bang-stat">
          <img src={`${ICONS}/vie.webp`} alt="" />
          {player.health}/{player.maxHealth} PV
        </span>
        <span className="bang-stat">
          <img src={`${ICONS}/carte-en-main.webp`} alt="" />
          {player.handCount} en main
        </span>
      </header>
      <div className="bang-mat-cards">
        <div>
          <p className="bang-label">{role ? (isMe ? 'Rôle privé' : 'Rôle public') : 'Rôle caché'}</p>
          <RoleCard role={role ? slug<Role>(role) : undefined} faceUp={role !== undefined} />
        </div>
        <CharacterCard character={slug<Character>(player.character)} />
      </div>
      <p className="bang-weapon">Colt .45 · portée 1</p>
      <ul className="bang-played" aria-label="Cartes posées">
        {player.playedCards.map((card) => (
          <li key={card.id}>{cardLabel(card.type)}</li>
        ))}
      </ul>
    </section>
  )
}
