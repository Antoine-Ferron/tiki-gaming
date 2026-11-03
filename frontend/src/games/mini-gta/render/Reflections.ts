/* v8 ignore file -- rendu visuel (WebGL, shaders, géométries, canvas) : vérifié à l'écran, sans règle de jeu. Voir docs/games/mini-gta/regles.md § 6. */
import {
  CubeCamera,
  HalfFloatType,
  LinearMipmapLinearFilter,
  WebGLCubeRenderTarget,
  type Scene,
  type Vector3,
  type WebGLRenderer,
} from 'three'

/** Objects on this layer (city geometry, sky, sea) are rendered into the reflection cube map. */
export const REFLECT_LAYER = 1

/**
 * Real-time environment reflections of the city around the camera.
 * One cube face is rendered per frame (amortized cost), the map is re-filtered every 6 frames.
 */
export class Reflections {
  readonly target: WebGLCubeRenderTarget
  private cube: CubeCamera
  private face = 0
  private primed = false
  enabled = true

  constructor(size = 256) {
    this.target = new WebGLCubeRenderTarget(size, {
      type: HalfFloatType,
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
    })
    this.cube = new CubeCamera(1, 900, this.target)
    for (const c of this.cube.children) c.layers.set(REFLECT_LAYER)
  }

  get texture() {
    return this.target.texture
  }

  update(renderer: WebGLRenderer, scene: Scene, position: Vector3) {
    if (!this.enabled) return
    if (this.face === 0) {
      this.cube.position.copy(position)
      this.cube.updateMatrixWorld(true)
    }
    if (this.cube.coordinateSystem !== renderer.coordinateSystem) {
      this.cube.coordinateSystem = renderer.coordinateSystem
      this.cube.updateCoordinateSystem()
    }
    if (!this.primed) {
      // First update: render all faces at once so vehicles never show a black environment.
      this.primed = true
      for (let i = 0; i < 6; i++) this.update(renderer, scene, position)
      return
    }
    const cam = this.cube.children[this.face]
    const prevTarget = renderer.getRenderTarget()
    const prevFace = renderer.getActiveCubeFace()
    const prevMip = renderer.getActiveMipmapLevel()
    const shadowAuto = renderer.shadowMap.autoUpdate
    renderer.shadowMap.autoUpdate = false
    const xr = renderer.xr.enabled
    renderer.xr.enabled = false
    renderer.setRenderTarget(this.target, this.face)
    renderer.render(scene, cam as Parameters<WebGLRenderer['render']>[1])
    renderer.setRenderTarget(prevTarget, prevFace, prevMip)
    renderer.xr.enabled = xr
    renderer.shadowMap.autoUpdate = shadowAuto
    this.face = (this.face + 1) % 6
    if (this.face === 0) this.target.texture.needsPMREMUpdate = true
  }

  dispose() {
    this.target.dispose()
  }
}
