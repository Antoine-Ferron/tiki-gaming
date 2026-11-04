import '../bang.css'
import { CHARACTERS, type Character } from './characters'

/** Carte Personnage : toujours visible, avec son nom, ses PV de départ et son pouvoir. */
export function CharacterCard({ character }: { character: Character }) {
  const { label, lifePoints, power } = CHARACTERS[character]
  return (
    <figure className="bang-card bang-face-card">
      <img src={`/games/bang/cards/characters/${character}.webp`} alt="" />
      <figcaption>
        <strong>{label}</strong>
        <span>{lifePoints} PV</span>
        <span>{power}</span>
      </figcaption>
    </figure>
  )
}
