/** Crime kinds and their heat value. */
export const CRIMES = {
  assault: 1,
  shooting: 1.5,
  carjack: 2,
  vehicleAttack: 1,
  killCivilian: 3,
  attackCop: 4,
  killCop: 7,
  explosion: 4,
  policeVehicle: 3,
} as const
export type Crime = keyof typeof CRIMES

/** Heat thresholds for 1..5 stars. */
export const STAR_HEAT = [0.5, 5, 12, 22, 36]
/** Search radius (m) per star level. */
export const SEARCH_RADIUS = [0, 120, 170, 230, 300, 380]

/**
 * Wanted-level state machine. Pure logic, no engine dependency (unit-tested).
 * - Crimes add heat → stars.
 * - While police see the player, the search center follows them.
 * - When unseen, a timer runs (faster outside the search circle); at the end the level is lost.
 */
export class WantedLevel {
  heat = 0
  stars = 0
  lastSeen = { x: 0, z: 0 }
  unseen = 0
  /** True while police lost sight (stars flash). */
  searching = false
  maxStars = 0

  get searchRadius() {
    return SEARCH_RADIUS[this.stars]
  }

  /** Time needed out of sight to lose the current level. */
  get loseTime() {
    return 12 + this.stars * 6
  }

  commit(crime: Crime, x: number, z: number, witnessed: boolean, minStars = 0) {
    if (!witnessed) return
    this.heat += CRIMES[crime]
    const before = this.stars
    this.stars = Math.max(this.stars, minStars, this.starsFor(this.heat))
    // Le niveau monte (y compris la première étoile) : la recherche repart du lieu du crime.
    if (this.stars > before) {
      this.searching = false
      this.unseen = 0
      this.lastSeen = { x, z }
    }
    this.maxStars = Math.max(this.maxStars, this.stars)
  }

  /** Force a minimum level (missions). */
  setMinimum(stars: number, x: number, z: number) {
    if (this.stars >= stars) return
    this.stars = stars
    this.heat = Math.max(this.heat, STAR_HEAT[stars - 1])
    this.lastSeen = { x, z }
    this.unseen = 0
    this.searching = false
    this.maxStars = Math.max(this.maxStars, this.stars)
  }

  starsFor(heat: number) {
    let s = 0
    for (let i = 0; i < STAR_HEAT.length; i++) if (heat >= STAR_HEAT[i]) s = i + 1
    return s
  }

  /** Advance the search. Returns true when the level has just been lost. */
  update(dt: number, seen: boolean, x: number, z: number): boolean {
    if (this.stars === 0) return false
    if (seen) {
      this.lastSeen = { x, z }
      this.unseen = 0
      this.searching = false
      return false
    }
    this.searching = true
    const outside = Math.hypot(x - this.lastSeen.x, z - this.lastSeen.z) > this.searchRadius
    this.unseen += dt * (outside ? 2.5 : 1)
    if (this.unseen >= this.loseTime) {
      this.clear()
      return true
    }
    return false
  }

  clear() {
    this.heat = 0
    this.stars = 0
    this.unseen = 0
    this.searching = false
  }
}
