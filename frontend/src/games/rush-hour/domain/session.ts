import { type Board, type Move, parseBoard } from './board'
import { moveVehicle } from './moves'

/** Une partie sur un plateau : plateau courant et coups joués. Aucune I/O. */
export class GameSession {
  private readonly history: { board: Board; move: Move }[] = []
  private current: Board

  constructor(map: string[]) {
    this.current = parseBoard(map)
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

  /** Un coup : glisse un véhicule. Un glissement impossible est refusé et ne compte pas. */
  move(id: string, delta: number): void {
    const next = moveVehicle(this.current, id, delta)
    this.history.push({ board: this.current, move: { id, delta } })
    this.current = next
  }
}
