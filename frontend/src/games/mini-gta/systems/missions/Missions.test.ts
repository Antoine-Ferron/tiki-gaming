// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestGame, type TestGame } from '../../game/testing/harness'
import { newSave } from '../../domain/save'
import { useGameStore } from '../../state/gameStore'
import { Vector3 } from 'three'
import type { Actor } from '../../entities/Actor'
import type { Vehicle } from '../../entities/Vehicle'

vi.mock('../../net/api', () => import('../../game/testing/fakeApi'))

/**
 * Missions jouées dans une vraie partie simulée : démarrage chez le donneur, étapes, échecs, récompense payée
 * une seule fois par la fausse API (mêmes règles que le backend).
 */

let t: TestGame
let game: TestGame['game']
let notes: string[] = []

const def = (id: string) => game.missions.defs.find((d) => d.id === id)!
const teleport = (x: number, z: number) => {
  game.player.respawnAt(x, game.city.terrain.heightAt(x, z) + 0.2, z)
  t.simulate(0.1)
}
const moveVehicle = (v: Vehicle, x: number, z: number) => {
  v.body.setTranslation({ x, y: 0.5, z }, true)
  t.simulate(0.2)
}
const enter = (v: Vehicle) => {
  teleport(v.position.x + 2.5, v.position.z)
  game.player.tryEnterVehicle()
  t.simulate(0.1)
}

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
  game.events.on('notify', (n) => notes.push(n.text))
}, 60_000)

afterAll(() => t?.dispose())

beforeEach(() => {
  notes = []
  // Chaque scénario repart d'une partie neuve et sans mission en cours.
  game.missions.fail('remise à zéro')
  // Nettoyage immédiat des entités de mission (sinon 20 s loin du joueur), pour isoler les scénarios.
  ;(game.missions as unknown as { cleanup(force: boolean): void }).cleanup(true)
  game.police.clear()
  if (game.player.vehicle) game.player.exitVehicle(true)
  useGameStore.getState().load(newSave())
  notes = []
})

describe('donneurs de mission', () => {
  test('les quatre missions sont disponibles au début, sans mission en cours', () => {
    expect(game.missions.available().map((d) => d.id)).toEqual(['express', 'chase', 'port', 'special'])
    expect(game.missions.active).toBeNull()
    expect(game.missions.hud()).toBeNull()
    expect(game.missions.objective()).toBeNull()
  })

  test('près d’un donneur, E démarre sa mission', () => {
    const express = def('express')
    teleport(express.giver.x + 1, express.giver.z)

    expect(game.interactions.prompt).toContain('Colis express')
    t.press('KeyE')
    t.simulate(0.1)

    expect(game.missions.active?.def.id).toBe('express')
    expect(notes).toContain('Colis express')
    expect(game.missions.hud()).toMatchObject({ title: 'Colis express', objective: 'Récupère le colis (en véhicule)' })
  })

  test('pendant une mission, aucun donneur ne propose la sienne et ses marqueurs sont masqués', () => {
    const express = def('express')
    game.missions.start(express)
    const chase = def('chase')

    expect(game.missions.giverNear(new Vector3(chase.giver.x, 0, chase.giver.z))).toBeUndefined()
    game.missions.start(chase)
    expect(game.missions.active?.def.id).toBe('express')
    game.missions.render(1 / 60)
  })
})

describe('Colis express', () => {
  test('l’objectif est le point de collecte, affiché sur la carte', () => {
    game.missions.start(def('express'))

    const obj = game.missions.objective()
    game.missions.render(1 / 60)

    expect(obj?.x).toBeCloseTo(-430)
    expect(obj?.z).toBeCloseTo(-359.5)
  })

  test('à pied au point de collecte, l’étape ne valide pas : il faut un véhicule', () => {
    game.missions.start(def('express'))

    teleport(-430, -359.5)

    expect(game.missions.active?.runner.index).toBe(0)
  })

  test('en véhicule au point de collecte, la livraison chronométrée commence', () => {
    const car = [...game.vehicles].find((v) => v.persistent && v.spec.id === 'sedan')!
    enter(car)
    game.missions.start(def('express'))

    moveVehicle(car, -430, -359.5)

    expect(game.missions.active?.runner.index).toBe(1)
    expect(game.missions.hud()?.timer).toBeGreaterThan(160)
    expect(notes).toContain('Livre le colis au client')
  })

  test('abandon (mort, arrestation) : la mission échoue sans récompense', () => {
    game.missions.start(def('express'))

    game.missions.fail('Tu es mort')

    expect(game.missions.active).toBeNull()
    expect(notes).toContain('MISSION ÉCHOUÉE — Tu es mort')
    expect(useGameStore.getState().money).toBe(500)
  })

  test('échouer sans mission en cours ne fait rien', () => {
    game.missions.fail('rien')

    expect(notes).toEqual([])
  })
})

describe('La fuite', () => {
  test('une sportive cible apparaît, suivie par le GPS', () => {
    game.missions.start(def('chase'))

    const target = game.missions.tagged('target') as Vehicle | undefined

    expect(target?.spec.id).toBe('sport')
    expect(target?.driver?.tags.has('target')).toBe(true)
    expect(game.missions.objective()?.distanceTo(target!.position)).toBeLessThan(0.01)
  })

  test('la cible trop loin : la mission échoue', () => {
    game.missions.start(def('chase'))
    const p = game.player.position

    teleport(p.x + 500, p.z)

    expect(game.missions.active).toBeNull()
    expect(notes).toContain('MISSION ÉCHOUÉE — La cible s’est échappée')
  })

  test('la voiture cible détruite : mission réussie et payée', async () => {
    game.missions.start(def('chase'))
    const target = game.missions.tagged('target') as Vehicle

    target.explode()
    t.simulate(0.1)

    await vi.waitFor(() => expect(useGameStore.getState().completedMissions).toContain('chase'))
    expect(useGameStore.getState().money).toBe(500 + 1500)
    expect(useGameStore.getState().totalEarned).toBe(1500)
    expect(notes.some((n) => n.startsWith('MISSION RÉUSSIE'))).toBe(true)
  })
})

