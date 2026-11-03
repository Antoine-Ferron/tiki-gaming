import { type Board, type Move, parseBoard } from './board'
import { isSolved, moveVehicle } from './moves'
import { solve } from './solver'
import { type Clock, Stopwatch } from './stopwatch'

/** Une partie sur un plateau : plateau courant, coups joués et chrono. Aucune I/O, l'horloge est injectée. */
export class GameSession {
  private history: { board: Board; move: Move }[] = []
  private readonly initial: Board
  private current: Board
  private stopwatch: Stopwatch
  private hints = 0

  constructor(
    map: string[],
    private readonly clock: Clock,
  ) {
    this.initial = parseBoard(map)
    this.current = this.initial
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

  /** Nombre d'indices demandés (chacun coûte des points au score). */
  get hintsUsed(): number {
    return this.hints
  }

  get solved(): boolean {
    return isSolved(this.current)
  }

  /** Temps de la partie : il s'arrête à la victoire. */
  get elapsedMs(): number {
    return this.stopwatch.elapsedMs
  }

  /**
   * Un coup : glisse un véhicule. Un glissement impossible est refusé et ne compte pas.
   * Re-glisser le véhicule du coup précédent prolonge ce coup (au clavier, case par case = un seul coup).
   */
  move(id: string, delta: number): void {
    if (this.solved) throw new Error('Partie terminée')
    const next = moveVehicle(this.current, id, delta)
    const last = this.history.at(-1)
    if (last?.move.id === id) {
      const total = last.move.delta + delta
      if (total === 0) this.history.pop()
      else last.move = { id, delta: total }
    } else {
      this.history.push({ board: this.current, move: { id, delta } })
    }
    this.current = next
    if (this.solved) this.stopwatch.stop()
  }

  /** Annule le dernier coup : revient au plateau d'avant. Sans coup joué, ou après la victoire, ne fait rien. */
  undo(): void {
    if (this.solved) return
    const last = this.history.pop()
    if (last) this.current = last.board
  }

  /** Recommence : plateau de départ, aucun coup, chrono relancé. Possible aussi après une victoire (Rejouer). */
  reset(): void {
    this.current = this.initial
    this.history = []
    this.hints = 0
    this.stopwatch = new Stopwatch(this.clock)
  }

  /** Prochain coup de la solution la plus courte depuis la position actuelle, compté comme indice. */
  hint(): Move | null {
    if (this.solved) return null
    const next = solve(this.current)?.[0] ?? null
    if (next) this.hints++
    return next
  }
}
