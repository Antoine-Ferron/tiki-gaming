import { PerspectiveCamera, Scene, type WebGLRenderer } from 'three'

/**
 * Lance une vraie partie sans rendu WebGL, pour les tests de simulation (environnement jsdom).
 * Le fichier de test doit d'abord remplacer l'API :
 *
 *   vi.mock('../net/api', () => import('./testing/fakeApi'))
 *   const t = await createTestGame()
 *   t.simulate(2)
 */

/** Objet qui accepte n'importe quel accès ou appel : remplace le renderer WebGL et le contexte 2D. */
export function anything(): unknown {
  const target = function () {}
  const proxy: unknown = new Proxy(target, {
    get: (_, key) => {
      if (key === Symbol.toPrimitive) return () => 0
      if (key === 'data') return new Uint8ClampedArray(4 * 1024 * 1024)
      if (key === 'width' || key === 'height') return 1
      // WebGLCoordinateSystem de three : exigé par CubeCamera (reflets).
      if (key === 'coordinateSystem') return 2000
      return proxy
    },
    set: () => true,
    apply: () => proxy,
    construct: () => proxy as object,
  })
  return proxy
}

export interface TestGameOptions {
  /** Voitures en circulation (0 par défaut : une ville vide simule cinq fois plus vite). */
  traffic?: number
  /** Piétons ambiants (0 par défaut). */
  pedestrians?: number
  /** Construit les maillages des quartiers autour du départ (affichage seulement, ~250 ms). */
  meshes?: boolean
}

export async function createTestGame({ traffic = 0, pedestrians = 0, meshes = false }: TestGameOptions = {}) {
  // Les textures dessinées au canvas sont créées dès l'import des modules du rendu.
  HTMLCanvasElement.prototype.getContext = (() => anything()) as unknown as HTMLCanvasElement['getContext']
  const { Game } = await import('../Game')
  const { input } = await import('../../core/input')
  const { TRAFFIC_SETTINGS } = await import('../../systems/Traffic')
  const { PED_SETTINGS } = await import('../../systems/Pedestrians')
  const { WorldRenderer } = await import('../../world/WorldRenderer')
  TRAFFIC_SETTINGS.density = traffic
  TRAFFIC_SETTINGS.parked = Math.round(traffic * 0.6)
  PED_SETTINGS.density = pedestrians
  const detach = input.attach(document.createElement('canvas'))
  const game = new Game(new Scene(), new PerspectiveCamera(), anything() as WebGLRenderer)
  const prebuild = WorldRenderer.prototype.prebuild
  if (!meshes) WorldRenderer.prototype.prebuild = () => {}
  try {
    await game.init(() => {})
  } finally {
    WorldRenderer.prototype.prebuild = prebuild
  }

  /** Avance la simulation de `seconds` secondes au pas fixe de 60 Hz. */
  const simulate = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      game.update(1 / 60)
      input.endTick()
      // Pose affichée des véhicules (lue par exemple pour faire descendre un équipage), sans rendu complet.
      for (const v of game.vehicles) v.render(1, 1 / 60, 0)
    }
  }
  const key = (code: string, down: boolean) =>
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }))
  /** Appui bref : vu par le prochain pas de simulation. */
  const press = (code: string) => {
    key(code, true)
    key(code, false)
  }
  /** Maintient une touche pendant `seconds` secondes de simulation. */
  const hold = (code: string, seconds: number) => {
    key(code, true)
    simulate(seconds)
    key(code, false)
  }
  /** Simule par tranches de 0,1 s jusqu'à ce que la condition soit vraie (ou `maxSeconds` atteint). */
  const until = (cond: () => boolean, maxSeconds: number) => {
    for (let s = 0; s < maxSeconds && !cond(); s += 0.1) simulate(0.1)
    return cond()
  }
  const dispose = () => {
    detach()
    game.dispose()
  }
  return { game, input, simulate, until, press, hold, key, dispose }
}

export type TestGame = Awaited<ReturnType<typeof createTestGame>>
