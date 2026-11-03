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

export async function createTestGame() {
  // Les textures dessinées au canvas sont créées dès l'import des modules du rendu.
  HTMLCanvasElement.prototype.getContext = (() => anything()) as unknown as HTMLCanvasElement['getContext']
  const { Game } = await import('../Game')
  const { input } = await import('../../core/input')
  const detach = input.attach(document.createElement('canvas'))
  const game = new Game(new Scene(), new PerspectiveCamera(), anything() as WebGLRenderer)
  await game.init(() => {})

  /** Avance la simulation de `seconds` secondes au pas fixe de 60 Hz. */
  const simulate = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      game.update(1 / 60)
      input.endTick()
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
  const dispose = () => {
    detach()
    game.dispose()
  }
  return { game, input, simulate, press, hold, key, dispose }
}

export type TestGame = Awaited<ReturnType<typeof createTestGame>>
