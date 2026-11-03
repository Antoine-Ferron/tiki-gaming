/* v8 ignore file -- rendu visuel (WebGL, shaders, géométries, canvas) : vérifié à l'écran, sans règle de jeu. Voir docs/games/mini-gta/regles.md § 6. */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PointLight,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Blending,
} from 'three'

function softDot(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

/** Ring-buffer GPU particle system (CPU-simulated, one draw call). */
class ParticlePool {
  readonly points: Points
  private pos: Float32Array
  private col: Float32Array
  private size: Float32Array
  private alpha: Float32Array
  private vel: Float32Array
  private life: Float32Array
  private maxLife: Float32Array
  private grow: Float32Array
  private gravity: Float32Array
  private next = 0

  constructor(
    private count: number,
    tex: CanvasTexture,
    blending: Blending,
  ) {
    this.pos = new Float32Array(count * 3)
    this.col = new Float32Array(count * 3)
    this.size = new Float32Array(count)
    this.alpha = new Float32Array(count)
    this.vel = new Float32Array(count * 3)
    this.life = new Float32Array(count)
    this.maxLife = new Float32Array(count).fill(1)
    this.grow = new Float32Array(count)
    this.gravity = new Float32Array(count)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(this.pos, 3))
    g.setAttribute('color', new BufferAttribute(this.col, 3))
    g.setAttribute('size', new BufferAttribute(this.size, 1))
    g.setAttribute('alpha', new BufferAttribute(this.alpha, 1))
    const m = new ShaderMaterial({
      uniforms: { map: { value: tex } },
      transparent: true,
      depthWrite: false,
      blending,
      vertexShader: /* glsl */ `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying float vA; varying vec3 vC;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * 900.0 / max(1.0, -mv.z);
          vA = alpha; vC = color;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; varying float vA; varying vec3 vC;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          if (vA <= 0.0) discard;
          gl_FragColor = vec4(vC, t.a * vA);
        }`,
    })
    this.points = new Points(g, m)
    this.points.frustumCulled = false
  }

  emit(p: Vector3, v: Vector3, color: Color, size: number, life: number, grow = 0, gravity = 0) {
    const i = this.next
    this.next = (this.next + 1) % this.count
    this.pos.set([p.x, p.y, p.z], i * 3)
    this.vel.set([v.x, v.y, v.z], i * 3)
    this.col.set([color.r, color.g, color.b], i * 3)
    this.size[i] = size
    this.life[i] = life
    this.maxLife[i] = life
    this.grow[i] = grow
    this.gravity[i] = gravity
  }

  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0
        continue
      }
      this.life[i] -= dt
      const k = i * 3
      this.vel[k + 1] -= this.gravity[i] * dt
      this.pos[k] += this.vel[k] * dt
      this.pos[k + 1] += this.vel[k + 1] * dt
      this.pos[k + 2] += this.vel[k + 2] * dt
      this.size[i] += this.grow[i] * dt
      const t = this.life[i] / this.maxLife[i]
      this.alpha[i] = Math.min(1, t * 2)
    }
    const g = this.points.geometry
    g.attributes.position.needsUpdate = true
    g.attributes.size.needsUpdate = true
    g.attributes.alpha.needsUpdate = true
    g.attributes.color.needsUpdate = true
  }
}

interface Flash {
  mesh: Mesh
  life: number
  max: number
  grow: number
}

const _v = new Vector3()
const _p = new Vector3()
const C = {
  spark: new Color(4, 2.6, 1.2),
  smoke: new Color(0.25, 0.25, 0.26),
  darkSmoke: new Color(0.08, 0.08, 0.08),
  fire: new Color(5, 1.8, 0.4),
  blood: new Color(0.45, 0.02, 0.02),
  water: new Color(0.7, 0.8, 0.9),
  dust: new Color(0.5, 0.45, 0.38),
}

