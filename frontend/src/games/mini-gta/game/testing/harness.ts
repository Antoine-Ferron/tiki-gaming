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
  // Pixels d'une ImageData : un seul tableau, sinon chaque lecture en allouerait un nouveau.
  let data: Uint8ClampedArray | null = null
  const proxy: unknown = new Proxy(target, {
    get: (_, key) => {
      if (key === Symbol.toPrimitive) return () => 0
      if (key === 'data') return (data ??= new Uint8ClampedArray(4 * 512 * 512))
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

/** Remplace Math.random par un générateur à graine fixe (mulberry32) : une simulation de test est reproductible. */
export function seedRandom(seed = 1337) {
  let a = seed >>> 0
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function createTestGame({ traffic = 0, pedestrians = 0, meshes = false }: TestGameOptions = {}) {
  seedRandom()
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
  /**
   * Remet la partie dans un état neutre, pour qu'un scénario ne dépende pas de ceux joués avant lui : joueur
   * à pied et en pleine santé au point de départ (ou à `at`), tourné comme au départ, sans recherche ni police,
   * colliders des props chargés autour de lui. Le hasard repart de la même graine : les tirages (dispersion
   * des tirs, comportements) ne dépendent pas des scénarios joués avant.
   */
  const reset = (at: { x: number; z: number; heading?: number } = game.city.locations.spawn) => {
    seedRandom()
    game.police.clear()
    game.player.respawnAt(at.x, game.city.terrain.heightAt(at.x, at.z) + 0.2, at.z)
    game.player.actor.heading = at.heading ?? 0
    const p = game.player.position
    game.world.update(0, p, p, 0)
    simulate(0.1)
  }
  const dispose = () => {
    detach()
    game.dispose()
  }
  return { game, input, simulate, until, press, hold, key, reset, dispose }
}

export type TestGame = Awaited<ReturnType<typeof createTestGame>>
