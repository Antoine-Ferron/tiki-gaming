import type { Game } from '../game/Game'
import type { Vehicle } from '../entities/Vehicle'
import { Groups } from '../physics/physics'
import { VEHICLES } from '../procgen/vehicles/specs'
import type { Weather } from '../render/Environment'
import { addWeapon, WEAPON_ORDER, WEAPONS } from './weapons'

/**
 * Commandes du chat (`/summon avion`, `/tp planque`…). Logique pure : analyse, alias, complétion et exécution
 * sur une partie. Aucune commande ne touche à l'argent : il passe par le serveur.
 */

export interface CommandResult {
  ok: boolean
  message: string
}

/** Minuscules sans accents : « Hélico » et « helico » désignent la même chose. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

/** Véhicules invocables : identifiants techniques et noms français. */
export const VEHICLE_ALIASES: Record<string, string> = {
  ...Object.fromEntries(Object.keys(VEHICLES).map((id) => [normalize(id), id])),
  berline: 'sedan',
  voiture: 'sedan',
  sportive: 'sport',
  '4x4': 'suv',
  utilitaire: 'van',
  camionnette: 'van',
  fourgon: 'swat',
  camion: 'truck',
  moto: 'bike',
  helico: 'heli',
  helicoptere: 'heli',
  'helico-police': 'policeHeli',
  avion: 'plane',
}

/** Lieux de téléportation (clés de city.locations). */
export const PLACES: Record<string, string> = {
  depart: 'spawn',
  planque: 'safehouseDoor',
  garage: 'garage',
  armurerie: 'gunshopDoor',
  entrepot: 'warehouseDoor',
  port: 'warehouseDoor',
  hopital: 'hospital',
  commissariat: 'policeStation',
  aerodrome: 'planeSpawn',
  heliport: 'heliSpawn',
}

const WEATHERS: Record<string, Weather | 'auto'> = {
  clair: 'clear',
  soleil: 'clear',
  nuageux: 'cloudy',
  pluie: 'rain',
  auto: 'auto',
}

interface Command {
  usage: string
  help: string
  /** Arguments proposés à la complétion. */
  args?: () => string[]
  run(game: Game, args: string[]): CommandResult
}

/** Véhicules invoqués par partie, pour /nettoyer. */
const summoned = new WeakMap<Game, Set<Vehicle>>()

const ok = (message: string): CommandResult => ({ ok: true, message })
const fail = (message: string): CommandResult => ({ ok: false, message })

const vehicleNames = () => Object.keys(VEHICLE_ALIASES).sort((a, b) => a.localeCompare(b, 'fr'))

/** Hauteur du sol réel (trottoirs compris) sous un point, ou null s'il n'y en a pas. */
function groundAt(game: Game, x: number, z: number): number | null {
  const top = game.city.terrain.heightAt(x, z) + 60
  const hit = game.physics.raycast(x, top, z, 0, -1, 0, 120, Groups.rayWorld)
  return hit ? hit.y : null
}

/**
 * Point dégagé devant le joueur pour un véhicule : sur le sol (pas sur un toit ou un prop), avec une ligne de
 * vue depuis le joueur et sans autre véhicule trop proche. Essaie plusieurs distances et décalages.
 */
function freeSpotAhead(game: Game, length: number, width: number) {
  const p = game.player.position
  const h = game.player.actor.heading
  const fwd = { x: Math.sin(h), z: Math.cos(h) }
  const right = { x: -Math.cos(h), z: Math.sin(h) }
  const radius = Math.hypot(length, width) / 2
  for (const dist of [radius + 2.5, radius + 6, radius + 10, radius + 16]) {
    for (const side of [0, 3, -3, 6, -6]) {
      const x = p.x + fwd.x * dist + right.x * side
      const z = p.z + fwd.z * dist + right.z * side
      const y = groundAt(game, x, z)
      if (y === null) continue
      // Sur un toit ou un prop : le sol réel est bien au-dessus du terrain (les trottoirs ne font que 15 cm).
      if (y - game.city.terrain.heightAt(x, z) > 0.6) continue
      if (!game.physics.lineOfSight(p.x, p.y + 1.2, p.z, x, y + 1.2, z)) continue
      let crowded = false
      for (const v of game.vehicles) {
        if (Math.hypot(v.position.x - x, v.position.z - z) < radius + v.spec.length / 2 + 0.5) crowded = true
      }
      if (!crowded) return { x, y, z, heading: h }
    }
  }
  return null
}