/** Visual effects: sparks, smoke, fire, blood, water, tracers, flashes, explosions. */
export class Effects {
  readonly group = new Group()
  private additive: ParticlePool
  private normal: ParticlePool
  private tracers: { mesh: Mesh; life: number }[] = []
  private flashes: Flash[] = []
  private lights: { light: PointLight; life: number; max: number; power: number }[] = []
  private sprays: { x: number; y: number; z: number; t: number }[] = []
  private tracerGeo = new BoxGeometry(0.03, 0.03, 1).translate(0, 0, 0.5)
  private tracerMat = new MeshBasicMaterial({
    color: new Color(4, 3, 1.5),
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  private flashGeo = new SphereGeometry(1, 12, 8)

  constructor() {
    const tex = softDot()
    this.additive = new ParticlePool(1500, tex, AdditiveBlending)
    this.normal = new ParticlePool(1500, tex, NormalBlending)
    this.group.add(this.normal.points, this.additive.points)
    for (let i = 0; i < 3; i++) {
      const light = new PointLight(0xffaa55, 0, 30, 1.5)
      this.group.add(light)
      this.lights.push({ light, life: 0, max: 1, power: 0 })
    }
  }

  private flashLight(p: Vector3, power: number, life: number) {
    const slot = this.lights.reduce((a, b) => (a.life < b.life ? a : b))
    slot.light.position.copy(p)
    slot.life = life
    slot.max = life
    slot.power = power
  }

  impact(p: Vector3, n: Vector3, kind: 'spark' | 'dust' | 'blood' = 'spark') {
    const count = kind === 'blood' ? 8 : 6
    for (let i = 0; i < count; i++) {
      _v.set(n.x + (Math.random() - 0.5), n.y + Math.random() * 0.8, n.z + (Math.random() - 0.5)).multiplyScalar(
        kind === 'spark' ? 4 : 2,
      )
      if (kind === 'spark') this.additive.emit(p, _v, C.spark, 0.05, 0.25, 0, 9)
      else
        this.normal.emit(
          p,
          _v,
          kind === 'blood' ? C.blood : C.dust,
          kind === 'blood' ? 0.09 : 0.15,
          0.6,
          0.3,
          kind === 'blood' ? 9 : 1,
        )
    }
  }

  muzzle(p: Vector3, dir: Vector3) {
    const m = new Mesh(
      this.flashGeo,
      new MeshBasicMaterial({
        color: new Color(5, 3.5, 1.5),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )
    m.position.copy(p).addScaledVector(dir, 0.15)
    m.scale.setScalar(0.08)
    this.group.add(m)
    this.flashes.push({ mesh: m, life: 0.05, max: 0.05, grow: 0.6 })
    this.flashLight(p, 6, 0.06)
  }

  tracer(from: Vector3, to: Vector3) {
    const len = from.distanceTo(to)
    if (len < 2) return
    const m = new Mesh(this.tracerGeo, this.tracerMat)
    m.position.copy(from)
    m.lookAt(to)
    m.scale.set(1, 1, len)
    this.group.add(m)
    this.tracers.push({ mesh: m, life: 0.05 })
  }

  smoke(p: Vector3, dark = false, scale = 1) {
    _v.set((Math.random() - 0.5) * 0.6, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6)
    this.normal.emit(p, _v, dark ? C.darkSmoke : C.smoke, 0.5 * scale, 2.2, 1.2 * scale, -0.2)
  }

  fire(p: Vector3, scale = 1) {
    _v.set((Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8)
    _p.copy(p).add(_v.clone().multiplyScalar(0.1))
    this.additive.emit(_p, _v, C.fire, 0.45 * scale, 0.5, -0.4, -1)
  }

  explosion(p: Vector3, radius: number) {
    const m = new Mesh(
      this.flashGeo,
      new MeshBasicMaterial({
        color: new Color(6, 3, 1),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )
    m.position.copy(p)
    m.scale.setScalar(radius * 0.3)
    this.group.add(m)
    this.flashes.push({ mesh: m, life: 0.35, max: 0.35, grow: radius * 2.2 })
    this.flashLight(p, 80, 0.6)
    for (let i = 0; i < 50; i++) {
      _v.randomDirection().multiplyScalar(4 + Math.random() * radius)
      _v.y = Math.abs(_v.y)
      this.additive.emit(p, _v, C.fire, 0.8 + Math.random(), 0.6 + Math.random() * 0.4, -0.5, 0)
    }
    for (let i = 0; i < 40; i++) {
      _v.randomDirection().multiplyScalar(2 + Math.random() * 3)
      _v.y = Math.abs(_v.y) + 1
      this.normal.emit(p, _v, C.darkSmoke, 1.2, 3 + Math.random() * 2, 2.2, -0.3)
    }
    for (let i = 0; i < 30; i++) {
      _v.randomDirection().multiplyScalar(10 + Math.random() * 10)
      _v.y = Math.abs(_v.y) * 1.5
      this.additive.emit(p, _v, C.spark, 0.08, 1.2, 0, 9.8)
    }
  }

  waterSpray(x: number, y: number, z: number) {
    this.sprays.push({ x, y, z, t: 12 })
  }

  update(dt: number) {
    this.additive.update(dt)
    this.normal.update(dt)
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]
      t.life -= dt
      if (t.life <= 0) {
        t.mesh.removeFromParent()
        this.tracers.splice(i, 1)
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]
      f.life -= dt
      f.mesh.scale.addScalar(f.grow * dt)
      ;(f.mesh.material as MeshBasicMaterial).opacity = Math.max(0, f.life / f.max)
      if (f.life <= 0) {
        f.mesh.removeFromParent()
        ;(f.mesh.material as MeshBasicMaterial).dispose()
        this.flashes.splice(i, 1)
      }
    }
    for (const l of this.lights) {
      l.life = Math.max(0, l.life - dt)
      l.light.intensity = l.max > 0 ? (l.life / l.max) * l.power : 0
    }
    for (let i = this.sprays.length - 1; i >= 0; i--) {
      const s = this.sprays[i]
      s.t -= dt
      for (let k = 0; k < 3; k++) {
        _v.set((Math.random() - 0.5) * 1.2, 6 + Math.random() * 3, (Math.random() - 0.5) * 1.2)
        this.normal.emit(_p.set(s.x, s.y, s.z), _v, C.water, 0.12, 1.4, 0.2, 9.8)
      }
      if (s.t <= 0) this.sprays.splice(i, 1)
    }
  }
}