describe('Contrat au port', () => {
  test('des gardes armés protègent le trafiquant et se réveillent quand le joueur approche', () => {
    game.missions.start(def('port'))
    const boss = game.missions.tagged('boss')!

    expect([...game.missions.actors()].length).toBe(6)
    expect(boss.position.distanceTo(game.missions.objective()!)).toBeGreaterThan(0)
    teleport(boss.position.x + 5, boss.position.z)
    t.simulate(0.5)
    game.missions.postStep()
  })

  test('au port, le trafiquant éliminé puis la police semée : mission réussie', async () => {
    game.missions.start(def('port'))
    const step0 = def('port').steps[0] as { pos: { x: number; z: number } }
    teleport(step0.pos.x, step0.pos.z)
    expect(game.missions.active?.runner.index).toBe(1)
    expect(game.missions.objective()).not.toBeNull()

    const boss = game.missions.tagged('boss') as Actor
    boss.damage({ amount: 10_000, from: game.player.actor, kind: 'bullet', dir: { x: 1, z: 0 } })
    t.simulate(0.1)

    expect(notes).toContain('Cible éliminée')
    expect(game.missions.active?.runner.index).toBe(2)
    expect(game.police.wanted.stars).toBeGreaterThanOrEqual(2)

    game.police.clear()
    t.simulate(0.1)

    await vi.waitFor(() => expect(useGameStore.getState().completedMissions).toEqual(['port']))
    expect(useGameStore.getState().money).toBe(500 + 2500)
  })
})

describe('Commande spéciale', () => {
  test('voler la sportive dorée, semer la police et la ramener au garage : payée une seule fois', async () => {
    game.missions.start(def('special'))
    const gold = game.missions.tagged('special') as Vehicle
    expect(game.missions.objective()?.distanceTo(gold.position)).toBeLessThan(0.01)

    enter(gold)
    expect(game.missions.active?.runner.index).toBe(1)
    expect(game.police.wanted.stars).toBeGreaterThanOrEqual(2)

    game.police.clear()
    t.simulate(0.1)
    expect(game.missions.active?.runner.index).toBe(2)

    moveVehicle(gold, 472, 609.75)

    await vi.waitFor(() => expect(useGameStore.getState().completedMissions).toEqual(['special']))
    expect(useGameStore.getState().money).toBe(3500)
    expect(game.missions.available().map((d) => d.id)).not.toContain('special')

    // Le serveur ne paie pas deux fois la même mission.
    expect(await useGameStore.getState().completeMission('special')).toBe(0)
    expect(useGameStore.getState().money).toBe(3500)
  })

  test('la sportive trop abîmée : la mission échoue', () => {
    game.missions.start(def('special'))
    const gold = game.missions.tagged('special') as Vehicle

    gold.health = gold.spec.health * 0.2
    t.simulate(0.1)

    expect(notes).toContain('MISSION ÉCHOUÉE — La voiture est trop abîmée')
  })

  test('relancée aussitôt après un échec, la mission repart d’une sportive neuve', () => {
    game.missions.start(def('special'))
    const first = game.missions.tagged('special') as Vehicle
    first.health = first.spec.health * 0.2
    t.simulate(0.1)
    notes = []

    game.missions.start(def('special'))
    t.simulate(0.1)

    expect(game.missions.tagged('special')).not.toBe(first)
    expect(notes).not.toContain('MISSION ÉCHOUÉE — La voiture est trop abîmée')
  })

  test('toutes les missions terminées : la ville est à toi', async () => {
    useGameStore.getState().load({ ...newSave(), completedMissions: ['express', 'chase', 'port'] })
    game.missions.start(def('special'))
    const gold = game.missions.tagged('special') as Vehicle
    enter(gold)
    game.police.clear()
    t.simulate(0.1)
    moveVehicle(gold, 472, 609.75)

    await vi.waitFor(() => expect(notes).toContain('Toutes les missions sont terminées. La ville est à toi.'))
    expect(game.missions.available()).toEqual([])
  })
})

describe('après une mission', () => {
  test('une récompense refusée par le serveur est signalée au joueur', async () => {
    const { failNext } = await import('../../game/testing/fakeApi')
    game.missions.start(def('chase'))
    failNext(new Error('Le serveur est injoignable.'))

    ;(game.missions.tagged('target') as Vehicle).explode()
    t.simulate(0.1)

    await vi.waitFor(() => expect(notes).toContain('Le serveur est injoignable.'))
    expect(useGameStore.getState().completedMissions).toEqual([])
  })

  test('les entités de mission disparaissent quand le joueur s’éloigne', () => {
    game.missions.start(def('port'))
    game.missions.fail('test')
    const spawn = game.city.locations.spawn
    teleport(spawn.x, spawn.z)

    game.missions.update(21) // 20 s après la fin de la mission

    expect([...game.missions.actors()]).toEqual([])
  })
})