function parseHour(s: string): number | null {
  const m = /^(\d{1,2})(?:[h:](\d{1,2})?)?$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 24 || min > 59) return null
  return (h + min / 60) % 24
}

export const COMMANDS: Record<string, Command> = {
  aide: {
    usage: '/aide',
    help: 'liste des commandes',
    run: () =>
      ok(
        Object.values(COMMANDS)
          .map((c) => `${c.usage} : ${c.help}`)
          .join(' · '),
      ),
  },
  summon: {
    usage: '/summon <véhicule>',
    help: 'fait apparaître un véhicule devant toi',
    args: vehicleNames,
    run(game, [name]) {
      const id = name ? VEHICLE_ALIASES[normalize(name)] : undefined
      if (!id) {
        return fail(`${name ? `Véhicule inconnu : ${name}. ` : ''}Véhicules : ${Object.keys(VEHICLES).join(', ')}.`)
      }
      const spec = VEHICLES[id]
      const spot = freeSpotAhead(game, spec.length, spec.width)
      if (!spot) return fail('Pas de place dégagée devant toi : recule ou tourne-toi.')
      const v = game.spawnVehicle(id, spot.x, spot.y + 0.3, spot.z, spot.heading, 'dynamic')
      let set = summoned.get(game)
      if (!set) summoned.set(game, (set = new Set()))
      set.add(v)
      return ok(`Véhicule invoqué devant toi : ${spec.label.toLowerCase()}.`)
    },
  },
  nettoyer: {
    usage: '/nettoyer',
    help: 'retire les véhicules invoqués',
    run(game) {
      const set = summoned.get(game)
      let n = 0
      for (const v of set ?? []) {
        if (!game.vehicles.has(v)) continue
        if (game.player.vehicle === v) game.player.exitVehicle(true)
        game.removeVehicle(v)
        n++
      }
      set?.clear()
      return ok(n ? `${n} véhicule${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''}.` : 'Aucun véhicule invoqué à retirer.')
    },
  },
  tp: {
    usage: '/tp <lieu>',
    help: 'te téléporte (planque, armurerie, hopital, commissariat, aerodrome…)',
    args: () => Object.keys(PLACES),
    run(game, [name]) {
      const key = name ? PLACES[normalize(name)] : undefined
      if (!key) return fail(`Lieu inconnu. Lieux : ${Object.keys(PLACES).join(', ')}.`)
      const loc = (game.city.locations as unknown as Record<string, { x: number; y: number; z: number }>)[key]
      const health = game.player.actor.health
      const y = groundAt(game, loc.x, loc.z) ?? loc.y
      game.player.respawnAt(loc.x, y + 0.05, loc.z)
      game.player.actor.health = health
      return ok(`Téléporté : ${normalize(name!)}.`)
    },
  },
  heure: {
    usage: '/heure <0-24>',
    help: 'règle l’heure (ex. 21h30)',
    run(game, [arg]) {
      const h = arg ? parseHour(arg) : null
      if (h === null) return fail('Heure attendue entre 0 et 24, par exemple /heure 21h30.')
      game.env.hours = h
      return ok(`Il est ${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}.`)
    },
  },
  meteo: {
    usage: '/meteo <clair|nuageux|pluie>',
    help: 'change le temps',
    args: () => Object.keys(WEATHERS),
    run(game, [arg]) {
      const w = arg ? WEATHERS[normalize(arg)] : undefined
      if (!w) return fail(`Météo attendue : ${Object.keys(WEATHERS).join(', ')}.`)
      if (w !== 'auto') game.env.setWeather(w)
      return ok(w === 'auto' ? 'La météo suit son cours.' : `Météo : ${normalize(arg!)}.`)
    },
  },
  recherche: {
    usage: '/recherche <0-5>',
    help: 'règle le niveau de recherche',
    run(game, [arg]) {
      const n = Number(arg)
      if (!arg || !Number.isInteger(n) || n < 0 || n > 5) return fail('Niveau attendu entre 0 et 5.')
      const p = game.player.position
      if (n === 0) game.police.wanted.clear()
      else game.police.wanted.setMinimum(n, p.x, p.z)
      return ok(n === 0 ? 'La police ne te recherche plus.' : `Recherché : ${'★'.repeat(n)}.`)
    },
  },
  soigner: {
    usage: '/soigner',
    help: 'rend toute ta santé',
    run(game) {
      const a = game.player.actor
      if (a.dead) return fail('Trop tard : attends de réapparaître.')
      a.health = a.maxHealth
      return ok('Santé au maximum.')
    },
  },
  armes: {
    usage: '/armes',
    help: 'donne toutes les armes avec des munitions',
    run(game) {
      for (const id of WEAPON_ORDER) {
        if (id === 'fists' || !WEAPONS[id]) continue
        addWeapon(game.player.inventory, id, Math.max(1, WEAPONS[id].ammoPack) * 3)
      }
      return ok('Toutes les armes sont dans ton inventaire.')
    },
  },
}

