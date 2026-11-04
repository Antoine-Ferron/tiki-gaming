import { beforeEach, describe, expect, test, vi } from 'vitest'
import { Vector3 } from 'three'
import type { Game } from '../game/Game'
import { calls, failNext } from '../game/testing/fakeApi'
import { useUiStore } from '../state/uiStore'
import { gpsPath, gpsTarget } from './gps'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))

/** Partie réduite à ce que lit le GPS : objectif de mission, position du joueur, nœud routier le plus proche. */
function fakeGame() {
  const state = {
    objective: null as Vector3 | null,
    node: { id: 1 } as { id: number } | null,
    player: new Vector3(0, 0, 0),
  }
  const game = {
    missions: { objective: () => state.objective },
    player: {
      get position() {
        return state.player
      },
    },
    nav: { nearestNode: () => state.node },
  } as unknown as Game
  return { game, state }
}

const routeCalls = () => calls.filter((c) => c.name === 'route').length
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(async () => {
  // Remet l'état interne du GPS à zéro : sans cible, l'itinéraire est effacé.
  useUiStore.setState({ waypoint: null })
  gpsPath(fakeGame().game, 1)
  await flush()
  calls.length = 0
})

describe('cible du GPS', () => {
  test('sans mission ni repère : aucune cible ni itinéraire', () => {
    const { game } = fakeGame()

    expect(gpsTarget(game)).toBeNull()
    expect(gpsPath(game, 0.1)).toEqual([])
    expect(routeCalls()).toBe(0)
  })

  test('un repère posé sur la carte devient la cible', () => {
    const { game } = fakeGame()
    useUiStore.setState({ waypoint: { x: 100, z: 50 } })

    expect(gpsTarget(game)).toEqual({ x: 100, z: 50, kind: 'waypoint' })
  })

  test('l’objectif de mission passe avant le repère', () => {
    const { game, state } = fakeGame()
    useUiStore.setState({ waypoint: { x: 100, z: 50 } })
    state.objective = new Vector3(-20, 0, 30)

    expect(gpsTarget(game)).toEqual({ x: -20, z: 30, kind: 'mission' })
  })
})

describe('itinéraire', () => {
  test('l’itinéraire est demandé au serveur puis affiché', async () => {
    const { game } = fakeGame()
    useUiStore.setState({ waypoint: { x: 100, z: 50 } })

    expect(gpsPath(game, 0.1)).toEqual([])
    await flush()

    const path = gpsPath(game, 0.1)
    expect(path.map((p) => [p.x, p.z])).toEqual([
      [0, 0],
      [100, 50],
    ])
    expect(routeCalls()).toBe(1)
  })

  test('pas de nouvelle requête tant que rien ne change', async () => {
    const { game } = fakeGame()
    useUiStore.setState({ waypoint: { x: 100, z: 50 } })
    gpsPath(game, 0.1)
    gpsPath(game, 0.1) // réponse encore attendue
    await flush()

    gpsPath(game, 1)

    expect(routeCalls()).toBe(1)
  })

  test('le joueur change de nœud : nouvelle requête au plus deux fois par seconde', async () => {
    const { game, state } = fakeGame()
    useUiStore.setState({ waypoint: { x: 100, z: 50 } })
    gpsPath(game, 0.1)
    await flush()

    state.node = { id: 2 }
    gpsPath(game, 0.1)
    expect(routeCalls()).toBe(1)
    gpsPath(game, 0.5)
    expect(routeCalls()).toBe(2)
  })

  test('la cible déplacée de plus de 5 m : nouvelle requête immédiate', async () => {
    const { game } = fakeGame()
    useUiStore.setState({ waypoint: { x: 100, z: 50 } })
    gpsPath(game, 0.1)
    await flush()

    useUiStore.setState({ waypoint: { x: 200, z: 50 } })
    gpsPath(game, 0.01)

    expect(routeCalls()).toBe(2)
  })

  test('une réponse arrivée après l’effacement de la cible est ignorée', async () => {
    const { game } = fakeGame()
    useUiStore.setState({ waypoint: { x: 100, z: 50 } })
    gpsPath(game, 0.1)

    useUiStore.setState({ waypoint: null })
    gpsPath(game, 0.1)
    await flush()

    expect(gpsPath(game, 0.1)).toEqual([])
  })

  test('serveur injoignable : l’ancien itinéraire reste affiché', async () => {
    const { game } = fakeGame()
    useUiStore.setState({ waypoint: { x: 100, z: 50 } })
    gpsPath(game, 0.1)
    await flush()

    failNext(new Error('hors ligne'))
    useUiStore.setState({ waypoint: { x: 300, z: 50 } })
    gpsPath(game, 0.1)
    await flush()

    expect(gpsPath(game, 0.1)).toHaveLength(2)
  })

  test('hors du réseau routier : aucune requête', () => {
    const { game, state } = fakeGame()
    state.node = null
    useUiStore.setState({ waypoint: { x: 100, z: 50 } })

    gpsPath(game, 0.1)

    expect(routeCalls()).toBe(0)
  })
})
