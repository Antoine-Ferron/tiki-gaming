import { Quaternion, Vector3, type Object3D } from 'three'

/** Stores the last two fixed-step transforms and blends them at render time. */
export class Interp {
  readonly prev = new Vector3()
  readonly curr = new Vector3()
  readonly prevQ = new Quaternion()
  readonly currQ = new Quaternion()

  snap(p: { x: number; y: number; z: number }, q?: { x: number; y: number; z: number; w: number }) {
    this.prev.set(p.x, p.y, p.z)
    this.curr.copy(this.prev)
    if (q) {
      this.prevQ.set(q.x, q.y, q.z, q.w)
      this.currQ.copy(this.prevQ)
    }
  }

  push(p: { x: number; y: number; z: number }, q?: { x: number; y: number; z: number; w: number }) {
    this.prev.copy(this.curr)
    this.curr.set(p.x, p.y, p.z)
    if (q) {
      this.prevQ.copy(this.currQ)
      this.currQ.set(q.x, q.y, q.z, q.w)
    }
  }

  position(alpha: number, out: Vector3) {
    return out.lerpVectors(this.prev, this.curr, alpha)
  }

  apply(obj: Object3D, alpha: number, rotation = true) {
    obj.position.lerpVectors(this.prev, this.curr, alpha)
    if (rotation) obj.quaternion.slerpQuaternions(this.prevQ, this.currQ, alpha)
  }
}
