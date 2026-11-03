import { type Board, type Move, parseBoard } from './board'
import { isSolved, moveVehicle } from './moves'
import { type Clock, Stopwatch } from './stopwatch'

/** Une partie sur un plateau : plateau courant, coups joués et chrono. Aucune I/O, l'horloge est injectée. */
export class GameSession {
  private readonly history: { board: Board; move: Move }[] = []
  private current: Board
  private readonly stopwatch: Stopwatch

  constructor(map: string[], clock: Clock) {
    this.current = parseBoard(map)
    this.stopwatch = new Stopwatch(clock)
  }

  get board(): Board {
    return this.current
  }

  get moves(): Move[] {
    return this.history.map((h) => h.move)
  }

  get moveCount(): number {
    return this.history.length
  }

  get solved(): boolean {
    return isSolved(this.current)
  }

  /** Temps de la partie : il s'arrête à la victoire. */
  get elapsedMs(): number {
    return this.stopwatch.elapsedMs
  }

  /** Un coup : glisse un véhicule. Un glissement impossible est refusé et ne compte pas. */
  move(id: string, delta: number): void {
    if (this.solved) throw new Error('Partie terminée')
    const next = moveVehicle(this.current, id, delta)
    this.history.push({ board: this.current, move: { id, delta } })
    this.current = next
    if (this.solved) this.stopwatch.stop()
  }

  /** Annule le dernier coup : revient au plateau d'avant. Sans coup joué, ou après la victoire, ne fait rien. */
  undo(): void {
    if (this.solved) return
    const last = this.history.pop()
    if (last) this.current = last.board
  }
}
