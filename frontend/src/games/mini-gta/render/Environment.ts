/* v8 ignore file -- rendu visuel (WebGL, shaders, géométries, canvas) : vérifié à l'écran, sans règle de jeu. Voir docs/games/mini-gta/regles.md § 6. */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  HemisphereLight,
  LineSegments,
  Mesh,
  PMREMGenerator,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  Vector3,
  type WebGLRenderer,
  type Texture,
} from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { clamp, damp, lerp, smoothstep } from '../core/math'
import { Rng } from '../core/rng'
import { sharedUniforms } from './materials'
import { REFLECT_LAYER } from './Reflections'

export type Weather = 'clear' | 'cloudy' | 'rain'

export const ENV_SETTINGS = {
  /** Game hours per real second (default: a day lasts 24 real minutes). */
  timeSpeed: 1 / 60,
  shadowQuality: 'high' as 'off' | 'low' | 'high',
  forcedWeather: 'auto' as Weather | 'auto',
}

function scaleSkyExposure(sky: Sky, uniform: { value: number }) {
  sky.material.uniforms.uSkyExposure = uniform
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace('void main()', 'uniform float uSkyExposure;\nvoid main()')
    .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * uSkyExposure, 1.0 );')
}

const WEATHER_TARGETS: Record<Weather, { cloud: number; rain: number }> = {
  clear: { cloud: 0, rain: 0 },
  cloudy: { cloud: 0.7, rain: 0 },
  rain: { cloud: 1, rain: 1 },
}

/** Day/night cycle, sky, sun and moon, fog, weather and rain. */
export class Environment {
  hours = 14
  night = 0
  weather: Weather = 'clear'
  cloud = 0
  rain = 0
  readonly sun: DirectionalLight
  private hemi: HemisphereLight
  private sky: Sky
  private envSky: Sky
  private envScene = new Scene()
  private pmrem: PMREMGenerator
  private envTex?: Texture
  private envTimer = 0
  private weatherTimer = 120
  private rainMesh: LineSegments
  private stars: Points
  private sunDir = new Vector3()
  private fogColor = new Color()
  private rng = new Rng(77)
  /** The Sky shader outputs physical (very bright) radiance: scale it down. */
  private skyExposure = { value: 0.35 }

  constructor(
    private scene: Scene,
    renderer: WebGLRenderer,
  ) {
    this.sky = new Sky()
    this.sky.scale.setScalar(1500)
    scaleSkyExposure(this.sky, this.skyExposure)
    this.sky.layers.enable(REFLECT_LAYER)
    scene.add(this.sky)
    this.envSky = new Sky()
    scaleSkyExposure(this.envSky, this.skyExposure)
    this.envSky.scale.setScalar(50)
    this.envScene.add(this.envSky)
    this.pmrem = new PMREMGenerator(renderer)

    this.hemi = new HemisphereLight(0xbcd4ff, 0x4a4036, 0.6)
    scene.add(this.hemi)
    this.sun = new DirectionalLight(0xffffff, 3)
    this.sun.castShadow = true
    this.applyShadowQuality()
    this.sun.layers.enable(REFLECT_LAYER)
    this.hemi.layers.enable(REFLECT_LAYER)
    scene.add(this.sun)
    scene.add(this.sun.target)
    scene.fog = new Fog(0xa0b4c8, 150, 900)

    this.rainMesh = this.buildRain()
    scene.add(this.rainMesh)
    this.stars = this.buildStars()
    scene.add(this.stars)
  }

