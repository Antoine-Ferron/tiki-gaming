import './echecs.css'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] // rangée 8 en haut, vue des Blancs

/**
 * Squelette du jeu : affiche un échiquier vide.
 * Les règles sont dans le moteur côté serveur (backend/.../games/echecs/), écrites en TDD ;
 * cet écran affichera la partie renvoyée par l'API.
 */
export default function EchecsGame() {
  return (
    <div className="echecs">
      <section className="card">
        <h2>Échecs</h2>
        <p className="muted">Le jeu arrive bientôt : tu pourras jouer à deux sur le même écran.</p>
        <div className="echecs-board" role="img" aria-label="Échiquier vide">
          {RANKS.map((rank) =>
            FILES.map((file, fileIndex) => {
              const light = (fileIndex + rank) % 2 === 0 // h1 est une case claire
              return (
                <div
                  key={`${file}${rank}`}
                  className={`echecs-square ${light ? 'echecs-square-light' : 'echecs-square-dark'}`}
                  data-square={`${file}${rank}`}
                />
              )
            }),
          )}
        </div>
      </section>
    </div>
  )
}
