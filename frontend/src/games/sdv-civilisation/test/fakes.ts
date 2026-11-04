import { vi } from 'vitest'
import type { GameView } from '../game'
import type { GameServer } from '../ports'
import type { Wonder } from '../wonders'
import ageTwo from './contract/age-2.json'
import over from './contract/over.json'
import start from './contract/start.json'
import turnTwo from './contract/turn-2.json'
import wonders from './contract/wonders.json'

/**
 * Réponses du serveur figées par le test de contrat du back (GameViewContractTest) : alice a la Citadelle
 * d’Orkan, "IA 1" (à droite) le Temple d’Ysar, "IA 2" (à gauche) le Phare de Sélène.
 */
export const contract = {
  wonders: wonders as Wonder[],
  /** Tour 1 : l'Atelier s'achète 2 pièces à IA 2, la Palissade manque de bois. */
  start: start as GameView,
  /** Tour 2 : alice a construit l'Atelier, chaque IA les Bains. */
  turnTwo: turnTwo as GameView,
  /** Âge II, tour 1 : les conflits de l'âge I viennent d'être résolus. */
  ageTwo: ageTwo as GameView,
  /** Fin de partie, avec le classement. */
  over: over as GameView,
}

/**
 * Fake : serveur de partie en mémoire. Il garde la partie en cours et répond à chaque coup par la vue suivante
 * de `plays`. Chaque méthode est aussi un spy (vi.fn) : on vérifie ce que l'écran a demandé au serveur.
 */
export class FakeGameServer implements GameServer {
  saved: GameView | null
  private readonly plays: GameView[]

  constructor({ saved = null, plays = [] }: { saved?: GameView | null; plays?: GameView[] } = {}) {
    this.saved = saved
    this.plays = [...plays]
  }

  wonders = vi.fn(async () => contract.wonders)
  current = vi.fn(async () => this.saved)
  start = vi.fn(async (_wonder: string) => (this.saved = contract.start))
  play = vi.fn(async (_card: number, _action: string, _version: number) => {
    const next = this.plays.shift()
    if (!next) throw new Error('Fake : aucun tour prévu')
    return (this.saved = next)
  })
  abandon = vi.fn(async () => {
    this.saved = null
  })
}
