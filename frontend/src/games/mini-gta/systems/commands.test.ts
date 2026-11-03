// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { createTestGame, type TestGame } from '../game/testing/harness'
import { complete, execute, normalize, parse, VEHICLE_ALIASES } from './commands'
import { VEHICLES } from '../procgen/vehicles/specs'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))
vi.setConfig({ testTimeout: 30_000 })

describe('analyse des commandes', () => {
  test.each([
    ['/summon Avion', { name: 'summon', args: ['Avion'] }],
    ['  /TP   planque ', { name: 'tp', args: ['planque'] }],
    ['/help', { name: 'aide', args: [] }],
    ['/invoquer moto', { name: 'summon', args: ['moto'] }],
  ])('%s', (line, expected) => {
    expect(parse(line)).toEqual(expected)
  })

  test('un message sans « / » n’est pas une commande', () => {
    expect(parse('salut')).toBeNull()
  })

  test('les accents et la casse sont ignorés', () => {
    expect(normalize(' Hélicoptère ')).toBe('helicoptere')
    expect(VEHICLE_ALIASES[normalize('Hélico')]).toBe('heli')
  })

  test('tous les véhicules du jeu sont invocables par leur identifiant', () => {
    for (const id of Object.keys(VEHICLES)) expect(VEHICLE_ALIASES[normalize(id)]).toBe(id)
  })
})

describe('complétion', () => {
  test.each([
    ['/sum', '/summon '],
    ['/summon avi', '/summon avion'],
    ['/tp plan', '/tp planque'],
    ['/meteo plu', '/meteo pluie'],
  ])('%s → %s', (line, expected) => {
    expect(complete(line).text).toBe(expected)
  })

  test('plusieurs possibilités : préfixe commun et liste des propositions', () => {
    const r = complete('/summon h')

    expect(r.text.startsWith('/summon h')).toBe(true)
    expect(r.options).toEqual(expect.arrayContaining(['heli', 'helico']))
  })

  test('rien à compléter : texte inchangé', () => {
    expect(complete('/zzz').text).toBe('/zzz')
    expect(complete('bonjour').text).toBe('bonjour')
  })
})

describe('commandes dans une partie', () => {
  let t: TestGame
  let game: TestGame['game']

  beforeAll(async () => {
    t = await createTestGame()
    game = t.game
    t.simulate(0.2)
  }, 60_000)

  afterAll(() => t?.dispose())

  test('/summon avion : un avion apparaît devant le joueur, posé sur le sol', () => {
    const before = new Set(game.vehicles)
    const p = game.player.position.clone()
    const h = game.player.actor.heading

    const r = execute(game, '/summon avion')
    t.simulate(1)

    expect(r.ok).toBe(true)
    const plane = [...game.vehicles].find((v) => !before.has(v))!
    expect(plane.spec.id).toBe('plane')
    expect(plane.mode).toBe('dynamic')
    // Devant : dans le demi-plan avant du joueur.
    const ahead = (plane.position.x - p.x) * Math.sin(h) + (plane.position.z - p.z) * Math.cos(h)
    expect(ahead).toBeGreaterThan(2)
    // Sur le sol, pas enfoncé ni en l'air.
    const ground = game.city.terrain.heightAt(plane.position.x, plane.position.z)
    expect(Math.abs(plane.position.y - ground)).toBeLessThan(0.6)
    expect(plane.destroyed).toBe(false)
  })

  test('/summon sans nom ou inconnu : erreur avec la liste des véhicules', () => {
    expect(execute(game, '/summon').ok).toBe(false)
    const r = execute(game, '/summon soucoupe')
    expect(r.ok).toBe(false)
    expect(r.message).toContain('soucoupe')
    expect(r.message).toContain('sedan')
  })

  test('/nettoyer retire les véhicules invoqués et seulement eux', () => {
    execute(game, '/summon moto')
    const count = game.vehicles.size

    const r = execute(game, '/nettoyer')

    expect(r.ok).toBe(true)
    expect(game.vehicles.size).toBe(count - 2)
    expect(execute(game, '/nettoyer').message).toContain('Aucun')
  })

  test('/tp planque : le joueur est téléporté devant sa planque, sans perdre de santé', () => {
    game.player.actor.health = 60
    const door = game.city.locations.safehouseDoor

    const r = execute(game, '/tp Planque')
    t.simulate(0.2)

    expect(r.ok).toBe(true)
    expect(Math.hypot(game.player.position.x - door.x, game.player.position.z - door.z)).toBeLessThan(1)
    expect(game.player.actor.health).toBe(60)
    expect(execute(game, '/tp lune').ok).toBe(false)
  })

  test('/recherche 3 puis 0', () => {
    expect(execute(game, '/recherche 3').ok).toBe(true)
    expect(game.police.wanted.stars).toBe(3)

    execute(game, '/recherche 0')

    expect(game.police.wanted.stars).toBe(0)
    expect(execute(game, '/recherche 9').ok).toBe(false)
  })

  test('/heure, /meteo, /soigner et /armes', () => {
    expect(execute(game, '/heure 21h30').ok).toBe(true)
    expect(game.env.hours).toBeCloseTo(21.5)
    expect(execute(game, '/heure 25').ok).toBe(false)

    expect(execute(game, '/meteo pluie').ok).toBe(true)
    expect(game.env.weather).toBe('rain')
    expect(execute(game, '/meteo neige').ok).toBe(false)

    game.player.actor.health = 10
    execute(game, '/soigner')
    expect(game.player.actor.health).toBe(game.player.actor.maxHealth)

    execute(game, '/armes')
    expect(game.player.inventory.weapons.map((w) => w.id)).toEqual(
      expect.arrayContaining(['pistol', 'shotgun', 'rifle', 'sniper', 'grenade']),
    )
  })

  test('commande inconnue et /aide', () => {
    const unknown = execute(game, '/argent 1000000')
    expect(unknown.ok).toBe(false)
    expect(unknown.message).toContain('/aide')

    expect(execute(game, '/aide').message).toContain('/summon')
  })

  test('un message ordinaire est simplement repris', () => {
    expect(execute(game, ' bonjour ')).toEqual({ ok: true, message: 'bonjour' })
  })
})
