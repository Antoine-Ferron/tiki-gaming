import '../bang.css'
import { ROLES, type Role } from './roles'

const BACK = '/games/bang/cards/back/back.webp'

/** Carte Rôle. Face cachée, les quatre rôles donnent exactement le même rendu : rien ne les distingue. */
export function RoleCard({ role, faceUp }: { role?: Role; faceUp: boolean }) {
  if (!faceUp || !role) return <img className="bang-card" src={BACK} alt="Carte Rôle face cachée" />

  const { label, goal } = ROLES[role]
  return (
    <figure className="bang-card bang-face-card">
      <img src={`/games/bang/cards/roles/${role}.webp`} alt="" />
      <figcaption>
        <strong>{label}</strong>
        <span>{goal}</span>
      </figcaption>
    </figure>
  )
}
