import type { Random } from './domain/branches'
import type { GameProps } from '../types'

type Props = GameProps & { random?: Random }

/** Écran provisoire : le jeu se branchera ici sur le domaine (advance) via un adaptateur canvas. */
export default function LemurGame(_props: Props) {
  return (
    <section className="lemur">
      <h2>LemurTiki</h2>
      <p>Grimpe le baobab de branche en branche avec le maki, sans te faire rattraper par la fossa.</p>
      <p>Le baobab pousse encore : reviens bientôt pour ta première ascension !</p>
    </section>
  )
}
