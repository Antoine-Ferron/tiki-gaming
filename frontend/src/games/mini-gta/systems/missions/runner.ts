/** Declarative mission steps, evaluated by a pure runner (unit-tested). */
export interface Pos {
  x: number
  z: number
}

export type Step =
  | { type: 'goto'; text: string; pos: Pos; radius: number; inVehicle?: boolean; onFoot?: boolean }
  | { type: 'deliver'; text: string; pos: Pos; radius: number; timeLimit?: number; requireTag?: string }
  | { type: 'enterVehicle'; text: string; tag: string }
  | { type: 'eliminate'; text: string; tags: string[] }
  | { type: 'destroy'; text: string; tag: string }
  | { type: 'escape'; text: string }
  | { type: 'wait'; text: string; seconds: number }

/** What the runner needs to know about the world. */
export interface MissionContext {
  playerPos(): Pos
  inVehicle(): boolean
  vehicleTag(): string | null
  /** True while at least one entity carrying the tag is alive / intact. */
  alive(tag: string): boolean
  wanted(): number
}

export interface FailRule {
  reason: string
  check(ctx: MissionContext): boolean
}

export type RunnerStatus = 'running' | 'success' | 'failed'

export class MissionRunner {
  index = 0
  stepTime = 0
  status: RunnerStatus = 'running'
  failReason = ''

  constructor(
    readonly steps: Step[],
    readonly failRules: FailRule[] = [],
    private onStep?: (index: number, step: Step) => void,
  ) {
    this.onStep?.(0, steps[0])
  }

  get step(): Step | undefined {
    return this.steps[this.index]
  }

  /** Remaining time on a timed step, or null. */
  get timeLeft(): number | null {
    const s = this.step
    if (s?.type === 'deliver' && s.timeLimit) return Math.max(0, s.timeLimit - this.stepTime)
    if (s?.type === 'wait') return Math.max(0, s.seconds - this.stepTime)
    return null
  }

  fail(reason: string) {
    if (this.status !== 'running') return
    this.status = 'failed'
    this.failReason = reason
  }

  update(dt: number, ctx: MissionContext): RunnerStatus {
    if (this.status !== 'running') return this.status
    for (const rule of this.failRules) {
      if (rule.check(ctx)) {
        this.fail(rule.reason)
        return this.status
      }
    }
    const s = this.step
    if (!s) {
      this.status = 'success'
      return this.status
    }
    this.stepTime += dt
    const p = ctx.playerPos()
    const near = (pos: Pos, r: number) => Math.hypot(p.x - pos.x, p.z - pos.z) <= r
    let done = false
    switch (s.type) {
      case 'goto':
        done = near(s.pos, s.radius) && (!s.inVehicle || ctx.inVehicle()) && (!s.onFoot || !ctx.inVehicle())
        break
      case 'deliver':
        if (s.timeLimit && this.stepTime > s.timeLimit) {
          this.fail('Temps écoulé')
          return this.status
        }
        if (s.requireTag && !ctx.alive(s.requireTag)) {
          this.fail('Le véhicule est détruit')
          return this.status
        }
        done = near(s.pos, s.radius) && (!s.requireTag || ctx.vehicleTag() === s.requireTag)
        break
      case 'enterVehicle':
        if (!ctx.alive(s.tag)) {
          this.fail('Le véhicule est détruit')
          return this.status
        }
        done = ctx.vehicleTag() === s.tag
        break
      case 'eliminate':
        done = s.tags.every((t) => !ctx.alive(t))
        break
      case 'destroy':
        done = !ctx.alive(s.tag)
        break
      case 'escape':
        done = ctx.wanted() === 0
        break
      case 'wait':
        done = this.stepTime >= s.seconds
        break
    }
    if (done) {
      this.index++
      this.stepTime = 0
      if (this.index >= this.steps.length) this.status = 'success'
      else this.onStep?.(this.index, this.steps[this.index])
    }
    return this.status
  }
}
