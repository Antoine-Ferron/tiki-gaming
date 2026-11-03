import type { ranking } from './score'

interface Props {
  ranked: ReturnType<typeof ranking>
  me: string
  isGuest: boolean
  onReplay: () => void
}

/** Gagnants : le plus haut total, départagé par les pièces ; s'il reste plusieurs joueurs, la victoire est partagée. */
function winners(ranked: Props['ranked']) {
  const [first] = ranked
  return ranked.filter((row) => row.score.total === first.score.total && row.coins === first.coins)
}

function verdict(ranked: Props['ranked'], me: string): string {
  const names = winners(ranked).map((row) => (row.name === me ? 'toi' : row.name))
  if (names.length > 1) return `Égalité : victoire partagée entre ${names.join(' et ')}.`
  return names[0] === 'toi' ? 'Tu as gagné !' : `${names[0]} gagne la partie.`
}

/** Fin de partie : score détaillé de chaque joueur, du premier au dernier. */
export function Results({ ranked, me, isGuest, onReplay }: Props) {
  return (
    <section className="sdv-civilisation-results" aria-labelledby="sdv-civilisation-results-title">
      <h2 id="sdv-civilisation-results-title">Fin de partie</h2>
      <p className="sdv-civilisation-winner">{verdict(ranked, me)}</p>
      <table className="sdv-civilisation-scores">
        <thead>
          <tr>
            <th scope="col">Rang</th>
            <th scope="col">Joueur</th>
            <th scope="col">Militaire</th>
            <th scope="col">Trésor</th>
            <th scope="col">Merveille</th>
            <th scope="col">Civil</th>
            <th scope="col">Science</th>
            <th scope="col">Guildes</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, index) => (
            <tr key={row.name} className={row.name === me ? 'sdv-civilisation-me' : undefined}>
              <td>{index + 1}</td>
              <th scope="row">{row.name}</th>
              <td>{row.score.military}</td>
              <td>{row.score.treasury}</td>
              <td>{row.score.wonder}</td>
              <td>{row.score.civil}</td>
              <td>{row.score.science}</td>
              <td>{row.score.guilds}</td>
              <td>
                <strong>{row.score.total}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
      <button type="button" className="big" onClick={onReplay}>
        Rejouer
      </button>
    </section>
  )
}
