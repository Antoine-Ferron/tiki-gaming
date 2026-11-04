import type { Actor, DamageInfo } from '../entities/Actor'
import type { Vehicle } from '../entities/Vehicle'

/** Typed event bus for decoupled communication between systems (crimes, damage, missions…). */
export interface GameEvents {
  'actor:killed': { actor: Actor; info: DamageInfo }
  'actor:hurt': { actor: Actor; info: DamageInfo }
  'vehicle:attacked': { vehicle: Vehicle }
  'vehicle:destroyed': { vehicle: Vehicle }
  'vehicle:entered': { vehicle: Vehicle; jacked: boolean }
  'vehicle:exited': { vehicle: Vehicle }
  /** Loud noise (gunshot, explosion): peds panic, police may notice. */
  noise: { x: number; y: number; z: number; radius: number; source: Actor | null }
  'player:died': { cause: string }
  'player:busted': Record<string, never>
  'player:respawned': Record<string, never>
  notify: { text: string; kind?: 'info' | 'success' | 'fail' | 'big' }
}

type Handler<T> = (payload: T) => void

export class EventBus<E extends object> {
  private handlers = new Map<keyof E, Set<Handler<never>>>()

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(type)
    if (!set) this.handlers.set(type, (set = new Set()))
    set.add(handler as Handler<never>)
    return () => set.delete(handler as Handler<never>)
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    this.handlers.get(type)?.forEach((h) => (h as Handler<E[K]>)(payload))
  }

  clear() {
    this.handlers.clear()
  }
}