  applyShadowQuality() {
    const q = ENV_SETTINGS.shadowQuality
    this.sun.castShadow = q !== 'off'
    const size = q === 'high' ? 4096 : 2048
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size)
      this.sun.shadow.map?.dispose()
      this.sun.shadow.map = null
    }
    const r = q === 'high' ? 110 : 70
    const cam = this.sun.shadow.camera
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = 600
    cam.updateProjectionMatrix()
    this.sun.shadow.bias = -0.0003
    this.sun.shadow.normalBias = 0.04
  }

  private buildRain() {
    const N = 6000
    const pos = new Float32Array(N * 2 * 3)
    const end = new Float32Array(N * 2)
    for (let i = 0; i < N; i++) {
      const x = Math.random() * 80
      const y = Math.random() * 40
      const z = Math.random() * 80
      pos.set([x, y, z, x, y, z], i * 6)
      end[i * 2 + 1] = 1
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('aEnd', new Float32BufferAttribute(end, 1))
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: sharedUniforms.uTime, uCam: { value: new Vector3() }, uRain: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aEnd;
        uniform float uTime; uniform vec3 uCam; uniform float uRain;
        varying float vA;
        void main() {
          vec3 box = vec3(80.0, 40.0, 80.0);
          vec3 p = position;
          p.y -= uTime * 22.0;
          p.x -= uTime * 3.0;
          p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam;
          p += vec3(0.08, 0.9, 0.0) * aEnd;
          vA = uRain * (0.25 + 0.2 * aEnd);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { gl_FragColor = vec4(0.7, 0.75, 0.8, vA); }`,
    })
    const mesh = new LineSegments(g, m)
    mesh.frustumCulled = false
    return mesh
  }

  private buildStars() {
    const N = 1800
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      pos.set([Math.cos(a) * r * 1500, Math.abs(u) * 1500, Math.sin(a) * r * 1500], i * 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    const m = new PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    const p = new Points(g, m)
    p.frustumCulled = false
    return p
  }

  setWeather(w: Weather) {
    this.weather = w
    this.weatherTimer = this.rng.range(180, 420)
  }

  update(dt: number, simDt: number, focus: Vector3, camPos: Vector3) {
    this.hours = (this.hours + simDt * ENV_SETTINGS.timeSpeed) % 24
    // Weather state machine
    if (ENV_SETTINGS.forcedWeather !== 'auto') this.weather = ENV_SETTINGS.forcedWeather
    else {
      this.weatherTimer -= simDt
      if (this.weatherTimer <= 0) {
        const next: Weather =
          this.weather === 'clear'
            ? this.rng.pick<Weather>(['clear', 'cloudy'])
            : this.weather === 'cloudy'
              ? this.rng.pick<Weather>(['clear', 'rain', 'rain'])
              : this.rng.pick<Weather>(['cloudy', 'clear'])
        this.setWeather(next)
      }
    }
    const target = WEATHER_TARGETS[this.weather]
    this.cloud = damp(this.cloud, target.cloud, 0.08, simDt)
    this.rain = damp(this.rain, target.rain, 0.12, simDt)
    sharedUniforms.uWet.value = damp(
      sharedUniforms.uWet.value,
      this.rain > 0.2 ? 1 : 0,
      this.rain > 0.2 ? 0.08 : 0.02,
      simDt,
    )

    // Sun: rises in the east (+x), sets in the west (-x), tilted south.
    const angle = ((this.hours - 6) / 12) * Math.PI
    this.sunDir.set(Math.cos(angle), Math.sin(angle), 0.35).normalize()
    const elev = this.sunDir.y
    this.night = smoothstep(0.08, -0.12, elev)
    sharedUniforms.uNight.value = this.night
    const day = 1 - this.night
    const dusk = smoothstep(0.35, 0.02, Math.abs(elev)) * day

    const su = this.sky.material.uniforms
    const eu = this.envSky.material.uniforms
    for (const u of [su, eu]) {
      u.sunPosition.value.copy(this.sunDir)
      u.turbidity.value = 2.5 + this.cloud * 12
      u.rayleigh.value = 1.2 + this.cloud * 1.8 + dusk * 1.5
      u.mieCoefficient.value = 0.005 + this.cloud * 0.02
      u.mieDirectionalG.value = 0.8
    }

    // Sun light (or moon at night), follows the focus with texel snapping.
    const moon = this.night > 0.5
    const lightDir = moon ? new Vector3(-this.sunDir.x, -this.sunDir.y, this.sunDir.z).normalize() : this.sunDir
    const cover = 1 - this.cloud * 0.75
    this.sun.intensity = moon ? 0.12 * (1 - this.cloud * 0.8) : clamp(elev * 6, 0, 1) * 1.7 * cover
    this.sun.color.setRGB(1, lerp(1, 0.65, dusk), lerp(1, 0.4, dusk))
    if (moon) this.sun.color.setRGB(0.6, 0.7, 1)
    const r = this.sun.shadow.camera.right
    const texel = (r * 2) / this.sun.shadow.mapSize.x
    const fx = Math.round(focus.x / texel) * texel
    const fz = Math.round(focus.z / texel) * texel
    this.sun.target.position.set(fx, focus.y, fz)
    this.sun.position.set(fx + lightDir.x * 300, focus.y + Math.max(0.15, lightDir.y) * 300, fz + lightDir.z * 300)

    this.hemi.intensity = lerp(0.035, 0.35, day) * (1 - this.cloud * 0.25)
    this.hemi.color.setRGB(lerp(0.25, 0.75, day), lerp(0.3, 0.83, day), lerp(0.45, 1, day))
    this.hemi.groundColor.setRGB(lerp(0.05, 0.3, day), lerp(0.05, 0.26, day), lerp(0.07, 0.22, day))

    // Fog
    const fog = this.scene.fog as Fog
    const dayFog = new Color().setRGB(0.5, 0.58, 0.68).lerp(new Color(0.55, 0.57, 0.6), this.cloud)
    dayFog.lerp(new Color(0.85, 0.55, 0.4), dusk * 0.5)
    this.fogColor.copy(dayFog).lerp(new Color(0.02, 0.03, 0.06), this.night)
    fog.color.copy(this.fogColor)
    fog.near = lerp(280, 60, this.rain)
    fog.far = lerp(1600, 420, this.rain) * lerp(1, 0.75, this.night)

    // Environment reflections from the sky itself, refreshed periodically.
    this.envTimer -= dt
    if (this.envTimer <= 0) {
      this.envTimer = 8
      const tex = this.pmrem.fromScene(this.envScene, 0, 0.1, 100).texture
      this.envTex?.dispose()
      this.envTex = tex
      this.scene.environment = tex
    }
    this.scene.environmentIntensity = lerp(0.03, 0.45, day) * (1 - this.cloud * 0.3)
    this.skyExposure.value = lerp(0.35, 0.22, this.cloud)

    // Rain & stars
    const rm = this.rainMesh.material as ShaderMaterial
    rm.uniforms.uCam.value.copy(camPos)
    rm.uniforms.uRain.value = this.rain
    this.rainMesh.visible = this.rain > 0.02
    this.stars.position.copy(camPos)
    ;(this.stars.material as PointsMaterial).opacity = this.night * (1 - this.cloud)
    this.sky.position.copy(camPos)
  }

  dispose() {
    this.envTex?.dispose()
    this.pmrem.dispose()
    for (const o of [this.sky, this.rainMesh, this.stars]) {
      o.removeFromParent()
      ;(o as Mesh).geometry.dispose()
    }
    this.sun.removeFromParent()
    this.hemi.removeFromParent()
    this.scene.fog = null
    this.scene.environment = null
  }
}
