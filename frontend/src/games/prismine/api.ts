/**
 * Client du serveur arbitre de Prismine (backend Java, /api/games/prismine). Le serveur garde la carte cachée et
 * applique les règles : le front n'envoie que les tirs et la carte du joueur, et ne reçoit la vraie carte d'un étage
 * qu'une fois celui-ci terminé. Le score est classé par le serveur, jamais par le navigateur.
 */
import { apiGet, apiPost } from '@/lib/api'
import type { Grid, Outcome, PrismColor } from './engine'

/** Un tir du journal et son résultat. `revealed` : tir offert après une validation ratée. */
export type ProbeResult = Outcome & { entry: number; revealed: boolean }

/** Ce que le joueur sait d'un étage : sa taille et ce qu'il cache, pas où. */
export type FloorInfo = { depth: number; size: number; prisms: number; obsidians: number; colors: PrismColor[] }

/** Étage terminé : la vraie carte est dévoilée avec le journal de ses tirs. */
export type RevealedFloor = FloorInfo & { grid: Grid; probes: ProbeResult[] }

/** Expédition en cours, telle que le serveur la renvoie. */
export type RunView = FloorInfo & {
  id: string
  oil: number
  score: number
  floorErrors: number
  totalProbes: number
  totalErrors: number
  probes: ProbeResult[]
}

export type Verdict =
  /** La carte contredit des tirs déjà faits (indices dans le journal) : rien n'est décompté. */
  | { kind: 'contradiction'; contradictions: number[] }
  /** Carte fausse : l'entrée révélée est ajoutée au journal. */
  | { kind: 'wrong'; entry: number; run: RunView }
  | { kind: 'cleared'; points: number; perfect: boolean; floor: RevealedFloor; run: RunView }
  /** Plus assez d'huile pour payer l'erreur : fin de l'expédition. */
  | { kind: 'lamp-out'; floor: RevealedFloor; run: RunView; recorded: boolean }

/** Fin d'expédition demandée par le joueur. `recorded` : score classé (joueur connecté, au moins un étage). */
export type Ending = { floor: RevealedFloor; run: RunView; recorded: boolean }

/** Contrat du serveur arbitre : les tests le remplacent par un bouchon (voir test-doubles.ts). */
export interface PrismineApi {
  startRun(): Promise<RunView>
  getRun(id: string): Promise<RunView>
  probe(id: string, entry: number): Promise<RunView>
  validate(id: string, guess: Grid): Promise<Verdict>
  endRun(id: string): Promise<Ending>
}

type Http = { get<T>(path: string): Promise<T>; post<T>(path: string, body?: unknown): Promise<T> }

const BASE = '/games/prismine/runs'

export function createPrismineApi(http: Http = { get: apiGet, post: apiPost }): PrismineApi {
  const run = (id: string) => `${BASE}/${encodeURIComponent(id)}`
  return {
    startRun: () => http.post<RunView>(BASE),
    getRun: (id) => http.get<RunView>(run(id)),
    probe: (id, entry) => http.post<RunView>(`${run(id)}/probes`, { entry }),
    validate: (id, guess) => http.post<Verdict>(`${run(id)}/validation`, { guess }),
    endRun: (id) => http.post<Ending>(`${run(id)}/end`),
  }
}