/** Alias des noms de commande. */
const COMMAND_ALIASES: Record<string, string> = { help: 'aide', spawn: 'summon', invoquer: 'summon', weather: 'meteo' }

/** Découpe « /summon Avion » en { name: 'summon', args: ['Avion'] } ; null pour un message ordinaire. */
export function parse(line: string): { name: string; args: string[] } | null {
  const s = line.trim()
  if (!s.startsWith('/')) return null
  const [head = '', ...args] = s.slice(1).split(/\s+/)
  const name = normalize(head)
  return { name: COMMAND_ALIASES[name] ?? name, args }
}

/** Exécute une ligne du chat. Un message sans « / » est simplement repris. */
export function execute(game: Game, line: string): CommandResult {
  const cmd = parse(line)
  if (!cmd) return ok(line.trim())
  const def = COMMANDS[cmd.name]
  if (!def) return fail(`Commande inconnue : /${cmd.name}. Tape /aide pour la liste.`)
  return def.run(game, cmd.args)
}

const commonPrefix = (words: string[]) =>
  words.slice(1).reduce((p, w) => {
    let i = 0
    while (i < p.length && i < w.length && p[i] === w[i]) i++
    return p.slice(0, i)
  }, words[0] ?? '')

/**
 * Complétion (Tab) : nom de commande, puis argument (véhicule, lieu, météo). Renvoie le texte complété et les
 * propositions restantes quand il y en a plusieurs.
 */
export function complete(line: string): { text: string; options: string[] } {
  if (!line.startsWith('/')) return { text: line, options: [] }
  const space = line.indexOf(' ')
  if (space < 0) {
    const typed = normalize(line.slice(1))
    const names = Object.keys(COMMANDS).filter((n) => n.startsWith(typed))
    if (names.length === 1) return { text: `/${names[0]} `, options: [] }
    if (names.length > 1) return { text: `/${commonPrefix(names)}`, options: names.map((n) => `/${n}`) }
    return { text: line, options: [] }
  }
  const cmd = parse(line)
  const args = cmd ? COMMANDS[cmd.name]?.args?.() : undefined
  if (!cmd || !args) return { text: line, options: [] }
  const typed = normalize(line.slice(space + 1))
  const matches = args.filter((a) => a.startsWith(typed))
  const head = line.slice(0, space + 1)
  if (matches.length === 1) return { text: head + matches[0], options: [] }
  if (matches.length > 1) return { text: head + commonPrefix(matches), options: matches }
  return { text: line, options: [] }
}
