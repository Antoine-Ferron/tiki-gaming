import type { ranking } from './score'

interface Props {
  ranked: ReturnType<typeof ranking>
  me: string
  isGuest: boolean
  onReplay: () => void
}

/** Fin de partie : score détaillé de chaque joueur, du premier au dernier. */
export function Results({ ranked, me, isGuest, onReplay }: Props) {
  const winner = ranked[0]
  return (
    <section className="sdv-civilisation-results" aria-labelledby="sdv-civilisation-results-title">
      <h2 id="sdv-civilisation-results-title">Fin de partie</h2>
      <p className="sdv-civilisation-winner">
        {winner.name === me ? 'Tu as gagné !' : `${winner.name} gagne la partie.`}
      </p>
      <table className="sdv-civilisation-scores">
        <thead>
          <tr>
            <th scope="col">Rang</th>
            <th scope="col">Joueur</th>
            <th scope="col">Militaire</th>
            <th scope="col">Trésor</th>
            <th scope="col">Civil</th>
            <th scope="col">Science</th>
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
              <td>{row.score.civil}</td>
              <td>{row.score.science}</td>
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
